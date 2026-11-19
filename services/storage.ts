import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, PlayRecord as ApiPlayRecord, Favorite as ApiFavorite } from "./api";
import { storageConfig } from "./storageConfig";
import Logger from '@/utils/Logger';
import {
  DEFAULT_LIVE_SOURCES,
  LiveSourcesConfig,
  M3uSource,
  createSourceId,
  normalizeLiveSourcesConfig,
} from "@/constants/LiveSources";

const logger = Logger.withTag('Storage');

// --- Storage Keys ---
const STORAGE_KEYS = {
  SETTINGS: "mytv_settings",
  PLAYER_SETTINGS: "mytv_player_settings",
  FAVORITES: "mytv_favorites",
  PLAY_RECORDS: "mytv_play_records",
  SEARCH_HISTORY: "mytv_search_history",
  LOGIN_CREDENTIALS: "mytv_login_credentials",
  LIVE_SOURCES: "mytv_live_sources",
} as const;

// --- Type Definitions (aligned with api.ts) ---
// Re-exporting for consistency, though they are now primarily API types
export type PlayRecord = ApiPlayRecord & {
  introEndTime?: number;
  outroStartTime?: number;
};
export type Favorite = ApiFavorite;

export interface PlayerSettings {
  introEndTime?: number;
  outroStartTime?: number;
  playbackRate?: number;
}

export interface AppSettings {
  apiBaseUrl: string;
  remoteInputEnabled: boolean;
  videoSource: {
    enabledAll: boolean;
    sources: {
      [key: string]: boolean;
    };
  };
  m3uUrl: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

// --- Helper ---
const generateKey = (source: string, id: string) => `${source}+${id}`;

// --- PlayerSettingsManager (Uses AsyncStorage) ---
export class PlayerSettingsManager {
  static async getAll(): Promise<Record<string, PlayerSettings>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYER_SETTINGS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      logger.info("Failed to get all player settings:", error);
      return {};
    }
  }

  static async get(source: string, id: string): Promise<PlayerSettings | null> {
    const perfStart = performance.now();
    logger.info(`[PERF] PlayerSettingsManager.get START - source: ${source}, id: ${id}`);
    
    const allSettings = await this.getAll();
    const result = allSettings[generateKey(source, id)] || null;
    
    const perfEnd = performance.now();
    logger.info(`[PERF] PlayerSettingsManager.get END - took ${(perfEnd - perfStart).toFixed(2)}ms, found: ${!!result}`);
    
    return result;
  }

  static async save(source: string, id: string, settings: PlayerSettings): Promise<void> {
    const allSettings = await this.getAll();
    const key = generateKey(source, id);
    // Only save if there are actual values to save
    if (settings.introEndTime !== undefined || settings.outroStartTime !== undefined || settings.playbackRate !== undefined) {
      allSettings[key] = { ...allSettings[key], ...settings };
    } else {
      // If all are undefined, remove the key
      delete allSettings[key];
    }
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYER_SETTINGS, JSON.stringify(allSettings));
  }

  static async remove(source: string, id: string): Promise<void> {
    const allSettings = await this.getAll();
    delete allSettings[generateKey(source, id)];
    await AsyncStorage.setItem(STORAGE_KEYS.PLAYER_SETTINGS, JSON.stringify(allSettings));
  }

  static async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.PLAYER_SETTINGS);
  }
}

// --- FavoriteManager (Dynamic: API or LocalStorage) ---
export class FavoriteManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  static async getAll(): Promise<Record<string, Favorite>> {
    if (this.getStorageType() === "localstorage") {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
        return data ? JSON.parse(data) : {};
      } catch (error) {
        logger.info("Failed to get all local favorites:", error);
        return {};
      }
    }
    return (await api.getFavorites()) as Record<string, Favorite>;
  }

  static async save(source: string, id: string, item: Favorite): Promise<void> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      const allFavorites = await this.getAll();
      allFavorites[key] = { ...item, save_time: Date.now() };
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(allFavorites));
      return;
    }
    await api.addFavorite(key, item);
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      const allFavorites = await this.getAll();
      delete allFavorites[key];
      await AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(allFavorites));
      return;
    }
    await api.deleteFavorite(key);
  }

  static async isFavorited(source: string, id: string): Promise<boolean> {
    const key = generateKey(source, id);
    if (this.getStorageType() === "localstorage") {
      const allFavorites = await this.getAll();
      return !!allFavorites[key];
    }
    const favorite = await api.getFavorites(key);
    return favorite !== null;
  }

  static async toggle(source: string, id: string, item: Favorite): Promise<boolean> {
    const isFav = await this.isFavorited(source, id);
    if (isFav) {
      await this.remove(source, id);
      return false;
    } else {
      await this.save(source, id, item);
      return true;
    }
  }

  static async clearAll(): Promise<void> {
    if (this.getStorageType() === "localstorage") {
      await AsyncStorage.removeItem(STORAGE_KEYS.FAVORITES);
      return;
    }
    await api.deleteFavorite();
  }
}

