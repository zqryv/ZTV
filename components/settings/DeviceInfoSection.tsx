import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { ThemedText } from "../ThemedText";
import { useResponsiveLayout, FoldState } from "@/hooks/useResponsiveLayout";
import { DeviceUtils } from "@/utils/DeviceUtils";
import { Colors } from "@/constants/Colors";

const FOLD_LABELS: Record<FoldState, string> = {
  single: "单屏",
  folded: "已折叠",
  unfolded: "已展开",
  fullyUnfolded: "完全展开",
};

/** 设备与显示信息：让用户直观看到鸿蒙 / 折叠屏 / 电视形态已生效 */
export function DeviceInfoSection() {
  const {
    deviceForm,
    foldState,
    screenWidth,
    screenHeight,
    columns,
    isHarmonyOS,
    isHarmonyOSNext,
    isSetTopBox,
  } = useResponsiveLayout();

  const os = String((Platform as any)?.OS ?? "unknown");
  const systemLabel = isHarmonyOSNext
    ? "HarmonyOS NEXT（原生）"
    : isHarmonyOS
      ? "HarmonyOS（Android 兼容层）"
      : os === "android"
        ? "Android"
        : os === "ios"
          ? "iOS / iPadOS"
          : os === "web"
            ? "Web / 桌面容器"
            : os;

  const form = deviceForm ?? DeviceUtils.getDeviceForm();
  const fold = foldState ?? "single";

  return (
    <View style={styles.sectionContainer}>
      <ThemedText style={styles.sectionTitle}>设备与显示</ThemedText>
      <View style={styles.row}>
        <ThemedText style={styles.label}>设备形态</ThemedText>
        <ThemedText style={styles.value}>{DeviceUtils.getFormLabel(form)}</ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText style={styles.label}>折叠状态</ThemedText>
        <ThemedText style={styles.value}>{FOLD_LABELS[fold]}</ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText style={styles.label}>屏幕尺寸</ThemedText>
        <ThemedText style={styles.value}>{Math.round(screenWidth)} × {Math.round(screenHeight)}</ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText style={styles.label}>布局列数</ThemedText>
        <ThemedText style={styles.value}>{columns}</ThemedText>
      </View>
      <View style={styles.row}>
        <ThemedText style={styles.label}>操作系统</ThemedText>
        <ThemedText style={styles.value}>{systemLabel}</ThemedText>
      </View>
      <ThemedText style={styles.hint}>
        {isSetTopBox
          ? "机顶盒模式：大字体、大卡片、遥控器焦点导航已启用"
          : isHarmonyOSNext
            ? "鸿蒙原生模式：请使用鸿蒙 Web 包或浏览器访问完整功能"
            : isHarmonyOS
              ? "鸿蒙兼容模式：可直接安装 Android 版应用，界面已适配折叠形态"
              : "界面自动适配手机 / 折叠屏 / 平板 / 电视 / 机顶盒"}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: Platform.select({
      ios: "rgba(255, 255, 255, 0.05)",
      android: "rgba(255, 255, 255, 0.05)",
      default: "transparent",
    }),
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: Platform.isTV ? 24 : 20,
    fontWeight: "bold",
    marginBottom: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  label: { fontSize: Platform.isTV ? 18 : 16, color: "#999" },
  value: {
    fontSize: Platform.isTV ? 18 : 16,
    color: Colors.text.secondary,
    textAlign: "right",
    flexShrink: 1,
  },
  hint: {
    fontSize: Platform.isTV ? 14 : 12,
    color: Colors.brand.accent,
    lineHeight: Platform.isTV ? 21 : 18,
    marginTop: 4,
  },
});
