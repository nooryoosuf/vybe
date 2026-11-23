/**
 * VYBE Playback Manager (Netflix-Only)
 * Coordinates the single active provider and normalized controls.
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
} from './types';
import { NetflixCompanionProvider } from './providers/netflix-companion';

export class PlaybackManager {
  private activeProvider: IPlaybackProvider | null = null;
  private currentType: PlaybackProviderType = 'netflix';
  private listeners: Set<PlaybackEventListener> = new Set();
  private containerElement: HTMLElement | null = null;
  private providerUnsubscribe: (() => void) | null = null;

  public getActiveProvider(): IPlaybackProvider | null {
    return this.activeProvider;
  }

  public getProviderType(): PlaybackProviderType {
    return this.currentType;
  }

  public getCapabilities(): PlayerCapabilities {
    if (!this.activeProvider) {
      return {
        canPlay: false,
        canPause: false,
        canSeek: false,
        canChangeRate: false,
        canSetVolume: false,
        supportsEmbeddedPlayback: false,
        supportsExternalPlayback: false,
        supportsSubtitles: false,
        supportsMobileControl: false,
      };
    }
    return this.activeProvider.getCapabilities();
  }

  public getState(): NormalizedPlaybackState | null {
    return this.activeProvider ? this.activeProvider.getState() : null;
  }

  public subscribe(listener: PlaybackEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: PlaybackEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[PlaybackManager] Listener error:', err);
      }
    }
  }

  public async switchProvider(
    type: PlaybackProviderType,
    config: PlaybackInitConfig
  ): Promise<IPlaybackProvider> {
    if (this.activeProvider) {
      if (this.providerUnsubscribe) {
        this.providerUnsubscribe();
        this.providerUnsubscribe = null;
      }
      this.activeProvider.destroy();
      this.activeProvider = null;
    }

    this.currentType = type;
    this.containerElement = config.container;

    const provider = new NetflixCompanionProvider();
    this.activeProvider = provider;

    this.providerUnsubscribe = provider.subscribe((event) => {
      this.emit(event);
    });

    await provider.initialize(config);

    this.emit({
      type: 'CAPABILITIES_CHANGED',
      capabilities: provider.getCapabilities(),
    });

    return provider;
  }

  public async play(origin: CommandOrigin = 'user'): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.play(origin);
    }
  }

  public async pause(origin: CommandOrigin = 'user'): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.pause(origin);
    }
  }

  public async seek(time: number, origin: CommandOrigin = 'user'): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.seek(time, origin);
    }
  }

  public setPlaybackRate(rate: number): void {
    if (this.activeProvider) {
      this.activeProvider.setPlaybackRate(rate);
    }
  }

  public setVolume(volume: number): void {
    if (this.activeProvider) {
      this.activeProvider.setVolume(volume);
    }
  }

  public setMuted(muted: boolean): void {
    if (this.activeProvider) {
      this.activeProvider.setMuted(muted);
    }
  }

  public async loadMedia(
    mediaId: string,
    title: string,
    posterUrl?: string,
    startTime = 0
  ): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.loadMedia(mediaId, title, posterUrl, startTime);
    }
  }

  public destroy(): void {
    if (this.providerUnsubscribe) {
      this.providerUnsubscribe();
      this.providerUnsubscribe = null;
    }
    if (this.activeProvider) {
      this.activeProvider.destroy();
      this.activeProvider = null;
    }
    this.listeners.clear();
    this.containerElement = null;
  }
}
