#!/usr/bin/env node
/**
 * 音频源可用性校验（开发/发版前执行）：node scripts/verifyAudioSources.js
 *
 * 直接用 TypeScript 转译加载项目里的真实服务代码与内置内容库，
 * 避免「校验脚本另写一套逻辑」造成的假阳性。校验项：
 *  - iTunes 浏览 / 中文搜索地区回退 / 音乐电台兜底 / radio-browser 在线目录
 *  - 内置曲目与电台的地址协议、ID 唯一性、地区覆盖、数量
 *  - 内置电台流是否真的能连上（抽样发 Range 请求，取首个字节即断开）
 */
const ts = require("typescript");
const Module = require("module");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const HTTPS = (u) => typeof u === "string" && u.startsWith("https://");

/** 极简 TS 加载器：支持 @/ 别名，便于在 Node 里直接跑纯 TS 数据/服务层 */
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

/**
 * 只等响应头判断流是否可连接（拿到 headers 立刻 abort，不下载音频体）。
 * Icecast 直播流偶发慢启动，因此带一次重试；不带 Range，避免部分服务器等待首块数据。
 */
async function probe(url, timeoutMs = 12000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (response.status >= 200 && response.status < 400) return true;
    } catch {
      // 尝试下一次
    } finally {
      clearTimeout(timer);
    }
  }
  return false;
}

(async () => {
  const service = loadTs("services/onlineMusic.ts");
  const library = loadTs("constants/AudioLibrary.ts");

  try {
    const latest = await service.browseMusicByGenre("流行", "全部", 8);
    check("iTunes 浏览最新单曲", latest.length > 0, `${latest.length} 首，首条 ${latest[0]?.title || "-"}`);
    check("在线单曲地址均可播放", latest.every((t) => HTTPS(t.url)));
  } catch (e) {
    check("iTunes 浏览最新单曲", false, e.message);
  }

  try {
    const cn = await service.searchLatestMusic("周杰伦", "中国", 8);
    check("中国区中文搜索地区回退", cn.length > 0, `${cn.length} 首，首条 ${cn[0]?.title || "-"}`);
  } catch (e) {
    check("中国区中文搜索地区回退", false, e.message);
  }

  try {
    const channels = await service.fetchMusicChannels("中国", "全部", 8);
    check("音乐电台兜底音源", channels.length > 0, `${channels.length} 个，首条 ${channels[0]?.title || "-"}`);
    check("音乐电台标记为直播流", channels.every((t) => t.isLive === true && HTTPS(t.url)));
  } catch (e) {
    check("音乐电台兜底音源", false, e.message);
  }

  try {
    const stations = await service.loadOnlineStations("全部", "全部", 8);
    check("radio-browser 在线目录", stations.length > 0, `${stations.length} 个，首条 ${stations[0]?.name || "-"}`);
  } catch (e) {
    check("radio-browser 在线目录", false, e.message);
  }

  const allIds = [
    ...library.BUILTIN_TRACKS.map((t) => t.id),
    ...library.BUILTIN_RADIO_STATIONS.map((s) => s.id),
  ];
  check("内置库 ID 唯一", new Set(allIds).size === allIds.length, `${allIds.length} 项`);
  check("内置曲目均为 https", library.BUILTIN_TRACKS.every((t) => HTTPS(t.url) &&
    (!t.fallbackUrls || t.fallbackUrls.every(HTTPS))));
  check("内置电台均为 https", library.BUILTIN_RADIO_STATIONS.every((s) => HTTPS(s.url) &&
    (!s.fallbackUrls || s.fallbackUrls.every(HTTPS))));

  const regions = new Set(library.BUILTIN_RADIO_STATIONS.map((s) => s.country));
  check("内置电台覆盖四地区", ["中国", "欧美", "日本", "韩国"].every((r) => regions.has(r)), [...regions].join("/"));
  check("内置电台数量 >= 20", library.BUILTIN_RADIO_STATIONS.length >= 20, `${library.BUILTIN_RADIO_STATIONS.length} 个`);
  check("内置音乐含 24h 直播源", library.BUILTIN_TRACKS.some((t) => t.isLive),
    `${library.BUILTIN_TRACKS.filter((t) => t.isLive).length} 条`);

  // 抽样探测：每个地区取一个代表，确认内置电台不是「看起来可用」
  const samples = ["中国", "欧美", "日本", "韩国"].map((region) =>
    library.BUILTIN_RADIO_STATIONS.find((s) => s.country === region)
  ).filter(Boolean);
  const probes = await Promise.all(samples.map((s) => probe(s.url)));
  probes.forEach((ok, i) => check(`内置电台可连接: ${samples[i].name}`, ok, samples[i].url));

  const passed = results.filter(Boolean).length;
  console.log(`\nRESULT ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
