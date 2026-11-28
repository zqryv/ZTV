/**
 * ZTV 自动更新配置（v2.3.0 稳定性重构）。
 *
 * v2.1.0 的更新链路（Releases API 优先 + 按设备形态选包 + 浏览器兜底）设计正确，
 * 但 v2.2.x 暴露出两个问题：
 *  1) 版本检查是「API 8s → 镜像 6s × 3」的串行等待，最坏要等 26s 才出结果；
 *     且 raw 镜像路径写成了 /refs/heads/main/...（恒 404），时间戳在模块加载时就固定了；
 *  2) 下载大安装包时中断只能从头再来，重试仅 2 次，没有停滞检测与备用下载源。
 *
 * 本版修复：并发竞速 + 短超时、正确的镜像地址与请求时时间戳、结果缓存、
 * 多下载源 + 停滞检测 + 完整性校验；平台资源映射与浏览器兜底保持不变。
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

/**
 * v2.5.0 双通道：国内走 jsDelivr 三节点 + GitHub 加速代理，
 * 海外走 raw.githubusercontent.com / github.com 直连。
 * 时间戳在「每次请求时」生成，避免 CDN 返回旧版本。
 */
const DOMESTIC_VERSION_MIRRORS: Array<() => string> = [
  () => `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/package.json?t=${Date.now()}`,
  () => `https://fastly.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/package.json?t=${Date.now()}`,
  () => `https://gcore.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/package.json?t=${Date.now()}`,
  () => `https://ghproxy.net/${GITHUB_RAW_BASE}/main/package.json?t=${Date.now()}`,
];

const OVERSEAS_VERSION_MIRRORS: Array<() => string> = [
  () => `${GITHUB_RAW_BASE}/main/package.json?t=${Date.now()}`,
  () => `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/raw/refs/heads/main/package.json?t=${Date.now()}`,
];

/** 交错排列，保证并发竞速时国内与海外端点都有机会先返回 */
const VERSION_MIRROR_BUILDERS: Array<() => string> = [];
for (let i = 0; i < Math.max(DOMESTIC_VERSION_MIRRORS.length, OVERSEAS_VERSION_MIRRORS.length); i += 1) {
  if (DOMESTIC_VERSION_MIRRORS[i]) VERSION_MIRROR_BUILDERS.push(DOMESTIC_VERSION_MIRRORS[i]);
  if (OVERSEAS_VERSION_MIRRORS[i]) VERSION_MIRROR_BUILDERS.push(OVERSEAS_VERSION_MIRRORS[i]);
}

/** 安装包下载镜像：直连 + 四个国内加速代理，失败时依次换源 */
export const DOWNLOAD_MIRROR_PREFIXES = [
  "",
  "https://ghfast.top/",
  "https://gh-proxy.com/",
  "https://ghproxy.net/",
  "https://hub.gitmirror.com/",
];

/** 模块清单 / 资源包同样走双通道 jsDelivr + GitHub raw */
const MODULE_FILE_MIRRORS = [
  `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main`,
  `https://fastly.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main`,
  GITHUB_RAW_BASE,
];

export const UPDATE_CONFIG = {
  AUTO_CHECK: true,

  // 12 小时自动检查一次
  CHECK_INTERVAL: 12 * 60 * 60 * 1000,

  /** 单个候选请求超时：并发执行，不再串行累加 */
  CHECK_TIMEOUT_MS: 4500,

  /** Releases API 信息更完整，给它一个短暂的优先窗口 */
  API_PRIORITY_WINDOW_MS: 1200,

  /** 检查成功后的内存缓存有效期，避免反复请求拖慢启动 */
  CACHE_TTL_MS: 5 * 60 * 1000,

  /** 下载进度停滞多久判定为中断 */
  DOWNLOAD_STALL_MS: 18000,

  /** 下载最大尝试次数（含换源） */
  DOWNLOAD_MAX_RETRIES: 4,

  /** 安装包最小合法体积（字节），用于识别代理返回的 HTML 错误页 */
  MIN_ASSET_BYTES: 64 * 1024,

  GITHUB_API_URL: `${GITHUB_API_BASE}/releases/latest`,

  /** 每次调用都重新生成时间戳，真正绕开 CDN 缓存 */
  getVersionMirrorUrls(): string[] {
    return VERSION_MIRROR_BUILDERS.map((build) => build());
  },

  /** 兼容旧调用方：返回一组静态镜像地址 */
  GITHUB_RAW_URLS: VERSION_MIRROR_BUILDERS.map((build) => build()),

  /** v2.5.0：模块清单候选，供模块级独立更新使用（双通道） */
  getModuleRegistryUrls(): string[] {
    return MODULE_FILE_MIRRORS.map((base) => `${base}/module-registry.json?t=${Date.now()}`);
  },

  /** v2.5.0：单个模块资源包候选，升级一个模块只下载几 KB */
  getModulePackUrls(id: string): string[] {
    return MODULE_FILE_MIRRORS.map((base) => `${base}/module-packs/${id}.json?t=${Date.now()}`);
  },

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

  /** 同一个安装包的多个下载地址，供下载失败时换源重试 */
  getDownloadCandidates(version: string, target: UpdateTarget): string[] {
    const direct = this.getDownloadUrl(version, target);
    if (!direct.includes("/releases/download/")) return [direct];
    return DOWNLOAD_MIRROR_PREFIXES.map((prefix) => `${prefix}${direct}`);
  },
};
