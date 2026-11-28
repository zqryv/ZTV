/**
 * 离线广播缓存（v2.5.0，原生实现）。
 *
 * 参考 RadioResurrector 的「直播流滚动缓冲 + 断网自动切换本地缓冲」思路，
 * 以及 Radiola / hiqradio 的「录制保存供离线收听」做法。expo-av 不暴露直播流的
 * 原始字节，无法在 RN 内对实时流做无损滚动录制，因此这里落地为更可靠的形式：
 *   - 内置「离线节目单」：可下载的完整公版音频文件（非直播流）；
 *   - 联网时预缓存到应用私有目录，之后断网从 file:// 播放；
 *   - 直播台加载失败时自动切换到任意已缓存节目，等效于断网缓冲兜底；
 *   - LRU + 容量配额，避免占满设备存储。
 * Web 端由 offlineCache.web.ts 用 Cache API 实现同一套接口。
 */
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";

const INDEX_KEY = "ztv_offline_audio_index_v1";
const DIR = `${FileSystem.documentDirectory}ztv-offline/`;

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

const ensureDir = async (): Promise<void> => {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
};

const safeFileName = (id: string): string => `${id.replace(/[^A-Za-z0-9_-]/g, "_")}.mp3`;

export const listCachedPrograms = async (): Promise<CacheIndex> => readIndex();

export const getCachedProgram = async (id: string): Promise<CachedProgram | null> => {
  const index = await readIndex();
  const entry = index[id];
  if (!entry) return null;
  const info = await FileSystem.getInfoAsync(entry.uri);
  return info.exists ? entry : null;
};

/** 播放入口：返回可直接交给 expo-av 的本地 file:// 地址 */
export const getPlayableUri = async (id: string): Promise<string | null> => {
  const entry = await getCachedProgram(id);
  return entry ? entry.uri : null;
};

export const cacheProgram = async (
  id: string,
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<CachedProgram> => {
  await ensureDir();
  const uri = `${DIR}${safeFileName(id)}`;
  const resumable = FileSystem.createDownloadResumable(
    url,
    uri,
    {},
    (progress) => {
      const expected = progress.totalBytesExpectedToWrite || 1;
      onProgress?.(Math.min(1, progress.totalBytesWritten / expected));
    },
  );
  const result = await resumable.downloadAsync();
  if (!result?.uri) throw new Error("下载未完成");
  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || (info.size ?? 0) < 16 * 1024) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error("缓存文件不完整");
  }
  const entry: CachedProgram = {
    id,
    uri: result.uri,
    sourceUrl: url,
    size: info.size ?? 0,
    cachedAt: Date.now(),
  };
  const index = await readIndex();
  index[id] = entry;
  await writeIndex(index);
  return entry;
};

export const removeCachedProgram = async (id: string): Promise<void> => {
  const index = await readIndex();
  const entry = index[id];
  if (entry) {
    await FileSystem.deleteAsync(entry.uri, { idempotent: true });
    delete index[id];
    await writeIndex(index);
  }
};

/** 超出配额时按最近使用时间从旧到新删除 */
export const pruneCache = async (quotaMB: number): Promise<number> => {
  const index = await readIndex();
  let total = Object.values(index).reduce((sum, item) => sum + item.size, 0);
  const quota = quotaMB * 1024 * 1024;
  let removed = 0;
  if (total > quota) {
    const ordered = Object.values(index).sort((a, b) => a.cachedAt - b.cachedAt);
    for (const item of ordered) {
      if (total <= quota) break;
      await FileSystem.deleteAsync(item.uri, { idempotent: true });
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
