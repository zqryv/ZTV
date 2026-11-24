/**
 * 播放生命周期回归测试（对应「退出后仍继续后台播放」）。
 * 参考 react-native-track-player 的 stopWithApp 语义：
 * 停止必须卸载 Sound、复位音频模式，并使进行中的异步加载失效。
 */
import { AppState } from "react-native";
import { Audio } from "expo-av";

jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn(async () => undefined),
    Sound: { createAsync: jest.fn() },
  },
}));

import { audioPlayer, INITIAL_AUDIO_STATE } from "@/services/audioPlayer";

const makeSound = () => ({
  getStatusAsync: jest.fn(async () => ({ isLoaded: true })),
  setOnPlaybackStatusUpdate: jest.fn(),
  playAsync: jest.fn(async () => undefined),
  pauseAsync: jest.fn(async () => undefined),
  stopAsync: jest.fn(async () => undefined),
  unloadAsync: jest.fn(async () => undefined),
  setPositionAsync: jest.fn(async () => undefined),
  setVolumeAsync: jest.fn(async () => undefined),
});

describe("audioPlayer 生命周期", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await audioPlayer.unload();
  });

  afterEach(async () => {
    await audioPlayer.unload();
    audioPlayer.detachAppStateLifecycle();
  });

  it("播放时禁用后台驻留（staysActiveInBackground=false）", async () => {
    const sound = makeSound();
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound });

    const ok = await audioPlayer.play("https://example.test/a.mp3");
    expect(ok).toBe(true);
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ staysActiveInBackground: false })
    );
    expect(sound.playAsync).toHaveBeenCalled();
  });

  it("停止会 stop + unload 并复位音频会话", async () => {
    const sound = makeSound();
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound });
    await audioPlayer.play("https://example.test/a.mp3");

    const states: any[] = [];
    audioPlayer.setListener((s) => states.push(s));
    await audioPlayer.stop();

    expect(sound.setOnPlaybackStatusUpdate).toHaveBeenCalledWith(null);
    expect(sound.stopAsync).toHaveBeenCalled();
    expect(sound.unloadAsync).toHaveBeenCalled();
    expect(audioPlayer.hasActiveSound()).toBe(false);
    expect(states[states.length - 1]).toEqual(INITIAL_AUDIO_STATE);
    expect(Audio.setAudioModeAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ staysActiveInBackground: false })
    );
    audioPlayer.setListener(null);
  });

  it("退出后迟到的异步加载结果不会再开始播放", async () => {
    const gate: { resolve?: (v: any) => void; started?: () => void } = {};
    const started = new Promise<void>((resolve) => { gate.started = resolve; });
    const sound = makeSound();
    (Audio.Sound.createAsync as jest.Mock).mockImplementation(() => {
      gate.started?.();
      return new Promise((resolve) => { gate.resolve = resolve; });
    });

    const pending = audioPlayer.play("https://example.test/slow.mp3");
    // 确保异步加载已经发起，再模拟用户退出 / 切换页面
    await started;
    expect(gate.resolve).toBeDefined();
    await audioPlayer.unload();
    gate.resolve?.({ sound });
    await pending;

    expect(sound.playAsync).not.toHaveBeenCalled();
    expect(sound.unloadAsync).toHaveBeenCalled();
    expect(audioPlayer.hasActiveSound()).toBe(false);
  });

  it("主地址失败时自动尝试备用地址", async () => {
    const good = makeSound();
    (Audio.Sound.createAsync as jest.Mock)
      .mockRejectedValueOnce(new Error("主源不可达"))
      .mockResolvedValueOnce({ sound: good });

    const ok = await audioPlayer.play("https://bad.test/a.mp3", ["https://good.test/a.mp3"]);
    expect(ok).toBe(true);
    expect((Audio.Sound.createAsync as jest.Mock).mock.calls.length).toBe(2);
  });

  it("应用进入后台时自动停止播放", async () => {
    const sound = makeSound();
    (Audio.Sound.createAsync as jest.Mock).mockResolvedValue({ sound });
    await audioPlayer.play("https://example.test/a.mp3");

    const gate: { handler?: (state: string) => void } = {};
    const spy = jest.spyOn(AppState, "addEventListener").mockImplementation(((_event: any, cb: any) => {
      gate.handler = cb;
      return { remove: jest.fn() } as any;
    }) as any);

    audioPlayer.attachAppStateLifecycle();
    gate.handler?.("background");
    // 给异步 unload 一个微任务周期
    await Promise.resolve();
    await Promise.resolve();

    expect(sound.stopAsync).toHaveBeenCalled();
    expect(audioPlayer.hasActiveSound()).toBe(false);
    spy.mockRestore();
  });
});
