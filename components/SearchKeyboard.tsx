/**
 * 搜索页 / 音乐在线页内置屏幕键盘（v2.5.0 中文输入重构）。
 *
 * v2.3.0 起：大屏键盘收进左栏独立面板、宽度按 panelWidth 推导、
 * 当前字母翡翠绿高亮、功能行按权重分配避免被 nowrap 裁切。
 *
 * v2.5.0 新增：
 *  - 中文拼音组合区 + 候选栏（全拼 / 首字母 / 单字三路召回）；
 *  - 「中 / En」切换，英文模式保持原来的逐字符输入；
 *  - 删除键由页面统一处理：先退拼音，再退正文最后一个码点；
 *  - 清空与回退语义统一，候选可点、可遥控器 OK 选中。
 *
 * 键盘本身只负责展示与事件转发，输入法逻辑放在 modules/search/pinyinIme.ts，
 * 便于单独升级而不改动页面。
 */
import React, { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TouchableOpacityProps,
} from "react-native";
import { X } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { useCompactLayout, getKeyboardActionWidths } from "@/utils/DesignTokens";
import { Colors } from "@/constants/Colors";

const LETTER_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const NUMBER_ROWS = ["1234567890", "-/:;()@&\""];
const FOCUS_KEYS = new Set([...LETTER_ROWS.join(""), ...NUMBER_ROWS.join("")]);

interface SearchKeyboardProps {
  visible: boolean;
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onSearch: () => void;
  onClear: () => void;
  onClose: () => void;
  title?: string;
  hint?: string;
  quickTerms?: string[];
  onQuickTerm?: (term: string) => void;
  panelWidth?: number;
  /** v2.5.0 中文输入法 */
  imeEnabled?: boolean;
  onToggleIme?: () => void;
  composing?: string;
  candidates?: string[];
  onSelectCandidate?: (index: number) => void;
  onCommitComposition?: () => void;
}

interface KeyButtonProps extends TouchableOpacityProps {
  label: string;
  width: number;
  height: number;
  accent?: boolean;
  preferred?: boolean;
  highlighted?: boolean;
  fontSize?: number;
}

function KeyButton({
  label,
  width,
  height,
  accent,
  preferred,
  highlighted,
  fontSize,
  ...rest
}: KeyButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      hasTVPreferredFocus={preferred}
      hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
      style={[
        styles.key,
        { width, height, minWidth: 0, flexShrink: 1 },
        accent && styles.keyAccent,
        highlighted && styles.keyHighlighted,
      ]}
      {...rest}
    >
      <ThemedText
        style={[
          styles.keyText,
          fontSize ? { fontSize } : null,
          (accent || highlighted) && styles.keyTextAccent,
        ]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );
}

