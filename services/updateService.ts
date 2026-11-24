// services/updateService.ts
// 更新服务：GitHub Releases API 优先 + 多镜像回退 + 按设备形态选择安装包
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

class UpdateService {
  private static instance: UpdateService;
  static getInstance(): UpdateService {
    if (!UpdateService.instance) UpdateService.instance = new UpdateService();
    return UpdateService.instance;
  }

  /** 统一带超时的 JSON 请求，避免某个镜像卡死导致整个检查流程不可用 */
  private async fetchJson<T>(
    url: string,
    timeoutMs: number,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    }
  }

  /** 根据设备形态决定下载哪个 Release 资源 */
  detectTarget(): UpdateTarget {
    const os = String((Platform as any)?.OS ?? "").toLowerCase();

    // 鸿蒙 NEXT 无法安装 Android APK，只能走鸿蒙 Web 包 / Release 页面
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

  /**
   * 检查最新版本。
   * GitHub API → raw.github → jsDelivr → github.com/raw，任一成功即返回。
   */
  async checkVersion(): Promise<VersionInfo> {
    const target = this.detectTarget();
    const failures: string[] = [];

    // 1) GitHub Releases API：能拿到 tag、说明与真实资源名（最可靠）
    try {
      const release = await this.fetchJson<GithubRelease>(UPDATE_CONFIG.GITHUB_API_URL, 8000);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`GitHub API: ${message}`);
      logger.warn(`checkVersion via GitHub API failed: ${message}`);
    }

    // 2) package.json 镜像：API 限流时仍能判断是否出现新版本
    for (const url of UPDATE_CONFIG.GITHUB_RAW_URLS) {
      try {
        const pkg = await this.fetchJson<{ version?: string }>(url, 6000);
        const version = this.normalizeVersion(pkg.version ?? "");
        if (!version) throw new Error("package.json 中没有有效版本号");
        const inAppInstall = IN_APP_INSTALL_TARGETS.includes(target);
        return {
          version,
          downloadUrl: UPDATE_CONFIG.getDownloadUrl(version, target),
          releasePageUrl: UPDATE_CONFIG.getReleasePageUrl(version),
          assetName: UPDATE_CONFIG.getAssetName(target, version),
          releaseNotes: "",
          target,
          // Actions 的资源命名固定，镜像回退时可直接拼接下载地址；同时保留 Release 页面兜底
          inAppInstall,
          source: "package-json",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`镜像 ${url.split("/")[2] ?? "未知"}: ${message}`);
        logger.warn(`checkVersion via mirror failed: ${message}`);
      }
    }

    const error = new Error(`无法获取版本信息（${failures.join("；")}）`);
    logger.error("checkVersion failed", error);
    throw error;
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

  /** 通用下载：APK / ZIP / IPA 均可用，进度回调统一为百分比 */
  async downloadRelease(
    url: string,
    fileName: string,
    onProgress?: (percent: number) => void,
  ): Promise<string> {
    const dirUri = FileSystem.documentDirectory;
    if (!dirUri) throw new Error("当前平台不支持应用内下载，请在浏览器中下载");

    await this.cleanOldDownloads();
    const maxRetries = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileUri = `${dirUri}${safeName}`;
        const task = FileSystem.createDownloadResumable(
          url,
          fileUri,
          {},
          (progress) => {
            if (onProgress && progress.totalBytesExpectedToWrite) {
              onProgress(
                Math.floor(
                  (progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100,
                ),
              );
            }
          },
        );
        const result = await task.downloadAsync();
        if (result?.uri) return result.uri;
        throw new Error("下载未返回文件地址");
      } catch (error) {
        lastError = error;
        logger.warn(`downloadRelease attempt ${attempt}/${maxRetries}`, error);
        if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }

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
    // Web / Electron 容器下 canOpenURL 可能返回 false，直接用浏览器窗口打开
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

  getTargetLabel(target: UpdateTarget): string {
    return TARGET_LABELS[target] ?? "当前设备";
  }
}

export default UpdateService.getInstance();
