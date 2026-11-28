// services/updateService.ts
// 更新服务（v2.3.0）：并发竞速检查 + 结果缓存 + 多源下载 / 停滞检测 / 断点续传
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import { Linking, Platform } from "react-native";
import Toast from "react-native-toast-message";
import { version as currentVersion } from "../package.json";
import {
  IN_APP_INSTALL_TARGETS,
  TARGET_LABELS,
  UPDATE_CONFIG,
  UpdateTarget,
} from "../constants/UpdateConfig";
import { DeviceUtils } from "@/utils/DeviceUtils";
import Logger from "@/utils/Logger";
import {
  getReleaseAssetUrls,
  getUpdateRegion,
  setUpdateRegion,
  getVersionChannelUrls,
  UpdateRegion,
} from "@/services/updateChannels";
import { moduleManager } from "@/modules/ModuleManager";
import { ModuleApplyResult, ModuleId, ModuleUpdateInfo } from "@/modules/contracts";

const logger = Logger.withTag("UpdateService");
const ANDROID_MIME_TYPE = "application/vnd.android.package-archive";

export interface VersionInfo {
  version: string;
  downloadUrl: string;
  releasePageUrl: string;
  assetName: string;
  releaseNotes: string;
  target: UpdateTarget;
  inAppInstall: boolean;
  source: "github-api" | "package-json";
}

interface GithubReleaseAsset {
  name: string;
  state: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  body?: string;
  assets: GithubReleaseAsset[];
}

/** 只取第一个成功的 Promise；全部失败时给出汇总错误（不依赖 Promise.any，兼容 Hermes） */
const firstFulfilled = <T>(promises: Array<Promise<T>>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    if (promises.length === 0) {
      reject(new Error("没有可用的版本检查源"));
      return;
    }
    let remaining = promises.length;
    const failures: string[] = [];
    promises.forEach((promise) => {
      promise.then(
        (value) => resolve(value),
        (error) => {
          failures.push(error instanceof Error ? error.message : String(error));
          remaining -= 1;
          if (remaining === 0) reject(new Error(`所有版本源均不可用（${failures.join("；")}）`));
        },
      );
    });
  });

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 给竞速中「未被采用」的请求挂一个静默 catch，避免取消时产生未处理的 rejection */
const swallowRejection = <T>(promise: Promise<T>): Promise<T> => {
  void promise.catch(() => undefined);
  return promise;
};

class UpdateService {
  private static instance: UpdateService;
  static getInstance(): UpdateService {
    if (!UpdateService.instance) UpdateService.instance = new UpdateService();
    return UpdateService.instance;
  }

  /** 最近一次成功的检查结果（内存缓存，避免重复请求拖慢启动） */
  private cached: { info: VersionInfo; at: number } | null = null;
  /** 并发去重：同一时刻只发起一轮检查 */
  private inFlight: Promise<VersionInfo> | null = null;
  /** 下载中断时保留的续传数据（iOS 提供；Android 拿不到时自动改为换源重下） */
  private resumeData: string | null = null;

