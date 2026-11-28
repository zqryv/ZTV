/**
 * 模块注册表：把「模块 id → 元数据 / 入口」集中管理。
 *
 * app/<id>.tsx 只是 Expo Router 的薄壳，真正的屏幕组件由这里登记的 entry
 * 指向 modules/<id>/XxxScreen。新增或替换模块时只改本表与对应模块目录，
 * 不需要动其它模块、路由与共享层。
 */
import { BUNDLED_MODULE_META, APP_VERSION } from "./defaultPacks";
import {
  MODULE_IDS,
  ModuleId,
  ModuleManifest,
} from "./contracts";

export const CURRENT_APP_VERSION = APP_VERSION;

export const MODULE_TITLES: Record<ModuleId, string> = {
  search: "搜索",
  music: "音乐在线",
  radio: "收音机",
};

export const isModuleId = (value: string): value is ModuleId =>
  MODULE_IDS.includes(value as ModuleId);

export const getModuleEntry = (id: ModuleId): string => BUNDLED_MODULE_META[id].entry;

export const getBundledVersion = (id: ModuleId): string => BUNDLED_MODULE_META[id].version;

export const getBundledManifest = (id: ModuleId): ModuleManifest => ({
  id,
  version: BUNDLED_MODULE_META[id].version,
  minAppVersion: BUNDLED_MODULE_META[id].minAppVersion,
  title: BUNDLED_MODULE_META[id].title,
  entry: BUNDLED_MODULE_META[id].entry,
  pack: `module-packs/${id}.json`,
  checksum: "",
  size: 0,
  changelog: [...BUNDLED_MODULE_META[id].changelog],
});

/** 供设置页 / 校验脚本使用的静态清单 */
export const listModules = () => MODULE_IDS.map((id) => getBundledManifest(id));
