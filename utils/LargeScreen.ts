/**
 * ZTV 大屏（电视 / 投影仪 / 4K）分辨率适配 —— 纯计算层（v2.4.0）。
 *
 * 设计目标：
 * - 布局尺寸同时受「可用内容宽度」与「可用内容高度」约束，分辨率 / 宽高比变化时自动重算；
 * - 从窗口尺寸中扣除侧边栏与顶栏占用，避免按整屏宽度推导后被导航容器挤压；
 * - 4K 提升字号与控件，720p / 4:3 投影收紧行高与键盘，避免内容溢出；
 * - 控件最小可点击 / 可聚焦区域按设备形态给出，电视端遵循 10-foot UI；
 * - 键盘功能行按面板宽度做权重分配，保证任何分辨率下不溢出、不裁剪。
 *
 * 本文件刻意不 import react-native，因此可直接被 Node 校验脚本与 Jest 加载，
 * 用于跑「常见电视 / 投影仪分辨率矩阵」。
 */
import type { DeviceType } from "@/hooks/useResponsiveLayout";

export interface LargeScreenProfile {
  label: string;
  width: number;
  height: number;
}

/** 常见电视 / 投影仪 / 大屏逻辑分辨率矩阵（覆盖 4:3、16:10、16:9 与 4K） */
export const LARGE_SCREEN_PROFILES: LargeScreenProfile[] = [
  { label: "XGA 投影 4:3", width: 1024, height: 768 },
  { label: "720p 电视 / 入门投影", width: 1280, height: 720 },
  { label: "WXGA 投影 16:10", width: 1280, height: 800 },
  { label: "HD 投影 / 电视", width: 1366, height: 768 },
  { label: "1080p 电视", width: 1920, height: 1080 },
  { label: "WUXGA 投影 16:10", width: 1920, height: 1200 },
  { label: "QHD / 2K 大屏", width: 2560, height: 1440 },
  { label: "4K UHD 电视", width: 3840, height: 2160 },
];

/** 低于该可用高度时分栏降级为单列，避免 4:3 / 低高度投影把两栏内容压扁 */
export const MIN_COLUMN_HEIGHT = 520;

/** 侧边栏宽度（TabletSidebarNavigator）与顶栏 + 页头的合计高度 */
export const NAV_SIDEBAR_WIDTH = 200;
export const NAV_CHROME_HEIGHT = 116;
export const TV_CHROME_HEIGHT = 72;

export interface ViewportOptions {
  /** 导航 / 侧栏占用的宽度；不传则按设备形态自动推断 */
  chromeWidth?: number;
  /** 顶栏 + 页头等占用的高度；不传则按设备形态自动推断 */
  chromeHeight?: number;
}

export interface CompactMetrics {
  deviceType: DeviceType;
  isWide: boolean;
  isTVLike: boolean;
  /** 是否命中电视 / 投影 / 4K 大屏分辨率 */
  isLargeScreen: boolean;
  width: number;
  height: number;
  /** 扣除侧栏与内边距后的真实可用宽度 */
  contentWidth: number;
  /** 扣除顶栏与内边距后的真实可用高度 */
  contentHeight: number;
  /** 相对 1080p 的分辨率缩放因子（4K 放大、720p 收紧） */
  resolutionScale: number;
  leftRatio: number;
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
  cardPadding: number;
  coverSize: number;
  playButton: number;
  roundControl: number;
  keyHeight: number;
  columns: number;
  /** 电视 / 大屏最小可点击、可聚焦区域 */
  minTouchTarget: number;
  focusBorderWidth: number;
  /** 左栏是否使用独立滚动兜底（永远为 true，防止 body overflow:hidden 裁剪） */
  columnScroll: boolean;
  showRemoteHint: boolean;
}

const clampRange = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(min, max), Math.max(min, Math.round(value)));

/**
 * 大屏判定：16:9 / 16:10 横屏且宽度 >= 1280，或 4:3 投影（1000~1280 宽）。
 * 平板竖屏、手机与常规桌面窗口不受影响。
 */
export const isLargeScreenResolution = (width: number, height: number): boolean => {
  const aspect = width / Math.max(1, height);
  return (
    (width >= 1280 && aspect >= 1.5) ||
    (width >= 1000 && width < 1280 && aspect >= 1.25 && aspect <= 1.45)
  );
};

/**
 * 统一布局标尺。宽、高、宽高比、分辨率缩放、导航占用全部参与推导。
 * 保留 v2.3.0 的前 5 个参数签名，新增可选 options 供 hook 注入导航占用。
 */
