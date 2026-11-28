/**
 * 收音机离线节目单（v2.5.0）。
 *
 * 旧实现 35 个内置电台全部是实时网络流，「无需联网」只指列表是常量、播放仍需网络。
 * 这里新增可预缓存的点播节目：节目单来自模块资源包（可独立升级），
 * 音频为公版器乐，联网时下载到本地，断网后从 file:// / blob: 播放。
 */
import { RadioStation } from "@/constants/AudioLibrary";
import { moduleManager } from "@/modules/ModuleManager";

export interface OfflineProgram {
  id: string;
  name: string;
  category: string;
  country: string;
  description: string;
  url: string;
  license: string;
  source: string;
  durationSec: number;
  estimatedMB: number;
  kind: "offline";
}

export interface RadioModuleConfig {
  cacheQuotaMB: number;
  preloadCount: number;
  autoFallbackToCached: boolean;
  maxConcurrentDownloads: number;
  categories: string[];
  offlinePrograms: OfflineProgram[];
}

const ACCENTS = ["#00E6A8", "#4DA3FF", "#FFB86B", "#C77DFF", "#FF6B8A", "#7BE0AD"];

export const OFFLINE_ID_PREFIX = "offline-";
export const isOfflineStationId = (id: string): boolean => id.startsWith(OFFLINE_ID_PREFIX);

export const loadRadioModuleConfig = (): Promise<RadioModuleConfig> =>
  moduleManager.getConfig<RadioModuleConfig>("radio");

/** 把离线节目映射成现有电台列表可直接渲染的 RadioStation */
export const toRadioStation = (program: OfflineProgram, index: number): RadioStation => ({
  id: program.id,
  name: program.name,
  category: program.category,
  description: program.description,
  url: program.url,
  accent: ACCENTS[index % ACCENTS.length],
  country: program.country,
  codec: `离线 ${program.estimatedMB}MB`,
  source: program.source,
});

export const isValidOfflineProgram = (program: OfflineProgram): boolean =>
  !!program.id &&
  program.id.startsWith(OFFLINE_ID_PREFIX) &&
  /^https:\/\//.test(program.url) &&
  program.estimatedMB > 0;
