/**
 * 搜索页
 * - 支持按影片名称「拼音首字母」检索（如输入 QYN 可匹配「庆余年 第二季」）
 * - 界面内展示热搜影视名称，点击即可快速发起搜索
 * - A-Z 首字母索引条，快速筛选热搜词条
 * - 首字母建议：输入过程中实时展示匹配的影片名，点击直接搜索
 */
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Alert,
  Keyboard,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import VideoCard from "@/components/VideoCard";
import VideoLoadingAnimation from "@/components/VideoLoadingAnimation";
import { api, SearchResult } from "@/services/api";
import { Search, QrCode, Flame, X, ChevronRight } from "lucide-react-native";
import { StyledButton } from "@/components/StyledButton";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
import { RemoteControlModal } from "@/components/RemoteControlModal";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRouter } from "expo-router";
import { Colors } from "@/constants/Colors";
import CustomScrollView from "@/components/CustomScrollView";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from "@/utils/Logger";
import { HOT_SEARCH_ITEMS, HOT_LETTERS } from "@/constants/HotSearch";
import { matchesInitials, isInitialsQuery } from "@/utils/pinyin";

const logger = Logger.withTag("SearchScreen");

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function SearchScreen() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const textInputRef = useRef<TextInput>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const { showModal: showRemoteModal, lastMessage, targetPage, clearMessage } = useRemoteControlStore();
  const { remoteInputEnabled } = useSettingsStore();
  const router = useRouter();

  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

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
        (isInitialsQuery(q) && matchesInitials(item.title, q))
    ).slice(0, 8);
  }, [keyword]);

  /** 热搜列表：按选中字母筛选，未选字母时展示全部 */
  const visibleHot = useMemo(() => {
    if (!activeLetter) return HOT_SEARCH_ITEMS;
    return HOT_SEARCH_ITEMS.filter((item) => item.initials.startsWith(activeLetter));
  }, [activeLetter]);

  const handleSearch = async (searchText?: string) => {
    let term = typeof searchText === "string" ? searchText : keyword;
    term = term.trim();
    if (!term) {
      Keyboard.dismiss();
      return;
    }
    // 首字母检索：若输入的是纯字母且能唯一/优先匹配到影片名，用影片名发起搜索
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

  const dynamicStyles = createResponsiveStyles(deviceType, spacing);
  const hasResults = results.length > 0;

  const renderSearchContent = () => (
    <>
      <View style={dynamicStyles.searchContainer}>
        <TouchableOpacity
          activeOpacity={1}
          style={[
            dynamicStyles.inputContainer,
            { borderColor: isInputFocused ? Colors.dark.primary : Colors.surface.border },
          ]}
          onPress={() => textInputRef.current?.focus()}
        >
          <Search size={18} color={Colors.brand.accent} />
          <TextInput
            ref={textInputRef}
            style={dynamicStyles.input}
            placeholder="输入片名或首字母（如 庆余年 / QYN）"
            placeholderTextColor="#888"
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={onSearchPress}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => { setKeyword(""); setResults([]); setError(null); }} style={dynamicStyles.clearBtn}>
              <X size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
        <StyledButton style={dynamicStyles.searchButton} onPress={onSearchPress}>
          <Search size={deviceType === "mobile" ? 20 : 24} color="white" />
        </StyledButton>
        {deviceType !== "mobile" && (
          <StyledButton style={dynamicStyles.qrButton} onPress={handleQrPress}>
            <QrCode size={deviceType === "tv" ? 24 : 20} color="white" />
          </StyledButton>
        )}
      </View>

      {/* 首字母建议（输入中实时展示） */}
      {suggestions.length > 0 && (
        <View style={dynamicStyles.suggestBox}>
          <ThemedText style={dynamicStyles.suggestLabel}>匹配影片（点击直接搜索）</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.title}
                style={dynamicStyles.suggestChip}
                onPress={() => quickSearch(item.title)}
              >
                <ThemedText style={dynamicStyles.suggestChipText}>{item.title}</ThemedText>
                <ThemedText style={dynamicStyles.suggestInitials}>{item.initials}</ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 热搜影视 + A-Z 首字母索引（无搜索结果时展示） */}
      {!hasResults && !loading && (
        <ScrollView style={dynamicStyles.hotWrap} showsVerticalScrollIndicator={false}>
          <View style={dynamicStyles.hotHeader}>
            <Flame size={18} color={Colors.brand.live} />
            <ThemedText style={dynamicStyles.hotTitle}>热搜影视</ThemedText>
            <ThemedText style={dynamicStyles.hotHint}>点击快速发起搜索</ThemedText>
          </View>

          {/* 首字母索引条 */}
          <View style={dynamicStyles.letterRow}>
            <TouchableOpacity
              onPress={() => setActiveLetter(null)}
              style={[dynamicStyles.letterChip, !activeLetter && dynamicStyles.letterChipActive]}
            >
              <ThemedText style={[dynamicStyles.letterText, !activeLetter && dynamicStyles.letterTextActive]}>全部</ThemedText>
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
                    dynamicStyles.letterChip,
                    active && dynamicStyles.letterChipActive,
                    !available && dynamicStyles.letterChipDisabled,
                  ]}
                >
                  <ThemedText style={[dynamicStyles.letterText, active && dynamicStyles.letterTextActive]}>
                    {letter}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
          {activeLetter && (
            <ThemedText style={dynamicStyles.filterHint}>
              正在按首字母「{activeLetter}」筛选 · 也可直接在搜索框输入首字母
            </ThemedText>
          )}

          {/* 热搜词条列表 */}
          <View style={dynamicStyles.hotList}>
            {visibleHot.map((item, idx) => (
              <TouchableOpacity
                key={item.title}
                style={dynamicStyles.hotItem}
                onPress={() => quickSearch(item.title)}
                activeOpacity={0.7}
              >
                <ThemedText
                  style={[
                    dynamicStyles.hotRank,
                    item.rank <= 3 && dynamicStyles.hotRankTop,
                  ]}
                >
                  {String(idx + 1).padStart(2, "0")}
                </ThemedText>
                <View style={dynamicStyles.hotItemBody}>
                  <ThemedText style={dynamicStyles.hotName} numberOfLines={1}>{item.title}</ThemedText>
                  <ThemedText style={dynamicStyles.hotInitials}>首字母 {item.initials}</ThemedText>
                </View>
                {item.tag && (
                  <View style={dynamicStyles.hotTag}>
                    <ThemedText style={dynamicStyles.hotTagText}>{item.tag}</ThemedText>
                  </View>
                )}
                <ChevronRight size={16} color={Colors.text.tertiary} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {loading ? (
        <VideoLoadingAnimation showProgressBar={false} />
      ) : error && !hasResults ? (
        <View style={[commonStyles.center, { flex: 0.4 }]}>
          <ThemedText style={dynamicStyles.errorText}>{error}</ThemedText>
        </View>
      ) : hasResults ? (
        <CustomScrollView
          data={results}
          renderItem={renderItem}
          loading={loading}
          error={null}
          emptyMessage="输入关键词开始搜索"
        />
      ) : null}
      <RemoteControlModal />
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderSearchContent()}
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

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === "mobile";
  const isTV = deviceType === "tv";
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: deviceType === "tv" ? 40 : 0,
      paddingHorizontal: spacing,
    },
    searchContainer: {
      flexDirection: "row",
      paddingVertical: spacing,
      alignItems: "center",
      gap: spacing / 2,
    },
    inputContainer: {
      flex: 1,
      height: isMobile ? minTouchTarget : 50,
      backgroundColor: Colors.surface.overlay,
      borderRadius: isMobile ? 12 : 14,
      borderWidth: 2,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      gap: 8,
    },
    input: {
      flex: 1,
      color: "white",
      fontSize: isMobile ? 16 : 18,
      height: "100%",
    },
    clearBtn: { padding: 4 },
    searchButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 14,
      backgroundColor: Colors.brand.accent,
    },
    qrButton: {
      width: isMobile ? minTouchTarget : 50,
      height: isMobile ? minTouchTarget : 50,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 14,
    },
    suggestBox: {
      marginBottom: spacing,
    },
    suggestLabel: { fontSize: 12, color: Colors.brand.accent, marginBottom: 8 },
    suggestChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: Colors.surface.raised,
      borderWidth: 1,
      borderColor: "rgba(0,230,168,0.35)",
      marginRight: 8,
    },
    suggestChipText: { fontSize: 13, fontWeight: "600" },
    suggestInitials: { fontSize: 11, color: Colors.brand.accent },
    hotWrap: { flex: 1 },
    hotHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    hotTitle: { fontSize: isTV ? 22 : 17, fontWeight: "bold" },
    hotHint: { fontSize: 11, color: Colors.text.tertiary, marginLeft: "auto" },
    letterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
      marginBottom: 10,
    },
    letterChip: {
      minWidth: isTV ? 36 : 30,
      height: isTV ? 34 : 28,
      paddingHorizontal: 6,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: Colors.surface.raised,
      borderWidth: 1,
      borderColor: Colors.surface.border,
    },
    letterChipActive: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },
    letterChipDisabled: { opacity: 0.3 },
    letterText: { fontSize: isTV ? 15 : 12, fontWeight: "600" },
    letterTextActive: { color: Colors.brand.onAccent },
    filterHint: { fontSize: 11, color: Colors.text.tertiary, marginBottom: 10 },
    hotList: { paddingBottom: spacing },
    hotItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: isTV ? 12 : 9,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: Colors.surface.raised,
      borderWidth: 1,
      borderColor: Colors.surface.border,
      marginBottom: 7,
      gap: 10,
    },
    hotRank: {
      fontSize: isTV ? 18 : 14,
      fontWeight: "700",
      color: Colors.text.tertiary,
      minWidth: 28,
    },
    hotRankTop: { color: Colors.brand.live },
    hotItemBody: { flex: 1 },
    hotName: { fontSize: isTV ? 18 : 14, fontWeight: "600" },
    hotInitials: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2 },
    hotTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      backgroundColor: "rgba(255,59,71,0.15)",
      borderWidth: 1,
      borderColor: "rgba(255,59,71,0.4)",
    },
    hotTagText: { fontSize: 10, color: Colors.brand.live },
    errorText: {
      color: "#ff6b6b",
      fontSize: isMobile ? 14 : 16,
      textAlign: "center",
    },
  });
};
