/**
 * VYBE Local & Personal Media Playback Provider
 * Wraps HTML5 <video> for playing downloaded .mp4/.mkv/.webm files and direct stream URLs.
 */

import { BasePlaybackProvider } from './base-provider';
import {
  CommandOrigin,
  PlaybackInitConfig,
  PlaybackProviderType,
  PlayerCapabilities,
} from '../types';
import { EventValidation } from '../sync/event-validation';

export class LocalMediaPlaybackProvider extends BasePlaybackProvider {
  public readonly providerType: PlaybackProviderType = 'local_media';

  private videoElement: HTMLVideoElement | null = null;
  private containerElement: HTMLElement | null = null;
  private activeObjectUrl: string | null = null;
  private isDestroyed = false;

  constructor() {
    super('local_media');
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
    this.state.title = config.initialTitle || 'Personal Video';
    this.state.posterUrl = config.initialPosterUrl;
    this.state.currentTime = config.initialTime || 0;
    this.state.isPlaying = Boolean(config.initialPlaying);

    this.containerElement.innerHTML = '';
    const video = document.createElement('video');
    video.controls = false;
    video.playsInline = true;
    video.preload = 'auto';
    video.className = 'w-full h-full object-contain bg-black';

    if (config.localFile) {
      this.activeObjectUrl = URL.createObjectURL(config.localFile);
      video.src = this.activeObjectUrl;
    } else if (config.customStreamUrl) {
      video.src = config.customStreamUrl;
    } else {
      video.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
    }

    if (config.isMuted) {
      video.muted = true;
      this.state.isMuted = true;
    }

    this.attachEventListeners(video);
    this.videoElement = video;
    this.containerElement.appendChild(video);

    if (config.initialTime && config.initialTime > 0) {
      video.currentTime = config.initialTime;
    }
    if (config.initialPlaying) {
      video.play().catch(() => {});
    }
  }

  private attachEventListeners(video: HTMLVideoElement) {
    video.addEventListener('loadedmetadata', () => {
      if (this.isDestroyed) return;
      this.updateState({
        duration: video.duration || 0,
        volume: Math.round(video.volume * 100),
        isMuted: video.muted,
      });
    });

    video.addEventListener('play', () => {
      if (this.isDestroyed) return;
      const origin: CommandOrigin = EventValidation.isRemoteLockActive() ? 'remote' : 'user';
      this.updateState({ isPlaying: true }, origin);
    });

    video.addEventListener('pause', () => {
      if (this.isDestroyed) return;
      const origin: CommandOrigin = EventValidation.isRemoteLockActive() ? 'remote' : 'user';
      this.updateState({ isPlaying: false }, origin);
    });

    video.addEventListener('seeking', () => {
      if (this.isDestroyed) return;
      this.updateState({ isSeeking: true });
    });

    video.addEventListener('seeked', () => {
      if (this.isDestroyed) return;
      const origin: CommandOrigin = EventValidation.isRemoteLockActive() ? 'remote' : 'user';
      this.updateState({ currentTime: video.currentTime, isSeeking: false }, origin);
    });

    video.addEventListener('waiting', () => {
      if (this.isDestroyed) return;
      this.updateState({ isBuffering: true });
      this.emit({ type: 'BUFFERING_START' });
    });

    video.addEventListener('playing', () => {
      if (this.isDestroyed) return;
      this.updateState({ isBuffering: false, isPlaying: true });
      this.emit({ type: 'BUFFERING_END' });
    });

    video.addEventListener('timeupdate', () => {
      if (this.isDestroyed) return;
      this.state.currentTime = video.currentTime;
      this.emit({ type: 'TIME_UPDATE', currentTime: video.currentTime, duration: video.duration || 0 });
    });

    video.addEventListener('ended', () => {
      if (this.isDestroyed) return;
      this.updateState({ isPlaying: false });
      this.emit({ type: 'MEDIA_ENDED' });
    });

    video.addEventListener('error', () => {
      if (this.isDestroyed) return;
      this.emit({
        type: 'ERROR',
        message: 'Could not play video file or stream URL.',
        fatal: false,
      });
    });
  }

  public async play(origin: CommandOrigin = 'user'): Promise<void> {
    if (!this.videoElement) return;
    if (origin === 'remote') {
      EventValidation.acquireRemoteLock(700);
    }
    try {
      await this.videoElement.play();
      this.updateState({ isPlaying: true }, origin);
    } catch {
      // Autoplay or browser policy blocked
    }
  }

  public async pause(origin: CommandOrigin = 'user'): Promise<void> {
    if (!this.videoElement) return;
    if (origin === 'remote') {
      EventValidation.acquireRemoteLock(700);
    }
    this.videoElement.pause();
    this.updateState({ isPlaying: false }, origin);
  }

  public async seek(time: number, origin: CommandOrigin = 'user'): Promise<void> {
    if (!this.videoElement) return;
    if (origin === 'remote') {
      EventValidation.acquireRemoteLock(800);
    }
    this.videoElement.currentTime = time;
    this.updateState({ currentTime: time }, origin);
  }

  public setPlaybackRate(rate: number): void {
    if (!this.videoElement) return;
    this.videoElement.playbackRate = rate;
    this.updateState({ playbackRate: rate });
  }

  public setVolume(volume: number): void {
    if (!this.videoElement) return;
    const clamped = Math.max(0, Math.min(100, volume));
    this.videoElement.volume = clamped / 100;
    this.updateState({ volume: clamped, isMuted: clamped === 0 });
  }

  public setMuted(muted: boolean): void {
    if (!this.videoElement) return;
    this.videoElement.muted = muted;
    this.updateState({ isMuted: muted });
  }

  public async loadFile(file: File): Promise<void> {
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
    }
    this.activeObjectUrl = URL.createObjectURL(file);
    this.state.title = file.name;
    this.state.mediaId = `local-${Date.now()}`;
    if (this.videoElement) {
      this.videoElement.src = this.activeObjectUrl;
      this.videoElement.load();
      this.play('user').catch(() => {});
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
    this.state.posterUrl = posterUrl;
    this.state.currentTime = startTime;

    if (this.videoElement) {
      if (mediaId.startsWith('http://') || mediaId.startsWith('https://')) {
        this.videoElement.src = mediaId;
      }
      this.videoElement.currentTime = startTime;
      this.videoElement.load();
      this.play('user').catch(() => {});
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.remove();
      this.videoElement = null;
    }
    if (this.containerElement) {
      this.containerElement.innerHTML = '';
      this.containerElement = null;
    }
    this.subscribers.clear();
  }
}
