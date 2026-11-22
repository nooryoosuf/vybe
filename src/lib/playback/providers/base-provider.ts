/**
 * VYBE Abstract Playback Provider Base Class
 * Provides common subscriber tracking, state caching, and event dispatching.
 */

import {
  CommandOrigin,
  IPlaybackProvider,
  NormalizedPlaybackState,
  PlaybackEvent,
  PlaybackEventListener,
  PlaybackInitConfig,
  PlaybackProviderType,
  PlayerCapabilities,
} from '../types';

export abstract class BasePlaybackProvider implements IPlaybackProvider {
  public abstract readonly providerType: PlaybackProviderType;

  protected subscribers: Set<PlaybackEventListener> = new Set();
  protected state: NormalizedPlaybackState;

  constructor(initialType: PlaybackProviderType) {
    this.state = {
      provider: initialType,
      mediaId: '',
      title: '',
      posterUrl: '',
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      isBuffering: false,
      isSeeking: false,
      playbackRate: 1.0,
      volume: 85,
      isMuted: false,
      sequenceNumber: 0,
      updatedAt: Date.now(),
      updatedBy: '',
      updatedByName: '',
    };
  }

  public abstract initialize(config: PlaybackInitConfig): Promise<void>;
  public abstract getCapabilities(): PlayerCapabilities;
  public abstract play(origin?: CommandOrigin): Promise<void>;
  public abstract pause(origin?: CommandOrigin): Promise<void>;
  public abstract seek(time: number, origin?: CommandOrigin): Promise<void>;
  public abstract setPlaybackRate(rate: number): void;
  public abstract setVolume(volume: number): void;
  public abstract setMuted(muted: boolean): void;
  public abstract loadMedia(mediaId: string, title: string, posterUrl?: string, startTime?: number): Promise<void>;
  public abstract destroy(): void;

  public getState(): NormalizedPlaybackState {
    return { ...this.state };
  }

  public subscribe(listener: PlaybackEventListener): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  protected emit(event: PlaybackEvent) {
    for (const listener of this.subscribers) {
      try {
        listener(event);
      } catch (err) {
        console.error('[VYBE Playback Provider] Listener error:', err);
      }
    }
  }

  protected updateState(partial: Partial<NormalizedPlaybackState>, origin: CommandOrigin = 'system') {
    this.state = {
      ...this.state,
      ...partial,
      updatedAt: Date.now(),
    };
    this.emit({
      type: 'STATE_CHANGED',
      state: this.getState(),
      origin,
    });
  }
}
