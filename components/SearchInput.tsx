/**
 * 统一可聚焦搜索输入框（v2.5.0）。
 *
 * 旧实现的两处焦点缺陷：
 *  1) app/search.tsx 用 TouchableOpacity 包住 TextInput，父层 onPress 抢走了
 *     指针事件，且 onFocus 里还会 setShowKeyboard(false) 把屏幕键盘收掉；
 *  2) app/music.tsx 在 TV / 大屏上写死 focusable={!isTVLike}，等于禁止聚焦，
 *     又没有任何 onFocus 联动，用户点搜索框完全没有反应。
 *
 * 本组件用普通 View 作容器（不拦截指针）、TextInput 自身负责聚焦，
 * 所有平台一律 focusable / editable，TV 上只关闭「系统软键盘」而保留屏幕键盘，
 * 清空按钮移到输入框外层同级，避免嵌套 Touchable 再次吞掉点击。
 */
import React, { useRef, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from "react-native";
import { Search, X } from "lucide-react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors } from "@/constants/Colors";
import { useCompactLayout } from "@/utils/DesignTokens";

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  onFocusChange?: (focused: boolean) => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput>;
  /** 组合中的拼音串，显示在输入框右侧提示区 */
  composing?: string;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChangeText,
  onSubmit,
  onClear,
  onFocusChange,
  placeholder = "输入关键词",
  inputRef,
  composing,
  style,
  inputStyle,
  autoFocus = false,
}: SearchInputProps) {
  const fallbackRef = useRef<TextInput>(null);
  const ref = inputRef ?? fallbackRef;
  const [focused, setFocused] = useState(false);
  const metrics = useCompactLayout();
  const isTVLike = metrics.isTVLike;

  const setFocus = (next: boolean) => {
    setFocused(next);
    onFocusChange?.(next);
  };

  return (
    <View style={[styles.row, style]}>
      {/* 普通 View，不再用 TouchableOpacity 拦截点击 */}
      <View
        style={[
          styles.inputContainer,
          {
            minHeight: metrics.minTouchTarget,
            borderColor: focused ? Colors.brand.accent : Colors.surface.border,
            borderRadius: metrics.radiusSm,
            paddingHorizontal: Math.round(metrics.gapSm + 4),
          },
        ]}
      >
        <Search size={metrics.body + 4} color={Colors.brand.accent} />
        <TextInput
          ref={ref}
          style={[styles.input, { fontSize: metrics.body }, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          editable={true}
          focusable={true}
          /** TV / 投影只关系统软键盘，屏幕键盘保持可用 */
          showSoftInputOnFocus={!isTVLike}
          autoFocus={autoFocus}
          accessibilityLabel={placeholder}
        />
        {!!composing && (
          <View style={styles.composing}>
            <ThemedText style={{ fontSize: metrics.caption, color: Colors.brand.accent }}>
              {composing}
            </ThemedText>
          </View>
        )}
      </View>
      {(value.length > 0 || !!composing) && onClear && (
        <TouchableOpacity
          onPress={onClear}
          accessibilityLabel="清空输入"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.clearButton,
            {
              minWidth: metrics.minTouchTarget,
              minHeight: metrics.minTouchTarget,
              borderRadius: metrics.radiusSm,
            },
          ]}
        >
          <X size={isTVLike ? 20 : 16} color={Colors.text.tertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface.overlay,
    borderWidth: 2,
    minWidth: 0,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    color: Colors.text.primary,
  },
  composing: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "rgba(0,230,168,0.12)",
    borderRadius: 4,
  },
  clearButton: { alignItems: "center", justifyContent: "center" },
});
