/**
 * 音乐在线 / 收音机 的共享状态（Zustand，与项目其它 store 风格一致）。
 * - 播放列表、当前曲目、播放模式
 * - 用户自定义音源（AsyncStorage 持久化，参考 any-listen「添加在线资源」）
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BUILTIN_TRACKS,
  BUILTIN_PLAYLISTS,
  BUILTIN_RADIO_STATIONS,
  MusicTrack,
  MusicPlaylist,
  RadioStation,
} from "@/constants/AudioLibrary";
import { createSourceId } from "@/constants/LiveSources";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("AudioStore");

const STORAGE_KEYS = {
  CUSTOM_TRACKS: "ztv_custom_tracks",
  CUSTOM_STATIONS: "ztv_custom_stations",
};

export type RepeatMode = "off" | "all" | "one";

interface AudioState {
  tracks: MusicTrack[];
  playlists: MusicPlaylist[];
  stations: RadioStation[];
  currentTrackId: string | null;
  currentStationId: string | null;
  activePlaylistId: string;
  repeatMode: RepeatMode;
  shuffle: boolean;
  volume: number;

  loadCustomSources: () => Promise<void>;
  addCustomTrack: (title: string, artist: string, url: string) => Promise<MusicTrack>;
  removeCustomTrack: (id: string) => Promise<void>;
  addCustomStation: (name: string, category: string, url: string) => Promise<RadioStation>;
  removeCustomStation: (id: string) => Promise<void>;
  /** 用在线搜索结果替换「在线搜索」歌单（不持久化） */
  setOnlineTracks: (tracks: MusicTrack[]) => void;
  /** 用在线电台结果替换当前在线电台列表（不持久化） */
  setOnlineStations: (stations: RadioStation[]) => void;

  setCurrentTrack: (id: string | null) => void;
  setCurrentStation: (id: string | null) => void;
  setActivePlaylist: (id: string) => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setVolume: (v: number) => void;

  /** 当前歌单下的曲目序列 */
  getPlaylistTracks: () => MusicTrack[];
  /** 按播放模式计算下一首 / 上一首 */
  getNextTrackId: () => string | null;
  getPrevTrackId: () => string | null;
}

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
};

// 模块级在线数据（不持久化）：搜索结果与在线电台
let onlineTracks: MusicTrack[] = [];
let onlineStations: RadioStation[] = [];

const isCustomTrack = (t: MusicTrack) => !BUILTIN_TRACKS.some((b) => b.id === t.id) && !onlineTracks.some((o) => o.id === t.id);
const isCustomStation = (s: RadioStation) =>
  !BUILTIN_RADIO_STATIONS.some((b) => b.id === s.id) && !onlineStations.some((o) => o.id === s.id);

/** 统一重建曲目列表：内置 + 在线搜索 + 自定义 */
const buildTracks = (custom: MusicTrack[]): MusicTrack[] => [
  ...BUILTIN_TRACKS,
  ...onlineTracks,
  ...custom,
];

/** 统一重建歌单：「全部」含所有曲目，「在线搜索」含在线结果 */
const buildPlaylists = (tracks: MusicTrack[]): MusicPlaylist[] =>
  BUILTIN_PLAYLISTS.map((p) => {
    if (p.id === "playlist-all") return { ...p, trackIds: tracks.map((t) => t.id) };
    if (p.id === "playlist-online") return { ...p, trackIds: onlineTracks.map((t) => t.id) };
    return p;
  });

/** 统一重建电台列表：内置 + 在线电台 + 自定义 */
const buildStations = (custom: RadioStation[]): RadioStation[] => [
  ...BUILTIN_RADIO_STATIONS,
  ...onlineStations,
  ...custom,
];

