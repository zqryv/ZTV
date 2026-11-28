/**
 * 音乐检索结果缓存（借鉴 Solara 2.0「智能边缘缓存」思路，自行实现）。
 *
 * Solara 的关键经验：只缓存有效搜索结果，自动拦截「API 繁忙」造成的空结果
 * 或错误响应入库，否则用户会反复命中一份坏缓存。本实现把这条规则做成
 * isValidResult() 硬约束，并加上 TTL、条目上限与持久化关键词记忆。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "ztv_music_result_cache_v2";
const QUERY_KEY = "ztv_music_last_query_v2";

export interface CachedTrack {
  id: string;
  url: string;
}

interface CacheEntry<T> {
  tracks: T[];
  cachedAt: number;
  source: string;
}

/** 有效结果：非空、有 id、有可播放地址。空结果 / 错误页一律不缓存 */
export const isValidResult = <T extends CachedTrack>(tracks: T[] | null | undefined, minCount = 1): boolean =>
  Array.isArray(tracks) &&
  tracks.length >= minCount &&
  tracks.every((track) => !!track && typeof track.id === "string" && typeof track.url === "string" && track.url.length > 0);

class MusicResultCache {
  private memory = new Map<string, CacheEntry<CachedTrack>>();

  async get<T extends CachedTrack>(key: string, ttlMs: number): Promise<T[] | null> {
    const entry = await this.readEntry(key);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ttlMs) return null;
    return entry.tracks as T[];
  }

  async set<T extends CachedTrack>(key: string, tracks: T[], source: string, maxEntries: number): Promise<boolean> {
    if (!isValidResult(tracks)) return false; // 坏结果不入库
    const entry: CacheEntry<CachedTrack> = { tracks, cachedAt: Date.now(), source };
    this.memory.set(key, entry);
    await this.flush(maxEntries);
    return true;
  }

  async clear(): Promise<void> {
    this.memory.clear();
    try {
      await AsyncStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Solara「无感记忆」：记住检索词与最近结果上下文，重焦即刻恢复 */
  async rememberQuery(query: string): Promise<void> {
    try {
      await AsyncStorage.setItem(QUERY_KEY, query.trim());
    } catch {
      /* ignore */
    }
  }

  async restoreQuery(): Promise<string> {
    try {
      return (await AsyncStorage.getItem(QUERY_KEY)) || "";
    } catch {
      return "";
    }
  }

  async stats(): Promise<{ entries: number; oldestMs: number }> {
    const entries = await this.readAll();
    const times = Object.values(entries).map((e) => e.cachedAt);
    return {
      entries: times.length,
      oldestMs: times.length ? Date.now() - Math.min(...times) : 0,
    };
  }

  private async readEntry(key: string): Promise<CacheEntry<CachedTrack> | null> {
    if (this.memory.has(key)) return this.memory.get(key)!;
    const all = await this.readAll();
    return all[key] || null;
  }

  private async readAll(): Promise<Record<string, CacheEntry<CachedTrack>>> {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private async flush(maxEntries: number): Promise<void> {
    try {
      const all = await this.readAll();
      for (const [key, entry] of this.memory) all[key] = entry;
      const keys = Object.keys(all).sort((a, b) => all[b].cachedAt - all[a].cachedAt).slice(0, maxEntries);
      const pruned: Record<string, CacheEntry<CachedTrack>> = {};
      keys.forEach((key) => { pruned[key] = all[key]; });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(pruned));
      // 内存也同步裁剪
      this.memory = new Map(keys.filter((k) => this.memory.has(k)).map((k) => [k, this.memory.get(k)!]));
    } catch {
      /* 存储不可用时仅保留内存缓存 */
    }
  }
}

export const musicResultCache = new MusicResultCache();
