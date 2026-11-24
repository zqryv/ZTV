/**
 * 搜索页内置屏幕键盘。
 * 面向电视 / 机顶盒遥控器与触屏设备：直接点选字母、数字即可输入拼音首字母，
 * 例如依次点击 Q / Y / N 即可搜索「庆余年」。无需系统输入法或物理键盘。
 */
import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TouchableOpacityProps,
} from "react-native";
import { X } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { Colors } from "@/constants/Colors";

const LETTER_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const NUMBER_ROWS = ["1234567890", "-/:;()@&\""];

interface SearchKeyboardProps {
  visible: boolean;
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onSearch: () => void;
  onClear: () => void;
  onClose: () => void;
  /** 可选：标题 / 提示语，供不同页面复用 */
  title?: string;
  hint?: string;
  /** 可选：一键输入的热词（中文歌手 / 风格），解决遥控器无法输入中文的问题 */
  quickTerms?: string[];
  onQuickTerm?: (term: string) => void;
}

interface KeyButtonProps extends TouchableOpacityProps {
  label: string;
  width: number;
  height: number;
  accent?: boolean;
  preferred?: boolean;
}

function KeyButton({ label, width, height, accent, preferred, ...rest }: KeyButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.65}
      hasTVPreferredFocus={preferred}
      style={[
        styles.key,
        { width, height },
        accent && styles.keyAccent,
      ]}
      {...rest}
    >
      <ThemedText style={[styles.keyText, accent && styles.keyTextAccent]}>{label}</ThemedText>
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
  hint = "输入拼音首字母即可搜中文片名，如 QYN → 庆余年",
  quickTerms,
  onQuickTerm,
}: SearchKeyboardProps) {
  const [numeric, setNumeric] = useState(false);
  const { screenWidth, deviceForm, spacing } = useResponsiveLayout();
  if (!visible) return null;

  const isTV = deviceForm === "tv" || deviceForm === "setTopBox";
  const gap = isTV ? 8 : 5;
  const padding = isTV ? 24 : 12;
  const maxKeyWidth = isTV ? 86 : deviceForm === "phone" ? 40 : 64;
  const available = Math.max(240, screenWidth - spacing * 2 - padding * 2);
  const letterKeyWidth = Math.min(maxKeyWidth, (available - gap * 9) / 10);
  const keyHeight = isTV ? 58 : deviceForm === "phone" ? 40 : 48;
  const rows = numeric ? NUMBER_ROWS : LETTER_ROWS;

  return (
    <View style={[styles.container, { padding }]}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.hint}>{hint}</ThemedText>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="收起键盘">
          <X size={isTV ? 22 : 18} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {!!quickTerms?.length && onQuickTerm && (
        <View style={styles.quickRow}>
          {quickTerms.map((term) => (
            <TouchableOpacity
              key={term}
              onPress={() => onQuickTerm(term)}
              activeOpacity={0.7}
              style={styles.quickChip}
            >
              <ThemedText style={styles.quickChipText}>{term}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {rows.map((row, rowIndex) => (
        <View key={row} style={[styles.row, { marginBottom: gap }]}>
          {row.split("").map((char, colIndex) => (
            <KeyButton
              key={`${row}-${char}-${colIndex}`}
              label={char}
              width={letterKeyWidth}
              height={keyHeight}
              preferred={rowIndex === 0 && colIndex === 0}
              onPress={() => onKeyPress(char)}
            />
          ))}
        </View>
      ))}

      <View style={[styles.row, { marginTop: 2 }]}>
        <KeyButton
          label={numeric ? "ABC" : "123"}
          width={Math.max(58, letterKeyWidth * 1.5)}
          height={keyHeight}
          onPress={() => setNumeric((value) => !value)}
        />
        <KeyButton label="删除" width={Math.max(58, letterKeyWidth * 1.5)} height={keyHeight} onPress={onDelete} />
        <KeyButton label="清空" width={Math.max(58, letterKeyWidth * 1.5)} height={keyHeight} onPress={onClear} />
        <KeyButton
          label="搜索"
          width={Math.max(72, letterKeyWidth * 2)}
          height={keyHeight}
          accent
          preferred={numeric}
          onPress={onSearch}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface.raised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surface.border,
    marginTop: 8,
    marginBottom: 12,
    ...(Platform.isTV && { borderWidth: 2 }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  headerTitle: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.brand.accent,
  },
  hint: {
    fontSize: 11,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  closeButton: { padding: 6 },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(0,230,168,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,230,168,0.35)",
  },
  quickChipText: { fontSize: 12, color: Colors.brand.accent, fontWeight: "600" },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "nowrap",
    gap: 5,
  },
  key: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface.overlay,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surface.border,
  },
  keyAccent: {
    backgroundColor: Colors.brand.accent,
    borderColor: Colors.brand.accent,
  },
  keyText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  keyTextAccent: {
    color: Colors.brand.onAccent,
  },
});
