/**
 * SyncPlay - Real-Time Audio Synchronization Engine
 * Core drift detector, hard-seek orchestrator, and gradual micro-rate corrector.
 */

import { clockSync } from './ClockSync';
import { audioManager } from '../audio/AudioManager';
import { PlaybackState, SyncStatus } from '../types';

export class SyncEngine {
  private lastKnownState: PlaybackState | null = null;
  private syncCheckTimer: any = null;
  private onSyncStatusCb: ((status: SyncStatus) => void) | null = null;
  private currentRate = 1.0;
  private isRateAdjusting = false;

  constructor() {
    // Listen for playback status updates from AudioManager
    audioManager.setStatusListener(async (status) => {
      if (status.isLoaded) {
        this.evaluateSync(status.positionMillis, status.isPlaying);
      }
    });
  }

  /**
   * Called whenever a new sync packet arrives from the Host
   */
  public handleSyncState(state: PlaybackState) {
    this.lastKnownState = state;
    this.checkImmediateState();
  }

  public setStatusListener(cb: (status: SyncStatus) => void) {
    this.onSyncStatusCb = cb;
  }

  public startPeriodicCheck() {
    if (this.syncCheckTimer) clearInterval(this.syncCheckTimer);
    this.syncCheckTimer = setInterval(async () => {
      const status = await audioManager.getStatus();
      if (status && status.isLoaded) {
        this.evaluateSync(status.positionMillis, status.isPlaying);
      }
    }, 300);
  }

  public stopPeriodicCheck() {
    if (this.syncCheckTimer) {
      clearInterval(this.syncCheckTimer);
      this.syncCheckTimer = null;
    }
  }

  /**
   * Fast-path check when an authoritative sync state arrives
   */
  private async checkImmediateState() {
    if (!this.lastKnownState) return;

    const status = await audioManager.getStatus();
    if (!status || !status.isLoaded) return;

    const targetPos = this.calculateTargetPosition();

    // If host is paused, pause guest and align if needed
    if (!this.lastKnownState.isPlaying) {
      if (status.isPlaying) {
        await audioManager.pause();
      }
      if (Math.abs(status.positionMillis - targetPos) > 100) {
        await audioManager.setPosition(targetPos);
      }
      this.resetRateToNormal();
      this.emitStatus(status.positionMillis - targetPos, false, false);
      return;
    }

    // If host is playing but guest is paused, start playing
    if (this.lastKnownState.isPlaying && !status.isPlaying) {
      await audioManager.setPosition(targetPos);
      await audioManager.play();
      this.resetRateToNormal();
      return;
    }

    this.evaluateSync(status.positionMillis, status.isPlaying);
  }

  /**
   * Primary drift calculation and correction policy
   */
  private async evaluateSync(guestPositionMs: number, guestIsPlaying: boolean) {
    if (!this.lastKnownState) return;

    const targetPositionMs = this.calculateTargetPosition();
    const driftMs = Math.round(guestPositionMs - targetPositionMs);
    const absDrift = Math.abs(driftMs);

    // If host is paused, guest should be paused
    if (!this.lastKnownState.isPlaying) {
      if (guestIsPlaying) {
        await audioManager.pause();
      }
      this.emitStatus(driftMs, absDrift <= 40, false);
      return;
    }

    // Case 1: Massive drift or initial seek (> 1000ms) -> Hard Seek
    if (absDrift > 1000) {
      await audioManager.setPosition(targetPositionMs);
      this.resetRateToNormal();
      this.emitStatus(0, false, false);
      return;
    }

    // Case 2: Moderate drift (40ms < absDrift <= 1000ms) -> Micro Speed Adjustment (±3% to ±5%)
    if (absDrift > 40) {
      let targetRate = 1.0;
      if (driftMs > 0) {
        // Guest is ahead of host: slow down slightly (e.g. 0.96x)
        const slowDelta = Math.min(0.05, 0.02 + absDrift / 15000);
        targetRate = Number((1.0 - slowDelta).toFixed(3));
      } else {
        // Guest is behind host: speed up slightly (e.g. 1.04x)
        const fastDelta = Math.min(0.05, 0.02 + absDrift / 15000);
        targetRate = Number((1.0 + fastDelta).toFixed(3));
      }

      if (this.currentRate !== targetRate) {
        this.currentRate = targetRate;
        this.isRateAdjusting = true;
        await audioManager.setRate(targetRate);
      }

      this.emitStatus(driftMs, false, true);
      return;
    }

    // Case 3: Phase-locked within 40ms -> Optimal Sync!
    if (this.currentRate !== 1.0) {
      this.resetRateToNormal();
    }
    this.emitStatus(driftMs, true, false);
  }

  private async resetRateToNormal() {
    this.currentRate = 1.0;
    this.isRateAdjusting = false;
    await audioManager.setRate(1.0);
  }

  /**
   * Computes authoritative target position based on host state and elapsed clock time
   */
  public calculateTargetPosition(): number {
    if (!this.lastKnownState) return 0;

    if (!this.lastKnownState.isPlaying) {
      return this.lastKnownState.positionMs;
    }

    const currentServerTime = clockSync.toServerTime(Date.now());
    const elapsedSinceUpdate = Math.max(0, currentServerTime - this.lastKnownState.serverTimestamp);
    return this.lastKnownState.positionMs + elapsedSinceUpdate;
  }

  private emitStatus(driftMs: number, isLocked: boolean, isAdjusting: boolean) {
    if (!this.onSyncStatusCb) return;

    const rtt = Math.round(clockSync.getRtt());
    const offset = Math.round(clockSync.getOffset());

    let warning: string | null = null;
    if (rtt > 150) {
      warning = `High Latency WiFi (${rtt}ms RTT). Audio sync may experience minor delay.`;
    }

    let statusText = 'Syncing...';
    if (isLocked) {
      statusText = `Locked (±${Math.abs(driftMs)}ms)`;
    } else if (isAdjusting) {
      statusText = `Micro-adjusting (${driftMs > 0 ? '+' : ''}${driftMs}ms)`;
    } else {
      statusText = `Drift: ${driftMs > 0 ? '+' : ''}${driftMs}ms`;
    }

    this.onSyncStatusCb({
      driftMs,
      rttMs: rtt,
      offsetMs: offset,
      isLocked,
      isAdjusting,
      statusText,
      warning,
    });
  }
}

export const syncEngine = new SyncEngine();
