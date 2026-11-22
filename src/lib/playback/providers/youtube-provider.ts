/**
 * VYBE YouTube Playback Provider
 * Wraps YouTube IFrame API with singleton script loading, capability reporting,
 * and command-origin loop prevention.
 */

import { BasePlaybackProvider } from './base-provider';
import {
  CommandOrigin,
  PlaybackInitConfig,
  PlaybackProviderType,
  PlayerCapabilities,
} from '../types';
import { EventValidation } from '../sync/event-validation';

let youtubeScriptPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (youtubeScriptPromise) return youtubeScriptPromise;

  youtubeScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousReady) previousReady();
      resolve();
    };
    const checkInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);
  });

  return youtubeScriptPromise;
}

export class YouTubePlaybackProvider extends BasePlaybackProvider {
  public readonly providerType: PlaybackProviderType = 'youtube';

  private player: any = null;
  private timePollTimer: ReturnType<typeof setInterval> | null = null;
  private containerElement: HTMLElement | null = null;
  private isDestroyed = false;

  constructor() {
    super('youtube');
  }

  public getCapabilities(): PlayerCapabilities {
    return {
      canPlay: true,
      canPause: true,
      canSeek: true,
      canChangeRate: true,
      canSetVolume: true,
      supportsEmbeddedPlayback: true,
      supportsExternalPlayback: false,
      supportsSubtitles: true,
      supportsMobileControl: true,
    };
  }

  public async initialize(config: PlaybackInitConfig): Promise<void> {
    this.containerElement = config.container;
    this.state.mediaId = config.initialMediaId;
    this.state.title = config.initialTitle || 'YouTube Video';
    this.state.posterUrl =
      config.initialPosterUrl || `https://i.ytimg.com/vi/${config.initialMediaId}/hqdefault.jpg`;
    this.state.currentTime = config.initialTime || 0;
    this.state.isPlaying = Boolean(config.initialPlaying);

    await loadYouTubeIframeApi();
    if (this.isDestroyed || !this.containerElement) return;

    const mountEl = document.createElement('div');
    this.containerElement.innerHTML = '';
    this.containerElement.appendChild(mountEl);

    return new Promise((resolve) => {
      const YT = (window as any).YT;
      if (!YT || !YT.Player) {
        resolve();
        return;
      }
      this.player = new YT.Player(mountEl, {
        videoId: config.initialMediaId,
        playerVars: {
          autoplay: config.initialPlaying ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          start: Math.floor(config.initialTime || 0),
        },
        events: {
          onReady: (event: any) => {
            const dur = event.target.getDuration?.() || 0;
            const vol = event.target.getVolume?.() ?? 85;
            const muted = event.target.isMuted?.() ?? false;
            this.updateState({
              duration: dur,
              volume: vol,
              isMuted: muted,
            });
            this.startTimePolling();
            resolve();
          },
          onStateChange: (event: any) => {
            const stateCode = event.data;
            if (stateCode === 3) {
              // Buffering
              this.updateState({ isBuffering: true });
              this.emit({ type: 'BUFFERING_START' });
              return;
            }
            this.updateState({ isBuffering: false });
            this.emit({ type: 'BUFFERING_END' });

            if (stateCode === 0) {
              // Ended
              this.updateState({ isPlaying: false });
              this.emit({ type: 'MEDIA_ENDED' });
              return;
            }

            const isPlaying = stateCode === 1;
            const isPaused = stateCode === 2;

            if (isPlaying || isPaused) {
              const cur = event.target.getCurrentTime?.() || this.state.currentTime;
              const origin: CommandOrigin = EventValidation.isRemoteLockActive() ? 'remote' : 'user';
              this.updateState(
                {
                  isPlaying,
                  currentTime: cur,
                },
                origin
              );
            }
          },
          onError: (event: any) => {
            this.emit({
              type: 'ERROR',
              message: `YouTube Player Error code: ${event.data}`,
              fatal: false,
            });
          },
        },
      });
    });
  }

  public async play(origin: CommandOrigin = 'user'): Promise<void> {
    if (!this.player) return;
    if (origin === 'remote') {
      EventValidation.acquireRemoteLock(700);
    }
    try {
      this.player.playVideo();
      this.updateState({ isPlaying: true }, origin);
    } catch {
      // Ignore
    }
  }

  public async pause(origin: CommandOrigin = 'user'): Promise<void> {
    if (!this.player) return;
    if (origin === 'remote') {
      EventValidation.acquireRemoteLock(700);
    }
    try {
      this.player.pauseVideo();
      this.updateState({ isPlaying: false }, origin);
    } catch {
      // Ignore
    }
  }

  public async seek(time: number, origin: CommandOrigin = 'user'): Promise<void> {
    if (!this.player) return;
    if (origin === 'remote') {
      EventValidation.acquireRemoteLock(900);
    }
    try {
      this.player.seekTo(time, true);
      this.updateState({ currentTime: time, isSeeking: false }, origin);
    } catch {
      // Ignore
    }
  }

  public setPlaybackRate(rate: number): void {
    if (!this.player?.setPlaybackRate) return;
    try {
      this.player.setPlaybackRate(rate);
      this.updateState({ playbackRate: rate });
    } catch {
      // Ignore
    }
  }

  public setVolume(volume: number): void {
    if (!this.player?.setVolume) return;
    try {
      this.player.setVolume(volume);
      this.updateState({ volume, isMuted: volume === 0 });
    } catch {
      // Ignore
    }
  }

  public setMuted(muted: boolean): void {
    if (!this.player) return;
    try {
      if (muted) this.player.mute?.();
      else this.player.unMute?.();
      this.updateState({ isMuted: muted });
    } catch {
      // Ignore
    }
  }

  public async loadMedia(
    mediaId: string,
    title: string,
    posterUrl?: string,
    startTime = 0
  ): Promise<void> {
    this.state.mediaId = mediaId;
    this.state.title = title;
    this.state.posterUrl = posterUrl || `https://i.ytimg.com/vi/${mediaId}/hqdefault.jpg`;
    this.state.currentTime = startTime;

    if (this.player?.loadVideoById) {
      EventValidation.acquireRemoteLock(1200);
      this.player.loadVideoById(mediaId, Math.floor(startTime));
      this.updateState({ isPlaying: true, currentTime: startTime });
    }
  }

  private startTimePolling() {
    if (this.timePollTimer) clearInterval(this.timePollTimer);
    this.timePollTimer = setInterval(() => {
      if (!this.player?.getCurrentTime || this.isDestroyed) return;
      try {
        const cur = this.player.getCurrentTime() || 0;
        const dur = this.player.getDuration?.() || this.state.duration;
        this.state.currentTime = cur;
        if (dur > 0 && dur !== this.state.duration) {
          this.state.duration = dur;
        }
        this.emit({ type: 'TIME_UPDATE', currentTime: cur, duration: this.state.duration });
      } catch {
        // Ignore
      }
    }, 450);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.timePollTimer) {
      clearInterval(this.timePollTimer);
      this.timePollTimer = null;
    }
    if (this.player && typeof this.player.destroy === 'function') {
      try {
        this.player.destroy();
      } catch {
        // Ignore
      }
      this.player = null;
    }
    if (this.containerElement) {
      this.containerElement.innerHTML = '';
      this.containerElement = null;
    }
    this.subscribers.clear();
  }
}
