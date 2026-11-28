/**
 * 模块级独立升级管理器（v2.5.0）。
 *
 * 每个模块各自：检查版本 → 下载几 KB 的 JSON 资源包 → 校验完整性 → 写入本地缓存
 * → 生效；失败保留旧版本，可随时回滚到内置包。整个过程不触碰其它模块，
 * 也不需要重新下载安装整个 App。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BUNDLED_PACKS, APP_VERSION } from "./defaultPacks";
import { checksumText, normalizePackText, compareModuleVersions, supportsAppVersion } from "./checksum";
import {
  getModulePackUrls,
  getModuleRegistryUrls,
  recordEndpointResult,
} from "@/services/updateChannels";
import {
  MODULE_IDS,
  ModuleApplyResult,
  ModuleId,
  ModulePack,
  ModuleRegistryFile,
  ModuleState,
  ModuleUpdateInfo,
} from "./contracts";

const PACK_KEY = (id: ModuleId) => `ztv_module_pack_${id}`;
const STATE_KEY = (id: ModuleId) => `ztv_module_state_${id}`;
const FETCH_TIMEOUT_MS = 6000;

const isPack = (value: unknown): value is ModulePack => {
  if (!value || typeof value !== "object") return false;
  const pack = value as Partial<ModulePack>;
  return MODULE_IDS.includes(pack.id as ModuleId) &&
    typeof pack.version === "string" &&
    !!pack.config && typeof pack.config === "object";
};

/** 多通道并发取第一份合法 JSON / 文本，其余请求中止 */
async function fetchFirst(
  urls: string[],
  parse: (text: string) => unknown,
): Promise<{ value: unknown; text: string; url: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const attempts = urls.map(async (url) => {
    const started = Date.now();
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const value = parse(text);
      if (value === null || value === undefined) throw new Error("empty payload");
      void recordEndpointResult(url, true, Date.now() - started);
      return { value, text, url };
    } catch (error) {
      void recordEndpointResult(url, false, Date.now() - started);
      throw error;
    }
  });
  try {
    // 任意一个成功即返回；全部失败才抛错
    return await firstFulfilled(attempts);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function firstFulfilled<T>(promises: Array<Promise<T>>): Promise<T> {
  return new Promise((resolve, reject) => {
    let remaining = promises.length;
    if (remaining === 0) {
      reject(new Error("no endpoints"));
      return;
    }
    promises.forEach((p) => {
      p.then(resolve).catch(() => {
        remaining -= 1;
        if (remaining === 0) reject(new Error("all module endpoints failed"));
      });
    });
  });
}

class ModuleManager {
  private memory = new Map<ModuleId, ModulePack>();

  /** 模块读取配置：内存 → 本地缓存 → 内置默认，三级降级且永不抛错 */
  async getConfig<T = Record<string, unknown>>(id: ModuleId): Promise<T> {
    const cached = this.memory.get(id);
    if (cached) return cached.config as T;
    try {
      const raw = await AsyncStorage.getItem(PACK_KEY(id));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isPack(parsed) && parsed.id === id) {
          this.memory.set(id, parsed);
          return parsed.config as T;
        }
      }
    } catch {
      /* 缓存损坏时静默回退内置包 */
    }
    const builtin = BUNDLED_PACKS[id] as ModulePack;
    this.memory.set(id, builtin);
    return builtin.config as T;
  }

  /** 只检查模块级更新，不依赖也不影响 App 整包更新 */
  async checkModuleUpdates(): Promise<ModuleUpdateInfo[]> {
    let registry: ModuleRegistryFile;
    try {
      const result = await fetchFirst(await getModuleRegistryUrls(), (text) => {
        const parsed = JSON.parse(text) as ModuleRegistryFile;
        return parsed && parsed.schema === 1 && Array.isArray(parsed.modules) ? parsed : null;
      });
      registry = result.value as ModuleRegistryFile;
    } catch {
      return [];
    }

    const updates: ModuleUpdateInfo[] = [];
    for (const manifest of registry.modules) {
      if (!MODULE_IDS.includes(manifest.id)) continue;
      if (!supportsAppVersion(APP_VERSION, manifest.minAppVersion)) continue;
      const state = await this.getState(manifest.id);
      if (compareModuleVersions(manifest.version, state.activeVersion) > 0) {
        updates.push({
          id: manifest.id,
          title: manifest.title,
          currentVersion: state.activeVersion,
          remoteVersion: manifest.version,
          size: manifest.size,
        });
      }
    }
    return updates;
  }

  /** 下载并应用单个模块包；失败不动旧缓存，天然回滚 */
  async updateModule(
    id: ModuleId,
    expected?: { version: string; checksum: string; size: number },
  ): Promise<ModuleApplyResult> {
    try {
      let meta = expected;
      if (!meta) {
        const registryResult = await fetchFirst(await getModuleRegistryUrls(), (text) => {
          const parsed = JSON.parse(text) as ModuleRegistryFile;
          return parsed?.schema === 1 ? parsed : null;
        });
        const registry = registryResult.value as ModuleRegistryFile;
        const manifest = registry.modules.find((m) => m.id === id);
        if (!manifest) throw new Error("模块清单中没有该模块");
        meta = {
          version: manifest.version,
          checksum: manifest.checksum,
          size: manifest.size,
        };
      }

      const result = await fetchFirst(await getModulePackUrls(id), (text) => {
        const parsed: unknown = JSON.parse(text);
        return isPack(parsed) ? parsed : null;
      });
      const pack = result.value as ModulePack;
      if (pack.id !== id) throw new Error("模块包 id 不匹配");
      if (pack.version !== meta.version) throw new Error("模块包版本不匹配");

      // 完整性校验：拦截代理错误页 / 传输截断；换行归一化兼容 CRLF 代理
      if (meta.checksum && checksumText(normalizePackText(result.text)) !== meta.checksum) {
        throw new Error("模块包校验和不匹配");
      }
      if (meta.size && result.text.length < Math.min(meta.size, 32)) {
        throw new Error("模块包体积异常");
      }

      await AsyncStorage.setItem(PACK_KEY(id), JSON.stringify(pack));
      this.memory.set(id, pack);
      await this.setState({
        id,
        bundledVersion: BUNDLED_PACKS[id].version,
        activeVersion: pack.version,
        source: "cached",
        lastCheckedAt: Date.now(),
      });
      return { ok: true, id, version: pack.version };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.patchState(id, { lastError: message });
      return { ok: false, id, version: "", error: message };
    }
  }

  /** 丢弃缓存包，回到随 App 发布的内置版本 */
  async rollback(id: ModuleId): Promise<void> {
    try {
      await AsyncStorage.removeItem(PACK_KEY(id));
    } catch {
      /* ignore */
    }
    this.memory.delete(id);
    await this.setState({
      id,
      bundledVersion: BUNDLED_PACKS[id].version,
      activeVersion: BUNDLED_PACKS[id].version,
      source: "bundled",
      lastCheckedAt: Date.now(),
    });
  }

  async getStates(): Promise<ModuleState[]> {
    return Promise.all(MODULE_IDS.map((id) => this.getState(id)));
  }

  private async getState(id: ModuleId): Promise<ModuleState> {
    try {
      const raw = await AsyncStorage.getItem(STATE_KEY(id));
      if (raw) {
        const state = JSON.parse(raw) as ModuleState;
        if (state && state.id === id) return state;
      }
    } catch {
      /* ignore */
    }
    return {
      id,
      bundledVersion: BUNDLED_PACKS[id].version,
      activeVersion: BUNDLED_PACKS[id].version,
      source: "bundled",
      lastCheckedAt: 0,
    };
  }

  private async setState(state: ModuleState): Promise<void> {
    try {
      await AsyncStorage.setItem(STATE_KEY(state.id), JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  private async patchState(id: ModuleId, patch: Partial<ModuleState>): Promise<void> {
    await this.setState({ ...(await this.getState(id)), ...patch });
  }
}

export const moduleManager = new ModuleManager();
