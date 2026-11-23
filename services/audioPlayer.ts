/**
 * 统一音频播放服务（基于项目已有的 expo-av）。
 *
 * 供「音乐播放」与「收音机」共用，避免两个页面各自维护一套 Sound 实例。
 * - 使用 Audio.Sound.createAsync 加载网络音频流
 * - 通过 onPlaybackStatusUpdate 回调把进度 / 时长 / 播放态推给上层
 * - 所有操作都做了异常保护：网络流不可达时不会导致应用崩溃
 */
import { Audio, AVPlaybackStatus } from "expo-av";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("AudioPlayer");

export interface AudioPlaybackState {
  isPlaying: boolean;
  isLoading: boolean;
  positionMs: number;
  durationMs: number;
  didFinish: boolean;
  error: string | null;
}

export const INITIAL_AUDIO_STATE: AudioPlaybackState = {
  isPlaying: false,
  isLoading: false,
  positionMs: 0,
  durationMs: 0,
  didFinish: false,
  error: null,
};

type StatusListener = (state: AudioPlaybackState) => void;

class AudioPlayerService {
  private sound: Audio.Sound | null = null;
  private listener: StatusListener | null = null;
  private currentUrl: string | null = null;

  /** 注册状态回调（页面挂载时调用） */
  setListener(listener: StatusListener | null) {
    this.listener = listener;
  }

  private emit(patch: Partial<AudioPlaybackState>) {
    this.listener?.({ ...INITIAL_AUDIO_STATE, ...patch });
  }

  private onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ("error" in status && status.error) {
        this.emit({ error: `播放失败：${status.error}`, isLoading: false, isPlaying: false });
      }
      return;
    }
    const base: AudioPlaybackState = {
      isPlaying: status.isPlaying,
      isLoading: false,
      positionMs: status.positionMillis || 0,
      durationMs: status.durationMillis || 0,
      didFinish: status.didJustFinish && !status.isLooping,
      error: null,
    };
    this.emit(base);
  };

  /** 加载并播放指定音频地址；会先卸载上一条 */
  async play(url: string): Promise<boolean> {
    if (!url || !/^https?:\/\//i.test(url)) {
      this.emit({ error: "音频地址无效，需以 http(s):// 开头" });
      return false;
    }
    await this.unload();
    this.currentUrl = url;
    this.emit({ isLoading: true, error: null, isPlaying: false, positionMs: 0, durationMs: 0 });
    try {
      // Web 端 setAudioModeAsync 属于 no-op，但部分平台会抛错，做静默保护
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
      } catch {
        /* 平台不支持音频模式设置时忽略 */
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: url, headers: { "User-Agent": "ZTV/1.0" } },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        this.onStatus
      );
      this.sound = sound;
      return true;
    } catch (e: any) {
      logger.info("Audio load failed:", e?.message ?? e);
      this.emit({ error: "无法连接该音频源，请检查网络或更换地址", isLoading: false });
      return false;
    }
  }

  /** 播放 / 暂停切换 */
  async toggle(): Promise<void> {
    if (!this.sound) return;
    try {
      const status = await this.sound.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await this.sound.pauseAsync();
        this.emit({ isPlaying: false });
      } else {
        if (status.didJustFinish) await this.sound.setPositionAsync(0);
        await this.sound.playAsync();
        this.emit({ isPlaying: true });
      }
    } catch (e: any) {
      logger.info("Audio toggle failed:", e?.message ?? e);
    }
  }

  async pause(): Promise<void> {
    try {
      await this.sound?.pauseAsync();
      this.emit({ isPlaying: false });
    } catch { /* ignore */ }
  }

  async seekTo(positionMs: number): Promise<void> {
    try {
      await this.sound?.setPositionAsync(Math.max(0, positionMs));
      this.emit({ positionMs: Math.max(0, positionMs) });
    } catch { /* ignore */ }
  }

  async setVolume(volume: number): Promise<void> {
    try {
      await this.sound?.setVolumeAsync(Math.min(1, Math.max(0, volume)));
    } catch { /* ignore */ }
  }

  /** 卸载当前音频（页面离开 / 切换曲目时调用） */
  async unload(): Promise<void> {
    const sound = this.sound;
    this.sound = null;
    this.currentUrl = null;
    if (!sound) return;
    try {
      sound.setOnPlaybackStatusUpdate(null);
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch { /* ignore */ }
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }
}

export const audioPlayer = new AudioPlayerService();
