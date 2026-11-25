/**
 * 收音机页（分类「收音机」）。
 *
 * 界面按工作区设计方案「19 收音机 Radio」（Ardot 设计稿 750387664062996）重新排布：
 * 全宽「调谐器焦点卡」（正在播出徽标 / FM 频率 / 台名 / 波形律动 / 四个圆形控制）
 * → 「探索电台」+ 一行分类胶囊 → 电台卡片列表；地区 / 在线目录 / 音量收进可折叠
 * 面板，去掉原先一屏堆满控件的杂乱感。
 *
 * 本次仅替换界面层，以下能力全部沿用 v2.2.0，接口与交互逻辑零改动：
 *  - 28 个实测可直连的内置电台（中国 / 欧美 / 日本 / 韩国）+ 首次进入静默补充在线目录
 *  - 地区 / 分类双维筛选、在线目录刷新与失败降级、自定义电台增删、音量档位
 *  - TV 遥控器上下选台 / 左右切台 / select 播放、明确的「停止」按钮
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
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Radio,
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  X,
  Volume2,
  Globe,
  RefreshCw,
  SkipBack,
  SkipForward,
  ListMusic,
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
import {
  BUILTIN_RADIO_STATIONS,
  RADIO_CATEGORIES,
  RADIO_COUNTRIES,
  RadioStation,
} from "@/constants/AudioLibrary";
import { loadOnlineStations } from "@/services/onlineMusic";

/** 波形律动条的基础高度（播放时按此序列呈现律动，暂停时压平） */
const WAVE_BARS = [10, 18, 28, 16, 36, 22, 42, 30, 38, 20, 32, 14, 26, 18, 30, 12, 22, 10];

/**
 * 设计稿右上角的 FM 频率读数。内置电台为网络流、本身没有频率字段，
 * 这里按 id 生成稳定的展示值（仅展示层，不改变数据接口）。
 */
const dialFrequency = (station: RadioStation | null) => {
  if (!station) return "FM --.-";
  let sum = 0;
  for (const ch of station.id) sum += ch.charCodeAt(0);
  return `FM ${(87.5 + (sum % 205) / 10).toFixed(1)}`;
};

