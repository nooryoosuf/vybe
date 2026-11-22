/**
 * VYBE Netflix Companion Playback Provider
 * Coordinates browser extension sync, fallback embed video, and tab casting.
 */

import { BasePlaybackProvider } from './base-provider';
import {
  CommandOrigin,
  PlaybackInitConfig,
  PlaybackProviderType,
  PlayerCapabilities,
} from '../types';
import { EventValidation } from '../sync/event-validation';

export class NetflixCompanionProvider extends BasePlaybackProvider {
  public readonly providerType: PlaybackProviderType = 'netflix';

  private containerElement: HTMLElement | null = null;
  private bridgeListener: ((event: MessageEvent) => void) | null = null;
  private activeIframe: HTMLIFrameElement | null = null;
  private castStream: MediaStream | null = null;
  private castVideo: HTMLVideoElement | null = null;
  private roomCode = 'VYB-4K1';

  constructor() {
    super('netflix');
  }

  public getCapabilities(): PlayerCapabilities {
    return {
      canPlay: true,
      canPause: true,
      canSeek: true,
      canChangeRate: false,
      canSetVolume: true,
      supportsEmbeddedPlayback: true,
      supportsExternalPlayback: true,
      supportsSubtitles: false,
      supportsMobileControl: false,
    };
  }

  public setRoomCode(code: string) {
    this.roomCode = code.toUpperCase();
    if (typeof window !== 'undefined') {
      window.postMessage(
        { source: 'VYBE_WEB_APP', type: 'VYBE_ROOM_INIT', roomCode: this.roomCode },
        '*'
      );
    }
  }

  public async initialize(config: PlaybackInitConfig): Promise<void> {
    this.containerElement = config.container;
    this.state.mediaId = config.initialMediaId || '81446667';
    this.state.title = config.initialTitle || 'Arcane — S1:E1 Welcome to the Playground';
    this.state.posterUrl = config.initialPosterUrl;
    this.state.currentTime = config.initialTime || 0;
    this.state.isPlaying = Boolean(config.initialPlaying);
    this.state.duration = 2580; // Standard episode length ~43 min

    this.setupBridge();
    this.renderCompanionFrame(this.state.mediaId);
  }

  private setupBridge() {
    if (typeof window === 'undefined') return;

    this.bridgeListener = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'VYBE_NETFLIX_EXTENSION') return;

      if (event.data.type === 'NETFLIX_PLAYBACK_EVENT' || event.data.type === 'EXTENSION_HEARTBEAT') {
        const cur = Number(event.data.currentTime || 0);
        const isPlaying = Boolean(event.data.isPlaying);
        this.updateState({
          currentTime: cur,
          isPlaying,
        }, 'remote');
      }
    };

    window.addEventListener('message', this.bridgeListener);

    window.postMessage(
      { source: 'VYBE_WEB_APP', type: 'VYBE_ROOM_INIT', roomCode: this.roomCode },
      '*'
    );
  }

  private renderCompanionFrame(watchId: string) {
    if (!this.containerElement) return;
    this.containerElement.innerHTML = '';

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/3jfI-z__GY0?autoplay=1&controls=1&rel=0&modestbranding=1&playsinline=1`;
    iframe.className = 'w-full h-full border-0';
    iframe.allow =
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;

    this.activeIframe = iframe;
    this.containerElement.appendChild(iframe);
  }

  public async startTabCast(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      this.emit({
        type: 'ERROR',
        message: 'Tab screen casting is not supported on this device/browser (Desktop Chrome/Edge/Firefox required).',
        fatal: false,
      });
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60, max: 60 } },
        audio: true,
      });
      this.castStream = stream;

      if (this.containerElement) {
        this.containerElement.innerHTML = '';
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.className = 'w-full h-full object-contain bg-black';
        this.castVideo = video;
        this.containerElement.appendChild(video);
      }

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        this.stopTabCast();
      });

      return true;
    } catch {
      return false;
    }
  }

  public stopTabCast(): void {
    if (this.castStream) {
      this.castStream.getTracks().forEach((t) => t.stop());
      this.castStream = null;
    }
    if (this.castVideo) {
      this.castVideo.remove();
      this.castVideo = null;
    }
    this.renderCompanionFrame(this.state.mediaId);
  }

  public async play(origin: CommandOrigin = 'user'): Promise<void> {
    this.updateState({ isPlaying: true }, origin);
    this.dispatchToExtension(true, this.state.currentTime);
  }

  public async pause(origin: CommandOrigin = 'user'): Promise<void> {
    this.updateState({ isPlaying: false }, origin);
    this.dispatchToExtension(false, this.state.currentTime);
  }

  public async seek(time: number, origin: CommandOrigin = 'user'): Promise<void> {
    this.updateState({ currentTime: time }, origin);
    this.dispatchToExtension(this.state.isPlaying, time);
  }

  public setPlaybackRate(_rate: number): void {
    // Unsupported by external Netflix player
  }

  public setVolume(volume: number): void {
    this.updateState({ volume, isMuted: volume === 0 });
  }

  public setMuted(muted: boolean): void {
    this.updateState({ isMuted: muted });
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
    this.renderCompanionFrame(mediaId);
    this.dispatchToExtension(this.state.isPlaying, startTime);
  }

  private dispatchToExtension(isPlaying: boolean, currentTime: number) {
    if (typeof window !== 'undefined') {
      window.postMessage(
        {
          source: 'VYBE_WEB_APP',
          type: 'APPLY_REMOTE_SYNC',
          roomCode: this.roomCode,
          watchId: this.state.mediaId,
          isPlaying,
          currentTime,
        },
        '*'
      );
    }
  }

  public destroy(): void {
    if (this.bridgeListener && typeof window !== 'undefined') {
      window.removeEventListener('message', this.bridgeListener);
      this.bridgeListener = null;
    }
    this.stopTabCast();
    if (this.containerElement) {
      this.containerElement.innerHTML = '';
      this.containerElement = null;
    }
    this.subscribers.clear();
  }
}
