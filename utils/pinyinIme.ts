/**
 * 屏幕键盘中文拼音输入引擎（v2.5.0，零依赖纯计算）。
 *
 * 旧键盘只有 A-Z 与数字，遥控器 / 大屏用户根本无法输入中文，只能点热词。
 * 本引擎提供：
 *  - 组合串（composing）：连续字母先进入拼音缓冲区，不直接写进搜索框；
 *  - 候选：全拼前缀、首字母缩写、单字音节三路召回，输出中文候选；
 *  - 选中候选：把中文词提交到输入框并清空组合串；
 *  - 删除：先退组合串最后一个字母，组合串为空才删输入框最后一个「码点」；
 *  - 清空 / 提交英文：语义完整，可回退到纯字母输入。
 *
 * 纯函数实现，不 import react-native，可被 Node 校验脚本与 Jest 直接加载。
 */

export interface ImeState {
  /** 正在组合的拼音串（小写） */
  composing: string;
  /** 当前候选（中文词或单字） */
  candidates: string[];
}

export const EMPTY_IME: ImeState = { composing: "", candidates: [] };

/** 词组词典：[中文词, 全拼, 首字母] —— 覆盖影视 / 音乐 / 应用内常用词 */
const PINYIN_WORDS: Array<[string, string, string]> = [
  ["庆余年", "qingyunian", "QYN"],
  ["流浪地球", "liulangdiqiu", "LLDQ"],
  ["三体", "santi", "ST"],
  ["繁花", "fanhua", "FH"],
  ["狂飙", "kuangbiao", "KB"],
  ["漫长的季节", "manchangdejijie", "MCDJJ"],
  ["长安十二时辰", "changanshiershichen", "CASESC"],
  ["隐秘的角落", "yimidejiaoluo", "YMDJL"],
  ["周处除三害", "zhouchuchusanhai", "ZCCSH"],
  ["繁花似锦", "fanhuasijin", "FHSJ"],
  ["周杰伦", "zhoujielun", "ZJL"],
  ["邓紫棋", "dengziqi", "DZQ"],
  ["陈奕迅", "chenyixun", "CYX"],
  ["Taylor Swift", "taylorswift", "TS"],
  ["华语", "huayu", "HY"],
  ["流行", "liuxing", "LX"],
  ["古典", "gudian", "GD"],
  ["爵士", "jueshi", "JS"],
  ["轻音乐", "qingyinyue", "QYY"],
  ["电子", "dianzi", "DZ"],
  ["音乐在线", "yinyuezaixian", "YYZX"],
  ["收音机", "shouyinji", "SYJ"],
  ["搜索", "sousuo", "SS"],
  ["电视", "dianshi", "DS"],
  ["电影", "dianying", "DY"],
  ["直播", "zhibo", "ZB"],
  ["离线", "lixian", "LX"],
  ["缓存", "huancun", "HC"],
  ["更新", "gengxin", "GX"],
  ["设置", "shezhi", "SZ"],
  ["收藏", "shoucang", "SC"],
  ["中国大陆", "zhongguodalu", "ZGDL"],
  ["中国台湾", "zhongguotaiwan", "ZGTW"],
  ["美国", "meiguo", "MG"],
  ["日本", "riben", "RB"],
  ["欧洲", "ouzhou", "OZ"],
  ["韩国", "hanguo", "HG"],
  ["热搜", "resou", "RS"],
  ["榜单", "bangdan", "BD"],
  ["猜你想搜", "cainixiangsou", "CNXS"],
  ["屏幕键盘", "pingmujianpan", "PMJP"],
  ["拼音", "pinyin", "PY"],
  ["中文", "zhongwen", "ZW"],
  ["删除", "shanchu", "SC"],
  ["清空", "qingkong", "QK"],
  ["返回", "fanhui", "FH"],
  ["播放", "bofang", "BF"],
  ["暂停", "zanting", "ZT"],
  ["音量", "yinliang", "YL"],
  ["电台", "diantai", "DT"],
  ["新闻", "xinwen", "XW"],
  ["文化", "wenhua", "WH"],
  ["天气", "tianqi", "TQ"],
];

