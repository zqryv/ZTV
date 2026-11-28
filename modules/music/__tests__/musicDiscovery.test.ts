import {
  CircuitBreaker,
  DEFAULT_RADAR,
  buildRadar,
  dedupeTracks,
} from "@/modules/music/musicDiscovery";

const track = (id: string) => ({ id, title: id });

describe("音乐榜单雷达（Solara 思路）", () => {
  it("按 id 去重且保留首次出现顺序", () => {
    expect(dedupeTracks([track("a"), track("a"), track("b")]).map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("排除正在播放的曲目并限制注入数量", () => {
    const radar = buildRadar(
      [["a", "b", "c"].map(track), ["b", "d", "e"].map(track)],
      ["a"],
      { ...DEFAULT_RADAR, injectCount: 3 },
      () => 0,
    );
    expect(radar.length).toBeLessThanOrEqual(3);
    expect(radar.some((t) => t.id === "a")).toBe(false);
    expect(new Set(radar.map((t) => t.id)).size).toBe(radar.length);
  });
});

describe("请求熔断器", () => {
  it("连续失败达到阈值后熔断，冷却结束半开，成功即复位", () => {
    const breaker = new CircuitBreaker();
    breaker.recordFailure(1000);
    breaker.recordFailure(1000);
    breaker.recordFailure(1000);
    expect(breaker.isOpen(3, 60_000, 2_000)).toBe(true);
    expect(breaker.isOpen(3, 60_000, 62_000)).toBe(false);
    breaker.recordSuccess();
    expect(breaker.failureCount).toBe(0);
    expect(breaker.isOpen(3, 60_000, 62_001)).toBe(false);
  });
});
