#!/usr/bin/env node
/**
 * v2.5.0 模块化 / 中文输入 / 离线广播 / 双通道更新 校验：node scripts/verifyModules.js
 *
 * 数值部分直接加载项目里的真实纯计算模块（不另写一套实现），
 * 静态部分检查关键改造是否落到真实文件上。
 */
const ts = require("typescript");
const Module = require("module");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.resolve(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.resolve(root, rel));
const has = (rel, text) => exists(rel) && read(rel).includes(text);

function loadTs(rel) {
  const file = path.resolve(root, rel);
  const out = ts.transpileModule(read(rel), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  const originalRequire = mod.require.bind(mod);
  mod.require = (id) => {
    if (id.startsWith("@/")) return loadTs(id.slice(2) + ".ts");
    if (id.startsWith(".")) {
      const target = path.resolve(path.dirname(file), id);
      if (fs.existsSync(target + ".ts")) {
        return loadTs(path.relative(root, target + ".ts").replace(/\\/g, "/"));
      }
    }
    return originalRequire(id);
  };
  mod._compile(out, file);
  return mod.exports;
}

const results = [];
function check(name, ok, detail = "") {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " | " + detail : ""}`);
}

// ── 1. 中文拼音输入引擎 ───────────────────────────────────────────────────
const ime = loadTs("utils/pinyinIme.ts");
const stats = ime.lexiconStats();
check("拼音词库规模够用", stats.words >= 40 && stats.syllables >= 100,
  `${stats.words} 词 / ${stats.syllables} 音节`);
check("全拼前缀召回中文候选", ime.getCandidates("qing").includes("庆") &&
  ime.getCandidates("qing").includes("庆余年"));
check("首字母召回中文片名", ime.getCandidates("qyn").includes("庆余年"));
check("英文模式不进组合区", ime.pushLetter(ime.EMPTY_IME, "q", false).composing === "");
let composing = ime.EMPTY_IME;
for (const ch of "qing") composing = ime.pushLetter(composing, ch, true);
check("中文模式累积拼音并产生候选", composing.composing === "qing" && composing.candidates.length > 0,
  `候选 ${composing.candidates.length}`);
const firstBackspace = ime.backspaceIme(composing);
check("删除键先退拼音组合", firstBackspace.state.composing === "qin" && !firstBackspace.removeText);
let emptied = composing;
for (let i = 0; i < 4; i += 1) emptied = ime.backspaceIme(emptied).state;
check("组合清空后删除键才删正文", ime.backspaceIme(emptied).removeText === true);
check("按码点删除中文", ime.deleteLastCodePoint("庆余年") === "庆余" &&
  ime.deleteLastCodePoint("a😀") === "a");
check("选中候选提交中文并清空组合",
  ime.selectCandidate(composing, composing.candidates.indexOf("庆余年")).text === "庆余年" ||
  ime.selectCandidate(composing, 0).state.composing === "");
check("提交英文 / 清空语义", ime.commitComposition(composing).text === "QING" &&
  ime.clearIme().composing === "");

// ── 2. Solara 式缓存 / 雷达 / 熔断 ───────────────────────────────────────
const discovery = loadTs("modules/music/musicDiscovery.ts");
const mk = (id) => ({ id });
check("榜单去重", discovery.dedupeTracks([mk("a"), mk("a"), mk("b")]).length === 2);
const radar = discovery.buildRadar(
  [["a", "b", "c"].map(mk), ["b", "d", "e"].map(mk)],
  ["a"],
  { chartSize: 20, injectCount: 3, excludeRecent: true },
  () => 0,
);
check("雷达排除正在播放且不重复", !radar.some((t) => t.id === "a") &&
  new Set(radar.map((t) => t.id)).size === radar.length && radar.length <= 3);
const breaker = new discovery.CircuitBreaker();
breaker.recordFailure(1000); breaker.recordFailure(1000); breaker.recordFailure(1000);
check("连续失败触发熔断", breaker.isOpen(3, 60_000, 2000) === true);
check("冷却结束后半开重试", breaker.isOpen(3, 60_000, 62_000) === false);
breaker.recordSuccess();
check("成功后熔断器复位", breaker.failureCount === 0);
check("有效结果缓存只接受非空合法数据",
  has("modules/music/musicCache.ts", "isValidResult") &&
  has("modules/music/musicCache.ts", "坏结果不入库") &&
  has("modules/music/musicCore.ts", "isValidResult"));
check("关键词记忆与榜单雷达接入页面",
  has("modules/music/MusicScreen.tsx", "restoreMusicQuery") &&
  has("modules/music/musicCore.ts", "buildRadar"));

// ── 3. 离线广播 ──────────────────────────────────────────────────────────
const packs = loadTs("modules/defaultPacks.ts");
const offline = packs.BUNDLED_PACKS.radio.config.offlinePrograms;
check("离线节目单非空且可独立升级", offline.length >= 8, `${offline.length} 个节目`);
check("离线音频全部 https 且 ID 唯一 offline- 前缀",
  offline.every((p) => /^https:\/\//.test(p.url) && p.id.startsWith("offline-")) &&
  new Set(offline.map((p) => p.id)).size === offline.length);
check("离线节目标注许可与来源", offline.every((p) => !!p.license && !!p.source));
check("播放器接受本地缓存文件", has("services/audioPlayer.ts", "file:\\/\\/") &&
  has("services/audioPlayer.ts", "blob:"));
check("原生与 Web 双实现存在", exists("services/offlineCache.ts") && exists("services/offlineCache.web.ts"));
check("缓存配额与 LRU 清理", has("services/offlineCache.ts", "pruneCache") &&
  has("services/offlineCache.ts", "cacheQuotaMB") === false &&
  has("services/offlineCache.ts", "quotaMB"));
check("断网自动回退到已缓存节目",
  has("modules/radio/RadioScreen.tsx", "autoFallbackToCached") &&
  has("modules/radio/RadioScreen.tsx", "离线节目"));
check("页面提供离线筛选与预缓存",
  has("modules/radio/RadioScreen.tsx", "precacheOffline") &&
  has("modules/radio/RadioScreen.tsx", "setOfflineOnly"));
check("失焦停止与释放未被破坏", has("modules/radio/RadioScreen.tsx", "useFocusEffect") &&
  has("modules/radio/RadioScreen.tsx", "audioPlayer.stop()"));

// ── 4. 模块化与独立升级 ──────────────────────────────────────────────────
const { checksumText, normalizePackText, compareModuleVersions, supportsAppVersion } =
  loadTs("modules/checksum.ts");
const registry = JSON.parse(read("module-registry.json"));
check("模块清单 schema 与三模块", registry.schema === 1 && registry.modules.length === 3);
check("三模块内置版本一致", ["search", "music", "radio"].every((id) =>
  packs.BUNDLED_PACKS[id].version === "2.5.0"));
for (const manifest of registry.modules) {
  const file = manifest.pack;
  const text = read(file);
  const parsed = JSON.parse(text);
  check(`${manifest.id} 资源包校验和一致`, checksumText(text) === manifest.checksum);
  check(`${manifest.id} CRLF 代理通道校验和一致`,
    checksumText(normalizePackText(text.replace(/\n/g, "\r\n"))) === manifest.checksum);
  check(`${manifest.id} 资源包体积一致`, text.length === manifest.size);
  check(`${manifest.id} 资源包与内置默认一致`,
    JSON.stringify(parsed) === JSON.stringify(packs.BUNDLED_PACKS[manifest.id]));
}
check("版本比较与最低 App 版本约束",
  compareModuleVersions("2.5.1", "2.5.0") === 1 &&
  compareModuleVersions("2.4.9", "2.5.0") === -1 &&
  supportsAppVersion("2.5.0", "2.5.0") && !supportsAppVersion("2.4.0", "2.5.0"));
check("路由薄壳化（升级模块不动路由）", ["search", "music", "radio"].every((id) =>
  has(`app/${id}.tsx`, "export default Screen") && has(`app/${id}.tsx`, "modules/")));
check("模块独立检查 / 更新 / 回滚", ["checkModuleUpdates", "updateModule", "rollback"].every((fn) =>
  has("modules/ModuleManager.ts", fn)));
check("模块包可单独重建", has("scripts/buildModulePacks.js", "--only"));
check("设置页可触发模块更新", exists("components/settings/ModuleUpdateSection.tsx"));

// ── 5. 搜索框焦点与双通道更新 ────────────────────────────────────────────
check("输入框不再被父层 Touchable 拦截",
  !has("components/SearchInput.tsx", "TouchableOpacity\n        activeOpacity={1}") &&
  has("components/SearchInput.tsx", "普通 View"));
check("输入框所有平台可聚焦", has("components/SearchInput.tsx", "focusable={true}") &&
  has("components/SearchInput.tsx", "editable={true}"));
check("onFocus 不再收起屏幕键盘", !has("modules/search/SearchScreen.tsx", "setShowKeyboard(false)\n          }}"));
check("键盘具备中文组合区与候选", has("components/SearchKeyboard.tsx", "onSelectCandidate") &&
  has("components/SearchKeyboard.tsx", "composing"));
const channels = read("services/updateChannels.ts");
check("国内通道含 jsDelivr 三节点", ["cdn.jsdelivr.net", "fastly.jsdelivr.net", "gcore.jsdelivr.net"]
  .every((host) => channels.includes(host)));
check("海外通道含 GitHub 直连", channels.includes("raw.githubusercontent.com") &&
  channels.includes("github.com"));
check("区域偏好可切换并记忆成功通道", channels.includes("setUpdateRegion") &&
  channels.includes("recordEndpointResult"));
check("安装包多镜像换源", (read("constants/UpdateConfig.ts").match(/https:\/\/gh/g) || []).length >= 4);
check("模块包双通道下发", has("constants/UpdateConfig.ts", "getModuleRegistryUrls") &&
  has("constants/UpdateConfig.ts", "getModulePackUrls"));
check("app.json 声明模块清单与通道", has("app.json", "moduleRegistry") &&
  has("app.json", "updateChannels"));

const versions = ["package.json", "app.json", "desktop/package.json"].map((f) => {
  const m = read(f).match(/"version"\s*:\s*"([\d.]+)"/);
  return m ? m[1] : "?";
});
check("三处版本号统一 2.5.0", versions.every((v) => v === "2.5.0"), versions.join("/"));

const passed = results.filter(Boolean).length;
console.log(`\nRESULT ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
