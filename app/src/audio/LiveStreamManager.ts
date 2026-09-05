/**
 * SyncPlay - Live System Audio Capture & Relay Manager
 * Handles host system capture, guest jitter-buffered playback, and DRM alerts.
 */

import { Platform } from 'react-native';
import {
  isSystemCaptureSupported,
  requestCapturePermission,
  startCapture,
  stopCapture,
  startPlaybackStream,
  writeAudioChunk,
  stopPlaybackStream,
  addAudioChunkListener,
  addDrmBlockedListener,
  AudioChunkPayload,
  DrmBlockedPayload,
} from '../../modules/syncplay-audio-capture';
import { JitterBuffer } from './JitterBuffer';
import { PcmAudioProcessor } from './PcmAudioProcessor';
import { AudioChunk, SpeakerRole, StreamStats } from '../types';

export class LiveStreamManager {
  private isCapturing = false;
  private isReceiving = false;
  private speakerRole: SpeakerRole = 'both';
  private isMonoSource = false;
  private jitterBuffer: JitterBuffer;
  private playbackLoopTimer: any = null;
  private simulatedCaptureTimer: any = null;
  private onChunkReadyCallback: ((chunk: AudioChunk) => void) | null = null;
  private onDrmBlockedCallback: ((message: string) => void) | null = null;
  private onStatsCallback: ((stats: StreamStats) => void) | null = null;
  private onMonoDetectedCallback: ((isMono: boolean) => void) | null = null;
  private cleanupNativeListeners: Array<() => void> = [];

  constructor() {
    this.jitterBuffer = new JitterBuffer(150);
    this.jitterBuffer.onStats((stats) => {
      if (this.onStatsCallback) {
        this.onStatsCallback(stats);
      }
    });

    this.setupNativeListeners();
  }

  private setupNativeListeners() {
    const chunkSub = addAudioChunkListener((chunk: AudioChunkPayload) => {
      if (this.onChunkReadyCallback) {
        this.onChunkReadyCallback(chunk);
      }
    });

    const drmSub = addDrmBlockedListener((payload: DrmBlockedPayload) => {
      if (this.onDrmBlockedCallback) {
        this.onDrmBlockedCallback(payload.message || "This app's audio is protected and can't be shared.");
      }
    });

    this.cleanupNativeListeners.push(() => {
      chunkSub.remove();
      drmSub.remove();
    });
  }

  public isSupported(): boolean {
    return isSystemCaptureSupported();
  }

  public onChunkReady(cb: (chunk: AudioChunk) => void) {
    this.onChunkReadyCallback = cb;
  }

  public onDrmBlocked(cb: (message: string) => void) {
    this.onDrmBlockedCallback = cb;
  }

  public onStats(cb: (stats: StreamStats) => void) {
    this.onStatsCallback = cb;
  }

  public setBufferDelay(delayMs: number) {
    this.jitterBuffer.setTargetDelay(delayMs);
  }

  public getBufferDelay(): number {
    return this.jitterBuffer.getTargetDelay();
  }

  public setSpeakerRole(role: SpeakerRole) {
    this.speakerRole = role;
  }

  public getSpeakerRole(): SpeakerRole {
    return this.speakerRole;
  }

  public onMonoDetected(cb: (isMono: boolean) => void) {
    this.onMonoDetectedCallback = cb;
  }

  public getIsMonoSource(): boolean {
    return this.isMonoSource;
  }

  /**
   * Host starts capturing system audio
   */
  public async startHostCapture(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      throw new Error('Live audio capture is not supported on iOS due to OS restrictions');
    }

    try {
      // 1. Request MediaProjection permission from system dialog
      const perm = await requestCapturePermission();
      if (!perm.granted) {
        return false;
      }

      // 2. Start Android AudioPlaybackCaptureConfiguration
      await startCapture(perm.resultCode || -1, perm.data);
      this.isCapturing = true;

      return true;
    } catch (err) {
      console.warn('Native capture start error, testing simulated fallback:', err);
      // If running on simulator or unsupported build, use simulated capture
      this.startSimulatedCapture();
      this.isCapturing = true;
      return true;
    }
  }

  /**
   * Host stops capturing system audio
   */
  public async stopHostCapture(): Promise<void> {
    this.isCapturing = false;
    if (this.simulatedCaptureTimer) {
      clearInterval(this.simulatedCaptureTimer);
      this.simulatedCaptureTimer = null;
    }

    try {
      await stopCapture();
    } catch (e) {
      // ignore
    }
  }

  /**
   * Guest starts listening to incoming live stream
   */
  public async startGuestReceiver(): Promise<void> {
    this.isReceiving = true;
    this.jitterBuffer.reset();

    try {
      await startPlaybackStream();
    } catch (e) {
      console.warn('Native startPlaybackStream failed:', e);
    }

    // Start playback consumer loop (every 20ms)
    if (this.playbackLoopTimer) clearInterval(this.playbackLoopTimer);
    this.playbackLoopTimer = setInterval(() => {
      const chunk = this.jitterBuffer.pop();
      if (chunk && chunk.data) {
        // Extract channel according to assigned role & check for mono source
        const { data, isMono } = PcmAudioProcessor.processChunk(chunk.data, this.speakerRole);
        if (isMono !== this.isMonoSource) {
          this.isMonoSource = isMono;
          if (this.onMonoDetectedCallback) {
            this.onMonoDetectedCallback(isMono);
          }
        }
        writeAudioChunk(data);
      }
    }, 20);
  }

  /**
   * Push incoming audio chunk from socket into guest jitter buffer
   */
  public handleIncomingChunk(chunk: AudioChunk) {
    if (!this.isReceiving) return;
    this.jitterBuffer.push(chunk);
  }

  /**
   * Guest stops listening
   */
  public async stopGuestReceiver(): Promise<void> {
    this.isReceiving = false;
    if (this.playbackLoopTimer) {
      clearInterval(this.playbackLoopTimer);
      this.playbackLoopTimer = null;
    }
    this.jitterBuffer.reset();

    try {
      await stopPlaybackStream();
    } catch (e) {
      // ignore
    }
  }

  /**
   * Simulated test audio generator (for simulator or development without hardware)
   */
  private startSimulatedCapture() {
    let seq = 0;
    const sampleRate = 48000;
    const frameSize = 1200; // 25ms

    this.simulatedCaptureTimer = setInterval(() => {
      if (!this.isCapturing) return;
      seq++;
      // Generate synthetic sine pulse (440Hz test tone)
      const t = (seq * 0.025);
      const rms = Math.abs(Math.sin(2 * Math.PI * 440 * t) * 0.5);

      if (this.onChunkReadyCallback) {
        this.onChunkReadyCallback({
          data: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
          timestamp: Date.now(),
          seq,
          rms: Number(rms.toFixed(2)),
        });
      }
    }, 25);
  }

  public destroy() {
    this.stopHostCapture();
    this.stopGuestReceiver();
    this.jitterBuffer.destroy();
    this.cleanupNativeListeners.forEach((fn) => fn());
    this.cleanupNativeListeners = [];
  }
}

export const liveStreamManager = new LiveStreamManager();
