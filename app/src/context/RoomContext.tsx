/**
 * SyncPlay - Room & Synchronization State Context
 * Orchestrates real-time room signaling, audio playback, host failover,
 * guest auto-reconnection, monetization gating, and live system audio relay.
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { socketService } from '../api/socket';
import { clockSync } from '../sync/ClockSync';
import { audioManager } from '../audio/AudioManager';
import { syncEngine } from '../sync/SyncEngine';
import { liveStreamManager } from '../audio/LiveStreamManager';
import { fetchSampleTracks } from '../api/audioUpload';
import {
  CapacityAlert,
  ConnectionState,
  Device,
  PlaybackState,
  RoomMode,
  RoomState,
  StreamStats,
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
  roomMode: RoomMode;
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
  // Guest Reconnect
  isReconnecting: boolean;
  reconnectFailed: boolean;
  rejoinSession: () => Promise<boolean>;
  // Monetization Gating
  capacityAlert: CapacityAlert | null;
  dismissCapacityAlert: () => void;
  upgradeToPro: () => Promise<boolean>;
  // Live System Audio Streaming
  isLiveStreaming: boolean;
  startLiveStream: () => Promise<boolean>;
  stopLiveStream: () => Promise<void>;
  drmWarning: string | null;
  dismissDrmWarning: () => void;
  streamBufferMs: number;
  setStreamBufferMs: (ms: number) => void;
  streamStats: StreamStats | null;
  // Playback & Room Actions
  createRoom: (isPro?: boolean) => Promise<boolean>;
  joinRoom: (code: string, customServerUrl?: string) => Promise<{ success: boolean; error?: string; code?: string }>;
  leaveRoom: () => Promise<void>;
  selectTrack: (track: Track) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

const STORAGE_KEY_SERVER = '@syncplay_server_url';
const STORAGE_KEY_DEVICE = '@syncplay_device_name';
const RECONNECT_TIMEOUT_MS = 15000; // 15s retry window

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [serverUrl, setServerUrlState] = useState<string>('http://192.168.0.105:4000');
  const [deviceName, setDeviceNameState] = useState<string>('My Phone');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomMode, setRoomMode] = useState<RoomMode>('file');
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

  // Reconnection State
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectFailed, setReconnectFailed] = useState<boolean>(false);

  // Monetization Gating
  const [capacityAlert, setCapacityAlert] = useState<CapacityAlert | null>(null);

  // Live System Audio Relay State
  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(false);
  const [drmWarning, setDrmWarning] = useState<string | null>(null);
  const [streamBufferMs, setStreamBufferMsState] = useState<number>(150);
  const [streamStats, setStreamStats] = useState<StreamStats | null>(null);

  const hostHeartbeatTimer = useRef<any>(null);
  const reconnectTimeoutTimer = useRef<any>(null);
  const isHostRef = useRef<boolean>(false);
  isHostRef.current = isHost;
  const roomRef = useRef<RoomState | null>(null);
  roomRef.current = room;
  const roomModeRef = useRef<RoomMode>('file');
  roomModeRef.current = roomMode;
  const deviceNameRef = useRef<string>(deviceName);
  deviceNameRef.current = deviceName;

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

  // Live stream manager listeners
  useEffect(() => {
    // When host captures a chunk, relay over socket
    liveStreamManager.onChunkReady((chunk) => {
      const socket = socketService.getSocket();
      if (socket && socket.connected && isHostRef.current && roomModeRef.current === 'live_stream') {
        socket.emit('stream:chunk', chunk);
      }
    });

    // When DRM silence is detected
    liveStreamManager.onDrmBlocked((msg) => {
      setDrmWarning(msg);
    });

    // When stream stats update
    liveStreamManager.onStats((stats) => {
      setStreamStats(stats);
    });
  }, []);

  // Connection state and auto-reconnect handling
  useEffect(() => {
    const unsubState = socketService.onConnectionStateChange((state) => {
      setConnectionState(state);

      // If guest socket disconnects mid-session:
      if (state === 'disconnected' && roomRef.current && !isHostRef.current) {
        console.log('Guest socket disconnected mid-session. Starting reconnect window...');
        setIsReconnecting(true);
        setReconnectFailed(false);

        // Start 15s retry timer. Do NOT stop audio playback!
        if (reconnectTimeoutTimer.current) clearTimeout(reconnectTimeoutTimer.current);
        reconnectTimeoutTimer.current = setTimeout(() => {
          console.warn('Guest reconnect window expired (15s).');
          setIsReconnecting(false);
          setReconnectFailed(true);
        }, RECONNECT_TIMEOUT_MS);
      }
    });

    const unsubReconnect = socketService.onReconnect(async (socket) => {
      // If we are a guest in an active room and socket reconnected:
      if (roomRef.current && !isHostRef.current) {
        console.log('Guest socket reconnected! Silently re-syncing room state...');
        if (reconnectTimeoutTimer.current) {
          clearTimeout(reconnectTimeoutTimer.current);
          reconnectTimeoutTimer.current = null;
        }

        await handleGuestSilentRejoin(socket, roomRef.current.code);
      }
    });

    return () => {
      unsubState();
      unsubReconnect();
      if (reconnectTimeoutTimer.current) clearTimeout(reconnectTimeoutTimer.current);
    };
  }, []);

  /**
   * Silently re-syncs state upon reconnection without restarting playback
   */
  const handleGuestSilentRejoin = (socket: any, roomCode: string): Promise<boolean> => {
    return new Promise((resolve) => {
      bindRoomEvents(socket);

      socket.emit(
        'room:join',
        { roomCode: roomCode.toUpperCase().trim(), deviceName: deviceNameRef.current },
        async (res: any) => {
          if (res && res.success) {
            setRoom(res.room);
            roomRef.current = res.room;
            setIsHost(res.isHost);
            isHostRef.current = res.isHost;

            const mode: RoomMode = res.room.mode || 'file';
            setRoomMode(mode);
            roomModeRef.current = mode;

            if (mode === 'live_stream') {
              // Reconnect during active live stream: start receiver directly
              await audioManager.pause();
              await liveStreamManager.startGuestReceiver();
            } else if (res.room.currentTrack) {
              setCurrentTrack(res.room.currentTrack);
              const { playbackState: hostState } = res.room;
              setPlaybackState(hostState);

              // Calculate exact target position with clock sync
              const currentServerTime = clockSync.toServerTime(Date.now());
              const elapsed = Math.max(0, currentServerTime - hostState.serverTimestamp);
              const targetPositionMs = hostState.positionMs + (hostState.isPlaying ? elapsed : 0);

              // Load or hard seek to target position
              await audioManager.loadTrack(res.room.currentTrack.url, targetPositionMs, hostState.isPlaying);
              await audioManager.setPosition(targetPositionMs);

              if (hostState.isPlaying) {
                await audioManager.play();
              } else {
                await audioManager.pause();
              }

              syncEngine.handleSyncState(hostState);
            }

            setIsReconnecting(false);
            setReconnectFailed(false);
            resolve(true);
          } else {
            console.warn('Rejoin failed on reconnect:', res?.error);
            setIsReconnecting(false);
            setReconnectFailed(true);
            resolve(false);
          }
        }
      );
    });
  };

  // Manual rejoin action when 15s retry window expired
  const rejoinSession = async (): Promise<boolean> => {
    if (!room) return false;
    setIsReconnecting(true);
    setReconnectFailed(false);

    // Reset 15s timer
    if (reconnectTimeoutTimer.current) clearTimeout(reconnectTimeoutTimer.current);
    reconnectTimeoutTimer.current = setTimeout(() => {
      setIsReconnecting(false);
      setReconnectFailed(true);
    }, RECONNECT_TIMEOUT_MS);

    const result = await joinRoom(room.code);
    if (result.success) {
      if (reconnectTimeoutTimer.current) clearTimeout(reconnectTimeoutTimer.current);
      setIsReconnecting(false);
      setReconnectFailed(false);
      return true;
    } else {
      setIsReconnecting(false);
      setReconnectFailed(true);
      return false;
    }
  };

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
   * While playing file audio, broadcasts current position every 500ms
   */
  useEffect(() => {
    if (isHost && roomMode === 'file' && playbackState.isPlaying) {
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
  }, [isHost, roomMode, playbackState.isPlaying]);

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
    socket.off('room:capacity-limit-reached');
    socket.off('room:pro-upgraded');
    socket.off('room:stream-started');
    socket.off('room:stream-stopped');
    socket.off('stream:chunk');

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

      // Load audio on device if in file mode
      if (roomModeRef.current === 'file') {
        await audioManager.loadTrack(track.url, newState.positionMs, newState.isPlaying);
        if (!isHostRef.current) {
          syncEngine.handleSyncState(newState);
        }
      }
    });

    // Authoritative sync state broadcast from host
    socket.on('room:sync-state', (newState: PlaybackState) => {
      setPlaybackState(newState);
      setRoom((prev) => (prev ? { ...prev, playbackState: newState } : null));

      if (!isHostRef.current && roomModeRef.current === 'file') {
        syncEngine.handleSyncState(newState);
      }
    });

    // Live Stream Started
    socket.on('room:stream-started', async ({ metadata, room: updatedRoom }: any) => {
      setRoomMode('live_stream');
      roomModeRef.current = 'live_stream';
      if (updatedRoom) setRoom(updatedRoom);

      if (!isHostRef.current) {
        // Pause any existing file audio
        await audioManager.pause();
        // Start streaming receiver
        await liveStreamManager.startGuestReceiver();
      }
    });

    // Live Stream Stopped
    socket.on('room:stream-stopped', async ({ room: updatedRoom }: any) => {
      setRoomMode('file');
      roomModeRef.current = 'file';
      setIsLiveStreaming(false);
      if (updatedRoom) setRoom(updatedRoom);

      if (!isHostRef.current) {
        await liveStreamManager.stopGuestReceiver();
      }
    });

    // Incoming Live Stream Chunk (Guest)
    socket.on('stream:chunk', (chunk: any) => {
      if (!isHostRef.current && roomModeRef.current === 'live_stream') {
        liveStreamManager.handleIncomingChunk(chunk);
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

    // Capacity limit reached alert (Host only)
    socket.on('room:capacity-limit-reached', (data: CapacityAlert) => {
      console.log('Capacity limit reached alert:', data);
      setCapacityAlert(data);
    });

    // Room upgraded to Pro
    socket.on('room:pro-upgraded', ({ room: updatedRoom }: { isPro: boolean; room: RoomState }) => {
      setRoom(updatedRoom);
      setCapacityAlert(null);
    });
  };

  const createRoom = async (isPro = false): Promise<boolean> => {
    try {
      const socket = await socketService.connect(serverUrl);
      bindRoomEvents(socket);

      return new Promise((resolve) => {
        socket.emit('room:create', { deviceName, isPro }, (res: any) => {
          if (res && res.success) {
            setIsHost(true);
            isHostRef.current = true;
            setRoom(res.room);
            roomRef.current = res.room;
            setRoomMode(res.room.mode || 'file');
            roomModeRef.current = res.room.mode || 'file';
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
  ): Promise<{ success: boolean; error?: string; code?: string }> => {
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
              roomRef.current = res.room;

              const mode: RoomMode = res.room.mode || 'file';
              setRoomMode(mode);
              roomModeRef.current = mode;

              if (mode === 'live_stream') {
                // Join mid-stream: immediately start receiving live stream
                await liveStreamManager.startGuestReceiver();
              } else if (res.room.currentTrack) {
                // Join mid-song file playback
                const currentServerTime = clockSync.toServerTime(Date.now());
                const elapsed = Math.max(0, currentServerTime - res.room.playbackState.serverTimestamp);
                const targetPos = res.room.playbackState.positionMs + (res.room.playbackState.isPlaying ? elapsed : 0);

                await audioManager.loadTrack(
                  res.room.currentTrack.url,
                  targetPos,
                  res.room.playbackState.isPlaying
                );
                syncEngine.startPeriodicCheck();
                syncEngine.handleSyncState(res.room.playbackState);
              }

              resolve({ success: true });
            } else {
              resolve({
                success: false,
                code: res?.code,
                error: res?.error || 'Failed to join room',
              });
            }
          }
        );
      });
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection error' };
    }
  };

  // Start Live System Audio Capture (Host)
  const startLiveStream = async (): Promise<boolean> => {
    if (!isHost || !room) return false;
    const socket = socketService.getSocket();
    if (!socket || !socket.connected) return false;

    try {
      // Pause any existing file playback
      if (playbackState.isPlaying) {
        await togglePlayPause();
      }

      // Start host audio capture
      const success = await liveStreamManager.startHostCapture();
      if (!success) return false;

      setIsLiveStreaming(true);
      setRoomMode('live_stream');
      roomModeRef.current = 'live_stream';

      // Inform server of stream start
      return new Promise((resolve) => {
        socket.emit(
          'stream:start',
          {
            metadata: { sampleRate: 48000, channels: 2, bitDepth: 16 },
          },
          (res: any) => {
            if (res && res.success) {
              setRoom(res.room);
              resolve(true);
            } else {
              resolve(false);
            }
          }
        );
      });
    } catch (err: any) {
      console.error('startLiveStream error:', err);
      throw err;
    }
  };

  // Stop Live System Audio Capture (Host)
  const stopLiveStream = async (): Promise<void> => {
    await liveStreamManager.stopHostCapture();
    setIsLiveStreaming(false);
    setRoomMode('file');
    roomModeRef.current = 'file';

    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('stream:stop', (res: any) => {
        if (res && res.room) {
          setRoom(res.room);
        }
      });
    }
  };

  const setStreamBufferMs = (ms: number) => {
    setStreamBufferMsState(ms);
    liveStreamManager.setBufferDelay(ms);
  };

  const dismissDrmWarning = () => {
    setDrmWarning(null);
  };

  const upgradeToPro = async (): Promise<boolean> => {
    if (!room) return false;
    const socket = socketService.getSocket();
    if (!socket || !socket.connected) return false;

    return new Promise((resolve) => {
      socket.emit('room:upgrade-pro', { roomCode: room.code }, (res: any) => {
        if (res && res.success) {
          setRoom(res.room);
          setCapacityAlert(null);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  };

  const dismissCapacityAlert = () => {
    setCapacityAlert(null);
  };

  const leaveRoom = async () => {
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('room:leave');
    }
    syncEngine.stopPeriodicCheck();
    await audioManager.unload();
    await liveStreamManager.stopHostCapture();
    await liveStreamManager.stopGuestReceiver();

    setIsHost(false);
    isHostRef.current = false;
    setRoom(null);
    roomRef.current = null;
    setRoomMode('file');
    roomModeRef.current = 'file';
    setIsLiveStreaming(false);
    setCurrentTrack(null);
    setPlaybackState({ isPlaying: false, positionMs: 0, serverTimestamp: Date.now() });
    setHostPromotedMessage(null);
    setIsReconnecting(false);
    setReconnectFailed(false);
    setCapacityAlert(null);
    setDrmWarning(null);
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
        roomMode,
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
        isReconnecting,
        reconnectFailed,
        rejoinSession,
        capacityAlert,
        dismissCapacityAlert,
        upgradeToPro,
        isLiveStreaming,
        startLiveStream,
        stopLiveStream,
        drmWarning,
        dismissDrmWarning,
        streamBufferMs,
        setStreamBufferMs,
        streamStats,
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