export const useAudioStore = create<AudioState>((set, get) => ({
  tracks: BUILTIN_TRACKS,
  playlists: BUILTIN_PLAYLISTS,
  stations: BUILTIN_RADIO_STATIONS,
  currentTrackId: BUILTIN_TRACKS[0]?.id ?? null,
  currentStationId: null,
  activePlaylistId: BUILTIN_PLAYLISTS[0]?.id ?? "playlist-all",
  repeatMode: "all",
  shuffle: false,
  volume: 1,

  loadCustomSources: async () => {
    try {
      const [rawTracks, rawStations] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_TRACKS),
        AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_STATIONS),
      ]);
      const customTracks = safeParse<MusicTrack[]>(rawTracks, []).filter((t) => t?.id && t?.url);
      const customStations = safeParse<RadioStation[]>(rawStations, []).filter((s) => s?.id && s?.url);
      const tracks = buildTracks(customTracks);
      const playlists = buildPlaylists(tracks);
      set({ tracks, playlists, stations: buildStations(customStations) });
    } catch (e) {
      logger.info("Failed to load custom audio sources:", e);
    }
  },

  addCustomTrack: async (title, artist, url) => {
    const track: MusicTrack = {
      id: createSourceId(),
      title: title.trim() || "自定义曲目",
      artist: artist.trim() || "未知艺术家",
      album: "我的音乐",
      url: url.trim(),
      accent: "#00E6A8",
      lyrics: ["—— 自定义音源，暂无歌词"],
    };
    const custom = get().tracks.filter(isCustomTrack);
    const tracks = buildTracks([...custom, track]);
    const playlists = buildPlaylists(tracks);
    set({ tracks, playlists, currentTrackId: track.id, activePlaylistId: "playlist-all" });
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.CUSTOM_TRACKS,
        JSON.stringify([...custom, track])
      );
    } catch (e) {
      logger.info("Failed to persist custom track:", e);
    }
    return track;
  },

  removeCustomTrack: async (id) => {
    if (BUILTIN_TRACKS.some((b) => b.id === id) || onlineTracks.some((o) => o.id === id)) return;
    const custom = get().tracks.filter((t) => isCustomTrack(t) && t.id !== id);
    const tracks = buildTracks(custom);
    const playlists = buildPlaylists(tracks);
    set({
      tracks,
      playlists,
      currentTrackId: get().currentTrackId === id ? tracks[0]?.id ?? null : get().currentTrackId,
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_TRACKS, JSON.stringify(custom));
    } catch { /* ignore */ }
  },

  addCustomStation: async (name, category, url) => {
    const station: RadioStation = {
      id: createSourceId(),
      name: name.trim() || "自定义电台",
      category: category.trim() || "自定义",
      description: "用户添加的网络电台",
      url: url.trim(),
      accent: "#00E6A8",
    };
    const custom = get().stations.filter(isCustomStation);
    const stations = buildStations([...custom, station]);
    set({ stations, currentStationId: station.id });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_STATIONS, JSON.stringify([...custom, station]));
    } catch (e) {
      logger.info("Failed to persist custom station:", e);
    }
    return station;
  },

  removeCustomStation: async (id) => {
    if (BUILTIN_RADIO_STATIONS.some((b) => b.id === id) || onlineStations.some((o) => o.id === id)) return;
    const custom = get().stations.filter((s) => isCustomStation(s) && s.id !== id);
    set({
      stations: buildStations(custom),
      currentStationId: get().currentStationId === id ? null : get().currentStationId,
    });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_STATIONS, JSON.stringify(custom));
    } catch { /* ignore */ }
  },

  setOnlineTracks: (results) => {
    // 先记录上一批在线结果的 id：替换后它们既不属于内置也不属于新结果，
    // 若直接沿用 isCustomTrack 会被误判为「用户自定义」并重新混入列表
    const previousOnlineIds = new Set(onlineTracks.map((t) => t.id));
    onlineTracks = results;
    const custom = get().tracks.filter(
      (t) =>
        !BUILTIN_TRACKS.some((b) => b.id === t.id) &&
        !previousOnlineIds.has(t.id) &&
        !results.some((r) => r.id === t.id)
    );
    const tracks = buildTracks(custom);
    const playlists = buildPlaylists(tracks);
    const prevCurrent = get().currentTrackId;
    const keepCurrent = !!prevCurrent && results.some((t) => t.id === prevCurrent);
    set({
      tracks,
      playlists,
      activePlaylistId: results.length ? "playlist-online" : get().activePlaylistId,
      // 若当前曲目仍在新列表中则保持播放，否则切到列表第一首
      currentTrackId: keepCurrent
        ? prevCurrent
        : results.length
        ? results[0].id
        : get().currentTrackId,
    });
  },

  setOnlineStations: (results) => {
    const previousOnlineIds = new Set(onlineStations.map((s) => s.id));
    onlineStations = results;
    const custom = get().stations.filter(
      (s) =>
        !BUILTIN_RADIO_STATIONS.some((b) => b.id === s.id) &&
        !previousOnlineIds.has(s.id) &&
        !results.some((r) => r.id === s.id)
    );
    set({ stations: buildStations(custom) });
  },

  setCurrentTrack: (id) => set({ currentTrackId: id }),
  setCurrentStation: (id) => set({ currentStationId: id }),
  setActivePlaylist: (id) => {
    const playlist = get().playlists.find((p) => p.id === id);
    const first = playlist?.trackIds?.[0] ?? null;
    set({ activePlaylistId: id, currentTrackId: first });
  },
  cycleRepeat: () =>
    set((s) => ({
      repeatMode: s.repeatMode === "off" ? "all" : s.repeatMode === "all" ? "one" : "off",
    })),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),

  getPlaylistTracks: () => {
    const { playlists, activePlaylistId, tracks } = get();
    const playlist = playlists.find((p) => p.id === activePlaylistId) ?? playlists[0];
    if (!playlist) return tracks;
    return playlist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((t): t is MusicTrack => !!t);
  },

  getNextTrackId: () => {
    const list = get().getPlaylistTracks();
    if (list.length === 0) return null;
    const idx = list.findIndex((t) => t.id === get().currentTrackId);
    if (get().shuffle) {
      if (list.length === 1) return list[0].id;
      let next = idx;
      while (next === idx) next = Math.floor(Math.random() * list.length);
      return list[next].id;
    }
    const nextIdx = idx + 1;
    if (nextIdx >= list.length) return get().repeatMode === "all" ? list[0].id : null;
    return list[nextIdx].id;
  },

  getPrevTrackId: () => {
    const list = get().getPlaylistTracks();
    if (list.length === 0) return null;
    const idx = list.findIndex((t) => t.id === get().currentTrackId);
    const prevIdx = idx <= 0 ? list.length - 1 : idx - 1;
    return list[prevIdx].id;
  },
}));
