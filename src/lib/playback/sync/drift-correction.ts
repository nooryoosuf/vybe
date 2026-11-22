/**
 * VYBE Tiered Drift Correction Engine
 *
 * Implements smooth, non-disruptive synchronization:
 * - Tier 1 (< 0.35s): Natural jitter zone. Allow natural playback without audio distortion.
 * - Tier 2 (0.35s - 1.50s): Speed adjustment zone. Subtly adjust playback speed (0.95x / 1.05x)
 *   to converge without audible pitch shift or video stutter.
 * - Tier 3 (> 1.50s): Seek zone. Hard seek to authoritative position.
 */

export enum DriftTier {
  /** Jitter zone: do nothing, playback is sufficiently in sync */
  IN_SYNC = 'IN_SYNC',
  /** Moderate drift: adjust playback rate smoothly */
  RATE_ADJUST = 'RATE_ADJUST',
  /** Major drift: hard seek */
  HARD_SEEK = 'HARD_SEEK',
}

export interface DriftCorrectionPlan {
  tier: DriftTier;
  driftSec: number;
  targetTime: number;
  recommendedRate: number;
  shouldSeek: boolean;
}

export class DriftCorrection {
  private static readonly IN_SYNC_THRESHOLD_SEC = 0.35;
  private static readonly HARD_SEEK_THRESHOLD_SEC = 1.50;
  private static readonly CONVERGENCE_TARGET_SEC = 0.15;

  /**
   * Evaluate drift between current local player time and projected authoritative time.
   */
  public static evaluate(
    localCurrentTime: number,
    projectedAuthoritativeTime: number,
    canChangeRate: boolean
  ): DriftCorrectionPlan {
    const rawDiff = localCurrentTime - projectedAuthoritativeTime;
    const absDrift = Math.abs(rawDiff);

    // Tier 1: Natural playback within threshold
    if (absDrift <= this.IN_SYNC_THRESHOLD_SEC) {
      return {
        tier: DriftTier.IN_SYNC,
        driftSec: Number(rawDiff.toFixed(3)),
        targetTime: projectedAuthoritativeTime,
        recommendedRate: 1.0,
        shouldSeek: false,
      };
    }

    // Tier 2: Moderate drift with rate adjustment capability
    if (absDrift <= this.HARD_SEEK_THRESHOLD_SEC && canChangeRate) {
      // Local is ahead of host -> slow down slightly to let host catch up
      // Local is behind host -> speed up slightly to catch up to host
      const recommendedRate = rawDiff > 0 ? 0.95 : 1.05;
      return {
        tier: DriftTier.RATE_ADJUST,
        driftSec: Number(rawDiff.toFixed(3)),
        targetTime: projectedAuthoritativeTime,
        recommendedRate,
        shouldSeek: false,
      };
    }

    // Tier 3: Major drift (or provider doesn't support smooth rate adjustment)
    return {
      tier: DriftTier.HARD_SEEK,
      driftSec: Number(rawDiff.toFixed(3)),
      targetTime: projectedAuthoritativeTime,
      recommendedRate: 1.0,
      shouldSeek: true,
    };
  }

  /**
   * Check if drift has returned to the convergence target to restore 1.0x normal speed.
   */
  public static hasConverged(localCurrentTime: number, projectedAuthoritativeTime: number): boolean {
    return Math.abs(localCurrentTime - projectedAuthoritativeTime) <= this.CONVERGENCE_TARGET_SEC;
  }
}
