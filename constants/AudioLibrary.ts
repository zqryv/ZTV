/**
 * 音乐播放 / 收音机 的内置内容库。
 *
 * 设计参考 any-listen（跨平台私人音乐播放服务）的核心概念：
 * - 播放列表（歌单）与曲目元数据（标题 / 艺术家 / 专辑 / 封面 / 歌词）
 * - 在线音源：内置可直连的公开音频 + 用户自定义 URL + 在线搜索结果
 * - 音乐按「风格分类」与「国家/地区」组织；电台同样支持分类与分国
 *
 * 说明：内置曲目为公开演示音频流（SoundHelix，已验证 1-16 首可用），
 * 电台为公开可直连流；实际可用性受网络环境影响，页面内提供自定义入口。
 */

/** 单首曲目 */
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  /** 音频地址（mp3 / m3u8 / 网络流均可） */
  url: string;
  /** 封面主色（用渐变占位，避免外链图片加载失败） */
  accent: string;
  /** 歌词行 */
  lyrics?: string[];
  durationLabel?: string;
  /** 音乐风格分类（如 流行 / 古典 / 电子 / 轻音乐） */
  genre?: string;
  /** 国家 / 地区（如 中国 / 欧美 / 日本 / 韩国） */
  country?: string;
  /** 封面图地址（在线搜索结果可能带封面） */
  cover?: string;
  /** 发行年份 */
  year?: string;
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
  accent: string;
  /** 国家 / 地区 */
  country?: string;
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
export const MUSIC_COUNTRIES = [
  "全部",
  "中国",
  "欧美",
  "日本",
  "韩国",
] as const;

/** 公开演示音频（SoundHelix 样例，1-16 首已验证可访问） */
const SAMPLE_BASE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-";

/**
 * 内置在线曲库：16 首公开可直连音频，按风格与国家/地区归类。
 * 这些是纯器乐演示曲，国家标签用于演示「分国」浏览；
 * 真实最新音乐请通过音乐页的「搜索最新音乐」（iTunes）获取。
 */
