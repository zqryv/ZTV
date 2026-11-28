/**
 * 音乐在线核心逻辑（v2.5.0，融合 Solara 2.0 的可取设计，未复制其代码）。
 *
 * 参考点（Solara 采用 CC BY-NC-SA，本项目仅借鉴思路，实现独立）：
 *  - 智能缓存：只缓存有效搜索结果，空结果 / 错误响应不入库 → musicCache.isValidResult；
 *  - 榜单雷达：多来源 Top N 去重 + 随机注入 → musicDiscovery.buildRadar；
 *  - 无感记忆：记住检索词，重焦恢复 → musicCache.rememberQuery / restoreQuery；
 *  - 请求熔断：免费 API 波动时不再每次白等超时 → musicDiscovery.CircuitBreaker；
 *  - 切换曲库不误触发自动请求 → 由页面控制，配置 sourceSwitchAutoSearch=false。
 *
 * 三级降级（在线检索 → 音乐电台 → 内置曲库）仍由页面负责，保证旧行为不回退。
 */
import {
  searchLatestMusic,
  browseMusicByGenre,
  fetchMusicChannels,
} from "@/services/onlineMusic";
import { MusicTrack } from "@/constants/AudioLibrary";
import { moduleManager } from "@/modules/ModuleManager";
import { musicResultCache, isValidResult } from "./musicCache";
import { CircuitBreaker, buildRadar, DEFAULT_RADAR, RadarOptions } from "./musicDiscovery";

interface MusicModuleConfig {
  cacheTtlMs: number;
  cacheMaxEntries: number;
  circuitThreshold: number;
  circuitCooldownMs: number;
  rememberQuery: boolean;
  radar: RadarOptions;
  qualityPreference: string;
  sourceSwitchAutoSearch: boolean;
  quickTerms: string[];
}

export interface MusicCoreResult {
  tracks: MusicTrack[];
  fromCache: boolean;
  note?: string;
}

const breaker = new CircuitBreaker();

/** 统一检索入口：缓存 → 多源 → 雷达注入 → 有效结果校验 → 写缓存 */
export const loadMusicCore = async (
  mode: "latest" | "channels" | "builtin",
  keyword: string,
  genre: string,
  country: string,
  force = false,
): Promise<MusicCoreResult> => {
  const config = await moduleManager.getConfig<MusicModuleConfig>("music");

  if (breaker.isOpen(config.circuitThreshold ?? 3, config.circuitCooldownMs ?? 60_000)) {
    throw new Error("音乐服务熔断中，直接使用内置曲库");
  }

  const key = `${mode}|${keyword.trim()}|${genre}|${country}`;
  if (!force) {
    const cached = await musicResultCache.get<MusicTrack>(key, config.cacheTtlMs ?? 30 * 60 * 1000);
    if (cached && cached.length) return { tracks: cached, fromCache: true, note: "命中有效结果缓存" };
  }

  let results: MusicTrack[] = [];
  if (mode === "channels") {
    results = await fetchMusicChannels(country, genre, 40, keyword);
  } else if (keyword.trim()) {
    results = await searchLatestMusic(keyword, country, 40);
  } else {
    const primary = await browseMusicByGenre(genre, country, 40);
    // 榜单雷达：把第二来源里未出现过的曲目随机注入推荐，兼顾热门与新发现
    let secondary: MusicTrack[] = [];
    try {
      secondary = await fetchMusicChannels(country, genre, 20, "");
    } catch {
      /* 第二来源失败不影响主结果 */
    }
    const radar = buildRadar(
      [primary, secondary],
      primary.map((track) => track.id),
      config.radar ?? DEFAULT_RADAR,
    );
    results = [...primary, ...radar];
  }

  // Solara 式硬约束：空结果 / 坏数据绝不进缓存，也不当作成功返回
  if (!isValidResult(results)) throw new Error("empty or invalid result");

  const cached = await musicResultCache.set(key, results, mode, config.cacheMaxEntries ?? 60);
  breaker.recordSuccess();
  if (config.rememberQuery !== false) await musicResultCache.rememberQuery(keyword);
  return {
    tracks: results,
    fromCache: false,
    note: cached ? "已缓存有效结果" : undefined,
  };
};

/** 在线源失败时由页面调用，累计到阈值后进入熔断冷却 */
export const recordMusicFailure = (): void => breaker.recordFailure();

export const restoreMusicQuery = (): Promise<string> => musicResultCache.restoreQuery();
export const getMusicCacheStats = () => musicResultCache.stats();
export const clearMusicCache = () => musicResultCache.clear();
