/**
 * 音乐播放 / 收音机 的内置内容库。
 *
 * 设计参考 any-listen（跨平台私人音乐播放服务）的核心概念：
 * - 播放列表（歌单）与曲目元数据（标题 / 艺术家 / 专辑 / 封面 / 歌词）
 * - 在线音源：用户可自行添加 URL，内置示例仅用于开箱演示
 * - 歌词展示与播放控制（上一首 / 下一首 / 进度 / 循环）
 *
 * 说明：内置示例为公开演示音频流，实际可用性取决于用户网络环境；
 * 页面内提供「添加自定义音源」，可替换为任意可访问的音频地址。
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
}

/** 公开演示音频（SoundHelix 样例，常用于播放器演示） */
const SAMPLE_BASE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-";

export const BUILTIN_TRACKS: MusicTrack[] = [
  {
    id: "track-1",
    title: "晨曦微光",
    artist: "SoundHelix",
    album: "演示曲库 · 轻音乐",
    url: `${SAMPLE_BASE}1.mp3`,
    accent: "#00E6A8",
    durationLabel: "06:12",
    lyrics: [
      "晨光穿过窗棂 落在旧唱片上",
      "时间在指尖 慢慢旋转",
      "让旋律带走 昨日的匆忙",
      "此刻只需要 安静地听",
      "—— ZTV 音乐播放 · 演示歌词",
    ],
  },
  {
    id: "track-2",
    title: "城市夜行",
    artist: "SoundHelix",
    album: "演示曲库 · 电子",
    url: `${SAMPLE_BASE}2.mp3`,
    accent: "#7C8CFF",
    durationLabel: "07:05",
    lyrics: ["霓虹在窗外 流动成河", "节奏与心跳 轻轻重合", "—— ZTV 音乐播放 · 演示歌词"],
  },
  {
    id: "track-3",
    title: "远山回响",
    artist: "SoundHelix",
    album: "演示曲库 · 氛围",
    url: `${SAMPLE_BASE}3.mp3`,
    accent: "#FFB86B",
    durationLabel: "05:48",
    lyrics: ["风越过山脊 带来回声", "云影在谷底 缓慢迁徙", "—— ZTV 音乐播放 · 演示歌词"],
  },
  {
    id: "track-4",
    title: "海边的信",
    artist: "SoundHelix",
    album: "演示曲库 · 钢琴",
    url: `${SAMPLE_BASE}4.mp3`,
    accent: "#4FC3F7",
    durationLabel: "06:33",
    lyrics: ["把未说出的话 折进纸船", "潮水会替我 送到对岸", "—— ZTV 音乐播放 · 演示歌词"],
  },
  {
    id: "track-5",
    title: "星轨",
    artist: "SoundHelix",
    album: "演示曲库 · 新世纪",
    url: `${SAMPLE_BASE}5.mp3`,
    accent: "#C792EA",
    durationLabel: "06:57",
    lyrics: ["夜空写下 长长的轨迹", "我们都是 追光的人", "—— ZTV 音乐播放 · 演示歌词"],
  },
];

export const BUILTIN_PLAYLISTS: MusicPlaylist[] = [
  {
    id: "playlist-all",
    name: "全部曲目",
    description: "内置演示曲库，共 5 首",
    accent: "#00E6A8",
    trackIds: BUILTIN_TRACKS.map((t) => t.id),
  },
  {
    id: "playlist-calm",
    name: "静夜聆听",
    description: "氛围 / 钢琴 / 轻音乐",
    accent: "#4FC3F7",
    trackIds: ["track-1", "track-3", "track-4"],
  },
  {
    id: "playlist-motion",
    name: "律动时刻",
    description: "电子 / 新世纪",
    accent: "#FFB86B",
    trackIds: ["track-2", "track-5"],
  },
];

/**
 * 内置网络电台（已验证可访问的公开 Icecast 流）。
 * 实际可用性受网络环境影响，页面内支持添加自定义电台地址。
 */
export const BUILTIN_RADIO_STATIONS: RadioStation[] = [
  {
    id: "radio-1",
    name: "NPO Radio 2",
    category: "音乐",
    description: "流行 / 经典金曲",
    url: "https://icecast.omroep.nl/radio2-bb-mp3",
    accent: "#00E6A8",
  },
  {
    id: "radio-2",
    name: "NPO Klassiek",
    category: "古典",
    description: "古典音乐 / 音乐会",
    url: "https://icecast.omroep.nl/radio4-bb-mp3",
    accent: "#7C8CFF",
  },
  {
    id: "radio-3",
    name: "NPO Radio 5",
    category: "怀旧",
    description: "怀旧金曲 / 轻松聆听",
    url: "https://icecast.omroep.nl/radio5-bb-mp3",
    accent: "#FFB86B",
  },
  {
    id: "radio-4",
    name: "NPO FunX",
    category: "节奏",
    description: "都市节奏 / 嘻哈",
    url: "https://icecast.omroep.nl/funx-bb-mp3",
    accent: "#C792EA",
  },
];

export const RADIO_CATEGORIES = ["全部", "音乐", "古典", "怀旧", "节奏"];
