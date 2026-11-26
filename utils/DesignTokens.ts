/**
 * ZTV 多端紧凑布局标尺（v2.3.0）。
 *
 * 对应工作区设计稿「ZTV 多端界面设计预览」：3 界面 × 4 设备
 * （手机 393 / 平板 1024 / 桌面 1440 / 电视 1920）。
 *
 * 统一规则：
 * - 大屏从「单列堆叠、元素撑满整屏」改为左右分栏，左栏固定约 38~40%；
 * - 所有尺寸由「栏宽」推导，而不是整屏宽度，避免电视端控件被拉得过大；
 * - 电视端保留 10-foot 字号，但间距 / 圆角 / 卡片高度统一收紧；
 * - 搜索键盘、调谐器卡、正在播放卡共用同一组 gap / radius / 字号。
 *
 * 这是纯展示层工具，不改变任何数据接口与业务逻辑。
 */
import { useWindowDimensions } from "react-native";
import { useResponsiveLayout, DeviceType } from "@/hooks/useResponsiveLayout";

export interface CompactMetrics {
  deviceType: DeviceType;
  /** 是否采用左右分栏（平板 / 桌面 / 电视 / 机顶盒 / 展开态折叠屏） */
  isWide: boolean;
  isTVLike: boolean;
  width: number;
  height: number;
  /** 左栏宽度比例（设计稿：电视键盘面板约 40%） */
  leftRatio: number;
  /** 左栏实际像素宽 */
  leftWidth: number;
  gap: number;
  gapSm: number;
  radius: number;
  radiusSm: number;
  headerHeight: number;
  pageTitle: number;
  sectionTitle: number;
  body: number;
  caption: number;
  /** 播放器 / 调谐器卡内边距 */
  cardPadding: number;
  /** 正方形封面边长（按左栏宽度推导，不再按整屏） */
  coverSize: number;
  playButton: number;
  roundControl: number;
  keyHeight: number;
  /** 右栏卡片列数 */
  columns: number;
  /** 电视遥控器提示是否显示 */
  showRemoteHint: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

export const getCompactMetrics = (
  deviceType: DeviceType,
  width: number,
  height: number,
  spacing: number,
  isSetTopBox?: boolean,
): CompactMetrics => {
  const isTVLike = deviceType === "tv" || !!isSetTopBox;
  // 宽度 >= 900 即进入分栏（与设计稿平板 1024 / 桌面 1440 / 电视 1920 一致）
  const isWide = width >= 900 || isTVLike;

  // 电视端字号放大（10-foot），间距只小幅放大，避免控件被拉得过大
  const fontScale =
    deviceType === "tv" ? 1.22 : deviceType === "desktop" ? 1.06 : deviceType === "tablet" ? 1.02 : 1;
  const spaceScale =
    deviceType === "tv" ? 1.12 : deviceType === "desktop" ? 0.96 : deviceType === "tablet" ? 0.92 : 0.86;

  const horizontalPadding = spacing * 2;
  const leftRatio = isTVLike ? 0.4 : deviceType === "desktop" ? 0.38 : 0.4;
  const leftWidth = isWide
    ? Math.round((width - horizontalPadding) * leftRatio)
    : Math.round(width - horizontalPadding);

  const gap = clamp(10 * spaceScale, 7, 14);
  const gapSm = clamp(6 * spaceScale, 4, 9);

  // 封面按左栏宽推导：宽屏最多占左栏 52%，手机占 62%，并受屏高约束
  const coverRatio = isWide ? 0.52 : 0.62;
  const coverSize = clamp(
    Math.min(leftWidth * coverRatio, height * (isWide ? 0.34 : 0.3)),
    132,
    isTVLike ? 300 : 236,
  );

  return {
    deviceType,
    isWide,
    isTVLike,
    width,
    height,
    leftRatio,
    leftWidth,
    gap,
    gapSm,
    radius: clamp(16 * spaceScale, 12, 20),
    radiusSm: clamp(10 * spaceScale, 8, 14),
    headerHeight: clamp(40 * spaceScale, 34, 48),
    pageTitle: clamp(20 * fontScale, 18, 26),
    sectionTitle: clamp(15 * fontScale, 13, 19),
    body: clamp(12 * fontScale, 11, 15),
    caption: clamp(10 * fontScale, 9, 13),
    cardPadding: clamp(16 * spaceScale, 12, 20),
    coverSize,
    playButton: clamp(54 * spaceScale, 46, 64),
    roundControl: clamp(40 * spaceScale, 34, 48),
    keyHeight: clamp((isTVLike ? 46 : 38) * spaceScale, 34, 54),
    columns: isTVLike ? 3 : deviceType === "desktop" ? 3 : deviceType === "tablet" ? 2 : 1,
    showRemoteHint: isTVLike,
  };
};

/** 三页共用的 Hook：窗口尺寸变化时（折叠 / 旋转 / 缩放）实时重算 */
export const useCompactLayout = (): CompactMetrics => {
  const { width, height } = useWindowDimensions();
  const config = useResponsiveLayout();
  return getCompactMetrics(
    config.deviceType,
    width || config.screenWidth,
    height || config.screenHeight,
    config.spacing,
    config.isSetTopBox,
  );
};
