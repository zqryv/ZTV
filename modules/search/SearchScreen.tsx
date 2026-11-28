/**
 * 搜索页（v2.3.0 按「3 界面 × 4 设备」设计稿收紧布局）。
 *
 * - 宽屏：左栏约 38~40% 放搜索框 + 独立屏幕键盘面板 + 首字母匹配；
 *   右栏放热搜 TOP5、搜索结果 / 完整热搜榜、猜你想搜胶囊；
 * - 手机：单列，键盘可收起，输入框与热搜结果互不遮挡；
 * - 电视：10-foot 字号 + 遥控器提示，键盘不再铺满整屏；
 * - 所有尺寸取自 useCompactLayout 统一标尺，随折叠 / 旋转 / 窗口缩放实时重算。
 *
 * 功能与数据接口全部沿用：远程输入、拼音首字母检索、71 条热搜、
 * TOP10 宫格、A–Z 索引、搜索结果、TV 遥控器。
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api, SearchResult } from "@/services/api";
import {
  Search,
  QrCode,
  Flame,
  X,
  ChevronRight,
  Keyboard as KeyboardIcon,
} from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { SearchKeyboard } from "@/components/SearchKeyboard";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { RemoteControlModal } from "@/components/RemoteControlModal";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useSafeTVEventHandler } from "@/hooks/useSafeTVEventHandler";
import { useCompactLayout, CompactMetrics } from "@/utils/DesignTokens";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from "@/utils/Logger";
import {
  HOT_SEARCH_ITEMS,
  HOT_LETTERS,
  HOT_TOP_ITEMS,
} from "@/constants/HotSearch";
import { matchesInitials, isInitialsQuery } from "@/utils/pinyin";
import { SearchInput } from "@/components/SearchInput";
import { moduleManager } from "@/modules/ModuleManager";
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

interface SearchModuleConfig {
  maxKeywordLength: number;
  imeEnabledByDefault: boolean;
  candidateLimit: number;
  commitCompositionOnSearch: boolean;
  quickTerms: string[];
}

const logger = Logger.withTag("SearchScreen");
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const textInputRef = useRef<TextInput>(null);
  /** v2.5.0 中文输入法状态与模块资源包（可独立升级） */
  const [ime, setIme] = useState<ImeState>(EMPTY_IME);
  const [imeEnabled, setImeEnabled] = useState(true);
  const [moduleConfig, setModuleConfig] = useState<SearchModuleConfig | null>(null);
  useEffect(() => {
    void moduleManager.getConfig<SearchModuleConfig>("search").then((config) => {
      setModuleConfig(config);
      setImeEnabled(config.imeEnabledByDefault !== false);
    });
  }, []);
  const maxLength = moduleConfig?.maxKeywordLength ?? 40;
  const candidateLimit = moduleConfig?.candidateLimit ?? 8;
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const metrics = useCompactLayout();
  const {
    deviceType,
    deviceForm,
    foldState,
    spacing,
    isHarmonyOS,
  } = responsiveConfig;
  const { isWide, isTVLike } = metrics;

  /** 返回键：先取消拼音组合 → 再收键盘 → 最后退回上一页（不抢占焦点导航） */
  const handleTVEvent = useCallback((event: any) => {
    if (event?.eventType !== "back") return;
    if (ime.composing) {
      setIme(clearIme());
      return;
    }
    if (showKeyboard) {
      setShowKeyboard(false);
      return;
    }
    router.back();
  }, [ime.composing, showKeyboard, router]);
  useSafeTVEventHandler(handleTVEvent);

  useEffect(() => {
    if (lastMessage && targetPage === "search") {
      logger.debug("Received remote input:", lastMessage);
      const realMessage = lastMessage.split("_")[0];
      setKeyword(realMessage);
      handleSearch(realMessage);
      clearMessage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage, targetPage]);

  /** 首字母建议：输入过程中按影片名或首字母匹配热搜词条 */
  const suggestions = useMemo(() => {
    const q = keyword.trim();
    if (!q) return [];
    return HOT_SEARCH_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q.toLowerCase()) ||
        (isInitialsQuery(q) && matchesInitials(item.title, q)),
    ).slice(0, 8);
  }, [keyword]);

  /** 热搜列表：按选中字母筛选，未选字母时展示全部 71 条 */
  const visibleHot = useMemo(() => {
    if (!activeLetter) return HOT_SEARCH_ITEMS;
    return HOT_SEARCH_ITEMS.filter((item) => item.initials.startsWith(activeLetter));
  }, [activeLetter]);

  const handleSearch = async (searchText?: string) => {
    let term = typeof searchText === "string" ? searchText : keyword;
    // 搜索时把未选候选的拼音串作为英文字母提交，避免用户输入「丢失」
    if (typeof searchText !== "string" && ime.composing &&
        (moduleConfig?.commitCompositionOnSearch ?? true)) {
      const committed = commitComposition(ime);
      term = `${term}${committed.text}`;
      setKeyword(term);
      setIme(committed.state);
    }
    term = term.trim();
    if (!term) {
      Keyboard.dismiss();
      return;
    }
    if (isInitialsQuery(term)) {
      const matched = HOT_SEARCH_ITEMS.filter((item) => matchesInitials(item.title, term));
      if (matched.length > 0) {
        term = matched[0].title;
        setKeyword(term);
      }
    }
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    try {
      const response = await api.searchVideos(term);
      if (response.results.length > 0) {
        setResults(response.results);
      } else {
        setResults([]);
        setError("没有找到相关内容");
      }
    } catch (err) {
      setError("搜索失败，请稍后重试。");
      logger.info("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const onSearchPress = () => handleSearch();

  /** 点击热搜 / 建议：直接把片名填入并发起搜索 */
  const quickSearch = (title: string) => {
    setKeyword(title);
    setActiveLetter(null);
    handleSearch(title);
  };

  /** 字母进入拼音组合区；非字母（数字/符号）直接写入并结束组合 */
  const handleKeyPress = (key: string) => {
    if (!imeEnabled || !/^[a-zA-Z]$/.test(key)) {
      const pending = imeEnabled && ime.composing ? commitComposition(ime).text : "";
      setKeyword((prev) =>
        prev.length + pending.length + 1 > maxLength ? prev : `${prev}${pending}${key}`
      );
      setIme(clearIme());
      return;
    }
    setIme((prev) => pushLetter(prev, key, true, candidateLimit));
  };
  /** 删除：先退拼音组合最后一个字母，组合为空才删正文最后一个码点 */
  const handleDelete = () => {
    const { state, removeText } = backspaceIme(ime, candidateLimit);
    setIme(state);
    if (removeText) setKeyword((prev) => deleteLastCodePoint(prev));
  };
  /** 清空：正文、拼音组合、候选、结果、错误、字母筛选一次性复位 */
  const handleClear = () => {
    setKeyword("");
    setIme(clearIme());
    setResults([]);
    setError(null);
    setActiveLetter(null);
  };
  const handleSelectCandidate = (index: number) => {
    const { state, text } = selectCandidate(ime, index);
    if (!text) return;
    setKeyword((prev) => (prev.length + text.length > maxLength ? prev : prev + text));
    setIme(state);
  };
  const handleCommitComposition = () => {
    const { state, text } = commitComposition(ime);
    if (text) setKeyword((prev) => (prev.length + text.length > maxLength ? prev : prev + text));
    setIme(state);
  };

  const handleQrPress = () => {
    if (!remoteInputEnabled) {
      Alert.alert("远程输入未启用", "请先在设置页面中启用远程输入功能", [
        { text: "取消", style: "cancel" },
        { text: "去设置", onPress: () => router.push("/settings") },
      ]);
      return;
    }
    showRemoteModal("search");
  };

  const renderItem = ({ item }: { item: SearchResult; index: number }) => (
    <VideoCard
      id={item.id.toString()}
      source={item.source}
      title={item.title}
      poster={item.poster}
      year={item.year}
      sourceName={item.source_name}
      api={api}
    />
  );

  const dyn = useMemo(() => createStyles(metrics, spacing), [metrics, spacing]);
  const hasResults = results.length > 0;
  const formLabel = DeviceUtils.getFormLabel(deviceForm ?? DeviceUtils.getDeviceForm());

  // ── 左栏：搜索框 + 屏幕键盘面板 + 首字母匹配 ────────────────────────────
  const searchRow = (
    <View style={dyn.searchContainer}>
      {/* v2.5.0：统一可聚焦输入组件，修复父层 Touchable 拦截与 TV 禁止聚焦 */}
      <SearchInput
        inputRef={textInputRef}
        value={keyword}
        onChangeText={(text) => {
          setKeyword(text);
          setIme(clearIme());
        }}
        onSubmit={onSearchPress}
        onClear={handleClear}
        composing={ime.composing}
        placeholder="输入片名或拼音（如 qing / QYN）"
        style={{ flex: 1 }}
      />

      <StyledButton style={dyn.iconSquare} onPress={onSearchPress}>
        <Search size={metrics.body + 4} color="white" />
      </StyledButton>
      <StyledButton
        style={[dyn.iconSquare, showKeyboard && dyn.iconSquareActive]}
        onPress={() => setShowKeyboard((value) => !value)}
      >
        <KeyboardIcon size={metrics.body + 4} color="white" />
      </StyledButton>
      {deviceType !== "mobile" && (
        <StyledButton style={dyn.iconSquare} onPress={handleQrPress}>
          <QrCode size={metrics.body + 4} color="white" />
        </StyledButton>
      )}
    </View>
  );

  const keyboard = showKeyboard ? (
    <SearchKeyboard
      visible
      panelWidth={isWide ? metrics.leftWidth : undefined}
      hint="拼音选中文 · 首字母直达 · 删除先退拼音再退文字"
      quickTerms={moduleConfig?.quickTerms}
      onQuickTerm={quickSearch}
      imeEnabled={imeEnabled}
      onToggleIme={() => {
        setImeEnabled((value) => !value);
        setIme(clearIme());
      }}
      composing={ime.composing}
      candidates={ime.candidates}
      onSelectCandidate={handleSelectCandidate}
      onCommitComposition={handleCommitComposition}
      onKeyPress={handleKeyPress}
      onDelete={handleDelete}
      onSearch={onSearchPress}
      onClear={handleClear}
      onClose={() => setShowKeyboard(false)}
    />
  ) : null;

  const suggestionBox = suggestions.length > 0 ? (
    <View style={dyn.suggestBox}>
      <ThemedText style={dyn.suggestLabel}>匹配影片 · 点击直接搜索</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {suggestions.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={dyn.suggestChip}
            onPress={() => quickSearch(item.title)}
          >
            <ThemedText style={dyn.suggestChipText}>{item.title}</ThemedText>
            <ThemedText style={dyn.suggestInitials}>{item.initials}</ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  ) : null;

  const leftColumn = (
    <ScrollView
      style={[dyn.leftColumn, isWide && dyn.leftColumnWide]}
      contentContainerStyle={dyn.leftColumnContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {searchRow}
      <View style={dyn.metaRow}>
        <ThemedText style={dyn.formText} numberOfLines={1}>
          {`${formLabel}${foldState !== "single" ? ` · ${foldState}` : ""}${isHarmonyOS ? " · 鸿蒙" : ""} · ${metrics.width}px`}
        </ThemedText>
        <ThemedText style={dyn.keyboardHint}>
          {showKeyboard ? "键盘已展开" : "点键盘图标输入"}
        </ThemedText>
      </View>
      {keyboard}
      {suggestionBox}
      {!isWide && (
        <View style={dyn.hotWordsRow}>
          {HOT_TOP_ITEMS.slice(0, 3).map((item) => (
            <TouchableOpacity key={item.title} style={dyn.hotWordChip} onPress={() => quickSearch(item.title)}>
              <ThemedText style={dyn.hotWordText} numberOfLines={1}>
                {`热门: ${item.title}`}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // ── 右栏：热搜 TOP5 + 结果 / 完整榜单 + 猜你想搜 ───────────────────────
  const topFive = (
    <View style={dyn.topSection}>
      <View style={dyn.sectionHeader}>
        <Flame size={metrics.body + 3} color={Colors.brand.live} />
        <ThemedText style={dyn.sectionTitle}>热搜影视榜</ThemedText>
        <ThemedText style={dyn.sectionHint}>TOP 10 · 共 {HOT_SEARCH_ITEMS.length} 条</ThemedText>
      </View>
      <View style={dyn.topGrid}>
        {HOT_TOP_ITEMS.slice(0, 5).map((item) => (
          <TouchableOpacity
            key={`top-${item.title}`}
            style={dyn.topItem}
            onPress={() => quickSearch(item.title)}
            activeOpacity={0.7}
          >
            <ThemedText style={[dyn.topRank, item.rank <= 3 && dyn.topRankHot]}>
              {String(item.rank).padStart(2, "0")}
            </ThemedText>
            <ThemedText style={dyn.topName} numberOfLines={1}>{item.title}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const fullHotList = (
    <ScrollView style={dyn.scrollPanel} contentContainerStyle={dyn.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={dyn.letterRow}>
        <TouchableOpacity
          onPress={() => setActiveLetter(null)}
          style={[dyn.letterChip, !activeLetter && dyn.letterChipActive]}
        >
          <ThemedText style={[dyn.letterText, !activeLetter && dyn.letterTextActive]}>全部</ThemedText>
        </TouchableOpacity>
        {LETTERS.map((letter) => {
          const available = HOT_LETTERS.includes(letter);
          const active = activeLetter === letter;
          return (
            <TouchableOpacity
              key={letter}
              disabled={!available}
              onPress={() => setActiveLetter(active ? null : letter)}
              style={[
                dyn.letterChip,
                active && dyn.letterChipActive,
                !available && dyn.letterChipDisabled,
              ]}
            >
              <ThemedText style={[dyn.letterText, active && dyn.letterTextActive]}>{letter}</ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
      {activeLetter && (
        <ThemedText style={dyn.filterHint}>
          正在按首字母「{activeLetter}」筛选 · 共 {visibleHot.length} 条
        </ThemedText>
      )}
      <View style={dyn.hotList}>
        {visibleHot.map((item, idx) => (
          <TouchableOpacity
            key={item.title}
            style={dyn.hotItem}
            onPress={() => quickSearch(item.title)}
            activeOpacity={0.7}
          >
            <ThemedText style={[dyn.hotRank, item.rank <= 3 && dyn.hotRankTop]}>
              {String(idx + 1).padStart(2, "0")}
            </ThemedText>
            <View style={dyn.hotItemBody}>
              <ThemedText style={dyn.hotName} numberOfLines={1}>{item.title}</ThemedText>
              <ThemedText style={dyn.hotInitials}>首字母 {item.initials}</ThemedText>
            </View>
            {item.tag && (
              <View style={dyn.hotTag}>
                <ThemedText style={dyn.hotTagText}>{item.tag}</ThemedText>
              </View>
            )}
            <ChevronRight size={14} color={Colors.text.tertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const resultPanel = loading ? (
    <VideoLoadingAnimation showProgressBar={false} />
  ) : hasResults ? (
    <CustomScrollView
      data={results}
      renderItem={renderItem}
      loading={loading}
      error={null}
      emptyMessage="输入关键词开始搜索"
    />
  ) : error ? (
    <View style={dyn.placeholder}>
      <ThemedText style={dyn.errorText}>{error}</ThemedText>
      <ThemedText style={dyn.placeholderHint}>可点击热搜词条，或使用屏幕键盘重新输入</ThemedText>
    </View>
  ) : (
    fullHotList
  );

  const guessChips = (
    <View style={dyn.guessSection}>
      <ThemedText style={dyn.guessTitle}>猜你想搜 · 热门搜索词</ThemedText>
      <View style={dyn.guessRow}>
        {HOT_TOP_ITEMS.slice(3, 13).map((item) => (
          <TouchableOpacity key={`guess-${item.title}`} style={dyn.guessChip} onPress={() => quickSearch(item.title)}>
            <ThemedText style={dyn.guessChipText} numberOfLines={1}>{item.title}</ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const rightColumn = (
    <View style={[dyn.rightColumn, isWide && dyn.rightColumnWide]}>
      {isWide && topFive}
      <View style={dyn.resultHeadingRow}>
        <ThemedText style={dyn.resultHeading}>
          {hasResults ? `搜索结果 · ${keyword || "关键词"}` : "完整榜单 · 点击即搜"}
        </ThemedText>
        {hasResults && <ThemedText style={dyn.sectionHint}>找到 {results.length} 部</ThemedText>}
      </View>
      <View style={dyn.mainPanel}>{resultPanel}</View>
      {guessChips}
    </View>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dyn.container]}>
      <View style={dyn.pageHeader}>
        <View style={dyn.pageTitleText}>
          <ThemedText style={dyn.pageTitle}>搜索</ThemedText>
          <ThemedText style={dyn.pageSubtitle} numberOfLines={1}>
            全网影视 · 拼音首字母直达{isTVLike ? " · 遥控器或手机扫码输入" : ""}
          </ThemedText>
        </View>
        {deviceType === "mobile" && (
          <TouchableOpacity onPress={handleQrPress} style={dyn.qrChip} activeOpacity={0.7}>
            <QrCode size={14} color={Colors.brand.accent} />
            <ThemedText style={dyn.qrChipText}>手机扫码输入</ThemedText>
          </TouchableOpacity>
        )}
      </View>
      <View style={[dyn.columns, isWide && dyn.columnsWide]}>
        {leftColumn}
        {rightColumn}
      </View>
      <RemoteControlModal />
    </ThemedView>
  );

  if (deviceType === "tv") return content;

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title="搜索" showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createStyles = (m: CompactMetrics, spacing: number) => {
  const minTouch = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
      paddingTop: m.isTVLike ? Math.min(24, spacing * 1.5) : 0,
      paddingHorizontal: spacing,
      paddingBottom: spacing / 2,
    },
    pageHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      gap: m.gap, marginTop: m.isTVLike ? m.gap : m.gap / 2, marginBottom: m.gap,
    },
    pageTitleText: { flexShrink: 1 },
    pageTitle: { fontSize: m.pageTitle, fontWeight: "bold" },
    pageSubtitle: { fontSize: m.caption, color: Colors.text.tertiary, marginTop: 2 },
    qrChip: {
      flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 16, backgroundColor: Colors.surface.overlay, borderWidth: 1, borderColor: Colors.surface.border,
    },
    qrChipText: { fontSize: m.caption, color: Colors.brand.accent },

    columns: { flex: 1, flexDirection: "column", minHeight: 0 },
    columnsWide: { flexDirection: "row", gap: m.gap * 1.5 },
    /** 左栏独立滚动兜底：Web 的 body{overflow:hidden} 下也不会裁掉内容 */
    leftColumn: { flexShrink: 0, maxHeight: m.contentHeight },
    leftColumnWide: { width: m.leftWidth, flexShrink: 0, maxHeight: m.contentHeight },
    leftColumnContent: { flexGrow: 1, paddingBottom: m.gap },
    rightColumn: { flex: 1, minWidth: 0, minHeight: 0, maxHeight: m.contentHeight, marginTop: m.gap },
    rightColumnWide: { flex: 1, marginTop: 0 },

    searchContainer: {
      flexDirection: "row", alignItems: "center", gap: m.gapSm, marginBottom: m.gapSm,
    },
    inputContainer: {
      flex: 1, height: Math.max(minTouch, m.headerHeight), backgroundColor: Colors.surface.overlay,
      borderRadius: m.radiusSm, borderWidth: 2, flexDirection: "row", alignItems: "center",
      paddingHorizontal: 10, gap: 6,
    },
    input: { flex: 1, color: "white", fontSize: m.body, height: "100%" },
    clearBtn: {
      padding: 4,
      minWidth: Math.round(m.minTouchTarget * 0.7),
      minHeight: Math.round(m.minTouchTarget * 0.7),
      alignItems: "center",
      justifyContent: "center",
    },
    iconSquare: {
      width: Math.max(m.minTouchTarget, m.headerHeight),
      height: Math.max(m.minTouchTarget, m.headerHeight),
      justifyContent: "center", alignItems: "center", borderRadius: m.radiusSm,
      backgroundColor: Colors.brand.accent,
    },
    iconSquareActive: { borderColor: Colors.brand.accent, backgroundColor: "rgba(0,230,168,0.18)" },
    metaRow: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      gap: 8, marginBottom: 2,
    },
    formText: { fontSize: m.caption, color: Colors.text.tertiary, flex: 1 },
    keyboardHint: { fontSize: m.caption, color: Colors.brand.accent },
    suggestBox: { marginTop: m.gapSm },
    suggestLabel: { fontSize: m.caption, color: Colors.brand.accent, marginBottom: 6 },
    suggestChip: {
      flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: m.radiusSm, backgroundColor: Colors.surface.raised,
      borderWidth: 1, borderColor: "rgba(0,230,168,0.35)", marginRight: 6,
    },
    suggestChipText: { fontSize: m.body, fontWeight: "600" },
    suggestInitials: { fontSize: m.caption, color: Colors.brand.accent },
    hotWordsRow: { flexDirection: "row", flexWrap: "wrap", gap: m.gapSm, marginTop: m.gapSm },
    hotWordChip: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: m.radiusSm,
      backgroundColor: Colors.surface.overlay, borderWidth: 1, borderColor: Colors.surface.border,
    },
    hotWordText: { fontSize: m.caption, color: Colors.text.secondary },

    topSection: { marginBottom: m.gap },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: m.gapSm },
    sectionTitle: { fontSize: m.sectionTitle, fontWeight: "bold" },
    sectionHint: { fontSize: m.caption, color: Colors.text.tertiary, marginLeft: "auto" },
    topGrid: { flexDirection: "row", gap: m.gapSm },
    topItem: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 9, paddingVertical: m.gapSm, borderRadius: m.radiusSm,
      backgroundColor: Colors.surface.raised, borderWidth: 1, borderColor: Colors.surface.border,
    },
    topRank: { fontSize: m.caption + 1, fontWeight: "800", color: Colors.text.tertiary, minWidth: 18 },
    topRankHot: { color: Colors.brand.live },
    topName: { flex: 1, fontSize: m.caption + 1, fontWeight: "600" },

    resultHeadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: m.gapSm },
    resultHeading: { fontSize: m.body + 1, fontWeight: "700" },
    mainPanel: { flex: 1, minHeight: 0 },
    scrollPanel: { flex: 1 },
    scrollContent: { paddingBottom: m.gap },
    letterRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: m.gapSm },
    letterChip: {
      minWidth: m.isTVLike ? 32 : 24,
      height: Math.max(m.isTVLike ? 30 : 24, Math.round(m.minTouchTarget * 0.65)),
      paddingHorizontal: 5,
      borderRadius: m.radiusSm - 2, alignItems: "center", justifyContent: "center",
      backgroundColor: Colors.surface.raised, borderWidth: 1, borderColor: Colors.surface.border,
    },
    letterChipActive: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },
    letterChipDisabled: { opacity: 0.3 },
    letterText: { fontSize: m.caption, fontWeight: "600" },
    letterTextActive: { color: Colors.brand.onAccent },
    filterHint: { fontSize: m.caption, color: Colors.text.tertiary, marginBottom: 6 },
    hotList: { flexDirection: m.isWide ? "row" : "column", flexWrap: m.isWide ? "wrap" : "nowrap", gap: m.gapSm },
    hotItem: {
      width: m.isWide ? "49%" : "100%", flexDirection: "row", alignItems: "center",
      minHeight: Math.round(m.minTouchTarget * 0.8),
      paddingVertical: m.gapSm, paddingHorizontal: 10, borderRadius: m.radiusSm,
      backgroundColor: Colors.surface.raised, borderWidth: 1, borderColor: Colors.surface.border, gap: 8,
    },
    hotRank: { fontSize: m.body, fontWeight: "700", color: Colors.text.tertiary, minWidth: 22 },
    hotRankTop: { color: Colors.brand.live },
    hotItemBody: { flex: 1, minWidth: 0 },
    hotName: { fontSize: m.body, fontWeight: "600" },
    hotInitials: { fontSize: m.caption, color: Colors.text.tertiary, marginTop: 1 },
    hotTag: {
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
      backgroundColor: "rgba(255,59,71,0.15)", borderWidth: 1, borderColor: "rgba(255,59,71,0.4)",
    },
    hotTagText: { fontSize: m.caption, color: Colors.brand.live },
    placeholder: { flex: 1, gap: 8, justifyContent: "center", alignItems: "center" },
    placeholderHint: { fontSize: m.caption, color: Colors.text.tertiary, textAlign: "center", paddingHorizontal: 12 },
    errorText: { color: "#ff6b6b", fontSize: m.body, textAlign: "center" },

    guessSection: { marginTop: m.gap },
    guessTitle: { fontSize: m.body + 1, fontWeight: "700", marginBottom: m.gapSm },
    guessRow: { flexDirection: "row", flexWrap: "wrap", gap: m.gapSm },
    guessChip: {
      minHeight: Math.round(m.minTouchTarget * 0.7),
      justifyContent: "center",
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18,
      backgroundColor: Colors.surface.raised, borderWidth: 1, borderColor: Colors.surface.border,
    },
    guessChipText: { fontSize: m.caption + 1, color: Colors.text.secondary },
  });
};
