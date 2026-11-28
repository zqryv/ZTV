/**
 * 统一音频播放服务（基于项目已有的 expo-av）。
 *
 * 供「音乐在线」与「收音机」共用，避免两个页面各自维护一套 Sound 实例。
 *
 * 参考成熟开源项目的播放生命周期做法：
 * - react-native-track-player：stopWithApp / StopPlaybackAndRemoveNotification，
 *   应用退出时显式 stop 并移除播放会话，而不是依赖系统杀进程；
 * - MusicFree / any-listen：音源失败时自动切换到备用地址；
 * - React Navigation：页面失焦（blur）时释放资源，而不是只依赖组件卸载。
 *
 * 本服务落实为四层保障：
 * 1) setAudioModeAsync({ staysActiveInBackground: false })，禁止后台续播；
 * 2) AppState 进入 background / inactive 时立即 unload（根布局挂载一次）；
 * 3) 页面 useFocusEffect blur / unmount 时 unload（Stack 中失焦不会卸载组件）；
 * 4) playToken 令牌，避免「退出后异步加载完成又重新开始播放」的竞态。
 *
 * 另外：加载带 12s 超时 + 多地址依次回退；不再透传自定义 User-Agent，
 * 避免 Web 端因非法请求头触发 CORS 预检失败导致整个音频无法加载。
 */
import { AppState } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import Logger from "@/utils/Logger";

const logger = Logger.withTag("AudioPlayer");

