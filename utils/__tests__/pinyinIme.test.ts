import {
  EMPTY_IME,
  clearIme,
  commitComposition,
  deleteLastCodePoint,
  getCandidates,
  lexiconStats,
  pushLetter,
  backspaceIme,
  selectCandidate,
} from "@/utils/pinyinIme";

describe("屏幕键盘中文拼音输入", () => {
  it("词库包含足够的词组与音节", () => {
    const stats = lexiconStats();
    expect(stats.words).toBeGreaterThanOrEqual(40);
    expect(stats.syllables).toBeGreaterThanOrEqual(100);
  });

  it("全拼与首字母都能召回中文片名", () => {
    expect(getCandidates("qing")).toContain("庆余年");
    expect(getCandidates("qing")).toContain("庆");
    expect(getCandidates("qyn")).toContain("庆余年");
    expect(getCandidates("")).toEqual([]);
  });

  it("中文模式累积组合串，英文模式直接返回空组合", () => {
    let state = EMPTY_IME;
    for (const letter of "qing") state = pushLetter(state, letter, true);
    expect(state.composing).toBe("qing");
    expect(state.candidates.length).toBeGreaterThan(0);
    expect(pushLetter(EMPTY_IME, "q", false)).toEqual(EMPTY_IME);
  });

  it("删除键先退拼音，组合清空后才删正文", () => {
    let state = EMPTY_IME;
    for (const letter of "qing") state = pushLetter(state, letter, true);
    const first = backspaceIme(state);
    expect(first.state.composing).toBe("qin");
    expect(first.removeText).toBe(false);
    for (let i = 0; i < 4; i += 1) state = backspaceIme(state).state;
    expect(state.composing).toBe("");
    expect(backspaceIme(state).removeText).toBe(true);
  });

  it("按码点删除中文与 emoji，不产生半个字符", () => {
    expect(deleteLastCodePoint("庆余年")).toBe("庆余");
    expect(deleteLastCodePoint("a😀")).toBe("a");
    expect(deleteLastCodePoint("")).toBe("");
  });

  it("选中候选 / 提交英文 / 清空都复位组合串", () => {
    const state = pushLetter(pushLetter(EMPTY_IME, "q", true), "y", true);
    expect(selectCandidate(state, 0).state.composing).toBe("");
    expect(commitComposition(state).text).toBe("QY");
    expect(clearIme()).toEqual(EMPTY_IME);
  });
});