  /** 统一带超时的 JSON 请求，支持外部取消（首个源成功后终止其余请求） */
  private async fetchJson<T>(
    url: string,
    timeoutMs: number,
    headers: Record<string, string> = {},
    externalSignal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    try {
      externalSignal?.addEventListener?.("abort", onAbort, { once: true } as any);
    } catch {
      // 个别运行时的 AbortSignal 不支持 addEventListener，忽略即可（仍有超时保护）
    }
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "ZTV-App",
          "Cache-Control": "no-cache",
          ...headers,
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
      try {
        externalSignal?.removeEventListener?.("abort", onAbort);
      } catch {
        // ignore
      }
    }
  }

  /** 根据设备形态决定下载哪个 Release 资源（v2.1.0 逻辑，保持不变） */
  detectTarget(): UpdateTarget {
    const os = String((Platform as any)?.OS ?? "").toLowerCase();

    if (DeviceUtils.isHarmonyOSNext()) return "harmony-next";

    if (os === "web") {
      const ua = String((globalThis as any)?.navigator?.userAgent ?? "");
      if (/harmonyos|arkweb|openharmony/i.test(ua)) return "harmony-next";
      if (/windows/i.test(ua)) return "windows";
      if (/macintosh|mac os x/i.test(ua)) return "macos";
      if (/linux|x11/i.test(ua)) return "linux";
      return "android";
    }

    if (DeviceUtils.isHarmonyOSAndroid()) return "harmony-android";
    if (DeviceUtils.isTV()) return "android-tv";
    if (os === "ios") return "ios";
    return "android";
  }

  /** 从 Release 资源列表里挑出与当前平台匹配的包 */
  private pickAsset(assets: GithubReleaseAsset[], target: UpdateTarget, version: string) {
    const expected = UPDATE_CONFIG.getAssetName(target, version);
    if (!expected) return undefined;
    return assets.find(
      (asset) =>
        asset.state === "uploaded" &&
        (asset.name === expected || asset.name.endsWith(expected.replace(`ZTV-v${version}-`, ""))),
    );
  }

  private fromRelease(release: GithubRelease, target: UpdateTarget): VersionInfo {
    const version = this.normalizeVersion(release.tag_name);
    if (!version) throw new Error(`无法识别版本号 ${release.tag_name}`);
    const asset = this.pickAsset(release.assets ?? [], target, version);
    const inAppInstall = !!asset && IN_APP_INSTALL_TARGETS.includes(target);
    return {
      version,
      downloadUrl: asset?.browser_download_url ?? UPDATE_CONFIG.getDownloadUrl(version, target),
      releasePageUrl: UPDATE_CONFIG.getReleasePageUrl(version),
      assetName: asset?.name ?? UPDATE_CONFIG.getAssetName(target, version),
      releaseNotes: release.body ?? "",
      target,
      inAppInstall,
      source: "github-api",
    };
  }

  private fromPackage(pkg: { version?: string }, target: UpdateTarget): VersionInfo {
    const version = this.normalizeVersion(pkg.version ?? "");
    if (!version) throw new Error("package.json 中没有有效版本号");
    return {
      version,
      downloadUrl: UPDATE_CONFIG.getDownloadUrl(version, target),
      releasePageUrl: UPDATE_CONFIG.getReleasePageUrl(version),
      assetName: UPDATE_CONFIG.getAssetName(target, version),
      releaseNotes: "",
      target,
      inAppInstall: IN_APP_INSTALL_TARGETS.includes(target),
      source: "package-json",
    };
  }

  /**
   * 检查最新版本：Releases API 与全部镜像**并发竞速**，谁先成功用谁。
   * API 信息更完整（含真实资源名 / 更新说明），因此给一个 1.2s 的优先窗口；
   * 窗口内没返回就立即采用最先成功的镜像结果，不再串行等待超时。
   */
  async checkVersion(force = false): Promise<VersionInfo> {
    if (!force && this.cached && Date.now() - this.cached.at < UPDATE_CONFIG.CACHE_TTL_MS) {
      logger.debug("checkVersion served from cache");
      return this.cached.info;
    }
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.raceVersionInfo()
      .then((info) => {
        this.cached = { info, at: Date.now() };
        return info;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  private async raceVersionInfo(): Promise<VersionInfo> {
    const target = this.detectTarget();
    const controller = new AbortController();
    const timeout = UPDATE_CONFIG.CHECK_TIMEOUT_MS;

    const apiPromise = swallowRejection(
      this.fetchJson<GithubRelease>(
        UPDATE_CONFIG.GITHUB_API_URL,
        timeout,
        {},
        controller.signal,
      ).then((release) => this.fromRelease(release, target)),
    );

    // v2.5.0：按用户所在网络优选国内 / 海外通道，再与原有镜像合并去重；
    // 全部并发竞速，任一地区端点可用即可完成版本检查。
    const channelUrls = await getVersionChannelUrls().catch(() => [] as string[]);
    const mirrorUrls = Array.from(new Set([
      ...channelUrls,
      ...UPDATE_CONFIG.getVersionMirrorUrls(),
    ]));
    const mirrorPromises = mirrorUrls.map((url) =>
      swallowRejection(
        this.fetchJson<{ version?: string }>(url, timeout, { Accept: "application/json" }, controller.signal).then(
          (pkg) => this.fromPackage(pkg, target),
        ),
      ),
    );

    try {
      // 1) 给 API 一个短暂的优先窗口
      const apiResult = await Promise.race([
        apiPromise.then((info) => info).catch(() => null),
        delay(UPDATE_CONFIG.API_PRIORITY_WINDOW_MS).then(() => null),
      ]);
      if (apiResult) {
        logger.debug("checkVersion via GitHub API (priority window)");
        return apiResult;
      }
      // 2) 否则取任意最先成功的源
      const info = await firstFulfilled<VersionInfo>([apiPromise, ...mirrorPromises]);
      logger.debug(`checkVersion via ${info.source}`);
      return info;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("checkVersion failed", error);
      throw new Error(`无法获取版本信息（${message}）`);
    } finally {
      // 终止仍在等待的请求，避免后台继续占用连接
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }
  }

  /** 兼容 "v2.1.0"、"release-2.1.0" 等 tag 写法 */
  private normalizeVersion(raw: string): string {
    const match = String(raw ?? "")
      .replace(/^v/i, "")
      .match(/\d+\.\d+\.\d+/);
    return match ? match[0] : "";
  }

  /** 清理旧的下载包，避免长期占用存储空间 */
  private async cleanOldDownloads(): Promise<void> {
    try {
      const dirUri = FileSystem.documentDirectory;
      if (!dirUri) return;
      const listing = await FileSystem.readDirectoryAsync(dirUri);
      const downloads = listing.filter(
        (name) => /^ZTV-v\d+/.test(name) && /\.(apk|zip|ipa|dmg|exe|deb)$/i.test(name),
      );
      if (downloads.length <= 3) return;
      const sorted = downloads.sort((a, b) => {
        const numA = parseInt((a.match(/ZTV-v(\d+)/) ?? [])[1] ?? "0", 10);
        const numB = parseInt((b.match(/ZTV-v(\d+)/) ?? [])[1] ?? "0", 10);
        return numB - numA;
      });
      for (const file of sorted.slice(3)) {
        try {
          await FileSystem.deleteAsync(`${dirUri}${file}`, { idempotent: true });
          logger.debug(`Deleted old download: ${file}`);
        } catch (e) {
          logger.warn(`Failed to delete ${file}`, e);
        }
      }
    } catch (e) {
      logger.warn("cleanOldDownloads error", e);
    }
  }

  /**
   * 单次下载：进度停滞看门狗 + 主动暂停保存 resumeData。
   * 大安装包（APK 60MB+）在网络抖动时最容易「卡住不动」，这里主动判定并换源续传。
   */
  private downloadOnce(
    url: string,
    fileUri: string,
    onProgress: ((percent: number) => void) | undefined,
    resumeData: string | null,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let lastProgressAt = Date.now();
      let settled = false;
      const factory = FileSystem as any;
      const task = factory.createDownloadResumable(
        url,
        fileUri,
        {},
        (progress: any) => {
          lastProgressAt = Date.now();
          if (onProgress && progress?.totalBytesExpectedToWrite) {
            onProgress(
              Math.floor((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100),
            );
          }
        },
        resumeData ?? undefined,
      );

      const watchdog = setInterval(() => {
        if (settled || Date.now() - lastProgressAt < UPDATE_CONFIG.DOWNLOAD_STALL_MS) return;
        settled = true;
        clearInterval(watchdog);
        void (async () => {
          try {
            const paused = await task.pauseAsync?.();
            this.resumeData = paused?.resumeData ?? null;
          } catch {
            this.resumeData = null;
          }
          try {
            await task.cancelAsync?.();
          } catch {
            // ignore
          }
          reject(new Error("下载进度停滞，准备换源续传"));
        })();
      }, 2000);

      void task
        .downloadAsync()
        .then((result: any) => {
          if (settled) return;
          settled = true;
          clearInterval(watchdog);
          if (result?.uri) resolve(result.uri);
          else reject(new Error("下载未返回文件地址"));
        })
        .catch((error: unknown) => {
          if (settled) return;
          settled = true;
          clearInterval(watchdog);
          reject(error);
        });
    });
  }

  /** 通用下载：多源换线 + 断点续传 + 停滞检测 + 完整性校验 */
  async downloadRelease(
    url: string,
    fileName: string,
    onProgress?: (percent: number) => void,
    candidates?: string[],
  ): Promise<string> {
    const dirUri = FileSystem.documentDirectory;
    if (!dirUri) throw new Error("当前平台不支持应用内下载，请在浏览器中下载");

    await this.cleanOldDownloads();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileUri = `${dirUri}${safeName}`;
    const baseUrls = (candidates?.length ? candidates : [url]).filter(Boolean);
    // 按当前网络通道重排：国内优先加速代理，海外优先 GitHub 直连
    const directUrl = baseUrls.find((item) => item.includes("/releases/download/")) ?? url;
    const regionUrls = await getReleaseAssetUrls(directUrl).catch(() => [] as string[]);
    const urls = Array.from(new Set([...regionUrls, ...baseUrls]));
    const maxAttempts = Math.min(UPDATE_CONFIG.DOWNLOAD_MAX_RETRIES, Math.max(urls.length, 2));
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const downloadUrl = urls[attempt % urls.length];
      try {
        // 已完整下载过的安装包直接复用，避免重复流量
        const existing = await FileSystem.getInfoAsync(fileUri);
        if (existing.exists && (existing.size ?? 0) >= UPDATE_CONFIG.MIN_ASSET_BYTES) {
          onProgress?.(100);
          return fileUri;
        }

        const resultUri = await this.downloadOnce(downloadUrl, fileUri, onProgress, this.resumeData);
        const info = await FileSystem.getInfoAsync(resultUri);
        if (!info.exists || (info.size ?? 0) < UPDATE_CONFIG.MIN_ASSET_BYTES) {
          throw new Error("下载文件不完整（可能是镜像返回了错误页）");
        }
        this.resumeData = null;
        return resultUri;
      } catch (error) {
        lastError = error;
        logger.warn(`downloadRelease attempt ${attempt + 1}/${maxAttempts}`, error);
        if (!this.resumeData) {
          // 没有续传数据时清掉残缺文件，保证下一次是干净下载
          await FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => undefined);
        }
        if (attempt < maxAttempts - 1) {
          onProgress?.(0);
          await delay(600 * (attempt + 1));
        }
      }
    }

    this.resumeData = null;
    Toast.show({
      type: "error",
      text1: "下载失败",
      text2: "可尝试点击「浏览器下载」获取安装包",
    });
    throw lastError instanceof Error ? lastError : new Error("下载失败");
  }

  /** 兼容旧调用方 */
  async downloadApk(
    url: string,
    onProgress?: (percent: number) => void,
  ): Promise<string> {
    return this.downloadRelease(url, `ZTV-v${Date.now()}.apk`, onProgress);
  }

  /** 安装 APK（仅 Android / 兼容 Android 的鸿蒙系统） */
  async installApk(fileUri: string): Promise<void> {
    const exists = await FileSystem.getInfoAsync(fileUri);
    if (!exists.exists) throw new Error(`安装文件不存在：${fileUri}`);

    if (Platform.OS !== "android") {
      throw new Error("当前系统不支持直接安装 APK，请使用浏览器下载");
    }

    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    try {
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: ANDROID_MIME_TYPE,
        flags: 1 | 0x00000010,
      });
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (message.includes("Activity not found")) {
        Toast.show({
          type: "error",
          text1: "安装失败",
          text2: "系统没有找到可以打开 APK 的应用",
        });
      } else if (message.includes("permission")) {
        Toast.show({
          type: "error",
          text1: "安装失败",
          text2: "请在设置中允许安装未知来源应用",
        });
      }
      throw error;
    }
  }

  /** 在浏览器打开 Release 页面（所有平台通用兜底） */
  async openReleasePage(url: string): Promise<void> {
    if (!url) throw new Error("下载地址无效");
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (canOpen) {
      await Linking.openURL(url);
      return;
    }
    const opened = (globalThis as any)?.window?.open?.(url, "_blank", "noopener,noreferrer");
    if (!opened) throw new Error("无法打开浏览器，请手动访问 GitHub Release 页面");
  }

  /** 版本比对，兼容 "v2.1.0"、"2.1.0-beta.1" 等写法 */
  compareVersions(v1: string, v2: string): number {
    const parse = (value: string) =>
      String(value ?? "")
        .replace(/^v/i, "")
        .split(/[-+]/)[0]
        .split(".")
        .map((part) => parseInt(part, 10) || 0);
    const p1 = parse(v1);
    const p2 = parse(v2);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
      const n1 = p1[i] ?? 0;
      const n2 = p2[i] ?? 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }

  getCurrentVersion(): string {
    return currentVersion;
  }

  isUpdateAvailable(remoteVersion: string): boolean {
    return !!remoteVersion && this.compareVersions(remoteVersion, currentVersion) > 0;
  }

  // ── v2.5.0 模块级独立更新：不下载整包 App，不影响其它模块 ──────────────
  async checkModuleUpdates(): Promise<ModuleUpdateInfo[]> {
    return moduleManager.checkModuleUpdates();
  }

  async updateModule(id: ModuleId): Promise<ModuleApplyResult> {
    return moduleManager.updateModule(id);
  }

  async rollbackModule(id: ModuleId): Promise<void> {
    await moduleManager.rollback(id);
  }

  async getModuleStates() {
    return moduleManager.getStates();
  }

  getUpdateRegion(): Promise<UpdateRegion> {
    return getUpdateRegion();
  }

  setUpdateRegion(region: UpdateRegion): Promise<void> {
    return setUpdateRegion(region);
  }

  getTargetLabel(target: UpdateTarget): string {
    return TARGET_LABELS[target] ?? "当前设备";
  }
}

export default UpdateService.getInstance();
