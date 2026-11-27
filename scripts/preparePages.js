#!/usr/bin/env node
/**
 * 把 Expo Web 静态导出产物整理成 GitHub Pages 项目站点（/ZTV/）可用目录。
 *
 * 用法：node scripts/preparePages.js <output-dir> [base]
 *  - 修正资源绝对路径为带 base 的形式（兼容未设置 EXPO_BASE_URL 的导出）；
 *  - 生成 404.html 作为 SPA 深链回退、.nojekyll 保留下划线资源目录；
 *  - 修正 PWA manifest 为相对路径，保证子路径安装可用。
 */
const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || "web-build";
// Git Bash / MSYS 会把以 / 开头的参数转换成本机盘符路径，这里做规范化回退
const rawBase = process.argv[3] || "/ZTV";
const base = /^\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(rawBase)
  ? rawBase.replace(/\/$/, "")
  : "/ZTV";
const root = path.resolve(process.cwd(), dir);

if (!fs.existsSync(root)) {
  console.error(`[preparePages] 导出目录不存在: ${root}`);
  process.exit(1);
}

const readFile = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const writeFile = (rel, content) => fs.writeFileSync(path.join(root, rel), content, "utf8");

/** 清理 Git Bash / MSYS 把 /ZTV 自动改写成本机盘符路径造成的污染 */
const cleanBadBase = (text) =>
  text.replace(/[A-Za-z]:\/[^"'\s)]*?\/ZTV\//g, `${base}/`);

/** 把根路径资源引用改写到项目站点子路径；正则本身幂等，可重复执行 */
const rewritePaths = (text) => {
  let out = cleanBadBase(text);
  out = out.replace(/(["'(])\/_expo\//g, `$1${base}/_expo/`);
  out = out.replace(/(["'(])\/assets\//g, `$1${base}/assets/`);
  out = out.replace(/href="\/manifest\.json"/g, `href="${base}/manifest.json"`);
  out = out.replace(/href="\/icon\.svg"/g, `href="${base}/icon.svg"`);
  return out;
};

let html = readFile("index.html");
html = rewritePaths(html);
if (!html.includes("viewport-fit=cover")) {
  html = html.replace("width=device-width, initial-scale=1", "width=device-width, initial-scale=1, viewport-fit=cover");
}
html = html.replace('<html lang="en">', '<html lang="zh-CN">');
if (!html.includes('name="theme-color"')) {
  html = html.replace("</head>", '  <meta name="theme-color" content="#0B0E13" />\n  </head>');
}
if (!html.includes('name="description"')) {
  html = html.replace("</head>", '  <meta name="description" content="ZTV 全端视频直播、音乐在线与网络收音机，适配电视与投影仪大屏" />\n  </head>');
}
writeFile("index.html", html);
writeFile("404.html", html);
writeFile(".nojekyll", "");

// PWA manifest：子路径安装时 start_url / scope / icons 必须是相对或带 base 的路径
const manifestPath = "manifest.json";
if (fs.existsSync(path.join(root, manifestPath))) {
  let manifest = readFile(manifestPath);
  manifest = manifest
    .replace(/"start_url"\s*:\s*"\/"/g, '"start_url": "./"')
    .replace(/"scope"\s*:\s*"\/"/g, '"scope": "./"')
    .replace(/"src"\s*:\s*"\/icon\.svg"/g, '"src": "./icon.svg"');
  writeFile(manifestPath, manifest);
}

// bundle 内的绝对路径资源（字体 / 图片等）同样需要带 base
const jsDir = path.join(root, "_expo", "static", "js");
if (fs.existsSync(jsDir)) {
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".js")) {
        const rel = path.relative(root, full).split(path.sep).join("/");
        const patched = rewritePaths(readFile(rel));
        if (patched !== readFile(rel)) writeFile(rel, patched);
      }
    }
  };
  walk(jsDir);
}

const assetCount = fs.existsSync(path.join(root, "_expo"))
  ? fs.readdirSync(path.join(root, "_expo"), { recursive: true }).length
  : 0;
console.log(`[preparePages] base=${base} dir=${root}`);
console.log(`[preparePages] index.html + 404.html + .nojekyll 已生成，_expo 资源 ${assetCount} 项`);