export default function RadioScreen() {
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;
  const isWide = deviceType === "tv" || deviceType === "desktop" || deviceType === "tablet";

  const {
    stations,
    currentStationId,
    volume,
    loadCustomSources,
    addCustomStation,
    removeCustomStation,
    setCurrentStation,
    setVolume,
    setOnlineStations,
  } = useAudioStore();

  const [playback, setPlayback] = useState<AudioPlaybackState>(INITIAL_AUDIO_STATE);
  const [category, setCategory] = useState<string>("全部");
  const [country, setCountry] = useState<string>("全部");
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(isWide);
  const bootstrapped = useRef(false);

  const filtered = useMemo(
    () =>
      stations.filter((s) => {
        if (country !== "全部" && s.country !== country) return false;
        if (category !== "全部" && s.category !== category) return false;
        return true;
      }),
    [stations, country, category]
  );

  const currentStation = useMemo(
    () => stations.find((s) => s.id === currentStationId) ?? null,
    [stations, currentStationId]
  );

  const categories = useMemo(() => {
    const base = RADIO_CATEGORIES as readonly string[];
    const extras = stations.map((s) => s.category).filter((c) => c && !base.includes(c)).slice(0, 8);
    return Array.from(new Set([...base, ...extras]));
  }, [stations]);

  const builtinCount = useMemo(
    () => filtered.filter((s) => BUILTIN_RADIO_STATIONS.some((b) => b.id === s.id)).length,
    [filtered]
  );

  useEffect(() => {
    void loadCustomSources();
  }, [loadCustomSources]);

  /** 页面失焦立即停止并释放（Stack 中离开页面不会卸载组件） */
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

  /**
   * 首次进入静默补充在线电台；失败也无所谓——内置电台已可正常收听。
   * 这是「打开就有可用电台」的保障，不把可用性建立在外部目录上。
   */
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void (async () => {
      try {
        const results = await loadOnlineStations("全部", "全部", 40);
        if (results.length) {
          setOnlineStations(results);
          setOnlineCount(results.length);
        }
      } catch {
        // 静默降级：内置电台已足够
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startStation = useCallback(
    async (id: string) => {
      const station = stations.find((s) => s.id === id);
      if (!station) return;
      setCurrentStation(id);
      await audioPlayer.play(station.url, station.fallbackUrls);
      await audioPlayer.setVolume(volume);
    },
    [stations, setCurrentStation, volume]
  );

  /** 明确的「停止」：停止 + 卸载 Sound + 复位音频会话 */
  const stopStation = useCallback(async () => {
    await audioPlayer.stop();
  }, []);

  const stepStation = useCallback(
    (direction: 1 | -1) => {
      if (filtered.length === 0) return;
      const idx = filtered.findIndex((s) => s.id === currentStationId);
      const nextIdx = idx < 0 ? 0 : (idx + direction + filtered.length) % filtered.length;
      void startStation(filtered[nextIdx].id);
    },
    [filtered, currentStationId, startStation]
  );

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
          if (filtered[focusIndex]) void startStation(filtered[focusIndex].id);
          break;
        case "playPause":
          void audioPlayer.toggle();
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
    // 直接用返回的 station 播放，避免闭包里的 stations 尚未包含新电台
    setCurrentStation(station.id);
    await audioPlayer.play(station.url, station.fallbackUrls);
    await audioPlayer.setVolume(volume);
    Toast.show({ type: "success", text1: "已添加，正在播放" });
  };

  const handleDelete = (station: RadioStation) => {
    Alert.alert("删除电台", `确定移除「${station.name}」吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: () => removeCustomStation(station.id) },
    ]);
  };

  /** 手动按当前地区 / 分类刷新在线目录；失败保留内置电台 */
  const handleLoadOnline = useCallback(async () => {
    setOnlineLoading(true);
    setOnlineError(null);
    try {
      const results = await loadOnlineStations(country, category, 40);
      if (!results.length) {
        setOnlineError("该筛选条件下暂无在线电台，内置电台仍可收听");
        return;
      }
      setOnlineStations(results);
      setOnlineCount(results.length);
      setFocusIndex(0);
      Toast.show({ type: "success", text1: `已加载 ${results.length} 个在线电台` });
    } catch {
      setOnlineError("在线目录暂时不可用，已保留内置电台，可正常收听");
    } finally {
      setOnlineLoading(false);
    }
  }, [country, category, setOnlineStations]);

  /** 「查看全部」：清除地区 / 分类筛选，回到全部电台 */
  const showAllStations = useCallback(() => {
    setCountry("全部");
    setCategory("全部");
    setFocusIndex(0);
  }, []);

  const dyn = useMemo(() => createStyles(deviceType, spacing), [deviceType, spacing]);

  const renderStation = ({ item, index }: { item: RadioStation; index: number }) => {
    const isCurrent = item.id === currentStationId;
    const isBuiltin = BUILTIN_RADIO_STATIONS.some((b) => b.id === item.id);
    const isDeletable = !isBuiltin && !item.id.startsWith("online-");
    return (
      <TouchableOpacity
        style={[
          dyn.stationCard,
          isWide && dyn.stationCardGrid,
          isCurrent && dyn.stationCardActive,
          deviceType === "tv" && focusIndex === index && dyn.stationCardFocused,
        ]}
        onPress={() => void startStation(item.id)}
        activeOpacity={0.75}
      >
        <LinearGradient
          colors={[`${item.accent}66`, `${item.accent}18`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={dyn.stationIcon}
        >
          <Radio size={deviceType === "tv" ? 26 : 20} color={item.accent} />
        </LinearGradient>
        <View style={dyn.stationInfo}>
          <View style={dyn.stationTitleRow}>
            <ThemedText style={[dyn.stationName, isCurrent && dyn.stationNameActive]} numberOfLines={1}>
              {item.name}
            </ThemedText>
            {isCurrent && playback.isPlaying && <View style={dyn.liveDot} />}
          </View>
          <ThemedText style={dyn.stationDesc} numberOfLines={1}>
            {[item.description, item.country].filter(Boolean).join(" · ")}
          </ThemedText>
          <View style={dyn.stationTagRow}>
            <ThemedText style={dyn.stationSource}>{item.source ?? (isBuiltin ? "内置电台" : "自定义")}</ThemedText>
            {!!item.codec && <ThemedText style={dyn.stationCodec}>{item.codec}</ThemedText>}
          </View>
        </View>
        {isDeletable && (
          <TouchableOpacity onPress={() => handleDelete(item)} style={dyn.deleteBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Trash2 size={15} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
        <View style={[dyn.stationPlay, isCurrent && playback.isPlaying && dyn.stationPlayActive]}>
          {isCurrent && playback.isPlaying
            ? <Pause size={15} color={Colors.brand.onAccent} />
            : <Play size={15} color={Colors.text.primary} />}
        </View>
      </TouchableOpacity>
    );
  };

  const stateLabel = playback.isLoading
    ? "连接中"
    : playback.isPlaying
    ? "正在播出"
    : currentStation
    ? "已停止"
    : "待收听";

  // ── 设计稿页头：标题 + 副标题 + 圆形「+」 ────────────────────────────────
  const pageHeader = (
    <View style={dyn.pageHeader}>
      <View style={dyn.pageTitleRow}>
        <View style={dyn.pageTitleText}>
          <ThemedText style={dyn.pageTitle}>收音机</ThemedText>
          <ThemedText style={dyn.pageSubtitle} numberOfLines={1}>
            {`网络电台 · 实时收听 · 内置 ${BUILTIN_RADIO_STATIONS.length} 台 / 在线 ${onlineCount} 台`}
          </ThemedText>
        </View>
      </View>
      <TouchableOpacity
        style={dyn.addRound}
        onPress={() => setAddModalVisible(true)}
        accessibilityLabel="添加电台"
        activeOpacity={0.75}
      >
        <Plus size={22} color={Colors.brand.onAccent} />
      </TouchableOpacity>
    </View>
  );

  // ── 调谐器焦点卡 ────────────────────────────────────────────────────────
  const heroCard = (
    <LinearGradient
      colors={[`${currentStation?.accent ?? Colors.brand.accent}A6`, "#0C2A23", Colors.surface.base]}
      style={[dyn.heroCard, !isWide && dyn.heroCardCompact]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={dyn.heroTopRow}>
        <View style={dyn.liveBadge}>
          <View style={[dyn.liveDot, { backgroundColor: playback.isPlaying ? Colors.brand.live : "rgba(255,255,255,0.5)" }]} />
          <ThemedText style={dyn.liveBadgeText}>{stateLabel}</ThemedText>
        </View>
        <ThemedText style={dyn.heroFreq} numberOfLines={1}>{dialFrequency(currentStation)}</ThemedText>
      </View>

      <ThemedText style={dyn.heroTitle} numberOfLines={1}>
        {currentStation ? currentStation.name : "选择一个电台开始收听"}
      </ThemedText>
      <ThemedText style={dyn.heroDesc} numberOfLines={1}>
        {currentStation
          ? [currentStation.category, currentStation.country, currentStation.description].filter(Boolean).join(" · ")
          : "内置电台即点即播，无需联网加载目录"}
      </ThemedText>

      <View style={dyn.waveRow}>
        {WAVE_BARS.map((h, i) => (
          <View key={i} style={[dyn.waveBar, {
            height: playback.isPlaying ? h : 6,
            backgroundColor: i % 4 === 0 ? "rgba(255,255,255,0.72)" : Colors.brand.accent,
          }]} />
        ))}
      </View>

      {/* 四个圆形控制：上一台 / 播放暂停 / 下一台 / 音量与筛选 */}
      <View style={dyn.heroControls}>
        <TouchableOpacity style={dyn.roundCtrl} onPress={() => stepStation(-1)} accessibilityLabel="上一个电台" activeOpacity={0.75}>
          <SkipBack size={19} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={dyn.playRound}
          onPress={async () => {
            if (!currentStation) {
              if (filtered[0]) await startStation(filtered[0].id);
              return;
            }
            if (!audioPlayer.hasActiveSound()) await startStation(currentStation.id);
            else await audioPlayer.toggle();
          }}
          accessibilityLabel="播放或暂停"
          activeOpacity={0.8}
        >
          {playback.isPlaying
            ? <Pause size={26} color={Colors.brand.onAccent} />
            : <Play size={26} color={Colors.brand.onAccent} />}
        </TouchableOpacity>
        <TouchableOpacity style={dyn.roundCtrl} onPress={() => stepStation(1)} accessibilityLabel="下一个电台" activeOpacity={0.75}>
          <SkipForward size={19} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={dyn.roundCtrl}
          onPress={() => setFiltersOpen((v) => !v)}
          accessibilityLabel="音量与更多筛选"
          activeOpacity={0.75}
        >
          <Volume2 size={19} color="#fff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  // ── 探索电台：标题 + 查看全部 / 停止 ────────────────────────────────────
  const exploreHeader = (
    <View style={dyn.exploreHeader}>
      <View style={dyn.exploreTitleRow}>
        <ListMusic size={16} color={Colors.brand.accent} />
        <ThemedText style={dyn.exploreTitle}>探索电台</ThemedText>
        <ThemedText style={dyn.exploreCount} numberOfLines={1}>
          {`${filtered.length} 个 · 内置 ${builtinCount}`}
        </ThemedText>
      </View>
      <View style={dyn.exploreActions}>
        <TouchableOpacity onPress={showAllStations} style={dyn.textAction} activeOpacity={0.75}>
          <ThemedText style={dyn.textActionAccent}>查看全部</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void stopStation()} style={dyn.textAction} activeOpacity={0.75}>
          <Square size={12} color={Colors.text.secondary} />
          <ThemedText style={dyn.textActionMuted}>停止</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── 一行分类胶囊（常显），末尾为「更多筛选」入口 ────────────────────────
  const categoryBar = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dyn.categoryBar}>
      {categories.map((item) => (
        <StyledButton
          key={item}
          text={item}
          isSelected={category === item}
          variant="default"
          onPress={() => setCategory(item)}
          style={dyn.pill}
          textStyle={dyn.pillText}
        />
      ))}
      <StyledButton
        text={filtersOpen ? "收起筛选" : "更多筛选"}
        isSelected={false}
        variant="default"
        onPress={() => setFiltersOpen((v) => !v)}
        style={dyn.pillMore}
        textStyle={dyn.pillText}
      >
        <Globe size={13} color={Colors.brand.accent} />
      </StyledButton>
    </ScrollView>
  );

  // ── 可折叠面板：地区 / 在线目录 / 音量 ──────────────────────────────────
  const filterPanel = filtersOpen ? (
    <View style={dyn.filterPanel}>
      <ThemedText style={dyn.fieldLabel}>地区</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dyn.filterBar}>
        {RADIO_COUNTRIES.map((item) => (
          <StyledButton key={item} text={item} isSelected={country === item} variant="default"
            onPress={() => setCountry(item)} style={dyn.pill} textStyle={dyn.pillText} />
        ))}
      </ScrollView>
      <View style={dyn.onlineRow}>
        <StyledButton text={onlineLoading ? "加载中…" : "刷新在线目录"} variant="primary"
          onPress={() => void handleLoadOnline()} disabled={onlineLoading}
          style={dyn.onlineButton} textStyle={dyn.onlineButtonText}>
          <RefreshCw size={13} color="#fff" />
        </StyledButton>
        <ThemedText style={dyn.onlineHint} numberOfLines={1}>内置电台无需联网即可收听</ThemedText>
      </View>
      {!!onlineError && <ThemedText style={dyn.onlineErrorText}>{onlineError}</ThemedText>}
      <View style={dyn.volumeRow}>
        <Volume2 size={15} color={Colors.text.secondary} />
        {[0.25, 0.5, 0.75, 1].map((v) => (
          <TouchableOpacity key={v} onPress={() => { setVolume(v); void audioPlayer.setVolume(v); }}
            style={[dyn.volumeChip, volume === v && dyn.volumeChipActive]}>
            <ThemedText style={dyn.volumeText}>{Math.round(v * 100)}%</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ) : null;

  const errorLine = playback.error ? (
    <ThemedText style={dyn.errorText}>{playback.error}</ThemedText>
  ) : null;

  // 焦点卡全宽置顶，下方为分类 + 电台卡片（宽屏两列网格）
  const stationList = (
    <FlatList
      data={filtered}
      renderItem={renderStation}
      keyExtractor={(item) => item.id}
      numColumns={isWide ? 2 : 1}
      columnWrapperStyle={isWide ? dyn.gridRow : undefined}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={dyn.listContent}
      ListHeaderComponent={<View>{exploreHeader}{categoryBar}{filterPanel}{errorLine}</View>}
      ListEmptyComponent={<ThemedText style={dyn.emptyText}>该筛选下暂无电台，可点右上角添加或「查看全部」</ThemedText>}
    />
  );

  const modal = (
    <Modal visible={addModalVisible} transparent animationType="fade"
      onRequestClose={() => setAddModalVisible(false)}>
      <View style={dyn.modalOverlay}>
        <View style={dyn.modalCard}>
          <View style={dyn.modalHeader}>
            <ThemedText style={dyn.modalTitle}>添加网络电台</ThemedText>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <X size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
          <ThemedText style={dyn.modalHint}>填入电台音频流地址（mp3 / aac / m3u8）</ThemedText>
          <TextInput style={dyn.modalInput} placeholder="电台名称" placeholderTextColor="#888"
            value={newName} onChangeText={setNewName} />
          <TextInput style={dyn.modalInput} placeholder="分类（如：音乐 / 新闻，选填）" placeholderTextColor="#888"
            value={newCategory} onChangeText={setNewCategory} />
          <View style={dyn.urlPrefixRow}>
            <ThemedText style={dyn.urlPrefix}>https://</ThemedText>
            <TextInput style={[dyn.modalInput, dyn.urlInput]} placeholder="stream.example.com/live.mp3"
              placeholderTextColor="#888" value={newUrl} onChangeText={setNewUrl}
              autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          </View>
          <View style={dyn.modalActions}>
            <StyledButton text="取消" variant="ghost" onPress={() => setAddModalVisible(false)} style={dyn.modalBtn} />
            <StyledButton text="添加并播放" variant="primary" onPress={() => void handleAddStation()} style={dyn.modalBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dyn.container]}>
      {pageHeader}
      {heroCard}
      {stationList}
      {modal}
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
    pageTitle: { fontSize: isTV ? 32 : 24, fontWeight: "bold" },
    pageSubtitle: { fontSize: 11, color: Colors.text.tertiary, marginTop: 3 },
    addRound: {
      width: isTV ? 50 : 42, height: isTV ? 50 : 42, borderRadius: isTV ? 25 : 21,
      backgroundColor: Colors.brand.accent, alignItems: "center", justifyContent: "center",
    },

    /* 调谐器焦点卡 */
    heroCard: {
      borderRadius: 24, padding: isTV ? 28 : 20, marginBottom: spacing, overflow: "hidden",
      borderWidth: 1, borderColor: "rgba(0,230,168,0.18)",
    },
    heroCardCompact: { padding: 18, marginBottom: spacing / 2 },
    heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    liveBadge: {
      flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 12, backgroundColor: "rgba(0,0,0,0.28)",
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.brand.live },
    liveBadgeText: { fontSize: 11, fontWeight: "600", color: "#fff" },
    heroFreq: { fontSize: isTV ? 15 : 13, fontWeight: "700", color: "#fff", letterSpacing: 1 },
    heroTitle: { fontSize: isTV ? 30 : isWide ? 24 : 21, fontWeight: "700", color: "#fff", marginTop: 14 },
    heroDesc: { fontSize: 11, color: "rgba(255,255,255,0.78)", marginTop: 6 },
    waveRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
      height: isWide ? 48 : 38, marginVertical: isTV ? 18 : 12,
    },
    waveBar: { width: 4, borderRadius: 2 },
    heroControls: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: isTV ? 22 : 16, marginTop: 4,
    },
    roundCtrl: {
      width: isTV ? 56 : 46, height: isTV ? 56 : 46, borderRadius: isTV ? 28 : 23,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", backgroundColor: "rgba(255,255,255,0.06)",
    },
    playRound: {
      width: isTV ? 72 : 62, height: isTV ? 72 : 62, borderRadius: isTV ? 36 : 31,
      backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    },

    /* 探索电台 */
    exploreHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      gap: 8, marginBottom: 10, flexWrap: "wrap",
    },
    exploreTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
    exploreTitle: { fontSize: 16, fontWeight: "700" },
    exploreCount: { fontSize: 11, color: Colors.text.tertiary },
    exploreActions: { flexDirection: "row", alignItems: "center", gap: 12 },
    textAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
    textActionAccent: { fontSize: 12, fontWeight: "600", color: Colors.brand.accent },
    textActionMuted: { fontSize: 12, color: Colors.text.secondary },

    /* 分类胶囊 / 折叠筛选 */
    categoryBar: { marginBottom: 10, flexGrow: 0 },
    pill: { borderRadius: 20, paddingHorizontal: 15, paddingVertical: 7, marginRight: 8 },
    pillMore: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", gap: 5 },
    pillText: { fontSize: 12 },
    filterPanel: {
      borderRadius: 14, borderWidth: 1, borderColor: Colors.surface.border,
      backgroundColor: Colors.surface.raised, padding: 12, marginBottom: spacing,
    },
    fieldLabel: { fontSize: 11, color: Colors.text.tertiary, marginBottom: 6 },
    filterBar: { marginBottom: 10, flexGrow: 0 },
    onlineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    onlineButton: { borderRadius: 20, paddingHorizontal: 14, flexDirection: "row", gap: 6 },
    onlineButtonText: { fontSize: 12 },
    onlineHint: { fontSize: 11, color: Colors.text.tertiary, flex: 1 },
    onlineErrorText: { color: "#FFB86B", fontSize: 12, marginBottom: 8 },
    volumeRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
    volumeChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: Colors.surface.overlay },
    volumeChipActive: { backgroundColor: "rgba(0,230,168,0.2)", borderWidth: 1, borderColor: Colors.brand.accent },
    volumeText: { fontSize: 11 },
    errorText: { color: "#ff6b6b", fontSize: 12, textAlign: "center", marginBottom: 8 },

    /* 电台卡片 */
    gridRow: { gap: 10 },
    listContent: { paddingBottom: spacing },
    stationCard: {
      flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface.raised,
      borderRadius: 16, borderWidth: 1, borderColor: Colors.surface.border,
      padding: isTV ? 16 : 12, marginBottom: 10, minWidth: 0,
    },
    stationCardGrid: { flex: 1, marginRight: 0 },
    stationCardActive: { borderColor: Colors.brand.accent, backgroundColor: "rgba(0,230,168,0.08)" },
    stationCardFocused: { borderWidth: 2, borderColor: Colors.brand.accent },
    stationIcon: {
      width: isTV ? 54 : 44, height: isTV ? 54 : 44, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
    },
    stationInfo: { flex: 1, marginLeft: 12, minWidth: 0 },
    stationTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    stationName: { fontSize: isTV ? 18 : 14, fontWeight: "600", flexShrink: 1 },
    stationNameActive: { color: Colors.brand.accent },
    stationDesc: { fontSize: 11, color: Colors.text.tertiary, marginTop: 3 },
    stationTagRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
    stationSource: { fontSize: 10, color: Colors.brand.accent },
    stationCodec: { fontSize: 10, color: Colors.text.disabled },
    deleteBtn: { padding: 6, marginLeft: 4 },
    stationPlay: {
      width: isTV ? 38 : 32, height: isTV ? 38 : 32, borderRadius: isTV ? 19 : 16,
      alignItems: "center", justifyContent: "center", marginLeft: 6,
      borderWidth: 1, borderColor: Colors.surface.border, backgroundColor: Colors.surface.overlay,
    },
    stationPlayActive: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },
    emptyText: { fontSize: 13, color: Colors.text.tertiary, textAlign: "center", padding: 24 },

    /* 添加电台弹窗 */
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
      paddingHorizontal: 12, fontSize: 14, backgroundColor: Colors.surface.overlay, color: "#fff", marginBottom: 10,
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
