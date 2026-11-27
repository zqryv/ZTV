/**
 * ZTV 多端紧凑布局标尺（v2.3.0 引入，v2.4.0 大屏适配）。
 *
 * 设计稿「ZTV 多端界面设计预览」：3 界面 × 4 设备（手机 393 / 平板 1024 /
 * 桌面 1440 / 电视 1920），大屏左右分栏、左栏约 38~40%、键盘收进独立面板。
 *
 * v2.4.0 调整：
 * - 纯计算层下沉到 utils/LargeScreen.ts（不依赖 RN，可跑分辨率矩阵校验）；
 * - 尺寸同时受宽、高、宽高比与分辨率缩放约束，并扣除侧栏 / 顶栏占用；
 * - 显式监听 Dimensions change、window resize / orientationchange /
 *   visualViewport，保证投影仪切换分辨率、浏览器缩放、窗口大小变化即时重算。
 *
 * 这是纯展示层工具，不改变任何数据接口与业务逻辑。
 */
import { useEffect, useState } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import {
  getCompactMetrics,
  type CompactMetrics,
  type ViewportOptions,
} from "@/utils/LargeScreen";

export {
  getCompactMetrics,
  isLargeScreenResolution,
  getKeyboardActionWidths,
  estimateLeftColumnHeight,
  LARGE_SCREEN_PROFILES,
} from "@/utils/LargeScreen";
export type { CompactMetrics, ViewportOptions, LargeScreenProfile } from "@/utils/LargeScreen";

/**
 * 三页共用的 Hook：窗口尺寸变化时（折叠 / 旋转 / 投影切分辨率 / 浏览器缩放）
 * 实时重算布局。优先使用显式监听得到的 viewport，避免部分平台
 * useWindowDimensions 未随窗口变化刷新导致布局停留在旧分辨率。
 */
export const useCompactLayout = (): CompactMetrics => {
  const windowDimensions = useWindowDimensions();
  const config = useResponsiveLayout();
  const [viewport, setViewport] = useState(() => {
    try {
      const { width, height } = Dimensions.get("window");
      return { width, height };
    } catch {
      return { width: config.screenWidth, height: config.screenHeight };
    }
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setViewport({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const sync = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    const visualViewport = (window as any).visualViewport;
    visualViewport?.addEventListener?.("resize", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      visualViewport?.removeEventListener?.("resize", sync);
    };
  }, []);

  const width = viewport.width || windowDimensions?.width || config.screenWidth;
  const height = viewport.height || windowDimensions?.height || config.screenHeight;
  const nativeTV = config.deviceType === "tv" || !!config.isSetTopBox;
  const options: ViewportOptions = {
    chromeWidth: nativeTV ? 0 : width >= 900 ? 200 : 0,
    chromeHeight: nativeTV ? 72 : width >= 900 ? 116 : 96,
  };

  return getCompactMetrics(
    config.deviceType,
    width,
    height,
    config.spacing,
    config.isSetTopBox,
    options,
  );
};