export const BUILTIN_TRACKS: MusicTrack[] = [
  {
    id: "track-1", title: "晨曦微光", artist: "SoundHelix", album: "轻音乐精选",
    url: `${SAMPLE_BASE}1.mp3`, accent: "#00E6A8", durationLabel: "06:12",
    genre: "轻音乐", country: "中国",
    lyrics: ["晨光穿过窗棂 落在旧唱片上", "时间在指尖 慢慢旋转", "让旋律带走 昨日的匆忙", "此刻只需要 安静地听", "—— ZTV 音乐播放"],
  },
  {
    id: "track-2", title: "城市夜行", artist: "SoundHelix", album: "电子节拍",
    url: `${SAMPLE_BASE}2.mp3`, accent: "#7C8CFF", durationLabel: "07:05",
    genre: "电子", country: "欧美",
    lyrics: ["霓虹在窗外 流动成河", "节奏与心跳 轻轻重合", "—— ZTV 音乐播放"],
  },
  {
    id: "track-3", title: "远山回响", artist: "SoundHelix", album: "氛围之选",
    url: `${SAMPLE_BASE}3.mp3`, accent: "#FFB86B", durationLabel: "05:48",
    genre: "民谣", country: "中国",
    lyrics: ["风越过山脊 带来回声", "云影在谷底 缓慢迁徙", "—— ZTV 音乐播放"],
  },
  {
    id: "track-4", title: "海边的信", artist: "SoundHelix", album: "钢琴曲集",
    url: `${SAMPLE_BASE}4.mp3`, accent: "#4FC3F7", durationLabel: "06:33",
    genre: "轻音乐", country: "日本",
    lyrics: ["把未说出的话 折进纸船", "潮水会替我 送到对岸", "—— ZTV 音乐播放"],
  },
  {
    id: "track-5", title: "星轨", artist: "SoundHelix", album: "新世纪",
    url: `${SAMPLE_BASE}5.mp3`, accent: "#C792EA", durationLabel: "06:57",
    genre: "电子", country: "欧美",
    lyrics: ["夜空写下 长长的轨迹", "我们都是 追光的人", "—— ZTV 音乐播放"],
  },
  {
    id: "track-6", title: "夏日序曲", artist: "SoundHelix", album: "流行轻音",
    url: `${SAMPLE_BASE}6.mp3`, accent: "#00E6A8", durationLabel: "05:24", genre: "流行", country: "中国",
    lyrics: ["蝉声唤醒 夏日的序曲", "—— ZTV 音乐播放"],
  },
  {
    id: "track-7", title: "午夜旋律", artist: "SoundHelix", album: "爵士时光",
    url: `${SAMPLE_BASE}7.mp3`, accent: "#FF8A65", durationLabel: "06:02", genre: "爵士", country: "欧美",
    lyrics: ["午夜的旋律 轻轻摇晃", "—— ZTV 音乐播放"],
  },
  {
    id: "track-8", title: "摇滚之心", artist: "SoundHelix", album: "摇滚现场",
    url: `${SAMPLE_BASE}8.mp3`, accent: "#EF5350", durationLabel: "05:41", genre: "摇滚", country: "欧美",
    lyrics: ["心跳跟着鼓点 一起燃烧", "—— ZTV 音乐播放"],
  },
  {
    id: "track-9", title: "樱花雨", artist: "SoundHelix", album: "和风物语",
    url: `${SAMPLE_BASE}9.mp3`, accent: "#F48FB1", durationLabel: "06:18", genre: "轻音乐", country: "日本",
    lyrics: ["樱花落下的季节", "—— ZTV 音乐播放"],
  },
  {
    id: "track-10", title: "首尔夜色", artist: "SoundHelix", album: "韩流节拍",
    url: `${SAMPLE_BASE}10.mp3`, accent: "#7E57C2", durationLabel: "05:56", genre: "流行", country: "韩国",
    lyrics: ["霓虹闪烁的街角", "—— ZTV 音乐播放"],
  },
  {
    id: "track-11", title: "弦上月光", artist: "SoundHelix", album: "古典回廊",
    url: `${SAMPLE_BASE}11.mp3`, accent: "#FFD54F", durationLabel: "07:12", genre: "古典", country: "欧美",
    lyrics: ["月光流淌在琴弦上", "—— ZTV 音乐播放"],
  },
  {
    id: "track-12", title: "节奏风暴", artist: "SoundHelix", album: "电子节拍",
    url: `${SAMPLE_BASE}12.mp3`, accent: "#26C6DA", durationLabel: "06:29", genre: "说唱", country: "欧美",
    lyrics: ["跟上这节奏 不要停", "—— ZTV 音乐播放"],
  },
  {
    id: "track-13", title: "江南烟雨", artist: "SoundHelix", album: "国风雅集",
    url: `${SAMPLE_BASE}13.mp3`, accent: "#66BB6A", durationLabel: "06:45", genre: "民谣", country: "中国",
    lyrics: ["烟雨朦胧了江南", "—— ZTV 音乐播放"],
  },
  {
    id: "track-14", title: "电光石火", artist: "SoundHelix", album: "摇滚现场",
    url: `${SAMPLE_BASE}14.mp3`, accent: "#FF7043", durationLabel: "05:33", genre: "摇滚", country: "日本",
    lyrics: ["电光石火的一瞬间", "—— ZTV 音乐播放"],
  },
  {
    id: "track-15", title: "深夜电台", artist: "SoundHelix", album: "爵士时光",
    url: `${SAMPLE_BASE}15.mp3`, accent: "#AB47BC", durationLabel: "06:51", genre: "爵士", country: "韩国",
    lyrics: ["深夜电台 陪你入眠", "—— ZTV 音乐播放"],
  },
  {
    id: "track-16", title: "梦的终点", artist: "SoundHelix", album: "新世纪",
    url: `${SAMPLE_BASE}16.mp3`, accent: "#29B6F6", durationLabel: "07:03", genre: "古典", country: "中国",
    lyrics: ["在梦的终点 我们重逢", "—— ZTV 音乐播放"],
  },
];

