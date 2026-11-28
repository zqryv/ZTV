/**
 * 离线广播缓存（Web / PWA 实现）。
 *
 * 浏览器没有 expo-file-system 的 documentDirectory，改用 Cache API 保存音频响应，
 * 播放时把缓存的 Blob 转成 object URL 交给 <audio>；索引写 localStorage，
 * 与原生版完全相同的导出接口，页面代码无需分平台判断。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_NAME = "ztv-offline-audio-v1";
const INDEX_KEY = "ztv_offline_audio_index_v1";

export interface CachedProgram {
  id: string;
  uri: string;
  sourceUrl: string;
  size: number;
  cachedAt: number;
}

export type CacheIndex = Record<string, CachedProgram>;

const readIndex = async (): Promise<CacheIndex> => {
  try {
    return JSON.parse((await AsyncStorage.getItem(INDEX_KEY)) || "{}");
  } catch {
    return {};
  }
};

const writeIndex = async (index: CacheIndex): Promise<void> => {
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* ignore */
  }
};

const cacheAvailable = (): boolean => typeof caches !== "undefined";

export const listCachedPrograms = async (): Promise<CacheIndex> => readIndex();

export const getCachedProgram = async (id: string): Promise<CachedProgram | null> => {
  const index = await readIndex();
  const entry = index[id];
  if (!entry || !cacheAvailable()) return null;
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(entry.sourceUrl);
  return response ? entry : null;
};

export const getPlayableUri = async (id: string): Promise<string | null> => {
  const entry = await getCachedProgram(id);
  if (!entry) return null;
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(entry.sourceUrl);
  if (!response) return null;
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const cacheProgram = async (
  id: string,
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<CachedProgram> => {
  if (!cacheAvailable()) throw new Error("当前浏览器不支持离线缓存");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`下载失败 HTTP ${response.status}`);
  const blob = await response.blob();
  onProgress?.(0.5);
  if (blob.size < 16 * 1024) throw new Error("缓存文件不完整");
  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg" } }));
  const entry: CachedProgram = {
    id,
    uri: url,
    sourceUrl: url,
    size: blob.size,
    cachedAt: Date.now(),
  };
  const index = await readIndex();
  index[id] = entry;
  await writeIndex(index);
  onProgress?.(1);
  return entry;
};

export const removeCachedProgram = async (id: string): Promise<void> => {
  const index = await readIndex();
  const entry = index[id];
  if (entry && cacheAvailable()) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(entry.sourceUrl);
  }
  delete index[id];
  await writeIndex(index);
};

export const pruneCache = async (quotaMB: number): Promise<number> => {
  const index = await readIndex();
  let total = Object.values(index).reduce((sum, item) => sum + item.size, 0);
  const quota = quotaMB * 1024 * 1024;
  let removed = 0;
  if (total > quota) {
    const cache = cacheAvailable() ? await caches.open(CACHE_NAME) : null;
    const ordered = Object.values(index).sort((a, b) => a.cachedAt - b.cachedAt);
    for (const item of ordered) {
      if (total <= quota) break;
      if (cache) await cache.delete(item.sourceUrl);
      delete index[item.id];
      total -= item.size;
      removed += 1;
    }
    await writeIndex(index);
  }
  return removed;
};

export const getCacheUsageMB = async (): Promise<number> => {
  const index = await readIndex();
  return Object.values(index).reduce((sum, item) => sum + item.size, 0) / (1024 * 1024);
};
