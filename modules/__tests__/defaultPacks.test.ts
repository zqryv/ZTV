import { APP_VERSION, BUNDLED_MODULE_META, BUNDLED_PACKS } from "@/modules/defaultPacks";

describe("模块内置资源包", () => {
  it("三模块版本与应用版本一致", () => {
    expect(APP_VERSION).toBe("2.5.0");
    for (const id of ["search", "music", "radio"] as const) {
      expect(BUNDLED_PACKS[id].id).toBe(id);
      expect(BUNDLED_PACKS[id].version).toBe(APP_VERSION);
      expect(BUNDLED_MODULE_META[id].version).toBe(APP_VERSION);
    }
  });

  it("搜索模块声明中文键盘配置", () => {
    const config = BUNDLED_PACKS.search.config as any;
    expect(config.imeEnabledByDefault).toBe(true);
    expect(config.letterRows.join("")).toContain("QWERTY");
    expect(config.quickTerms.length).toBeGreaterThan(0);
  });

  it("音乐模块声明缓存 / 雷达 / 熔断与不误触发配置", () => {
    const config = BUNDLED_PACKS.music.config as any;
    expect(config.cacheTtlMs).toBeGreaterThan(0);
    expect(config.radar.injectCount).toBeGreaterThan(0);
    expect(config.circuitThreshold).toBeGreaterThan(0);
    expect(config.sourceSwitchAutoSearch).toBe(false);
  });

  it("收音机离线节目单合法且唯一", () => {
    const config = BUNDLED_PACKS.radio.config as any;
    const programs = config.offlinePrograms;
    expect(programs.length).toBeGreaterThanOrEqual(8);
    expect(new Set(programs.map((p: any) => p.id)).size).toBe(programs.length);
    programs.forEach((p: any) => {
      expect(p.id.startsWith("offline-")).toBe(true);
      expect(p.url.startsWith("https://")).toBe(true);
      expect(p.license).toBeTruthy();
      expect(p.source).toBeTruthy();
    });
    expect(config.cacheQuotaMB).toBeGreaterThan(0);
  });
});
