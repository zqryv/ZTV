import { create } from "zustand";
import updateService from "../services/updateService";
import { UpdateTarget } from "../constants/UpdateConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("UpdateStore");

interface UpdateState {
  // 状态
  updateAvailable: boolean;
  currentVersion: string;
  remoteVersion: string;
  downloadUrl: string;
  releasePageUrl: string;
  assetName: string;
  releaseNotes: string;
  target: UpdateTarget;
  inAppInstall: boolean;
  downloading: boolean;
  checking: boolean;
  downloadProgress: number;
  downloadedPath: string | null;
  error: string | null;
  lastCheckTime: number;
  skipVersion: string | null;
  showUpdateModal: boolean;
  isLatestVersion: boolean;

  // 操作
  checkForUpdate: (silent?: boolean) => Promise<void>;
  startDownload: () => Promise<void>;
  installUpdate: () => Promise<void>;
  openReleasePage: () => Promise<void>;
  setShowUpdateModal: (show: boolean) => void;
  skipThisVersion: () => Promise<void>;
  reset: () => void;
}

const STORAGE_KEYS = {
  LAST_CHECK_TIME: "update_last_check_time",
  SKIP_VERSION: "update_skip_version",
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  updateAvailable: false,
  currentVersion: updateService.getCurrentVersion(),
  remoteVersion: "",
  downloadUrl: "",
  releasePageUrl: "",
  assetName: "",
  releaseNotes: "",
  target: "android",
  inAppInstall: false,
  downloading: false,
  checking: false,
  downloadProgress: 0,
  downloadedPath: null,
  error: null,
  lastCheckTime: 0,
  skipVersion: null,
  showUpdateModal: false,
  isLatestVersion: false,

  checkForUpdate: async (silent = false) => {
    if (get().checking) return;
    set({ checking: true, error: null, isLatestVersion: false });

    try {
      const skipVersion = await AsyncStorage.getItem(STORAGE_KEYS.SKIP_VERSION);
      const info = await updateService.checkVersion();
      const updateAvailable = updateService.isUpdateAvailable(info.version);
      const now = Date.now();

      set({
        remoteVersion: info.version,
        downloadUrl: info.downloadUrl,
        releasePageUrl: info.releasePageUrl,
        assetName: info.assetName,
        releaseNotes: info.releaseNotes,
        target: info.target,
        inAppInstall: info.inAppInstall,
        updateAvailable,
        skipVersion,
        lastCheckTime: now,
        isLatestVersion: !updateAvailable,
        showUpdateModal: updateAvailable && info.version !== skipVersion && !silent,
      });

      await AsyncStorage.setItem(STORAGE_KEYS.LAST_CHECK_TIME, now.toString());

      if (!silent && !updateAvailable) {
        Toast.show({
          type: "success",
          text1: "已是最新版本",
          text2: `当前版本 v${info.version} 已是最新版本`,
          visibilityTime: 2500,
        });
      }
      if (!silent && updateAvailable && info.version === skipVersion) {
        Toast.show({
          type: "info",
          text1: "发现新版本",
          text2: `v${info.version} 已跳过，可在更新弹窗中重新选择`,
          visibilityTime: 2500,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "检查更新失败";
      set({
        error: message,
        updateAvailable: false,
        isLatestVersion: false,
      });
      if (!silent) {
        Toast.show({ type: "error", text1: "检查更新失败", text2: message });
      }
    } finally {
      set({ checking: false });
    }
  },

  startDownload: async () => {
    const { downloadUrl, releasePageUrl, inAppInstall, assetName, remoteVersion } = get();

    // 不支持应用内安装的平台（iOS / macOS / Windows / 鸿蒙 NEXT）直接打开浏览器
    if (!inAppInstall) {
      await get().openReleasePage();
      return;
    }

    if (!downloadUrl) {
      set({ error: "下载地址无效，请前往 Release 页面下载" });
      await get().openReleasePage().catch(() => undefined);
      return;
    }

    try {
      set({ downloading: true, downloadProgress: 0, error: null });
      const fileName = assetName || `ZTV-v${remoteVersion}.apk`;
      const path = await updateService.downloadRelease(downloadUrl, fileName, (progress) => {
        set({ downloadProgress: progress });
      });
      set({ downloadedPath: path, downloading: false, downloadProgress: 100 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "下载失败";
      set({ downloading: false, downloadProgress: 0, error: message });
      // 下载失败时给出浏览器兜底入口，避免用户卡死
      if (releasePageUrl) {
        logger.warn(`下载失败，可前往 Release 页面: ${releasePageUrl}`);
      }
    }
  },

  installUpdate: async () => {
    const { downloadedPath, inAppInstall } = get();
    if (!downloadedPath) {
      set({ error: "安装文件不存在" });
      return;
    }
    if (!inAppInstall) {
      await get().openReleasePage();
      return;
    }
    try {
      await updateService.installApk(downloadedPath);
      set({ showUpdateModal: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "安装失败";
      set({ error: `${message}，可前往 Release 页面手动下载` });
      Toast.show({ type: "error", text1: "安装失败", text2: "请允许未知来源安装或使用浏览器下载" });
    }
  },

  openReleasePage: async () => {
    const { releasePageUrl, downloadUrl } = get();
    try {
      await updateService.openReleasePage(releasePageUrl || downloadUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法打开下载页面";
      set({ error: message });
    }
  },

  setShowUpdateModal: (show) => set({ showUpdateModal: show }),

  skipThisVersion: async () => {
    const { remoteVersion } = get();
    if (!remoteVersion) return;
    await AsyncStorage.setItem(STORAGE_KEYS.SKIP_VERSION, remoteVersion);
    set({ skipVersion: remoteVersion, showUpdateModal: false });
  },

  reset: () =>
    set({
      downloading: false,
      checking: false,
      downloadProgress: 0,
      downloadedPath: null,
      error: null,
      showUpdateModal: false,
      isLatestVersion: false,
    }),
}));

export const initUpdateStore = async () => {
  try {
    const lastCheckTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_CHECK_TIME);
    const skipVersion = await AsyncStorage.getItem(STORAGE_KEYS.SKIP_VERSION);
    useUpdateStore.setState({
      lastCheckTime: lastCheckTime ? parseInt(lastCheckTime, 10) : 0,
      skipVersion: skipVersion || null,
    });
  } catch (error) {
    logger.error("初始化更新存储失败:", error);
  }
};
