/**
 * 跨平台的 TV 遥控器事件 Hook 安全封装（v2.4.0 大屏适配）。
 *
 * - 原生 TV：react-native-tvos 的 useTVEventHandler；
 * - Web / 投影仪浏览器：该导出不存在，旧实现退化为 no-op，遥控器 / 键盘
 *   完全失效。这里补一个「模块内单例」键盘桥接：方向键做几何焦点导航，
 *   Enter/Space 触发当前焦点控件，Escape/Backspace 广播 back，
 *   媒体键广播 playPause / left / right。
 *
 * 方向键与 OK 键不再广播业务事件，避免与原生 TV 焦点引擎 / 浏览器 click
 * 双重消费（旧版 music / radio 的全局 handler 会与 onPress 叠加，导致
 * 「按钮无法选中或操作」）。方向键与上下移动交由焦点系统统一处理。
 */
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as ReactNative from "react-native";

type TVEventHandler = (event: any) => void;

const nativeHook = (ReactNative as any).useTVEventHandler as
  | ((handler: TVEventHandler) => void)
  | undefined;

const resolvedHook: (handler: TVEventHandler) => void =
  typeof nativeHook === "function" ? nativeHook : (_handler: TVEventHandler) => {};

const webHandlers = new Set<TVEventHandler>();
let webBridgeAttached = false;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[role="button"]',
  '[role="link"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const isTypingTarget = (el: HTMLElement | null): boolean => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
};

/** 按屏幕几何位置选择同方向最近的控件，贴近电视遥控器的 D-pad 行为 */
const moveDomFocus = (key: string): void => {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute("aria-hidden") !== "true",
  );
  if (nodes.length === 0) return;
  const current = document.activeElement as HTMLElement | null;
  const currentIndex = current ? nodes.indexOf(current) : -1;
  if (currentIndex < 0 || !current) {
    nodes[0].focus();
    return;
  }

  const from = current.getBoundingClientRect();
  const candidates = nodes
    .filter((node) => node !== current)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - (from.left + from.width / 2);
      const dy = rect.top + rect.height / 2 - (from.top + from.height / 2);
      let primary = 0;
      let secondary = 0;
      let valid = false;
      if (key === "ArrowRight") {
        primary = dx;
        secondary = Math.abs(dy);
        valid = dx > 4;
      } else if (key === "ArrowLeft") {
        primary = -dx;
        secondary = Math.abs(dy);
        valid = -dx > 4;
      } else if (key === "ArrowDown") {
        primary = dy;
        secondary = Math.abs(dx);
        valid = dy > 4;
      } else {
        primary = -dy;
        secondary = Math.abs(dx);
        valid = -dy > 4;
      }
      return { node, score: primary + secondary * 2, valid };
    })
    .filter((candidate) => candidate.valid)
    .sort((a, b) => a.score - b.score);

  if (candidates.length > 0) {
    candidates[0].node.focus();
    return;
  }
  // 边界循环，保证焦点永远不会「卡死」在某个区域
  const step = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;
  nodes[(currentIndex + step + nodes.length) % nodes.length].focus();
};

const attachWebBridge = (): void => {
  if (webBridgeAttached || typeof window === "undefined" || typeof document === "undefined") return;
  webBridgeAttached = true;

  const broadcast = (eventType: string) => {
    webHandlers.forEach((handler) => {
      try {
        handler({ eventType, eventKeyAction: undefined });
      } catch {
        // 单个页面的事件处理异常不应阻断其它页面
      }
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const typing = isTypingTarget(target);
    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        if (typing) return;
        event.preventDefault();
        moveDomFocus(event.key);
        return;
      case "Enter":
      case " ": {
        if (typing) return;
        const active = document.activeElement as HTMLElement | null;
        if (!active) return;
        const tag = active.tagName;
        // 原生 button / a / input 由浏览器处理，避免重复触发
        if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
        event.preventDefault();
        (active as any).click?.();
        return;
      }
      case "Escape":
      case "Backspace":
        if (typing) return;
        event.preventDefault();
        broadcast("back");
        return;
      case "MediaPlayPause":
        broadcast("playPause");
        return;
      case "MediaTrackPrevious":
        broadcast("left");
        return;
      case "MediaTrackNext":
        broadcast("right");
        return;
      default:
        return;
    }
  };

  window.addEventListener("keydown", onKeyDown);
};

export const useSafeTVEventHandler = (handler: TVEventHandler): void => {
  const ref = useRef(handler);
  ref.current = handler;
  resolvedHook((event: any) => ref.current(event));

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const wrapped: TVEventHandler = (event) => ref.current(event);
    webHandlers.add(wrapped);
    attachWebBridge();
    return () => {
      webHandlers.delete(wrapped);
    };
  }, []);
};
