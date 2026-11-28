/**
 * 收音机页（v2.3.0 按「3 界面 × 4 设备」设计稿收紧布局）。
 *
 * - 宽屏：左栏约 38~40% 放「调谐器焦点卡」+ 分类胶囊 + 折叠筛选；
 *   右栏放「探索电台」与完整电台卡片列表（电视单列 5 张填满、桌面双列）；
 * - 手机：调谐器卡压缩后置于顶部，下方为紧凑电台列表；
 * - 全部尺寸来自 useCompactLayout，与搜索 / 音乐在线共用同一标尺。
 *
 * 功能与数据接口零改动：内置电台 + 在线目录补充、地区 / 分类双维筛选、
 * 自定义电台增删、音量档位、TV 遥控器、明确的「停止」、
 * useFocusEffect 失焦停止与资源释放。
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
import { useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
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
  BUILTIN_RADIO_STATIONS,
  RADIO_CATEGORIES,
  RADIO_COUNTRIES,
  RadioStation,
} from "@/constants/AudioLibrary";
import {
  OfflineProgram,
  RadioModuleConfig,
  isValidOfflineProgram,
  isOfflineStationId,
  loadRadioModuleConfig,
  toRadioStation,
} from "./offlineCatalog";
import {
  CacheIndex,
  cacheProgram,
  getCacheUsageMB,
  getPlayableUri,
  listCachedPrograms,
  pruneCache,
} from "@/services/offlineCache";
import { loadOnlineStations } from "@/services/onlineMusic";

/** 波形律动条的基础高度（播放时按此序列呈现律动，暂停时压平） */
const WAVE_BARS = [10, 18, 28, 16, 36, 22, 42, 30, 38, 20, 32, 14, 26, 18, 30, 12, 22, 10];

/** 设计稿 FM 频率读数：内置网络流没有频率字段，按 id 生成稳定展示值（纯展示层） */
const dialFrequency = (station: RadioStation | null) => {
  if (!station) return "FM --.-";
  let sum = 0;
  for (const ch of station.id) sum += ch.charCodeAt(0);
  return `FM ${(87.5 + (sum % 205) / 10).toFixed(1)}`;
};

