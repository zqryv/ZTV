import { Dimensions } from "react-native";
import { DeviceUtils } from "../DeviceUtils";

jest.mock("react-native", () => ({
  Dimensions: {
    get: jest.fn(),
  },
  // 原生测试环境：非 TV、非 Web，走宽度判定
  Platform: {
    OS: "ios",
    isTV: false,
  },
}));

const mockedDimensions = Dimensions as jest.Mocked<typeof Dimensions>;

// 构造完整的 ScaledSize，满足 RN 类型定义
const makeSize = (width: number, height: number) => ({
  width,
  height,
  scale: 1,
  fontScale: 1,
});

// 切换 TV 模拟状态（TV 形态由 Platform.isTV 判定，而非宽度）
const setTV = (isTV: boolean) => {
  const RN = require("react-native");
  RN.Platform.isTV = isTV;
};

// 切换平台 OS（web 容器 = 桌面端）
const setOS = (os: string) => {
  const RN = require("react-native");
  RN.Platform.OS = os;
};

// 切换 Platform.constants（鸿蒙 / 折叠屏型号识别）
const setConstants = (constants: any) => {
  const RN = require("react-native");
  RN.Platform.constants = constants;
};

describe("DeviceUtils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setTV(false);
    setOS("ios");
    setConstants(undefined);
  });

  describe("getDeviceType", () => {
    it("应该在宽度 >= 1200 时返回 desktop（桌面/大屏）", () => {
      mockedDimensions.get.mockReturnValue(makeSize(1440, 900));
      expect(DeviceUtils.getDeviceType()).toBe("desktop");
    });

    it("应该在宽度 >= 768 且 < 1200 时返回 tablet", () => {
      mockedDimensions.get.mockReturnValue(makeSize(1024, 768));
      expect(DeviceUtils.getDeviceType()).toBe("tablet");
    });

    it("应该在宽度 >= 768 且 < 1200 时返回 tablet（竖屏平板）", () => {
      mockedDimensions.get.mockReturnValue(makeSize(768, 1024));
      expect(DeviceUtils.getDeviceType()).toBe("tablet");
    });

    it("应该在宽度 < 768 时返回 mobile", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.getDeviceType()).toBe("mobile");
    });

    it("应该在 TV 平台上始终返回 tv（即使宽度不大）", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1280, 720));
      expect(DeviceUtils.getDeviceType()).toBe("tv");
    });

    it("应该在 web 容器（桌面壳）中返回 desktop", () => {
      setOS("web");
      mockedDimensions.get.mockReturnValue(makeSize(1440, 900));
      expect(DeviceUtils.getDeviceType()).toBe("desktop");
    });

    it("应该在 web 容器窄窗口下返回 mobile", () => {
      setOS("web");
      mockedDimensions.get.mockReturnValue(makeSize(600, 800));
      expect(DeviceUtils.getDeviceType()).toBe("mobile");
    });
  });

  describe("isDesktop", () => {
    it("应该在桌面宽度下返回 true", () => {
      mockedDimensions.get.mockReturnValue(makeSize(1440, 900));
      expect(DeviceUtils.isDesktop()).toBe(true);
    });

    it("应该在非桌面宽度下返回 false", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.isDesktop()).toBe(false);
    });
  });

  describe("isTV", () => {
    it("应该在 TV 设备上返回 true", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      expect(DeviceUtils.isTV()).toBe(true);
    });

    it("应该在非 TV 设备上返回 false", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.isTV()).toBe(false);
    });
  });

  describe("isMobile", () => {
    it("应该在移动设备上返回 true", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.isMobile()).toBe(true);
    });

    it("应该在非移动设备上返回 false", () => {
      mockedDimensions.get.mockReturnValue(makeSize(1024, 768));
      expect(DeviceUtils.isMobile()).toBe(false);
    });
  });

  describe("isTablet", () => {
    it("应该在平板设备上返回 true", () => {
      mockedDimensions.get.mockReturnValue(makeSize(768, 1024));
      expect(DeviceUtils.isTablet()).toBe(true);
    });

    it("应该在非平板设备上返回 false", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.isTablet()).toBe(false);
    });
  });

  describe("supportsTouchInteraction", () => {
    it("应该在非 TV 设备上返回 true", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.supportsTouchInteraction()).toBe(true);
    });

    it("应该在 TV 设备上返回 false", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      expect(DeviceUtils.supportsTouchInteraction()).toBe(false);
    });
  });

  describe("supportsRemoteControlInteraction", () => {
    it("应该在 TV 设备上返回 true", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      expect(DeviceUtils.supportsRemoteControlInteraction()).toBe(true);
    });

    it("应该在非 TV 设备上返回 false", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.supportsRemoteControlInteraction()).toBe(false);
    });
  });

  describe("getMinTouchTargetSize", () => {
    it("应该为 mobile 设备返回 44", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.getMinTouchTargetSize()).toBe(44);
    });

    it("应该为 tablet 设备返回 48", () => {
      mockedDimensions.get.mockReturnValue(makeSize(768, 1024));
      expect(DeviceUtils.getMinTouchTargetSize()).toBe(48);
    });

    it("应该为 tv 设备返回 60", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      expect(DeviceUtils.getMinTouchTargetSize()).toBe(60);
    });

    it("应该为 desktop 设备返回 44", () => {
      mockedDimensions.get.mockReturnValue(makeSize(1440, 900));
      expect(DeviceUtils.getMinTouchTargetSize()).toBe(44);
    });
  });

  describe("getOptimalFontSize", () => {
    it("应该为 mobile 设备返回基础大小 * 1.0", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.getOptimalFontSize(16)).toBe(16);
    });

    it("应该为 tablet 设备返回基础大小 * 1.1", () => {
      mockedDimensions.get.mockReturnValue(makeSize(768, 1024));
      expect(DeviceUtils.getOptimalFontSize(16)).toBe(18);
    });

    it("应该为 tv 设备返回基础大小 * 1.25", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      expect(DeviceUtils.getOptimalFontSize(16)).toBe(20);
    });
  });

  describe("getOptimalSpacing", () => {
    it("应该为 mobile 设备返回基础间距 * 0.8", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.getOptimalSpacing(20)).toBe(16);
    });

    it("应该为 tablet 设备返回基础间距 * 1.0", () => {
      mockedDimensions.get.mockReturnValue(makeSize(768, 1024));
      expect(DeviceUtils.getOptimalSpacing(20)).toBe(20);
    });

    it("应该为 tv 设备返回基础间距 * 1.5", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      expect(DeviceUtils.getOptimalSpacing(20)).toBe(30);
    });
  });

  describe("isLandscape", () => {
    it("应该在横屏模式下返回 true", () => {
      mockedDimensions.get.mockReturnValue(makeSize(812, 375));
      expect(DeviceUtils.isLandscape()).toBe(true);
    });

    it("应该在竖屏模式下返回 false", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.isLandscape()).toBe(false);
    });

    it("应该在宽高相等时返回 false", () => {
      mockedDimensions.get.mockReturnValue(makeSize(500, 500));
      expect(DeviceUtils.isLandscape()).toBe(false);
    });
  });

  describe("isPortrait", () => {
    it("应该在竖屏模式下返回 true", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.isPortrait()).toBe(true);
    });

    it("应该在横屏模式下返回 false", () => {
      mockedDimensions.get.mockReturnValue(makeSize(812, 375));
      expect(DeviceUtils.isPortrait()).toBe(false);
    });
  });

  describe("getSafeColumnCount", () => {
    it("应该在 mobile 设备上返回安全列数", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      // minCardWidth = 120, maxColumns = 375 / 120 = 3.125 = 3
      expect(DeviceUtils.getSafeColumnCount(5)).toBe(3);
      expect(DeviceUtils.getSafeColumnCount(2)).toBe(2);
    });

    it("应该在 tablet 设备上返回安全列数", () => {
      mockedDimensions.get.mockReturnValue(makeSize(768, 1024));
      // minCardWidth = 140, maxColumns = 768 / 140 = 5.485 = 5
      expect(DeviceUtils.getSafeColumnCount(6)).toBe(5);
      expect(DeviceUtils.getSafeColumnCount(3)).toBe(3);
    });

    it("应该在 tv / 大屏设备上返回安全列数", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      // minCardWidth = 160, maxColumns = 1920 / 160 = 12
      expect(DeviceUtils.getSafeColumnCount(15)).toBe(12);
      expect(DeviceUtils.getSafeColumnCount(8)).toBe(8);
    });
  });

  describe("getAnimationDuration", () => {
    it("应该为 mobile 设备返回基础持续时间 * 1.0", () => {
      mockedDimensions.get.mockReturnValue(makeSize(375, 812));
      expect(DeviceUtils.getAnimationDuration(300)).toBe(300);
    });

    it("应该为 tablet 设备返回基础持续时间 * 1.0", () => {
      mockedDimensions.get.mockReturnValue(makeSize(768, 1024));
      expect(DeviceUtils.getAnimationDuration(300)).toBe(300);
    });

    it("应该为 tv 设备返回基础持续时间 * 1.2", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      expect(DeviceUtils.getAnimationDuration(300)).toBe(360);
    });
  });

  describe("鸿蒙系统识别", () => {
    it("应该识别鸿蒙 NEXT 原生环境", () => {
      setOS("harmony");
      expect(DeviceUtils.isHarmonyOS()).toBe(true);
      expect(DeviceUtils.isHarmonyOSNext()).toBe(true);
      expect(DeviceUtils.isHarmonyOSAndroid()).toBe(false);
    });

    it("应该识别 HarmonyOS 4.x 的 Android 兼容层", () => {
      setOS("android");
      setConstants({ Brand: "HUAWEI", Model: "Mate 60 Pro", Build: { DISPLAY: "HarmonyOS 4.0.0" } });
      expect(DeviceUtils.isHarmonyOS()).toBe(true);
      expect(DeviceUtils.isHarmonyOSAndroid()).toBe(true);
      expect(DeviceUtils.isHarmonyOSNext()).toBe(false);
    });

    it("非华为设备不应误判为鸿蒙", () => {
      setOS("android");
      setConstants({ Brand: "XIAOMI", Model: "14", Build: { DISPLAY: "Android 14" } });
      expect(DeviceUtils.isHarmonyOS()).toBe(false);
    });
  });

  describe("折叠屏与机顶盒形态", () => {
    it("应该识别二折屏折叠 / 展开状态", () => {
      setOS("android");
      setConstants({ Brand: "HUAWEI", Model: "Mate X5", Build: { DISPLAY: "HarmonyOS 4.0.0" } });
      expect(DeviceUtils.getDeviceForm(420, 900)).toBe("foldable");
      expect(DeviceUtils.getFoldState(420, 900)).toBe("folded");
      expect(DeviceUtils.getDeviceForm(768, 900)).toBe("foldable");
      expect(DeviceUtils.getFoldState(768, 900)).toBe("unfolded");
    });

    it("应该识别三折屏完全展开状态", () => {
      setOS("android");
      setConstants({ Brand: "HUAWEI", Model: "Mate XT", Build: { DISPLAY: "HarmonyOS 4.0.0" } });
      expect(DeviceUtils.getDeviceForm(1032, 1464)).toBe("triFold");
      expect(DeviceUtils.getFoldState(1032, 1464)).toBe("fullyUnfolded");
    });

    it("应该把小屏电视设备识别为机顶盒", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1280, 720));
      expect(DeviceUtils.getDeviceForm()).toBe("setTopBox");
      expect(DeviceUtils.isSetTopBox()).toBe(true);
    });

    it("应该把大屏电视识别为 tv 形态", () => {
      setTV(true);
      mockedDimensions.get.mockReturnValue(makeSize(1920, 1080));
      expect(DeviceUtils.getDeviceForm()).toBe("tv");
      expect(DeviceUtils.isSetTopBox()).toBe(false);
    });
  });
});