/**
 * SyncPlay - Room Manager
 * Handles in-memory room state, device capacity, host auto-promotion, and playback tracking.
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
   */
  createRoom(hostSocketId, hostDeviceName = 'Host Device') {
    // Clean up any existing room this socket was in
    this.leaveRoom(hostSocketId);

    const roomCode = this.generateRoomCode();
    const room = {
      code: roomCode,
      createdAt: Date.now(),
      hostSocketId: hostSocketId,
      hostDeviceName: hostDeviceName,
      maxDevices: this.MAX_DEVICES_PER_ROOM,
      guests: new Map(), // socketId -> { socketId, deviceName, latencyMs, joinedAt }
      currentTrack: null, // { url, title, artist, durationMs }
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
   * Adds a guest device to an existing room
   */
  joinRoom(roomCode, socketId, deviceName = 'Guest Device') {
    const normalizedCode = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(normalizedCode);

    if (!room) {
      return { success: false, error: 'Room not found. Check the code and try again.' };
    }

    // Check device count (Host + Guests)
    const totalDevices = 1 + room.guests.size;
    if (totalDevices >= room.maxDevices && !room.guests.has(socketId) && room.hostSocketId !== socketId) {
      return {
        success: false,
        error: `Room is full (${room.maxDevices} devices max in free tier). Ask host to remove a device.`,
      };
    }

    // Clean up if this socket was in another room
    this.leaveRoom(socketId);

    // If socket is the host reconnecting, maintain host role
    if (room.hostSocketId === socketId) {
      room.hostDeviceName = deviceName;
    } else {
      room.guests.set(socketId, {
        socketId,
        deviceName,
        latencyMs: 0,
        joinedAt: Date.now(),
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
    }));

    return {
      code: room.code,
      createdAt: room.createdAt,
      hostSocketId: room.hostSocketId,
      hostDeviceName: room.hostDeviceName,
      maxDevices: room.maxDevices,
      totalDevices: 1 + guestList.length,
      guests: guestList,
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
