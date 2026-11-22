/**
 * VYBE Event Validation & Loop Prevention
 * Validates role-based playback authority and prevents command feedback loops.
 */

import { ControlPermission, MemberRole } from '@/types/vybe';
import { CommandOrigin } from '../types';

export class EventValidation {
  private static activeRemoteCommandLock = false;
  private static remoteLockTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Check whether a user with a given role has permission to control playback.
   */
  public static canControlPlayback(
    controlPermission: ControlPermission,
    userRole: MemberRole,
    isRoomHost: boolean
  ): boolean {
    if (isRoomHost || userRole === 'host') return true;
    if (controlPermission === 'everyone') return true;
    if (controlPermission === 'cohosts' && userRole === 'cohost') return true;
    return false;
  }

  /**
   * Acquire a temporary command execution lock to prevent native player events
   * from echoing back out to the network when applying an authoritative remote command.
   */
  public static acquireRemoteLock(durationMs = 900) {
    this.activeRemoteCommandLock = true;
    if (this.remoteLockTimer) {
      clearTimeout(this.remoteLockTimer);
    }
    this.remoteLockTimer = setTimeout(() => {
      this.activeRemoteCommandLock = false;
      this.remoteLockTimer = null;
    }, durationMs);
  }

  /**
   * Explicitly release remote command lock.
   */
  public static releaseRemoteLock() {
    this.activeRemoteCommandLock = false;
    if (this.remoteLockTimer) {
      clearTimeout(this.remoteLockTimer);
      this.remoteLockTimer = null;
    }
  }

  /**
   * Check if a remote command lock is currently active.
   */
  public static isRemoteLockActive(): boolean {
    return this.activeRemoteCommandLock;
  }

  /**
   * Determine whether a native player event should be broadcast out to the room.
   */
  public static shouldBroadcastLocalEvent(
    origin: CommandOrigin,
    hasControlPermission: boolean
  ): boolean {
    // Never broadcast events that were caused by incoming remote commands
    if (origin === 'remote' || this.activeRemoteCommandLock) {
      return false;
    }
    // Only users with control permission can issue authoritative broadcasts
    return hasControlPermission;
  }
}
