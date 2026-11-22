/**
 * VYBE Clock & Monotonic Sequence Coordinator
 * Computes projected authoritative room playback time and enforces monotonic sequence ordering.
 */

export class PlaybackClock {
  private lastAppliedSeq = 0;
  private serverTimeOffsetMs = 0;

  /**
   * Update known clock offset between local machine and server timestamp.
   */
  public updateServerOffset(serverEpochMs: number, localEpochMs: number = Date.now()) {
    if (serverEpochMs > 0) {
      this.serverTimeOffsetMs = serverEpochMs - localEpochMs;
    }
  }

  /**
   * Get estimated server-aligned epoch timestamp.
   */
  public getServerNow(): number {
    return Date.now() + this.serverTimeOffsetMs;
  }

  /**
   * Calculate where the playback should currently be based on authoritative state and elapsed time.
   */
  public calculateProjectedTime(
    authoritativeTime: number,
    isPlaying: boolean,
    authoritativeUpdatedAt: number
  ): number {
    if (!isPlaying) {
      return Math.max(0, authoritativeTime);
    }
    const now = this.getServerNow();
    const elapsedSec = Math.max(0, (now - authoritativeUpdatedAt) / 1000);
    return Math.max(0, authoritativeTime + elapsedSec);
  }

  /**
   * Check whether an incoming sequence number is strictly newer than the last applied sequence.
   */
  public isSequenceNewer(incomingSeq: number): boolean {
    return incomingSeq > this.lastAppliedSeq;
  }

  /**
   * Commit that a sequence number was applied.
   */
  public commitSequence(seq: number) {
    if (seq > this.lastAppliedSeq) {
      this.lastAppliedSeq = seq;
    }
  }

  /**
   * Get the current highest applied sequence number.
   */
  public getLastAppliedSeq(): number {
    return this.lastAppliedSeq;
  }

  /**
   * Generate next sequence number for local authoritative action.
   */
  public nextSequence(): number {
    this.lastAppliedSeq += 1;
    return this.lastAppliedSeq;
  }
}
