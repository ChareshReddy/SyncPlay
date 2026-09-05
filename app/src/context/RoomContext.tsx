/**
 * SyncPlay - Room & Synchronization State Context
 * Orchestrates real-time room signaling, audio playback, host failover, and drift correction.
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socketService } from '../api/socket';
import { clockSync } from '../sync/ClockSync';
import { audioManager } from '../audio/AudioManager';
import { syncEngine } from '../sync/SyncEngine';
import { fetchSampleTracks } from '../api/audioUpload';
import {
  ConnectionState,
  Device,
  PlaybackState,
  RoomState,
  SyncStatus,
  Track,
} from '../types';

interface RoomContextType {
  serverUrl: string;
  setServerUrl: (url: string) => void;
  deviceName: string;
  setDeviceName: (name: string) => void;
  connectionState: ConnectionState;
  isHost: boolean;
  room: RoomState | null;
  currentTrack: Track | null;
  playbackState: PlaybackState;
  syncStatus: SyncStatus;
  volume: number;
  setVolume: (v: number) => void;
  isBoostMode: boolean;
  setIsBoostMode: (b: boolean) => void;
  hostPromotedMessage: string | null;
  dismissHostPromoted: () => void;
  builtInSamples: Track[];
  createRoom: () => Promise<boolean>;
  joinRoom: (code: string, customServerUrl?: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => Promise<void>;
  selectTrack: (track: Track) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

const STORAGE_KEY_SERVER = '@syncplay_server_url';
const STORAGE_KEY_DEVICE = '@syncplay_device_name';

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverUrl, setServerUrlState] = useState<string>('http://192.168.0.105:4000');
  const [deviceName, setDeviceNameState] = useState<string>('My Phone');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    positionMs: 0,
    serverTimestamp: Date.now(),
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    driftMs: 0,
    rttMs: 0,
    offsetMs: 0,
    isLocked: true,
    isAdjusting: false,
    statusText: 'Ready',
    warning: null,
  });
  const [volume, setVolumeState] = useState<number>(1.0);
  const [isBoostMode, setIsBoostModeState] = useState<boolean>(false);
  const [hostPromotedMessage, setHostPromotedMessage] = useState<string | null>(null);
  const [builtInSamples, setBuiltInSamples] = useState<Track[]>([]);

  const hostHeartbeatTimer = useRef<any>(null);
  const isHostRef = useRef<boolean>(false);
  isHostRef.current = isHost;

  // Load saved preferences
  useEffect(() => {
    (async () => {
      try {
        const savedServer = await AsyncStorage.getItem(STORAGE_KEY_SERVER);
        if (savedServer) setServerUrlState(savedServer);
        const savedDevice = await AsyncStorage.getItem(STORAGE_KEY_DEVICE);
        if (savedDevice) setDeviceNameState(savedDevice);
      } catch (e) {
        console.warn('Storage read error:', e);
      }
    })();
  }, []);

  const setServerUrl = (url: string) => {
    setServerUrlState(url);
    AsyncStorage.setItem(STORAGE_KEY_SERVER, url).catch(() => {});
  };

  const setDeviceName = (name: string) => {
    setDeviceNameState(name);
    AsyncStorage.setItem(STORAGE_KEY_DEVICE, name).catch(() => {});
  };

  // Sync state listener from syncEngine
  useEffect(() => {
    syncEngine.setStatusListener((status) => {
      setSyncStatus(status);
    });
  }, []);

  // Connection state listener from socketService
  useEffect(() => {
    return socketService.onConnectionStateChange((state) => {
      setConnectionState(state);
    });
  }, []);

  // Fetch sample tracks when serverUrl changes or connects
  const refreshSamples = async (url: string) => {
    const samples = await fetchSampleTracks(url);
    if (samples && samples.length > 0) {
      setBuiltInSamples(samples);
    }
  };

  useEffect(() => {
    if (serverUrl) {
      refreshSamples(serverUrl);
    }
  }, [serverUrl]);

  /**
   * Host Heartbeat Loop:
   * While playing, broadcasts current position every 500ms
   */
  useEffect(() => {
    if (isHost && playbackState.isPlaying) {
      if (hostHeartbeatTimer.current) clearInterval(hostHeartbeatTimer.current);
      hostHeartbeatTimer.current = setInterval(async () => {
        const status = await audioManager.getStatus();
        if (status && status.isLoaded) {
          const socket = socketService.getSocket();
          if (socket && socket.connected) {
            socket.emit('room:sync-state', {
              isPlaying: status.isPlaying,
              positionMs: status.positionMillis,
              timestamp: Date.now(),
            });
          }
        }
      }, 500);
    } else {
      if (hostHeartbeatTimer.current) {
        clearInterval(hostHeartbeatTimer.current);
        hostHeartbeatTimer.current = null;
      }
    }

    return () => {
      if (hostHeartbeatTimer.current) clearInterval(hostHeartbeatTimer.current);
    };
  }, [isHost, playbackState.isPlaying]);

  /**
   * Setup socket event listeners for the room
   */
  const bindRoomEvents = (socket: any) => {
    socket.off('room:device-joined');
    socket.off('room:device-left');
    socket.off('room:track-changed');
    socket.off('room:sync-state');
    socket.off('room:host-promoted');
    socket.off('room:guest-latency-updated');

    // New device joined
    socket.on('room:device-joined', ({ device, totalDevices }: { device: Device; totalDevices: number }) => {
      setRoom((prev) => {
        if (!prev) return null;
        const exists = prev.guests.some((g) => g.socketId === device.socketId);
        const newGuests = exists ? prev.guests : [...prev.guests, device];
        return { ...prev, totalDevices, guests: newGuests };
      });
    });

    // Device departed
    socket.on('room:device-left', ({ socketId, totalDevices }: { socketId: string; totalDevices: number }) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          totalDevices,
          guests: prev.guests.filter((g) => g.socketId !== socketId),
        };
      });
    });

    // Track changed by host
    socket.on('room:track-changed', async ({ track, playbackState: newState }: { track: Track; playbackState: PlaybackState }) => {
      setCurrentTrack(track);
      setPlaybackState(newState);
      setRoom((prev) => (prev ? { ...prev, currentTrack: track, playbackState: newState } : null));

      // Load audio on device
      await audioManager.loadTrack(track.url, newState.positionMs, newState.isPlaying);
      if (!isHostRef.current) {
        syncEngine.handleSyncState(newState);
      }
    });

    // Authoritative sync state broadcast from host
    socket.on('room:sync-state', (newState: PlaybackState) => {
      setPlaybackState(newState);
      setRoom((prev) => (prev ? { ...prev, playbackState: newState } : null));

      // Guest aligns local playback
      if (!isHostRef.current) {
        syncEngine.handleSyncState(newState);
      }
    });

    // Host departed -> Guest auto-promoted!
    socket.on('room:host-promoted', ({ newHostSocketId, newHostDeviceName, roomSummary }: any) => {
      setRoom(roomSummary);
      if (newHostSocketId === socket.id) {
        setIsHost(true);
        isHostRef.current = true;
        setHostPromotedMessage('The previous host disconnected. You are now the Room Host!');
      } else {
        setHostPromotedMessage(`${newHostDeviceName} is now the Room Host.`);
      }
    });

    // Guest latency updated
    socket.on('room:guest-latency-updated', ({ socketId, latencyMs }: { socketId: string; latencyMs: number }) => {
      setRoom((prev) => {
        if (!prev) return null;
        const updatedGuests = prev.guests.map((g) => (g.socketId === socketId ? { ...g, latencyMs } : g));
        return { ...prev, guests: updatedGuests };
      });
    });
  };

  const createRoom = async (): Promise<boolean> => {
    try {
      const socket = await socketService.connect(serverUrl);
      bindRoomEvents(socket);

      return new Promise((resolve) => {
        socket.emit('room:create', { deviceName }, (res: any) => {
          if (res && res.success) {
            setIsHost(true);
            isHostRef.current = true;
            setRoom(res.room);
            setCurrentTrack(res.room.currentTrack);
            setPlaybackState(res.room.playbackState);
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    } catch (e) {
      console.error('Create room error:', e);
      return false;
    }
  };

  const joinRoom = async (
    code: string,
    customServerUrl?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const targetUrl = customServerUrl || serverUrl;
      if (customServerUrl) {
        setServerUrl(customServerUrl);
      }

      const socket = await socketService.connect(targetUrl);
      bindRoomEvents(socket);

      return new Promise((resolve) => {
        socket.emit(
          'room:join',
          { roomCode: code.toUpperCase().trim(), deviceName },
          async (res: any) => {
            if (res && res.success) {
              setIsHost(res.isHost);
              isHostRef.current = res.isHost;
              setRoom(res.room);
              setCurrentTrack(res.room.currentTrack);
              setPlaybackState(res.room.playbackState);

              // If room already has a track playing, join mid-song!
              if (res.room.currentTrack) {
                await audioManager.loadTrack(
                  res.room.currentTrack.url,
                  res.room.playbackState.positionMs,
                  res.room.playbackState.isPlaying
                );
                syncEngine.startPeriodicCheck();
                syncEngine.handleSyncState(res.room.playbackState);
              }

              resolve({ success: true });
            } else {
              resolve({ success: false, error: res?.error || 'Failed to join room' });
            }
          }
        );
      });
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection error' };
    }
  };

  const leaveRoom = async () => {
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('room:leave');
    }
    syncEngine.stopPeriodicCheck();
    await audioManager.unload();
    setIsHost(false);
    isHostRef.current = false;
    setRoom(null);
    setCurrentTrack(null);
    setPlaybackState({ isPlaying: false, positionMs: 0, serverTimestamp: Date.now() });
    setHostPromotedMessage(null);
  };

  const selectTrack = async (track: Track) => {
    if (!isHost) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    setCurrentTrack(track);
    const initialPlayback = {
      isPlaying: false,
      positionMs: 0,
      serverTimestamp: Date.now(),
    };
    setPlaybackState(initialPlayback);

    // Host loads local sound
    await audioManager.loadTrack(track.url, 0, false);

    // Broadcast track selection to room
    socket.emit('room:set-track', { track });
  };

  const togglePlayPause = async () => {
    if (!isHost) return;
    const socket = socketService.getSocket();
    if (!socket || !currentTrack) return;

    const newPlayingState = !playbackState.isPlaying;
    const status = await audioManager.getStatus();
    const currentPos = status && status.isLoaded ? status.positionMillis : playbackState.positionMs;

    if (newPlayingState) {
      await audioManager.play();
    } else {
      await audioManager.pause();
    }

    const updatedState: PlaybackState = {
      isPlaying: newPlayingState,
      positionMs: currentPos,
      serverTimestamp: Date.now(),
    };

    setPlaybackState(updatedState);
    socket.emit('room:sync-state', updatedState);
  };

  const seekTo = async (positionMs: number) => {
    if (!isHost) return;
    const socket = socketService.getSocket();
    if (!socket || !currentTrack) return;

    await audioManager.setPosition(positionMs);

    const updatedState: PlaybackState = {
      isPlaying: playbackState.isPlaying,
      positionMs: Math.round(positionMs),
      serverTimestamp: Date.now(),
    };

    setPlaybackState(updatedState);
    socket.emit('room:sync-state', updatedState);
  };

  const setVolume = (v: number) => {
    setVolumeState(v);
    audioManager.setVolume(v);
  };

  const setIsBoostMode = (b: boolean) => {
    setIsBoostModeState(b);
    audioManager.setBoostMode(b);
  };

  const dismissHostPromoted = () => {
    setHostPromotedMessage(null);
  };

  return (
    <RoomContext.Provider
      value={{
        serverUrl,
        setServerUrl,
        deviceName,
        setDeviceName,
        connectionState,
        isHost,
        room,
        currentTrack,
        playbackState,
        syncStatus,
        volume,
        setVolume,
        isBoostMode,
        setIsBoostMode,
        hostPromotedMessage,
        dismissHostPromoted,
        builtInSamples,
        createRoom,
        joinRoom,
        leaveRoom,
        selectTrack,
        togglePlayPause,
        seekTo,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};
