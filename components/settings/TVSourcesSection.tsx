import React, { useState, useRef, useImperativeHandle, forwardRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import { SettingsSection } from "./SettingsSection";
import { Colors } from "@/constants/Colors";
import { useSettingsStore } from "@/stores/settingsStore";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { testM3uUrl } from "@/services/m3u";
import {
  LIVE_SOURCE_SLOTS,
  LIVE_SLOT_LABELS,
  M3uSource,
  M3uTestResult,
} from "@/constants/LiveSources";

interface TVSourcesSectionProps {
  onChanged: () => void;
  onFocus?: () => void;
}

export interface TVSourcesSectionRef {
  /** 供遥控器远程输入使用：把文本写入当前正在编辑的地址框 */
  setInputValue: (value: string) => void;
}

export const TVSourcesSection = forwardRef<TVSourcesSectionRef, TVSourcesSectionProps>(
  ({ onChanged, onFocus }, ref) => {
    const {
      liveSources,
      liveBindings,
      addLiveSource,
      updateLiveSource,
      removeLiveSource,
      bindLiveSource,
    } = useSettingsStore();
    const { deviceType } = useResponsiveLayout();

    const [isSectionFocused, setIsSectionFocused] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [nameInput, setNameInput] = useState("");
    const [urlInput, setUrlInput] = useState("");
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, M3uTestResult>>({});
    const urlInputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({
      setInputValue: (value: string) => {
        setUrlInput(value);
        onChanged();
      },
    }));

    const markChanged = () => onChanged();

    const resetForm = () => {
      setEditingId(null);
      setNameInput("");
      setUrlInput("");
    };

    const handleSaveSource = async () => {
      const url = urlInput.trim();
      if (!url) {
        Toast.show({ type: "error", text1: "请输入 M3U 地址" });
        return;
      }
      try {
        if (editingId) {
          await updateLiveSource(editingId, { name: nameInput, url });
          Toast.show({ type: "success", text1: "已更新直播源" });
        } else {
          await addLiveSource(nameInput, url);
          Toast.show({ type: "success", text1: "已添加直播源" });
        }
        resetForm();
        setTestResults({});
        markChanged();
      } catch {
        Toast.show({ type: "error", text1: "保存直播源失败" });
      }
    };

    const handleEdit = (source: M3uSource) => {
      setEditingId(source.id);
      setNameInput(source.name);
      setUrlInput(source.url);
      urlInputRef.current?.focus();
    };

    const handleDelete = (source: M3uSource) => {
      Alert.alert("删除直播源", `确定删除「${source.name}」吗？已绑定该源的入口将被清除。`, [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            await removeLiveSource(source.id);
            const nextResults = { ...testResults };
            delete nextResults[source.id];
            setTestResults(nextResults);
            if (editingId === source.id) resetForm();
            markChanged();
          },
        },
      ]);
    };

    const handleTest = async (source: M3uSource) => {
      setTestingId(source.id);
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[source.id];
        return next;
      });
      const result = await testM3uUrl(source.url);
      setTestResults((prev) => ({ ...prev, [source.id]: result }));
      setTestingId(null);
    };

    const handleBind = async (slot: "tv" | "mtv", sourceId: string | null) => {
      await bindLiveSource(slot, sourceId);
      markChanged();
    };

    const isBindingTarget = (slot: "tv" | "mtv", source: M3uSource) =>
      liveBindings[slot] === source.id;

    return (
      <SettingsSection
        focusable
        onFocus={() => {
          setIsSectionFocused(true);
          onFocus?.();
        }}
        onBlur={() => setIsSectionFocused(false)}
      >
        <ThemedText style={[styles.sectionTitle, isSectionFocused && styles.sectionTitleFocused]}>
          TV 源设置
        </ThemedText>
        <ThemedText style={styles.hint}>
          管理多个 M3U 源，并分别为首页 TV / MTV 入口指定要加载的源。
        </ThemedText>

        {/* 入口绑定区 */}
        <View style={styles.bindBlock}>
          {LIVE_SOURCE_SLOTS.map((slot) => {
            const bound = liveSources.find((s) => s.id === liveBindings[slot]);
            return (
              <View key={slot} style={styles.bindRow}>
                <ThemedText style={styles.bindLabel}>{LIVE_SLOT_LABELS[slot]} 入口</ThemedText>
                <ThemedText style={[styles.bindValue, !bound && styles.bindValueEmpty]}>
                  {bound ? bound.name : "未绑定"}
                </ThemedText>
                <StyledButton
                  text={bound ? "更换" : "选择"}
                  variant="primary"
                  onPress={() => {
                    // 在已有源之间循环切换；没有源时提示先添加
                    if (liveSources.length === 0) {
                      Toast.show({ type: "info", text1: "请先添加一个直播源" });
                      return;
                    }
                    const currentIndex = liveSources.findIndex((s) => s.id === liveBindings[slot]);
                    const nextIndex = (currentIndex + 1) % liveSources.length;
                    handleBind(slot, liveSources[nextIndex].id);
                  }}
                  style={styles.smallButton}
                  textStyle={styles.smallButtonText}
                />
                {bound && (
                  <StyledButton
                    text="清除"
                    variant="ghost"
                    onPress={() => handleBind(slot, null)}
                    style={styles.smallButton}
                    textStyle={styles.smallButtonText}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* 已存在的源列表 */}
        {liveSources.length > 0 && (
          <View style={styles.listBlock}>
            <ThemedText style={styles.subTitle}>直播源列表（{liveSources.length}）</ThemedText>
            <ScrollView style={styles.listScroll} nestedScrollEnabled>
              {liveSources.map((source) => {
                const result = testResults[source.id];
                const boundTo = LIVE_SOURCE_SLOTS.filter((slot) => isBindingTarget(slot, source))
                  .map((slot) => LIVE_SLOT_LABELS[slot])
                  .join(" / ");
                return (
                  <View key={source.id} style={styles.sourceItem}>
                    <View style={styles.sourceHeaderRow}>
                      <ThemedText style={styles.sourceName} numberOfLines={1}>
                        {source.name}
                      </ThemedText>
                      {boundTo ? (
                        <ThemedText style={styles.boundTag}>已绑定 {boundTo}</ThemedText>
                      ) : null}
                    </View>
                    <ThemedText style={styles.sourceUrl} numberOfLines={2}>
                      {source.url}
                    </ThemedText>
                    {result ? (
                      <ThemedText
                        style={[
                          styles.testResult,
                          result.ok ? styles.testOk : styles.testFail,
                        ]}
                      >
                        {result.ok
                          ? `连接成功 · ${result.channelCount} 个频道 · ${(result.durationMs / 1000).toFixed(1)}s`
                          : `连接失败 · ${result.error}`}
                      </ThemedText>
                    ) : null}
                    <View style={styles.sourceActions}>
                      <StyledButton
                        text={testingId === source.id ? "测试中..." : "测试连接"}
                        variant="ghost"
                        disabled={testingId === source.id}
                        onPress={() => handleTest(source)}
                        style={styles.smallButton}
                        textStyle={styles.smallButtonText}
                      />
                      <StyledButton
                        text="绑定 TV"
                        variant="ghost"
                        onPress={() => handleBind("tv", source.id)}
                        style={styles.smallButton}
                        textStyle={styles.smallButtonText}
                      />
                      <StyledButton
                        text="绑定 MTV"
                        variant="ghost"
                        onPress={() => handleBind("mtv", source.id)}
                        style={styles.smallButton}
                        textStyle={styles.smallButtonText}
                      />
                      <StyledButton
                        text="编辑"
                        variant="ghost"
                        onPress={() => handleEdit(source)}
                        style={styles.smallButton}
                        textStyle={styles.smallButtonText}
                      />
                      <StyledButton
                        text="删除"
                        variant="ghost"
                        onPress={() => handleDelete(source)}
                        style={styles.smallButton}
                        textStyle={styles.smallButtonText}
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 新增 / 编辑表单 */}
        <View style={styles.formBlock}>
          <ThemedText style={styles.subTitle}>{editingId ? "编辑直播源" : "新增直播源"}</ThemedText>
          <TextInput
            style={styles.input}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="名称（选填，如：央视源）"
            placeholderTextColor="#888"
            autoCorrect={false}
          />
          <TextInput
            ref={urlInputRef}
            style={styles.input}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="输入 M3U 地址（http/https）"
            placeholderTextColor="#888"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onFocus={() => setIsSectionFocused(true)}
          />
          <View style={styles.formActions}>
            <StyledButton
              text={editingId ? "保存修改" : "添加源"}
              variant="primary"
              onPress={handleSaveSource}
              style={styles.actionButton}
            />
            {editingId ? (
              <StyledButton
                text="取消"
                variant="ghost"
                onPress={resetForm}
                style={styles.actionButton}
              />
            ) : null}
          </View>
        </View>
      </SettingsSection>
    );
  }
);

TVSourcesSection.displayName = "TVSourcesSection";

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 6,
  },
  sectionTitleFocused: {
    color: Colors.dark.primary,
  },
  hint: {
    fontSize: 12,
    color: "#9BA1A6",
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  bindBlock: {
    marginBottom: 12,
  },
  bindRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    paddingVertical: 6,
    gap: 8,
  },
  bindLabel: {
    fontSize: 14,
    fontWeight: "600",
    minWidth: 72,
  },
  bindValue: {
    fontSize: 13,
    color: Colors.dark.primary,
    flexShrink: 1,
    marginRight: 4,
  },
  bindValueEmpty: {
    color: "#9BA1A6",
  },
  listBlock: {
    marginBottom: 12,
  },
  listScroll: {
    maxHeight: Platform.isTV ? 240 : 220,
  },
  sourceItem: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "#333",
  },
  sourceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  boundTag: {
    fontSize: 11,
    color: Colors.dark.primary,
    marginLeft: 6,
  },
  sourceUrl: {
    fontSize: 11,
    color: "#9BA1A6",
    marginBottom: 6,
  },
  testResult: {
    fontSize: 12,
    marginBottom: 6,
  },
  testOk: {
    color: Colors.dark.primary,
  },
  testFail: {
    color: "#ff6b6b",
  },
  sourceActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  formBlock: {
    marginTop: 4,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: "#2a2a2c",
    color: "white",
    marginBottom: 8,
  },
  formActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  actionButton: {
    minHeight: 40,
  },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 32,
  },
  smallButtonText: {
    fontSize: 12,
  },
});
