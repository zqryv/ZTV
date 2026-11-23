/**
 * 收音机页（分类「收音机」）。
 * 内置已验证的网络电台流 + 自定义电台，使用统一的 audioPlayer 播放。
 * 支持 TV 遥控器（上下选台 / 左右切台 / select 播放停止）与多端布局。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Radio, Play, Pause, Square, Plus, Trash2, X, Volume2, Signal } from "lucide-react-native";
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
import { BUILTIN_RADIO_STATIONS, RADIO_CATEGORIES, RadioStation } from "@/constants/AudioLibrary";

export default function RadioScreen() {
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const {
    stations,
    currentStationId,
    volume,
    loadCustomSources,
    addCustomStation,
    removeCustomStation,
    setCurrentStation,
    setVolume,
  } = useAudioStore();

  const [playback, setPlayback] = useState<AudioPlaybackState>(INITIAL_AUDIO_STATE);
  const [category, setCategory] = useState("全部");
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);

  const filtered = useMemo(
    () => (category === "全部" ? stations : stations.filter((s) => s.category === category)),
    [stations, category]
  );
  const currentStation = useMemo(
    () => stations.find((s) => s.id === currentStationId) ?? null,
    [stations, currentStationId]
  );
  const categories = useMemo(
    () => Array.from(new Set([...RADIO_CATEGORIES, ...stations.map((s) => s.category)])),
    [stations]
  );

  useEffect(() => {
    loadCustomSources();
    audioPlayer.setListener(setPlayback);
    return () => {
      audioPlayer.setListener(null);
      audioPlayer.unload();
    };
  }, [loadCustomSources]);

  const startStation = useCallback(
    async (id: string) => {
      const station = stations.find((s) => s.id === id);
      if (!station) return;
      setCurrentStation(id);
      await audioPlayer.play(station.url);
      await audioPlayer.setVolume(volume);
    },
    [stations, setCurrentStation, volume]
  );

  const stopStation = useCallback(async () => {
    await audioPlayer.unload();
    setPlayback(INITIAL_AUDIO_STATE);
  }, []);

  const stepStation = useCallback(
    (direction: 1 | -1) => {
      if (filtered.length === 0) return;
      const idx = filtered.findIndex((s) => s.id === currentStationId);
      const nextIdx = idx < 0 ? 0 : (idx + direction + filtered.length) % filtered.length;
      startStation(filtered[nextIdx].id);
    },
    [filtered, currentStationId, startStation]
  );

  // TV 遥控器：左右切台，上下移动列表焦点，select 播放/停止
  const handleTVEvent = useCallback(
    (event: any) => {
      switch (event.eventType) {
        case "left":
          stepStation(-1);
          break;
        case "right":
          stepStation(1);
          break;
        case "up":
          setFocusIndex((i) => Math.max(0, i - 1));
          break;
        case "down":
          setFocusIndex((i) => Math.min(filtered.length - 1, i + 1));
          break;
        case "select":
          if (filtered[focusIndex]) startStation(filtered[focusIndex].id);
          break;
      }
    },
    [stepStation, filtered, focusIndex, startStation]
  );
  useSafeTVEventHandler(handleTVEvent);

  const handleAddStation = async () => {
    const raw = newUrl.trim();
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
      Toast.show({ type: "error", text1: "请填写有效的电台地址" });
      return;
    }
    const station = await addCustomStation(newName, newCategory, url);
    setAddModalVisible(false);
    setNewName("");
    setNewCategory("");
    setNewUrl("");
    Toast.show({ type: "success", text1: "已添加，正在播放" });
    await startStation(station.id);
  };

  const handleDelete = (station: RadioStation) => {
    Alert.alert("删除电台", `确定移除「${station.name}」吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => removeCustomStation(station.id) },
    ]);
  };

  const dyn = useMemo(() => createStyles(deviceType, spacing), [deviceType, spacing]);

  const renderStation = ({ item, index }: { item: RadioStation; index: number }) => {
    const isCurrent = item.id === currentStationId;
    return (
      <TouchableOpacity
        style={[
          dyn.stationCard,
          isCurrent && dyn.stationCardActive,
          deviceType === "tv" && focusIndex === index && dyn.stationCardFocused,
        ]}
        onPress={() => startStation(item.id)}
        activeOpacity={0.75}
      >
        <LinearGradient
          colors={[`${item.accent}33`, Colors.surface.overlay]}
          style={dyn.stationIcon}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Radio size={deviceType === "tv" ? 26 : 20} color={item.accent} />
        </LinearGradient>
        <View style={dyn.stationInfo}>
          <View style={dyn.stationTitleRow}>
            <ThemedText style={[dyn.stationName, isCurrent && dyn.stationNameActive]} numberOfLines={1}>
              {item.name}
            </ThemedText>
            {isCurrent && playback.isPlaying && (
              <View style={dyn.liveDot} />
            )}
          </View>
          <ThemedText style={dyn.stationDesc} numberOfLines={1}>
            {item.category} · {item.description}
          </ThemedText>
        </View>
        {!BUILTIN_RADIO_STATIONS.some((b) => b.id === item.id) && (
          <TouchableOpacity onPress={() => handleDelete(item)} style={dyn.deleteBtn}>
            <Trash2 size={16} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const content = (
    <ThemedView style={[commonStyles.container, dyn.container]}>
      {/* 顶部 */}
      <View style={dyn.pageHeader}>
        <View style={dyn.pageTitleRow}>
          <LinearGradient colors={["#00E6A8", "#00B884"]} style={dyn.badge}>
            <Radio size={18} color={Colors.brand.onAccent} />
          </LinearGradient>
          <View>
            <ThemedText style={dyn.pageTitle}>收音机</ThemedText>
            <ThemedText style={dyn.pageSubtitle}>网络电台 · 实时收听</ThemedText>
          </View>
        </View>
        <StyledButton text="添加电台" variant="primary" onPress={() => setAddModalVisible(true)} style={dyn.addButton}>
          <Plus size={16} color="#fff" />
        </StyledButton>
      </View>

      {/* 分类胶囊 */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={dyn.categoryBar}
        renderItem={({ item }) => (
          <StyledButton
            text={item}
            isSelected={category === item}
            variant="default"
            onPress={() => setCategory(item)}
            style={dyn.pill}
            textStyle={dyn.pillText}
          />
        )}
      />

      {/* 正在播放条 */}
      <LinearGradient
        colors={[`${currentStation?.accent ?? "#00E6A8"}33`, Colors.surface.raised]}
        style={dyn.nowBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={dyn.nowInfo}>
          <Signal size={18} color={Colors.brand.accent} />
          <View style={dyn.nowTextWrap}>
            <ThemedText style={dyn.nowTitle} numberOfLines={1}>
              {currentStation ? currentStation.name : "选择一个电台开始收听"}
            </ThemedText>
            <ThemedText style={dyn.nowSub} numberOfLines={1}>
              {playback.isLoading
                ? "正在连接音频流…"
                : playback.isPlaying
                ? "正在播放"
                : currentStation
                ? "已停止"
                : "ZTV 收音机"}
            </ThemedText>
          </View>
        </View>
        <View style={dyn.nowControls}>
          <StyledButton variant="ghost" onPress={() => stepStation(-1)} style={dyn.ctrlBtn}>
            <Play size={18} color="#fff" style={{ transform: [{ rotate: "180deg" }] }} />
          </StyledButton>
          <TouchableOpacity
            style={dyn.playBtn}
            onPress={async () => {
              if (!currentStation) {
                if (filtered[0]) await startStation(filtered[0].id);
                return;
              }
              if (!audioPlayer.getCurrentUrl()) await startStation(currentStation.id);
              else await audioPlayer.toggle();
            }}
          >
            {playback.isPlaying ? (
              <Pause size={22} color={Colors.brand.onAccent} />
            ) : (
              <Play size={22} color={Colors.brand.onAccent} />
            )}
          </TouchableOpacity>
          <StyledButton variant="ghost" onPress={() => stepStation(1)} style={dyn.ctrlBtn}>
            <Play size={18} color="#fff" />
          </StyledButton>
          <StyledButton variant="ghost" onPress={stopStation} style={dyn.ctrlBtn}>
            <Square size={16} color={Colors.text.secondary} />
          </StyledButton>
        </View>
      </LinearGradient>

      {playback.error && <ThemedText style={dyn.errorText}>{playback.error}</ThemedText>}

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

      {/* 电台列表 */}
      <FlatList
        data={filtered}
        renderItem={renderStation}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dyn.listContent}
        ListEmptyComponent={
          <ThemedText style={dyn.emptyText}>该分类下暂无电台，可点击右上角添加</ThemedText>
        }
      />

      {/* 添加自定义电台 */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={dyn.modalOverlay}>
          <View style={dyn.modalCard}>
            <View style={dyn.modalHeader}>
              <ThemedText style={dyn.modalTitle}>添加网络电台</ThemedText>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <X size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <ThemedText style={dyn.modalHint}>填入电台音频流地址（mp3 / aac / m3u8）</ThemedText>
            <TextInput
              style={dyn.modalInput}
              placeholder="电台名称"
              placeholderTextColor="#888"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={dyn.modalInput}
              placeholder="分类（如：音乐 / 新闻，选填）"
              placeholderTextColor="#888"
              value={newCategory}
              onChangeText={setNewCategory}
            />
            <View style={dyn.urlPrefixRow}>
              <ThemedText style={dyn.urlPrefix}>https://</ThemedText>
              <TextInput
                style={[dyn.modalInput, dyn.urlInput]}
                placeholder="stream.example.com/live.mp3"
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
              <StyledButton text="添加并播放" variant="primary" onPress={handleAddStation} style={dyn.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );

  if (deviceType === "tv") return content;
  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="收音机" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createStyles = (deviceType: string, spacing: number) => {
  const isTV = deviceType === "tv";
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
    categoryBar: { flexGrow: 0, marginBottom: spacing },
    pill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
    pillText: { fontSize: 13 },
    nowBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Colors.surface.border,
      padding: spacing,
      marginBottom: spacing,
      flexWrap: "wrap",
      gap: 10,
    },
    nowInfo: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
    nowTextWrap: { flexShrink: 1 },
    nowTitle: { fontSize: isTV ? 22 : 17, fontWeight: "bold" },
    nowSub: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
    nowControls: { flexDirection: "row", alignItems: "center", gap: 8 },
    ctrlBtn: { padding: 8, borderRadius: 20 },
    playBtn: {
      width: isTV ? 56 : 46,
      height: isTV ? 56 : 46,
      borderRadius: isTV ? 28 : 23,
      backgroundColor: Colors.brand.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    errorText: { color: "#ff6b6b", fontSize: 12, textAlign: "center", marginBottom: 8 },
    volumeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing },
    volumeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: Colors.surface.overlay },
    volumeChipActive: { backgroundColor: "rgba(0,230,168,0.2)", borderWidth: 1, borderColor: Colors.brand.accent },
    volumeText: { fontSize: 11 },
    listContent: { paddingBottom: spacing },
    stationCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: Colors.surface.raised,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Colors.surface.border,
      padding: spacing,
      marginBottom: 10,
    },
    stationCardActive: { borderColor: Colors.brand.accent, backgroundColor: "rgba(0,230,168,0.08)" },
    stationCardFocused: { borderWidth: 2, borderColor: Colors.brand.accent },
    stationIcon: {
      width: isTV ? 54 : 42,
      height: isTV ? 54 : 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    stationInfo: { flex: 1, marginLeft: 12 },
    stationTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    stationName: { fontSize: isTV ? 20 : 15, fontWeight: "600" },
    stationNameActive: { color: Colors.brand.accent },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brand.live },
    stationDesc: { fontSize: 11, color: Colors.text.tertiary, marginTop: 3 },
    deleteBtn: { padding: 6 },
    emptyText: { fontSize: 13, color: Colors.text.tertiary, textAlign: "center", padding: 24 },
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
    urlPrefixRow: { flexDirection: "row", alignItems: "center" },
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
