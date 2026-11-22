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

  private currentPlaybackRate = 1.0;
  private driftCheckTimer: ReturnType<typeof setInterval> | null = null;
  private isDestroyed = false;

  constructor(config: SyncEngineConfig) {
    this.playbackManager = config.playbackManager;
    this.onPublishSync = config.onPublishSync;
    this.onDriftReport = config.onDriftReport;

    this.startDriftMonitoring();
  }

  public updateContext(params: {
    isHost: boolean;
    userRole: MemberRole;
    controlPermission: ControlPermission;
    userId: string;
    userName: string;
    roomId: string;
    roomCode: string;
  }) {
    this.isHost = params.isHost;
    this.userRole = params.userRole;
    this.controlPermission = params.controlPermission;
    this.userId = params.userId;
    this.userName = params.userName;
    this.roomId = params.roomId;
    this.roomCode = params.roomCode;
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
    this.clock.commitSequence(authoritative.seq);
    this.clock.updateServerOffset(authoritative.updatedAt);

    const projectedTime = this.clock.calculateProjectedTime(
      authoritative.currentTime,
      authoritative.isPlaying,
      authoritative.updatedAt
    );

    const localState = this.playbackManager.getState();
    if (!localState) return;

    const capabilities = this.playbackManager.getCapabilities();

    // 1. Play/Pause alignment
    if (authoritative.isPlaying !== localState.isPlaying) {
      if (authoritative.isPlaying) {
        await this.playbackManager.play('remote');
      } else {
        await this.playbackManager.pause('remote');
      }
    }

    // 2. Drift correction
    const plan = DriftCorrection.evaluate(
      localState.currentTime,
      projectedTime,
      capabilities.canChangeRate
    );

    if (this.onDriftReport) {
      this.onDriftReport(plan.driftSec, plan.tier);
    }

    if (plan.shouldSeek) {
      await this.playbackManager.seek(plan.targetTime, 'remote');
      this.restoreNormalSpeed();
    } else if (plan.tier === DriftTier.RATE_ADJUST && capabilities.canChangeRate) {
      if (this.currentPlaybackRate !== plan.recommendedRate) {
        this.currentPlaybackRate = plan.recommendedRate;
        this.playbackManager.setPlaybackRate(plan.recommendedRate);
      }
    } else if (plan.tier === DriftTier.IN_SYNC) {
      this.restoreNormalSpeed();
    }
  }

  /**
   * Called when local user initiates a playback action (Play, Pause, Seek).
   */
  public handleUserAction(action: {
    isPlaying: boolean;
    currentTime: number;
    platform: 'youtube' | 'netflix';
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
      platform: action.platform,
      videoId: action.videoId,
      videoTitle: action.videoTitle,
      videoThumbnail: action.videoThumbnail,
      netflixWatchId: action.platform === 'netflix' ? action.videoId : undefined,
      isPlaying: action.isPlaying,
      currentTime: Number(action.currentTime.toFixed(2)),
      playbackRate: 1.0,
      seq: nextSeq,
      updatedBy: this.userId,
      updatedByName: this.userName,
      updatedAt: now,
    };

    this.restoreNormalSpeed();
    this.onPublishSync(updatedPlayback);
  }

  private restoreNormalSpeed() {
    if (this.currentPlaybackRate !== 1.0) {
      this.currentPlaybackRate = 1.0;
      this.playbackManager.setPlaybackRate(1.0);
    }
  }

  private startDriftMonitoring() {
    if (this.driftCheckTimer) clearInterval(this.driftCheckTimer);

    this.driftCheckTimer = setInterval(() => {
      if (this.isDestroyed || this.isHost) return;

      const localState = this.playbackManager.getState();
      if (!localState || !localState.isPlaying) return;

      // If we are currently adjusting rate, check if we've converged back to in-sync
      if (this.currentPlaybackRate !== 1.0) {
        const capabilities = this.playbackManager.getCapabilities();
        if (capabilities.canChangeRate) {
          // If drift has converged back, restore normal speed
          this.restoreNormalSpeed();
        }
      }
    }, 1200);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.driftCheckTimer) {
      clearInterval(this.driftCheckTimer);
      this.driftCheckTimer = null;
    }
  }
}
