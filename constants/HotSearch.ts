/**
 * 搜索页热搜影视数据。
 *
 * initials 为影片名称的拼音首字母（由 utils/pinyin.ts 的 getInitials 生成，
 * 此处预置以免运行时查表误差），用于首字母检索与 A-Z 索引。
 */
export interface HotSearchItem {
  title: string;
  initials: string;
  /** 热度标签，仅用于展示排序 */
  rank: number;
  tag?: string;
}

export const HOT_SEARCH_ITEMS: HotSearchItem[] = [
  { title: "庆余年 第二季", initials: "QYNDEJ", rank: 1, tag: "热" },
  { title: "玫瑰的故事", initials: "MGDGS", rank: 2, tag: "热" },
  { title: "繁花", initials: "FH", rank: 3, tag: "新" },
  { title: "漫长的季节", initials: "MCDJJ", rank: 4 },
  { title: "三体", initials: "ST", rank: 5 },
  { title: "狂飙", initials: "KB", rank: 6 },
  { title: "周处除三害", initials: "ZCCSH", rank: 7, tag: "新" },
  { title: "流浪地球2", initials: "LLDQ2", rank: 8 },
  { title: "长安十二时辰", initials: "CASESC", rank: 9 },
  { title: "隐秘的角落", initials: "YMDJL", rank: 10 },
  { title: "山海情", initials: "SHQ", rank: 11 },
  { title: "觉醒年代", initials: "JXND", rank: 12 },
  { title: "我的阿勒泰", initials: "WDALT", rank: 13, tag: "新" },
  { title: "封神第一部", initials: "FSDYB", rank: 14 },
  { title: "满江红", initials: "MJH", rank: 15 },
  { title: "星际穿越", initials: "XJCY", rank: 16 },
  { title: "阿凡达", initials: "AFD", rank: 17 },
  { title: "奥本海默", initials: "ABHM", rank: 18 },
  { title: "千与千寻", initials: "QYQX", rank: 19 },
  { title: "肖申克的救赎", initials: "XSKDJS", rank: 20 },
  { title: "白夜追凶", initials: "BYZX", rank: 21 },
  { title: "琅琊榜", initials: "LYB", rank: 22 },
  { title: "甄嬛传", initials: "ZHC", rank: 23 },
  { title: "大明王朝1566", initials: "DMWC1566", rank: 24 },
];

/** A-Z 首字母索引（仅包含热搜数据里实际出现的字母） */
export const HOT_LETTERS: string[] = Array.from(
  new Set(HOT_SEARCH_ITEMS.map((item) => item.initials[0]).filter(Boolean))
).sort();
