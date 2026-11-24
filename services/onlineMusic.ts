/**
 * 在线音乐 / 在线电台服务。
 *
 * - 音乐：iTunes Search API（免费、无需密钥），用于「搜索最新音乐」。
 *   previewUrl 是 30~90 秒可直连试听音频，可直接交给 expo-av 播放。
 * - 电台：radio-browser.info（免费、无需密钥），用于按国家 / 分类加载在线广播。
 *
 * 设计原则：
 * - 所有请求带超时（AbortController），失败时抛错由页面降级到内置曲库。
 * - 纯数据转换层，不依赖任何 store；结果映射为项目内的 MusicTrack / RadioStation。
 * - Web / 桌面（react-native-web）与原生 React Native 均使用全局 fetch。
 */

import { MusicTrack, RadioStation } from "@/constants/AudioLibrary";

/** iTunes 国家码映射（用于「分国」浏览与搜索） */
export const ITUNES_COUNTRY_CODES: Record<string, string> = {
  中国: "cn",
  欧美: "us",
  日本: "jp",
  韩国: "kr",
};

/** 风格 → iTunes 搜索关键词（用于「分类」浏览） */
export const GENRE_SEARCH_TERMS: Record<string, string> = {
  流行: "pop",
  摇滚: "rock",
  电子: "electronic",
  古典: "classical",
  爵士: "jazz",
  轻音乐: "instrumental",
  民谣: "folk",
  说唱: "hip hop",
};

/** radio-browser 国家码映射 */
export const RADIO_COUNTRY_CODES: Record<string, string> = {
  中国: "CN",
  欧美: "US",
  日本: "JP",
  韩国: "KR",
};

/** radio-browser 分类标签映射 */
export const RADIO_GENRE_TAGS: Record<string, string> = {
  流行: "pop",
  古典: "classical",
  怀旧: "oldies",
  节奏: "dance",
  新闻: "news",
};

const DEFAULT_TIMEOUT = 12000;

/** 带超时的 fetch，返回已解析 JSON */
const fetchJson = async <T,>(url: string, timeoutMs = DEFAULT_TIMEOUT): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal as any,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
};

/** 把十六进制颜色补全为 #RRGGBB */
const normalizeColor = (raw?: string): string => {
  if (!raw) return "#00E6A8";
  let hex = raw.replace(/^#/, "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex}` : "#00E6A8";
};

interface ITunesResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  releaseDate?: string;
  trackTimeMillis?: number;
}

interface ITunesResponse {
  resultCount?: number;
  results?: ITunesResult[];
}

const ACCENT_PALETTE = ["#00E6A8", "#7C8CFF", "#FFB86B", "#4FC3F7", "#C792EA", "#F48FB1", "#66BB6A"];

/** 把 iTunes 条目映射为 MusicTrack（仅保留有可播放试听地址的条目） */
const mapITunesTrack = (r: ITunesResult, index: number, countryLabel: string): MusicTrack | null => {
  if (!r.previewUrl || !r.trackName) return null;
  const year = r.releaseDate ? r.releaseDate.slice(0, 4) : undefined;
  return {
    id: `itunes-${r.trackId ?? `${Date.now()}-${index}`}`,
    title: r.trackName,
    artist: r.artistName || "未知艺术家",
    album: r.collectionName,
    url: r.previewUrl,
    cover: r.artworkUrl100?.replace("100x100bb", "300x300bb"),
    accent: ACCENT_PALETTE[index % ACCENT_PALETTE.length],
    genre: r.primaryGenreName || undefined,
    country: countryLabel === "全部" ? "欧美" : countryLabel,
    year,
    durationLabel: r.trackTimeMillis
      ? `${String(Math.floor(r.trackTimeMillis / 60000)).padStart(2, "0")}:${String(
          Math.floor((r.trackTimeMillis % 60000) / 1000)
        ).padStart(2, "0")}`
      : undefined,
    lyrics: ["—— 在线试听（iTunes Preview）", `${r.trackName} · ${r.artistName}`],
  };
};

