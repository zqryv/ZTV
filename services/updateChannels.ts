/**
 * v2.5.0 国内 / 海外双通道更新选址。
 *
 * 之前的做法是「一组固定镜像 + 竞速」，国内用户遇到 raw.githubusercontent.com
 * 不通时只能等超时，海外用户又会被代理拖慢。本层把端点按通道分组：
 *  - domestic：jsDelivr 三个官方节点（国内可直连）+ GitHub 加速代理；
 *  - overseas：GitHub raw / github.com raw / Releases 直连；
 *  - auto：两组交错并发竞速，谁先成功用谁，并把成功通道记下来下次优先。
 *
 * 所有 URL 都带「请求时」时间戳，避免 CDN 返回旧版本。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UpdateRegion = "auto" | "domestic" | "overseas";

const OWNER = "zqryv";
const REPO = "ZTV";
const GH_RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main`;
const GH_WEB_RAW = `https://github.com/${OWNER}/${REPO}/raw/refs/heads/main`;
const GH_RELEASES = `https://github.com/${OWNER}/${REPO}/releases`;

/** jsDelivr 官方节点：国内三大运营商均可直连，海外也有边缘节点 */
export const DOMESTIC_BASES = [
  `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@main`,
  `https://fastly.jsdelivr.net/gh/${OWNER}/${REPO}@main`,
  `https://gcore.jsdelivr.net/gh/${OWNER}/${REPO}@main`,
];

export const OVERSEAS_BASES = [GH_RAW, GH_WEB_RAW];

/** 安装包下载的 GitHub 加速前缀（只作用于 /releases/download/ 直链） */
export const DOWNLOAD_MIRROR_PREFIXES = [
  "",
  "https://ghfast.top/",
  "https://gh-proxy.com/",
  "https://ghproxy.net/",
  "https://hub.gitmirror.com/",
];

const REGION_KEY = "ztv_update_region";
const PREFERRED_BASE_KEY = "ztv_update_preferred_base";
const LATENCY_KEY = "ztv_update_latency";

export const getUpdateRegion = async (): Promise<UpdateRegion> => {
  try {
    const value = await AsyncStorage.getItem(REGION_KEY);
    return value === "domestic" || value === "overseas" ? value : "auto";
  } catch {
    return "auto";
  }
};

export const setUpdateRegion = async (region: UpdateRegion): Promise<void> => {
  try {
    await AsyncStorage.setItem(REGION_KEY, region);
  } catch {
    /* 存储不可用时退化为 auto，不影响更新 */
  }
};

/** 时区 / 语言只作为「偏好提示」，真正选址仍由并发竞速结果决定 */
export const detectRegionHint = (): UpdateRegion => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lang = typeof navigator !== "undefined" ? navigator.language : "";
    if (/^Asia\/(Shanghai|Chongqing|Hong_Kong|Macao|Taipei)/.test(tz) || /^zh-(CN|Hans)/i.test(lang)) {
      return "domestic";
    }
  } catch {
    /* Intl 不可用时忽略 */
  }
  return "auto";
};

const interleave = (a: string[], b: string[]): string[] => {
  const out: string[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
};

const withStamp = (urls: string[]): string[] => {
  const t = Date.now();
  return urls.map((url) => `${url}${url.includes("?") ? "&" : "?"}t=${t}`);
};

const orderByRegion = (domestic: string[], overseas: string[], region: UpdateRegion): string[] => {
  // auto 时用时区 / 语言提示挑选「首轮优先通道」，但两组端点始终都保留作兜底
  const effective = region === "auto" ? detectRegionHint() : region;
  if (effective === "domestic") return [...domestic, ...overseas];
  if (effective === "overseas") return [...overseas, ...domestic];
  return interleave(domestic, overseas);
};

/** 把上次最快的端点提到队首（auto 模式下仍是全部并发，只影响优先级） */
const preferLastFastest = async (urls: string[]): Promise<string[]> => {
  try {
    const fastest = await AsyncStorage.getItem(PREFERRED_BASE_KEY);
    if (!fastest) return urls;
    const hit = urls.find((url) => url.startsWith(fastest));
    if (!hit) return urls;
    return [hit, ...urls.filter((url) => url !== hit)];
  } catch {
    return urls;
  }
};

/** 版本检查用候选地址（package.json） */
export const getVersionChannelUrls = async (): Promise<string[]> => {
  const region = await getUpdateRegion();
  const domestic = withStamp(DOMESTIC_BASES.map((b) => `${b}/package.json`));
  const overseas = withStamp(OVERSEAS_BASES.map((b) => `${b}/package.json`));
  return preferLastFastest(orderByRegion(domestic, overseas, region));
};

/** 模块清单用候选地址 */
export const getModuleRegistryUrls = async (): Promise<string[]> => {
  const region = await getUpdateRegion();
  const domestic = withStamp(DOMESTIC_BASES.map((b) => `${b}/module-registry.json`));
  const overseas = withStamp(OVERSEAS_BASES.map((b) => `${b}/module-registry.json`));
  return preferLastFastest(orderByRegion(domestic, overseas, region));
};

/** 单个模块资源包候选地址 */
export const getModulePackUrls = async (id: string): Promise<string[]> => {
  const region = await getUpdateRegion();
  const file = `module-packs/${id}.json`;
  const domestic = withStamp(DOMESTIC_BASES.map((b) => `${b}/${file}`));
  const overseas = withStamp(OVERSEAS_BASES.map((b) => `${b}/${file}`));
  return preferLastFastest(orderByRegion(domestic, overseas, region));
};

/** 安装包直链的国内 / 海外候选，供 downloadRelease 换源重试 */
export const getReleaseAssetUrls = async (directUrl: string): Promise<string[]> => {
  if (!directUrl.includes("/releases/download/")) return [directUrl];
  const region = await getUpdateRegion();
  const overseas = [`${directUrl}`];
  const domestic = DOWNLOAD_MIRROR_PREFIXES.slice(1).map((prefix) => `${prefix}${directUrl}`);
  const ordered = orderByRegion(domestic, overseas, region);
  return Array.from(new Set(ordered));
};

export const getReleaseBase = (): string => GH_RELEASES;

/** 记录一次成功/失败结果，用于下次排序与设置页展示通道健康度 */
export const recordEndpointResult = async (
  url: string,
  ok: boolean,
  latencyMs: number,
): Promise<void> => {
  try {
    const base = DOMESTIC_BASES.concat(OVERSEAS_BASES).find((b) => url.startsWith(b));
    if (!base) return;
    if (ok) {
      await AsyncStorage.setItem(PREFERRED_BASE_KEY, base);
      const raw = await AsyncStorage.getItem(LATENCY_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[base] = Math.round(latencyMs);
      await AsyncStorage.setItem(LATENCY_KEY, JSON.stringify(map));
    }
  } catch {
    /* 记录失败不影响主流程 */
  }
};

export const getChannelHealth = async (): Promise<Record<string, number>> => {
  try {
    return JSON.parse((await AsyncStorage.getItem(LATENCY_KEY)) || "{}");
  } catch {
    return {};
  }
};
