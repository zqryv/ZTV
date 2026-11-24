/**
 * 直播源（TV / MUSIC）相关的类型与常量定义。
 *
 * 设计目标：
 * - 支持保存多个 M3U 源，每个源有独立的 id / 名称 / 地址。
 * - TV、MUSIC 两个首页入口各自绑定一个源（sourceId），互不影响。
 * - 兼容旧版本：旧版只有一个 m3uUrl，迁移逻辑见 services/storage.ts。
 */

/** 首页直播入口槽位 */
export type LiveSourceSlot = "tv" | "mtv";

/** 单个 M3U 直播源 */
export interface M3uSource {
  id: string;
  name: string;
  url: string;
  createdAt: number;
}

/** 持久化到 AsyncStorage 的完整配置 */
export interface LiveSourcesConfig {
  version: 1;
  sources: M3uSource[];
  /** key 为槽位，value 为源的 id；null 表示该槽位尚未绑定 */
  bindings: Record<LiveSourceSlot, string | null>;
}

/** 测试连接的返回结果 */
export interface M3uTestResult {
  ok: boolean;
  channelCount: number;
  error?: string;
  durationMs: number;
}

export const LIVE_SOURCE_SLOTS: LiveSourceSlot[] = ["tv", "mtv"];

/**
 * 槽位显示名。内部标识仍为 "tv" / "mtv"（保持与用户已保存绑定的兼容），
 * 展示层统一为「电视」/「音乐台」。
 */
export const LIVE_SLOT_LABELS: Record<LiveSourceSlot, string> = {
  tv: "电视",
  mtv: "音乐台",
};

export const LIVE_SLOT_DESCRIPTIONS: Record<LiveSourceSlot, string> = {
  tv: "首页「电视」入口使用的直播源",
  mtv: "首页「音乐台」入口使用的直播源",
};

/**
 * 内置默认直播源（开箱即用）。
 * - TV：best-fan/iptv-sources 每日更新的中国大陆频道（CCTV / 卫视，236 个频道）。
 * - MUSIC：Free-TV/IPTV 国际频道合集（2203 个频道）。
 * 使用 GitHub raw 直链；用户可在「TV 源设置」中随时增改或改绑。
 */
export const BUILTIN_TV_SOURCE_ID = "builtin-tv-cn";
export const BUILTIN_MTV_SOURCE_ID = "builtin-mtv-intl";

export const DEFAULT_LIVE_SOURCES: LiveSourcesConfig = {
  version: 1,
  sources: [
    {
      id: BUILTIN_TV_SOURCE_ID,
      name: "内置·央视卫视",
      url: "https://raw.githubusercontent.com/best-fan/iptv-sources/main/cn_all.m3u8",
      createdAt: 0,
    },
    {
      id: BUILTIN_MTV_SOURCE_ID,
      name: "内置·音乐台频道",
      url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
      createdAt: 0,
    },
  ],
  bindings: { tv: BUILTIN_TV_SOURCE_ID, mtv: BUILTIN_MTV_SOURCE_ID },
};

/** 生成源 id（不依赖 crypto，兼容旧版 Android TV 的 Hermes 运行时） */
export const createSourceId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 判断字符串是否为合法的直播槽位 */
export const isLiveSourceSlot = (value: unknown): value is LiveSourceSlot =>
  value === "tv" || value === "mtv";

/** 从配置中取出某个槽位绑定的源 */
export const getBoundSource = (
  config: LiveSourcesConfig,
  slot: LiveSourceSlot
): M3uSource | null => {
  const id = config.bindings[slot];
  if (!id) return null;
  return config.sources.find((source) => source.id === id) ?? null;
};

/** 清洗 / 容错解析，避免损坏的本地数据导致崩溃 */
export const normalizeLiveSourcesConfig = (raw: unknown): LiveSourcesConfig => {
  if (!raw || typeof raw !== "object") return DEFAULT_LIVE_SOURCES;
  const input = raw as Partial<LiveSourcesConfig>;

  const sources: M3uSource[] = Array.isArray(input.sources)
    ? input.sources
        .filter(
          (item): item is M3uSource =>
            !!item &&
            typeof item === "object" &&
            typeof (item as M3uSource).id === "string" &&
            typeof (item as M3uSource).url === "string"
        )
        .map((item) => ({
          id: item.id,
          name: typeof item.name === "string" && item.name ? item.name : "未命名直播源",
          url: item.url,
          createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
        }))
    : [];

  const validIds = new Set(sources.map((s) => s.id));
  const bindings: Record<LiveSourceSlot, string | null> = { tv: null, mtv: null };
  const rawBindings = (input.bindings ?? {}) as Record<string, unknown>;
  LIVE_SOURCE_SLOTS.forEach((slot) => {
    const id = rawBindings[slot];
    bindings[slot] = typeof id === "string" && validIds.has(id) ? id : null;
  });

  return { version: 1, sources, bindings };
};