export const getCompactMetrics = (
  deviceType: DeviceType,
  width: number,
  height: number,
  spacing: number,
  isSetTopBox = false,
  options: ViewportOptions = {},
): CompactMetrics => {
  const w = Math.max(320, width || 0);
  const h = Math.max(360, height || 0);
  const aspect = w / h;
  const nativeTV = deviceType === "tv" || isSetTopBox;
  const isLargeScreen = isLargeScreenResolution(w, h);
  const isTVLike = nativeTV || isLargeScreen;

  const chromeWidth = options.chromeWidth ?? (nativeTV ? 0 : w >= 900 ? NAV_SIDEBAR_WIDTH : 0);
  const chromeHeight =
    options.chromeHeight ?? (nativeTV ? TV_CHROME_HEIGHT : w >= 900 ? NAV_CHROME_HEIGHT : 96);
  const contentWidth = Math.max(320, Math.round(w - spacing * 2 - chromeWidth));
  const contentHeight = Math.max(360, Math.round(h - spacing * 2 - chromeHeight));
  // 760 覆盖 XGA 投影（1024 宽扣除 200px 侧栏后仍有约 792 可用宽度）；
  // 宽高比 < 1.2 的竖屏大屏保持单列，避免把两栏内容压扁
  const isWide = contentWidth >= 760 && contentHeight >= MIN_COLUMN_HEIGHT && aspect >= 1.2;

  // 相对 1080p 的几何缩放（面积开方），720p 收紧、4K 放大
  const resolutionScale = clampRange(Math.sqrt((w * h) / (1920 * 1080)), 0.82, 1.6);
  const heightScale = clampRange(contentHeight / 900, 0.72, 1.25);
  const fontScale =
    (deviceType === "tv" ? 1.22 : deviceType === "desktop" ? 1.06 : deviceType === "tablet" ? 1.02 : 1) *
    (isLargeScreen ? clampRange(resolutionScale, 0.9, 1.35) : 1);
  const spaceScale =
    (deviceType === "tv" ? 1.12 : deviceType === "desktop" ? 0.96 : deviceType === "tablet" ? 0.92 : 0.86) *
    (isLargeScreen ? clampRange(resolutionScale, 0.85, 1.3) : 1) *
    heightScale;

  const leftRatio = isTVLike ? (aspect > 1.9 ? 0.38 : 0.4) : deviceType === "desktop" ? 0.38 : 0.4;
  const leftWidth = isWide
    ? clamp(contentWidth * leftRatio, 260, Math.max(260, contentWidth - 260))
    : contentWidth;

  const gap = clamp(10 * spaceScale, 6, 18);
  const gapSm = clamp(6 * spaceScale, 4, 12);
  const coverRatio = isWide ? 0.52 : 0.62;
  const coverMax = isTVLike
    ? clamp(300 * clampRange(resolutionScale, 0.85, 1.35), 220, 440)
    : 236;
  const coverSize = clamp(
    Math.min(leftWidth * coverRatio, contentHeight * 0.34),
    120,
    coverMax,
  );
  const minTouchTarget = isTVLike ? 60 : deviceType === "tablet" ? 48 : 44;
  const keyHeight = Math.min(
    Math.max(
      clamp((isTVLike ? 46 : 38) * spaceScale, 32, isTVLike ? 64 : 52),
      // 大屏按键至少达到 10-foot 最小可聚焦区域，不再被 heightScale 压到 32px
      Math.min(Math.round(minTouchTarget * 0.72), Math.floor(contentHeight / 12)),
    ),
    Math.max(32, Math.floor(contentHeight / 9)),
  );

  return {
    deviceType,
    isWide,
    isTVLike,
    isLargeScreen,
    width: w,
    height: h,
    contentWidth,
    contentHeight,
    resolutionScale,
    leftRatio,
    leftWidth,
    gap,
    gapSm,
    radius: clamp(16 * spaceScale, 12, 24),
    radiusSm: clamp(10 * spaceScale, 8, 16),
    headerHeight: clamp(40 * spaceScale, 34, 60),
    pageTitle: clamp(20 * fontScale, isTVLike ? 24 : 18, isTVLike ? 36 : 26),
    sectionTitle: clamp(15 * fontScale, isTVLike ? 17 : 13, isTVLike ? 24 : 19),
    body: clamp(12 * fontScale, isTVLike ? 14 : 11, isTVLike ? 20 : 15),
    caption: clamp(10 * fontScale, isTVLike ? 12 : 9, isTVLike ? 17 : 13),
    cardPadding: clamp(16 * spaceScale, 12, 24),
    coverSize,
    playButton: clamp(54 * spaceScale, 46, isTVLike ? 80 : 64),
    roundControl: clamp(40 * spaceScale, 34, isTVLike ? 60 : 48),
    keyHeight,
    columns: clamp(Math.round(contentWidth / (isTVLike ? 420 : 320)), 1, 4),
    minTouchTarget,
    focusBorderWidth: isTVLike ? 3 : 2,
    columnScroll: true,
    showRemoteHint: isTVLike,
  };
};

/** 键盘功能行权重：ABC / 删除 / 清空 / 搜索 */
export const KEYBOARD_ACTION_WEIGHTS = [1.5, 1.5, 1.5, 2] as const;

/**
 * 按面板实际可用宽度分配功能键宽度，总宽恒等于 available - gap * 3，
 * 不再使用 Math.max(48/64) 硬下限（旧实现在窄面板 + nowrap 下会裁掉按钮）。
 */
export const getKeyboardActionWidths = (available: number, gap: number): number[] => {
  const usable = Math.max(0, available - gap * (KEYBOARD_ACTION_WEIGHTS.length - 1));
  const totalWeight = KEYBOARD_ACTION_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  const unit = usable / totalWeight;
  return KEYBOARD_ACTION_WEIGHTS.map((weight) => Math.max(0, Math.floor(unit * weight)));
};

/** 左栏内容高度估算（用于验证：超出可用高度时必须依赖 columnScroll 兜底） */
export const estimateLeftColumnHeight = (m: CompactMetrics): number =>
  Math.round(
    m.headerHeight +
      m.coverSize +
      m.keyHeight * 4 +
      m.playButton +
      m.roundControl +
      m.cardPadding * 2 +
      m.gap * 8,
  );
