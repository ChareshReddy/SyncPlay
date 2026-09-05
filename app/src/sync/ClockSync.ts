/**
 * SyncPlay - High-Precision Clock Synchronizer
 * Implements Cristian's Algorithm & NTP-style offset estimation with EMA filtering.
 */

import { Socket } from 'socket.io-client';

interface PingSample {
  rtt: number;
  offset: number;
  timestamp: number;
}

export class ClockSync {
  private socket: Socket | null = null;
  private offsetMs = 0;
  private rttMs = 0;
  private isInitialized = false;
  private syncIntervalId: any = null;
  private samples: PingSample[] = [];
  private onUpdateCallbacks: Array<(rtt: number, offset: number) => void> = [];

  constructor() {}

  /**
   * Attach socket instance and begin periodic clock synchronization
   */
  public start(socket: Socket) {
    this.socket = socket;
    this.samples = [];

    // Listen for pong response
    this.socket.off('sync:pong');
    this.socket.on('sync:pong', this.handlePong.bind(this));

    // Run initial burst of 6 pings to quickly establish high-accuracy offset
    this.runInitialBurst();

    // Setup recurring ping every 5 seconds to track drift & jitter
    if (this.syncIntervalId) clearInterval(this.syncIntervalId);
    this.syncIntervalId = setInterval(() => {
      this.sendPing();
    }, 5000);
  }

  public stop() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
    if (this.socket) {
      this.socket.off('sync:pong');
      this.socket = null;
    }
  }

  public onUpdate(cb: (rtt: number, offset: number) => void) {
    this.onUpdateCallbacks.push(cb);
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter((c) => c !== cb);
    };
  }

  private sendPing() {
    if (!this.socket || !this.socket.connected) return;
    const clientSendTime = Date.now();
    this.socket.emit('sync:ping', { clientSendTime });
  }

  private runInitialBurst() {
    let count = 0;
    const burstInterval = setInterval(() => {
      this.sendPing();
      count++;
      if (count >= 6) {
        clearInterval(burstInterval);
      }
    }, 150);
  }

  private handlePong(data: { clientSendTime: number; serverReceiveTime: number; serverSendTime: number }) {
    const clientReceiveTime = Date.now();
    const { clientSendTime, serverReceiveTime, serverSendTime } = data;

    // RTT = Total time minus server processing time
    const serverProcessingTime = Math.max(0, serverSendTime - serverReceiveTime);
    const rtt = Math.max(1, (clientReceiveTime - clientSendTime) - serverProcessingTime);
    const oneWayDelay = rtt / 2;

    // Clock Offset = ServerTime - (ClientSendTime + OneWayDelay)
    // Positive offset means Server is ahead of Client
    const offset = serverReceiveTime - (clientSendTime + oneWayDelay);

    this.samples.push({ rtt, offset, timestamp: clientReceiveTime });
    if (this.samples.length > 20) {
      this.samples.shift();
    }

    // Filter samples: keep the lowest 50% RTT samples (least network buffer delay)
    const sorted = [...this.samples].sort((a, b) => a.rtt - b.rtt);
    const bestSamples = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.6)));

    // Calculate median or weighted average
    const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;
    const avgRtt = bestSamples.reduce((sum, s) => sum + s.rtt, 0) / bestSamples.length;

    if (!this.isInitialized) {
      this.offsetMs = avgOffset;
      this.rttMs = avgRtt;
      this.isInitialized = true;
    } else {
      // Exponential Moving Average to smooth out spikes
      const alpha = 0.25;
      this.offsetMs = this.offsetMs * (1 - alpha) + avgOffset * alpha;
      this.rttMs = this.rttMs * (1 - alpha) + avgRtt * alpha;
    }

    // Notify listeners
    this.onUpdateCallbacks.forEach((cb) => cb(Math.round(this.rttMs), Math.round(this.offsetMs)));

    // Send latency report back to server
    if (this.socket && this.socket.connected) {
      this.socket.emit('sync:latency-report', { latencyMs: Math.round(this.rttMs / 2) });
    }
  }

  /**
   * Convert local phone time to estimated server time
   */
  public toServerTime(localTimeMs: number = Date.now()): number {
    return localTimeMs + this.offsetMs;
  }

  /**
   * Convert server timestamp to local phone time
   */
  public toLocalTime(serverTimeMs: number): number {
    return serverTimeMs - this.offsetMs;
  }

  public getOffset(): number {
    return this.offsetMs;
  }

  public getRtt(): number {
    return this.rttMs;
  }
}

export const clockSync = new ClockSync();
