/**
 * VYBE Authoritative Synchronization Engine
 * Bridges Realtime room events with the local PlaybackManager using tiered drift correction,
 * monotonic sequence validation, and feedback loop prevention.
 */

import { PlaybackClock } from './sync/clock';
import { DriftCorrection, DriftTier } from './sync/drift-correction';
import { EventValidation } from './sync/event-validation';
import { PlaybackManager } from './playback-manager';
import { ControlPermission, MemberRole, PlaybackState } from '@/types/vybe';

export interface SyncEngineConfig {
  playbackManager: PlaybackManager;
  onPublishSync: (state: PlaybackState) => void;
  onDriftReport?: (driftSec: number, tier: DriftTier) => void;
}

export class SyncEngine {
  private playbackManager: PlaybackManager;
  private clock: PlaybackClock = new PlaybackClock();
  private onPublishSync: (state: PlaybackState) => void;
  private onDriftReport?: (driftSec: number, tier: DriftTier) => void;

  private isHost = false;
  private userRole: MemberRole = 'member';
  private controlPermission: ControlPermission = 'host_only';
  private userId = '';
  private userName = '';
  private roomId = '';
  private roomCode = '';
  private localNetflixWatchId: string | null = null;
  private onTitleMismatch?: (remoteId: string, localId: string) => void;

  private isDestroyed = false;

  constructor(config: SyncEngineConfig) {
    this.playbackManager = config.playbackManager;
    this.onPublishSync = config.onPublishSync;
    this.onDriftReport = config.onDriftReport;
  }

  public setOnTitleMismatch(handler: (remoteId: string, localId: string) => void) {
    this.onTitleMismatch = handler;
  }

  public updateContext(params: {
    isHost: boolean;
    userRole: MemberRole;
    controlPermission: ControlPermission;
    userId: string;
    userName: string;
    roomId: string;
    roomCode: string;
    localNetflixWatchId?: string | null;
  }) {
    this.isHost = params.isHost;
    this.userRole = params.userRole;
    this.controlPermission = params.controlPermission;
    this.userId = params.userId;
    this.userName = params.userName;
    this.roomId = params.roomId;
    this.roomCode = params.roomCode;
    this.localNetflixWatchId = params.localNetflixWatchId || null;
  }

  public setLocalNetflixWatchId(watchId: string | null) {
    this.localNetflixWatchId = watchId ? watchId.toUpperCase() : null;
  }

  public canControlPlayback(): boolean {
    return EventValidation.canControlPlayback(
      this.controlPermission,
      this.userRole,
      this.isHost
    );
  }

  /**
   * Called when an authoritative remote sync event arrives from the network.
   */
  public async handleRemoteSync(authoritative: PlaybackState): Promise<void> {
    if (!this.clock.isSequenceNewer(authoritative.seq)) {
      // Reject stale or out-of-order sequence packet
      return;
    }

    // Different-title guard: when this participant's Netflix tab reports a
    // different title than the authoritative room state, do not let the
    // authoritative clock chase the wrong title. The extension refuses to
    // apply mismatched commands as well.
    const remoteId = authoritative.netflixWatchId ? authoritative.netflixWatchId.toUpperCase() : null;
    const localId = this.localNetflixWatchId;
    if (remoteId && localId && localId !== remoteId) {
      if (this.onTitleMismatch) {
        this.onTitleMismatch(remoteId, localId);
      }
      return;
    }

    this.clock.commitSequence(authoritative.seq);
    this.clock.updateServerOffset(authoritative.updatedAt);

    const projectedTime = this.clock.calculateProjectedTime(
      authoritative.currentTime,
      authoritative.isPlaying,
      authoritative.updatedAt
    );

    const localState = this.playbackManager.getState();
    if (!localState) return;

    // 1. Play/Pause alignment
    if (authoritative.isPlaying !== localState.isPlaying) {
      if (authoritative.isPlaying) {
        await this.playbackManager.play('remote');
      } else {
        await this.playbackManager.pause('remote');
      }
    }

    // 2. Drift correction — Netflix has no rate-adjust tier; anything
    // beyond the jitter window becomes a hard seek to the authoritative
    // position.
    const plan = DriftCorrection.evaluate(localState.currentTime, projectedTime);

    if (this.onDriftReport) {
      this.onDriftReport(plan.driftSec, plan.tier);
    }

    if (plan.shouldSeek) {
      await this.playbackManager.seek(plan.targetTime, 'remote');
    }
  }

  /**
   * Called when local user initiates a playback action (Play, Pause, Seek).
   */
  public handleUserAction(action: {
    isPlaying: boolean;
    currentTime: number;
    videoId: string;
    videoTitle: string;
    videoThumbnail?: string;
  }) {
    if (!this.canControlPlayback()) {
      return;
    }

    const nextSeq = this.clock.nextSequence();
    const now = Date.now();

    const updatedPlayback: PlaybackState = {
      roomId: this.roomId,
      platform: 'netflix',
      videoId: action.videoId,
      videoTitle: action.videoTitle,
      videoThumbnail: action.videoThumbnail,
      netflixWatchId: action.videoId,
      isPlaying: action.isPlaying,
      currentTime: Number(action.currentTime.toFixed(2)),
      playbackRate: 1.0,
      seq: nextSeq,
      updatedBy: this.userId,
      updatedByName: this.userName,
      updatedAt: now,
    };

    this.onPublishSync(updatedPlayback);
  }

  public destroy(): void {
    this.isDestroyed = true;
  }
}
