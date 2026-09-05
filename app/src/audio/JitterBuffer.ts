/**
 * SyncPlay - Low-Latency Audio Jitter Buffer
 * Smooths out network variance over WiFi for real-time audio chunk playback.
 */

import { AudioChunk, StreamStats } from '../types';

export class JitterBuffer {
  private queue: AudioChunk[] = [];
  private targetDelayMs = 150; // Default 150ms buffer delay
  private isBuffering = true;
  private firstPacketReceivedAt = 0;
  private firstPacketTimestamp = 0;
  private lastSeq = 0;
  private totalPacketsReceived = 0;
  private lostPacketsCount = 0;
  private currentRms = 0;
  private onStatsCallback: ((stats: StreamStats) => void) | null = null;
  private statsInterval: any = null;

  constructor(targetDelayMs = 150) {
    this.targetDelayMs = targetDelayMs;
    this.startStatsTimer();
  }

  public setTargetDelay(delayMs: number) {
    this.targetDelayMs = Math.max(50, Math.min(500, delayMs));
    this.reset();
  }

  public getTargetDelay(): number {
    return this.targetDelayMs;
  }

  public onStats(cb: (stats: StreamStats) => void) {
    this.onStatsCallback = cb;
    return () => {
      this.onStatsCallback = null;
    };
  }

  /**
   * Pushes a new chunk received from the host into the jitter buffer
   */
  public push(chunk: AudioChunk) {
    const now = Date.now();
    this.totalPacketsReceived++;
    this.currentRms = chunk.rms || 0;

    // Sequence checking for packet loss tracking
    if (this.lastSeq > 0 && chunk.seq > this.lastSeq + 1) {
      const missed = chunk.seq - this.lastSeq - 1;
      this.lostPacketsCount += missed;
    }
    this.lastSeq = chunk.seq;

    if (this.queue.length === 0) {
      this.firstPacketReceivedAt = now;
      this.firstPacketTimestamp = chunk.timestamp;
      this.isBuffering = true;
    }

    this.queue.push(chunk);

    // Guard against unrecoverable runaway buffer (e.g. queue > 1.5 seconds)
    if (this.queue.length > 60) {
      // Drop oldest 30 packets to prevent perceived lag accumulation
      this.queue.splice(0, 30);
      this.isBuffering = false;
    }

    // Check if initial buffer threshold reached
    if (this.isBuffering) {
      const bufferedDurationMs = now - this.firstPacketReceivedAt;
      if (bufferedDurationMs >= this.targetDelayMs) {
        this.isBuffering = false;
      }
    }
  }

  /**
   * Pulls the next chunk ready to be written to the audio output
   */
  public pop(): AudioChunk | null {
    if (this.isBuffering || this.queue.length === 0) {
      return null;
    }

    return this.queue.shift() || null;
  }

  public reset() {
    this.queue = [];
    this.isBuffering = true;
    this.firstPacketReceivedAt = 0;
    this.firstPacketTimestamp = 0;
    this.lastSeq = 0;
  }

  public getStats(): StreamStats {
    const total = this.totalPacketsReceived + this.lostPacketsCount;
    const lossPercent = total > 0 ? (this.lostPacketsCount / total) * 100 : 0;

    return {
      bufferDelayMs: this.targetDelayMs,
      packetLossPercent: Number(lossPercent.toFixed(1)),
      framesReceived: this.totalPacketsReceived,
      currentRms: this.currentRms,
    };
  }

  private startStatsTimer() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    this.statsInterval = setInterval(() => {
      if (this.onStatsCallback) {
        this.onStatsCallback(this.getStats());
      }
    }, 500);
  }

  public destroy() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.reset();
  }
}
