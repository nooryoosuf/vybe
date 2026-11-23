/**
 * VYBE Drift Correction (Netflix-Only)
 *
 * Within the jitter window do nothing (natural playback is sufficient).
 * Beyond the window, hard-seek to the authoritative position. Rate
 * adjustment is not supported — Netflix's own playback controls live in
 * the viewer's Netflix account.
 */

export enum DriftTier {
  /** Jitter zone: playback is sufficiently in sync, no action needed */
  IN_SYNC = 'IN_SYNC',
  /** Major drift: hard seek to authoritative position */
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

  /**
   * Evaluate drift between current local player time and the projected
   * authoritative time.
   */
  public static evaluate(
    localCurrentTime: number,
    projectedAuthoritativeTime: number
  ): DriftCorrectionPlan {
    const rawDiff = localCurrentTime - projectedAuthoritativeTime;
    const absDrift = Math.abs(rawDiff);

    if (absDrift <= this.IN_SYNC_THRESHOLD_SEC) {
      return {
        tier: DriftTier.IN_SYNC,
        driftSec: Number(rawDiff.toFixed(3)),
        targetTime: projectedAuthoritativeTime,
        recommendedRate: 1.0,
        shouldSeek: false,
      };
    }

    return {
      tier: DriftTier.HARD_SEEK,
      driftSec: Number(rawDiff.toFixed(3)),
      targetTime: projectedAuthoritativeTime,
      recommendedRate: 1.0,
      shouldSeek: true,
    };
  }
}
