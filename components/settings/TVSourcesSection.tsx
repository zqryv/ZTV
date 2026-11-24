import React, { useState, useRef, useImperativeHandle, forwardRef } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useSafeTVEventHandler } from "@/hooks/useSafeTVEventHandler";
import Toast from "react-native-toast-message";
import { ThemedText } from "@/components/ThemedText";
import { StyledButton } from "@/components/StyledButton";
import { SettingsSection } from "./SettingsSection";
import { Colors } from "@/constants/Colors";
import { useSettingsStore } from "@/stores/settingsStore";
import { useRemoteControlStore } from "@/stores/remoteControlStore";
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
  /** 供遥控器远程输入使用：把文本写入当前正在编辑的输入框（名称/地址） */
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
      remoteInputEnabled,
    } = useSettingsStore();
    const { deviceType } = useResponsiveLayout();
    const { serverUrl } = useRemoteControlStore();

    const [isSectionFocused, setIsSectionFocused] = useState(false);
    const [focusedInput, setFocusedInput] = useState<"name" | "url">("url");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [nameInput, setNameInput] = useState("");
    /** 地址可编辑部分（不含固定 https:// 前缀） */
    const [urlInput, setUrlInput] = useState("");
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, M3uTestResult>>({});
    const nameInputRef = useRef<TextInput>(null);
    const urlInputRef = useRef<TextInput>(null);

    /** 固定协议头：地址输入框永久显示该前缀，用户只需填写后半段 */
    const URL_SCHEME = "https://";
    /** 组合出完整地址；若用户粘贴了完整 URL 也兼容 */
    const buildFullUrl = (suffix: string): string => {
      const raw = suffix.trim();
      if (!raw) return "";
      return /^https?:\/\//i.test(raw) ? raw : `${URL_SCHEME}${raw}`;
    };
    /** 编辑已有源时拆掉协议头，只把后半段放进输入框 */
    const stripScheme = (url: string): string => url.replace(/^https?:\/\//i, "");

    useImperativeHandle(ref, () => ({
      setInputValue: (value: string) => {
        // 写入当前聚焦的输入框；TV 上可先用遥控器聚焦名称或地址框再远程输入
        if (focusedInput === "name") setNameInput(value);
        else setUrlInput(stripScheme(value));
        onChanged();
      },
    }));

    const markChanged = () => onChanged();

    // TV 遥控器：本区块获得焦点时，左右键在「名称 / 地址」两个输入框间切换聚焦，
    // OK/select 进入当前选中的输入框，方便用手机远程输入名称或地址。
    const handleTVEvent = React.useCallback(
      (event: any) => {
        if (!isSectionFocused) return;
        if (event.eventType === "left" || event.eventType === "right") {
          const next = focusedInput === "name" ? "url" : "name";
          setFocusedInput(next);
          if (next === "name") nameInputRef.current?.focus();
          else urlInputRef.current?.focus();
          return;
        }
        if (event.eventType === "select") {
          if (focusedInput === "url") urlInputRef.current?.focus();
          else nameInputRef.current?.focus();
        }
      },
      [isSectionFocused, focusedInput]
    );
    useSafeTVEventHandler(handleTVEvent);

    const resetForm = () => {
      setEditingId(null);
      setNameInput("");
      setUrlInput("");
    };

    const handleSaveSource = async () => {
      const url = buildFullUrl(urlInput);
      if (!urlInput.trim()) {
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
      setUrlInput(stripScheme(source.url));
      setFocusedInput("url");
      setTimeout(() => urlInputRef.current?.focus(), 0);
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

    // 是否显示远程输入提示（TV / 平板等非手机端）
    const showRemoteHint = deviceType !== "mobile" && remoteInputEnabled && serverUrl;

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
          管理多个 M3U 源，并分别为首页「电视」/「音乐台」入口指定要加载的源。
        </ThemedText>
        {showRemoteHint && (
          <ThemedText style={styles.remoteHint}>
            遥控器无法直接输入时，用手机访问 {serverUrl} 远程输入地址。
          </ThemedText>
        )}

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
                        text="绑定 电视"
                        variant="ghost"
                        onPress={() => handleBind("tv", source.id)}
                        style={styles.smallButton}
                        textStyle={styles.smallButtonText}
                      />
                      <StyledButton
                        text="绑定 音乐台"
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
          <View style={styles.formTitleRow}>
            <ThemedText style={styles.subTitle}>{editingId ? "编辑直播源" : "新增直播源"}</ThemedText>
            {/* 遥控器/触屏都可直接跳到名称框，确保「源名称」随时可输入、可编辑 */}
            <StyledButton
              text="输入/修改名称"
              variant="ghost"
              onPress={() => {
                setFocusedInput("name");
                setIsSectionFocused(true);
                nameInputRef.current?.focus();
              }}
              style={styles.smallButton}
              textStyle={styles.smallButtonText}
            />
          </View>
          <TextInput
            ref={nameInputRef}
            style={[styles.input, focusedInput === "name" && isSectionFocused && styles.inputFocused]}
            value={nameInput}
            onChangeText={(text) => {
              setNameInput(text);
              markChanged();
            }}
            onFocus={() => {
              setFocusedInput("name");
              setIsSectionFocused(true);
              onFocus?.();
            }}
            placeholder="源名称（如：央视源、我的私人源）"
            placeholderTextColor="#888"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => urlInputRef.current?.focus()}
          />
          {/* 地址输入框：https:// 作为固定前缀常驻显示，仅后半段可编辑 */}
          <View style={[styles.urlInputRow, focusedInput === "url" && isSectionFocused && styles.inputFocused]}>
            <ThemedText style={styles.urlPrefix}>{URL_SCHEME}</ThemedText>
            <TextInput
              ref={urlInputRef}
              style={styles.urlTextInput}
              value={urlInput}
              onChangeText={(text) => {
                setUrlInput(stripScheme(text));
                markChanged();
              }}
              onFocus={() => {
                setFocusedInput("url");
                setIsSectionFocused(true);
                onFocus?.();
              }}
              placeholder="example.com/live.m3u8"
              placeholderTextColor="#888"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleSaveSource}
            />
          </View>
          <ThemedText style={styles.formHint}>
            名称与地址均可编辑；地址固定以 {URL_SCHEME} 开头，只需填写后面的域名与路径。
          </ThemedText>
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
  remoteHint: {
    fontSize: 12,
    color: Colors.dark.primary,
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
  formTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
  urlInputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    backgroundColor: "#2a2a2c",
    marginBottom: 8,
    overflow: "hidden",
  },
  urlPrefix: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.primary,
    paddingHorizontal: 12,
    height: "100%",
    textAlignVertical: "center",
    borderRightWidth: 1,
    borderRightColor: "#444",
    backgroundColor: "rgba(0,230,168,0.08)",
  },
  urlTextInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 10,
    fontSize: 14,
    color: "white",
  },
  formHint: {
    fontSize: 11,
    color: "#9BA1A6",
    marginBottom: 8,
  },
  inputFocused: {
    borderColor: Colors.dark.primary,
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