/** 常用音节 → 候选单字。覆盖大屏键盘最常敲的拼音，词组未命中时仍可逐字输入 */
const SYLLABLE_CHARS: Record<string, string> = {
  ai: "爱唉矮碍哀", an: "安按暗岸案", ba: "把八吧爸巴", bai: "白百摆败",
  ban: "半办班般板", bei: "北备背杯倍", ben: "本笨奔", bi: "比笔必币碧",
  bian: "边变便遍编", bu: "不布步部补", cai: "才采彩菜材", cao: "草操曹",
  cha: "查茶察差", chang: "长常场唱尝", chen: "陈晨沉称臣", cheng: "成城程承诚",
  chi: "吃迟持池赤", chu: "出初除楚处", chuan: "传船穿串川", da: "大达打答",
  dai: "代带待戴袋", dan: "但单淡丹担", dao: "到道倒岛导", de: "的得德",
  deng: "等灯登邓", di: "地第低底敌", dian: "点电典店殿", dong: "东动懂冬洞",
  du: "都度读独渡", duo: "多朵躲夺", er: "而儿耳二尔", fa: "发法罚乏",
  fan: "反返范犯饭", fang: "方房防访放", fei: "飞非肥费废", fen: "分粉份奋纷",
  feng: "风封丰疯逢", fu: "服浮福复付", gao: "高告稿搞糕", ge: "哥歌格个各",
  geng: "更耕耿", gong: "工公共供功", gu: "古故鼓骨谷", guan: "关观官管馆",
  guang: "光广逛", guo: "国果过锅郭", hai: "海还害孩亥", han: "汉寒含喊汗",
  hao: "好号浩毫豪", he: "和何合河喝", hei: "黑嘿", hou: "后厚候猴",
  hu: "湖胡虎护呼", hua: "花话华化画", huan: "欢环换还缓", huang: "黄皇荒晃",
  hui: "回会灰挥惠", huo: "火或活获货", ji: "几机鸡极记", jia: "家加假价架",
  jian: "间见建件健", jiang: "江将讲奖蒋", jiao: "叫教交角脚", jie: "接街节结姐",
  jin: "今金近进尽", jing: "京经静境敬", jiu: "九就旧酒久", ju: "举句局据剧",
  kai: "开凯慨", kan: "看砍刊堪", ke: "可克刻客课", kong: "空孔控恐",
  lai: "来赖", lao: "老劳牢姥", le: "乐了勒", lei: "雷类累泪",
  li: "里理李力立", lian: "连脸练联恋", liang: "两亮量凉梁", lin: "林临邻淋",
  ling: "灵零领另令", liu: "刘流六留柳", long: "龙隆笼聋", lou: "楼搂漏娄", lu: "路露鹿录陆",
  ma: "妈马吗码骂", mai: "买麦卖迈", man: "满慢漫曼", mao: "毛猫冒帽貌",
  mei: "美每没妹眉", men: "门们闷", meng: "梦猛蒙盟", mi: "米密迷蜜秘",
  mian: "面免眠绵", min: "民敏闽", ming: "明名命鸣铭", mo: "摸莫墨默模",
  mu: "木母目幕慕", na: "拿哪那纳", nan: "男南难喃", nao: "脑闹恼",
  nei: "内", neng: "能", ni: "你尼泥拟", nian: "年念娘",
  ning: "宁凝", niu: "牛扭纽", nong: "农弄浓", nv: "女",
  ou: "欧偶呕", pai: "拍排派牌", pan: "盘判盼叛", pei: "培陪配佩",
  peng: "朋鹏碰澎", pi: "皮匹疲劈啤", pian: "片偏骗篇", pin: "品拼频贫",
  ping: "平评瓶屏凭", pu: "普铺朴谱", qi: "七期齐起气", qian: "千前钱强浅",
  qiang: "强墙抢枪", qiao: "桥巧敲悄乔", qie: "切且窃", qin: "亲秦琴勤侵",
  qing: "庆清情青轻请晴倾卿", qiu: "秋求球囚丘", qu: "去区曲取趣",
  quan: "全权劝泉圈", que: "却确缺雀", qun: "群裙",
  rang: "让壤", re: "热惹", ren: "人仁任认忍", ri: "日",
  rong: "容荣融绒", ru: "如入儒乳", san: "三散伞", se: "色涩",
  sha: "沙杀傻啥纱", shan: "山善闪陕扇", shang: "上商赏尚伤", shao: "少烧稍绍",
  she: "设社舍射涉", shen: "深身神甚审", sheng: "生声升胜圣", shi: "时石识使世事",
  shou: "手首收受守", shu: "书数树双输", shui: "水说税睡", si: "四死思私司丝",
  song: "送松耸宋颂", su: "苏素速诉俗", sui: "虽随岁碎", suo: "所锁索缩",
  ta: "他她它塔踏", tai: "台太抬态泰", tan: "谈汤摊探叹", tang: "唐糖堂躺汤",
  tao: "桃逃淘陶套", te: "特", ti: "提题体踢替", tian: "天田甜填添",
  tiao: "条跳挑调", ting: "听厅停挺庭", tong: "通同童统痛", tou: "头投透偷",
  tu: "图土突徒涂", tuan: "团湍", tui: "推腿退褪", wan: "玩完晚万弯", wang: "王网往望忘",
  wei: "为围唯维伟尾", wen: "温文闻问稳", wo: "我握窝沃", wu: "无五武舞物",
  xi: "西希息洗喜", xia: "下夏吓虾霞", xian: "先现线仙鲜", xiang: "想向像相香",
  xiao: "小笑校晓消", xie: "些写谢鞋协", xin: "心新信辛欣", xing: "星行醒姓幸",
  xiong: "兄雄熊胸", xiu: "休修秀袖", xu: "需须许续序", xuan: "选宣悬旋",
  xue: "学雪血穴", xun: "寻讯训迅", ya: "呀牙亚压鸭", yan: "言严眼演烟",
  yang: "阳样养洋仰", yao: "要摇药遥妖", ye: "也页夜叶爷", yi: "一衣依已以义",
  yin: "因音银影饮", ying: "应英迎影硬", yong: "永用勇拥涌", you: "由有又优游",
  yu: "于鱼与雨语玉", yuan: "元原远院园", yue: "月约越乐阅", yun: "云运韵晕",
  zai: "在再载灾", zao: "早造遭糟澡", ze: "责择则泽", zhan: "站占战展沾",
  zhang: "张章掌涨丈", zhao: "找照招赵朝", zhe: "者这着折哲", zhen: "真镇震针珍",
  zheng: "正政整争证", zhi: "知织直值只纸志", zhong: "中钟终种重众",
  zhou: "周州洲舟宙", zhu: "朱猪逐竹主住", zhuan: "专转砖传", zhuang: "庄装壮状",
  zi: "子自字紫资", zong: "总纵宗综", zu: "足族祖组阻", zui: "最罪醉嘴",
  zuo: "做作坐座左",
};

