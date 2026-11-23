/**
 * 跨平台的 TV 遥控器事件 Hook 安全封装。
 *
 * react-native-tvos 提供 useTVEventHandler，而 react-native-web（Windows / Ubuntu
 * 桌面容器）没有该导出。直接用命名导入在 Web 端可能得到 undefined，调用即崩溃。
 * 这里在模块加载时探测一次：存在则使用真实 Hook，不存在则退化为 no-op，
 * 保证「一个 Hook 调用点」始终成立（不违反 Hooks 规则），且各端行为稳定。
 */
import * as ReactNative from "react-native";

type TVEventHandler = (event: any) => void;

const nativeHook = (ReactNative as any).useTVEventHandler as
  | ((handler: TVEventHandler) => void)
  | undefined;

const resolvedHook: (handler: TVEventHandler) => void =
  typeof nativeHook === "function" ? nativeHook : (_handler: TVEventHandler) => {};

export const useSafeTVEventHandler = (handler: TVEventHandler): void => {
  resolvedHook(handler);
};
