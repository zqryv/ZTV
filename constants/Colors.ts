/**
 * 全端统一设计令牌
 * 覆盖 手机 / 平板 / 桌面(Windows·Ubuntu·macOS) / 电视(Apple TV·Android TV)
 *
 * 保留原有 legacy 键（light / dark 基础字段）以确保所有既有引用零改动，
 * 在其上补充语义化的表面色、文字层级与品牌色，供新界面统一取用。
 */

// 品牌主色：由旧绿 #00bb5e 升级为更精致的青绿
const brandAccent = "#00E6A8";
const brandAccentDeep = "#04201A";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: "#0a7ea4",
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: "#0a7ea4",
    link: "#0a7ea4",
    border: "#E5E5E5",
  },
  dark: {
    text: "#ECEDEE",
    // 页面底色统一为设计稿的沉浸深色（ThemedView 全局生效）
    background: "#0B0E13",
    tint: "#aaa",
    icon: "#8793A5",
    tabIconDefault: "#8793A5",
    tabIconSelected: brandAccent,
    link: brandAccent,
    border: "#262F3B",
    // legacy 主色键：保持引用兼容，值升级为新设计系统主色
    primary: brandAccent,
  },
  /**
   * 设计系统语义令牌（跨端一致）
   */
  brand: {
    accent: brandAccent,        // 主强调色 / 选中态
    accentMuted: "#00B884",     // 次级强调 / 悬停
    onAccent: brandAccentDeep,  // 强调色之上的深色文字/图标
    live: "#FF3B47",            // 直播中标识
    rating: "#FFC53D",          // 评分
  },
  surface: {
    base: "#0B0E13",       // 页面底色（沉浸背景）
    raised: "#151B24",     // 卡片 / 面板
    overlay: "#1A212B",    // 悬浮层 / 输入框
    border: "#262F3B",     // 描边
    divider: "#202732",    // 分隔线
    scrim: "rgba(0,0,0,0.55)", // 视频/直播遮罩
  },
  text: {
    primary: "#FFFFFF",
    secondary: "#B9C4D2",
    tertiary: "#8793A5",
    disabled: "#5E6A7E",
  },
};
