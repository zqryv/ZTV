/**
 * 音乐发现：榜单雷达 / 去重 / 请求熔断（借鉴 Solara 2.0，自行实现，纯计算零依赖）。
 *
 * Solara 的「音乐雷达」从多份官方榜单各取 Top N，过滤掉当前队列已有曲目后
 * 随机注入，兼顾热门与新歌；同时用请求熔断避免免费 API 波动时反复超时。
 * 这里把两件事抽成可单测的纯函数 / 类，供 musicCore 与页面复用。
 */

export interface RadarOptions {
  chartSize: number;
  injectCount: number;
  excludeRecent: boolean;
}

export const DEFAULT_RADAR: RadarOptions = { chartSize: 20, injectCount: 6, excludeRecent: true };

export const dedupeTracks = <T extends { id: string }>(tracks: T[]): T[] => {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (!track?.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
};

/** 多榜单轮询 → 每榜取前 N → 去重 → 排除正在播放 → 随机乱序注入 */
export const buildRadar = <T extends { id: string }>(
  charts: T[][],
  excludeIds: string[],
  options: RadarOptions = DEFAULT_RADAR,
  random: () => number = Math.random,
): T[] => {
  const excluded = new Set(options.excludeRecent ? excludeIds : []);
  const pool: T[] = [];
  charts.forEach((chart) => pool.push(...chart.slice(0, options.chartSize)));
  const candidates = dedupeTracks(pool).filter((track) => !excluded.has(track.id));
  // Fisher-Yates，注入结果每次不同
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, options.injectCount);
};

/**
 * 请求熔断器：连续失败达到阈值后，在冷却窗口内直接走内置曲库，
 * 避免每次点搜索都白等一轮超时；冷却结束自动半开重试。
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  isOpen(threshold: number, cooldownMs: number, now = Date.now()): boolean {
    if (this.failures < threshold) return false;
    if (now - this.openedAt >= cooldownMs) {
      // 半开：清零让下一次请求尝试恢复
      this.failures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  recordFailure(now = Date.now()): void {
    if (this.failures === 0) this.openedAt = now;
    this.failures += 1;
  }

  get failureCount(): number {
    return this.failures;
  }
}
