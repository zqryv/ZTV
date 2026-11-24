/**
 * 音乐播放页（分类「音乐播放」）。
 *
 * 布局重新规划后的信息层级：
 *  ① 音源切换（最新单曲 / 音乐电台 / 内置曲库）→ 明确「我正在浏览什么」
 *  ② 常驻搜索框 + 屏幕键盘 → 电视 / 机顶盒无需系统输入法也能输入
 *  ③ 条件筛选（风格 / 地区 / 歌单）→ 次级操作，可折叠
 *  ④ 正在播放（状态 / 封面 / 进度 / 控制 / 音量 / 停止）→ 大屏固定右栏
 *  ⑤ 曲目列表 → 剩余空间，显示来源与时长
 *
 * 播放能力来自 services/audioPlayer（expo-av，项目既有依赖）。
 * 参考 react-native-track-player / React Navigation 的做法：页面失焦即停止并释放，
 * 叠加根布局的 AppState 监听，彻底解决「退出后仍后台播放」。
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
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import { SearchKeyboard } from "@/components/SearchKeyboard";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
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
  const { deviceType, spacing } = responsiveConfig;
  const isTVLike = deviceType === "tv" || Boolean(responsiveConfig.isSetTopBox);
  const isWide = deviceType === "tv" || deviceType === "desktop" || deviceType === "tablet";

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

  // 音源 / 搜索 / 筛选状态
  const [sourceMode, setSourceMode] = useState<MusicSourceId>("latest");
  const [searchText, setSearchText] = useState("");
  const [genre, setGenre] = useState<string>("全部");
  const [country, setCountry] = useState<string>("全部");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(isTVLike);
  const [filtersOpen, setFiltersOpen] = useState(isWide);
  const bootstrapped = useRef(false);

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

  // 自定义音源只需加载一次
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
        let results: MusicTrack[] = [];
        if (mode === "channels") {
          results = await fetchMusicChannels(c, g, 40, kw);
        } else {
          results = kw.trim()
            ? await searchLatestMusic(kw, c, 40)
            : await browseMusicByGenre(g, c, 40);
        }
        if (results.length === 0) throw new Error("empty result");
        setOnlineTracks(results);
        void audioPlayer.pause();
        if (!quiet) Toast.show({ type: "success", text1: `已加载 ${results.length} 项` });
      } catch {
        // 主音源不可用时自动切到音乐电台，避免「打开就是空列表」
        if (mode === "latest") {
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

  /** 搜索：内置曲库为本地即时过滤；在线音源发起检索 */
  const handleSearch = useCallback(() => {
    if (sourceMode === "builtin") {
      Toast.show({ type: "info", text1: "已在内置曲库中筛选" });
      return;
    }
    void loadSource(sourceMode, searchText.trim(), genre, country);
  }, [sourceMode, searchText, genre, country, loadSource]);

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

  // TV 遥控器：屏幕键盘打开时让焦点系统接管，避免按键被误判为切歌
  const handleTVEvent = useCallback(
    (event: any) => {
      if (keyboardVisible) return;
      switch (event.eventType) {
        case "left":
          void handlePrev();
          break;
        case "right":
          void handleNext();
          break;
        case "select":
        case "playPause":
          void audioPlayer.toggle();
          break;
        case "up":
          setFocusIndex((i) => Math.max(0, i - 1));
          break;
        case "down":
          setFocusIndex((i) => Math.min(displayTracks.length - 1, i + 1));
          break;
      }
    },
    [keyboardVisible, handlePrev, handleNext, displayTracks.length]
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
    // 直接用返回的 track 播放：store 刚更新，startTrack 闭包里的 tracks 还是旧快照
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

  const dyn = useMemo(() => createStyles(deviceType, spacing), [deviceType, spacing]);
  const progress = playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0;
  const stateLabel = playback.isLoading
    ? "连接中"
    : playback.isPlaying
    ? "正在播放"
    : currentTrack
    ? "已暂停"
    : "待播放";
  const sourceDescription = MUSIC_SOURCES.find((s) => s.id === sourceMode)?.description ?? "";

  const renderTrack = ({ item, index }: { item: MusicTrack; index: number }) => {
    const isCurrent = item.id === currentTrackId;
    const isCustom = !item.id.startsWith("track-") && !item.id.startsWith("itunes-") &&
      !item.id.startsWith("channel-") && !item.id.startsWith("music-live-");
    const meta = [item.artist, item.genre, item.country, item.source].filter(Boolean).join(" · ");
    return (
      <TouchableOpacity
        style={[
          dyn.trackRow,
          isCurrent && dyn.trackRowActive,
          deviceType === "tv" && focusIndex === index && dyn.trackRowFocused,
        ]}
        onPress={() => void startTrack(item.id)}
        activeOpacity={0.7}
      >
        {item.cover ? (
          <Image source={{ uri: item.cover }} style={dyn.trackCover} resizeMode="cover" />
        ) : (
          <LinearGradient colors={[item.accent, `${item.accent}55`]} style={dyn.trackCover}>
            <Music2 size={deviceType === "tv" ? 22 : 16} color="#fff" />
          </LinearGradient>
        )}
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
            <Trash2 size={16} color={Colors.text.tertiary} />
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

  // ── ① 页头 ──────────────────────────────────────────────────────────────
  const pageHeader = (
    <View style={dyn.pageHeader}>
      <View style={dyn.pageTitleRow}>
        <LinearGradient colors={["#00E6A8", "#00B884"]} style={dyn.badge}>
          <Music2 size={18} color={Colors.brand.onAccent} />
        </LinearGradient>
        <View style={dyn.pageTitleText}>
          <ThemedText style={dyn.pageTitle}>音乐播放</ThemedText>
          <ThemedText style={dyn.pageSubtitle} numberOfLines={1}>{sourceDescription}</ThemedText>
        </View>
      </View>
      <StyledButton text="添加音源" variant="primary" onPress={() => setAddModalVisible(true)} style={dyn.addButton}>
        <Plus size={16} color="#fff" />
      </StyledButton>
    </View>
  );

  // ── ② 音源切换 ──────────────────────────────────────────────────────────
  const sourceBar = (
    <View style={dyn.sectionLabelRow}>
      <ThemedText style={dyn.sectionLabel}>音源</ThemedText>
      <View style={dyn.chipRow}>
        {MUSIC_SOURCES.map((s) => (
          <StyledButton
            key={s.id}
            text={s.name}
            isSelected={sourceMode === s.id}
            variant="default"
            onPress={() => switchSource(s.id)}
            style={dyn.pill}
            textStyle={dyn.pillText}
          />
        ))}
      </View>
    </View>
  );

  // ── ③ 常驻搜索框：始终可见，且不再被折叠面板 / 负边距遮挡 ───────────────
  const searchRow = (
    <View style={dyn.searchRow}>
      <View style={dyn.searchBox}>
        <Search size={16} color={Colors.text.tertiary} />
        <TextInput
          style={dyn.searchInput}
          placeholder="搜索歌名 / 歌手，或点下方热词"
          placeholderTextColor={Colors.text.disabled}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          editable
          focusable={!isTVLike}
          showSoftInputOnFocus={!isTVLike}
          blurOnSubmit={false}
        />
        {!!searchText && (
          <TouchableOpacity onPress={() => setSearchText("")} style={dyn.searchClear}>
            <X size={14} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>
      <StyledButton
        text="键盘"
        variant={keyboardVisible ? "primary" : "default"}
        onPress={() => setKeyboardVisible((v) => !v)}
        style={dyn.keyboardButton}
        textStyle={dyn.pillText}
      />
      <StyledButton
        text={loading ? "…" : "搜索"}
        variant="primary"
        onPress={handleSearch}
        disabled={loading}
        style={dyn.searchButton}
        textStyle={dyn.searchButtonText}
      />
    </View>
  );

  const keyboard = keyboardVisible ? (
    <SearchKeyboard
      visible
      title="音乐搜索键盘"
      hint="点字母 / 数字直接输入；中文歌手可点下方热词，一键发起搜索"
      quickTerms={MUSIC_QUICK_TERMS}
      onQuickTerm={handleQuickTerm}
      onKeyPress={(key) => setSearchText((prev) => prev + key)}
      onDelete={() => setSearchText((prev) => prev.slice(0, -1))}
      onClear={() => setSearchText("")}
      onSearch={handleSearch}
      onClose={() => setKeyboardVisible(false)}
    />
  ) : null;

  // ── ④ 次级筛选（可折叠）────────────────────────────────────────────────
  const filterToggle = (
    <TouchableOpacity style={dyn.filterToggle} onPress={() => setFiltersOpen((v) => !v)} activeOpacity={0.8}>
      <View style={dyn.filterToggleLeft}>
        <Globe size={15} color={Colors.brand.accent} />
        <ThemedText style={dyn.filterToggleText} numberOfLines={1}>
          {[genre !== "全部" ? genre : null, country !== "全部" ? country : null].filter(Boolean).join(" · ") || "全部风格 · 全部地区"}
        </ThemedText>
      </View>
      <ThemedText style={dyn.filterToggleArrow}>{filtersOpen ? "收起筛选" : "展开筛选"}</ThemedText>
    </TouchableOpacity>
  );

  const filterPanel = filtersOpen ? (
    <View style={dyn.filterPanel}>
      <ThemedText style={dyn.fieldLabel}>风格</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dyn.filterBar}>
        {MUSIC_GENRES.map((g) => (
          <StyledButton key={g} text={g} isSelected={genre === g} variant="default"
            onPress={() => switchFilter(g, country)} style={dyn.pill} textStyle={dyn.pillText} />
        ))}
      </ScrollView>
      <ThemedText style={dyn.fieldLabel}>地区</ThemedText>
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

  const errorBanner = error ? (
    <View style={dyn.errorBanner}>
      <RefreshCw size={13} color="#FFB86B" />
      <ThemedText style={dyn.errorBannerText} numberOfLines={2}>{error}</ThemedText>
    </View>
  ) : null;

  // ── ⑤ 正在播放 ─────────────────────────────────────────────────────────
  const playerPanel = (
    <View style={[dyn.playerPanel, !isWide && dyn.playerPanelCompact]}>
      <View style={dyn.playerStateRow}>
        <View style={[dyn.stateDot, { backgroundColor: playback.isPlaying ? Colors.brand.live : Colors.text.disabled }]} />
        <ThemedText style={dyn.stateText}>{stateLabel}</ThemedText>
        <ThemedText style={dyn.sourceTag} numberOfLines={1}>{currentTrack?.source ?? "ZTV"}</ThemedText>
        <TouchableOpacity onPress={() => void handleStop()} style={dyn.stopTextButton}>
          <Square size={12} color={Colors.text.secondary} />
          <ThemedText style={dyn.stopText}>停止</ThemedText>
        </TouchableOpacity>
      </View>

      {currentTrack?.cover ? (
        <Image source={{ uri: currentTrack.cover }} style={dyn.heroCover} resizeMode="cover" />
      ) : (
        <LinearGradient colors={[currentTrack?.accent ?? "#00E6A8", Colors.surface.raised]} style={dyn.heroCover}>
          <Music2 size={isWide ? 48 : 28} color="rgba(255,255,255,0.85)" />
        </LinearGradient>
      )}
      <ThemedText style={dyn.nowTitle} numberOfLines={1}>{currentTrack?.title ?? "选择一首曲目"}</ThemedText>
      <ThemedText style={dyn.nowArtist} numberOfLines={1}>
        {currentTrack ? `${currentTrack.artist} · ${currentTrack.album ?? ""}` : "点击列表即可播放"}
      </ThemedText>

      {currentTrack?.isLive ? (
        <View style={dyn.liveRow}>
          <View style={dyn.liveDot} />
          <ThemedText style={dyn.liveRowText}>LIVE · 连续音乐流，进度不可用</ThemedText>
        </View>
      ) : (
        <View style={dyn.progressRow}>
          <ThemedText style={dyn.timeText}>{formatTime(playback.positionMs)}</ThemedText>
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
            <View style={[dyn.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
          </TouchableOpacity>
          <ThemedText style={dyn.timeText}>
            {playback.durationMs ? formatTime(playback.durationMs) : currentTrack?.durationLabel ?? "--:--"}
          </ThemedText>
        </View>
      )}

      <View style={dyn.controls}>
        <StyledButton variant="ghost" onPress={cycleRepeat} style={dyn.ctrlSmall}>
          {repeatMode === "one" ? <Repeat1 size={18} color={Colors.brand.accent} />
            : <Repeat size={18} color={repeatMode === "off" ? Colors.text.tertiary : Colors.brand.accent} />}
        </StyledButton>
        <StyledButton variant="ghost" onPress={() => void handlePrev()} style={dyn.ctrlBtn}>
          <SkipBack size={deviceType === "tv" ? 28 : 22} color="#fff" />
        </StyledButton>
        <TouchableOpacity style={dyn.playBtn} onPress={() => void handleToggle()} activeOpacity={0.8}>
          {playback.isPlaying
            ? <Pause size={deviceType === "tv" ? 34 : 26} color={Colors.brand.onAccent} />
            : <Play size={deviceType === "tv" ? 34 : 26} color={Colors.brand.onAccent} />}
        </TouchableOpacity>
        <StyledButton variant="ghost" onPress={() => void handleNext()} style={dyn.ctrlBtn}>
          <SkipForward size={deviceType === "tv" ? 28 : 22} color="#fff" />
        </StyledButton>
        <StyledButton variant="ghost" onPress={toggleShuffle} style={dyn.ctrlSmall}>
          <Shuffle size={18} color={shuffle ? Colors.brand.accent : Colors.text.tertiary} />
        </StyledButton>
      </View>

      <View style={dyn.volumeRow}>
        <Volume2 size={15} color={Colors.text.secondary} />
        {[0.25, 0.5, 0.75, 1].map((v) => (
          <TouchableOpacity key={v}
            onPress={() => { setVolume(v); void audioPlayer.setVolume(v); }}
            style={[dyn.volumeChip, volume === v && dyn.volumeChipActive]}>
            <ThemedText style={dyn.volumeText}>{Math.round(v * 100)}%</ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {!!playback.error && <ThemedText style={dyn.errorText}>{playback.error}</ThemedText>}

      {isWide && (
        <View style={dyn.lyricsBox}>
          <ThemedText style={dyn.lyricsTitle}>歌词 / 说明</ThemedText>
          <ScrollView showsVerticalScrollIndicator={false}>
            {(currentTrack?.lyrics ?? ["选择曲目后显示歌词", "—— ZTV 音乐播放"]).map((line, i) => (
              <ThemedText key={i} style={dyn.lyricsLine}>{line}</ThemedText>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const listTitle = (
    <View style={dyn.panelHeader}>
      <ListMusic size={16} color={Colors.brand.accent} />
      <ThemedText style={dyn.panelTitle}>
        {sourceMode === "builtin" ? "内置曲库" : sourceMode === "channels" ? "音乐电台" : "最新单曲"} · {displayTracks.length} 项
      </ThemedText>
      <ThemedText style={dyn.panelHint}>{loading ? "加载中…" : "点击播放"}</ThemedText>
    </View>
  );

  const body = isWide ? (
    <View style={dyn.bodyWide}>
      <View style={dyn.listPanel}>
        {listTitle}
        <FlatList data={displayTracks} renderItem={renderTrack} keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<ThemedText style={dyn.emptyText}>{emptyText}</ThemedText>} />
      </View>
      {playerPanel}
    </View>
  ) : (
    <View style={dyn.bodyNarrow}>
      {playerPanel}
      <FlatList
        data={displayTracks}
        renderItem={renderTrack}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dyn.listContent}
        ListHeaderComponent={
          <View>
            {sourceBar}
            {searchRow}
            {keyboard}
            {errorBanner}
            {filterToggle}
            {filterPanel}
            {listTitle}
          </View>
        }
        ListEmptyComponent={<ThemedText style={dyn.emptyText}>{emptyText}</ThemedText>}
      />
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
              <X size={20} color={Colors.text.secondary} />
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
      {isWide && (
        <>
          {sourceBar}
          {searchRow}
          {keyboard}
          {errorBanner}
          {filterToggle}
          {filterPanel}
        </>
      )}
      {body}
      {modal}
    </ThemedView>
  );

  if (deviceType === "tv") return content;
  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="音乐播放" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createStyles = (deviceType: string, spacing: number) => {
  const isTV = deviceType === "tv";
  const isWide = deviceType === "tv" || deviceType === "desktop" || deviceType === "tablet";
  return StyleSheet.create({
    container: { flex: 1, paddingTop: isTV ? 40 : 0, paddingHorizontal: spacing, paddingBottom: spacing },
    pageHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: spacing, marginTop: isTV ? spacing : spacing / 2, gap: 8,
    },
    pageTitleRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    pageTitleText: { flexShrink: 1 },
    badge: {
      width: isTV ? 44 : 36, height: isTV ? 44 : 36, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
    },
    pageTitle: { fontSize: isTV ? 30 : 22, fontWeight: "bold" },
    pageSubtitle: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
    addButton: { borderRadius: 20, paddingHorizontal: 18 },

    sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing, flexWrap: "wrap" },
    sectionLabel: { fontSize: 12, fontWeight: "600", color: Colors.text.tertiary },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },

    searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing },
    searchBox: {
      flex: 1, minWidth: 120, flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: Colors.surface.overlay, borderWidth: 1, borderColor: Colors.surface.border,
      borderRadius: 20, paddingHorizontal: 12, height: isTV ? 48 : 42,
    },
    searchInput: {
      flex: 1, height: "100%", minHeight: 36, color: Colors.text.primary,
      fontSize: 14, paddingVertical: 0,
    },
    searchClear: { padding: 4 },
    keyboardButton: { borderRadius: 20, paddingHorizontal: 12, height: isTV ? 48 : 42, justifyContent: "center" },
    searchButton: { borderRadius: 20, paddingHorizontal: 14, height: isTV ? 48 : 42, justifyContent: "center" },
    searchButtonText: { fontSize: 13 },

    errorBanner: {
      flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginBottom: spacing,
      borderRadius: 10, backgroundColor: "rgba(255,184,107,0.10)",
      borderWidth: 1, borderColor: "rgba(255,184,107,0.28)",
    },
    errorBannerText: { flex: 1, color: "#FFB86B", fontSize: 12 },

    filterToggle: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      minHeight: 44, paddingHorizontal: 14, marginBottom: filtersGap(spacing),
      borderRadius: 12, borderWidth: 1, borderColor: Colors.surface.border,
      backgroundColor: Colors.surface.raised,
    },
    filterToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
    filterToggleText: { fontSize: 13, fontWeight: "600", color: Colors.text.primary },
    filterToggleArrow: { fontSize: 12, fontWeight: "600", color: Colors.brand.accent },
    filterPanel: {
      borderRadius: 12, borderWidth: 1, borderColor: Colors.surface.border,
      backgroundColor: Colors.surface.raised, padding: 12, marginBottom: spacing,
    },
    fieldLabel: { fontSize: 11, color: Colors.text.tertiary, marginBottom: 6 },
    filterBar: { marginBottom: 10, flexGrow: 0 },
    pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
    pillText: { fontSize: 12 },

    bodyWide: { flex: 1, flexDirection: "row", gap: spacing, minHeight: 0 },
    bodyNarrow: { flex: 1, minHeight: 0 },
    listContent: { paddingBottom: spacing },
    listPanel: {
      flex: 1.25, minWidth: 0, backgroundColor: Colors.surface.raised, borderRadius: 16,
      borderWidth: 1, borderColor: Colors.surface.border, padding: spacing,
    },
    panelHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginTop: isWide ? 0 : 4 },
    panelTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
    panelHint: { fontSize: 11, color: Colors.text.tertiary },

    playerPanel: {
      flex: 1, minWidth: 0, backgroundColor: Colors.surface.raised, borderRadius: 16,
      borderWidth: 1, borderColor: Colors.surface.border, padding: spacing, alignItems: "center",
    },
    playerPanelCompact: { flex: 0, marginBottom: spacing },
    playerStateRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "100%", marginBottom: 10 },
    stateDot: { width: 8, height: 8, borderRadius: 4 },
    stateText: { fontSize: 12, fontWeight: "700", color: Colors.text.primary },
    sourceTag: { flex: 1, fontSize: 10, color: Colors.text.tertiary },
    stopTextButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 12, borderWidth: 1, borderColor: Colors.surface.border },
    stopText: { fontSize: 11, color: Colors.text.secondary },
    heroCover: {
      width: isTV ? 170 : isWide ? 140 : 76, height: isTV ? 170 : isWide ? 140 : 76,
      borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 10, overflow: "hidden",
    },
    nowTitle: { fontSize: isTV ? 26 : isWide ? 20 : 17, fontWeight: "bold", textAlign: "center" },
    nowArtist: { fontSize: 11, color: Colors.text.tertiary, marginTop: 3, textAlign: "center" },
    liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.brand.live },
    liveRowText: { fontSize: 11, color: Colors.text.secondary },
    progressRow: { flexDirection: "row", alignItems: "center", width: "100%", gap: 8, marginTop: spacing },
    timeText: { fontSize: 11, color: Colors.text.tertiary, minWidth: 40, textAlign: "center" },
    progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.surface.overlay, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: Colors.brand.accent, borderRadius: 3 },
    controls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: isTV ? 16 : 6, marginTop: 10 },
    ctrlSmall: { padding: 6, borderRadius: 20 },
    ctrlBtn: { padding: 8, borderRadius: 24 },
    playBtn: {
      width: isTV ? 64 : 50, height: isTV ? 64 : 50, borderRadius: isTV ? 32 : 25,
      backgroundColor: Colors.brand.accent, alignItems: "center", justifyContent: "center",
    },
    volumeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, flexWrap: "wrap", justifyContent: "center" },
    volumeChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: Colors.surface.overlay },
    volumeChipActive: { backgroundColor: "rgba(0,230,168,0.2)", borderWidth: 1, borderColor: Colors.brand.accent },
    volumeText: { fontSize: 11 },
    errorText: { color: "#ff6b6b", fontSize: 12, marginTop: 8, textAlign: "center" },
    lyricsBox: {
      width: "100%", marginTop: spacing, paddingTop: spacing,
      borderTopWidth: 1, borderTopColor: Colors.surface.border, maxHeight: isTV ? 150 : 100,
    },
    lyricsTitle: { fontSize: 12, fontWeight: "600", marginBottom: 6, color: Colors.brand.accent },
    lyricsLine: { fontSize: 12, color: Colors.text.secondary, textAlign: "center", lineHeight: 20 },

    trackRow: {
      flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 8,
      borderRadius: 10, marginBottom: 4, minHeight: 52,
    },
    trackRowActive: { backgroundColor: "rgba(0,230,168,0.12)" },
    trackRowFocused: { borderWidth: 2, borderColor: Colors.brand.accent },
    trackCover: {
      width: isTV ? 46 : 36, height: isTV ? 46 : 36, borderRadius: 8,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    },
    trackInfo: { flex: 1, marginLeft: 12, minWidth: 0 },
    trackTitle: { fontSize: isTV ? 18 : 14, fontWeight: "600" },
    trackTitleActive: { color: Colors.brand.accent },
    trackArtist: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
    trackDuration: { fontSize: 11, color: Colors.text.tertiary },
    liveChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "rgba(255,59,71,0.15)" },
    liveChipText: { fontSize: 10, fontWeight: "700", color: Colors.brand.live },
    deleteBtn: { marginLeft: 8, padding: 4 },
    emptyText: { fontSize: 13, color: Colors.text.tertiary, textAlign: "center", padding: 20 },

    modalOverlay: { flex: 1, backgroundColor: Colors.surface.scrim, alignItems: "center", justifyContent: "center", padding: 24 },
    modalCard: {
      width: "100%", maxWidth: 520, backgroundColor: Colors.surface.raised, borderRadius: 16,
      borderWidth: 1, borderColor: Colors.surface.border, padding: 20,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    modalTitle: { fontSize: 18, fontWeight: "bold" },
    modalHint: { fontSize: 12, color: Colors.text.tertiary, marginTop: 6, marginBottom: 14 },
    modalInput: {
      height: 46, borderWidth: 1, borderColor: Colors.surface.border, borderRadius: 10,
      paddingHorizontal: 12, fontSize: 14, backgroundColor: Colors.surface.overlay,
      color: "#fff", marginBottom: 10,
    },
    urlPrefixRow: { flexDirection: "row", alignItems: "center" },
    urlPrefix: {
      fontSize: 14, color: Colors.brand.accent, fontWeight: "600", backgroundColor: Colors.surface.overlay,
      borderLeftWidth: 1, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.surface.border,
      borderTopLeftRadius: 10, borderBottomLeftRadius: 10, paddingHorizontal: 10, height: 46, textAlignVertical: "center",
    },
    urlInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
    modalBtn: { borderRadius: 20, paddingHorizontal: 18 },
  });
};

/** 折叠面板与触发条之间保持一个稳定的小间距，避免负边距互相遮挡输入区 */
const filtersGap = (spacing: number) => Math.max(6, Math.round(spacing / 2));
