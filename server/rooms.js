/**
 * SyncPlay - Room Manager
 * Handles in-memory room state, device capacity, monetization gating (isPro),
 * host auto-promotion, and playback tracking.
 */

class RoomManager {
  constructor() {
    // Map of roomCode -> Room Object
    this.rooms = new Map();
    // Map of socketId -> roomCode
    this.socketToRoom = new Map();
    // Maximum devices per room (Free tier MVP)
    this.MAX_DEVICES_PER_ROOM = 5;
  }

  /**
   * Generates a clean 5-character alphanumeric room code
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars like O, 0, I, 1
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Creates a new room with the requesting socket as Host
   * @param {string} hostSocketId
   * @param {string} hostDeviceName
   * @param {object} options - { isPro: boolean }
   */
  createRoom(hostSocketId, hostDeviceName = 'Host Device', options = {}) {
    // Clean up any existing room this socket was in
    this.leaveRoom(hostSocketId);

    const roomCode = this.generateRoomCode();
    const room = {
      code: roomCode,
      createdAt: Date.now(),
      hostSocketId: hostSocketId,
      hostDeviceName: hostDeviceName,
      isPro: Boolean(options && options.isPro),
      maxDevices: this.MAX_DEVICES_PER_ROOM,
      guests: new Map(), // socketId -> { socketId, deviceName, latencyMs, joinedAt, speakerRole }
      assignedRoles: new Map(), // deviceName -> 'both' | 'left' | 'right' (persists across reconnects)
      currentTrack: null, // { url, title, artist, durationMs }
      mode: 'file', // 'file' | 'live_stream'
      streamMetadata: null, // { sampleRate, channels, bitDepth }
      playbackState: {
        isPlaying: false,
        positionMs: 0,
        serverTimestamp: Date.now(),
      },
    };

    this.rooms.set(roomCode, room);
    this.socketToRoom.set(hostSocketId, roomCode);

    return room;
  }

  /**
   * Upgrades a room session to Pro (unlimited devices, remote rooms)
   */
  setPro(roomCode, isPro = true) {
    const normalizedCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(normalizedCode);
    if (!room) return null;

    room.isPro = Boolean(isPro);
    return this.getRoomSummary(normalizedCode);
  }

  /**
   * Adds a guest device to an existing room
   */
  joinRoom(roomCode, socketId, deviceName = 'Guest Device') {
    const normalizedCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      return { success: false, error: 'Room not found. Check the code and try again.' };
    }

    // Check device count (Host + Guests)
    // Free tier = max 5 devices; Pro = unlimited
    const maxAllowed = room.isPro ? Infinity : room.maxDevices;
    const totalDevices = 1 + room.guests.size;

    if (totalDevices >= maxAllowed && !room.guests.has(socketId) && room.hostSocketId !== socketId) {
      return {
        success: false,
        code: 'ROOM_FULL_FREE_TIER',
        error: `Room is full (${room.maxDevices} devices max in free tier). Ask host to upgrade to Pro.`,
        roomCode: normalizedCode,
        hostSocketId: room.hostSocketId,
      };
    }

    // Clean up if this socket was in another room
    this.leaveRoom(socketId);

    // If socket is the host reconnecting, maintain host role
    if (room.hostSocketId === socketId) {
      room.hostDeviceName = deviceName;
    } else {
      const persistedRole = (room.assignedRoles && room.assignedRoles.get(deviceName)) || 'both';
      room.guests.set(socketId, {
        socketId,
        deviceName,
        latencyMs: 0,
        joinedAt: Date.now(),
        speakerRole: persistedRole,
      });
    }

    this.socketToRoom.set(socketId, normalizedCode);

