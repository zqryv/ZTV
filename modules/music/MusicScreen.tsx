/**
 * 音乐在线页（分类「音乐在线」，v2.3.0 按「3 界面 × 4 设备」设计稿收紧布局）。
 *
 * - 宽屏：左栏约 38~40% 为「正在播放」卡（封面按栏宽推导，不再撑满整屏）；
 *   右栏为「发现音乐」——音源 / 风格 / 地区 / 歌单胶囊 + 曲目网格 + 精选歌单；
 * - 手机：沉浸式单列播放器，搜索与筛选可折叠，避免一屏堆满控件；
 * - 全部尺寸来自 useCompactLayout，与搜索 / 收音机共用同一标尺。
 *
 * 功能与数据接口零改动：多音源聚合与三级降级、常驻可输入搜索框 + 屏幕键盘、
 * 中文热词、曲目元数据 / 封面 / 歌词 / 进度 seek / 循环 / 随机 / 音量、
 * 自定义音源增删、useFocusEffect 失焦停止与资源释放。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Music2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Repeat1,
  Shuffle,
  Plus,
  Volume2,
  ListMusic,
  Trash2,
  X,
  Search,
  Globe,
  Square,
  RefreshCw,
  MoreHorizontal,
  Mic2,
  Disc3,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import { SearchKeyboard } from "@/components/SearchKeyboard";
import { SearchInput } from "@/components/SearchInput";
import { moduleManager } from "@/modules/ModuleManager";
import { loadMusicCore, recordMusicFailure, restoreMusicQuery } from "./musicCore";
import {
  EMPTY_IME,
  ImeState,
  pushLetter,
  backspaceIme,
  deleteLastCodePoint,
  selectCandidate,
  commitComposition,
  clearIme,
} from "@/utils/pinyinIme";

interface MusicModuleConfig {
  quickTerms: string[];
  sourceSwitchAutoSearch: boolean;
  candidateLimit: number;
}
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useCompactLayout, CompactMetrics } from "@/utils/DesignTokens";
import { useSafeTVEventHandler } from "@/hooks/useSafeTVEventHandler";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { useAudioStore } from "@/stores/audioStore";
import { audioPlayer, INITIAL_AUDIO_STATE, AudioPlaybackState } from "@/services/audioPlayer";
import {
  MusicTrack,
  MusicSourceId,
  MUSIC_GENRES,
  MUSIC_COUNTRIES,
  MUSIC_SOURCES,
  MUSIC_QUICK_TERMS,
} from "@/constants/AudioLibrary";
import {
  searchLatestMusic,
  browseMusicByGenre,
  fetchMusicChannels,
} from "@/services/onlineMusic";

const formatTime = (ms: number) => {
  if (!ms || ms < 0) return "00:00";
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

export default function MusicScreen() {
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { spacing } = responsiveConfig;
  const metrics = useCompactLayout();
  const { isWide, isTVLike } = metrics;
  const router = useRouter();
  // 按扣除侧栏 / 顶栏后的真实可用宽度推导右栏，避免 Web 大屏被 200px 侧栏挤压
  const rightWidth = isWide
    ? Math.max(240, Math.round(metrics.contentWidth - metrics.leftWidth - metrics.gap * 1.5))
    : Math.max(240, metrics.contentWidth);
  const gridColumns = isWide ? Math.min(3, metrics.columns) : 1;

  const {
    tracks,
    playlists,
    currentTrackId,
    activePlaylistId,
    repeatMode,
    shuffle,
    volume,
    loadCustomSources,
    addCustomTrack,
    removeCustomTrack,
    setCurrentTrack,
    setActivePlaylist,
    cycleRepeat,
    toggleShuffle,
    setVolume,
    getPlaylistTracks,
    getNextTrackId,
    getPrevTrackId,
    setOnlineTracks,
  } = useAudioStore();

  const [playback, setPlayback] = useState<AudioPlaybackState>(INITIAL_AUDIO_STATE);
  const [autoNext, setAutoNext] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);

  const [sourceMode, setSourceMode] = useState<MusicSourceId>("latest");
  const [searchText, setSearchText] = useState("");
  const [genre, setGenre] = useState<string>("全部");
  const [country, setCountry] = useState<string>("全部");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(isWide);
  // 四工具：列表 / 歌词 / 音量 / 刷新，均为真实功能开关
  const [listVisible, setListVisible] = useState(true);
  const [lyricsVisible, setLyricsVisible] = useState(false);
  const [volumeVisible, setVolumeVisible] = useState(false);
  const bootstrapped = useRef(false);
  const searchRef = useRef<TextInput>(null);
  /** v2.5.0：中文输入组合区 + 模块资源包（曲库配置可独立升级） */
  const [ime, setIme] = useState<ImeState>(EMPTY_IME);
  const [imeEnabled, setImeEnabled] = useState(true);
  const [musicConfig, setMusicConfig] = useState<MusicModuleConfig | null>(null);
  const candidateLimit = musicConfig?.candidateLimit ?? 8;
  useEffect(() => {
    void moduleManager.getConfig<MusicModuleConfig>("music").then(setMusicConfig);
    // Solara 式无感记忆：重进页面恢复上次检索词
    void restoreMusicQuery().then((query) => {
      if (query) setSearchText(query);
    });
  }, []);

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) ?? null,
    [tracks, currentTrackId]
  );

  const onlineList = useMemo(
    () => getPlaylistTracks(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getPlaylistTracks, tracks, activePlaylistId]
  );

  /** 内置曲库：按风格 / 地区 / 关键词本地筛选，不依赖网络 */
  const libraryList = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return tracks.filter((t) => {
      if (genre !== "全部" && t.genre !== genre) return false;
      if (country !== "全部" && t.country !== country) return false;
      if (q && !`${t.title} ${t.artist} ${t.album || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tracks, genre, country, searchText]);

  const displayTracks = sourceMode === "builtin" ? libraryList : onlineList;

  useEffect(() => {
    void loadCustomSources();
  }, [loadCustomSources]);

  /**
   * 关键修复：Stack 导航中离开页面不会卸载组件，只在 unmount 时清理会导致声音继续。
   * useFocusEffect 在失焦（返回、切页、跳到设置）时立即停止并释放播放器。
   */
  useFocusEffect(
    useCallback(() => {
      audioPlayer.setListener(setPlayback);
      return () => {
        audioPlayer.setListener(null);
        void audioPlayer.stop();
        setPlayback(INITIAL_AUDIO_STATE);
      };
    }, [])
  );

  /** 统一加载音源，带「音源 A → 音源 B → 内置曲库」多级降级 */
  const loadSource = useCallback(
    async (mode: MusicSourceId, kw: string, g: string, c: string, quiet = false) => {
      if (mode === "builtin") {
        setOnlineTracks([]);
        setActivePlaylist("playlist-all");
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // v2.5.0：模块核心提供有效结果缓存、榜单雷达去重注入与请求熔断
        const core = await loadMusicCore(mode, kw, g, c);
        const results = core.tracks;
        if (results.length === 0) throw new Error("empty result");
        setOnlineTracks(results);
        void audioPlayer.pause();
        if (!quiet) {
          Toast.show({ type: "success", text1: `已加载 ${results.length} 项${core.fromCache ? "（缓存）" : ""}` });
        }
      } catch {
        recordMusicFailure();
        // 主音源不可用时：先直连 browseMusicByGenre，再切音乐电台，最后内置曲库
        if (mode === "latest") {
          try {
            const direct = await browseMusicByGenre(g, c, 40);
            if (direct.length) {
              setOnlineTracks(direct);
              void audioPlayer.pause();
              return;
            }
          } catch { /* 继续下一级降级 */ }
          try {
            const fallback = await fetchMusicChannels(c, g, 40, kw);
            if (fallback.length) {
              setOnlineTracks(fallback);
              setSourceMode("channels");
              setError("Apple 音乐服务暂不可用，已自动切换到音乐电台");
              void audioPlayer.pause();
              return;
            }
          } catch { /* 继续降级到内置曲库 */ }
        }
        setOnlineTracks([]);
        setActivePlaylist("playlist-all");
        setSourceMode("builtin");
        setError("在线音源暂不可用，已切换到内置曲库（仍可正常播放）");
      } finally {
        setLoading(false);
      }
    },
    [setOnlineTracks, setActivePlaylist]
  );

  // 首次进入自动加载「最新单曲」，无需先输入关键词即可浏览和播放
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void loadSource("latest", "", "全部", "全部", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTrack = useCallback(
    async (trackId: string | null) => {
      if (!trackId) return;
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      setCurrentTrack(trackId);
      setAutoNext(true);
      await audioPlayer.play(track.url, track.fallbackUrls);
      await audioPlayer.setVolume(volume);
    },
    [tracks, setCurrentTrack, volume]
  );

  const handleNext = useCallback(async () => {
    const next = getNextTrackId();
    if (next) await startTrack(next);
    else setPlayback((p) => ({ ...p, isPlaying: false }));
  }, [getNextTrackId, startTrack]);

  const handlePrev = useCallback(async () => {
    if (playback.positionMs > 3000) {
      await audioPlayer.seekTo(0);
      return;
    }
    const prev = getPrevTrackId();
    if (prev) await startTrack(prev);
  }, [playback.positionMs, getPrevTrackId, startTrack]);

  /** 明确的「停止」：停止播放 + 卸载 Sound + 复位音频会话 */
  const handleStop = useCallback(async () => {
    setAutoNext(false);
    await audioPlayer.stop();
  }, []);

  // 播完自动下一首 / 单曲循环
  useEffect(() => {
    if (!playback.didFinish || !autoNext) return;
    if (repeatMode === "one" && currentTrack) {
      void audioPlayer.play(currentTrack.url, currentTrack.fallbackUrls);
      return;
    }
    const next = getNextTrackId();
    if (next) void startTrack(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.didFinish]);

  const handleToggle = async () => {
    if (!currentTrack) {
      await startTrack(displayTracks[0]?.id ?? null);
      return;
    }
    if (!audioPlayer.hasActiveSound()) {
      await startTrack(currentTrack.id);
      return;
    }
    await audioPlayer.toggle();
  };

  const handleSearch = useCallback(() => {
    // 搜索前把未选候选的拼音串作为英文字母提交，避免输入丢失
    let term = searchText;
    if (ime.composing) {
      const committed = commitComposition(ime);
      term = `${term}${committed.text}`.slice(0, 40);
      setSearchText(term);
      setIme(committed.state);
    }
    if (sourceMode === "builtin") {
      Toast.show({ type: "info", text1: "已在内置曲库中筛选" });
      return;
    }
    void loadSource(sourceMode, term.trim(), genre, country);
  }, [sourceMode, searchText, ime, genre, country, loadSource]);

  const handleQuickTerm = useCallback(
    (term: string) => {
      setSearchText(term);
      const mode: MusicSourceId = sourceMode === "builtin" ? "latest" : sourceMode;
      if (mode !== sourceMode) setSourceMode(mode);
      void loadSource(mode, term, genre, country);
    },
    [sourceMode, genre, country, loadSource]
  );

  const switchSource = useCallback(
    (mode: MusicSourceId) => {
      setSourceMode(mode);
      setSearchText("");
      void loadSource(mode, "", genre, country);
    },
    [genre, country, loadSource]
  );

  const switchFilter = useCallback(
    (g: string, c: string) => {
      setGenre(g);
      setCountry(c);
      if (sourceMode !== "builtin") {
        void loadSource(sourceMode, searchText.trim(), g, c, true);
      }
    },
    [sourceMode, searchText, loadSource]
  );

  /** 展开「发现音乐」面板并把焦点交给搜索框，保证搜索始终可输入 */
  const openDiscover = useCallback(() => {
    setDiscoverOpen(true);
    searchRef.current?.focus();
  }, []);

  /**
   * 大屏遥控器 / 键盘：方向键与 OK 统一交给原生 / DOM 焦点引擎，
   * 只保留媒体播放键与返回键，避免全局事件与 onPress 双重消费
   * （旧实现 up/down 改 focusIndex、select 直接 toggle，导致「按钮无法选中或操作」）。
   */
  const handleTVEvent = useCallback(
    (event: any) => {
      const type = event?.eventType;
      if (type === "back") {
        if (addModalVisible) {
          setAddModalVisible(false);
          return;
        }
        if (keyboardVisible) {
          setKeyboardVisible(false);
          return;
        }
        router.back();
        return;
      }
      if (keyboardVisible || addModalVisible) return;
      if (type === "playPause") void audioPlayer.toggle();
    },
    [keyboardVisible, addModalVisible, router]
  );
  useSafeTVEventHandler(handleTVEvent);

  const handleAddSource = async () => {
    const raw = newUrl.trim();
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
      Toast.show({ type: "error", text1: "请填写有效的音频地址" });
      return;
    }
    const track = await addCustomTrack(newTitle, newArtist, url);
    setAddModalVisible(false);
    setNewTitle("");
    setNewArtist("");
    setNewUrl("");
    setSourceMode("builtin");
    setCurrentTrack(track.id);
    setAutoNext(true);
    await audioPlayer.play(track.url, track.fallbackUrls);
    await audioPlayer.setVolume(volume);
    Toast.show({ type: "success", text1: "已添加，正在播放" });
  };

  const handleDelete = (track: MusicTrack) => {
    Alert.alert("删除曲目", `确定从「我的音乐」移除「${track.title}」吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => removeCustomTrack(track.id) },
    ]);
  };

  const dyn = useMemo(() => createStyles(metrics, spacing, rightWidth), [metrics, spacing, rightWidth]);
  const progress = playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0;
  const progressPercent = Math.min(100, Math.max(0, progress * 100));
  const stateLabel = playback.isLoading
    ? "连接中"
    : playback.isPlaying
    ? "正在播放"
    : currentTrack
    ? "已暂停"
    : "待播放";
  const sourceDescription = MUSIC_SOURCES.find((s) => s.id === sourceMode)?.description ?? "";
  const accent = currentTrack?.accent ?? Colors.brand.accent;
  const coverSize = metrics.coverSize;

  const renderTrack = ({ item, index }: { item: MusicTrack; index: number }) => {
    const isCurrent = item.id === currentTrackId;
    const isCustom = !item.id.startsWith("track-") && !item.id.startsWith("itunes-") &&
      !item.id.startsWith("channel-") && !item.id.startsWith("music-live-");
    const meta = [item.artist, item.genre, item.country, item.source].filter(Boolean).join(" · ");
    const isGrid = gridColumns > 1;

    const artwork = item.cover ? (
      <Image source={{ uri: item.cover }} style={isGrid ? dyn.gridCover : dyn.trackCover} resizeMode="cover" />
    ) : (
      <LinearGradient colors={[item.accent, `${item.accent}55`]} style={isGrid ? dyn.gridCover : dyn.trackCover}>
        <Music2 size={isGrid ? metrics.body + 8 : metrics.body + 2} color="#fff" />
      </LinearGradient>
    );

    if (isGrid) {
      return (
        <TouchableOpacity
          style={[
            dyn.gridCard,
            isCurrent && dyn.gridCardActive,
            isTVLike && focusIndex === index && dyn.gridCardFocused,
          ]}
          onPress={() => void startTrack(item.id)}
          onFocus={() => setFocusIndex(index)}
          hasTVPreferredFocus={isTVLike && index === 0}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          activeOpacity={0.75}
        >
          {artwork}
          <ThemedText style={[dyn.gridTitle, isCurrent && dyn.gridTitleActive]} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <ThemedText style={dyn.gridMeta} numberOfLines={1}>{meta || item.album || "我的音乐"}</ThemedText>
          {isCustom && (
            <TouchableOpacity onPress={() => handleDelete(item)} style={dyn.gridDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Trash2 size={13} color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[
          dyn.trackRow,
          isCurrent && dyn.trackRowActive,
          isTVLike && focusIndex === index && dyn.trackRowFocused,
        ]}
        onPress={() => void startTrack(item.id)}
        onFocus={() => setFocusIndex(index)}
        hasTVPreferredFocus={isTVLike && index === 0}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        activeOpacity={0.7}
      >
        {artwork}
        <View style={dyn.trackInfo}>
          <ThemedText style={[dyn.trackTitle, isCurrent && dyn.trackTitleActive]} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <ThemedText style={dyn.trackArtist} numberOfLines={1}>
            {meta || item.album || "我的音乐"}
          </ThemedText>
        </View>
        {item.isLive ? (
          <View style={dyn.liveChip}><ThemedText style={dyn.liveChipText}>LIVE</ThemedText></View>
        ) : (
          <ThemedText style={dyn.trackDuration}>{item.durationLabel ?? "--:--"}</ThemedText>
        )}
        {isCustom && (
          <TouchableOpacity onPress={() => handleDelete(item)} style={dyn.deleteBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Trash2 size={14} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const emptyText = loading
    ? "正在加载在线音源…"
    : sourceMode === "builtin"
    ? "该筛选条件下暂无曲目"
    : "暂无在线内容，试试切换音源或关键词";

  // ── 页头：标题「音乐在线」+ 常驻搜索框 + 圆形操作 ──────────────────────
  const pageHeader = (
    <View style={dyn.pageHeader}>
      <View style={dyn.pageTitleRow}>
        <LinearGradient colors={["#00E6A8", "#00B884"]} style={dyn.badge}>
          <Music2 size={metrics.body + 4} color={Colors.brand.onAccent} />
        </LinearGradient>
        <View style={dyn.pageTitleText}>
          <ThemedText style={dyn.pageTitle}>音乐在线</ThemedText>
          <ThemedText style={dyn.pageSubtitle} numberOfLines={1}>
            ZTV MUSIC · {sourceDescription}
          </ThemedText>
        </View>
      </View>
      <View style={dyn.headerActions}>
        <TouchableOpacity
          style={dyn.roundButton}
          onPress={discoverOpen ? () => setDiscoverOpen(false) : openDiscover}
          accessibilityLabel={discoverOpen ? "收起发现音乐" : "展开发现音乐"}
          activeOpacity={0.75}
        >
          <MoreHorizontal size={metrics.body + 4} color={Colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[dyn.roundButton, dyn.roundButtonAccent]}
          onPress={() => setAddModalVisible(true)}
          accessibilityLabel="添加音源"
          activeOpacity={0.75}
        >
          <Plus size={metrics.body + 4} color={Colors.brand.onAccent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  /** v2.5.0 中文键盘：字母进拼音组合区，删除先退拼音再退正文 */
  const handleKeyboardKey = (key: string) => {
    if (!imeEnabled || !/^[a-zA-Z]$/.test(key)) {
      const pending = imeEnabled && ime.composing ? commitComposition(ime).text : "";
      setSearchText((prev) => `${prev}${pending}${key}`.slice(0, 40));
      setIme(clearIme());
      return;
    }
    setIme((prev) => pushLetter(prev, key, true, candidateLimit));
  };
  const handleKeyboardDelete = () => {
    const { state, removeText } = backspaceIme(ime, candidateLimit);
    setIme(state);
    if (removeText) setSearchText((prev) => deleteLastCodePoint(prev));
  };
  const handleKeyboardClear = () => {
    setSearchText("");
    setIme(clearIme());
  };
  const handleSelectCandidate = (index: number) => {
    const { state, text } = selectCandidate(ime, index);
    if (text) setSearchText((prev) => `${prev}${text}`.slice(0, 40));
    setIme(state);
  };
  const handleCommitComposition = () => {
    const { state, text } = commitComposition(ime);
    if (text) setSearchText((prev) => `${prev}${text}`.slice(0, 40));
    setIme(state);
  };

  // ── 常驻搜索栏：统一可聚焦组件，修复 TV / 大屏上「搜索框无法选中」 ───────
  const searchRow = (
    <View style={dyn.searchRow}>
      <SearchInput
        inputRef={searchRef}
        value={searchText}
        onChangeText={(text) => {
          setSearchText(text);
          setIme(clearIme());
        }}
        onSubmit={handleSearch}
        onClear={handleKeyboardClear}
        composing={ime.composing}
        placeholder="搜索歌曲 / 歌手（支持拼音中文）"
        style={{ flex: 1 }}
      />
      <StyledButton
        text="键盘"
        variant={keyboardVisible ? "primary" : "default"}
        onPress={() => setKeyboardVisible((v) => !v)}
        style={dyn.smallButton}
        textStyle={dyn.pillText}
      />
      <StyledButton
        text={loading ? "…" : "搜索"}
        variant="primary"
        onPress={handleSearch}
        disabled={loading}
        style={dyn.smallButton}
        textStyle={dyn.pillText}
      />
    </View>
  );

  const keyboard = keyboardVisible ? (
    <SearchKeyboard
      visible
      panelWidth={rightWidth}
      title="音乐搜索键盘"
      hint="拼音选中文歌手 · 也可点热词一键搜索"
      quickTerms={musicConfig?.quickTerms ?? MUSIC_QUICK_TERMS}
      onQuickTerm={handleQuickTerm}
      imeEnabled={imeEnabled}
      onToggleIme={() => {
        setImeEnabled((value) => !value);
        setIme(clearIme());
      }}
      composing={ime.composing}
      candidates={ime.candidates}
      onSelectCandidate={handleSelectCandidate}
      onCommitComposition={handleCommitComposition}
      onKeyPress={handleKeyboardKey}
      onDelete={handleKeyboardDelete}
      onClear={handleKeyboardClear}
      onSearch={handleSearch}
      onClose={() => setKeyboardVisible(false)}
    />
  ) : null;

  const errorBanner = error ? (
    <View style={dyn.errorBanner}>
      <RefreshCw size={12} color="#FFB86B" />
      <ThemedText style={dyn.errorBannerText} numberOfLines={2}>{error}</ThemedText>
    </View>
  ) : null;

  // ── 左栏：正在播放（紧凑） ─────────────────────────────────────────────
  const hero = (
    <LinearGradient
      colors={[`${accent}2E`, `${accent}0D`, Colors.surface.base]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={dyn.heroBackdrop}
    >
      <View style={[
        dyn.coverGlow,
        {
          width: coverSize * 1.2,
          height: coverSize * 1.2,
          borderRadius: coverSize * 0.6,
          marginLeft: -coverSize * 0.6,
          backgroundColor: `${accent}26`,
        },
      ]} />

      <View style={dyn.heroTopRow}>
        <View style={dyn.stateBadge}>
          <View style={[dyn.stateDot, { backgroundColor: playback.isPlaying ? Colors.brand.accent : Colors.text.disabled }]} />
          <ThemedText style={dyn.stateText}>{stateLabel}</ThemedText>
        </View>
        <ThemedText style={dyn.heroSource} numberOfLines={1}>
          {currentTrack?.source ?? "ZTV MUSIC"}
        </ThemedText>
      </View>

      {currentTrack?.cover ? (
        <Image
          source={{ uri: currentTrack.cover }}
          style={[dyn.heroCover, { width: coverSize, height: coverSize, borderRadius: Math.round(coverSize * 0.09) }]}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={[accent, `${accent}55`, Colors.surface.raised]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[dyn.heroCover, { width: coverSize, height: coverSize, borderRadius: Math.round(coverSize * 0.09) }]}
        >
          <Music2 size={Math.round(coverSize * 0.26)} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      )}

      <View style={dyn.nowRow}>
        <View style={dyn.nowText}>
          <ThemedText style={dyn.nowTitle} numberOfLines={1}>{currentTrack?.title ?? "选择一首曲目"}</ThemedText>
          <ThemedText style={dyn.nowArtist} numberOfLines={1}>
            {currentTrack ? `${currentTrack.artist} · ${currentTrack.album ?? ""}` : "点击右侧曲目即可播放"}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => void handleStop()} style={dyn.stopRound} accessibilityLabel="停止播放" activeOpacity={0.75}>
          <Square size={14} color={Colors.brand.accent} />
        </TouchableOpacity>
      </View>

      {currentTrack?.isLive ? (
        <View style={dyn.liveRow}>
          <View style={dyn.liveDot} />
          <ThemedText style={dyn.liveRowText}>LIVE · 连续音乐流，进度不可用</ThemedText>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={dyn.progressTrack}
            activeOpacity={1}
            onLayout={(e) => setProgressWidth(e.nativeEvent.layout.width)}
            onPress={(e) => {
              if (!playback.durationMs || progressWidth <= 0) return;
              const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / progressWidth));
              void audioPlayer.seekTo(ratio * playback.durationMs);
            }}
          >
            <View style={[dyn.progressFill, { width: `${progressPercent}%` }]} />
            <View style={[dyn.progressKnob, { left: `${progressPercent}%` }]} />
          </TouchableOpacity>
          <View style={dyn.timeRow}>
            <ThemedText style={dyn.timeText}>{formatTime(playback.positionMs)}</ThemedText>
            <ThemedText style={dyn.timeText}>
              {playback.durationMs ? formatTime(playback.durationMs) : currentTrack?.durationLabel ?? "--:--"}
            </ThemedText>
          </View>
        </>
      )}

      {/* 五键控制：随机 / 上一首 / 播放 / 下一首 / 循环 */}
      <View style={dyn.controls}>
        <TouchableOpacity onPress={toggleShuffle} style={dyn.ctrlSide} accessibilityLabel="随机播放" activeOpacity={0.75}>
          <Shuffle size={metrics.body + 5} color={shuffle ? Colors.brand.accent : Colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void handlePrev()} style={dyn.ctrlBtn} accessibilityLabel="上一首" activeOpacity={0.75}>
          <SkipBack size={metrics.body + 8} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={dyn.playBtn} onPress={() => void handleToggle()} accessibilityLabel="播放或暂停" activeOpacity={0.8}>
          {playback.isPlaying
            ? <Pause size={metrics.body + 12} color={Colors.brand.onAccent} />
            : <Play size={metrics.body + 12} color={Colors.brand.onAccent} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void handleNext()} style={dyn.ctrlBtn} accessibilityLabel="下一首" activeOpacity={0.75}>
          <SkipForward size={metrics.body + 8} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleRepeat} style={dyn.ctrlSide} accessibilityLabel="循环模式" activeOpacity={0.75}>
          {repeatMode === "one"
            ? <Repeat1 size={metrics.body + 5} color={Colors.brand.accent} />
            : <Repeat size={metrics.body + 5} color={repeatMode === "off" ? Colors.text.secondary : Colors.brand.accent} />}
        </TouchableOpacity>
      </View>

      {/* 四工具图标：列表 / 歌词 / 音量 / 刷新，均为真实功能 */}
      <View style={dyn.toolRow}>
        {([
          { label: "列表", active: listVisible, onPress: () => setListVisible((v) => !v),
            icon: <ListMusic size={metrics.body + 5} color={listVisible ? Colors.brand.accent : Colors.text.secondary} /> },
          { label: "歌词", active: lyricsVisible, onPress: () => setLyricsVisible((v) => !v),
            icon: <Mic2 size={metrics.body + 5} color={lyricsVisible ? Colors.brand.accent : Colors.text.secondary} /> },
          { label: "音量", active: volumeVisible, onPress: () => setVolumeVisible((v) => !v),
            icon: <Volume2 size={metrics.body + 5} color={volumeVisible ? Colors.brand.accent : Colors.text.secondary} /> },
          { label: "刷新", active: false, onPress: () => switchSource(sourceMode),
            icon: <RefreshCw size={metrics.body + 5} color={Colors.text.secondary} /> },
        ] as const).map((t) => (
          <TouchableOpacity
            key={t.label}
            onPress={t.onPress}
            style={[dyn.toolButton, t.active && dyn.toolButtonActive]}
            accessibilityLabel={t.label}
            activeOpacity={0.75}
          >
            {t.icon}
            <ThemedText style={[dyn.toolLabel, t.active && dyn.toolLabelActive]}>{t.label}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {volumeVisible && (
        <View style={dyn.volumeRow}>
          {[0.25, 0.5, 0.75, 1].map((v) => (
            <TouchableOpacity key={v}
              onPress={() => { setVolume(v); void audioPlayer.setVolume(v); }}
              style={[dyn.volumeChip, volume === v && dyn.volumeChipActive]}>
              <ThemedText style={dyn.volumeText}>{Math.round(v * 100)}%</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!!playback.error && <ThemedText style={dyn.errorText}>{playback.error}</ThemedText>}

      {lyricsVisible && (
        <View style={dyn.lyricsBox}>
          <ThemedText style={dyn.lyricsTitle}>歌词 / 说明</ThemedText>
          <ScrollView showsVerticalScrollIndicator={false}>
            {(currentTrack?.lyrics ?? ["选择曲目后显示歌词", "—— ZTV 音乐在线"]).map((line, i) => (
              <ThemedText key={i} style={dyn.lyricsLine}>{line}</ThemedText>
            ))}
          </ScrollView>
        </View>
      )}
    </LinearGradient>
  );

  // ── 右栏：发现音乐（音源 / 风格 / 地区 / 歌单 + 曲目网格 + 精选歌单） ──
  const sourceBar = (
    <View style={dyn.chipBlock}>
      <ThemedText style={dyn.fieldLabel}>音源</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dyn.filterBar}>
        {MUSIC_SOURCES.map((s) => (
          <StyledButton key={s.id} text={s.name} isSelected={sourceMode === s.id} variant="default"
            onPress={() => switchSource(s.id)} style={dyn.pill} textStyle={dyn.pillText} />
        ))}
      </ScrollView>
    </View>
  );

  const discoverPanel = discoverOpen ? (
    <View style={dyn.discoverPanel}>
      {sourceBar}
      <ThemedText style={dyn.fieldLabel}>风格</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dyn.filterBar}>
        {MUSIC_GENRES.map((g) => (
          <StyledButton key={g} text={g} isSelected={genre === g} variant="default"
            onPress={() => switchFilter(g, country)} style={dyn.pill} textStyle={dyn.pillText} />
        ))}
      </ScrollView>
      <View style={dyn.fieldLabelRow}>
        <Globe size={12} color={Colors.brand.accent} />
        <ThemedText style={dyn.fieldLabel}>地区</ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dyn.filterBar}>
        {MUSIC_COUNTRIES.map((c) => (
          <StyledButton key={c} text={c} isSelected={country === c} variant="default"
            onPress={() => switchFilter(genre, c)} style={dyn.pill} textStyle={dyn.pillText} />
        ))}
      </ScrollView>
      {sourceMode === "builtin" && (
        <>
          <ThemedText style={dyn.fieldLabel}>歌单</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dyn.filterBar}>
            {playlists.filter((p) => p.id !== "playlist-online").map((p) => (
              <StyledButton key={p.id} text={`${p.name} (${p.trackIds.length})`}
                isSelected={activePlaylistId === p.id} variant="default"
                onPress={() => setActivePlaylist(p.id)} style={dyn.pill} textStyle={dyn.pillText} />
            ))}
          </ScrollView>
        </>
      )}
    </View>
  ) : null;

  const listTitle = (
    <View style={dyn.panelHeader}>
      <ThemedText style={dyn.panelTitle}>发现音乐</ThemedText>
      <ThemedText style={dyn.panelHint}>
        {sourceMode === "builtin" ? "内置曲库" : sourceMode === "channels" ? "音乐电台" : "最新单曲"} · {displayTracks.length} 项
      </ThemedText>
      <ThemedText style={dyn.panelHint}>{loading ? "加载中…" : "每日推荐 · 点击即播"}</ThemedText>
    </View>
  );

  const trackGrid = (
    <FlatList
      data={displayTracks}
      renderItem={renderTrack}
      keyExtractor={(item) => item.id}
      numColumns={gridColumns}
      columnWrapperStyle={gridColumns > 1 ? dyn.gridRow : undefined}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={dyn.listContent}
      ListEmptyComponent={<ThemedText style={dyn.emptyText}>{emptyText}</ThemedText>}
    />
  );

  /** 设计稿「为你推荐 · 精选歌单」：真实歌单，点击即切到内置曲库并选中该歌单 */
  const playlistCards = (
    <View style={dyn.playlistSection}>
      <View style={dyn.playlistHeader}>
        <Disc3 size={metrics.body + 2} color={Colors.brand.accent} />
        <ThemedText style={dyn.playlistTitle}>为你推荐 · 精选歌单</ThemedText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {playlists.filter((p) => p.id !== "playlist-online").slice(0, 4).map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[dyn.playlistCard, activePlaylistId === p.id && dyn.playlistCardActive]}
            onPress={() => {
              setSourceMode("builtin");
              setActivePlaylist(p.id);
              setListVisible(true);
              void loadSource("builtin", "", genre, country, true);
            }}
            activeOpacity={0.75}
          >
            <LinearGradient colors={[`${p.accent}AA`, `${p.accent}33`]} style={dyn.playlistCover}>
              <ListMusic size={metrics.body + 6} color="#fff" />
            </LinearGradient>
            <ThemedText style={dyn.playlistName} numberOfLines={1}>{p.name}</ThemedText>
            <ThemedText style={dyn.playlistDesc} numberOfLines={1}>{p.trackIds.length} 首 · {p.description}</ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const rightColumn = (
    <View style={[dyn.rightColumn, isWide && dyn.rightColumnWide]}>
      {keyboard}
      {errorBanner}
      {discoverPanel}
      {listTitle}
      {listVisible ? trackGrid : null}
      {playlistCards}
    </View>
  );

  const modal = (
    <Modal visible={addModalVisible} transparent animationType="fade"
      onRequestClose={() => setAddModalVisible(false)}>
      <View style={dyn.modalOverlay}>
        <View style={dyn.modalCard}>
          <View style={dyn.modalHeader}>
            <ThemedText style={dyn.modalTitle}>添加在线音源</ThemedText>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <X size={18} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ThemedText style={dyn.modalHint}>填入可直连的 mp3 / m4a / m3u8 音频地址</ThemedText>
          <TextInput style={dyn.modalInput} placeholder="名称（如：我的歌单 01）"
            placeholderTextColor="#888" value={newTitle} onChangeText={setNewTitle} />
          <TextInput style={dyn.modalInput} placeholder="艺术家（选填）"
            placeholderTextColor="#888" value={newArtist} onChangeText={setNewArtist} />
          <View style={dyn.urlPrefixRow}>
            <ThemedText style={dyn.urlPrefix}>https://</ThemedText>
            <TextInput style={[dyn.modalInput, dyn.urlInput]} placeholder="example.com/music.mp3"
              placeholderTextColor="#888" value={newUrl} onChangeText={setNewUrl}
              autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          </View>
          <View style={dyn.modalActions}>
            <StyledButton text="取消" variant="ghost" onPress={() => setAddModalVisible(false)} style={dyn.modalBtn} />
            <StyledButton text="添加并播放" variant="primary" onPress={() => void handleAddSource()} style={dyn.modalBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dyn.container]}>
      {pageHeader}
      {searchRow}
      <View style={[dyn.columns, isWide && dyn.columnsWide]}>
        <ScrollView
          style={[dyn.leftColumn, isWide && dyn.leftColumnWide]}
          contentContainerStyle={dyn.leftColumnContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {hero}
        </ScrollView>
        {rightColumn}
      </View>
      {modal}
    </ThemedView>
  );

  if (metrics.deviceType === "tv") return content;
  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="音乐在线" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createStyles = (m: CompactMetrics, spacing: number, rightWidth: number) =>
  StyleSheet.create({
    container: {
      flex: 1, minHeight: 0, paddingTop: m.isTVLike ? Math.min(24, spacing * 1.5) : 0,
      paddingHorizontal: spacing, paddingBottom: spacing / 2,
    },
    pageHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: m.gapSm, marginTop: m.isTVLike ? m.gap : m.gap / 2, gap: 8,
    },
    pageTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    pageTitleText: { flexShrink: 1 },
    badge: {
      width: Math.max(Math.round(m.minTouchTarget * 0.8), m.headerHeight - 4),
      height: Math.max(Math.round(m.minTouchTarget * 0.8), m.headerHeight - 4),
      borderRadius: m.radiusSm - 2,
      alignItems: "center", justifyContent: "center",
    },
    pageTitle: { fontSize: m.pageTitle, fontWeight: "bold" },
    pageSubtitle: { fontSize: m.caption, color: Colors.text.tertiary, marginTop: 2 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
    roundButton: {
      width: Math.max(Math.round(m.minTouchTarget * 0.8), m.headerHeight - 4),
      height: Math.max(Math.round(m.minTouchTarget * 0.8), m.headerHeight - 4),
      borderRadius: m.headerHeight,
      alignItems: "center", justifyContent: "center",
      backgroundColor: Colors.surface.overlay, borderWidth: 1, borderColor: Colors.surface.border,
    },
    roundButtonAccent: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },

    /* 常驻搜索栏 */
    searchRow: { flexDirection: "row", alignItems: "center", gap: m.gapSm, marginBottom: m.gap },
    searchBox: {
      flex: 1, minWidth: 110, flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: Colors.surface.overlay, borderWidth: 1, borderColor: Colors.surface.border,
      borderRadius: 18, paddingHorizontal: 10,
      height: Math.max(Math.round(m.minTouchTarget * 0.8), m.headerHeight - 4),
    },
    searchInput: { flex: 1, height: "100%", minHeight: 32, color: Colors.text.primary, fontSize: m.body, paddingVertical: 0 },
    searchClear: { padding: 3 },
    smallButton: {
      borderRadius: 18, paddingHorizontal: 12,
      height: Math.max(Math.round(m.minTouchTarget * 0.8), m.headerHeight - 4),
      justifyContent: "center",
    },

    /* 分栏 */
    columns: { flex: 1, flexDirection: "column", minHeight: 0 },
    columnsWide: { flexDirection: "row", gap: m.gap * 1.5 },
    /** 左栏独立滚动兜底：低高度投影 / 4K 缩放时内容仍可完整到达 */
    leftColumn: { flexShrink: 0, maxHeight: m.contentHeight },
    leftColumnWide: { width: m.leftWidth, flexShrink: 0, maxHeight: m.contentHeight },
    leftColumnContent: { flexGrow: 1, paddingBottom: m.gap },
    rightColumn: { flex: 1, minWidth: 0, minHeight: 0, maxHeight: m.contentHeight, marginTop: m.gap },
    rightColumnWide: { flex: 1, marginTop: 0 },

    /* 正在播放卡 */
    heroBackdrop: {
      borderRadius: m.radius, padding: m.cardPadding, alignItems: "center",
      overflow: "hidden", position: "relative",
      borderWidth: 1, borderColor: Colors.surface.border,
    },
    coverGlow: { position: "absolute", top: 8, left: "50%" },
    heroTopRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      width: "100%", gap: 8, zIndex: 1,
    },
    stateBadge: {
      flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 10, backgroundColor: "rgba(0,0,0,0.28)",
    },
    stateDot: { width: 6, height: 6, borderRadius: 3 },
    stateText: { fontSize: m.caption, fontWeight: "600", color: "#fff" },
    heroSource: { fontSize: m.caption, color: "rgba(255,255,255,0.72)", flexShrink: 1, textAlign: "right" },
    heroCover: {
      alignItems: "center", justifyContent: "center", overflow: "hidden",
      marginTop: m.gap, marginBottom: m.gap, zIndex: 1,
    },
    nowRow: { flexDirection: "row", alignItems: "center", width: "100%", gap: 8, zIndex: 1 },
    nowText: { flex: 1, minWidth: 0 },
    nowTitle: { fontSize: m.sectionTitle + 2, fontWeight: "bold", color: "#fff" },
    nowArtist: { fontSize: m.caption, color: Colors.text.secondary, marginTop: 3 },
    stopRound: {
      width: m.roundControl - 6, height: m.roundControl - 6, borderRadius: (m.roundControl - 6) / 2,
      alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
    },
    liveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: m.gap, zIndex: 1 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.live },
    liveRowText: { fontSize: m.caption, color: Colors.text.secondary },
    progressTrack: {
      flexDirection: "row", width: "100%", height: 5, borderRadius: 3,
      backgroundColor: Colors.surface.overlay, marginTop: m.gap, zIndex: 1,
    },
    progressFill: { height: "100%", backgroundColor: Colors.brand.accent, borderRadius: 3 },
    progressKnob: {
      position: "absolute", top: -2, width: 9, height: 9, marginLeft: -4,
      borderRadius: 5, backgroundColor: "#fff",
    },
    timeRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 5, zIndex: 1 },
    timeText: { fontSize: m.caption, color: Colors.text.tertiary },
    controls: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      width: "100%", maxWidth: 360, marginTop: m.gap, zIndex: 1,
    },
    ctrlSide: { width: m.roundControl - 6, height: m.roundControl - 6, borderRadius: (m.roundControl - 6) / 2, alignItems: "center", justifyContent: "center" },
    ctrlBtn: { width: m.roundControl, height: m.roundControl, borderRadius: m.roundControl / 2, alignItems: "center", justifyContent: "center" },
    playBtn: {
      width: m.playButton, height: m.playButton, borderRadius: m.playButton / 2,
      backgroundColor: Colors.brand.accent, alignItems: "center", justifyContent: "center",
      shadowColor: Colors.brand.accent, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    },
    toolRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      width: "100%", maxWidth: 360, marginTop: m.gap, zIndex: 1, gap: 6,
    },
    toolButton: {
      flex: 1, alignItems: "center", justifyContent: "center", gap: 2,
      minHeight: Math.max(m.minTouchTarget, m.roundControl), borderRadius: m.radiusSm,
      backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.surface.border,
    },
    toolButtonActive: { backgroundColor: "rgba(0,230,168,0.12)", borderColor: "rgba(0,230,168,0.45)" },
    toolLabel: { fontSize: m.caption, color: Colors.text.tertiary },
    toolLabelActive: { color: Colors.brand.accent },
    volumeRow: {
      flexDirection: "row", alignItems: "center", gap: 5, marginTop: m.gapSm,
      flexWrap: "wrap", justifyContent: "center", zIndex: 1,
    },
    volumeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: Colors.surface.overlay },
    volumeChipActive: { backgroundColor: "rgba(0,230,168,0.2)", borderWidth: 1, borderColor: Colors.brand.accent },
    volumeText: { fontSize: m.caption },
    errorText: { color: "#ff6b6b", fontSize: m.caption + 1, marginTop: 6, textAlign: "center", zIndex: 1 },
    lyricsBox: {
      width: "100%", marginTop: m.gap, paddingTop: m.gapSm,
      borderTopWidth: 1, borderTopColor: Colors.surface.border, maxHeight: 76, zIndex: 1,
    },
    lyricsTitle: { fontSize: m.caption + 1, fontWeight: "600", marginBottom: 4, color: Colors.brand.accent },
    lyricsLine: { fontSize: m.caption + 1, color: Colors.text.secondary, textAlign: "center", lineHeight: 18 },

    /* 发现音乐 */
    discoverPanel: {
      borderRadius: m.radiusSm, borderWidth: 1, borderColor: Colors.surface.border,
      backgroundColor: Colors.surface.raised, padding: m.gapSm + 2, marginBottom: m.gapSm,
    },
    chipBlock: { marginBottom: m.gapSm },
    fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    fieldLabel: { fontSize: m.caption, color: Colors.text.tertiary, marginBottom: 5 },
    filterBar: { marginBottom: m.gapSm, flexGrow: 0 },
    pill: {
      borderRadius: 16, paddingHorizontal: 11, paddingVertical: 5, marginRight: 6,
      minHeight: Math.round(m.minTouchTarget * 0.6), justifyContent: "center",
    },
    pillText: { fontSize: m.caption + 1 },
    errorBanner: {
      flexDirection: "row", alignItems: "center", gap: 6, padding: 8, marginBottom: m.gapSm,
      borderRadius: m.radiusSm - 2, backgroundColor: "rgba(255,184,107,0.10)",
      borderWidth: 1, borderColor: "rgba(255,184,107,0.28)",
    },
    errorBannerText: { flex: 1, color: "#FFB86B", fontSize: m.caption + 1 },
    panelHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: m.gapSm },
    panelTitle: { fontSize: m.sectionTitle, fontWeight: "700" },
    panelHint: { fontSize: m.caption, color: Colors.text.tertiary, marginLeft: "auto" },
    listContent: { paddingBottom: m.gapSm },

    /* 曲目网格（宽屏）/ 行列表（手机） */
    gridRow: { gap: m.gapSm },
    gridCard: {
      flex: 1, maxWidth: `${100 / Math.max(1, Math.min(3, m.columns)) - 2}%`,
      borderRadius: m.radiusSm, borderWidth: 1, borderColor: Colors.surface.border,
      backgroundColor: Colors.surface.raised, padding: m.gapSm, marginBottom: m.gapSm,
      position: "relative",
    },
    gridCardActive: { borderColor: Colors.brand.accent, backgroundColor: "rgba(0,230,168,0.10)" },
    gridCardFocused: { borderWidth: 2, borderColor: Colors.brand.accent },
    gridCover: {
      width: "100%", aspectRatio: 1, borderRadius: m.radiusSm - 3,
      alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 6,
    },
    gridTitle: { fontSize: m.body, fontWeight: "600" },
    gridTitleActive: { color: Colors.brand.accent },
    gridMeta: { fontSize: m.caption, color: Colors.text.tertiary, marginTop: 2 },
    gridDelete: { position: "absolute", top: m.gapSm + 2, right: m.gapSm + 2, padding: 3 },
    trackRow: {
      flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 7,
      borderRadius: m.radiusSm - 2, marginBottom: 3,
      minHeight: Math.max(44, Math.round(m.minTouchTarget * 0.9)),
    },
    trackRowActive: { backgroundColor: "rgba(0,230,168,0.12)" },
    trackRowFocused: { borderWidth: 2, borderColor: Colors.brand.accent },
    trackCover: {
      width: m.roundControl - 4, height: m.roundControl - 4, borderRadius: 7,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    trackInfo: { flex: 1, marginLeft: m.gapSm + 2, minWidth: 0 },
    trackTitle: { fontSize: m.body, fontWeight: "600" },
    trackTitleActive: { color: Colors.brand.accent },
    trackArtist: { fontSize: m.caption, color: Colors.text.tertiary, marginTop: 1 },
    trackDuration: { fontSize: m.caption, color: Colors.text.tertiary },
    liveChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, backgroundColor: "rgba(255,59,71,0.15)" },
    liveChipText: { fontSize: m.caption, fontWeight: "700", color: Colors.brand.live },
    deleteBtn: { marginLeft: 6, padding: 3 },
    emptyText: { fontSize: m.body, color: Colors.text.tertiary, textAlign: "center", padding: 16 },

    /* 精选歌单 */
    playlistSection: { marginTop: m.gapSm },
    playlistHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: m.gapSm },
    playlistTitle: { fontSize: m.body + 1, fontWeight: "700" },
    playlistCard: {
      width: Math.max(96, Math.min(150, rightWidth / 3.4)), marginRight: m.gapSm,
      padding: m.gapSm - 1, borderRadius: m.radiusSm,
      backgroundColor: Colors.surface.raised, borderWidth: 1, borderColor: Colors.surface.border,
    },
    playlistCardActive: { borderColor: Colors.brand.accent },
    playlistCover: {
      width: "100%", aspectRatio: 1.25, borderRadius: m.radiusSm - 3,
      alignItems: "center", justifyContent: "center", marginBottom: 5,
    },
    playlistName: { fontSize: m.body, fontWeight: "600" },
    playlistDesc: { fontSize: m.caption, color: Colors.text.tertiary, marginTop: 2 },

    /* 添加音源弹窗 */
    modalOverlay: { flex: 1, backgroundColor: Colors.surface.scrim, alignItems: "center", justifyContent: "center", padding: 20 },
    modalCard: {
      width: "100%", maxWidth: 480, backgroundColor: Colors.surface.raised, borderRadius: m.radius,
      borderWidth: 1, borderColor: Colors.surface.border, padding: 18,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    modalTitle: { fontSize: m.sectionTitle + 1, fontWeight: "bold" },
    modalHint: { fontSize: m.caption + 1, color: Colors.text.tertiary, marginTop: 5, marginBottom: 12 },
    modalInput: {
      height: 42, borderWidth: 1, borderColor: Colors.surface.border, borderRadius: m.radiusSm - 2,
      paddingHorizontal: 10, fontSize: m.body, backgroundColor: Colors.surface.overlay,
      color: "#fff", marginBottom: 8,
    },
    urlPrefixRow: { flexDirection: "row", alignItems: "center" },
    urlPrefix: {
      fontSize: m.body, color: Colors.brand.accent, fontWeight: "600", backgroundColor: Colors.surface.overlay,
      borderLeftWidth: 1, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.surface.border,
      borderTopLeftRadius: m.radiusSm - 2, borderBottomLeftRadius: m.radiusSm - 2,
      paddingHorizontal: 8, height: 42, textAlignVertical: "center",
    },
    urlInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
    modalBtn: { borderRadius: 18, paddingHorizontal: 16 },
  });