// --- PlayRecordManager (Dynamic: API or LocalStorage) ---
export class PlayRecordManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  static async getAll(): Promise<Record<string, PlayRecord>> {
    const perfStart = performance.now();
    const storageType = this.getStorageType();
    logger.info(`[PERF] PlayRecordManager.getAll START - storageType: ${storageType}`);
    
    let apiRecords: Record<string, PlayRecord> = {};
    if (storageType === "localstorage") {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAY_RECORDS);
        apiRecords = data ? JSON.parse(data) : {};
      } catch (error) {
        logger.info("Failed to get all local play records:", error);
        return {};
      }
    } else {
      const apiStart = performance.now();
      logger.info(`[PERF] API getPlayRecords START`);
      
      apiRecords = await api.getPlayRecords();
      
      const apiEnd = performance.now();
      logger.info(`[PERF] API getPlayRecords END - took ${(apiEnd - apiStart).toFixed(2)}ms, records: ${Object.keys(apiRecords).length}`);
    }

    const localSettings = await PlayerSettingsManager.getAll();
    const mergedRecords: Record<string, PlayRecord> = {};
    for (const key in apiRecords) {
      mergedRecords[key] = {
        ...apiRecords[key],
        ...localSettings[key],
      };
    }
    
    const perfEnd = performance.now();
    logger.info(`[PERF] PlayRecordManager.getAll END - took ${(perfEnd - perfStart).toFixed(2)}ms, total records: ${Object.keys(mergedRecords).length}`);
    
    return mergedRecords;
  }

  static async save(source: string, id: string, record: Omit<PlayRecord, "save_time">): Promise<void> {
    const key = generateKey(source, id);
    const { introEndTime, outroStartTime, ...apiRecord } = record;

    // Player settings are always saved locally
    await PlayerSettingsManager.save(source, id, { introEndTime, outroStartTime });

    if (this.getStorageType() === "localstorage") {
      const allRecords = await this.getAll();
      const fullRecord = { ...apiRecord, save_time: Date.now() };
      allRecords[key] = { ...allRecords[key], ...fullRecord };
      await AsyncStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(allRecords));
    } else {
      await api.savePlayRecord(key, apiRecord);
    }
  }

  static async get(source: string, id: string): Promise<PlayRecord | null> {
    const perfStart = performance.now();
    const key = generateKey(source, id);
    const storageType = this.getStorageType();
    logger.info(`[PERF] PlayRecordManager.get START - source: ${source}, id: ${id}, storageType: ${storageType}`);
    
    const records = await this.getAll();
    const result = records[key] || null;
    
    const perfEnd = performance.now();
    logger.info(`[PERF] PlayRecordManager.get END - took ${(perfEnd - perfStart).toFixed(2)}ms, found: ${!!result}`);
    
    return result;
  }

  static async remove(source: string, id: string): Promise<void> {
    const key = generateKey(source, id);
    await PlayerSettingsManager.remove(source, id); // Always remove local settings

    if (this.getStorageType() === "localstorage") {
      const allRecords = await this.getAll();
      delete allRecords[key];
      await AsyncStorage.setItem(STORAGE_KEYS.PLAY_RECORDS, JSON.stringify(allRecords));
    } else {
      await api.deletePlayRecord(key);
    }
  }

  static async clearAll(): Promise<void> {
    await PlayerSettingsManager.clearAll(); // Always clear local settings

    if (this.getStorageType() === "localstorage") {
      await AsyncStorage.removeItem(STORAGE_KEYS.PLAY_RECORDS);
    } else {
      await api.deletePlayRecord();
    }
  }
}

// --- SearchHistoryManager (Dynamic: API or LocalStorage) ---
export class SearchHistoryManager {
  private static getStorageType() {
    return storageConfig.getStorageType();
  }

  static async get(): Promise<string[]> {
    if (this.getStorageType() === "localstorage") {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
        return data ? JSON.parse(data) : [];
      } catch (error) {
        logger.info("Failed to get local search history:", error);
        return [];
      }
    }
    return api.getSearchHistory();
  }

  static async add(keyword: string): Promise<void> {
    const trimmed = keyword.trim();
    if (!trimmed) return;

    if (this.getStorageType() === "localstorage") {
      let history = await this.get();
      history = [trimmed, ...history.filter((k) => k !== trimmed)].slice(0, 20); // Keep latest 20
      await AsyncStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
      return;
    }
    await api.addSearchHistory(trimmed);
  }

  static async clear(): Promise<void> {
    if (this.getStorageType() === "localstorage") {
      await AsyncStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
      return;
    }
    await api.deleteSearchHistory();
  }
}

// --- LiveSourcesManager (Uses AsyncStorage) ---
/**
 * 多直播源（TV / MTV）的持久化管理。
 * 负责：多源增删改、绑定关系、以及旧版单一 m3uUrl 的自动迁移。
 */
