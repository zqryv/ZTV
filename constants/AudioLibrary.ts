/**
 * 音乐在线 / 收音机 的内置内容库（v2.3.0 分地区扩充）。
 *
 * 合规与来源说明：
 * - 本文件只做「公开音频流链接聚合」，不托管、不缓存、不转播任何音频内容；
 *   电台流来自 radio-browser.info 公开目录（元数据 CC0）与各电台官方公开流，
 *   音乐流来自电台官方 24h 节目流、SoundHelix 公版演示器乐与 iTunes 官方 30~90s 试听；
 * - 不含需要登录、付费、有地域版权限制或来源不明的资源；
 * - 全部地址在 2026-11 实测可直连（HTTP 200/206，audio/mpeg / audio/aac）；
 *   已移除本次复测失效的 SomaFM（403）、SRG SSR（不可达）、Google media-session（403）等。
 *
 * 地区表述：台湾是中国的组成部分，界面统一使用「中国大陆 / 中国台湾」等**地区**标签，
 * 不把中国台湾作为独立国家与其他国家并列； ITUNES/RADIO 的地区码仅是第三方目录检索参数。
 *
 * 设计参考 any-listen（多源聚合）、MusicFree（故障转移）与
 * react-native-track-player（播放生命周期）：每条音源可声明 fallbackUrls，
 * 播放失败时由 audioPlayer 自动切换。
 */

/** 单首曲目 / 一条连续音乐流 */
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  /** 主音频地址（mp3 / m4a / aac / 网络流均可） */
  url: string;
  /** 备用的等价音频地址，主地址失败时依次尝试 */
  fallbackUrls?: string[];
  /** 封面主色（用渐变占位，避免外链图片加载失败） */
  accent: string;
  /** 歌词行 */
  lyrics?: string[];
  durationLabel?: string;
  /** 音乐风格分类 */
  genre?: string;
  /** 地区（中国大陆 / 中国台湾 / 美国 / 日本 / 韩国 / 欧洲） */
  country?: string;
  /** 封面图地址（在线搜索结果可能带封面） */
  cover?: string;
  /** 发行年份 */
  year?: string;
  /** 音源名称，用于界面标注来源、避免把演示曲误认为真实专辑 */
  source?: string;
  /** 连续直播流（无时长 / 不可 seek） */
  isLive?: boolean;
}

/** 歌单 */
export interface MusicPlaylist {
  id: string;
  name: string;
  description: string;
  accent: string;
  trackIds: string[];
}

/** 网络电台 */
export interface RadioStation {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  /** 备用流地址 */
  fallbackUrls?: string[];
  accent: string;
  /** 地区 */
  country?: string;
  /** 编码 / 码率，用于界面标注 */
  codec?: string;
  /** 音源名称 */
  source?: string;
}

/** 音乐风格分类 */
export const MUSIC_GENRES = [
  "全部",
  "流行",
  "摇滚",
  "电子",
  "古典",
  "爵士",
  "轻音乐",
  "民谣",
  "说唱",
] as const;

/** 音乐 / 电台 地区（均为地区口径，非国家列表） */
export const MUSIC_COUNTRIES = [
  "全部",
  "中国大陆",
  "中国台湾",
  "美国",
  "日本",
  "韩国",
  "欧洲",
] as const;

/** 音乐页可切换的在线音源（参考 any-listen / MusicFree 的多音源聚合） */
export const MUSIC_SOURCES = [
  { id: "latest", name: "最新单曲", description: "iTunes 全球新歌试听 · 30~90 秒" },
  { id: "channels", name: "音乐电台", description: "radio-browser 24 小时不间断音乐流" },
  { id: "builtin", name: "内置曲库", description: "已验证可直连，网络受限时的兜底" },
] as const;

export type MusicSourceId = (typeof MUSIC_SOURCES)[number]["id"];

