import { useEffect, useMemo, useState } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";
import { DeviceUtils, DeviceForm, FoldState } from "@/utils/DeviceUtils";

export type { DeviceForm, FoldState } from "@/utils/DeviceUtils";

/**
 * 设备形态（跨端统一）
 * - mobile : 手机（iOS / Android / 鸿蒙手机，含折叠态）
 * - tablet : 平板（iPad / Android 平板 / 鸿蒙平板）
 * - desktop: 桌面电脑（Windows / Ubuntu / macOS，Electron + react-native-web 容器）
 * - tv     : 电视 / 机顶盒（Apple TV / Android TV，遥控器 10 英尺交互）
 */
export type DeviceType = "mobile" | "tablet" | "desktop" | "tv";

export interface ResponsiveConfig {
  deviceType: DeviceType;
  columns: number;
  cardWidth: number;
  cardHeight: number;
  spacing: number;
  isPortrait: boolean;
  screenWidth: number;
  screenHeight: number;
  /** 细粒度形态：三折屏 / 二折屏 / 单屏手机 / 平板 / 电视 / 机顶盒 / 桌面 */
  deviceForm?: DeviceForm;
  /** 折叠状态，随窗口尺寸变化实时更新 */
  foldState?: FoldState;
  isHarmonyOS?: boolean;
  isHarmonyOSNext?: boolean;
  isSetTopBox?: boolean;
}

const BREAKPOINTS = {
  mobile: { min: 0, max: 767 },
  tablet: { min: 768, max: 1199 },
  desktop: { min: 1200, max: Infinity },
  tv: { min: Infinity, max: Infinity },
};

const getDeviceType = (width: number): DeviceType => {
  if (Platform_isTV()) return "tv";
  if (Platform_OS() === "web") {
    return width >= BREAKPOINTS.tablet.min ? "desktop" : "mobile";
  }
  if (width >= BREAKPOINTS.desktop.min) return "desktop";
  if (width >= BREAKPOINTS.tablet.min) return "tablet";
  return "mobile";
};

// 集中读取 Platform，避免各处可选链重复；测试环境 mock 可能缺少字段
const Platform_isTV = () => Boolean((Platform as any)?.isTV);
const Platform_OS = () => String((Platform as any)?.OS ?? "");

const getLayoutConfig = (
  deviceType: DeviceType,
  width: number,
  height: number,
  isPortrait: boolean,
  deviceForm: DeviceForm,
): ResponsiveConfig => {
  const spacing =
    deviceType === "mobile" ? 8 : deviceType === "tablet" ? 12 : deviceType === "desktop" ? 16 : 20;

  let columns: number;
  let cardWidth: number;
  let cardHeight: number;

  switch (deviceForm) {
    case "triFold":
      // 三折展开：接近小平板宽度，提升信息密度
      columns = isPortrait ? 6 : 8;
      cardWidth = ((width - spacing * 2) / columns) * 0.92;
      cardHeight = cardWidth * 1.4;
      break;
    case "foldable":
      columns = isPortrait ? 4 : 5;
      cardWidth = ((width - spacing * 2) / columns) * 0.9;
      cardHeight = cardWidth * 1.35;
      break;
    case "setTopBox":
      // 机顶盒常见 720p/1080p，遥控器操作需要更大的卡片与间距
      columns = 4;
      cardWidth = ((width - spacing * 2) / columns) * 0.9;
      cardHeight = cardWidth * 1.4;
      break;
    case "phone":
      columns = isPortrait ? 3 : 4;
      cardWidth = ((width - spacing) / columns) * 0.85;
      cardHeight = cardWidth * 1.2;
      break;
    case "tablet":
      columns = isPortrait ? 3 : 4;
      cardWidth = ((width - spacing) / columns) * 0.85;
      cardHeight = cardWidth * 1.4;
      break;
    case "desktop":
      columns = width >= 1600 ? 7 : width >= 1400 ? 6 : 5;
      cardWidth = ((width - spacing * 2) / columns) * 0.9;
      cardHeight = cardWidth * 1.45;
      break;
    case "tv":
    default:
      columns = 5;
      cardWidth = 160;
      cardHeight = 240;
      break;
  }

  return {
    deviceType,
    deviceForm,
    foldState: DeviceUtils.getFoldState(width, height),
    isHarmonyOS: DeviceUtils.isHarmonyOS(),
    isHarmonyOSNext: DeviceUtils.isHarmonyOSNext(),
    isSetTopBox: deviceForm === "setTopBox",
    columns,
    cardWidth,
    cardHeight,
    spacing,
    isPortrait,
    screenWidth: width,
    screenHeight: height,
  };
};

/**
 * 响应式布局 Hook。
 * 使用 useWindowDimensions 而非一次性 Dimensions.get，折叠屏展开/折叠、
 * 横竖屏切换、桌面窗口缩放都会立即重算布局。
 */
export const useResponsiveLayout = (): ResponsiveConfig => {
  const windowDimensions = useWindowDimensions();
  const [fallback, setFallback] = useState(() => {
    const { width, height } = Dimensions.get("window");
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setFallback({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  const width = windowDimensions?.width || fallback.width;
  const height = windowDimensions?.height || fallback.height;
  const isPortrait = height > width;
  const deviceType = getDeviceType(width);
  const deviceForm = DeviceUtils.getDeviceForm(width, height);

  return useMemo(
    () => getLayoutConfig(deviceType, width, height, isPortrait, deviceForm),
    [deviceType, width, height, isPortrait, deviceForm],
  );
};

// Utility hook for responsive values
// desktop 可选：未传时回退到 tv 的值，保持既有调用方完全兼容
export const useResponsiveValue = <T>(values: {
  mobile: T;
  tablet: T;
  tv: T;
  desktop?: T;
}): T => {
  const { deviceType } = useResponsiveLayout();
  if (deviceType === "desktop") {
    return (values.desktop !== undefined ? values.desktop : values.tv) as T;
  }
  return values[deviceType] as T;
};

// Utility hook for responsive styles
export const useResponsiveStyles = () => {
  const config = useResponsiveLayout();

  return {
    container: {
      paddingHorizontal: config.spacing,
    },
    cardContainer: {
      width: config.cardWidth,
      height: config.cardHeight,
      marginBottom: config.spacing,
    },
    gridContainer: {
      paddingHorizontal: config.spacing / 2,
    },
    titleFontSize:
      config.deviceType === "mobile"
        ? 18
        : config.deviceType === "tablet"
          ? 22
          : config.deviceType === "desktop"
            ? 26
            : 28,
    bodyFontSize:
      config.deviceType === "mobile"
        ? 14
        : config.deviceType === "tablet"
          ? 16
          : config.deviceType === "desktop"
            ? 17
            : 18,
    sectionSpacing:
      config.deviceType === "mobile"
        ? 16
        : config.deviceType === "tablet"
          ? 20
          : config.deviceType === "desktop"
            ? 22
            : 24,
    itemSpacing: config.spacing,
  };
};
