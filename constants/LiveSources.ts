/**
 * 直播源（TV / MTV）相关的类型与常量定义。
 *
 * 设计目标：
 * - 支持保存多个 M3U 源，每个源有独立的 id / 名称 / 地址。
 * - TV、MTV 两个首页入口各自绑定一个源（sourceId），互不影响。
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

export const LIVE_SLOT_LABELS: Record<LiveSourceSlot, string> = {
  tv: "TV",
  mtv: "MTV",
};

export const LIVE_SLOT_DESCRIPTIONS: Record<LiveSourceSlot, string> = {
  tv: "首页 TV 入口使用的直播源",
  mtv: "首页 MTV 入口使用的直播源",
};

export const DEFAULT_LIVE_SOURCES: LiveSourcesConfig = {
  version: 1,
  sources: [],
  bindings: { tv: null, mtv: null },
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