/** 音乐页常用搜索词（电视 / 机顶盒一键输入，避免无系统键盘时无法输入中文） */
export const MUSIC_QUICK_TERMS = [
  "周杰伦",
  "邓紫棋",
  "陈奕迅",
  "Taylor Swift",
  "华语",
  "流行",
  "古典",
  "爵士",
  "轻音乐",
  "电子",
];

/** SoundHelix 公开演示音源：纯器乐、全长、可直连，作为离线兜底曲库 */
const SAMPLE_BASE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-";

const DEMO_TRACKS: MusicTrack[] = [
  {
    id: "track-1", title: "晨曦微光", artist: "SoundHelix", album: "公版器乐 · 轻音乐",
    url: `${SAMPLE_BASE}1.mp3`, accent: "#00E6A8", durationLabel: "06:12",
    genre: "轻音乐", country: "中国大陆", source: "SoundHelix 公版器乐",
    lyrics: ["晨光穿过窗棂 落在旧唱片上", "让旋律带走 昨日的匆忙", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-2", title: "城市夜行", artist: "SoundHelix", album: "公版器乐 · 电子",
    url: `${SAMPLE_BASE}2.mp3`, accent: "#7C8CFF", durationLabel: "07:05",
    genre: "电子", country: "美国", source: "SoundHelix 公版器乐",
    lyrics: ["霓虹在窗外 流动成河", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-3", title: "远山回响", artist: "SoundHelix", album: "公版器乐 · 氛围",
    url: `${SAMPLE_BASE}3.mp3`, accent: "#FFB86B", durationLabel: "05:48",
    genre: "民谣", country: "中国大陆", source: "SoundHelix 公版器乐",
    lyrics: ["风越过山脊 带来回声", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-4", title: "海边的信", artist: "SoundHelix", album: "公版器乐 · 钢琴",
    url: `${SAMPLE_BASE}4.mp3`, accent: "#4FC3F7", durationLabel: "06:33",
    genre: "轻音乐", country: "日本", source: "SoundHelix 公版器乐",
    lyrics: ["把未说出的话 折进纸船", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-5", title: "星轨", artist: "SoundHelix", album: "公版器乐 · 新世纪",
    url: `${SAMPLE_BASE}5.mp3`, accent: "#C792EA", durationLabel: "06:57",
    genre: "电子", country: "美国", source: "SoundHelix 公版器乐",
    lyrics: ["夜空写下 长长的轨迹", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-6", title: "夏日序曲", artist: "SoundHelix", album: "公版器乐 · 流行",
    url: `${SAMPLE_BASE}6.mp3`, accent: "#00E6A8", durationLabel: "05:24",
    genre: "流行", country: "中国大陆", source: "SoundHelix 公版器乐",
    lyrics: ["蝉声唤醒 夏日的序曲", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-7", title: "午夜旋律", artist: "SoundHelix", album: "公版器乐 · 爵士",
    url: `${SAMPLE_BASE}7.mp3`, accent: "#FF8A65", durationLabel: "06:02",
    genre: "爵士", country: "美国", source: "SoundHelix 公版器乐",
    lyrics: ["午夜的旋律 轻轻摇晃", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-8", title: "摇滚之心", artist: "SoundHelix", album: "公版器乐 · 摇滚",
    url: `${SAMPLE_BASE}8.mp3`, accent: "#EF5350", durationLabel: "05:41",
    genre: "摇滚", country: "欧洲", source: "SoundHelix 公版器乐",
    lyrics: ["心跳跟着鼓点 一起燃烧", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-9", title: "樱花雨", artist: "SoundHelix", album: "公版器乐 · 和风",
    url: `${SAMPLE_BASE}9.mp3`, accent: "#F48FB1", durationLabel: "06:18",
    genre: "轻音乐", country: "日本", source: "SoundHelix 公版器乐",
    lyrics: ["樱花落下的季节", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-10", title: "首尔夜色", artist: "SoundHelix", album: "公版器乐 · 韩流",
    url: `${SAMPLE_BASE}10.mp3`, accent: "#7E57C2", durationLabel: "05:56",
    genre: "流行", country: "韩国", source: "SoundHelix 公版器乐",
    lyrics: ["霓虹闪烁的街角", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-11", title: "弦上月光", artist: "SoundHelix", album: "公版器乐 · 古典",
    url: `${SAMPLE_BASE}11.mp3`, accent: "#FFD54F", durationLabel: "07:12",
    genre: "古典", country: "欧洲", source: "SoundHelix 公版器乐",
    lyrics: ["月光流淌在琴弦上", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-12", title: "节奏风暴", artist: "SoundHelix", album: "公版器乐 · 电子",
    url: `${SAMPLE_BASE}12.mp3`, accent: "#26C6DA", durationLabel: "06:29",
    genre: "说唱", country: "美国", source: "SoundHelix 公版器乐",
    lyrics: ["跟上这节奏 不要停", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-13", title: "江南烟雨", artist: "SoundHelix", album: "公版器乐 · 国风",
    url: `${SAMPLE_BASE}13.mp3`, accent: "#66BB6A", durationLabel: "06:45",
    genre: "民谣", country: "中国大陆", source: "SoundHelix 公版器乐",
    lyrics: ["烟雨朦胧了江南", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-14", title: "电光石火", artist: "SoundHelix", album: "公版器乐 · 摇滚",
    url: `${SAMPLE_BASE}14.mp3`, accent: "#FF7043", durationLabel: "05:33",
    genre: "摇滚", country: "日本", source: "SoundHelix 公版器乐",
    lyrics: ["电光石火的一瞬间", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-15", title: "深夜电台", artist: "SoundHelix", album: "公版器乐 · 爵士",
    url: `${SAMPLE_BASE}15.mp3`, accent: "#AB47BC", durationLabel: "06:51",
    genre: "爵士", country: "韩国", source: "SoundHelix 公版器乐",
    lyrics: ["深夜电台 陪你入眠", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-16", title: "梦的终点", artist: "SoundHelix", album: "公版器乐 · 新世纪",
    url: `${SAMPLE_BASE}16.mp3`, accent: "#29B6F6", durationLabel: "07:03",
    genre: "古典", country: "中国台湾", source: "SoundHelix 公版器乐",
    lyrics: ["在梦的终点 我们重逢", "—— 内置公版器乐曲目"],
  },
];

/**
 * 内置「音乐电台」：按地区分组的 24h 公开音乐流，全部实测可直连。
 * 与 iTunes 试听互补：即使 Apple 服务不可达，也能正常浏览并播放真实音乐。
 */
const LIVE_MUSIC_CHANNELS: MusicTrack[] = [
  {
    id: "music-live-1", title: "清晨音乐台", artist: "蜻蜓FM · 音乐电台", album: "24 小时不间断",
    url: "https://lhttp.qingting.fm/live/4915/64k.mp3", accent: "#00E6A8",
    genre: "轻音乐", country: "中国大陆", source: "蜻蜓FM 公开音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流", "无需下载，点击即可收听"],
  },
  {
    id: "music-live-2", title: "动听音乐台", artist: "蜻蜓FM · 音乐电台", album: "24 小时不间断",
    url: "https://lhttp-hw.qtfm.cn/live/5022107/64k.mp3", accent: "#7C8CFF",
    genre: "流行", country: "中国大陆", source: "蜻蜓FM 公开音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-3", title: "AsiaFM 亚洲经典台", artist: "蜻蜓FM · 音乐电台", album: "24 小时不间断",
    url: "https://lhttp.qingting.fm/live/5021912/64k.mp3", accent: "#FFB86B",
    genre: "怀旧", country: "中国大陆", source: "蜻蜓FM 公开音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-4", title: "50 首经典古典音乐", artist: "蜻蜓FM · 音乐电台", album: "24 小时不间断",
    url: "https://lhttp-hw.qtfm.cn/live/5022308/64k.mp3", accent: "#C792EA",
    genre: "古典", country: "中国大陆", source: "蜻蜓FM 公开音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-5", title: "Radio Paradise", artist: "Radio Paradise · 美国", album: "24 小时不间断",
    url: "https://stream.radioparadise.com/mp3-128",
    fallbackUrls: ["https://stream.radioparadise.com/mp3-320"],
    accent: "#4FC3F7",
    genre: "摇滚", country: "美国", source: "Radio Paradise 公开音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-6", title: "NPO Klassiek 古典台", artist: "NPO · 欧洲", album: "24 小时不间断",
    url: "https://icecast.omroep.nl/radio4-bb-mp3",
    fallbackUrls: ["https://icecast.omroep.nl/radio2-bb-mp3"],
    accent: "#F48FB1",
    genre: "古典", country: "欧洲", source: "NPO 公开广播流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-7", title: "栗子的輕音樂", artist: "Lize Radio · 中国台湾", album: "24 小时不间断",
    url: "https://lizeradio.com/radio/stream", accent: "#66BB6A",
    genre: "轻音乐", country: "中国台湾", source: "Lize Radio 公开音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流", "中国台湾地区的公开轻音乐频道"],
  },
  {
    id: "music-live-8", title: "AsiaFM 亞洲電台", artist: "AsiaFM · 中国台湾", album: "24 小时不间断",
    url: "https://n13.rcs.revma.com/xpgtqc74hv8uv", accent: "#FFD54F",
    genre: "流行", country: "中国台湾", source: "radio-browser 公开电台流", isLive: true,
    lyrics: ["—— 连续音乐直播流", "中国台湾地区的公开流行音乐频道"],
  },
  {
    id: "music-live-9", title: "Your Classical · Relax", artist: "American Public Media · 美国", album: "24 小时不间断",
    url: "https://relax.stream.publicradio.org/relax.mp3", accent: "#7E57C2",
    genre: "古典", country: "美国", source: "Public Radio 公开音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
];

/** 内置曲库：16 首可直连公版单曲 + 9 条分地区 24h 在线音乐流 */
export const BUILTIN_TRACKS: MusicTrack[] = [...DEMO_TRACKS, ...LIVE_MUSIC_CHANNELS];

/** 动态歌单：内置曲目 + 在线搜索结果各自成单，具体 trackIds 由 store 维护 */
export const BUILTIN_PLAYLISTS: MusicPlaylist[] = [
  {
    id: "playlist-all",
    name: "全部曲目",
    description: "内置曲库 · 单曲与音乐电台",
    accent: "#00E6A8",
    trackIds: BUILTIN_TRACKS.map((t) => t.id),
  },
  {
    id: "playlist-online",
    name: "在线搜索",
    description: "最新单曲 / 音乐电台搜索结果",
    accent: "#7C8CFF",
    trackIds: [],
  },
  {
    id: "playlist-calm",
    name: "静夜聆听",
    description: "氛围 / 钢琴 / 轻音乐",
    accent: "#4FC3F7",
    trackIds: ["track-1", "track-3", "track-4", "track-9", "track-16", "music-live-1", "music-live-6", "music-live-7", "music-live-9"],
  },
  {
    id: "playlist-motion",
    name: "律动时刻",
    description: "电子 / 流行 / 摇滚",
    accent: "#FFB86B",
    trackIds: ["track-2", "track-5", "track-8", "track-10", "track-12", "track-14", "music-live-2", "music-live-5", "music-live-8"],
  },
  {
    id: "playlist-live",
    name: "音乐电台",
    description: "24 小时连续音乐流",
    accent: "#66BB6A",
    trackIds: LIVE_MUSIC_CHANNELS.map((t) => t.id),
  },
];

/**
 * 内置网络电台：按地区组织的公开免费广播流（全部实测可直连）。
 * 覆盖 中国大陆 / 中国台湾 / 美国 / 欧洲 / 日本 / 韩国，
 * 解决「切换地区后无可用电台」与「完全依赖在线目录」的问题。
 */
export const BUILTIN_RADIO_STATIONS: RadioStation[] = [
  // ── 中国大陆 ────────────────────────────────────────────────────────────
  {
    id: "radio-cn-1", name: "CNR-1 中国之声", category: "新闻", country: "中国大陆",
    description: "中央广播电视总台 · 全国新闻", url: "https://lhttp.qtfm.cn/live/15318317/64k.mp3",
    accent: "#EF5350", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-2", name: "国际新闻广播", category: "新闻", country: "中国大陆",
    description: "24 小时国际新闻滚动", url: "https://lhttp.qtfm.cn/live/20500172/64k.mp3",
    accent: "#4FC3F7", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-3", name: "清晨音乐台", category: "轻音乐", country: "中国大陆",
    description: "舒缓轻音乐 · 陪伴清晨", url: "https://lhttp.qingting.fm/live/4915/64k.mp3",
    accent: "#00E6A8", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-4", name: "动听音乐台", category: "流行", country: "中国大陆",
    description: "华语流行金曲", url: "https://lhttp-hw.qtfm.cn/live/5022107/64k.mp3",
    accent: "#7C8CFF", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-5", name: "怀集音乐之声", category: "音乐", country: "中国大陆",
    description: "综合音乐频道", url: "https://lhttp.qingting.fm/live/4804/64k.mp3",
    accent: "#FFB86B", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-6", name: "AsiaFM 亚洲经典台", category: "怀旧", country: "中国大陆",
    description: "亚洲经典老歌", url: "https://lhttp.qingting.fm/live/5021912/64k.mp3",
    accent: "#C792EA", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-7", name: "50 首经典古典音乐", category: "古典", country: "中国大陆",
    description: "古典名曲轮播", url: "https://lhttp-hw.qtfm.cn/live/5022308/64k.mp3",
    accent: "#FFD54F", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-8", name: "两广之声音乐台", category: "音乐", country: "中国大陆",
    description: "粤语 / 华语音乐", url: "https://lhttp.qtfm.cn/live/20500149/64k.mp3",
    accent: "#66BB6A", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-9", name: "上海动感 101", category: "流行", country: "中国大陆",
    description: "上海 · 华语流行金曲", url: "https://lhttp.qingting.fm/live/274/64k.mp3",
    accent: "#26C6DA", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-10", name: "江苏经典流行音乐广播", category: "流行", country: "中国大陆",
    description: "江苏 · 经典流行", url: "https://lhttp.qtfm.cn/live/4938/64k.mp3",
    accent: "#F48FB1", codec: "MP3 64k", source: "蜻蜓FM 公开广播流",
  },
  {
    id: "radio-cn-11", name: "REPLAY NEWS 中文", category: "新闻", country: "中国大陆",
    description: "每 5 分钟中文新闻", url: "https://replaynewszh.ice.infomaniak.ch/replaynewszh-128.mp3",
    accent: "#FF8A65", codec: "MP3 128k", source: "Infomaniak 公开广播流",
  },

  // ── 中国台湾（地区） ───────────────────────────────────────────────────
  {
    id: "radio-tw-1", name: "飛碟聯播網 飛碟電台", category: "新闻", country: "中国台湾",
    description: "中国台湾 · 综合资讯", url: "https://n10.rcs.revma.com/em90w4aeewzuv",
    accent: "#00E6A8", codec: "AAC", source: "radio-browser 公开电台流",
  },
  {
    id: "radio-tw-2", name: "AsiaFM 亞洲電台", category: "流行", country: "中国台湾",
    description: "中国台湾 · 华语流行", url: "https://n13.rcs.revma.com/xpgtqc74hv8uv",
    accent: "#7C8CFF", codec: "AAC", source: "radio-browser 公开电台流",
  },
  {
    id: "radio-tw-3", name: "Radio ICRT", category: "音乐", country: "中国台湾",
    description: "中国台湾 · 英语音乐", url: "https://n27a-eu.rcs.revma.com/nkdfurztxp3vv",
    accent: "#FFB86B", codec: "AAC", source: "radio-browser 公开电台流",
  },
  {
    id: "radio-tw-4", name: "高雄廣播電台", category: "新闻", country: "中国台湾",
    description: "中国台湾 · 地方资讯", url: "https://n13.rcs.revma.com/pet2dvug1bkvv",
    accent: "#4FC3F7", codec: "AAC", source: "radio-browser 公开电台流",
  },
  {
    id: "radio-tw-5", name: "栗子的輕音樂", category: "轻音乐", country: "中国台湾",
    description: "中国台湾 · 轻音乐频道", url: "https://lizeradio.com/radio/stream",
    accent: "#66BB6A", codec: "MP3", source: "Lize Radio 公开音乐流",
  },

  // ── 美国 ────────────────────────────────────────────────────────────────
  {
    id: "radio-us-1", name: "KEXP 90.3", category: "音乐", country: "美国",
    description: "西雅图 · 独立音乐", url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3",
    accent: "#29B6F6", codec: "MP3 128k", source: "KEXP 公开广播流",
  },
  {
    id: "radio-us-2", name: "NPR News", category: "新闻", country: "美国",
    description: "美国国家公共广播", url: "https://npr-ice.streamguys1.com/live.mp3",
    accent: "#FF8A65", codec: "MP3", source: "NPR 公开广播流",
  },
  {
    id: "radio-us-3", name: "Radio Paradise", category: "音乐", country: "美国",
    description: "无广告多元音乐 · 128k", url: "https://stream.radioparadise.com/mp3-128",
    fallbackUrls: ["https://stream.radioparadise.com/mp3-320"],
    accent: "#66BB6A", codec: "MP3 128k", source: "Radio Paradise 公开音乐流",
  },
  {
    id: "radio-us-4", name: "Radio Paradise Mellow", category: "轻音乐", country: "美国",
    description: "舒缓 / 氛围音乐", url: "https://stream.radioparadise.com/mellow-128",
    accent: "#26C6DA", codec: "AAC 128k", source: "Radio Paradise 公开音乐流",
  },
  {
    id: "radio-us-5", name: "Radio Paradise Rock", category: "节奏", country: "美国",
    description: "摇滚 / 独立音乐", url: "https://stream.radioparadise.com/rock-128",
    accent: "#EF5350", codec: "AAC 128k", source: "Radio Paradise 公开音乐流",
  },
  {
    id: "radio-us-6", name: "MSNBC News", category: "新闻", country: "美国",
    description: "美国 · 24 小时新闻", url: "https://tunein.cdnstream1.com/3511_96.mp3",
    accent: "#AB47BC", codec: "MP3 96k", source: "TuneIn 公开广播流",
  },
  {
    id: "radio-us-7", name: "Your Classical · Relax", category: "古典", country: "美国",
    description: "美国 · 古典与放松音乐", url: "https://relax.stream.publicradio.org/relax.mp3",
    accent: "#7E57C2", codec: "MP3 128k", source: "Public Radio 公开音乐流",
  },

  // ── 欧洲 ────────────────────────────────────────────────────────────────
  {
    id: "radio-eu-1", name: "NPO Radio 2", category: "流行", country: "欧洲",
    description: "荷兰 · 流行与经典金曲", url: "https://icecast.omroep.nl/radio2-bb-mp3",
    accent: "#00E6A8", codec: "MP3", source: "NPO 公开广播流",
  },
  {
    id: "radio-eu-2", name: "NPO Klassiek", category: "古典", country: "欧洲",
    description: "荷兰 · 古典音乐与音乐会", url: "https://icecast.omroep.nl/radio4-bb-mp3",
    accent: "#7C8CFF", codec: "MP3", source: "NPO 公开广播流",
  },
  {
    id: "radio-eu-3", name: "NPO Radio 5", category: "怀旧", country: "欧洲",
    description: "荷兰 · 怀旧金曲", url: "https://icecast.omroep.nl/radio5-bb-mp3",
    accent: "#FFB86B", codec: "MP3", source: "NPO 公开广播流",
  },
  {
    id: "radio-eu-4", name: "NPO Radio 1", category: "新闻", country: "欧洲",
    description: "荷兰 · 新闻与时事", url: "https://icecast.omroep.nl/radio1-bb-mp3",
    accent: "#4FC3F7", codec: "MP3", source: "NPO 公开广播流",
  },
  {
    id: "radio-eu-5", name: "NPO 3FM", category: "音乐", country: "欧洲",
    description: "荷兰 · 年轻人流行音乐", url: "https://icecast.omroep.nl/3fm-bb-mp3",
    accent: "#F48FB1", codec: "MP3", source: "NPO 公开广播流",
  },
  {
    id: "radio-eu-6", name: "Europe 1", category: "新闻", country: "欧洲",
    description: "法国 · 新闻综合", url: "https://europe1.lmn.fm/europe1.mp3",
    accent: "#AB47BC", codec: "MP3", source: "Europe 1 公开广播流",
  },
  {
    id: "radio-eu-7", name: "RMC Info", category: "新闻", country: "欧洲",
    description: "法国 · 资讯与体育", url: "https://audio.bfmtv.com/rmcradio_128.mp3",
    accent: "#00B884", codec: "MP3 128k", source: "RMC 公开广播流",
  },

  // ── 日本 ────────────────────────────────────────────────────────────────
  {
    id: "radio-jp-1", name: "Listen.moe J-Pop", category: "流行", country: "日本",
    description: "J-Pop / 动画音乐 24h", url: "https://listen.moe/fallback",
    accent: "#F48FB1", codec: "MP3", source: "Listen.moe 公开音乐流",
  },
  {
    id: "radio-jp-2", name: "Retro-Ko Radio", category: "怀旧", country: "日本",
    description: "复古 / City Pop", url: "https://radio.retroko.com/listen/retroko/radio.mp3",
    accent: "#FFB86B", codec: "MP3", source: "Retro-Ko 公开音乐流",
  },
  {
    id: "radio-jp-3", name: "SOUND UP STATION NFRS", category: "音乐", country: "日本",
    description: "日本独立音乐", url: "https://stream2.rcast.net/70945",
    accent: "#7C8CFF", codec: "MP3", source: "rCast 公开广播流",
  },

  // ── 韩国 ────────────────────────────────────────────────────────────────
  {
    id: "radio-kr-1", name: "Listen.moe K-Pop", category: "流行", country: "韩国",
    description: "K-Pop 24 小时不间断", url: "https://listen.moe/kpop/fallback",
    accent: "#7E57C2", codec: "MP3", source: "Listen.moe 公开音乐流",
  },
  {
    id: "radio-kr-2", name: "REPLAY NEWS 한국어", category: "新闻", country: "韩国",
    description: "每 5 分钟韩语新闻", url: "https://replaynewskr.ice.infomaniak.ch/replaynewskr-128.mp3",
    accent: "#4FC3F7", codec: "MP3 128k", source: "Infomaniak 公开广播流",
  },
];

export const RADIO_CATEGORIES = [
  "全部",
  "音乐",
  "新闻",
  "流行",
  "古典",
  "爵士",
  "轻音乐",
  "怀旧",
  "节奏",
] as const;

/** 电台地区（内置 + 在线加载共用） */
export const RADIO_COUNTRIES = [
  "全部",
  "中国大陆",
  "中国台湾",
  "美国",
  "日本",
  "韩国",
  "欧洲",
] as const;
