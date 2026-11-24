/**
 * 音乐播放 / 收音机 的内置内容库。
 *
 * 设计参考 any-listen（聚合多个音源）、MusicFree（音源插件 + 故障转移）与
 * react-native-track-player（播放生命周期）的成熟做法：
 * - 每个音源可声明多个 fallbackUrls，播放失败时由 audioPlayer 自动切换；
 * - 内置曲库混合「可直连单曲」与「24h 音乐电台」，网络受限时仍可收听；
 * - 所有内置地址均为 2026-11 实测可直连（HTTP 200/206，audio/mpeg / audio/aac），
 *   不使用需要密钥、需要自建服务或已返回 403 的地址。
 *
 * 已移除的失效源：Google media-session 样例（403）、SomaFM（403）、
 * BBC / France Inter / SWR3 / WFMU（不可达）、iTunes country=cn 商店（恒为 0 结果）。
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
  /** 国家 / 地区 */
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
  /** 国家 / 地区 */
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

/** 音乐 / 电台 国家 / 地区 */
export const MUSIC_COUNTRIES = ["全部", "中国", "欧美", "日本", "韩国"] as const;

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
  "流行",
  "古典",
  "爵士",
  "轻音乐",
  "电子",
  "民谣",
];

/** SoundHelix 公开演示音源：纯器乐、全长、可直连，作为离线兜底曲库 */
const SAMPLE_BASE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-";