export function SearchKeyboard({
  visible,
  onKeyPress,
  onDelete,
  onSearch,
  onClear,
  onClose,
  title = "屏幕键盘",
  hint = "输入拼音或首字母选中文，如 qing / QYN → 庆余年",
  quickTerms,
  onQuickTerm,
  panelWidth,
  imeEnabled = true,
  onToggleIme,
  composing = "",
  candidates = [],
  onSelectCandidate,
  onCommitComposition,
}: SearchKeyboardProps) {
  const [numeric, setNumeric] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const { screenWidth, deviceForm, spacing } = useResponsiveLayout();
  const metrics = useCompactLayout();
  if (!visible) return null;

  const isTV = metrics.isTVLike;
  const gap = metrics.gapSm;
  const padding = isTV ? metrics.cardPadding : Math.max(10, metrics.cardPadding - 4);
  const maxKeyWidth = isTV
    ? Math.round(64 * Math.min(1.35, metrics.resolutionScale))
    : deviceForm === "phone" ? 34 : 48;
  const baseWidth = panelWidth && panelWidth > 0 ? panelWidth : screenWidth - spacing * 2;
  const available = Math.max(190, Math.round(baseWidth - padding * 2));
  const letterKeyWidth = Math.max(18, Math.min(maxKeyWidth, (available - gap * 9) / 10));
  const keyHeight = Math.max(metrics.keyHeight, Math.min(metrics.minTouchTarget, 48));
  /** 功能行按 available 做权重分配：任何分辨率下总宽都不超过面板，不再被 nowrap 裁掉 */
  const actionWidths = getKeyboardActionWidths(available, gap);
  const rows = numeric ? NUMBER_ROWS : LETTER_ROWS;
  const keyFont = metrics.body;
  const highlight = (key: string) => {
    if (FOCUS_KEYS.has(key)) setActiveKey(key);
  };
  const showComposition = imeEnabled && !!composing && !numeric;

  return (
    <View
      style={[
        styles.container,
        {
          padding,
          borderRadius: metrics.radius,
          maxWidth: panelWidth ? Math.round(panelWidth) : undefined,
        },
      ]}
    >
      <View style={[styles.header, { marginBottom: gap + 2 }]}>
        <View style={styles.headerTitle}>
          <ThemedText style={[styles.title, { fontSize: metrics.body }]}>{title}</ThemedText>
          <ThemedText style={[styles.hint, { fontSize: metrics.caption }]} numberOfLines={2}>
            {hint}
          </ThemedText>
        </View>
        {onToggleIme && (
          <TouchableOpacity
            onPress={onToggleIme}
            accessibilityLabel="切换中文输入"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.modeButton,
              {
                minWidth: Math.round(metrics.minTouchTarget * 0.9),
                minHeight: Math.round(metrics.minTouchTarget * 0.75),
                borderRadius: metrics.radiusSm,
              },
            ]}
          >
            <ThemedText style={[styles.modeText, { fontSize: metrics.caption }]}>
              {imeEnabled ? "中" : "En"}
            </ThemedText>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onClose}
          style={[
            styles.closeButton,
            {
              minWidth: Math.round(metrics.minTouchTarget * 0.75),
              minHeight: Math.round(metrics.minTouchTarget * 0.75),
            },
          ]}
          accessibilityLabel="收起键盘"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={isTV ? 20 : 16} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {!!quickTerms?.length && onQuickTerm && (
        <View style={[styles.quickRow, { gap, marginBottom: gap + 2 }]}>
          {quickTerms.map((term) => (
            <TouchableOpacity
              key={term}
              onPress={() => onQuickTerm(term)}
              activeOpacity={0.7}
              style={[
                styles.quickChip,
                {
                  borderRadius: metrics.radiusSm,
                  minHeight: Math.round(metrics.minTouchTarget * 0.6),
                  justifyContent: "center",
                },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <ThemedText style={[styles.quickChipText, { fontSize: metrics.caption }]}>{term}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 中文拼音组合区：组合串 + 候选栏，遥控器可直接 OK 选中 */}
      {showComposition && (
        <View style={[styles.imeBox, { gap, marginBottom: gap + 2, borderRadius: metrics.radiusSm }]}>
          <View style={styles.imeHeader}>
            <ThemedText style={[styles.imePinyin, { fontSize: metrics.body }]}>
              {`拼音 ${composing}`}
            </ThemedText>
            {onCommitComposition && (
              <TouchableOpacity
                onPress={onCommitComposition}
                accessibilityLabel="提交英文字母"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[styles.commitButton, { minHeight: Math.round(metrics.minTouchTarget * 0.6) }]}
              >
                <ThemedText style={{ fontSize: metrics.caption, color: Colors.brand.accent }}>
                  提交英文
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.candidateScroll}>
            {candidates.length > 0 ? (
              candidates.map((candidate, index) => (
                <TouchableOpacity
                  key={`${candidate}-${index}`}
                  onPress={() => onSelectCandidate?.(index)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  style={[
                    styles.candidateChip,
                    {
                      borderRadius: metrics.radiusSm,
                      minHeight: Math.round(metrics.minTouchTarget * 0.7),
                    },
                  ]}
                >
                  <ThemedText style={[styles.candidateText, { fontSize: metrics.body }]}>
                    {candidate}
                  </ThemedText>
                </TouchableOpacity>
              ))
            ) : (
              <ThemedText style={{ fontSize: metrics.caption, color: Colors.text.tertiary }}>
                暂无候选 · 继续输入或删除
              </ThemedText>
            )}
          </ScrollView>
        </View>
      )}

      {rows.map((row, rowIndex) => (
        <View key={row} style={[styles.row, { gap, marginBottom: gap }]}>
          {row.split("").map((char, colIndex) => (
            <KeyButton
              key={`${row}-${char}-${colIndex}`}
              label={char}
              width={letterKeyWidth}
              height={keyHeight}
              fontSize={keyFont}
              preferred={rowIndex === 0 && colIndex === 0}
              highlighted={activeKey === char}
              onFocus={() => highlight(char)}
              onPress={() => {
                highlight(char);
                onKeyPress(char);
              }}
            />
          ))}
        </View>
      ))}

      <View style={[styles.row, { gap, marginTop: 2 }]}>
        <KeyButton
          label={numeric ? "ABC" : "123"}
          width={actionWidths[0]}
          height={keyHeight}
          fontSize={keyFont}
          onPress={() => setNumeric((value) => !value)}
        />
        <KeyButton
          label="删除"
          width={actionWidths[1]}
          height={keyHeight}
          fontSize={keyFont}
          onPress={onDelete}
        />
        <KeyButton
          label="清空"
          width={actionWidths[2]}
          height={keyHeight}
          fontSize={keyFont}
          onPress={onClear}
        />
        <KeyButton
          label="搜索"
          width={actionWidths[3]}
          height={keyHeight}
          fontSize={keyFont}
          accent
          preferred={numeric}
          onPress={onSearch}
        />
      </View>

      {metrics.showRemoteHint && (
        <ThemedText style={[styles.remoteHint, { fontSize: metrics.caption }]}>
          方向键移动 · OK 确认 · 返回键收起
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface.raised,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    marginTop: 6,
    marginBottom: 8,
    ...(Platform.isTV && { borderWidth: 2 }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerTitle: { flex: 1 },
  title: { fontWeight: "700", color: Colors.brand.accent },
  hint: { color: Colors.text.tertiary, marginTop: 2 },
  closeButton: { padding: 6, alignItems: "center", justifyContent: "center" },
  modeButton: {
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,230,168,0.14)",
    borderWidth: 1,
    borderColor: "rgba(0,230,168,0.4)",
  },
  modeText: { color: Colors.brand.accent, fontWeight: "700" },
  quickRow: { flexDirection: "row", flexWrap: "wrap" },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(0,230,168,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,230,168,0.35)",
  },
  quickChipText: { color: Colors.brand.accent, fontWeight: "600" },
  imeBox: {
    backgroundColor: Colors.surface.overlay,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    padding: 8,
  },
  imeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  imePinyin: { color: Colors.brand.accent, fontWeight: "700" },
  commitButton: { justifyContent: "center", paddingHorizontal: 8 },
  candidateScroll: { maxHeight: 64 },
  candidateChip: {
    paddingHorizontal: 12,
    justifyContent: "center",
    marginRight: 6,
    backgroundColor: "rgba(0,230,168,0.16)",
    borderWidth: 1,
    borderColor: "rgba(0,230,168,0.45)",
  },
  candidateText: { color: Colors.text.primary, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "nowrap",
    width: "100%",
    minWidth: 0,
    flexShrink: 1,
  },
  key: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    backgroundColor: Colors.surface.overlay,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surface.border,
  },
  keyAccent: { backgroundColor: Colors.brand.accent, borderColor: Colors.brand.accent },
  /** 设计稿：当前字母翡翠绿填充 + 发光描边 */
  keyHighlighted: {
    backgroundColor: Colors.brand.accent,
    borderColor: "#9BFFE0",
    borderWidth: 2,
    shadowColor: Colors.brand.accent,
    shadowOpacity: 0.75,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  keyText: { fontWeight: "600", color: Colors.text.primary },
  keyTextAccent: { color: Colors.brand.onAccent },
  remoteHint: { color: Colors.text.tertiary, textAlign: "right", marginTop: 6 },
});
