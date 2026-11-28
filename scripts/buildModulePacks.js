#!/usr/bin/env node
/**
 * 生成模块资源包与模块清单：node scripts/buildModulePacks.js [--only search|music|radio]
 *
 * 单独升级某个模块时只重建该模块的几 KB JSON 包，并更新清单里对应条目；
 * 其它模块包的 checksum / 内容保持不变，客户端不会误下载。
 */
const ts = require("typescript");
const fs = require("fs");
const path = require("path");
const Module = require("module");

const root = path.resolve(__dirname, "..");
const loadTs = (rel) => {
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
  mod._compile(out, file);
  return mod.exports;
};

const { BUNDLED_PACKS, BUNDLED_MODULE_META, APP_VERSION } = loadTs("modules/defaultPacks.ts");
const { checksumText } = loadTs("modules/checksum.ts");
const ids = Object.keys(BUNDLED_PACKS);
const onlyIndex = process.argv.indexOf("--only");
const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;
if (only && !ids.includes(only)) {
  console.error(`Unknown module: ${only}. Expected one of ${ids.join(", ")}`);
  process.exit(1);
}

const packDir = path.resolve(root, "module-packs");
fs.mkdirSync(packDir, { recursive: true });
const registryFile = path.resolve(root, "module-registry.json");
let registry = { schema: 1, appVersion: APP_VERSION, updatedAt: "", modules: [] };
if (fs.existsSync(registryFile)) {
  try {
    registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
  } catch {
    /* 清单损坏时重建 */
  }
}
registry.schema = 1;
registry.appVersion = APP_VERSION;
registry.updatedAt = new Date().toISOString();
registry.modules = Array.isArray(registry.modules) ? registry.modules : [];

const targets = only ? [only] : ids;
for (const id of targets) {
  const pack = BUNDLED_PACKS[id];
  const text = JSON.stringify(pack, null, 2) + "\n";
  const file = path.join(packDir, `${id}.json`);
  fs.writeFileSync(file, text, "utf8");
  const entry = {
    id,
    version: pack.version,
    minAppVersion: BUNDLED_MODULE_META[id].minAppVersion,
    title: BUNDLED_MODULE_META[id].title,
    entry: BUNDLED_MODULE_META[id].entry,
    pack: `module-packs/${id}.json`,
    checksum: checksumText(text),
    size: text.length,
    changelog: [...BUNDLED_MODULE_META[id].changelog],
  };
  const at = registry.modules.findIndex((m) => m.id === id);
  if (at >= 0) registry.modules[at] = entry;
  else registry.modules.push(entry);
  console.log(`${id.padEnd(7)} ${entry.version}  ${String(entry.size).padStart(6)} chars  checksum=${entry.checksum}`);
}
registry.modules.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2) + "\n", "utf8");
console.log(`\nmodule-registry.json updated (${registry.modules.length} modules)${only ? ` [only=${only}]` : ""}`);
