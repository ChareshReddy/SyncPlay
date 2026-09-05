export interface Device {
  socketId: string;
  deviceName: string;
  latencyMs: number;
  joinedAt: number;
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

export interface RoomState {
  code: string;
  createdAt: number;
  hostSocketId: string;
  hostDeviceName: string;
  maxDevices: number;
  totalDevices: number;
  guests: Device[];
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

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
