/**
 * v2.4.0：字号统一由 utils/LargeScreen.ts 的标尺管理，这里固定返回 1。
 *
 * 旧实现按「屏宽除以 1000」缩放，会让 constants/TextStyles.ts 的
 * lineHeight 在 1920 电视上放大到 46、3840 电视上放大到 92，而页面的
 * fontSize 又被 DesignTokens 的标尺覆盖，形成「字号 15 / 行高 92」的错配，
 * 这是原生 TV 上「界面被放大、内容显示不完整」的直接原因。
 * 保留 Hook 与返回值签名，既有调用方零改动。
 */
export function useScale(): number {
  return 1;
}
