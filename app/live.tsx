import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  HWEvent,
  Text,
  Pressable,
  Platform,
} from "react-native";
import { useSafeTVEventHandler } from "@/hooks/useSafeTVEventHandler";
import { useLocalSearchParams, useRouter } from "expo-router";
import LivePlayer from "@/components/LivePlayer";
import { fetchAndParseM3u, getPlayableUrl, Channel } from "@/services/m3u";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import { useSettingsStore } from "@/stores/settingsStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { getCommonResponsiveStyles } from "@/utils/ResponsiveStyles";
import ResponsiveNavigation from "@/components/navigation/ResponsiveNavigation";
import ResponsiveHeader from "@/components/navigation/ResponsiveHeader";
import { DeviceUtils } from "@/utils/DeviceUtils";
import { Colors } from "@/constants/Colors";
import { LIVE_SLOT_LABELS, isLiveSourceSlot, LiveSourceSlot } from "@/constants/LiveSources";

export default function LiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ slot?: string }>();
  // 当前入口槽位，默认 TV；上键在 TV / MUSIC 之间切换
  const [activeSlot, setActiveSlot] = useState<LiveSourceSlot>(() =>
    isLiveSourceSlot(params.slot) ? params.slot : "tv"
  );

  const { liveSources, liveBindings, loadLiveSources } = useSettingsStore();

  // 响应式布局配置
  const responsiveConfig = useResponsiveLayout();
  const commonStyles = getCommonResponsiveStyles(responsiveConfig);
  const { deviceType, spacing } = responsiveConfig;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [groupedChannels, setGroupedChannels] = useState<Record<string, Channel[]>>({});
  const [channelGroups, setChannelGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isChannelListVisible, setIsChannelListVisible] = useState(false);
  const [channelTitle, setChannelTitle] = useState<string | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 路由参数变化时同步槽位（例如从首页重新进入）
  useEffect(() => {
    setActiveSlot(isLiveSourceSlot(params.slot) ? params.slot : "tv");
  }, [params.slot]);

  // 确保多源配置已加载（旧版 m3uUrl 迁移也在此完成）
  useEffect(() => {
    loadLiveSources();
  }, [loadLiveSources]);

  const boundSource = React.useMemo(() => {
    const id = liveBindings[activeSlot];
    if (!id) return null;
    return liveSources.find((s) => s.id === id) || null;
  }, [activeSlot, liveBindings, liveSources]);

  const m3uUrl = boundSource?.url || "";

  const selectedChannelUrl = channels.length > 0 ? getPlayableUrl(channels[currentChannelIndex].url) : null;

  useEffect(() => {
    let cancelled = false;
    const loadChannels = async () => {
      // 未配置源：清空状态，展示引导页
      if (!m3uUrl) {
        setChannels([]);
        setGroupedChannels({});
        setChannelGroups([]);
        setSelectedGroup("");
        setCurrentChannelIndex(0);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const parsedChannels = await fetchAndParseM3u(m3uUrl);
      if (cancelled) return;
      setChannels(parsedChannels);
      setCurrentChannelIndex(0);

      const groups: Record<string, Channel[]> = parsedChannels.reduce((acc, channel) => {
        const groupName = channel.group || "Other";
        if (!acc[groupName]) {
          acc[groupName] = [];
        }
        acc[groupName].push(channel);
        return acc;
      }, {} as Record<string, Channel[]>);

      const groupNames = Object.keys(groups);
      setGroupedChannels(groups);
      setChannelGroups(groupNames);
      setSelectedGroup(groupNames[0] || "");

      if (parsedChannels.length > 0) {
        showChannelTitle(parsedChannels[0].name);
      }
      setIsLoading(false);
    };
    loadChannels();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m3uUrl]);

  useEffect(() => {
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, []);

  const showChannelTitle = (title: string) => {
    setChannelTitle(title);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => setChannelTitle(null), 3000);
  };

  const handleSelectChannel = (channel: Channel) => {
    const globalIndex = channels.findIndex((c) => c.id === channel.id);
    if (globalIndex !== -1) {
      setCurrentChannelIndex(globalIndex);
      showChannelTitle(channel.name);
      setIsChannelListVisible(false);
    }
  };

  const changeChannel = useCallback(
    (direction: "next" | "prev") => {
      if (channels.length === 0) return;
      let newIndex =
        direction === "next"
          ? (currentChannelIndex + 1) % channels.length
          : (currentChannelIndex - 1 + channels.length) % channels.length;
      setCurrentChannelIndex(newIndex);
      showChannelTitle(channels[newIndex].name);
    },
    [channels, currentChannelIndex]
  );

  // 上键：在 TV / MUSIC 之间切换
  const switchSlot = useCallback(() => {
    const next: LiveSourceSlot = activeSlot === "tv" ? "mtv" : "tv";
    setActiveSlot(next);
    setIsChannelListVisible(false);
    // 同步路由参数，便于返回时保持入口状态
    router.setParams({ slot: next });
  }, [activeSlot, router]);

  const handleTVEvent = useCallback(
    (event: HWEvent) => {
      if (deviceType !== 'tv') return;
      if (isChannelListVisible) {
        // 频道列表打开时，back 关闭列表
        if (event.eventType === "back") setIsChannelListVisible(false);
        return;
      }
      if (event.eventType === "down") setIsChannelListVisible(true);
      else if (event.eventType === "left") changeChannel("prev");
      else if (event.eventType === "right") changeChannel("next");
      else if (event.eventType === "up") switchSlot();
    },
    [changeChannel, isChannelListVisible, deviceType, switchSlot]
  );

  useSafeTVEventHandler(deviceType === 'tv' ? handleTVEvent : () => {});

  // 动态样式
  const dynamicStyles = createResponsiveStyles(deviceType, spacing);

  // 未配置 / 加载失败引导页
  const renderEmptyState = () => (
    <View style={dynamicStyles.emptyContainer}>
      <Text style={dynamicStyles.emptyEmoji}>📺</Text>
      <ThemedText style={dynamicStyles.emptyTitle}>
        {m3uUrl
          ? `${LIVE_SLOT_LABELS[activeSlot]} 源的频道加载失败`
          : `${LIVE_SLOT_LABELS[activeSlot]} 入口尚未配置直播源`}
      </ThemedText>
      <ThemedText style={dynamicStyles.emptySubtitle}>
        {m3uUrl
          ? `当前源「${boundSource?.name || ""}」未解析到任何频道，请检查地址是否正确或在设置中测试连接。`
          : `请先在设置中添加 M3U 源，并将它绑定到 ${LIVE_SLOT_LABELS[activeSlot]} 入口，之后即可在这里观看直播。`}
      </ThemedText>

      {/* 入口切换（TV / MUSIC） */}
      <View style={dynamicStyles.slotSwitcher}>
        {(['tv', 'mtv'] as LiveSourceSlot[]).map((slot) => (
          <StyledButton
            key={slot}
            text={LIVE_SLOT_LABELS[slot]}
            isSelected={activeSlot === slot}
            onPress={() => setActiveSlot(slot)}
            style={dynamicStyles.slotButton}
          />
        ))}
      </View>

      <StyledButton
        text="前往设置"
        variant="primary"
        onPress={() => router.push("/settings")}
        style={dynamicStyles.emptyButton}
      />
      <ThemedText style={dynamicStyles.emptyHint}>
        遥控器：左右换台 · 下键频道列表 · 上键切换 电视 / 音乐台
      </ThemedText>
    </View>
  );

  const renderLiveContent = () => (
    <>
      <LivePlayer
        streamUrl={selectedChannelUrl}
        channelTitle={channelTitle}
        onPlaybackStatusUpdate={() => {}}
      />

      {/* 顶部：入口标识与 TV / MUSIC 切换 */}
      <View style={dynamicStyles.topBar}>
        <View style={dynamicStyles.slotSwitcher}>
          {(['tv', 'mtv'] as LiveSourceSlot[]).map((slot) => (
            <Pressable
              key={slot}
              android_ripple={{ color: "transparent" }}
              onPress={() => setActiveSlot(slot)}
              style={[
                dynamicStyles.slotChip,
                activeSlot === slot && dynamicStyles.slotChipActive,
              ]}
            >
              <Text
                style={[
                  dynamicStyles.slotChipText,
                  activeSlot === slot && dynamicStyles.slotChipTextActive,
                ]}
              >
                {LIVE_SLOT_LABELS[slot]}
              </Text>
            </Pressable>
          ))}
          <ThemedText style={dynamicStyles.sourceName} numberOfLines={1}>
            {boundSource ? boundSource.name : ""}
          </ThemedText>
        </View>
        {isLoading ? <ActivityIndicator size="small" color={Colors.dark.primary} /> : null}
      </View>

      {channels.length === 0 && !isLoading ? renderEmptyState() : null}

      <Modal
        animationType="slide"
        transparent={true}
        visible={isChannelListVisible}
        onRequestClose={() => setIsChannelListVisible(false)}
      >
        <View style={dynamicStyles.modalContainer}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>选择频道 · {LIVE_SLOT_LABELS[activeSlot]}</Text>
            <View style={dynamicStyles.listContainer}>
              <View style={dynamicStyles.groupColumn}>
                <FlatList
                  data={channelGroups}
                  keyExtractor={(item, index) => `group-${item}-${index}`}
                  renderItem={({ item }) => (
                    <StyledButton
                      text={item}
                      onPress={() => setSelectedGroup(item)}
                      isSelected={selectedGroup === item}
                      style={dynamicStyles.groupButton}
                      textStyle={dynamicStyles.groupButtonText}
                    />
                  )}
                />
              </View>
              <View style={dynamicStyles.channelColumn}>
                {isLoading ? (
                  <ActivityIndicator size="large" />
                ) : (
                  <FlatList
                    data={groupedChannels[selectedGroup] || []}
                    keyExtractor={(item, index) => `${item.id}-${item.group}-${index}`}
                    renderItem={({ item }) => (
                      <StyledButton
                        text={item.name || "Unknown Channel"}
                        onPress={() => handleSelectChannel(item)}
                        isSelected={channels[currentChannelIndex]?.id === item.id}
                        hasTVPreferredFocus={channels[currentChannelIndex]?.id === item.id}
                        style={dynamicStyles.channelItem}
                        textStyle={dynamicStyles.channelItemText}
                      />
                    )}
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );

  const content = (
    <ThemedView style={[commonStyles.container, dynamicStyles.container]}>
      {renderLiveContent()}
    </ThemedView>
  );

  // 根据设备类型决定是否包装在响应式导航中
  if (deviceType === 'tv') {
    return content;
  }

  return (
    <ResponsiveNavigation>
      <ResponsiveHeader title={`直播 · ${LIVE_SLOT_LABELS[activeSlot]}`} showBackButton />
      {content}
    </ResponsiveNavigation>
  );
}

const createResponsiveStyles = (deviceType: string, spacing: number) => {
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  const minTouchTarget = DeviceUtils.getMinTouchTargetSize();

  return StyleSheet.create({
    container: {
      flex: 1,
    },
    topBar: {
      position: "absolute",
      top: Platform.isTV ? 24 : 8,
      left: spacing,
      right: spacing,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      zIndex: 5,
    },
    slotSwitcher: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    slotChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "#666",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    slotChipActive: {
      borderColor: Colors.dark.primary,
      backgroundColor: Colors.dark.primary,
    },
    slotChipText: {
      color: "#ccc",
      fontSize: 13,
      fontWeight: "600",
    },
    slotChipTextActive: {
      color: "#fff",
    },
    sourceName: {
      color: "#9BA1A6",
      fontSize: 12,
      maxWidth: 160,
      marginLeft: 8,
    },
    emptyContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.86)",
      padding: spacing * 2,
    },
    emptyEmoji: {
      fontSize: isMobile ? 56 : 72,
      marginBottom: spacing,
    },
    emptyTitle: {
      fontSize: isMobile ? 20 : 26,
      fontWeight: "bold",
      color: "#fff",
      textAlign: "center",
      marginBottom: spacing,
    },
    emptySubtitle: {
      fontSize: isMobile ? 14 : 16,
      color: "#B0B6BA",
      textAlign: "center",
      lineHeight: isMobile ? 22 : 26,
      maxWidth: isMobile ? 320 : 560,
      marginBottom: spacing * 1.5,
    },
    slotButton: {
      minHeight: 42,
    },
    emptyButton: {
      minHeight: isMobile ? minTouchTarget : 50,
      minWidth: isMobile ? 200 : 220,
      marginTop: spacing,
    },
    emptyHint: {
      fontSize: 12,
      color: "#777",
      textAlign: "center",
      marginTop: spacing * 1.5,
    },
    modalContainer: {
      flex: 1,
      flexDirection: "row",
      justifyContent: isMobile ? "center" : "flex-end",
      backgroundColor: "transparent",
    },
    modalContent: {
      width: isMobile ? '90%' : isTablet ? 400 : 450,
      height: "100%",
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      padding: spacing,
    },
    modalTitle: {
      color: "white",
      marginBottom: spacing / 2,
      textAlign: "center",
      fontSize: isMobile ? 18 : 16,
      fontWeight: "bold",
    },
    listContainer: {
      flex: 1,
      flexDirection: isMobile ? "column" : "row",
    },
    groupColumn: {
      flex: isMobile ? 0 : 1,
      marginRight: isMobile ? 0 : spacing / 2,
      marginBottom: isMobile ? spacing : 0,
      maxHeight: isMobile ? 120 : undefined,
    },
    channelColumn: {
      flex: isMobile ? 1 : 2,
    },
    groupButton: {
      paddingVertical: isMobile ? minTouchTarget / 4 : 8,
      paddingHorizontal: spacing / 2,
      marginVertical: isMobile ? 2 : 4,
      minHeight: isMobile ? minTouchTarget * 0.7 : undefined,
    },
    groupButtonText: {
      fontSize: isMobile ? 14 : 13,
    },
    channelItem: {
      paddingVertical: isMobile ? minTouchTarget / 5 : 6,
      paddingHorizontal: spacing,
      marginVertical: isMobile ? 2 : 3,
      minHeight: isMobile ? minTouchTarget * 0.8 : undefined,
    },
    channelItemText: {
      fontSize: isMobile ? 14 : 12,
    },
  });
};
