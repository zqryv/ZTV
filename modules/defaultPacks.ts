/**
 * 模块内置默认资源包（v2.5.0）。
 *
 * 这是「随 App 发布」的兜底配置；线上同名文件在 module-packs/<id>.json，
 * 由 scripts/buildModulePacks.js 从本文件生成，保证两者的字段与取值一致。
 * 单独升级某个模块时，只需修改本文件中该模块的 config 并重建该模块的包。
 *
 * 注意：本文件被 Node 构建脚本直接转译加载，请勿 import 其他模块。
 */
export const APP_VERSION = "2.5.0";

export const BUNDLED_MODULE_META = {
  search: {
    version: "2.5.0",
    minAppVersion: "2.5.0",
    title: "搜索",
    entry: "modules/search/SearchScreen",
    changelog: ["输入框焦点修复", "中文拼音候选键盘", "删除 / 清空 / 回退语义统一"],
  },
  music: {
    version: "2.5.0",
    minAppVersion: "2.5.0",
    title: "音乐在线",
    entry: "modules/music/MusicScreen",
    changelog: ["输入框焦点修复", "有效结果缓存与关键词记忆", "榜单雷达与请求熔断"],
  },
  radio: {
    version: "2.5.0",
    minAppVersion: "2.5.0",
    title: "收音机",
    entry: "modules/radio/RadioScreen",
    changelog: ["离线节目单", "预缓存与断网回退播放", "缓存容量管理"],
  },
};

const OFFLINE_BASE = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-";
const program = (
  n: number,
  id: string,
  name: string,
  category: string,
  country: string,
  minutes: number,
  description: string,
) => ({
  id,
  name,
  category,
  country,
  description,
  url: `${OFFLINE_BASE}${n}.mp3`,
  license: "SoundHelix 公开演示音频（公版器乐，允许离线缓存）",
  source: "SoundHelix 公版器乐",
  durationSec: minutes * 60,
  estimatedMB: Math.round(minutes * 1.1),
  kind: "offline",
});

export const BUNDLED_PACKS = {
  search: {
    id: "search",
    version: "2.5.0",
    config: {
      maxKeywordLength: 40,
      imeEnabledByDefault: true,
      letterRows: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
      numberRows: ["1234567890", "-/:;()@&\""],
      candidateLimit: 8,
      commitCompositionOnSearch: true,
      quickTerms: ["庆余年", "流浪地球", "三体", "繁花", "狂飙", "漫长的季节"],
      hints: ["输入拼音如 qingyu 选中文", "输入首字母 QYN 直达片名", "删除键先退拼音再退文字"],
    },
  },
  music: {
    id: "music",
    version: "2.5.0",
    config: {
      cacheTtlMs: 30 * 60 * 1000,
      cacheMaxEntries: 60,
      debounceMs: 320,
      circuitThreshold: 3,
      circuitCooldownMs: 60 * 1000,
      rememberQuery: true,
      radar: { chartSize: 20, injectCount: 6, excludeRecent: true },
      qualityPreference: "320",
      /** 切换曲库不自动触发请求，只有显式搜索才发出网络调用 */
      sourceSwitchAutoSearch: false,
      sources: ["latest", "channels", "builtin"],
      quickTerms: ["周杰伦", "邓紫棋", "陈奕迅", "Taylor Swift", "华语", "流行", "古典", "爵士", "轻音乐", "电子"],
    },
  },
  radio: {
    id: "radio",
    version: "2.5.0",
    config: {
      cacheQuotaMB: 256,
      preloadCount: 3,
      autoFallbackToCached: true,
      maxConcurrentDownloads: 2,
      categories: ["全部", "直播", "离线"],
      /** 离线节目：可预下载到本地，断网后从 file:// 播放 */
      offlinePrograms: [
        program(1, "offline-cn-1", "晨间轻音乐", "轻音乐", "中国大陆", 6, "公版器乐 · 适合晨间收听"),
        program(2, "offline-cn-2", "午后爵士", "爵士", "中国大陆", 7, "公版器乐 · 松弛的午后时段"),
        program(3, "offline-cn-3", "城市夜航", "电子", "中国大陆", 6, "公版器乐 · 夜间氛围"),
        program(4, "offline-tw-1", "海峡旋律", "音乐", "中国台湾", 7, "公版器乐 · 华语轻音乐选段"),
        program(5, "offline-us-1", "蓝调公路", "爵士", "美国", 6, "公版器乐 · 公路电台风格"),
        program(6, "offline-us-2", "古典时刻", "古典", "美国", 8, "公版器乐 · 古典选段"),
        program(7, "offline-jp-1", "樱色音景", "轻音乐", "日本", 6, "公版器乐 · 环境音景"),
        program(8, "offline-eu-1", "欧陆晨曲", "古典", "欧洲", 7, "公版器乐 · 晨间古典"),
        program(9, "offline-eu-2", "深夜电台", "音乐", "欧洲", 6, "公版器乐 · 深夜陪伴"),
        program(10, "offline-kr-1", "首尔慢调", "流行", "韩国", 5, "公版器乐 · 慢调节目"),
        program(11, "offline-cn-4", "文化讲堂", "文化", "中国大陆", 8, "公版器乐 · 文化节目底乐"),
        program(12, "offline-cn-5", "周末精选", "音乐", "中国大陆", 7, "公版器乐 · 周末合辑"),
      ],
    },
  },
};
