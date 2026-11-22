/**
 * VYBE — Unified Playback Architecture
 * Core Type Definitions, Capability Flags, and Provider Interfaces
 */

export type PlaybackProviderType = 'youtube' | 'netflix' | 'local_media';

export type CommandOrigin = 'user' | 'remote' | 'system';

export interface PlayerCapabilities {
  canPlay: boolean;
  canPause: boolean;
  canSeek: boolean;
  canChangeRate: boolean;
  canSetVolume: boolean;
  supportsEmbeddedPlayback: boolean;
  supportsExternalPlayback: boolean;
  supportsSubtitles: boolean;
  supportsMobileControl: boolean;
}

export interface NormalizedPlaybackState {
  provider: PlaybackProviderType;
  mediaId: string;
  title: string;
  posterUrl?: string;
  currentTime: number; // in seconds
  duration: number; // in seconds
  isPlaying: boolean;
  isBuffering: boolean;
  isSeeking: boolean;
  playbackRate: number;
  volume: number; // 0..100
  isMuted: boolean;
  sequenceNumber: number;
  updatedAt: number; // epoch ms
  updatedBy: string; // userId
  updatedByName: string;
}

export type PlaybackEventListener = (
  event: PlaybackEvent
) => void;

export type PlaybackEvent =
  | { type: 'STATE_CHANGED'; state: NormalizedPlaybackState; origin: CommandOrigin }
  | { type: 'TIME_UPDATE'; currentTime: number; duration: number }
  | { type: 'BUFFERING_START' }
  | { type: 'BUFFERING_END' }
  | { type: 'MEDIA_ENDED' }
  | { type: 'ERROR'; message: string; fatal: boolean }
  | { type: 'CAPABILITIES_CHANGED'; capabilities: PlayerCapabilities };

export interface PlaybackInitConfig {
  container: HTMLElement;
  initialMediaId: string;
  initialTitle?: string;
  initialPosterUrl?: string;
  initialTime?: number;
  initialPlaying?: boolean;
  autoPlay?: boolean;
  isMuted?: boolean;
  customStreamUrl?: string;
  localFile?: File;
}

export interface IPlaybackProvider {
  readonly providerType: PlaybackProviderType;

  /** Initialize the player in the given DOM container */
  initialize(config: PlaybackInitConfig): Promise<void>;

  /** Get player capabilities */
  getCapabilities(): PlayerCapabilities;

  /** Get current snapshot of normalized playback state */
  getState(): NormalizedPlaybackState;

  /** Play media */
  play(origin?: CommandOrigin): Promise<void>;

  /** Pause media */
  pause(origin?: CommandOrigin): Promise<void>;

  /** Seek to time in seconds */
  seek(time: number, origin?: CommandOrigin): Promise<void>;

  /** Set playback rate (e.g. 0.95, 1.0, 1.05) */
  setPlaybackRate(rate: number): void;

  /** Set volume 0..100 */
  setVolume(volume: number): void;

  /** Toggle or set mute */
  setMuted(muted: boolean): void;

  /** Change media source within this provider */
  loadMedia(mediaId: string, title: string, posterUrl?: string, startTime?: number): Promise<void>;

  /** Subscribe to player events */
  subscribe(listener: PlaybackEventListener): () => void;

  /** Clean up all DOM nodes, listeners, and intervals */
  destroy(): void;
}