const DEMO_TRACKS: MusicTrack[] = [
  {
    id: "track-1", title: "晨曦微光", artist: "SoundHelix", album: "公版器乐 · 轻音乐",
    url: `${SAMPLE_BASE}1.mp3`, accent: "#00E6A8", durationLabel: "06:12",
    genre: "轻音乐", country: "中国", source: "SoundHelix 公版器乐",
    lyrics: ["晨光穿过窗棂 落在旧唱片上", "让旋律带走 昨日的匆忙", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-2", title: "城市夜行", artist: "SoundHelix", album: "公版器乐 · 电子",
    url: `${SAMPLE_BASE}2.mp3`, accent: "#7C8CFF", durationLabel: "07:05",
    genre: "电子", country: "欧美", source: "SoundHelix 公版器乐",
    lyrics: ["霓虹在窗外 流动成河", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-3", title: "远山回响", artist: "SoundHelix", album: "公版器乐 · 氛围",
    url: `${SAMPLE_BASE}3.mp3`, accent: "#FFB86B", durationLabel: "05:48",
    genre: "民谣", country: "中国", source: "SoundHelix 公版器乐",
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
    genre: "电子", country: "欧美", source: "SoundHelix 公版器乐",
    lyrics: ["夜空写下 长长的轨迹", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-6", title: "夏日序曲", artist: "SoundHelix", album: "公版器乐 · 流行",
    url: `${SAMPLE_BASE}6.mp3`, accent: "#00E6A8", durationLabel: "05:24",
    genre: "流行", country: "中国", source: "SoundHelix 公版器乐",
    lyrics: ["蝉声唤醒 夏日的序曲", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-7", title: "午夜旋律", artist: "SoundHelix", album: "公版器乐 · 爵士",
    url: `${SAMPLE_BASE}7.mp3`, accent: "#FF8A65", durationLabel: "06:02",
    genre: "爵士", country: "欧美", source: "SoundHelix 公版器乐",
    lyrics: ["午夜的旋律 轻轻摇晃", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-8", title: "摇滚之心", artist: "SoundHelix", album: "公版器乐 · 摇滚",
    url: `${SAMPLE_BASE}8.mp3`, accent: "#EF5350", durationLabel: "05:41",
    genre: "摇滚", country: "欧美", source: "SoundHelix 公版器乐",
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
    genre: "古典", country: "欧美", source: "SoundHelix 公版器乐",
    lyrics: ["月光流淌在琴弦上", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-12", title: "节奏风暴", artist: "SoundHelix", album: "公版器乐 · 电子",
    url: `${SAMPLE_BASE}12.mp3`, accent: "#26C6DA", durationLabel: "06:29",
    genre: "说唱", country: "欧美", source: "SoundHelix 公版器乐",
    lyrics: ["跟上这节奏 不要停", "—— 内置公版器乐曲目"],
  },
  {
    id: "track-13", title: "江南烟雨", artist: "SoundHelix", album: "公版器乐 · 国风",
    url: `${SAMPLE_BASE}13.mp3`, accent: "#66BB6A", durationLabel: "06:45",
    genre: "民谣", country: "中国", source: "SoundHelix 公版器乐",
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
    genre: "古典", country: "中国", source: "SoundHelix 公版器乐",
    lyrics: ["在梦的终点 我们重逢", "—— 内置公版器乐曲目"],
  },
];

/**
 * 内置「音乐电台」音源：国内可直连的 24h 音乐流（实测 200 / CORS *）。
 * 与 iTunes 试听互补：即使 Apple 服务不可达，也能正常浏览并播放真实音乐。
 */
const LIVE_MUSIC_CHANNELS: MusicTrack[] = [
  {
    id: "music-live-1", title: "清晨音乐台", artist: "蜻蜓FM · 音乐电台", album: "24 小时不间断",
    url: "https://lhttp.qingting.fm/live/4915/64k.mp3", accent: "#00E6A8",
    genre: "轻音乐", country: "中国", source: "蜻蜓FM 在线音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流", "无需下载，点击即可收听"],
  },
  {
    id: "music-live-2", title: "动听音乐台", artist: "蜻蜓FM · 音乐电台", album: "24 小时不间断",
    url: "https://lhttp-hw.qtfm.cn/live/5022107/64k.mp3", accent: "#7C8CFF",
    genre: "流行", country: "中国", source: "蜻蜓FM 在线音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-3", title: "AsiaFM 亚洲经典台", artist: "蜻蜓FM · 音乐电台", album: "24 小时不间断",
    url: "https://lhttp.qingting.fm/live/5021912/64k.mp3", accent: "#FFB86B",
    genre: "怀旧", country: "中国", source: "蜻蜓FM 在线音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-4", title: "50 首经典古典音乐", artist: "蜻蜓FM · 音乐电台", album: "24 小时不间断",
    url: "https://lhttp-hw.qtfm.cn/live/5022308/64k.mp3", accent: "#C792EA",
    genre: "古典", country: "中国", source: "蜻蜓FM 在线音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-5", title: "Radio Paradise", artist: "Radio Paradise · 欧美", album: "24 小时不间断",
    url: "https://stream.radioparadise.com/mp3-128",
    fallbackUrls: ["https://stream.radioparadise.com/mp3-320"],
    accent: "#4FC3F7",
    genre: "摇滚", country: "欧美", source: "Radio Paradise 在线音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
  {
    id: "music-live-6", title: "Radio Swiss Jazz", artist: "SRG SSR · 瑞士", album: "24 小时不间断",
    url: "https://stream.srg-ssr.ch/m/rsj/mp3_128", accent: "#F48FB1",
    genre: "爵士", country: "欧美", source: "SRG SSR 在线音乐流", isLive: true,
    lyrics: ["—— 连续音乐直播流"],
  },
];

/** 内置曲库：16 首可直连公版单曲 + 6 条 24h 在线音乐流 */
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
    trackIds: ["track-1", "track-3", "track-4", "track-9", "track-16", "music-live-1", "music-live-6"],
  },
  {
    id: "playlist-motion",
    name: "律动时刻",
    description: "电子 / 流行 / 摇滚",
    accent: "#FFB86B",
    trackIds: ["track-2", "track-5", "track-8", "track-10", "track-12", "track-14", "music-live-2", "music-live-5"],
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
 * 内置网络电台（全部为实测可直连的 MP3/AAC 流），按国家/地区与分类组织。
 * 覆盖 中国 / 欧美 / 日本 / 韩国，解决「切换地区后无可用电台」与「依赖在线目录」的问题。
 */
export const BUILTIN_RADIO_STATIONS: RadioStation[] = [
  // ── 中国 ────────────────────────────────────────────────────────────────
  {
    id: "radio-cn-1", name: "CNR-1 中国之声", category: "新闻", country: "中国",
    description: "中央广播电视总台 · 全国新闻", url: "https://lhttp.qtfm.cn/live/15318317/64k.mp3",
    accent: "#EF5350", codec: "MP3 64k", source: "蜻蜓FM",
  },
  {
    id: "radio-cn-2", name: "国际新闻广播", category: "新闻", country: "中国",
    description: "24 小时国际新闻滚动", url: "https://lhttp.qtfm.cn/live/20500172/64k.mp3",
    accent: "#4FC3F7", codec: "MP3 64k", source: "蜻蜓FM",
  },
  {
    id: "radio-cn-3", name: "清晨音乐台", category: "轻音乐", country: "中国",
    description: "舒缓轻音乐 · 陪伴清晨", url: "https://lhttp.qingting.fm/live/4915/64k.mp3",
    accent: "#00E6A8", codec: "MP3 64k", source: "蜻蜓FM",
  },
  {
    id: "radio-cn-4", name: "动听音乐台", category: "流行", country: "中国",
    description: "华语流行金曲", url: "https://lhttp-hw.qtfm.cn/live/5022107/64k.mp3",
    accent: "#7C8CFF", codec: "MP3 64k", source: "蜻蜓FM",
  },
  {
    id: "radio-cn-5", name: "怀集音乐之声", category: "音乐", country: "中国",
    description: "综合音乐频道", url: "https://lhttp.qingting.fm/live/4804/64k.mp3",
    accent: "#FFB86B", codec: "MP3 64k", source: "蜻蜓FM",
  },
  {
    id: "radio-cn-6", name: "AsiaFM 亚洲经典台", category: "怀旧", country: "中国",
    description: "亚洲经典老歌", url: "https://lhttp.qingting.fm/live/5021912/64k.mp3",
    accent: "#C792EA", codec: "MP3 64k", source: "蜻蜓FM",
  },
  {
    id: "radio-cn-7", name: "50 首经典古典音乐", category: "古典", country: "中国",
    description: "古典名曲轮播", url: "https://lhttp-hw.qtfm.cn/live/5022308/64k.mp3",
    accent: "#FFD54F", codec: "MP3 64k", source: "蜻蜓FM",
  },
  {
    id: "radio-cn-8", name: "两广之声音乐台", category: "音乐", country: "中国",
    description: "粤语 / 华语音乐", url: "https://lhttp.qtfm.cn/live/20500149/64k.mp3",
    accent: "#66BB6A", codec: "MP3 64k", source: "蜻蜓FM",
  },

  // ── 欧美 ────────────────────────────────────────────────────────────────
  {
    id: "radio-eu-1", name: "NPO Radio 2", category: "流行", country: "欧美",
    description: "荷兰 · 流行与经典金曲", url: "https://icecast.omroep.nl/radio2-bb-mp3",
    accent: "#00E6A8", codec: "MP3", source: "NPO",
  },
  {
    id: "radio-eu-2", name: "NPO Klassiek", category: "古典", country: "欧美",
    description: "荷兰 · 古典音乐与音乐会", url: "https://icecast.omroep.nl/radio4-bb-mp3",
    accent: "#7C8CFF", codec: "MP3", source: "NPO",
  },
  {
    id: "radio-eu-3", name: "NPO Radio 5", category: "怀旧", country: "欧美",
    description: "荷兰 · 怀旧金曲", url: "https://icecast.omroep.nl/radio5-bb-mp3",
    accent: "#FFB86B", codec: "MP3", source: "NPO",
  },
  {
    id: "radio-eu-4", name: "NPO Radio 1", category: "新闻", country: "欧美",
    description: "荷兰 · 新闻与时事", url: "https://icecast.omroep.nl/radio1-bb-mp3",
    accent: "#4FC3F7", codec: "MP3", source: "NPO",
  },
  {
    id: "radio-eu-5", name: "NPO 3FM", category: "音乐", country: "欧美",
    description: "荷兰 · 年轻人流行音乐", url: "https://icecast.omroep.nl/3fm-bb-mp3",
    accent: "#F48FB1", codec: "MP3", source: "NPO",
  },
  {
    id: "radio-eu-6", name: "Radio Paradise", category: "音乐", country: "欧美",
    description: "无广告多元音乐 · 128k", url: "https://stream.radioparadise.com/mp3-128",
    fallbackUrls: ["https://stream.radioparadise.com/mp3-320"],
    accent: "#66BB6A", codec: "MP3 128k", source: "Radio Paradise",
  },
  {
    id: "radio-eu-7", name: "Radio Paradise Mellow", category: "轻音乐", country: "欧美",
    description: "舒缓 / 氛围音乐", url: "https://stream.radioparadise.com/mellow-128",
    accent: "#26C6DA", codec: "AAC 128k", source: "Radio Paradise",
  },
  {
    id: "radio-eu-8", name: "Radio Paradise Rock", category: "节奏", country: "欧美",
    description: "摇滚 / 独立音乐", url: "https://stream.radioparadise.com/rock-128",
    accent: "#EF5350", codec: "AAC 128k", source: "Radio Paradise",
  },
  {
    id: "radio-eu-9", name: "Radio Swiss Classic", category: "古典", country: "欧美",
    description: "瑞士 · 古典音乐", url: "https://stream.srg-ssr.ch/m/rsc_de/mp3_128",
    accent: "#FFD54F", codec: "MP3 128k", source: "SRG SSR",
  },
  {
    id: "radio-eu-10", name: "Radio Swiss Jazz", category: "爵士", country: "欧美",
    description: "瑞士 · 爵士音乐", url: "https://stream.srg-ssr.ch/m/rsj/mp3_128",
    accent: "#F48FB1", codec: "MP3 128k", source: "SRG SSR",
  },
  {
    id: "radio-eu-11", name: "Radio Swiss Pop", category: "流行", country: "欧美",
    description: "瑞士 · 流行音乐", url: "https://stream.srg-ssr.ch/m/rsp/mp3_128",
    accent: "#7E57C2", codec: "MP3 128k", source: "SRG SSR",
  },
  {
    id: "radio-eu-12", name: "KEXP 90.3", category: "音乐", country: "欧美",
    description: "西雅图 · 独立音乐", url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3",
    accent: "#29B6F6", codec: "MP3 128k", source: "KEXP",
  },
  {
    id: "radio-eu-13", name: "NPR News", category: "新闻", country: "欧美",
    description: "美国国家公共广播", url: "https://npr-ice.streamguys1.com/live.mp3",
    accent: "#FF8A65", codec: "MP3", source: "NPR",
  },
  {
    id: "radio-eu-14", name: "Europe 1", category: "新闻", country: "欧美",
    description: "法国 · 新闻综合", url: "https://europe1.lmn.fm/europe1.mp3",
    accent: "#AB47BC", codec: "MP3", source: "Europe 1",
  },
  {
    id: "radio-eu-15", name: "RMC Info", category: "新闻", country: "欧美",
    description: "法国 · 资讯与体育", url: "https://audio.bfmtv.com/rmcradio_128.mp3",
    accent: "#00B884", codec: "MP3 128k", source: "RMC",
  },

  // ── 日本 ────────────────────────────────────────────────────────────────
  {
    id: "radio-jp-1", name: "Listen.moe J-Pop", category: "流行", country: "日本",
    description: "J-Pop / 动画音乐 24h", url: "https://listen.moe/fallback",
    accent: "#F48FB1", codec: "MP3", source: "Listen.moe",
  },
  {
    id: "radio-jp-2", name: "Retro-Ko Radio", category: "怀旧", country: "日本",
    description: "复古 / City Pop", url: "https://radio.retroko.com/listen/retroko/radio.mp3",
    accent: "#FFB86B", codec: "MP3", source: "Retro-Ko",
  },
  {
    id: "radio-jp-3", name: "SOUND UP STATION NFRS", category: "音乐", country: "日本",
    description: "日本独立音乐", url: "https://stream2.rcast.net/70945",
    accent: "#7C8CFF", codec: "MP3", source: "rCast",
  },

  // ── 韩国 ────────────────────────────────────────────────────────────────
  {
    id: "radio-kr-1", name: "Listen.moe K-Pop", category: "流行", country: "韩国",
    description: "K-Pop 24 小时不间断", url: "https://listen.moe/kpop/fallback",
    accent: "#7E57C2", codec: "MP3", source: "Listen.moe",
  },
  {
    id: "radio-kr-2", name: "REPLAY NEWS 한국어", category: "新闻", country: "韩国",
    description: "每 5 分钟韩语新闻", url: "https://replaynewskr.ice.infomaniak.ch/replaynewskr-128.mp3",
    accent: "#4FC3F7", codec: "MP3 128k", source: "Infomaniak",
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

/** 电台国家 / 地区（内置 + 在线加载共用） */
export const RADIO_COUNTRIES = ["全部", "中国", "欧美", "日本", "韩国"] as const;