export class LiveSourcesManager {
  /** 读取完整配置；若没有新格式配置但存在旧 m3uUrl，则自动迁移 */
  static async get(): Promise<LiveSourcesConfig> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LIVE_SOURCES);
      if (data) {
        return normalizeLiveSourcesConfig(JSON.parse(data));
      }
    } catch (error) {
      logger.info("Failed to get live sources, will try migration:", error);
    }
    // 没有新格式配置，尝试从旧版单一 m3uUrl 迁移
    return this.migrateLegacyM3uUrl();
  }

  /** 保存完整配置 */
  static async save(config: LiveSourcesConfig): Promise<void> {
    await AsyncStorage.setItem(
      STORAGE_KEYS.LIVE_SOURCES,
      JSON.stringify(normalizeLiveSourcesConfig(config))
    );
  }

  /**
   * 旧版迁移：把 AppSettings.m3uUrl 转成一个默认源，并同时绑定到 TV / MTV 槽位。
   * 迁移成功后写回新格式，旧字段保留（不删除）以防回滚。
   */
  static async migrateLegacyM3uUrl(): Promise<LiveSourcesConfig> {
    try {
      const legacyData = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      const legacyUrl: string = legacyData ? JSON.parse(legacyData)?.m3uUrl || "" : "";
      if (legacyUrl.trim()) {
        const source: M3uSource = {
          id: createSourceId(),
          name: "默认直播源",
          url: legacyUrl.trim(),
          createdAt: Date.now(),
        };
        const migrated: LiveSourcesConfig = {
          version: 1,
          sources: [source],
          bindings: { tv: source.id, mtv: source.id },
        };
        await this.save(migrated);
        logger.info("Migrated legacy m3uUrl into live sources");
        return migrated;
      }
    } catch (error) {
      logger.info("Failed to migrate legacy m3uUrl:", error);
    }
    // 没有旧配置：首次启动时落库内置默认源，之后用户可自由增删改。
    try {
      await this.save(DEFAULT_LIVE_SOURCES);
    } catch (error) {
      logger.info("Failed to persist default live sources:", error);
    }
    return DEFAULT_LIVE_SOURCES;
  }

  static async add(name: string, url: string): Promise<LiveSourcesConfig> {
    const config = await this.get();
    const source: M3uSource = {
      id: createSourceId(),
      name: name.trim() || "未命名直播源",
      url: url.trim(),
      createdAt: Date.now(),
    };
    const next: LiveSourcesConfig = {
      ...config,
      sources: [...config.sources, source],
    };
    await this.save(next);
    return next;
  }

  static async update(id: string, patch: Partial<Pick<M3uSource, "name" | "url">>): Promise<LiveSourcesConfig> {
    const config = await this.get();
    const next: LiveSourcesConfig = {
      ...config,
      sources: config.sources.map((s) =>
        s.id === id
          ? {
              ...s,
              ...(patch.name !== undefined ? { name: patch.name.trim() || s.name } : {}),
              ...(patch.url !== undefined ? { url: patch.url.trim() } : {}),
            }
          : s
      ),
    };
    await this.save(next);
    return next;
  }

  static async remove(id: string): Promise<LiveSourcesConfig> {
    const config = await this.get();
    const bindings = { ...config.bindings };
    if (bindings.tv === id) bindings.tv = null;
    if (bindings.mtv === id) bindings.mtv = null;
    const next: LiveSourcesConfig = {
      ...config,
      sources: config.sources.filter((s) => s.id !== id),
      bindings,
    };
    await this.save(next);
    return next;
  }

  static async bind(slot: "tv" | "mtv", sourceId: string | null): Promise<LiveSourcesConfig> {
    const config = await this.get();
    const next: LiveSourcesConfig = {
      ...config,
      bindings: { ...config.bindings, [slot]: sourceId },
    };
    await this.save(next);
    return next;
  }
}

// --- SettingsManager (Uses AsyncStorage) ---
export class SettingsManager {
  static async get(): Promise<AppSettings> {
    const defaultSettings: AppSettings = {
      apiBaseUrl: "",
      remoteInputEnabled: true,
      videoSource: {
        enabledAll: true,
        sources: {},
      },
      m3uUrl: "",
    };
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...defaultSettings, ...JSON.parse(data) } : defaultSettings;
    } catch (error) {
      logger.info("Failed to get settings:", error);
      return defaultSettings;
    }
  }

  static async save(settings: Partial<AppSettings>): Promise<void> {
    const currentSettings = await this.get();
    const updatedSettings = { ...currentSettings, ...settings };
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
  }

  static async reset(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.SETTINGS);
  }
}

// --- LoginCredentialsManager (Uses AsyncStorage) ---
export class LoginCredentialsManager {
  static async get(): Promise<LoginCredentials | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LOGIN_CREDENTIALS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.info("Failed to get login credentials:", error);
      return null;
    }
  }

  static async save(credentials: LoginCredentials): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LOGIN_CREDENTIALS, JSON.stringify(credentials));
    } catch (error) {
      logger.error("Failed to save login credentials:", error);
    }
  }

  static async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.LOGIN_CREDENTIALS);
    } catch (error) {
      logger.error("Failed to clear login credentials:", error);
    }
  }
}
