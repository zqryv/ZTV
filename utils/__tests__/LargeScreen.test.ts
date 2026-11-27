/**
 * 大屏（电视 / 投影仪 / 4K）分辨率适配单元测试。
 * 只依赖 utils/LargeScreen.ts 的纯函数，不渲染组件、不依赖原生模块。
 */
import {
  LARGE_SCREEN_PROFILES,
  getCompactMetrics,
  isLargeScreenResolution,
  getKeyboardActionWidths,
  estimateLeftColumnHeight,
  MIN_COLUMN_HEIGHT,
} from "../LargeScreen";

const WEB = { chromeWidth: 200, chromeHeight: 116 };
const webMetrics = (width: number, height: number) =>
  getCompactMetrics("desktop", width, height, 16, false, WEB);

describe("大屏分辨率识别", () => {
  it("覆盖 8 种常见电视 / 投影 / 4K 分辨率", () => {
    expect(LARGE_SCREEN_PROFILES).toHaveLength(8);
    LARGE_SCREEN_PROFILES.forEach(({ width, height }) => {
      expect(isLargeScreenResolution(width, height)).toBe(true);
    });
  });

  it("手机与竖屏平板不误判为大屏", () => {
    expect(isLargeScreenResolution(393, 852)).toBe(false);
    expect(isLargeScreenResolution(810, 1080)).toBe(false);
    expect(isLargeScreenResolution(1080, 1920)).toBe(false);
  });
});

describe("分辨率矩阵下的布局不变量", () => {
  const tvMetrics = (width: number, height: number) =>
    getCompactMetrics("tv", width, height, 20, true, { chromeWidth: 0, chromeHeight: 72 });

  it.each(LARGE_SCREEN_PROFILES)("$label $width x $height 不溢出且点击区满足 10-foot", ({ width, height }) => {
    for (const m of [webMetrics(width, height), tvMetrics(width, height)]) {
      expect(m.contentWidth).toBeGreaterThanOrEqual(320);
      expect(m.contentHeight).toBeGreaterThanOrEqual(360);
      expect(m.isTVLike).toBe(true);
      expect(m.columnScroll).toBe(true);
      expect(m.minTouchTarget).toBeGreaterThanOrEqual(60);
      expect(m.coverSize).toBeLessThanOrEqual(m.contentHeight * 0.4 + 1);
      expect(m.keyHeight * 4 + m.gap * 3).toBeLessThanOrEqual(m.contentHeight * 0.6 + 1);
      if (m.isWide) {
        expect(m.leftWidth + m.gap * 1.5 + 260).toBeLessThanOrEqual(m.contentWidth + 1);
      }
      expect(estimateLeftColumnHeight(m)).toBeGreaterThan(0);
    }
  });

  it("键盘字母行与功能行在任意面板宽度下都不溢出", () => {
    for (const width of [190, 240, 317, 419, 675, 1443]) {
      for (const gap of [4, 6, 9, 12]) {
        const actions = getKeyboardActionWidths(width, gap);
        const total = actions.reduce((sum, value) => sum + value, 0) + gap * 3;
        expect(total).toBeLessThanOrEqual(width);
        expect(actions).toHaveLength(4);
        expect(actions.every((value) => value >= 0)).toBe(true);
      }
    }
  });
});

describe("分辨率变化与降级", () => {
  it("720p → 1080p → 4K 会重算栏宽、键高与字号", () => {
    const m720 = webMetrics(1280, 720);
    const m1080 = webMetrics(1920, 1080);
    const m4k = webMetrics(3840, 2160);
    expect(m720.leftWidth).toBeLessThan(m1080.leftWidth);
    expect(m1080.leftWidth).toBeLessThan(m4k.leftWidth);
    expect(m4k.body).toBeGreaterThanOrEqual(m1080.body);
    expect(m720.keyHeight).toBeLessThanOrEqual(m1080.keyHeight);
    expect(m720.body).toBeGreaterThanOrEqual(14);
  });

  it("可用高度不足时降级为单列", () => {
    const low = webMetrics(1280, 600);
    expect(low.contentHeight).toBeLessThan(MIN_COLUMN_HEIGHT);
    expect(low.isWide).toBe(false);
  });

  it("竖屏大屏保持单列", () => {
    expect(webMetrics(1080, 1920).isWide).toBe(false);
  });

  it("Web 大屏也拿到 TV 形态标尺与遥控器提示", () => {
    const m = webMetrics(1920, 1080);
    expect(m.deviceType).toBe("desktop");
    expect(m.isLargeScreen).toBe(true);
    expect(m.isTVLike).toBe(true);
    expect(m.showRemoteHint).toBe(true);
  });
});
