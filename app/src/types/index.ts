export type RoomMode = 'file' | 'live_stream';
export type SpeakerRole = 'both' | 'left' | 'right';

export interface Device {
  socketId: string;
  deviceName: string;
  latencyMs: number;
  joinedAt: number;
  speakerRole?: SpeakerRole;
}

export interface Track {
  url: string;
  title: string;
  artist?: string;
  durationMs: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  positionMs: number;
  serverTimestamp: number;
}

export interface StreamMetadata {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface AudioChunk {
  data: string; // base64 encoded PCM
  timestamp: number;
  seq: number;
  rms: number;
}

export interface StreamStats {
  bufferDelayMs: number;
  packetLossPercent: number;
  framesReceived: number;
  currentRms: number;
  isMonoSource?: boolean;
}

export interface RoomState {
  code: string;
  createdAt: number;
  hostSocketId: string;
  hostDeviceName: string;
  isPro: boolean;
  maxDevices: number;
  totalDevices: number;
  guests: Device[];
  mode: RoomMode;
  streamMetadata: StreamMetadata | null;
  currentTrack: Track | null;
  playbackState: PlaybackState;
}

export interface SyncStatus {
  driftMs: number;
  rttMs: number;
  offsetMs: number;
  isLocked: boolean;
  isAdjusting: boolean;
  statusText: string;
  warning: string | null;
}

export interface CapacityAlert {
  attemptedDeviceName: string;
  limit: number;
  roomCode: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
