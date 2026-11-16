import { create } from "zustand";
import { LiveSourcesManager, SettingsManager } from "@/services/storage";
import {
  LiveSourcesConfig,
  LiveSourceSlot,
  M3uSource,
  getBoundSource,
} from "@/constants/LiveSources";
import { api, ServerConfig } from "@/services/api";
import { storageConfig } from "@/services/storageConfig";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Logger from "@/utils/Logger";

const logger = Logger.withTag('SettingsStore');

// 模块级引用：当前正在进行的 fetchServerConfig Promise。
// 供 authStore.checkLoginStatus 直接 await，避免用固定超时轮询导致冷启动误判。
let serverConfigPromise: Promise<void> | null = null;

/**
 * 获取当前正在进行的 fetchServerConfig Promise（若没有则返回 null）。
 * 调用方可 await 它以确保 serverConfig 已就绪，而不是用固定超时轮询。
 */
export function getServerConfigPromise(): Promise<void> | null {
  return serverConfigPromise;
}

interface SettingsState {
  apiBaseUrl: string;
  m3uUrl: string;
  remoteInputEnabled: boolean;
  videoSource: {
    enabledAll: boolean;
    sources: {
      [key: string]: boolean;
    };
  };
  isModalVisible: boolean;
  serverConfig: ServerConfig | null;
  isLoadingServerConfig: boolean;
  // 多直播源
  liveSources: M3uSource[];
  liveBindings: Record<LiveSourceSlot, string | null>;
  loadLiveSources: () => Promise<LiveSourcesConfig>;
  addLiveSource: (name: string, url: string) => Promise<LiveSourcesConfig>;
  updateLiveSource: (id: string, patch: Partial<Pick<M3uSource, "name" | "url">>) => Promise<LiveSourcesConfig>;
  removeLiveSource: (id: string) => Promise<LiveSourcesConfig>;
  bindLiveSource: (slot: LiveSourceSlot, sourceId: string | null) => Promise<LiveSourcesConfig>;
  getSourceForSlot: (slot: LiveSourceSlot) => M3uSource | null;
  loadSettings: () => Promise<void>;
  fetchServerConfig: () => Promise<void>;
  setApiBaseUrl: (url: string) => void;
  setM3uUrl: (url: string) => void;
  setRemoteInputEnabled: (enabled: boolean) => void;
  saveSettings: () => Promise<void>;
  setVideoSource: (config: { enabledAll: boolean; sources: { [key: string]: boolean } }) => void;
  showModal: () => void;
  hideModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiBaseUrl: "",
  m3uUrl: "",
  remoteInputEnabled: false,
  isModalVisible: false,
  serverConfig: null,
  isLoadingServerConfig: false,
  liveSources: [],
  liveBindings: { tv: null, mtv: null },
  videoSource: {
    enabledAll: true,
    sources: {},
  },

  loadLiveSources: async () => {
    const config = await LiveSourcesManager.get();
    set({ liveSources: config.sources, liveBindings: config.bindings });
    return config;
  },
  addLiveSource: async (name, url) => {
    const config = await LiveSourcesManager.add(name, url);
    set({ liveSources: config.sources, liveBindings: config.bindings });
    return config;
  },
  updateLiveSource: async (id, patch) => {
    const config = await LiveSourcesManager.update(id, patch);
    set({ liveSources: config.sources, liveBindings: config.bindings });
    return config;
  },
  removeLiveSource: async (id) => {
    const config = await LiveSourcesManager.remove(id);
    set({ liveSources: config.sources, liveBindings: config.bindings });
    return config;
  },
  bindLiveSource: async (slot, sourceId) => {
    const config = await LiveSourcesManager.bind(slot, sourceId);
    set({ liveSources: config.sources, liveBindings: config.bindings });
    return config;
  },
  getSourceForSlot: (slot) => {
    const { liveSources, liveBindings } = get();
    return getBoundSource(
      { version: 1, sources: liveSources, bindings: liveBindings },
      slot
    );
  },

  loadSettings: async () => {
    const settings = await SettingsManager.get();
    // 加载多直播源（内部会自动完成旧 m3uUrl 迁移）
    await get().loadLiveSources();
    set({
      apiBaseUrl: settings.apiBaseUrl,
      m3uUrl: settings.m3uUrl,
      remoteInputEnabled: settings.remoteInputEnabled || false,
      videoSource: settings.videoSource || {
        enabledAll: true,
        sources: {},
      },
    });
    if (settings.apiBaseUrl) {
      api.setBaseUrl(settings.apiBaseUrl);
      await get().fetchServerConfig();
    }
  },
  fetchServerConfig: () => {
    const p = (async () => {
      set({ isLoadingServerConfig: true });
      try {
        const config = await api.getServerConfig();
        if (config) {
          storageConfig.setStorageType(config.StorageType);
          set({ serverConfig: config });
        }
      } catch (error) {
        set({ serverConfig: null });
        logger.error("Failed to fetch server config:", error);
      } finally {
        set({ isLoadingServerConfig: false });
      }
    })();
    serverConfigPromise = p;
    return p;
  },
  setApiBaseUrl: (url) => set({ apiBaseUrl: url }),
  setM3uUrl: (url) => set({ m3uUrl: url }),
  setRemoteInputEnabled: (enabled) => set({ remoteInputEnabled: enabled }),
  setVideoSource: (config) => set({ videoSource: config }),
  saveSettings: async () => {
    const { apiBaseUrl, m3uUrl, remoteInputEnabled, videoSource } = get();
    const currentSettings = await SettingsManager.get()
    const currentApiBaseUrl = currentSettings.apiBaseUrl;
    let processedApiBaseUrl = apiBaseUrl.trim();
    if (processedApiBaseUrl.endsWith("/")) {
      processedApiBaseUrl = processedApiBaseUrl.slice(0, -1);
    }

    if (!/^https?:\/\//i.test(processedApiBaseUrl)) {
      const hostPart = processedApiBaseUrl.split("/")[0];
      // Simple check for IP address format.
      const isIpAddress = /^((\d{1,3}\.){3}\d{1,3})(:\d+)?$/.test(hostPart);
      // Check if the domain includes a port.
      const hasPort = /:\d+/.test(hostPart);

      if (isIpAddress || hasPort) {
        processedApiBaseUrl = "http://" + processedApiBaseUrl;
      } else {
        processedApiBaseUrl = "https://" + processedApiBaseUrl;
      }
    }

    await SettingsManager.save({
      apiBaseUrl: processedApiBaseUrl,
      m3uUrl,
      remoteInputEnabled,
      videoSource,
    });
    if ( currentApiBaseUrl !== processedApiBaseUrl) {
      await AsyncStorage.setItem('authCookies', '');
    }
    api.setBaseUrl(processedApiBaseUrl);
    // Also update the URL in the state so the input field shows the processed URL
    set({ isModalVisible: false, apiBaseUrl: processedApiBaseUrl });
    await get().fetchServerConfig();
  },
  showModal: () => set({ isModalVisible: true }),
  hideModal: () => set({ isModalVisible: false }),
}));