const uniq = (items: string[], limit: number): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
};

/** 按组合串召回中文候选：全拼前缀 → 首字母 → 单字 */
export const getCandidates = (composing: string, limit = 8): string[] => {
  const raw = (composing || "").trim().toLowerCase();
  if (!raw || !/^[a-z]+$/.test(raw)) return [];
  const upper = raw.toUpperCase();
  const words = PINYIN_WORDS
    .filter(([, pinyin, initials]) => pinyin.startsWith(raw) || initials.startsWith(upper))
    .map(([word]) => word);
  const chars = SYLLABLE_CHARS[raw] ? Array.from(SYLLABLE_CHARS[raw]) : [];
  // 多字拼音也给出「首字」建议，避免长拼音时无候选
  const firstChars = raw.length >= 3
    ? Object.keys(SYLLABLE_CHARS)
        .filter((syllable) => raw.startsWith(syllable) && syllable.length >= 2)
        .sort((a, b) => b.length - a.length)
        .slice(0, 2)
        .flatMap((syllable) => Array.from(SYLLABLE_CHARS[syllable]).slice(0, 3))
    : [];
  return uniq([...words, ...chars, ...firstChars], limit);
};

/** 输入一个字母：中文模式进组合串并刷新候选；英文模式返回空组合由调用方直接拼文本 */
export const pushLetter = (
  state: ImeState,
  letter: string,
  imeEnabled: boolean,
  limit = 8,
): ImeState => {
  if (!/^[a-zA-Z0-9]$/.test(letter)) return state;
  if (!imeEnabled) return EMPTY_IME;
  const composing = `${state.composing}${letter.toLowerCase()}`.slice(0, 24);
  return { composing, candidates: getCandidates(composing, limit) };
};

/**
 * 删除键：优先退组合串最后一个字母；组合串为空时要求调用方删输入框最后一个码点。
 * @returns removeText=true 表示组合串已空，需要删正文
 */
export const backspaceIme = (state: ImeState, limit = 8): { state: ImeState; removeText: boolean } => {
  if (!state.composing) return { state: EMPTY_IME, removeText: true };
  const composing = state.composing.slice(0, -1);
  return {
    state: composing ? { composing, candidates: getCandidates(composing, limit) } : EMPTY_IME,
    removeText: false,
  };
};

/** 按码点删除正文最后一个字符，正确处理中文 / emoji / 组合字符 */
export const deleteLastCodePoint = (text: string): string => {
  const points = Array.from(text);
  points.pop();
  return points.join("");
};

/** 选中候选：返回要追加到输入框的中文，同时清空组合串 */
export const selectCandidate = (state: ImeState, index: number): { state: ImeState; text: string } => {
  const text = state.candidates[index] || "";
  return { state: EMPTY_IME, text };
};

/** 把组合串作为普通英文字母提交（「说英文 / 放弃候选」） */
export const commitComposition = (state: ImeState): { state: ImeState; text: string } => ({
  state: EMPTY_IME,
  text: state.composing ? state.composing.toUpperCase() : "",
});

export const clearIme = (): ImeState => EMPTY_IME;

/** 供测试 / 校验脚本使用的词库规模 */
export const lexiconStats = () => ({
  words: PINYIN_WORDS.length,
  syllables: Object.keys(SYLLABLE_CHARS).length,
});
