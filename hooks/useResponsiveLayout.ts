import { useState, useEffect } from "react";
import { Dimensions, Platform } from "react-native";

/**
 * 设备形态（跨端统一）
 * - mobile : 手机（iOS / Android 手机）
 * - tablet : 平板（iPad / Android 平板）
 * - desktop: 桌面电脑（Windows / Ubuntu / macOS，Electron + react-native-web 容器）
 * - tv     : 电视（Apple TV / Android TV，遥控器 10 英尺交互）
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
}

const BREAKPOINTS = {
  mobile: { min: 0, max: 767 },
  tablet: { min: 768, max: 1199 },
  desktop: { min: 1200, max: Infinity },
  // tv 不再用宽度判定：由 Platform.isTV 精确识别，避免宽屏桌面被误判为遥控器设备
  tv: { min: Infinity, max: Infinity },
};

/**
 * 设备形态识别
 * 优先级：真实 TV 平台 > Web 容器（桌面）> 屏幕宽度（手机/平板/桌面大屏）
 *
 * - Platform.isTV 精确识别 Apple TV / Android TV（react-native-tvos）
 * - Platform.OS === "web" 覆盖 Windows / Ubuntu / macOS 的 Electron + RN-Web 桌面壳
 * - 其余按宽度：平板横屏/桌面大屏走 desktop，获得多列侧边栏布局
 */
const getDeviceType = (width: number): DeviceType => {
  // 1) 真正的电视设备（遥控器 + 10 英尺交互）优先
  if (Platform.isTV) return "tv";

  // 2) Web 容器即桌面端（Electron 承载的 Windows / Ubuntu / macOS）
  if (Platform.OS === "web") {
    return width >= BREAKPOINTS.tablet.min ? "desktop" : "mobile";
  }

  // 3) 原生平台按宽度：大屏桌面/平板横屏 → desktop，平板 → tablet，其余 → mobile
  if (width >= BREAKPOINTS.desktop.min) return "desktop";
  if (width >= BREAKPOINTS.tablet.min) return "tablet";
  return "mobile";
};

const getLayoutConfig = (
  deviceType: DeviceType,
  width: number,
  height: number,
  isPortrait: boolean
): ResponsiveConfig => {
  const spacing =
    deviceType === "mobile" ? 8 : deviceType === "tablet" ? 12 : deviceType === "desktop" ? 16 : 20;

  let columns: number;
  let cardWidth: number;
  let cardHeight: number;

  switch (deviceType) {
    case "mobile":
      columns = isPortrait ? 3 : 4;
      // 使用flex布局，卡片可以更大一些来填充空间
      cardWidth = ((width - spacing) / columns) * 0.85; // 增大到85%
      cardHeight = cardWidth * 1.2; // 5:6 aspect ratio (reduced from 2:3)
      break;

    case "tablet":
      columns = isPortrait ? 3 : 4;
      cardWidth = ((width - spacing) / columns) * 0.85; // 增大到85%
      cardHeight = cardWidth * 1.4; // slightly less tall ratio
      break;

    case "desktop":
      // 桌面宽屏：更多列、更高信息密度（含侧边栏后的内容区由 flex 自适应）
      columns = width >= 1600 ? 7 : width >= 1400 ? 6 : 5;
      cardWidth = ((width - spacing * 2) / columns) * 0.9;
      cardHeight = cardWidth * 1.45;
      break;

    case "tv":
    default:
      columns = 5;
      cardWidth = 160; // Fixed width for TV
      cardHeight = 240; // Fixed height for TV
      break;
  }

  return {
    deviceType,
    columns,
    cardWidth,
    cardHeight,
    spacing,
    isPortrait,
    screenWidth: width,
    screenHeight: height,
  };
};

export const useResponsiveLayout = (): ResponsiveConfig => {
  const [dimensions, setDimensions] = useState(() => {
    const { width, height } = Dimensions.get("window");
    return { width, height };
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  const { width, height } = dimensions;
  const isPortrait = height > width;
  const deviceType = getDeviceType(width);

  return getLayoutConfig(deviceType, width, height, isPortrait);
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
    // Common responsive styles
    container: {
      paddingHorizontal: config.spacing,
    },

    // Card styles
    cardContainer: {
      width: config.cardWidth,
      height: config.cardHeight,
      marginBottom: config.spacing,
    },

    // Grid styles
    gridContainer: {
      paddingHorizontal: config.spacing / 2,
    },

    // Typography
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

    // Spacing
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
