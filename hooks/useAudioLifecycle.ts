/**
 * 应用级音频生命周期。
 *
 * 由根布局挂载一次，负责两类「退出」场景：
 * - AppState 进入后台 / 失活（按 Home、切换应用、锁屏、电视退出到桌面）：立即停止并释放；
 * - Android / TV 硬件返回键：不拦截导航（返回 false），但同步停止播放。
 *
 * 页面内部的「离开页面」由各音频页的 useFocusEffect 负责；两者叠加后，
 * 无论从哪个路径退出都不会留下后台声音，无需系统强制终止程序。
 */
import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import { audioPlayer } from "@/services/audioPlayer";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("AudioLifecycle");

export function useAudioLifecycle(): void {
  useEffect(() => {
    audioPlayer.attachAppStateLifecycle();

    let backSubscription: { remove: () => void } | null = null;
    if (Platform.OS !== "web") {
      backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
        void audioPlayer.stop();
        // 返回 false：交给 expo-router 处理返回/退出，只负责停止声音
        return false;
      });
    }

    return () => {
      backSubscription?.remove();
      audioPlayer.detachAppStateLifecycle();
    };
  }, []);

  // 兜底：Web 端切换标签页 / 最小化窗口时同样停止
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const doc = (globalThis as any).document as
      | { hidden?: boolean; addEventListener?: Function; removeEventListener?: Function }
      | undefined;
    if (!doc?.addEventListener) return;
    const onVisibility = () => {
      if (doc.hidden) {
        logger.info("Page hidden, stopping audio");
        void audioPlayer.stop();
      }
    };
    doc.addEventListener("visibilitychange", onVisibility);
    return () => doc.removeEventListener?.("visibilitychange", onVisibility);
  }, []);
}
