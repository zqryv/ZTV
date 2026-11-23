/**
 * 音乐播放页（分类「音乐播放」）。
 *
 * 参考 any-listen 的交互概念：歌单切换、曲目元数据、封面、歌词、播放控制。
 * 全部基于项目既有组件（ThemedView / StyledButton / ResponsiveNavigation），
 * 播放能力来自 services/audioPlayer（expo-av，已在项目依赖中）。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from "react-native";
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
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import { Colors } from "@/constants/Colors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useSafeTVEventHandler } from "@/hooks/useSafeTVEventHandler";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { useAudioStore } from "@/stores/audioStore";
import { audioPlayer, INITIAL_AUDIO_STATE, AudioPlaybackState } from "@/services/audioPlayer";
import { MusicTrack } from "@/constants/AudioLibrary";

const formatTime = (ms: number) => {
  if (!ms || ms < 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function MusicScreen() {
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

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
  } = useAudioStore();

  const [playback, setPlayback] = useState<AudioPlaybackState>(INITIAL_AUDIO_STATE);
  const [autoNext, setAutoNext] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  // 进度条采用 flex:1 自适应宽度，用 onLayout 实测，避免读取样式对象
  const [progressWidth, setProgressWidth] = useState(0);

  const playlistTracks = useMemo(() => getPlaylistTracks(), [getPlaylistTracks, tracks, activePlaylistId]);
  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) ?? null,
    [tracks, currentTrackId]
  );

  useEffect(() => {
    loadCustomSources();
    audioPlayer.setListener(setPlayback);
    return () => {
      audioPlayer.setListener(null);
      audioPlayer.unload();
    };
  }, [loadCustomSources]);

  const startTrack = useCallback(
    async (trackId: string | null) => {
      if (!trackId) return;
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      setCurrentTrack(trackId);
      setAutoNext(true);
      await audioPlayer.play(track.url);
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
    // 播放超过 3 秒时，上一首先回到开头（与主流播放器一致）
    if (playback.positionMs > 3000) {
      await audioPlayer.seekTo(0);
      return;
    }
    const prev = getPrevTrackId();
    if (prev) await startTrack(prev);
  }, [playback.positionMs, getPrevTrackId, startTrack]);

  // 播完自动下一首 / 单曲循环
  useEffect(() => {
    if (!playback.didFinish || !autoNext) return;
    if (repeatMode === "one" && currentTrack) {
      audioPlayer.play(currentTrack.url);
      return;
    }
    const next = getNextTrackId();
    if (next) startTrack(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.didFinish]);

  // TV 遥控器：左右切歌，上下移动列表焦点，select 播放
  const handleTVEvent = useCallback(
    (event: any) => {
      switch (event.eventType) {
        case "left":
          handlePrev();
          break;
        case "right":
          handleNext();
          break;
        case "select":
        case "playPause":
          audioPlayer.toggle();
          break;
        case "up":
          setFocusIndex((i) => Math.max(0, i - 1));
          break;
        case "down":
          setFocusIndex((i) => Math.min(playlistTracks.length - 1, i + 1));
          break;
      }
    },
    [handlePrev, handleNext, playlistTracks.length]
  );
  useSafeTVEventHandler(handleTVEvent);

  const handleToggle = async () => {
    if (!currentTrack) {
      await startTrack(playlistTracks[0]?.id ?? null);
      return;
    }
    if (!audioPlayer.getCurrentUrl()) {
      await startTrack(currentTrack.id);
      return;
    }
    await audioPlayer.toggle();
  };

  const handleAddSource = async () => {
    const raw = newUrl.trim();
    // 输入框固定显示 https:// 前缀，用户只需填后半段；若已粘贴完整地址也兼容
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
    Toast.show({ type: "success", text1: "已添加，正在播放" });
    await startTrack(track.id);
  };

  const handleDelete = (track: MusicTrack) => {
    Alert.alert("删除曲目", `确定从「我的音乐」移除「${track.title}」吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => removeCustomTrack(track.id) },
    ]);
  };

  const progress = playback.durationMs > 0 ? playback.positionMs / playback.durationMs : 0;

  const renderTrack = ({ item, index }: { item: MusicTrack; index: number }) => {
    const isCurrent = item.id === currentTrackId;
    const isCustom = !tracks.length ? false : !item.album?.includes("演示");
    return (
      <TouchableOpacity
        style={[
          dyn.trackRow,
          isCurrent && dyn.trackRowActive,
          deviceType === "tv" && focusIndex === index && dyn.trackRowFocused,
        ]}
        onPress={() => startTrack(item.id)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={[item.accent, `${item.accent}55`]}
          style={dyn.trackCover}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Music2 size={deviceType === "tv" ? 22 : 16} color="#fff" />
        </LinearGradient>
        <View style={dyn.trackInfo}>
          <ThemedText style={[dyn.trackTitle, isCurrent && dyn.trackTitleActive]} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <ThemedText style={dyn.trackArtist} numberOfLines={1}>
            {item.artist} · {item.album ?? "我的音乐"}
          </ThemedText>
        </View>
        <ThemedText style={dyn.trackDuration}>{item.durationLabel ?? "--:--"}</ThemedText>
        {isCustom && (
          <TouchableOpacity onPress={() => handleDelete(item)} style={dyn.deleteBtn}>
            <Trash2 size={16} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const dyn = useMemo(() => createStyles(deviceType, spacing), [deviceType, spacing]);

  const content = (
    <ThemedView style={[commonStyles.container, dyn.container]}>
      {/* 顶部：标题 + 添加音源 */}
      <View style={dyn.pageHeader}>
        <View style={dyn.pageTitleRow}>
          <LinearGradient colors={["#00E6A8", "#00B884"]} style={dyn.badge}>
            <Music2 size={18} color={Colors.brand.onAccent} />
          </LinearGradient>
          <View>
            <ThemedText style={dyn.pageTitle}>音乐播放</ThemedText>
            <ThemedText style={dyn.pageSubtitle}>歌单 · 歌词 · 在线音源</ThemedText>
          </View>
        </View>
        <StyledButton
          text="添加音源"
          variant="primary"
          onPress={() => setAddModalVisible(true)}
          style={dyn.addButton}
        >
          <Plus size={16} color="#fff" />
        </StyledButton>
      </View>

      {/* 歌单切换（胶囊） */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dyn.playlistBar}>
        {playlists.map((p) => (
          <StyledButton
            key={p.id}
            text={`${p.name} (${p.trackIds.length})`}
            isSelected={activePlaylistId === p.id}
            variant="default"
            onPress={() => {
              setActivePlaylist(p.id);
              setAutoNext(false);
              audioPlayer.pause();
            }}
            style={dyn.pill}
            textStyle={dyn.pillText}
          />
        ))}
      </ScrollView>

      <View style={dyn.body}>
        {/* 左侧：曲目列表 */}
        <View style={dyn.listPanel}>
          <View style={dyn.panelHeader}>
            <ListMusic size={16} color={Colors.brand.accent} />
            <ThemedText style={dyn.panelTitle}>播放列表</ThemedText>
          </View>
          <FlatList
            data={playlistTracks}
            renderItem={renderTrack}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <ThemedText style={dyn.emptyText}>暂无曲目，点击右上角添加音源</ThemedText>
            }
          />
        </View>

        {/* 右侧：正在播放 + 歌词 */}
        <View style={dyn.playerPanel}>
          <LinearGradient
            colors={[currentTrack?.accent ?? "#00E6A8", Colors.surface.raised]}
            style={dyn.heroCover}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Music2 size={deviceType === "tv" ? 72 : 48} color="rgba(255,255,255,0.85)" />
          </LinearGradient>
          <ThemedText style={dyn.nowTitle} numberOfLines={1}>
            {currentTrack?.title ?? "选择一首曲目"}
          </ThemedText>
          <ThemedText style={dyn.nowArtist} numberOfLines={1}>
            {currentTrack ? `${currentTrack.artist} · ${currentTrack.album ?? ""}` : "ZTV 音乐播放"}
          </ThemedText>

          {/* 进度条 */}
          <View style={dyn.progressRow}>
            <ThemedText style={dyn.timeText}>{formatTime(playback.positionMs)}</ThemedText>
            <TouchableOpacity
              style={dyn.progressTrack}
              activeOpacity={1}
              onLayout={(e) => setProgressWidth(e.nativeEvent.layout.width)}
              onPress={(e) => {
                if (!playback.durationMs || progressWidth <= 0) return;
                const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / progressWidth));
                audioPlayer.seekTo(ratio * playback.durationMs);
              }}
            >
              <View style={[dyn.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
            </TouchableOpacity>
            <ThemedText style={dyn.timeText}>
              {playback.durationMs ? formatTime(playback.durationMs) : currentTrack?.durationLabel ?? "--:--"}
            </ThemedText>
          </View>

          {/* 控制条 */}
          <View style={dyn.controls}>
            <StyledButton variant="ghost" onPress={cycleRepeat} style={dyn.ctrlSmall}>
              {repeatMode === "one" ? (
                <Repeat1 size={18} color={Colors.brand.accent} />
              ) : (
                <Repeat size={18} color={repeatMode === "off" ? Colors.text.tertiary : Colors.brand.accent} />
              )}
            </StyledButton>
            <StyledButton variant="ghost" onPress={handlePrev} style={dyn.ctrlBtn}>
              <SkipBack size={deviceType === "tv" ? 28 : 22} color="#fff" />
            </StyledButton>
            <TouchableOpacity style={dyn.playBtn} onPress={handleToggle} activeOpacity={0.8}>
              {playback.isPlaying ? (
                <Pause size={deviceType === "tv" ? 34 : 26} color={Colors.brand.onAccent} />
              ) : (
                <Play size={deviceType === "tv" ? 34 : 26} color={Colors.brand.onAccent} />
              )}
            </TouchableOpacity>
            <StyledButton variant="ghost" onPress={handleNext} style={dyn.ctrlBtn}>
              <SkipForward size={deviceType === "tv" ? 28 : 22} color="#fff" />
            </StyledButton>
            <StyledButton variant="ghost" onPress={toggleShuffle} style={dyn.ctrlSmall}>
              <Shuffle size={18} color={shuffle ? Colors.brand.accent : Colors.text.tertiary} />
            </StyledButton>
          </View>

          {/* 音量 */}
          <View style={dyn.volumeRow}>
            <Volume2 size={16} color={Colors.text.secondary} />
            {[0.25, 0.5, 0.75, 1].map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => {
                  setVolume(v);
                  audioPlayer.setVolume(v);
                }}
                style={[dyn.volumeChip, volume === v && dyn.volumeChipActive]}
              >
                <ThemedText style={dyn.volumeText}>{Math.round(v * 100)}%</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {playback.error && <ThemedText style={dyn.errorText}>{playback.error}</ThemedText>}

          {/* 歌词 */}
          <View style={dyn.lyricsBox}>
            <ThemedText style={dyn.lyricsTitle}>歌词</ThemedText>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(currentTrack?.lyrics ?? ["选择曲目后显示歌词", "—— ZTV 音乐播放"]).map((line, i) => (
                <ThemedText key={i} style={dyn.lyricsLine}>
                  {line}
                </ThemedText>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* 添加自定义音源弹窗 */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={dyn.modalOverlay}>
          <View style={dyn.modalCard}>
            <View style={dyn.modalHeader}>
              <ThemedText style={dyn.modalTitle}>添加在线音源</ThemedText>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <X size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ThemedText style={dyn.modalHint}>填入可直连的 mp3 / m3u8 音频地址</ThemedText>
            <TextInput
              style={dyn.modalInput}
              placeholder="名称（如：我的歌单 01）"
              placeholderTextColor="#888"
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={dyn.modalInput}
              placeholder="艺术家（选填）"
              placeholderTextColor="#888"
              value={newArtist}
              onChangeText={setNewArtist}
            />
            <View style={dyn.urlPrefixRow}>
              <ThemedText style={dyn.urlPrefix}>https://</ThemedText>
              <TextInput
                style={[dyn.modalInput, dyn.urlInput]}
                placeholder="example.com/music.mp3"
                placeholderTextColor="#888"
                value={newUrl}
                onChangeText={setNewUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
            <View style={dyn.modalActions}>
              <StyledButton text="取消" variant="ghost" onPress={() => setAddModalVisible(false)} style={dyn.modalBtn} />
              <StyledButton text="添加并播放" variant="primary" onPress={handleAddSource} style={dyn.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
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
  const isMobile = deviceType === "mobile";
  const isWide = deviceType === "desktop" || deviceType === "tablet" || isTV;
  return StyleSheet.create({
    container: { flex: 1, paddingTop: isTV ? 40 : 0, paddingHorizontal: spacing, paddingBottom: spacing },
    pageHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing,
      marginTop: isTV ? spacing : spacing / 2,
    },
    pageTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    badge: {
      width: isTV ? 44 : 36,
      height: isTV ? 44 : 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    pageTitle: { fontSize: isTV ? 30 : 22, fontWeight: "bold" },
    pageSubtitle: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },
    addButton: { borderRadius: 20, paddingHorizontal: 18 },
    playlistBar: { marginBottom: spacing, flexGrow: 0 },
    pill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
    pillText: { fontSize: 13 },
    body: { flex: 1, flexDirection: isWide ? "row" : "column", gap: spacing },
    listPanel: {
      flex: isWide ? 1 : 1,
      backgroundColor: Colors.surface.raised,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.surface.border,
      padding: spacing,
      maxHeight: isMobile ? 220 : undefined,
    },
    panelHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    panelTitle: { fontSize: 15, fontWeight: "600" },
    trackRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 10,
      marginBottom: 4,
    },
    trackRowActive: { backgroundColor: "rgba(0,230,168,0.12)" },
    trackRowFocused: { borderWidth: 2, borderColor: Colors.brand.accent },
    trackCover: {
      width: isTV ? 46 : 36,
      height: isTV ? 46 : 36,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    trackInfo: { flex: 1, marginLeft: 12 },
    trackTitle: { fontSize: isTV ? 18 : 14, fontWeight: "600" },
    trackTitleActive: { color: Colors.brand.accent },
    trackArtist: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
    trackDuration: { fontSize: 11, color: Colors.text.tertiary },
    deleteBtn: { marginLeft: 10, padding: 4 },
    emptyText: { fontSize: 13, color: Colors.text.tertiary, textAlign: "center", padding: 20 },
    playerPanel: {
      flex: isWide ? 1 : 1,
      backgroundColor: Colors.surface.raised,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.surface.border,
      padding: spacing,
      alignItems: "center",
    },
    heroCover: {
      width: isTV ? 180 : isMobile ? 120 : 150,
      height: isTV ? 180 : isMobile ? 120 : 150,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing,
    },
    nowTitle: { fontSize: isTV ? 26 : 20, fontWeight: "bold", textAlign: "center" },
    nowArtist: { fontSize: 12, color: Colors.text.tertiary, marginTop: 4, textAlign: "center" },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      gap: 8,
      marginTop: spacing,
    },
    timeText: { fontSize: 11, color: Colors.text.tertiary, minWidth: 40, textAlign: "center" },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: Colors.surface.overlay,
      overflow: "hidden",
    },
    progressFill: { height: "100%", backgroundColor: Colors.brand.accent, borderRadius: 3 },
    controls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: isTV ? 16 : 8,
      marginTop: spacing,
    },
    ctrlSmall: { padding: 8, borderRadius: 20 },
    ctrlBtn: { padding: 10, borderRadius: 24 },
    playBtn: {
      width: isTV ? 68 : 54,
      height: isTV ? 68 : 54,
      borderRadius: isTV ? 34 : 27,
      backgroundColor: Colors.brand.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    volumeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing },
    volumeChip: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: Colors.surface.overlay,
    },
    volumeChipActive: { backgroundColor: "rgba(0,230,168,0.2)", borderWidth: 1, borderColor: Colors.brand.accent },
    volumeText: { fontSize: 11 },
    errorText: { color: "#ff6b6b", fontSize: 12, marginTop: 8, textAlign: "center" },
    lyricsBox: {
      width: "100%",
      marginTop: spacing,
      paddingTop: spacing,
      borderTopWidth: 1,
      borderTopColor: Colors.surface.border,
      maxHeight: isTV ? 160 : 110,
    },
    lyricsTitle: { fontSize: 13, fontWeight: "600", marginBottom: 8, color: Colors.brand.accent },
    lyricsLine: { fontSize: 12, color: Colors.text.secondary, textAlign: "center", lineHeight: 22 },
    modalOverlay: {
      flex: 1,
      backgroundColor: Colors.surface.scrim,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 520,
      backgroundColor: Colors.surface.raised,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.surface.border,
      padding: 20,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    modalTitle: { fontSize: 18, fontWeight: "bold" },
    modalHint: { fontSize: 12, color: Colors.text.tertiary, marginTop: 6, marginBottom: 14 },
    modalInput: {
      height: 46,
      borderWidth: 1,
      borderColor: Colors.surface.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 14,
      backgroundColor: Colors.surface.overlay,
      color: "#fff",
      marginBottom: 10,
    },
    urlPrefixRow: { flexDirection: "row", alignItems: "center", gap: 0 },
    urlPrefix: {
      fontSize: 14,
      color: Colors.brand.accent,
      fontWeight: "600",
      backgroundColor: Colors.surface.overlay,
      borderLeftWidth: 1,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: Colors.surface.border,
      borderTopLeftRadius: 10,
      borderBottomLeftRadius: 10,
      paddingHorizontal: 10,
      height: 46,
      textAlignVertical: "center",
    },
    urlInput: { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeftWidth: 0 },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
    modalBtn: { borderRadius: 20, paddingHorizontal: 18 },
  });
};