    return {
      success: true,
      room: this.getRoomSummary(normalizedCode),
      isHost: room.hostSocketId === socketId,
    };
  }

  /**
   * Updates playback state (only callable by the current Host)
   */
  updatePlaybackState(socketId, { isPlaying, positionMs, serverTimestamp }) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room || room.hostSocketId !== socketId) return null;

    room.playbackState = {
      isPlaying: Boolean(isPlaying),
      positionMs: Math.max(0, Number(positionMs) || 0),
      serverTimestamp: Number(serverTimestamp) || Date.now(),
    };

    return {
      roomCode,
      playbackState: room.playbackState,
    };
  }

  /**
   * Sets the active audio track for the room (only callable by Host)
   */
  setTrack(socketId, track) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room || room.hostSocketId !== socketId) return null;

    room.currentTrack = {
      url: track.url,
      title: track.title || 'Untitled Track',
      artist: track.artist || 'Unknown Artist',
      durationMs: Number(track.durationMs) || 0,
    };

    // Reset playback position
    room.playbackState = {
      isPlaying: false,
      positionMs: 0,
      serverTimestamp: Date.now(),
    };

    return {
      roomCode,
      currentTrack: room.currentTrack,
      playbackState: room.playbackState,
    };
  }

  /**
   * Updates reported latency from a guest device
   */
  updateLatency(socketId, latencyMs) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    if (room.guests.has(socketId)) {
      const guest = room.guests.get(socketId);
      guest.latencyMs = Math.round(latencyMs);
      return { roomCode, guest };
    }

    return null;
  }

  /**
   * Handles a socket leaving or disconnecting.
   * If host leaves, automatically promotes the next guest to become host.
   */
  leaveRoom(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    // Check if the departing device is a guest
    if (room.guests.has(socketId)) {
      const departedGuest = room.guests.get(socketId);
      room.guests.delete(socketId);
      return {
        action: 'guest_left',
        roomCode,
        departedSocketId: socketId,
        departedGuest,
        roomSummary: this.getRoomSummary(roomCode),
      };
    }

    // If the departing device is the Host:
    if (room.hostSocketId === socketId) {
      if (room.guests.size > 0) {
        // Auto-promote the oldest connected guest to Host
        const [nextHostSocketId, nextHostData] = room.guests.entries().next().value;
        room.guests.delete(nextHostSocketId);
        room.hostSocketId = nextHostSocketId;
        room.hostDeviceName = nextHostData.deviceName;

        return {
          action: 'host_promoted',
          roomCode,
          oldHostSocketId: socketId,
          newHostSocketId: nextHostSocketId,
          newHostDeviceName: nextHostData.deviceName,
          roomSummary: this.getRoomSummary(roomCode),
        };
      } else {
        // No guests left; dissolve the room
        this.rooms.delete(roomCode);
        return {
          action: 'room_closed',
          roomCode,
        };
      }
    }

    return null;
  }

  /**
   * Assigns speaker role ('both' | 'left' | 'right') to a guest device
   * Callable only by the Host
   */
  setDeviceRole(hostSocketId, targetSocketId, role) {
    const roomCode = this.socketToRoom.get(hostSocketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room || room.hostSocketId !== hostSocketId) return null;

    const validRoles = ['both', 'left', 'right'];
    const assignedRole = validRoles.includes(role) ? role : 'both';

    if (room.guests.has(targetSocketId)) {
      const guest = room.guests.get(targetSocketId);
      guest.speakerRole = assignedRole;
      if (!room.assignedRoles) room.assignedRoles = new Map();
      room.assignedRoles.set(guest.deviceName, assignedRole);

      return {
        roomCode,
        targetSocketId,
        role: assignedRole,
        roomSummary: this.getRoomSummary(roomCode),
      };
    }

    return null;
  }

  /**
   * Returns a clean JSON summary of the room for clients
   */
  getRoomSummary(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const guestList = Array.from(room.guests.values()).map((g) => ({
      socketId: g.socketId,
      deviceName: g.deviceName,
      latencyMs: g.latencyMs || 0,
      joinedAt: g.joinedAt,
      speakerRole: g.speakerRole || 'both',
    }));

    return {
      code: room.code,
      createdAt: room.createdAt,
      hostSocketId: room.hostSocketId,
      hostDeviceName: room.hostDeviceName,
      isPro: Boolean(room.isPro),
      maxDevices: room.isPro ? 999 : room.maxDevices,
      totalDevices: 1 + guestList.length,
      guests: guestList,
      mode: room.mode || 'file',
      streamMetadata: room.streamMetadata || null,
      currentTrack: room.currentTrack,
      playbackState: room.playbackState,
    };
  }

  /**
   * Switches room between 'file' and 'live_stream' modes (only callable by Host)
   */
  setRoomMode(socketId, mode, streamMetadata = null) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room || room.hostSocketId !== socketId) return null;

    room.mode = mode === 'live_stream' ? 'live_stream' : 'file';
    room.streamMetadata = mode === 'live_stream' ? streamMetadata : null;

    if (room.mode === 'live_stream') {
      // Pause any file playback while streaming live audio
      room.playbackState.isPlaying = false;
    }

    return {
      roomCode,
      mode: room.mode,
      streamMetadata: room.streamMetadata,
      summary: this.getRoomSummary(roomCode),
    };
  }

  /**
   * Returns current playback state for fast mid-session re-sync
   */
  getPlaybackState(roomCode) {
    const room = this.rooms.get((roomCode || '').toUpperCase().trim());
    if (!room) return null;
    return {
      currentTrack: room.currentTrack,
      playbackState: room.playbackState,
    };
  }

  /**
   * Helper to get room by socket
   */
  getRoomBySocket(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    return roomCode ? this.rooms.get(roomCode) : null;
  }
}

module.exports = new RoomManager();
