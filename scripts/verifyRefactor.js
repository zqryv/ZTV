#!/usr/bin/env node
/**
 * v2.3.0 重构静态校验：node scripts/verifyRefactor.js
 *
 * 覆盖四组不变式：
 *  1) 三界面按新设计稿落地（统一紧凑标尺 + 大屏左右分栏 + 键盘独立面板）；
 *  2) 「音乐播放」统一更名为「音乐在线」，且入口 / 导航 / 元信息一致；
 *  3) 更新链路修复（并发竞速 / 缓存 / 多源下载 / 断点续传 / 停滞检测）；
 *  4) 内置音源按地区覆盖、地址合法、业务功能未被界面重构破坏。
 */
const ts = require("typescript");
const Module = require("module");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.resolve(root, rel), "utf8");
const has = (rel, text) => read(rel).includes(text);

/** 极简 TS 加载器，直接读取项目里的真实常量 */
function loadTs(rel) {
  const file = path.resolve(root, rel);
  const src = fs.readFileSync(file, "utf8");
  const out = ts.transpileModule(src, {
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
  mod.require = (id) => (id.startsWith("@/") ? loadTs(id.slice(2) + ".ts") : originalRequire(id));
  mod._compile(out, file);
  return mod.exports;
}

const results = [];
function check(name, ok, detail = "") {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " | " + detail : ""}`);
}

// ── 1. 设计落地 ───────────────────────────────────────────────────────────
check("统一紧凑标尺存在", has("utils/DesignTokens.ts", "useCompactLayout") &&
  has("utils/DesignTokens.ts", "getCompactMetrics"));
check("标尺按栏宽推导封面（不再按整屏）", has("utils/DesignTokens.ts", "leftWidth * coverRatio"));

for (const page of ["app/search.tsx", "app/radio.tsx", "app/music.tsx"]) {
  check(`${page} 使用统一标尺`, has(page, "useCompactLayout"));
  check(`${page} 大屏左右分栏`, has(page, "columnsWide") && has(page, "leftColumnWide"));
}
check("搜索键盘收进左栏独立面板", has("app/search.tsx", "panelWidth={isWide ? metrics.leftWidth : undefined}"));
check("音乐页键盘按右栏宽度收紧", has("app/music.tsx", "panelWidth={rightWidth}"));
check("键盘支持面板宽度", has("components/SearchKeyboard.tsx", "panelWidth"));
check("键盘焦点键翡翠绿高亮", has("components/SearchKeyboard.tsx", "keyHighlighted"));
check("电视端遥控器提示", has("utils/DesignTokens.ts", "showRemoteHint") &&
  has("components/SearchKeyboard.tsx", "方向键移动"));
check("音乐封面尺寸取自标尺", has("app/music.tsx", "const coverSize = metrics.coverSize"));
check("右栏曲目网格与精选歌单", has("app/music.tsx", "gridColumns") && has("app/music.tsx", "精选歌单"));
check("搜索页 TOP5 与猜你想搜", has("app/search.tsx", "HOT_TOP_ITEMS.slice(0, 5)") && has("app/search.tsx", "猜你想搜"));
check("收音机电视单列 / 桌面双列", has("app/radio.tsx", "isTVLike ? 1 : isWide ? 2 : 1"));

// ── 2. 更名 ───────────────────────────────────────────────────────────────
check("首页分类改为音乐在线", has("stores/homeStore.ts", 'title: "音乐在线"') &&
  !has("stores/homeStore.ts", 'title: "音乐播放"'));
check("音乐页标题改为音乐在线", has("app/music.tsx", 'title="音乐在线"') &&
  has("app/music.tsx", "音乐在线</ThemedText>"));
check("侧边栏导航同步更名", has("components/navigation/TabletSidebarNavigator.tsx", "音乐在线"));
check("底部/Tab 导航同步更名", has("components/MobileBottomNavigation.tsx", "音乐在线") &&
  has("components/navigation/MobileTabContainer.tsx", "音乐在线"));
check("PWA 与 HTML 元信息同步", has("public/manifest.json", "音乐在线") && has("app/+html.tsx", "音乐在线"));

// ── 3. 更新链路 ───────────────────────────────────────────────────────────
check("版本源并发竞速", has("services/updateService.ts", "firstFulfilled") &&
  has("services/updateService.ts", "raceVersionInfo"));
check("镜像地址修正为 /main/package.json", has("constants/UpdateConfig.ts", "/main/package.json?t=${Date.now()}"));
check("时间戳在请求时生成", has("constants/UpdateConfig.ts", "getVersionMirrorUrls()") &&
  has("services/updateService.ts", "UPDATE_CONFIG.getVersionMirrorUrls()"));
check("检查结果缓存与并发去重", has("services/updateService.ts", "CACHE_TTL_MS") &&
  has("services/updateService.ts", "inFlight"));
check("手动检查强制刷新 / 静默复用缓存", has("stores/updateStore.ts", "updateService.checkVersion(!silent)"));
check("自动检查等待初始化完成", has("app/_layout.tsx", "!initialized") &&
  has("stores/updateStore.ts", "initialized: true"));
check("多下载源候选", has("constants/UpdateConfig.ts", "getDownloadCandidates") &&
  has("stores/updateStore.ts", "UPDATE_CONFIG.getDownloadCandidates"));
check("下载停滞检测与完整性校验", has("services/updateService.ts", "DOWNLOAD_STALL_MS") &&
  has("services/updateService.ts", "MIN_ASSET_BYTES"));
check("断点续传 resumeData", has("services/updateService.ts", "resumeData") &&
  has("services/updateService.ts", "pauseAsync"));
check("在线音源并发检索", has("services/onlineMusic.ts", "Promise.all(requests)") &&
  has("services/onlineMusic.ts", "firstValid"));

// ── 4. 音源覆盖与功能保留 ─────────────────────────────────────────────────
const library = loadTs("constants/AudioLibrary.ts");
const service = loadTs("services/onlineMusic.ts");
const REQUIRED_REGIONS = ["中国大陆", "中国台湾", "美国"];
const HTTPS = (u) => typeof u === "string" && u.startsWith("https://");

check("音乐地区含中国大陆/中国台湾/美国",
  REQUIRED_REGIONS.every((r) => library.MUSIC_COUNTRIES.includes(r)), library.MUSIC_COUNTRIES.join("/"));
check("电台地区含中国大陆/中国台湾/美国",
  REQUIRED_REGIONS.every((r) => library.RADIO_COUNTRIES.includes(r)), library.RADIO_COUNTRIES.join("/"));
check("地区检索码包含新标签",
  REQUIRED_REGIONS.every((r) => !!service.RADIO_COUNTRY_CODES[r] && !!service.ITUNES_COUNTRY_CODES[r]));
check("旧地区标签保持兼容", !!service.RADIO_COUNTRY_CODES["中国"] && !!service.ITUNES_COUNTRY_CODES["欧美"]);

const stationRegions = new Set(library.BUILTIN_RADIO_STATIONS.map((s) => s.country));
const trackRegions = new Set(library.BUILTIN_TRACKS.map((t) => t.country));
for (const region of REQUIRED_REGIONS) {
  const count = library.BUILTIN_RADIO_STATIONS.filter((s) => s.country === region).length;
  check(`内置电台覆盖 ${region} >= 3`, count >= 3, `${count} 个`);
}
check("内置音乐流覆盖三地区", REQUIRED_REGIONS.every((r) => trackRegions.has(r)), [...trackRegions].join("/"));

const allIds = [
  ...library.BUILTIN_TRACKS.map((t) => t.id),
  ...library.BUILTIN_RADIO_STATIONS.map((s) => s.id),
];
check("内置库 ID 唯一", new Set(allIds).size === allIds.length, `${allIds.length} 项`);
check("内置电台均为 https", library.BUILTIN_RADIO_STATIONS.every((s) => HTTPS(s.url) &&
  (!s.fallbackUrls || s.fallbackUrls.every(HTTPS))));
check("内置曲目均为 https", library.BUILTIN_TRACKS.every((t) => HTTPS(t.url) &&
  (!t.fallbackUrls || t.fallbackUrls.every(HTTPS))));
check("内置电台标注来源", library.BUILTIN_RADIO_STATIONS.every((s) => !!s.source),
  `${library.BUILTIN_RADIO_STATIONS.filter((s) => !!s.source).length}/${library.BUILTIN_RADIO_STATIONS.length}`);

check("收音机保留失焦停止与资源释放", has("app/radio.tsx", "useFocusEffect") &&
  has("app/radio.tsx", "audioPlayer.stop()"));
check("收音机保留自定义电台与遥控器", has("app/radio.tsx", "addCustomStation") &&
  has("app/radio.tsx", "useSafeTVEventHandler"));
check("音乐在线保留失焦停止与三级降级", has("app/music.tsx", "useFocusEffect") &&
  has("app/music.tsx", "fetchMusicChannels") && has("app/music.tsx", "browseMusicByGenre"));
check("音乐在线保留常驻可输入搜索框", has("app/music.tsx", "editable") &&
  has("app/music.tsx", "focusable={!isTVLike}"));
check("音乐在线保留屏幕键盘与热词", has("app/music.tsx", "SearchKeyboard") &&
  has("app/music.tsx", "MUSIC_QUICK_TERMS"));
check("搜索保留拼音首字母与远程输入", has("app/search.tsx", "matchesInitials") &&
  has("app/search.tsx", "RemoteControlModal"));

// ── 5. 版本号一致 ─────────────────────────────────────────────────────────
const versions = ["package.json", "app.json", "desktop/package.json"].map((f) => {
  const match = read(f).match(/"version"\s*:\s*"([\d.]+)"/);
  return match ? match[1] : "?";
});
check("三处版本号统一为 2.3.0", versions.every((v) => v === "2.3.0"), versions.join("/"));

const passed = results.filter(Boolean).length;
console.log(`\nRESULT ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
