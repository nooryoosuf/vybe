/**
 * VYBE Netflix Companion Provider (Netflix-Only)
 *
 * Tracks the authoritative room playback state and forwards authorized
 * play/pause/seek commands to each participant's own Netflix tab through
 * the Chrome Extension bridge. The video itself always plays inside the
 * participant's Netflix tab on netflix.com — VYBE never embeds or proxies
 * Netflix content.
 */

import { BasePlaybackProvider } from './base-provider';
import {
  CommandOrigin,
  PlaybackInitConfig,
  PlaybackProviderType,
  PlayerCapabilities,
} from '../types';

export class NetflixCompanionProvider extends BasePlaybackProvider {
  public readonly providerType: PlaybackProviderType = 'netflix';

  private roomCode = 'NFX-808';
  private bridgeListener: ((event: MessageEvent) => void) | null = null;

  constructor() {
    super('netflix');
  }

  public getCapabilities(): PlayerCapabilities {
    return {
      canPlay: true,
      canPause: true,
      canSeek: true,
      canChangeRate: false,
      canSetVolume: false, // volume is owned by the viewer's Netflix account
      supportsEmbeddedPlayback: false, // never embed Netflix
      supportsExternalPlayback: true, // each participant watches via Netflix.com
      supportsSubtitles: true, // governed by the viewer's own Netflix account
      supportsMobileControl: false, // Netflix mobile app cannot be controlled from VYBE
    };
  }

  public setRoomCode(code: string) {
    this.roomCode = code.toUpperCase();
    if (typeof window !== 'undefined') {
      window.postMessage(
        {
          source: 'VYBE_WEB_APP',
          type: 'VYBE_ROOM_INIT',
          roomCode: this.roomCode,
          vybeBaseUrl: window.location.origin,
        },
        '*'
      );
    }
  }

  public async initialize(config: PlaybackInitConfig): Promise<void> {
    this.state.mediaId = config.initialMediaId || '';
    this.state.title = config.initialTitle || '';
    this.state.posterUrl = config.initialPosterUrl;
    this.state.currentTime = config.initialTime || 0;
    this.state.isPlaying = Boolean(config.initialPlaying);
    this.state.isBuffering = false;
    this.setupBridge();
  }

  private setupBridge() {
    if (typeof window === 'undefined') return;

    this.bridgeListener = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'VYBE_NETFLIX_EXTENSION') return;

      if (event.data.type === 'NETFLIX_PLAYBACK_EVENT' || event.data.type === 'EXTENSION_HEARTBEAT') {
        const cur = Number(event.data.currentTime || 0);
        const isPlaying = Boolean(event.data.isPlaying);
        const update: { currentTime: number; isPlaying: boolean; mediaId?: string } = {
          currentTime: cur,
          isPlaying,
        };
        if (event.data.watchId) {
          update.mediaId = String(event.data.watchId);
        }
        this.updateState(update, 'remote');
      } else if (event.data.type === 'CMD_REJECTED_TITLE_MISMATCH') {
        this.emit({
          type: 'ERROR',
          message: `Sync skipped: you are watching a different Netflix title. Open the same title to join the party.`,
          fatal: false,
        });
      }
    };

    window.addEventListener('message', this.bridgeListener);
    window.postMessage(
      {
        source: 'VYBE_WEB_APP',
        type: 'VYBE_ROOM_INIT',
        roomCode: this.roomCode,
        vybeBaseUrl: window.location.origin,
      },
      '*'
    );
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
    // Netflix account playback rate is controlled by the viewer in Netflix.
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
    this.subscribers.clear();
  }
}
