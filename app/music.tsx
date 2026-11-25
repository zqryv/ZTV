/**
 * 音乐播放页（分类「音乐播放」）。
 *
 * 界面按工作区设计方案「18 音乐播放器 Music Player」（Ardot 设计稿 750387664062996）
 * 重新排布：氛围光晕渐变 + 大方形封面 + 曲目信息 + 进度条 + 五键控制 + 四工具图标，
 * 让「正在播放」成为唯一主角；音源 / 搜索 / 筛选收进可折叠的「发现音乐」面板去杂乱。
 *
 * 本次仅替换界面层，以下能力全部沿用 v2.2.0，接口与交互逻辑零改动：
 *  - 多音源聚合与三级降级（最新单曲 → 音乐电台 → 内置曲库）、风格 / 地区 / 歌单筛选
 *  - 常驻可输入的搜索框 + 屏幕键盘（电视 / 机顶盒无需系统输入法）+ 中文热词一键输入
 *  - 曲目元数据、封面、歌词、进度 seek、循环 / 随机 / 音量、自定义音源增删
 *  - useFocusEffect 失焦停止 + 根布局 AppState 监听，退出即停止并释放 expo-av 资源
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
  useWindowDimensions,
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
  const { width: windowWidth } = useWindowDimensions();
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
  const [discoverOpen, setDiscoverOpen] = useState(isWide);
  // 设计稿「四工具图标」：列表 / 歌词 / 音量 / 刷新，均为真实功能开关
  const [listVisible, setListVisible] = useState(true);
  const [lyricsVisible, setLyricsVisible] = useState(isWide);
  const [volumeVisible, setVolumeVisible] = useState(isWide);
  const bootstrapped = useRef(false);
  const searchRef = useRef<TextInput>(null);

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

  /** 展开「发现音乐」面板并把焦点交给搜索框，保证搜索始终可输入 */
  const openDiscover = useCallback(() => {
    setDiscoverOpen(true);
    searchRef.current?.focus();
  }, []);

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
  const coverSize = Math.round(
    Math.min(isTVLike ? 300 : 260, Math.max(150, isWide ? windowWidth * 0.26 : windowWidth * 0.5))
  );

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

  // ── 设计稿页头：标题「正在播放 / ZTV MUSIC」+ 圆形「更多」「添加」 ──────
  const pageHeader = (
    <View style={dyn.pageHeader}>
      <View style={dyn.pageTitleRow}>
        <LinearGradient colors={["#00E6A8", "#00B884"]} style={dyn.badge}>
          <Music2 size={18} color={Colors.brand.onAccent} />
        </LinearGradient>
        <View style={dyn.pageTitleText}>
          <ThemedText style={dyn.pageTitle}>正在播放</ThemedText>
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
          <MoreHorizontal size={20} color={Colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[dyn.roundButton, dyn.roundButtonAccent]}
          onPress={() => setAddModalVisible(true)}
          accessibilityLabel="添加音源"
          activeOpacity={0.75}
        >
          <Plus size={20} color={Colors.brand.onAccent} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── 常驻搜索栏：始终可见且可输入，避免再次出现「搜索框无法输入」 ────────
  const searchRow = (
    <View style={dyn.searchRow}>
      <View style={dyn.searchBox}>
        <Search size={16} color={Colors.text.tertiary} />
        <TextInput
          ref={searchRef}
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

  const errorBanner = error ? (
    <View style={dyn.errorBanner}>
      <RefreshCw size={13} color="#FFB86B" />
      <ThemedText style={dyn.errorBannerText} numberOfLines={2}>{error}</ThemedText>
    </View>
  ) : null;

  // ── 可折叠「发现音乐」面板：音源 + 风格 / 地区 / 歌单，收起后即沉浸式 ──
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
        <Globe size={13} color={Colors.brand.accent} />
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

  // ── 沉浸式「正在播放」：氛围光晕 + 大封面 + 五键 + 四工具 ──────────────
  const hero = (
    <LinearGradient
      colors={[`${accent}2E`, `${accent}0D`, Colors.surface.base]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[dyn.heroBackdrop, !isWide && dyn.heroBackdropCompact]}
    >
      {/* 封面光晕 */}
      <View style={[
        dyn.coverGlow,
        {
          width: coverSize * 1.3,
          height: coverSize * 1.3,
          borderRadius: coverSize * 0.65,
          marginLeft: -coverSize * 0.65,
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
          <Music2 size={Math.round(coverSize * 0.28)} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      )}

      <View style={dyn.nowRow}>
        <View style={dyn.nowText}>
          <ThemedText style={dyn.nowTitle} numberOfLines={1}>{currentTrack?.title ?? "选择一首曲目"}</ThemedText>
          <ThemedText style={dyn.nowArtist} numberOfLines={1}>
            {currentTrack ? `${currentTrack.artist} · ${currentTrack.album ?? ""}` : "点击列表即可播放"}
          </ThemedText>
        </View>
        <TouchableOpacity onPress={() => void handleStop()} style={dyn.stopRound} accessibilityLabel="停止播放" activeOpacity={0.75}>
          <Square size={16} color={Colors.brand.accent} />
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
          <Shuffle size={20} color={shuffle ? Colors.brand.accent : Colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void handlePrev()} style={dyn.ctrlBtn} accessibilityLabel="上一首" activeOpacity={0.75}>
          <SkipBack size={isTVLike ? 28 : 24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={dyn.playBtn} onPress={() => void handleToggle()} accessibilityLabel="播放或暂停" activeOpacity={0.8}>
          {playback.isPlaying
            ? <Pause size={isTVLike ? 34 : 28} color={Colors.brand.onAccent} />
            : <Play size={isTVLike ? 34 : 28} color={Colors.brand.onAccent} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void handleNext()} style={dyn.ctrlBtn} accessibilityLabel="下一首" activeOpacity={0.75}>
          <SkipForward size={isTVLike ? 28 : 24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={cycleRepeat} style={dyn.ctrlSide} accessibilityLabel="循环模式" activeOpacity={0.75}>
          {repeatMode === "one"
            ? <Repeat1 size={20} color={Colors.brand.accent} />
            : <Repeat size={20} color={repeatMode === "off" ? Colors.text.secondary : Colors.brand.accent} />}
        </TouchableOpacity>
      </View>

      {/* 四工具图标：曲目列表 / 歌词 / 音量 / 刷新音源，均为真实功能 */}
      <View style={dyn.toolRow}>
        {([
          { label: "列表", active: listVisible, onPress: () => setListVisible((v) => !v),
            icon: <ListMusic size={19} color={listVisible ? Colors.brand.accent : Colors.text.secondary} /> },
          { label: "歌词", active: lyricsVisible, onPress: () => setLyricsVisible((v) => !v),
            icon: <Mic2 size={19} color={lyricsVisible ? Colors.brand.accent : Colors.text.secondary} /> },
          { label: "音量", active: volumeVisible, onPress: () => setVolumeVisible((v) => !v),
            icon: <Volume2 size={19} color={volumeVisible ? Colors.brand.accent : Colors.text.secondary} /> },
          { label: "刷新", active: false, onPress: () => switchSource(sourceMode),
            icon: <RefreshCw size={19} color={Colors.text.secondary} /> },
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
            {(currentTrack?.lyrics ?? ["选择曲目后显示歌词", "—— ZTV 音乐播放"]).map((line, i) => (
              <ThemedText key={i} style={dyn.lyricsLine}>{line}</ThemedText>
            ))}
          </ScrollView>
        </View>
      )}
    </LinearGradient>
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

  const listPanel = listVisible ? (
    <View style={[dyn.listPanel, !isWide && dyn.listPanelCompact]}>
      {listTitle}
      <FlatList
        data={displayTracks}
        renderItem={renderTrack}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dyn.listContent}
        ListEmptyComponent={<ThemedText style={dyn.emptyText}>{emptyText}</ThemedText>}
      />
    </View>
  ) : null;

  // 宽屏：沉浸式播放器为主栏，曲目列表退到次栏；窄屏：播放器置顶、列表在下
  const body = (
    <View style={isWide ? dyn.bodyWide : dyn.bodyNarrow}>
      {hero}
      {listPanel}
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
      {searchRow}
      {keyboard}
      {errorBanner}
      {discoverPanel}
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

    /* 设计稿页头 */
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
    pageTitle: { fontSize: isTV ? 28 : 20, fontWeight: "bold" },
    pageSubtitle: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    roundButton: {
      width: isTV ? 44 : 38, height: isTV ? 44 : 38, borderRadius: isTV ? 22 : 19,
      alignItems: "center", justifyContent: "center",
      backgroundColor: Colors.surface.overlay, borderWidth: 1, borderColor: Colors.surface.border,
    },
    roundButtonAccent: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },

    /* 常驻搜索栏 */
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

    /* 可折叠发现面板 */
    discoverPanel: {
      borderRadius: 16, borderWidth: 1, borderColor: Colors.surface.border,
      backgroundColor: Colors.surface.raised, padding: 12, marginBottom: spacing,
    },
    sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
    sectionLabel: { fontSize: 12, fontWeight: "600", color: Colors.text.tertiary },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    fieldLabel: { fontSize: 11, color: Colors.text.tertiary, marginBottom: 6 },
    filterBar: { marginBottom: 10, flexGrow: 0 },
    pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8 },
    pillText: { fontSize: 12 },
    errorBanner: {
      flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginBottom: spacing,
      borderRadius: 10, backgroundColor: "rgba(255,184,107,0.10)",
      borderWidth: 1, borderColor: "rgba(255,184,107,0.28)",
    },
    errorBannerText: { flex: 1, color: "#FFB86B", fontSize: 12 },

    /* 主体：播放器为主角 */
    bodyWide: { flex: 1, flexDirection: "row", gap: spacing, minHeight: 0 },
    bodyNarrow: { flex: 1, flexDirection: "column", gap: spacing, minHeight: 0 },
    heroBackdrop: {
      flex: 1.45, minWidth: 0, borderRadius: 24, padding: isTV ? 24 : 18,
      alignItems: "center", overflow: "hidden", position: "relative",
      borderWidth: 1, borderColor: Colors.surface.border,
    },
    heroBackdropCompact: { flex: 0 },
    coverGlow: { position: "absolute", top: 10, left: "50%" },
    heroTopRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      width: "100%", gap: 8, zIndex: 1,
    },
    stateBadge: {
      flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 12, backgroundColor: "rgba(0,0,0,0.28)",
    },
    stateDot: { width: 7, height: 7, borderRadius: 4 },
    stateText: { fontSize: 11, fontWeight: "600", color: "#fff" },
    heroSource: { fontSize: 10, color: "rgba(255,255,255,0.72)", flexShrink: 1, textAlign: "right" },
    heroCover: {
      alignItems: "center", justifyContent: "center", overflow: "hidden",
      marginTop: isTV ? 18 : 14, marginBottom: isTV ? 16 : 12, zIndex: 1,
    },
    nowRow: { flexDirection: "row", alignItems: "center", width: "100%", gap: 10, zIndex: 1 },
    nowText: { flex: 1, minWidth: 0 },
    nowTitle: { fontSize: isTV ? 28 : isWide ? 22 : 19, fontWeight: "bold", color: "#fff" },
    nowArtist: { fontSize: 11, color: Colors.text.secondary, marginTop: 4 },
    stopRound: {
      width: isTV ? 42 : 36, height: isTV ? 42 : 36, borderRadius: isTV ? 21 : 18,
      alignItems: "center", justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
    },

    /* 进度条 */
    liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing, zIndex: 1 },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.brand.live },
    liveRowText: { fontSize: 11, color: Colors.text.secondary },
    progressTrack: {
      flexDirection: "row", width: "100%", height: 6, borderRadius: 3,
      backgroundColor: Colors.surface.overlay, marginTop: isTV ? 18 : 14, zIndex: 1,
    },
    progressFill: { height: "100%", backgroundColor: Colors.brand.accent, borderRadius: 3 },
    progressKnob: {
      position: "absolute", top: -2, width: 10, height: 10, marginLeft: -5,
      borderRadius: 5, backgroundColor: "#fff",
    },
    timeRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 6, zIndex: 1 },
    timeText: { fontSize: 11, color: Colors.text.tertiary },

    /* 五键控制 + 四工具 */
    controls: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      width: "100%", maxWidth: 420, marginTop: isTV ? 18 : 14, zIndex: 1,
    },
    ctrlSide: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    ctrlBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    playBtn: {
      width: isTV ? 72 : 60, height: isTV ? 72 : 60, borderRadius: isTV ? 36 : 30,
      backgroundColor: Colors.brand.accent, alignItems: "center", justifyContent: "center",
      shadowColor: Colors.brand.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    },
    toolRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      width: "100%", maxWidth: 420, marginTop: isTV ? 18 : 14, zIndex: 1, gap: 8,
    },
    toolButton: {
      flex: 1, alignItems: "center", justifyContent: "center", gap: 3,
      minHeight: isTV ? 58 : 50, borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: Colors.surface.border,
    },
    toolButtonActive: { backgroundColor: "rgba(0,230,168,0.12)", borderColor: "rgba(0,230,168,0.45)" },
    toolLabel: { fontSize: 10, color: Colors.text.tertiary },
    toolLabelActive: { color: Colors.brand.accent },
    volumeRow: {
      flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10,
      flexWrap: "wrap", justifyContent: "center", zIndex: 1,
    },
    volumeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: Colors.surface.overlay },
    volumeChipActive: { backgroundColor: "rgba(0,230,168,0.2)", borderWidth: 1, borderColor: Colors.brand.accent },
    volumeText: { fontSize: 11 },
    errorText: { color: "#ff6b6b", fontSize: 12, marginTop: 8, textAlign: "center", zIndex: 1 },
    lyricsBox: {
      width: "100%", marginTop: spacing, paddingTop: spacing,
      borderTopWidth: 1, borderTopColor: Colors.surface.border, maxHeight: isTV ? 140 : 90, zIndex: 1,
    },
    lyricsTitle: { fontSize: 12, fontWeight: "600", marginBottom: 6, color: Colors.brand.accent },
    lyricsLine: { fontSize: 12, color: Colors.text.secondary, textAlign: "center", lineHeight: 20 },

    /* 曲目列表（次栏） */
    listPanel: {
      flex: 1, minWidth: 0, backgroundColor: Colors.surface.raised, borderRadius: 20,
      borderWidth: 1, borderColor: Colors.surface.border, padding: spacing,
    },
    listPanelCompact: { flex: 1, minHeight: 180 },
    listContent: { paddingBottom: spacing },
    panelHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    panelTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
    panelHint: { fontSize: 11, color: Colors.text.tertiary },
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

    /* 添加音源弹窗 */
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
