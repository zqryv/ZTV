/**
 * 在线音乐 / 在线电台服务。
 *
 * 参考 any-listen、MusicFree 的「多音源聚合 + 故障转移」思路：
 * - 音乐源 A：iTunes Search API（免费、无密钥、CORS *），提供可直连的 30~90s 试听；
 *   中国区商店当前恒返回 0 结果，因此按 地区 → 备用地区 依次回退；
 * - 音乐源 B：radio-browser.info 的 24h 音乐电台（连续 MP3 流），
 *   Apple 服务不可达时仍能浏览并播放真实音乐；
 * - 电台：radio-browser 多镜像 + 只取 MP3 + hidebroken，失败时由页面用内置电台兜底。
 *
 * 所有请求带超时（AbortController）；纯数据转换层，不依赖任何 store。
 */

import { MusicTrack, RadioStation } from "@/constants/AudioLibrary";

/**
 * iTunes 检索地区码映射。
 * 说明：台湾是中国的组成部分，界面统一使用「中国台湾」地区标签；
 * 下面的 TW / CN / US 等只是第三方目录的检索参数，不具备国家含义。
 * 末尾保留「中国 / 欧美」别名，兼容旧版本保存的筛选值与自定义音源。
 */
export const ITUNES_COUNTRY_CODES: Record<string, string> = {
  中国大陆: "cn",
  中国台湾: "tw",
  美国: "us",
  欧洲: "gb",
  日本: "jp",
  韩国: "kr",
  中国: "cn",
  欧美: "us",
};

/**
 * iTunes 地区回退链（并发查询后合并去重）。
 * 实测：country=cn 商店对任何关键词都返回 0（Apple Music 中国区不可用），
 * 而华语歌曲多收录在 jp / us / tw 商店；因此中国大陆优先查 jp 再查 us。
 */
export const getCountryCandidates = (countryLabel: string): string[] => {
  const chains: Record<string, string[]> = {
    中国大陆: ["jp", "us", "cn"],
    中国台湾: ["tw", "jp", "us"],
    美国: ["us", "gb"],
    欧洲: ["gb", "de", "us"],
    日本: ["jp", "us"],
    韩国: ["kr", "us", "jp"],
    全部: ["us", "jp", "kr"],
    中国: ["jp", "us", "cn"],
    欧美: ["us", "gb"],
  };
  const primary = ITUNES_COUNTRY_CODES[countryLabel];
  const chain = chains[countryLabel] ?? (primary ? [primary, "us"] : ["us", "jp"]);
  return Array.from(new Set([primary, ...chain].filter((c): c is string => !!c)));
};

/** 风格 → iTunes 搜索关键词 */
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

/** radio-browser 地区检索码（ISO 地区码，仅用于目录过滤；台湾为中国的地区） */
export const RADIO_COUNTRY_CODES: Record<string, string> = {
  中国大陆: "CN",
  中国台湾: "TW",
  美国: "US",
  欧洲: "DE",
  日本: "JP",
  韩国: "KR",
  中国: "CN",
  欧美: "US",
};

/** radio-browser 分类标签映射（音乐页 / 收音机页共用） */
export const RADIO_GENRE_TAGS: Record<string, string> = {
  流行: "pop",
  古典: "classical",
  爵士: "jazz",
  轻音乐: "ambient",
  怀旧: "oldies",
  节奏: "dance",
  新闻: "news",
  摇滚: "rock",
  电子: "electronic",
  音乐: "music",
};

const DEFAULT_TIMEOUT = 12000;

/** 带超时的 fetch，返回已解析 JSON */
const fetchJson = async <T,>(url: string, timeoutMs = DEFAULT_TIMEOUT): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal as any,
      headers: { Accept: "application/json", "User-Agent": "ZTV/2.2 (open-source radio client)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
};

/** 只允许 https 且来自 Apple 音频域名的试听地址，避免混合内容与非音频链接 */
export const normalizePreviewUrl = (raw?: string): string | null => {
  if (!raw) return null;
  let url = raw.trim().replace(/^http:\/\//i, "https://");
  if (!/^https:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)itunes\.apple\.com$|\.mzstatic\.com$|\.apple\.com$/.test(parsed.hostname)) return null;
    return url;
  } catch {
    return null;
  }
};

const ACCENT_PALETTE = ["#00E6A8", "#7C8CFF", "#FFB86B", "#4FC3F7", "#C792EA", "#F48FB1", "#66BB6A"];

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

