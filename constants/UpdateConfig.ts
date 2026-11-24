/**
 * ZTV 自动更新配置。
 *
 * 更新链路（v2.1.0 修复）：
 * 1. 优先请求 GitHub Releases API（/releases/latest），直接拿到 tag 与真实资源名；
 * 2. API 失败（限流 / 网络）时依次回退 raw.githubusercontent.com 与 jsDelivr 上的 package.json；
 * 3. 根据当前设备形态选择对应平台的安装包，并在不支持应用内安装时提供 Release 页面兜底。
 *
 * 发布新版本时只需推送 v* tag 触发 Actions，仓库地址无需再改。
 */
const GITHUB_OWNER = "zqryv";
const GITHUB_REPO = "ZTV";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
const GITHUB_RELEASE_BASE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

/** 更新目标平台（与具体设备形态解耦，便于 TV / 机顶盒 / 鸿蒙共用） */
export type UpdateTarget =
  | "android-tv"
  | "android"
  | "harmony-android"
  | "harmony-next"
  | "ios"
  | "windows"
  | "macos"
  | "linux";

/** Release 资源后缀，需与 .github/workflows/release.yml 中产物命名保持一致 */
const ASSET_SUFFIX: Record<UpdateTarget, string | null> = {
  "android-tv": "android-tv.apk",
  android: "android.apk",
  "harmony-android": "android.apk",
  "harmony-next": "harmony-web.zip",
  ios: "ios.ipa",
  windows: "windows-setup.exe",
  macos: "macos-universal.dmg",
  linux: "linux-amd64.deb",
};

/** 目标平台是否支持应用内下载 + 安装（APK） */
export const IN_APP_INSTALL_TARGETS: UpdateTarget[] = [
  "android-tv",
  "android",
  "harmony-android",
];

/** 目标平台的可读名称，用于更新弹窗提示 */
export const TARGET_LABELS: Record<UpdateTarget, string> = {
  "android-tv": "Android TV / 电视",
  android: "Android 手机 / 平板",
  "harmony-android": "HarmonyOS（兼容 Android 应用）",
  "harmony-next": "HarmonyOS NEXT",
  ios: "iPhone / iPad",
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

export const UPDATE_CONFIG = {
  AUTO_CHECK: true,

  // 12 小时自动检查一次
  CHECK_INTERVAL: 12 * 60 * 60 * 1000,

  GITHUB_API_URL: `${GITHUB_API_BASE}/releases/latest`,

  // 多镜像：任一可用即可拿到最新版本号（时间戳绕开 CDN 缓存）
  GITHUB_RAW_URLS: [
    `${GITHUB_RAW_BASE}/refs/heads/main/package.json?t=${Date.now()}`,
    `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/package.json?t=${Date.now()}`,
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/raw/refs/heads/main/package.json?t=${Date.now()}`,
  ],

  getReleasePageUrl(version: string): string {
    return `${GITHUB_RELEASE_BASE}/tag/v${version}`;
  },

  getReleaseTag(version: string): string {
    return `v${version}`;
  },

  getAssetName(target: UpdateTarget, version: string): string {
    const suffix = ASSET_SUFFIX[target];
    return suffix ? `ZTV-v${version}-${suffix}` : "";
  },

  getDownloadUrl(version: string, target: UpdateTarget): string {
    const assetName = this.getAssetName(target, version);
    return assetName
      ? `${GITHUB_RELEASE_BASE}/download/v${version}/${assetName}`
      : this.getReleasePageUrl(version);
  },
};