export default function RadioScreen() {
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { spacing } = responsiveConfig;
  const metrics = useCompactLayout();
  const { isWide, isTVLike } = metrics;
  const router = useRouter();

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
  /** v2.5.0 离线节目 / 缓存状态（节目单来自模块资源包，可独立升级） */
  const [offlinePrograms, setOfflinePrograms] = useState<OfflineProgram[]>([]);
  const [offlineStations, setOfflineStations] = useState<RadioStation[]>([]);
  const [cacheIndex, setCacheIndex] = useState<CacheIndex>({});
  const [caching, setCaching] = useState<Record<string, number>>({});
  const [offlineOnly, setOfflineOnly] = useState(false);
  const [radioConfig, setRadioConfig] = useState<RadioModuleConfig | null>(null);
  const [cacheUsageMB, setCacheUsageMB] = useState(0);

  useEffect(() => {
    void (async () => {
      const config = await loadRadioModuleConfig();
      const programs = (config.offlinePrograms ?? []).filter(isValidOfflineProgram);
      setRadioConfig(config);
      setOfflinePrograms(programs);
      setOfflineStations(programs.map(toRadioStation));
      setCacheIndex(await listCachedPrograms());
      setCacheUsageMB(await getCacheUsageMB());
    })();
  }, []);

  /** 直播电台 + 离线节目合并成同一列表，点离线节目即走本地缓存播放 */
  const allStations = useMemo(
    () => [...stations, ...offlineStations],
    [stations, offlineStations]
  );

  const filtered = useMemo(
    () =>
      allStations.filter((s) => {
        if (offlineOnly && !isOfflineStationId(s.id)) return false;
        if (country !== "全部" && s.country !== country) return false;
        if (category !== "全部" && s.category !== category) return false;
        return true;
      }),
    [allStations, country, category, offlineOnly]
  );

  const currentStation = useMemo(
    () => allStations.find((s) => s.id === currentStationId) ?? null,
    [allStations, currentStationId]
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

  /** 首次进入静默补充在线电台；失败也无所谓——内置电台已可正常收听 */
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

  /** 离线节目：优先播本地缓存，未缓存则联网下载后播；直播失败自动回退到已缓存节目 */
  const startStation = useCallback(
    async (id: string) => {
      const station = allStations.find((s) => s.id === id);
      if (!station) return;
      setCurrentStation(id);

      if (isOfflineStationId(id)) {
        const program = offlinePrograms.find((p) => p.id === id);
        if (!program) return;
        let uri = await getPlayableUri(id);
        if (!uri) {
          setCaching((prev) => ({ ...prev, [id]: 0 }));
          try {
            await cacheProgram(id, program.url, (ratio) =>
              setCaching((prev) => ({ ...prev, [id]: ratio }))
            );
            await pruneCache(radioConfig?.cacheQuotaMB ?? 256);
            setCacheIndex(await listCachedPrograms());
            setCacheUsageMB(await getCacheUsageMB());
            uri = await getPlayableUri(id);
            Toast.show({ type: "success", text1: "已缓存，断网也能收听" });
          } catch {
            Toast.show({ type: "error", text1: "缓存失败，请联网后重试" });
          } finally {
            setCaching((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }
        }
        if (uri) {
          await audioPlayer.play(uri);
          await audioPlayer.setVolume(volume);
        }
        return;
      }

      const ok = await audioPlayer.play(station.url, station.fallbackUrls);
      await audioPlayer.setVolume(volume);
      // 断网兜底：直播流连不上时自动切到任意已缓存的离线节目
      if (!ok && (radioConfig?.autoFallbackToCached ?? true)) {
        const cachedId = Object.keys(cacheIndex)[0];
        if (cachedId) {
          const uri = await getPlayableUri(cachedId);
          if (uri) {
            setCurrentStation(cachedId);
            await audioPlayer.play(uri);
            await audioPlayer.setVolume(volume);
            Toast.show({ type: "info", text1: "网络不可用，已切换到离线节目" });
          }
        }
      }
    },
    [allStations, offlinePrograms, cacheIndex, radioConfig, setCurrentStation, volume]
  );

  /** 一键预缓存：按配额并发下载未缓存节目，失败不影响其它节目 */
  const precacheOffline = useCallback(async () => {
    const targets = offlinePrograms
      .filter((p) => !cacheIndex[p.id])
      .slice(0, radioConfig?.preloadCount ?? 3);
    if (targets.length === 0) {
      Toast.show({ type: "info", text1: "离线节目已全部缓存" });
      return;
    }
    let cursor = 0;
    const worker = async () => {
      while (cursor < targets.length) {
        const program = targets[cursor];
        cursor += 1;
        setCaching((prev) => ({ ...prev, [program.id]: 0 }));
        try {
          await cacheProgram(program.id, program.url, (ratio) =>
            setCaching((prev) => ({ ...prev, [program.id]: ratio }))
          );
        } catch {
          /* 单个失败继续缓存其它节目 */
        } finally {
          setCaching((prev) => {
            const next = { ...prev };
            delete next[program.id];
            return next;
          });
        }
      }
    };
    const concurrency = Math.min(radioConfig?.maxConcurrentDownloads ?? 2, targets.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    await pruneCache(radioConfig?.cacheQuotaMB ?? 256);
    setCacheIndex(await listCachedPrograms());
    setCacheUsageMB(await getCacheUsageMB());
    Toast.show({ type: "success", text1: "离线节目预缓存完成" });
  }, [offlinePrograms, cacheIndex, radioConfig]);

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

  /**
   * 大屏遥控器 / 键盘：方向键与 OK 由原生 / DOM 焦点引擎统一处理，
   * 旧实现 select 会按「假焦点」focusIndex 播放另一台、并与 onPress 叠加，
   * 是「按钮无法选中或操作」的直接原因。这里只保留媒体键与返回键。
   */
  const handleTVEvent = useCallback(
    (event: any) => {
      const type = event?.eventType;
      if (type === "back") {
        if (addModalVisible) {
          setAddModalVisible(false);
          return;
        }
        router.back();
        return;
      }
      if (addModalVisible) return;
      if (type === "playPause") void audioPlayer.toggle();
    },
    [addModalVisible, router]
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

  const dyn = useMemo(() => createStyles(metrics, spacing), [metrics, spacing]);
  const numColumns = isTVLike ? 1 : isWide ? 2 : 1;

  const renderStation = ({ item, index }: { item: RadioStation; index: number }) => {
    const isCurrent = item.id === currentStationId;
    const isBuiltin = BUILTIN_RADIO_STATIONS.some((b) => b.id === item.id);
    const isDeletable = !isBuiltin && !item.id.startsWith("online-") && !isOfflineStationId(item.id);
    return (
      <TouchableOpacity
        style={[
          dyn.stationCard,
          numColumns > 1 && dyn.stationCardGrid,
          isCurrent && dyn.stationCardActive,
          deviceTypeTV(metrics) && focusIndex === index && dyn.stationCardFocused,
        ]}
        onPress={() => void startStation(item.id)}
        onFocus={() => setFocusIndex(index)}
        hasTVPreferredFocus={isTVLike && index === 0}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        activeOpacity={0.75}
      >
        <LinearGradient
          colors={[`${item.accent}66`, `${item.accent}18`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={dyn.stationIcon}
        >
          <Radio size={metrics.body + 4} color={item.accent} />
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
            {isOfflineStationId(item.id) && (
              <ThemedText style={dyn.stationCodec}>
                {cacheIndex[item.id]
                  ? "离线可听"
                  : caching[item.id] !== undefined
                    ? `缓存中 ${Math.round((caching[item.id] || 0) * 100)}%`
                    : "待缓存"}
              </ThemedText>
            )}
          </View>
        </View>
        {isDeletable && (
          <TouchableOpacity onPress={() => handleDelete(item)} style={dyn.deleteBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Trash2 size={14} color={Colors.text.tertiary} />
          </TouchableOpacity>
        )}
        <View style={[dyn.stationPlay, isCurrent && playback.isPlaying && dyn.stationPlayActive]}>
          {isCurrent && playback.isPlaying
            ? <Pause size={14} color={Colors.brand.onAccent} />
            : <Play size={14} color={Colors.text.primary} />}
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

  // ── 页头 ────────────────────────────────────────────────────────────────
  const pageHeader = (
    <View style={dyn.pageHeader}>
      <View style={dyn.pageTitleText}>
        <ThemedText style={dyn.pageTitle}>收音机</ThemedText>
        <ThemedText style={dyn.pageSubtitle} numberOfLines={1}>
          {`网络电台 · 实时收听 · 内置 ${BUILTIN_RADIO_STATIONS.length} 台 / 在线 ${onlineCount} 台`}
        </ThemedText>
      </View>
      <TouchableOpacity
        style={dyn.addRound}
        onPress={() => setAddModalVisible(true)}
        accessibilityLabel="添加电台"
        activeOpacity={0.75}
      >
        <Plus size={metrics.body + 6} color={Colors.brand.onAccent} />
      </TouchableOpacity>
    </View>
  );

  // ── 左栏：调谐器焦点卡（按栏宽收紧）+ 分类 + 折叠筛选 ───────────────────
  const heroCard = (
    <LinearGradient
      colors={[`${currentStation?.accent ?? Colors.brand.accent}A6`, "#0C2A23", Colors.surface.base]}
      style={dyn.heroCard}
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
      <ThemedText style={dyn.heroDesc} numberOfLines={2}>
        {currentStation
          ? [currentStation.category, currentStation.country, currentStation.description].filter(Boolean).join(" · ")
          : "内置电台即点即播，无需联网加载目录"}
      </ThemedText>

      <View style={dyn.waveRow}>
        {WAVE_BARS.map((h, i) => (
          <View key={i} style={[dyn.waveBar, {
            height: playback.isPlaying ? Math.min(h, 30) : 5,
            backgroundColor: i % 4 === 0 ? "rgba(255,255,255,0.72)" : Colors.brand.accent,
          }]} />
        ))}
      </View>

      <View style={dyn.heroControls}>
        <TouchableOpacity style={dyn.roundCtrl} onPress={() => stepStation(-1)} accessibilityLabel="上一个电台" activeOpacity={0.75}>
          <SkipBack size={metrics.body + 3} color="#fff" />
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
            ? <Pause size={metrics.body + 10} color={Colors.brand.onAccent} />
            : <Play size={metrics.body + 10} color={Colors.brand.onAccent} />}
        </TouchableOpacity>
        <TouchableOpacity style={dyn.roundCtrl} onPress={() => stepStation(1)} accessibilityLabel="下一个电台" activeOpacity={0.75}>
          <SkipForward size={metrics.body + 3} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={dyn.roundCtrl}
          onPress={() => setFiltersOpen((v) => !v)}
          accessibilityLabel="音量与更多筛选"
          activeOpacity={0.75}
        >
          <Volume2 size={metrics.body + 3} color="#fff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

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
        <Globe size={12} color={Colors.brand.accent} />
      </StyledButton>
    </ScrollView>
  );

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
          <RefreshCw size={12} color="#fff" />
        </StyledButton>
        <ThemedText style={dyn.onlineHint} numberOfLines={1}>直播需联网 · 离线节目可断网收听</ThemedText>
      </View>
      <View style={dyn.onlineRow}>
        <StyledButton
          text={offlineOnly ? "显示全部" : "仅看离线"}
          variant={offlineOnly ? "primary" : "default"}
          onPress={() => setOfflineOnly((v) => !v)}
          style={dyn.onlineButton}
          textStyle={dyn.onlineButtonText}
        />
        <StyledButton
          text="预缓存节目"
          variant="primary"
          onPress={() => void precacheOffline()}
          style={dyn.onlineButton}
          textStyle={dyn.onlineButtonText}
        />
        <ThemedText style={dyn.onlineHint} numberOfLines={1}>
          {`离线 ${Object.keys(cacheIndex).length}/${offlinePrograms.length} · ${cacheUsageMB.toFixed(1)}MB`}
        </ThemedText>
      </View>
      {!!onlineError && <ThemedText style={dyn.onlineErrorText}>{onlineError}</ThemedText>}
      <View style={dyn.volumeRow}>
        <Volume2 size={14} color={Colors.text.secondary} />
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

  const leftColumn = (
    <ScrollView
      style={[dyn.leftColumn, isWide && dyn.leftColumnWide]}
      contentContainerStyle={dyn.leftColumnContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {heroCard}
      {categoryBar}
      {filterPanel}
      {errorLine}
    </ScrollView>
  );

  // ── 右栏：探索电台 + 完整列表 ───────────────────────────────────────────
  const exploreHeader = (
    <View style={dyn.exploreHeader}>
      <View style={dyn.exploreTitleRow}>
        <ListMusic size={metrics.body + 2} color={Colors.brand.accent} />
        <ThemedText style={dyn.exploreTitle}>探索电台</ThemedText>
        <ThemedText style={dyn.exploreCount} numberOfLines={1}>
          {`${filtered.length} 个 · 内置 ${builtinCount} · 离线 ${offlineStations.length}`}
        </ThemedText>
      </View>
      <View style={dyn.exploreActions}>
        <TouchableOpacity onPress={showAllStations} style={dyn.textAction} activeOpacity={0.75}>
          <ThemedText style={dyn.textActionAccent}>查看全部</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void stopStation()} style={dyn.textAction} activeOpacity={0.75}>
          <Square size={11} color={Colors.text.secondary} />
          <ThemedText style={dyn.textActionMuted}>停止</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  const stationList = (
    <FlatList
      data={filtered}
      renderItem={renderStation}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      columnWrapperStyle={numColumns > 1 ? dyn.gridRow : undefined}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={dyn.listContent}
      ListEmptyComponent={<ThemedText style={dyn.emptyText}>该筛选下暂无电台，可点右上角添加或「查看全部」</ThemedText>}
    />
  );

  const rightColumn = (
    <View style={[dyn.rightColumn, isWide && dyn.rightColumnWide]}>
      {exploreHeader}
      {stationList}
    </View>
  );

  const modal = (
    <Modal visible={addModalVisible} transparent animationType="fade"
      onRequestClose={() => setAddModalVisible(false)}>
      <View style={dyn.modalOverlay}>
        <View style={dyn.modalCard}>
          <View style={dyn.modalHeader}>
            <ThemedText style={dyn.modalTitle}>添加网络电台</ThemedText>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <X size={18} color={Colors.text.secondary} />
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
      <View style={[dyn.columns, isWide && dyn.columnsWide]}>
        {leftColumn}
        {rightColumn}
      </View>
      {modal}
    </ThemedView>
  );

  if (metrics.deviceType === "tv") return content;
  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="收音机" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

/** TV 焦点态只在电视 / 机顶盒生效 */
const deviceTypeTV = (m: CompactMetrics) => m.isTVLike;

const createStyles = (m: CompactMetrics, spacing: number) =>
  StyleSheet.create({
    container: {
      flex: 1, minHeight: 0, paddingTop: m.isTVLike ? Math.min(24, spacing * 1.5) : 0,
      paddingHorizontal: spacing, paddingBottom: spacing / 2,
    },
    pageHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginBottom: m.gap, marginTop: m.isTVLike ? m.gap : m.gap / 2, gap: 8,
    },
    pageTitleText: { flexShrink: 1 },
    pageTitle: { fontSize: m.pageTitle, fontWeight: "bold" },
    pageSubtitle: { fontSize: m.caption, color: Colors.text.tertiary, marginTop: 2 },
    addRound: {
      width: Math.max(m.minTouchTarget, m.headerHeight),
      height: Math.max(m.minTouchTarget, m.headerHeight),
      borderRadius: m.headerHeight,
      backgroundColor: Colors.brand.accent, alignItems: "center", justifyContent: "center",
    },

    columns: { flex: 1, flexDirection: "column", minHeight: 0 },
    columnsWide: { flexDirection: "row", gap: m.gap * 1.5 },
    /** 左栏独立滚动兜底：Web 的 body{overflow:hidden} 下也不会裁掉内容 */
    leftColumn: { flexShrink: 0, maxHeight: m.contentHeight },
    leftColumnWide: { width: m.leftWidth, flexShrink: 0, maxHeight: m.contentHeight },
    leftColumnContent: { flexGrow: 1, paddingBottom: m.gap },
    rightColumn: { flex: 1, minWidth: 0, minHeight: 0, maxHeight: m.contentHeight, marginTop: m.gap },
    rightColumnWide: { flex: 1, marginTop: 0 },

    /* 调谐器焦点卡：按左栏宽度收紧 */
    heroCard: {
      borderRadius: m.radius, padding: m.cardPadding, marginBottom: m.gap, overflow: "hidden",
      borderWidth: 1, borderColor: "rgba(0,230,168,0.18)",
    },
    heroTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    liveBadge: {
      flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 10, backgroundColor: "rgba(0,0,0,0.28)",
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.brand.live },
    liveBadgeText: { fontSize: m.caption, fontWeight: "600", color: "#fff" },
    heroFreq: { fontSize: m.caption + 2, fontWeight: "700", color: "#fff", letterSpacing: 1 },
    heroTitle: { fontSize: m.sectionTitle + 3, fontWeight: "700", color: "#fff", marginTop: m.gap },
    heroDesc: { fontSize: m.caption, color: "rgba(255,255,255,0.78)", marginTop: 4 },
    waveRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3,
      height: 34, marginVertical: m.gap,
    },
    waveBar: { width: 3, borderRadius: 2 },
    heroControls: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: m.gap, marginTop: 2,
    },
    roundCtrl: {
      width: m.roundControl, height: m.roundControl, borderRadius: m.roundControl / 2,
      alignItems: "center", justifyContent: "center",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.45)", backgroundColor: "rgba(255,255,255,0.06)",
    },
    playRound: {
      width: m.playButton, height: m.playButton, borderRadius: m.playButton / 2,
      backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    },

    /* 分类胶囊 / 折叠筛选 */
    categoryBar: { marginBottom: m.gapSm, flexGrow: 0 },
    pill: {
      borderRadius: 18, paddingHorizontal: 12, paddingVertical: 5, marginRight: 6,
      minHeight: Math.round(m.minTouchTarget * 0.6), justifyContent: "center",
    },
    pillMore: {
      borderRadius: 18, paddingHorizontal: 12, paddingVertical: 5, flexDirection: "row", gap: 4,
      minHeight: Math.round(m.minTouchTarget * 0.6), alignItems: "center",
    },
    pillText: { fontSize: m.caption + 1 },
    filterPanel: {
      borderRadius: m.radiusSm, borderWidth: 1, borderColor: Colors.surface.border,
      backgroundColor: Colors.surface.raised, padding: m.gapSm + 2, marginBottom: m.gapSm,
    },
    fieldLabel: { fontSize: m.caption, color: Colors.text.tertiary, marginBottom: 5 },
    filterBar: { marginBottom: m.gapSm, flexGrow: 0 },
    onlineRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    onlineButton: { borderRadius: 18, paddingHorizontal: 12, flexDirection: "row", gap: 5 },
    onlineButtonText: { fontSize: m.caption + 1 },
    onlineHint: { fontSize: m.caption, color: Colors.text.tertiary, flex: 1 },
    onlineErrorText: { color: "#FFB86B", fontSize: m.caption + 1, marginBottom: 6 },
    volumeRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
    volumeChip: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
      minHeight: Math.round(m.minTouchTarget * 0.6), justifyContent: "center",
      backgroundColor: Colors.surface.overlay,
    },
    volumeChipActive: { backgroundColor: "rgba(0,230,168,0.2)", borderWidth: 1, borderColor: Colors.brand.accent },
    volumeText: { fontSize: m.caption },
    errorText: { color: "#ff6b6b", fontSize: m.caption + 1, textAlign: "center", marginBottom: 6 },

    /* 探索电台 */
    exploreHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      gap: 8, marginBottom: m.gapSm, flexWrap: "wrap",
    },
    exploreTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    exploreTitle: { fontSize: m.sectionTitle, fontWeight: "700" },
    exploreCount: { fontSize: m.caption, color: Colors.text.tertiary },
    exploreActions: { flexDirection: "row", alignItems: "center", gap: 10 },
    textAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 3 },
    textActionAccent: { fontSize: m.caption + 1, fontWeight: "600", color: Colors.brand.accent },
    textActionMuted: { fontSize: m.caption + 1, color: Colors.text.secondary },

    /* 电台卡片 */
    gridRow: { gap: m.gapSm },
    listContent: { paddingBottom: m.gap },
    stationCard: {
      flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface.raised,
      borderRadius: m.radiusSm, borderWidth: 1, borderColor: Colors.surface.border,
      padding: m.gapSm + 2, marginBottom: m.gapSm, minWidth: 0,
    },
    stationCardGrid: { flex: 1, marginRight: 0 },
    stationCardActive: { borderColor: Colors.brand.accent, backgroundColor: "rgba(0,230,168,0.08)" },
    stationCardFocused: { borderWidth: 2, borderColor: Colors.brand.accent },
    stationIcon: {
      width: m.roundControl, height: m.roundControl, borderRadius: m.radiusSm - 2,
      alignItems: "center", justifyContent: "center",
    },
    stationInfo: { flex: 1, marginLeft: m.gapSm + 2, minWidth: 0 },
    stationTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    stationName: { fontSize: m.body + 1, fontWeight: "600", flexShrink: 1 },
    stationNameActive: { color: Colors.brand.accent },
    stationDesc: { fontSize: m.caption, color: Colors.text.tertiary, marginTop: 2 },
    stationTagRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
    stationSource: { fontSize: m.caption, color: Colors.brand.accent },
    stationCodec: { fontSize: m.caption, color: Colors.text.disabled },
    deleteBtn: { padding: 4, marginLeft: 3 },
    stationPlay: {
      width: m.roundControl - 6, height: m.roundControl - 6, borderRadius: (m.roundControl - 6) / 2,
      alignItems: "center", justifyContent: "center", marginLeft: 4,
      borderWidth: 1, borderColor: Colors.surface.border, backgroundColor: Colors.surface.overlay,
    },
    stationPlayActive: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },
    emptyText: { fontSize: m.body, color: Colors.text.tertiary, textAlign: "center", padding: 18 },

    /* 添加电台弹窗 */
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
      paddingHorizontal: 10, fontSize: m.body, backgroundColor: Colors.surface.overlay, color: "#fff", marginBottom: 8,
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
