import { Platform, Dimensions } from "react-native";
import type { DeviceType } from "@/hooks/useResponsiveLayout";

/**
 * 设备形态：在原有 deviceType（mobile/tablet/desktop/tv）之上做更细的区分，
 * 用于适配三折屏 / 二折屏 / 单屏手机 / 平板 / 电视 / 机顶盒 / 桌面。
 */
export type DeviceForm =
  | "phone"
  | "foldable"
  | "triFold"
  | "tablet"
  | "tv"
  | "setTopBox"
  | "desktop";

/** 折叠状态，尺寸变化时由 useResponsiveLayout 实时重算 */
export type FoldState = "single" | "folded" | "unfolded" | "fullyUnfolded";

type HarmonyPlatform = "native" | "android-compat" | null;

const FORM_LABELS: Record<DeviceForm, string> = {
  phone: "单屏手机",
  foldable: "二折叠屏手机",
  triFold: "三折叠屏手机",
  tablet: "平板",
  tv: "电视",
  setTopBox: "机顶盒 / 电视盒子",
  desktop: "桌面电脑",
};

export const DeviceUtils = {
  /**
   * 检测当前设备类型（保持原有 4 类，既有调用方零改动）
   */
  getDeviceType(): DeviceType {
    // 真实电视设备优先（遥控器 10 英尺交互）
    if ((Platform as any)?.isTV) return "tv";

    const { width } = Dimensions.get("window");

    // Web 容器即桌面端（Windows / Ubuntu / macOS，Electron + react-native-web）
    if ((Platform as any)?.OS === "web") {
      return width >= 768 ? "desktop" : "mobile";
    }

    if (width >= 1200) return "desktop";
    if (width >= 768) return "tablet";
    return "mobile";
  },

  /** --------------------------------------------------------------
   *  鸿蒙识别
   *  - native: 鸿蒙 NEXT / OpenHarmony 原生应用（react-native-harmony 上报 harmony/ohos）
   *  - android-compat: HarmonyOS 4 及更早版本，兼容 Android APK
   * --------------------------------------------------------------- */
  getHarmonyPlatform(): HarmonyPlatform {
    const os = String((Platform as any)?.OS ?? "").toLowerCase();
    const constants: any = (Platform as any)?.constants ?? {};
    const brand = String(
      constants.Brand ?? constants.brand ?? constants.Manufacturer ?? constants.manufacturer ?? "",
    ).toUpperCase();
    const model = String(constants.Model ?? constants.model ?? constants.Device ?? "");
    const buildInfo = String(
      constants.Build?.DISPLAY ?? constants.Build?.MODEL ?? constants.display ?? "",
    ).toUpperCase();

    if (os === "harmony" || os === "ohos" || os === "openharmony") return "native";

    if (os === "android") {
      const huawei = brand.includes("HUAWEI") || brand.includes("HONOR") || /MATE|POCKET|FOLD/i.test(model);
      if (buildInfo.includes("HARMONY") || (huawei && buildInfo.includes("HARMONYOS"))) {
        return "android-compat";
      }
      // 华为 / 荣耀 Android 兼容层可直接安装 APK，更新链路与普通 Android 一致
      if (huawei) return "android-compat";
    }
    return null;
  },

  isHarmonyOS(): boolean {
    return this.getHarmonyPlatform() !== null;
  },

  /** 鸿蒙 NEXT：不能安装 APK，只能走 Web 包 / 浏览器下载 */
  isHarmonyOSNext(): boolean {
    return this.getHarmonyPlatform() === "native";
  },

  /** HarmonyOS 4.x：可安装 Android APK */
  isHarmonyOSAndroid(): boolean {
    return this.getHarmonyPlatform() === "android-compat";
  },

  /** 折叠屏硬件型号提示（华为 Mate X / Pocket、荣耀 Magic V、三星 Z Fold 等） */
  isFoldableHardware(): boolean {
    const constants: any = (Platform as any)?.constants ?? {};
    const model = String(
      constants.Model ?? constants.model ?? constants.Device ?? constants.Product ?? "",
    ).toUpperCase();
    return /MATE\s*X|POCKET|MAGIC\s*V|FOLD|FLIP|GALAXY\s*Z|FOLDABLE/.test(model);
  },

  /**
   * 细粒度设备形态识别。
   * 折叠 / 展开会触发窗口尺寸变化，hook 每次渲染重新调用本方法即可实时响应。
   */
  getDeviceForm(width?: number, height?: number): DeviceForm {
    const window = Dimensions.get("window");
    const w = width ?? window.width;
    const h = height ?? window.height;
    const os = String((Platform as any)?.OS ?? "").toLowerCase();

    if ((Platform as any)?.isTV) {
      const screenWidth = Dimensions.get("screen")?.width || w;
      // 小尺寸 4K 以下且遥控器交互的盒子，按机顶盒密度布局
      return screenWidth <= 1280 ? "setTopBox" : "tv";
    }

    if (os === "web") return w >= 768 ? "desktop" : "phone";

    const foldableHint = this.isFoldableHardware();
    if (w >= 1200) return foldableHint && h >= w * 0.75 ? "triFold" : "desktop";
    if (w >= 840) return foldableHint && h >= w * 0.9 ? "triFold" : "tablet";
    if (w >= 600) return foldableHint ? "foldable" : "tablet";
    // 折叠态下物理宽度与单屏手机一致，但保留 foldable 身份以显示「已折叠」状态
    return foldableHint ? "foldable" : "phone";
  },

  /** 当前折叠状态（用于提供折叠过渡的布局提示） */
  getFoldState(width?: number, height?: number): FoldState {
    const window = Dimensions.get("window");
    const w = width ?? window.width;
    const h = height ?? window.height;
    const form = this.getDeviceForm(w, h);

    if (form === "foldable") return w < 600 ? "folded" : "unfolded";
    if (form === "triFold") {
      if (w < 600) return "folded";
      return w < 900 ? "unfolded" : "fullyUnfolded";
    }
    return "single";
  },

  getFormLabel(form: DeviceForm): string {
    return FORM_LABELS[form] ?? "未知设备";
  },

  isFoldable(): boolean {
    const form = this.getDeviceForm();
    return form === "foldable" || form === "triFold";
  },

  isTriFold(): boolean {
    return this.getDeviceForm() === "triFold";
  },

  isSetTopBox(): boolean {
    return this.getDeviceForm() === "setTopBox";
  },

  /** 检测是否为TV环境 */
  isTV(): boolean {
    return this.getDeviceType() === "tv";
  },

  /** 检测是否为移动设备 */
  isMobile(): boolean {
    return this.getDeviceType() === "mobile";
  },

  /** 检测是否为平板设备 */
  isTablet(): boolean {
    return this.getDeviceType() === "tablet";
  },

  /** 检测是否为桌面设备（Windows / Ubuntu / macOS） */
  isDesktop(): boolean {
    return this.getDeviceType() === "desktop";
  },

  /** 检测是否支持触摸交互 */
  supportsTouchInteraction(): boolean {
    return !this.isTV();
  },

  /** 检测是否支持遥控器交互 */
  supportsRemoteControlInteraction(): boolean {
    return this.isTV();
  },

  /** 获取最小触摸目标尺寸 */
  getMinTouchTargetSize(): number {
    const deviceType = this.getDeviceType();
    switch (deviceType) {
      case "mobile":
        return 44;
      case "tablet":
        return 48;
      case "tv":
        return 60;
      default:
        return 44;
    }
  },

  /** 获取适合的文字大小 */
  getOptimalFontSize(baseSize: number): number {
    const deviceType = this.getDeviceType();
    const scaleFactor: Record<DeviceType, number> = {
      mobile: 1.0,
      tablet: 1.1,
      desktop: 1.15,
      tv: 1.25,
    };
    return Math.round(baseSize * scaleFactor[deviceType]);
  },

  /** 获取适合的间距 */
  getOptimalSpacing(baseSpacing: number): number {
    const deviceType = this.getDeviceType();
    const scaleFactor: Record<DeviceType, number> = {
      mobile: 0.8,
      tablet: 1.0,
      desktop: 1.2,
      tv: 1.5,
    };
    return Math.round(baseSpacing * scaleFactor[deviceType]);
  },

  /** 检测设备是否处于横屏模式 */
  isLandscape(): boolean {
    const { width, height } = Dimensions.get("window");
    return width > height;
  },

  /** 检测设备是否处于竖屏模式 */
  isPortrait(): boolean {
    return !this.isLandscape();
  },

  /** 获取安全的网格列数 */
  getSafeColumnCount(preferredColumns: number): number {
    const { width } = Dimensions.get("window");
    const minCardWidth = this.isMobile() ? 120 : this.isTablet() ? 140 : 160;
    const maxColumns = Math.floor(width / minCardWidth);
    return Math.min(preferredColumns, Math.max(1, maxColumns));
  },

  /** 获取设备特定的动画持续时间 */
  getAnimationDuration(baseDuration: number): number {
    const deviceType = this.getDeviceType();
    const scaleFactor: Record<DeviceType, number> = {
      mobile: 1.0,
      tablet: 1.0,
      desktop: 1.0,
      tv: 1.2,
    };
    return Math.round(baseDuration * scaleFactor[deviceType]);
  },
};