/** 单个音源的最长加载时间，超时自动尝试下一个地址 */
const LOAD_TIMEOUT_MS = 12000;

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
  private state: AudioPlaybackState = { ...INITIAL_AUDIO_STATE };
  /** 每次 play / unload 都自增；异步加载完成后校验，防止迟到的音频重新响起 */
  private playToken = 0;
  private appStateSubscription: { remove: () => void } | null = null;

  /** 注册状态回调（页面获得焦点时调用） */
  setListener(listener: StatusListener | null) {
    this.listener = listener;
    if (listener) listener({ ...this.state });
  }

  /** 合并式状态推送，避免 pause/stop 时把进度、时长清零 */
  private emit(patch: Partial<AudioPlaybackState>) {
    this.state = { ...this.state, ...patch };
    this.listener?.({ ...this.state });
  }

  private reset() {
    this.state = { ...INITIAL_AUDIO_STATE };
    this.listener?.({ ...this.state });
  }

  private onStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ("error" in status && status.error) {
        this.emit({ error: `播放失败：${status.error}`, isLoading: false, isPlaying: false });
      }
      return;
    }
    this.emit({
      isPlaying: status.isPlaying,
      isLoading: false,
      positionMs: status.positionMillis || 0,
      durationMs: status.durationMillis || 0,
      didFinish: Boolean(status.didJustFinish) && !status.isLooping,
      error: null,
    });
  };

  /** 卸载单个 Sound 实例并解绑回调，确保原生播放器资源被释放 */
  private async disposeSound(sound: Audio.Sound): Promise<void> {
    try {
      sound.setOnPlaybackStatusUpdate(null);
    } catch { /* ignore */ }
    try {
      await sound.stopAsync();
    } catch { /* 已停止或未加载时忽略 */ }
    try {
      await sound.unloadAsync();
    } catch { /* ignore */ }
  }

  /** 释放当前实例（不改变 playToken，供 play 内部复用） */
  private async releaseSound(): Promise<void> {
    const sound = this.sound;
    this.sound = null;
    this.currentUrl = null;
    if (sound) await this.disposeSound(sound);
  }

  /** 应用音频模式：前台播放、不驻留后台 */
  private async applyForegroundAudioMode(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
    } catch {
      // Web 端为 no-op，部分平台也不支持；静默降级
    }
  }

  /** 释放音频会话：把后台标志与打断行为一并复位 */
  private async releaseAudioMode(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
    } catch { /* ignore */ }
  }

  /**
   * 尝试加载并播放单个地址。
   * createAsync 对不可达流可能长时间不返回，因此用 Promise.race 加超时；
   * 超时后延迟解析出的 Sound 仍会被卸载，杜绝「退出后又响起来」。
   */
  private async loadOne(url: string, token: number): Promise<boolean> {
    const loadPromise = Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: false, progressUpdateIntervalMillis: 500 },
      null
    ).then((result) => result.sound);

    let timedOut = false;
    const timeoutPromise = new Promise<"timeout">((resolve) => {
      const timer = setTimeout(() => {
        timedOut = true;
        resolve("timeout");
      }, LOAD_TIMEOUT_MS);
      // 加载成功或失败都清掉计时器；用双回调而非 finally，避免产生未处理的拒绝
      void loadPromise.then(
        () => clearTimeout(timer),
        () => clearTimeout(timer)
      );
    });

    const result = await Promise.race([loadPromise, timeoutPromise]).catch((e) => {
      logger.info("Audio load rejected:", e?.message ?? e);
      return null;
    });

    if (result === "timeout") {
      // 迟到的实例必须卸载，否则会继续占用解码器甚至开始播放
      void loadPromise
        .then((s) => this.disposeSound(s))
        .catch(() => undefined);
      return false;
    }
    if (!result || typeof result === "string") return false;
    if (timedOut || token !== this.playToken) {
      await this.disposeSound(result as Audio.Sound);
      return false;
    }

    const sound = result as Audio.Sound;
    try {
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        await this.disposeSound(sound);
        return false;
      }
      sound.setOnPlaybackStatusUpdate(this.onStatus);
      await sound.playAsync();
      if (token !== this.playToken) {
        await this.disposeSound(sound);
        return false;
      }
      this.sound = sound;
      this.currentUrl = url;
      return true;
    } catch (e: any) {
      logger.info("Audio start failed:", e?.message ?? e);
      await this.disposeSound(sound);
      return false;
    }
  }

  /**
   * 加载并播放指定音频地址，失败时依次尝试 fallbackUrls。
   * @returns 是否成功开始播放
   */
  async play(url: string, fallbackUrls: string[] = []): Promise<boolean> {
    const token = ++this.playToken;
    await this.releaseSound();

    /**
     * v2.5.0：除网络流外，还接受离线缓存的 file:// / 本地路径 / Web blob: 地址，
     * 让收音机断网时可以直接播放已缓存节目。
     */
    const isPlayableUri = (uri: string): boolean =>
      /^https?:\/\//i.test(uri) ||
      /^file:\/\//i.test(uri) ||
      /^blob:/i.test(uri) ||
      /^\/[^/]/.test(uri);
    const candidates = Array.from(
      new Set([url, ...fallbackUrls].filter((u) => !!u && isPlayableUri(u)))
    );
    if (candidates.length === 0) {
      this.emit({ error: "音频地址无效，需为网络流或本地缓存文件", isLoading: false, isPlaying: false });
      return false;
    }

    this.emit({ isLoading: true, error: null, isPlaying: false, positionMs: 0, durationMs: 0 });
    await this.applyForegroundAudioMode();

    for (const candidate of candidates) {
      // 用户已退出 / 切歌，立即中止后续尝试
      if (token !== this.playToken) return false;
      const ok = await this.loadOne(candidate, token);
      if (ok) {
        if (token !== this.playToken) {
          await this.releaseSound();
          return false;
        }
        this.emit({ isLoading: false, isPlaying: true, error: null });
        return true;
      }
    }

    if (token === this.playToken) {
      this.emit({
        error: "无法连接该音频源，已尝试全部备用地址，请换一首或稍后重试",
        isLoading: false,
        isPlaying: false,
      });
    }
    return false;
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

  /**
   * 停止播放并彻底释放资源。页面失焦、应用退后台、点击停止都会调用。
   * 自增 playToken 使任何进行中的异步加载立即失效。
   */
  async unload(): Promise<void> {
    this.playToken += 1;
    await this.releaseSound();
    this.reset();
    await this.releaseAudioMode();
  }

  /** 语义别名：与 react-native-track-player 的 stop() 对齐，便于页面表达「停止」 */
  async stop(): Promise<void> {
    await this.unload();
  }

  /** 是否仍持有可播放实例 */
  hasActiveSound(): boolean {
    return this.sound !== null;
  }

  getCurrentUrl(): string | null {
    return this.currentUrl;
  }

  /**
   * 全局应用状态监听（在根布局调用一次）。
   * 进入后台 / 失活 / 退出时立即停止，无需用户强制终止程序。
   */
  attachAppStateLifecycle(): void {
    if (this.appStateSubscription) return;
    this.appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "background" || nextState === "inactive") {
        logger.info(`App state -> ${nextState}, stopping audio`);
        void this.unload();
      }
    });
  }

  detachAppStateLifecycle(): void {
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }
}

export const audioPlayer = new AudioPlayerService();
