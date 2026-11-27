#!/usr/bin/env node
/**
 * v2.4.0 大屏适配校验：node scripts/verifyLargeScreenMatrix.js
 *
 * 1) 跑常见电视 / 投影仪 / 4K 分辨率矩阵（8 种分辨率 × Web / 原生 TV / 机顶盒），
 *    断言分栏宽度、封面、键盘、最小点击区、可用高度的数值不变量；
 * 2) 校验分辨率变化确实会重算布局、低高度自动降级、4K 字号放大；
 * 3) 静态不变式：滚动兜底、字体缩放关闭、TV 焦点单轨、Web 键盘桥接、
 *    键盘功能行不溢出、Pages 站点配置。
 */
const ts = require("typescript");
const Module = require("module");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.resolve(root, rel), "utf8");
const has = (rel, text) => read(rel).includes(text);
const exists = (rel) => fs.existsSync(path.resolve(root, rel));

function loadTs(rel) {
  const file = path.resolve(root, rel);
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), {
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

const L = loadTs("utils/LargeScreen.ts");
const {
  LARGE_SCREEN_PROFILES,
  getCompactMetrics,
  isLargeScreenResolution,
  getKeyboardActionWidths,
  estimateLeftColumnHeight,
} = L;

// ── 1. 大屏判定 ───────────────────────────────────────────────────────────
check("分辨率矩阵覆盖 8 种电视 / 投影 / 4K 尺寸", LARGE_SCREEN_PROFILES.length === 8,
  LARGE_SCREEN_PROFILES.map((p) => `${p.width}x${p.height}`).join(" "));
check("8 种尺寸均识别为大屏",
  LARGE_SCREEN_PROFILES.every((p) => isLargeScreenResolution(p.width, p.height)));
check("手机 / 平板竖屏不误判为大屏",
  !isLargeScreenResolution(393, 852) && !isLargeScreenResolution(810, 1080));

// ── 2. 分辨率矩阵数值不变量 ───────────────────────────────────────────────
const PLATFORMS = [
  { name: "Web 投屏/桌面", deviceType: "desktop", spacing: 16, isSetTopBox: false, chromeWidth: 200, chromeHeight: 116 },
  { name: "原生电视", deviceType: "tv", spacing: 20, isSetTopBox: false, chromeWidth: 0, chromeHeight: 72 },
  { name: "机顶盒", deviceType: "tv", spacing: 20, isSetTopBox: true, chromeWidth: 0, chromeHeight: 72 },
];

const metricsRows = [];
for (const platform of PLATFORMS) {
  for (const profile of LARGE_SCREEN_PROFILES) {
    const m = getCompactMetrics(
      platform.deviceType, profile.width, profile.height, platform.spacing,
      platform.isSetTopBox,
      { chromeWidth: platform.chromeWidth, chromeHeight: platform.chromeHeight },
    );
    const tag = `${platform.name} ${profile.width}x${profile.height}`;
    metricsRows.push({
      platform: platform.name,
      resolution: `${profile.width}x${profile.height}`,
      content: `${m.contentWidth}x${m.contentHeight}`,
      left: m.leftWidth,
      cover: m.coverSize,
      key: m.keyHeight,
      body: m.body,
      columns: m.columns,
      touch: m.minTouchTarget,
      wide: m.isWide,
    });

    check(`${tag} 内容区有效`, m.contentWidth >= 320 && m.contentHeight >= 360,
      `${m.contentWidth}x${m.contentHeight}`);
    check(`${tag} 右栏不被挤压`, m.isWide ? m.leftWidth + m.gap * 1.5 + 260 <= m.contentWidth + 1 : true,
      `left=${m.leftWidth} content=${m.contentWidth}`);
    check(`${tag} 封面不超出可用高度`, m.coverSize <= m.contentHeight * 0.4 + 1,
      `cover=${m.coverSize} h=${m.contentHeight}`);
    check(`${tag} 四行键盘不占满高度`, m.keyHeight * 4 + m.gap * 3 <= m.contentHeight * 0.6 + 1,
      `key=${m.keyHeight} h=${m.contentHeight}`);
    check(`${tag} 大屏最小可点击区 >= 60`, m.minTouchTarget >= 60, `${m.minTouchTarget}`);
    check(`${tag} 左栏有滚动兜底`, m.columnScroll === true);

    // 键盘：字母行与功能行都不得超出面板可用宽度
    const padding = m.isTVLike ? m.cardPadding : Math.max(10, m.cardPadding - 4);
    const available = Math.max(190, Math.round(m.leftWidth - padding * 2));
    const letterWidth = Math.min(64 * Math.min(1.35, m.resolutionScale), (available - m.gapSm * 9) / 10);
    check(`${tag} 字母行不溢出面板`, letterWidth * 10 + m.gapSm * 9 <= available + 1,
      `${Math.round(letterWidth * 10 + m.gapSm * 9)} <= ${available}`);
    const actions = getKeyboardActionWidths(available, m.gapSm);
    const actionTotal = actions.reduce((a, b) => a + b, 0) + m.gapSm * 3;
    check(`${tag} 功能行不溢出面板`, actionTotal <= available,
      `${actionTotal} <= ${available}`);
    check(`${tag} 左栏高度有兜底`,
      estimateLeftColumnHeight(m) <= m.contentHeight || m.columnScroll,
      `estimated=${estimateLeftColumnHeight(m)} h=${m.contentHeight}`);
  }
}

// ── 3. 分辨率变化 / 降级 / 缩放 ───────────────────────────────────────────
const opt = { chromeWidth: 200, chromeHeight: 116 };
const m720 = getCompactMetrics("desktop", 1280, 720, 16, false, opt);
const m1080 = getCompactMetrics("desktop", 1920, 1080, 16, false, opt);
const m4k = getCompactMetrics("desktop", 3840, 2160, 16, false, opt);
const mLow = getCompactMetrics("desktop", 1280, 600, 16, false, opt);
const mPortrait = getCompactMetrics("desktop", 1080, 1920, 16, false, opt);

check("分辨率变化触发尺寸重算",
  m720.leftWidth !== m1080.leftWidth && m720.keyHeight !== m1080.keyHeight,
  `720p left=${m720.leftWidth} key=${m720.keyHeight} / 1080p left=${m1080.leftWidth} key=${m1080.keyHeight}`);
check("4K 字号随分辨率放大", m4k.body > m1080.body && m4k.pageTitle > m1080.pageTitle,
  `body ${m1080.body} -> ${m4k.body}`);
check("720p 行高与键盘收紧", m720.keyHeight <= m1080.keyHeight && m720.coverSize <= m1080.coverSize,
  `key ${m720.keyHeight}/${m1080.keyHeight} cover ${m720.coverSize}/${m1080.coverSize}`);
check("低高度自动降级为单列", mLow.isWide === false, `contentHeight=${mLow.contentHeight}`);
check("竖屏大屏不强制左右分栏", mPortrait.isWide === false, `contentWidth=${mPortrait.contentWidth}`);
check("大屏命中 TV 形态（Web 也能拿到 10-foot 标尺）",
  m1080.isTVLike && m720.isTVLike && m4k.isTVLike);

// ── 4. 静态不变式 ─────────────────────────────────────────────────────────
for (const page of ["app/search.tsx", "app/music.tsx", "app/radio.tsx"]) {
  check(`${page} 左栏滚动兜底`,
    has(page, "contentContainerStyle={dyn.leftColumnContent}") && has(page, "leftColumnContent"));
  check(`${page} 分栏受可用高度约束`, has(page, "maxHeight: m.contentHeight"));
  check(`${page} 使用最小点击区标尺`, has(page, "minTouchTarget"));
}
check("音乐右栏按扣除侧栏后的宽度推导", has("app/music.tsx", "metrics.contentWidth - metrics.leftWidth"));
check("系统字体缩放已关闭", has("components/ThemedText.tsx", "allowFontScaling={false}") &&
  has("components/ThemedText.tsx", "maxFontSizeMultiplier={1}"));
check("TV 端 useScale 不再按宽度放大行高", !has("hooks/useScale.ts", "width / 1000"));
check("窗口 / 分辨率变化监听齐全", has("utils/DesignTokens.ts", 'addEventListener("resize"') &&
  has("utils/DesignTokens.ts", 'addEventListener("orientationchange"') &&
  has("utils/DesignTokens.ts", "visualViewport"));
check("Web 大屏键盘 / 遥控器桥接", has("hooks/useSafeTVEventHandler.ts", 'addEventListener("keydown"') &&
  has("hooks/useSafeTVEventHandler.ts", "moveDomFocus"));
check("焦点由原生 / DOM 驱动（onFocus 同步视觉焦点）",
  has("app/music.tsx", "onFocus={() => setFocusIndex(index)}") &&
  has("app/radio.tsx", "onFocus={() => setFocusIndex(index)}"));
check("TV 焦点单轨：不再有 select/up/down 全局消费",
  !has("app/music.tsx", 'case "select"') && !has("app/music.tsx", 'case "up"') &&
  !has("app/radio.tsx", 'case "select"') && !has("app/radio.tsx", 'case "down"'));
check("首项有 TV 初始焦点", has("app/music.tsx", "hasTVPreferredFocus") &&
  has("app/radio.tsx", "hasTVPreferredFocus"));
check("键盘功能行按面板权重分配", has("components/SearchKeyboard.tsx", "getKeyboardActionWidths") &&
  !has("components/SearchKeyboard.tsx", "Math.max(48, letterKeyWidth"));
check("键盘按键可收缩且带 hitSlop", has("components/SearchKeyboard.tsx", "flexShrink: 1") &&
  has("components/SearchKeyboard.tsx", "hitSlop"));

// ── 5. GitHub Pages 站点配置 ──────────────────────────────────────────────
check("Pages 部署工作流存在", exists(".github/workflows/pages.yml"));
check("Pages 产物准备脚本存在", exists("scripts/preparePages.js"));
check("PWA manifest 使用相对路径", has("public/manifest.json", '"start_url": "./"') &&
  has("public/manifest.json", '"src": "./icon.svg"'));
check("HTML 资源使用相对路径", has("app/+html.tsx", 'href="./manifest.json"'));

const passed = results.filter(Boolean).length;
console.log("\n--- 大屏分辨率矩阵摘要 ---");
for (const row of metricsRows.filter((r) => r.platform === "Web 投屏/桌面")) {
  console.log(`${row.resolution.padEnd(10)} content=${row.content.padEnd(10)} left=${String(row.left).padEnd(5)} cover=${String(row.cover).padEnd(4)} key=${String(row.key).padEnd(3)} body=${String(row.body).padEnd(3)} cols=${row.columns} touch=${row.touch} wide=${row.wide}`);
}
console.log(`\nRESULT ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
