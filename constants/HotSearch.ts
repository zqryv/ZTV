/**
 * 搜索页热搜影视数据（v2.1.0 扩充到 71 条）。
 *
 * initials 由 utils/pinyin.ts 的 getInitials 生成并校验，
 * 用于首字母检索与 A-Z 索引；热搜越多，首字母直达的可命中片名越丰富。
 */
export interface HotSearchItem {
  title: string;
  initials: string;
  /** 热度排序（越小越热） */
  rank: number;
  tag?: "热" | "新" | "荐";
}

export const HOT_SEARCH_ITEMS: HotSearchItem[] = [
  { title: "庆余年 第二季", initials: "QYNDEJ", rank: 1, tag: "热" },
  { title: "玫瑰的故事", initials: "MGDGS", rank: 2, tag: "热" },
  { title: "繁花", initials: "FH", rank: 3, tag: "热" },
  { title: "漫长的季节", initials: "MCDJJ", rank: 4, tag: "热" },
  { title: "三体", initials: "ST", rank: 5, tag: "热" },
  { title: "狂飙", initials: "KB", rank: 6, tag: "热" },
  { title: "周处除三害", initials: "ZCCSH", rank: 7, tag: "热" },
  { title: "流浪地球2", initials: "LLDQ2", rank: 8, tag: "热" },
  { title: "长安十二时辰", initials: "CASESC", rank: 9, tag: "热" },
  { title: "隐秘的角落", initials: "YMDJL", rank: 10, tag: "热" },
  { title: "山海情", initials: "SHQ", rank: 11, tag: "新" },
  { title: "觉醒年代", initials: "JXND", rank: 12, tag: "新" },
  { title: "我的阿勒泰", initials: "WDALT", rank: 13, tag: "新" },
  { title: "封神第一部", initials: "FSDYB", rank: 14, tag: "新" },
  { title: "满江红", initials: "MJH", rank: 15, tag: "新" },
  { title: "星际穿越", initials: "XJCY", rank: 16, tag: "新" },
  { title: "阿凡达", initials: "AFD", rank: 17, tag: "新" },
  { title: "奥本海默", initials: "ABHM", rank: 18, tag: "新" },
  { title: "千与千寻", initials: "QYQX", rank: 19, tag: "新" },
  { title: "肖申克的救赎", initials: "XSKDJS", rank: 20, tag: "新" },
  { title: "白夜追凶", initials: "BYZX", rank: 21 },
  { title: "琅琊榜", initials: "LYB", rank: 22 },
  { title: "甄嬛传", initials: "ZHC", rank: 23 },
  { title: "大明王朝1566", initials: "DMWC1566", rank: 24 },
  { title: "赘婿", initials: "ZX", rank: 25 },
  { title: "长安的荔枝", initials: "CADLZ", rank: 26 },
  { title: "哪吒之魔童闹海", initials: "NZZMTNH", rank: 27 },
  { title: "唐人街探案", initials: "TRJTA", rank: 28 },
  { title: "你好李焕英", initials: "NHLHY", rank: 29 },
  { title: "流浪地球", initials: "LLDQ", rank: 30 },
  { title: "复仇者联盟4", initials: "FQZLM4", rank: 31 },
  { title: "权力的游戏", initials: "QLDYX", rank: 32 },
  { title: "老友记", initials: "LYJ", rank: 33 },
  { title: "哈利波特", initials: "HLBT", rank: 34 },
  { title: "指环王", initials: "ZHW", rank: 35 },
  { title: "泰坦尼克号", initials: "TTNKH", rank: 36 },
  { title: "这个杀手不太冷", initials: "ZGSSBTL", rank: 37 },
  { title: "教父", initials: "JF", rank: 38 },
  { title: "楚门的世界", initials: "CMDSJ", rank: 39 },
  { title: "盗梦空间", initials: "DMKJ", rank: 40 },
  { title: "星际迷航", initials: "XJMH", rank: 41 },
  { title: "黑客帝国", initials: "HKDG", rank: 42 },
  { title: "龙猫", initials: "LM", rank: 43 },
  { title: "天空之城", initials: "TKZC", rank: 44 },
  { title: "疯狂动物城", initials: "FKDWC", rank: 45 },
  { title: "冰雪奇缘", initials: "BXQY", rank: 46 },
  { title: "狮子王", initials: "SZW", rank: 47 },
  { title: "寻梦环游记", initials: "XMHYJ", rank: 48 },
  { title: "大话西游", initials: "DHXY", rank: 49 },
  { title: "无间道", initials: "WJD", rank: 50 },
  { title: "卧虎藏龙", initials: "WHCL", rank: 51 },
  { title: "英雄", initials: "YX", rank: 52 },
  { title: "阳光灿烂的日子", initials: "YGCLDRZ", rank: 53 },
  { title: "让子弹飞", initials: "RZDF", rank: 54 },
  { title: "我不是药神", initials: "WBSYS", rank: 55 },
  { title: "无名之辈", initials: "WMZB", rank: 56 },
  { title: "人生大事", initials: "RSDS", rank: 57 },
  { title: "独行月球", initials: "DXYQ", rank: 58 },
  { title: "消失的她", initials: "XSDT", rank: 59 },
  { title: "第二十条", initials: "DEST", rank: 60 },
  { title: "热辣滚烫", initials: "RLGT", rank: 61 },
  { title: "飞驰人生2", initials: "FCRS2", rank: 62 },
  { title: "熊出没逆转时空", initials: "XCMNZSK", rank: 63 },
  { title: "长月烬明", initials: "CYJM", rank: 64 },
  { title: "与凤行", initials: "YFX", rank: 65 },
  { title: "永夜星河", initials: "YYXH", rank: 66 },
  { title: "小巷人家", initials: "XXRJ", rank: 67 },
  { title: "仙剑奇侠传", initials: "XJQXC", rank: 68 },
  { title: "士兵突击", initials: "SBTJ", rank: 69 },
  { title: "三生三世十里桃花", initials: "SSSSSLTH", rank: 70 },
  { title: "琅琊榜之风起长林", initials: "LYBZFQCL", rank: 71 },
];

/** A-Z 首字母索引（仅包含热搜数据里实际出现的字母） */
export const HOT_LETTERS: string[] = Array.from(
  new Set(HOT_SEARCH_ITEMS.map((item) => item.initials[0]).filter(Boolean)),
).sort();

/** 榜单前十，搜索页顶部重点展示 */
export const HOT_TOP_ITEMS: HotSearchItem[] = HOT_SEARCH_ITEMS.slice(0, 10);