/** 动态歌单：内置曲目 + 在线搜索结果各自成单，具体 trackIds 由 store 维护 */
export const BUILTIN_PLAYLISTS: MusicPlaylist[] = [
  {
    id: "playlist-all",
    name: "全部曲目",
    description: "内置在线曲库，共 16 首",
    accent: "#00E6A8",
    trackIds: BUILTIN_TRACKS.map((t) => t.id),
  },
  {
    id: "playlist-online",
    name: "在线搜索",
    description: "搜索最新音乐的结果",
    accent: "#7C8CFF",
    trackIds: [],
  },
  {
    id: "playlist-calm",
    name: "静夜聆听",
    description: "氛围 / 钢琴 / 轻音乐",
    accent: "#4FC3F7",
    trackIds: ["track-1", "track-3", "track-4", "track-9", "track-16"],
  },
  {
    id: "playlist-motion",
    name: "律动时刻",
    description: "电子 / 流行 / 摇滚",
    accent: "#FFB86B",
    trackIds: ["track-2", "track-5", "track-8", "track-10", "track-12", "track-14"],
  },
];

/**
 * 内置网络电台（公开可直连流，已验证），按分类与国家/地区组织。
 * 更多电台可在收音机页通过 radio-browser 在线加载，或自行添加。
 */
export const BUILTIN_RADIO_STATIONS: RadioStation[] = [
  // 荷兰 NPO（稳定，已验证）
  {
    id: "radio-1", name: "NPO Radio 2", category: "流行", country: "欧美",
    description: "流行 / 经典金曲", url: "https://icecast.omroep.nl/radio2-bb-mp3", accent: "#00E6A8",
  },
  {
    id: "radio-2", name: "NPO Klassiek", category: "古典", country: "欧美",
    description: "古典音乐 / 音乐会", url: "https://icecast.omroep.nl/radio4-bb-mp3", accent: "#7C8CFF",
  },
  {
    id: "radio-3", name: "NPO Radio 5", category: "怀旧", country: "欧美",
    description: "怀旧金曲 / 轻松聆听", url: "https://icecast.omroep.nl/radio5-bb-mp3", accent: "#FFB86B",
  },
  {
    id: "radio-4", name: "NPO FunX", category: "节奏", country: "欧美",
    description: "都市节奏 / 嘻哈", url: "https://icecast.omroep.nl/funx-bb-mp3", accent: "#C792EA",
  },
  {
    id: "radio-5", name: "NPO Radio 1", category: "新闻", country: "欧美",
    description: "新闻 / 时事", url: "https://icecast.omroep.nl/radio1-bb-mp3", accent: "#4FC3F7",
  },
  {
    id: "radio-6", name: "NPO 3FM", category: "流行", country: "欧美",
    description: "年轻人流行音乐", url: "https://icecast.omroep.nl/3fm-bb-mp3", accent: "#F48FB1",
  },
  // Radio Paradise（已验证 206）
  {
    id: "radio-7", name: "Radio Paradise", category: "流行", country: "欧美",
    description: "多元音乐（MP3 128k）", url: "https://stream.radioparadise.com/mp3-128", accent: "#66BB6A",
  },
  {
    id: "radio-8", name: "Radio Paradise AAC", category: "古典", country: "欧美",
    description: "多元音乐（AAC 128k）", url: "https://stream.radioparadise.com/aac-128", accent: "#29B6F6",
  },
];

export const RADIO_CATEGORIES = ["全部", "流行", "古典", "怀旧", "节奏", "新闻"] as const;

/** 电台国家 / 地区（内置 + 在线加载共用） */
export const RADIO_COUNTRIES = ["全部", "中国", "欧美", "日本", "韩国"] as const;
