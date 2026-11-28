/**
 * 模块化架构契约（v2.5.0）。
 *
 * 目标：搜索 / 音乐在线 / 收音机各自成为可独立升级的模块。
 * - 每个模块的 UI 与核心逻辑收在 modules/<id>/ 内，app/<id>.tsx 只是路由薄壳；
 * - 模块的全部「可热更配置」（键盘布局、词库、音源、离线节目单、缓存策略）
 *   集中在一份版本化 JSON 资源包 module-packs/<id>.json；
 * - 运行时按模块 id 独立检查版本、下载几 KB 的 JSON 包、校验并缓存，
 *   升级单个模块不需要重新下载安装整个 App，也不需要改动其他模块代码。
 *
 * 说明：原生 UI 代码仍随 App 发布（Expo/RN 不执行远程 JS）；本架构让绝大多数
 * 功能升级通过「配置包」完成，并让必须改代码的场景被限制在单个模块目录内。
 */
export type ModuleId = "search" | "music" | "radio";

export const MODULE_IDS: ModuleId[] = ["search", "music", "radio"];

export interface ModuleManifest {
  id: ModuleId;
  version: string;
  minAppVersion: string;
  title: string;
  entry: string;
  pack: string;
  checksum: string;
  size: number;
  changelog: string[];
}

export interface ModuleRegistryFile {
  schema: 1;
  appVersion: string;
  updatedAt: string;
  modules: ModuleManifest[];
}

/** 模块资源包：唯一需要跨网络分发的内容 */
export interface ModulePack {
  id: ModuleId;
  version: string;
  config: Record<string, unknown>;
}

export interface ModuleState {
  id: ModuleId;
  bundledVersion: string;
  activeVersion: string;
  source: "bundled" | "cached";
  lastCheckedAt: number;
  lastError?: string;
}

export interface ModuleUpdateInfo {
  id: ModuleId;
  title: string;
  currentVersion: string;
  remoteVersion: string;
  size: number;
}

/** 模块包下载/应用结果 */
export interface ModuleApplyResult {
  ok: boolean;
  id: ModuleId;
  version: string;
  error?: string;
}