/**
 * 搜索最新音乐（iTunes）。
 * @param keyword 搜索关键词（歌名 / 歌手，中英文均可）
 * @param countryLabel 国家/地区中文名（全部/中国/欧美/日本/韩国）
 * @param limit 返回数量
 */
export const searchLatestMusic = async (
  keyword: string,
  countryLabel = "全部",
  limit = 30
): Promise<MusicTrack[]> => {
  const term = keyword.trim();
  if (!term) return [];
  const countryCode = ITUNES_COUNTRY_CODES[countryLabel];
  const params = new URLSearchParams({
    term,
    entity: "song",
    limit: String(Math.min(Math.max(limit, 1), 100)),
    country: countryCode || "us",
  });
  const data = await fetchJson<ITunesResponse>(`https://itunes.apple.com/search?${params.toString()}`);
  return (data.results || [])
    .map((r, i) => mapITunesTrack(r, i, countryLabel))
    .filter((t): t is MusicTrack => !!t);
};

/**
 * 按音乐风格 + 国家浏览最新音乐。
 * @param genre 风格（全部时不加风格关键词）
 * @param countryLabel 国家/地区
 */
export const browseMusicByGenre = async (
  genre: string,
  countryLabel = "全部",
  limit = 30
): Promise<MusicTrack[]> => {
  const keyword = GENRE_SEARCH_TERMS[genre] || "music";
  return searchLatestMusic(keyword, countryLabel, limit);
};

interface RadioBrowserStation {
  stationuuid?: string;
  name?: string;
  url_resolved?: string;
  url?: string;
  country?: string;
  tags?: string;
  codec?: string;
  favicon?: string;
}

/** 把 radio-browser 条目映射为 RadioStation（仅保留可直连 http(s) 流） */
const mapRadioStation = (s: RadioBrowserStation, index: number, countryLabel: string): RadioStation | null => {
  const url = (s.url_resolved || s.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const name = (s.name || "").trim();
  if (!name) return null;
  const firstTag = (s.tags || "").split(",")[0]?.trim();
  return {
    id: `online-${s.stationuuid || `${Date.now()}-${index}`}`,
    name,
    category: firstTag || "在线",
    country: countryLabel === "全部" ? s.country || "未知" : countryLabel,
    description: `${s.codec || "在线"} · ${s.tags ? s.tags.split(",").slice(0, 2).join(" / ") : "网络电台"}`,
    url,
    accent: ACCENT_PALETTE[index % ACCENT_PALETTE.length],
  };
};

/**
 * 按国家 / 分类加载在线电台（radio-browser.info）。
 * 优先选 codec=MP3 且可直连的流，避免 AAC/HLS 在部分端不支持。
 */
export const loadOnlineStations = async (
  countryLabel = "全部",
  category = "全部",
  limit = 40
): Promise<RadioStation[]> => {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 100)),
    order: "clickcount",
    reverse: "true",
    hidebroken: "true",
  });
  const code = RADIO_COUNTRY_CODES[countryLabel];
  if (code) params.set("countrycode", code);
  const tag = RADIO_GENRE_TAGS[category];
  if (tag) params.set("tag", tag);

  // 轮转多个镜像，避免单节点不可用
  const hosts = ["de1.api.radio-browser.info", "fi1.api.radio-browser.info", "at1.api.radio-browser.info"];
  let lastError: any = null;
  for (const host of hosts) {
    try {
      const data = await fetchJson<RadioBrowserStation[]>(
        `https://${host}/json/stations/search?${params.toString()}`,
        12000
      );
      if (!Array.isArray(data)) continue;
      const stations = data
        .map((s, i) => mapRadioStation(s, i, countryLabel))
        .filter((s): s is RadioStation => !!s);
      // 优先 MP3 编码
      stations.sort((a, b) => {
        const aMp3 = a.description.startsWith("MP3") ? 0 : 1;
        const bMp3 = b.description.startsWith("MP3") ? 0 : 1;
        return aMp3 - bMp3;
      });
      return stations.slice(0, limit);
    } catch (e) {
      lastError = e;
      // 尝试下一个镜像
    }
  }
  throw lastError || new Error("在线电台加载失败");
};