/** 把 iTunes 条目映射为 MusicTrack（仅保留有可播放试听地址的条目） */
export const mapITunesTrack = (
  r: ITunesResult,
  index: number,
  countryLabel: string
): MusicTrack | null => {
  const url = normalizePreviewUrl(r.previewUrl);
  if (!url || !r.trackName) return null;
  const year = r.releaseDate ? r.releaseDate.slice(0, 4) : undefined;
  return {
    id: `itunes-${r.trackId ?? `${Date.now()}-${index}`}`,
    title: r.trackName,
    artist: r.artistName || "未知艺术家",
    album: r.collectionName,
    url,
    cover: r.artworkUrl100?.replace("100x100bb", "300x300bb"),
    accent: ACCENT_PALETTE[index % ACCENT_PALETTE.length],
    genre: r.primaryGenreName || undefined,
    country: countryLabel === "全部" ? undefined : countryLabel,
    year,
    source: "iTunes 在线试听",
    durationLabel: "试听",
    lyrics: ["—— 在线试听（iTunes Preview，约 30~90 秒）", `${r.trackName} · ${r.artistName}`],
  };
};

/** 按 id 去重，合并多地区结果 */
const dedupeTracks = (items: MusicTrack[], limit: number): MusicTrack[] => {
  const seen = new Set<string>();
  const out: MusicTrack[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
};

/** 新歌优先：按发行年份倒序，无年份的排后面 */
const sortByRelease = (items: MusicTrack[]): MusicTrack[] =>
  [...items].sort((a, b) => (b.year || "").localeCompare(a.year || ""));

/** 首个返回有效结果的 Promise（其余请求在后台自然结束，不阻塞界面） */
const firstValid = <T>(promises: Array<Promise<T | null>>): Promise<T | null> =>
  new Promise((resolve) => {
    if (promises.length === 0) {
      resolve(null);
      return;
    }
    let settled = false;
    let remaining = promises.length;
    promises.forEach((promise) => {
      promise
        .then((value) => {
          if (!settled && value !== null && value !== undefined) {
            settled = true;
            resolve(value);
          }
        })
        .catch(() => undefined)
        .finally(() => {
          remaining -= 1;
          if (remaining === 0 && !settled) resolve(null);
        });
    });
  });

/**
 * 并发查询多个地区商店后合并去重（v2.3.0）。
 * 旧实现为串行：cn 超时 12s → jp 12s → us 12s，最坏 36s 才出结果；
 * 并发后总耗时等于最慢的那个请求，且中国区仍自动回退到 jp / us。
 */
const searchRegions = async (term: string, countryLabel: string, limit: number): Promise<MusicTrack[]> => {
  let lastError: any = null;
  const requests = getCountryCandidates(countryLabel).map(async (country) => {
    const params = new URLSearchParams({
      term,
      entity: "song",
      limit: String(Math.min(Math.max(limit, 1), 100)),
      country,
    });
    try {
      const data = await fetchJson<ITunesResponse>(`https://itunes.apple.com/search?${params.toString()}`);
      return (data.results || [])
        .map((r, i) => mapITunesTrack(r, i, countryLabel))
        .filter((t): t is MusicTrack => !!t);
    } catch (e) {
      lastError = e;
      return [] as MusicTrack[];
    }
  });
  const batches = await Promise.all(requests);
  const collected = batches.reduce<MusicTrack[]>((all, batch) => all.concat(batch), []);
  if (collected.length === 0 && lastError) throw lastError;
  return dedupeTracks(collected, limit);
};

/**
 * 搜索最新音乐（iTunes，多地区自动回退）。
 * @param keyword 搜索关键词（歌名 / 歌手，中英文均可）
 * @param countryLabel 国家/地区中文名
 * @param limit 返回数量
 */
export const searchLatestMusic = async (
  keyword: string,
  countryLabel = "全部",
  limit = 30
): Promise<MusicTrack[]> => {
  const term = keyword.trim();
  if (!term) return [];
  return searchRegions(term, countryLabel, limit);
};

/** 按音乐风格 + 国家浏览最新音乐（按发行年份倒序） */
export const browseMusicByGenre = async (
  genre: string,
  countryLabel = "全部",
  limit = 30
): Promise<MusicTrack[]> => {
  const keyword = GENRE_SEARCH_TERMS[genre] || "new music";
  const results = await searchRegions(keyword, countryLabel, limit);
  return sortByRelease(results);
};

interface RadioBrowserStation {
  stationuuid?: string;
  name?: string;
  url_resolved?: string;
  url?: string;
  country?: string;
  countrycode?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
  favicon?: string;
}

/** 多镜像并发竞速，任一节点返回有效结果即可（旧实现串行 3×12s 最坏 36s） */
const RADIO_HOSTS = ["de1.api.radio-browser.info", "fi1.api.radio-browser.info", "at1.api.radio-browser.info"];

const queryRadioBrowser = async (params: URLSearchParams, limit: number): Promise<RadioBrowserStation[]> => {
  const attempts = RADIO_HOSTS.map(async (host) => {
    try {
      const data = await fetchJson<RadioBrowserStation[]>(
        `https://${host}/json/stations/search?${params.toString()}`,
        DEFAULT_TIMEOUT
      );
      return Array.isArray(data) && data.length > 0 ? data.slice(0, limit * 2) : null;
    } catch {
      return null;
    }
  });
  const result = await firstValid<RadioBrowserStation[]>(attempts);
  if (!result) throw new Error("在线电台目录不可用");
  return result;
};

/** 只保留可直连的 https 流，排除 HLS（Web 端无 hls.js 时不可播） */
const safeStreamUrl = (raw?: string): string | null => {
  const url = (raw || "").trim();
  if (!/^https:\/\//i.test(url)) return null;
  if (/\.m3u8?(\?|$)/i.test(url) || /\.pls(\?|$)/i.test(url)) return null;
  return url;
};

const mapRadioStation = (s: RadioBrowserStation, index: number, countryLabel: string): RadioStation | null => {
  const url = safeStreamUrl(s.url_resolved || s.url);
  const name = (s.name || "").trim();
  if (!url || !name) return null;
  const firstTag = (s.tags || "").split(",")[0]?.trim();
  return {
    id: `online-${s.stationuuid || `${Date.now()}-${index}`}`,
    name,
    category: firstTag || "在线",
    country: countryLabel === "全部" ? undefined : countryLabel,
    description: `${s.codec || "在线"}${s.bitrate ? ` ${s.bitrate}k` : ""} · ${(s.tags || "网络电台").split(",").slice(0, 2).join(" / ")}`,
    url,
    accent: ACCENT_PALETTE[index % ACCENT_PALETTE.length],
    codec: s.codec || undefined,
    source: "radio-browser 在线目录",
  };
};

/** 把在线电台映射为「音乐电台」曲目，作为音乐页的第二音源 */
const mapMusicChannel = (s: RadioBrowserStation, index: number, countryLabel: string): MusicTrack | null => {
  const url = safeStreamUrl(s.url_resolved || s.url);
  const name = (s.name || "").trim();
  if (!url || !name) return null;
  const firstTag = (s.tags || "").split(",")[0]?.trim();
  const favicon = /^https:\/\//i.test(s.favicon || "") ? s.favicon : undefined;
  return {
    id: `channel-${s.stationuuid || `${Date.now()}-${index}`}`,
    title: name,
    artist: `${countryLabel === "全部" ? s.country || "全球" : countryLabel} · 音乐电台`,
    album: "24 小时不间断",
    url,
    cover: favicon,
    accent: ACCENT_PALETTE[index % ACCENT_PALETTE.length],
    genre: firstTag || "音乐",
    country: countryLabel === "全部" ? undefined : countryLabel,
    source: "radio-browser 音乐电台",
    durationLabel: "LIVE",
    isLive: true,
    lyrics: ["—— 连续音乐直播流", "点击即可收听，退出页面会自动停止"],
  };
};

/**
 * 加载在线音乐电台（音乐页音源 B）。
 * 关键词按电台名称查询；风格/国家映射为 radio-browser 标签与国家码。
 */
export const fetchMusicChannels = async (
  countryLabel = "全部",
  genre = "全部",
  limit = 30,
  keyword = ""
): Promise<MusicTrack[]> => {
  const params = new URLSearchParams({
    limit: String(Math.min(Math.max(limit, 1), 100)),
    order: "clickcount",
    reverse: "true",
    hidebroken: "true",
    codec: "MP3",
  });
  const code = RADIO_COUNTRY_CODES[countryLabel];
  if (code) params.set("countrycode", code);
  const tag = RADIO_GENRE_TAGS[genre];
  if (tag) params.set("tag", tag);
  const kw = keyword.trim();
  if (kw) params.set("name", kw);

  const raw = await queryRadioBrowser(params, limit);
  const q = kw.toLowerCase();
  const results = raw
    .filter((s) => !q || (s.name || "").toLowerCase().includes(q))
    .map((s, i) => mapMusicChannel(s, i, countryLabel))
    .filter((t): t is MusicTrack => !!t);
  return dedupeTracks(results, limit);
};

/** 按国家 / 分类加载在线电台（收音机页） */
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
    codec: "MP3",
  });
  const code = RADIO_COUNTRY_CODES[countryLabel];
  if (code) params.set("countrycode", code);
  const tag = RADIO_GENRE_TAGS[category];
  if (tag) params.set("tag", tag);

  const raw = await queryRadioBrowser(params, limit);
  const stations = raw
    .map((s, i) => mapRadioStation(s, i, countryLabel))
    .filter((s): s is RadioStation => !!s);
  stations.sort((a, b) => {
    const aMp3 = /MP3/i.test(a.codec || "") ? 0 : 1;
    const bMp3 = /MP3/i.test(b.codec || "") ? 0 : 1;
    return aMp3 - bMp3;
  });
  return stations.slice(0, limit);
};
