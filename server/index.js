/**
 * SyncPlay - Main Signaling & Audio Streaming Server
 * Real-time room synchronization & audio distribution over local WiFi.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const roomManager = require('./rooms');
const { setupSyncHandlers } = require('./sync');

const PORT = process.env.PORT || 4000;
const app = express();
const server = http.createServer(app);

// Enable CORS for mobile clients
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config for local audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Clean filename and add timestamp prefix
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${cleanName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (req, file, cb) => {
    // Accept standard audio formats
    const allowed = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
    if (file.originalname.match(allowed) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (mp3, wav, m4a, aac, ogg, flac) are allowed!'));
    }
  },
});

// Static routes for audio streaming (Express handles HTTP 206 Partial Content / Range requests)
app.use('/audio/samples', express.static(path.join(__dirname, 'public', 'audio')));
app.use('/audio/uploads', express.static(uploadsDir));

/**
 * Detect local network IPv4 addresses
 */
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const ifaceName in interfaces) {
    for (const iface of interfaces[ifaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

/**
 * Health Check Endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    roomsCount: roomManager.rooms.size,
    ipAddresses: getLocalIpAddresses(),
  });
});

/**
 * Network Info Endpoint (used by clients to resolve connection)
 */
app.get('/api/network-info', (req, res) => {
  const ips = getLocalIpAddresses();
  res.json({
    ips,
    port: PORT,
    recommendedUrl: `http://${ips[0]}:${PORT}`,
  });
});

/**
 * Available Built-in Samples Endpoint
 */
app.get('/api/samples', (req, res) => {
  const hostUrl = `${req.protocol}://${req.get('host')}`;
  res.json([
    {
      id: 'sample-sync-beat',
      title: 'Sync Beat (120 BPM Click Track)',
      artist: 'SyncPlay Built-in',
      durationMs: 20000,
      url: `${hostUrl}/audio/samples/sync_beat.wav`,
    },
    {
      id: 'sample-melodic-groove',
      title: 'Melodic Synth Groove',
      artist: 'SyncPlay Built-in',
      durationMs: 16000,
      url: `${hostUrl}/audio/samples/melodic_groove.wav`,
    },
  ]);
});

/**
 * Audio Upload Endpoint
 * Host phone uploads audio file so guests on the local WiFi can stream it
 */
app.post('/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const hostUrl = `${req.protocol}://${req.get('host')}`;
  const fileUrl = `${hostUrl}/audio/uploads/${req.file.filename}`;

  res.json({
    success: true,
    file: {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      url: fileUrl,
    },
  });
});

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

io.on('connection', (socket) => {
  // Attach time synchronization handlers
  setupSyncHandlers(io, socket);

  /**
   * Host creates a new room
   */
  socket.on('room:create', ({ deviceName, isPro }, callback) => {
    const room = roomManager.createRoom(socket.id, deviceName, { isPro });
    socket.join(room.code);

    const summary = roomManager.getRoomSummary(room.code);
    if (typeof callback === 'function') {
      callback({ success: true, room: summary });
    }
  });

  /**
   * Guest joins an existing room
   */
  socket.on('room:join', ({ roomCode, deviceName }, callback) => {
    const result = roomManager.joinRoom(roomCode, socket.id, deviceName);

    if (result.success) {
      socket.join(result.room.code);

      // Notify the rest of the room that a new device joined
      socket.to(result.room.code).emit('room:device-joined', {
        device: {
          socketId: socket.id,
          deviceName: deviceName || 'Guest Device',
          latencyMs: 0,
        },
        totalDevices: result.room.totalDevices,
      });

      if (typeof callback === 'function') {
        callback({ success: true, room: result.room, isHost: result.isHost });
      }
    } else {
      // If free tier limit was reached, alert the host phone to prompt for upgrade
      if (result.code === 'ROOM_FULL_FREE_TIER' && result.hostSocketId) {
        io.to(result.hostSocketId).emit('room:capacity-limit-reached', {
          attemptedDeviceName: deviceName || 'Guest Device',
          limit: roomManager.MAX_DEVICES_PER_ROOM,
          roomCode: result.roomCode,
        });
      }

      if (typeof callback === 'function') {
        callback({
          success: false,
          code: result.code || 'JOIN_FAILED',
          error: result.error,
        });
      }
    }
  });

  /**
   * Upgrades room to Pro tier (allows unlimited speakers)
   */
  socket.on('room:upgrade-pro', ({ roomCode }, callback) => {
    const summary = roomManager.setPro(roomCode, true);
    if (summary) {
      io.to(summary.code).emit('room:pro-upgraded', {
        isPro: true,
        room: summary,
      });
      if (typeof callback === 'function') {
        callback({ success: true, room: summary });
      }
    } else {
      if (typeof callback === 'function') {
        callback({ success: false, error: 'Room not found' });
      }
    }
  });

  /**
   * Fast state request for reconnecting guests
   */
  socket.on('room:get-state', ({ roomCode }, callback) => {
    const state = roomManager.getPlaybackState(roomCode);
    if (state && typeof callback === 'function') {
      callback({
        success: true,
        currentTrack: state.currentTrack,
        playbackState: state.playbackState,
        serverTimestamp: Date.now(),
      });
    } else if (typeof callback === 'function') {
      callback({ success: false, error: 'Room not found' });
    }
  });

  /**
   * Host sets current audio track
   */
  socket.on('room:set-track', ({ track }) => {
    const result = roomManager.setTrack(socket.id, track);
    if (result) {
      // Broadcast new track to all devices in the room (including host)
      io.to(result.roomCode).emit('room:track-changed', {
        track: result.currentTrack,
        playbackState: result.playbackState,
      });
    }
  });

  /**
   * Host broadcasts authoritative playback state (play, pause, seek, or periodic 500ms heartbeat)
   */
  socket.on('room:sync-state', ({ isPlaying, positionMs, timestamp }) => {
    const serverTimestamp = Date.now();
    const result = roomManager.updatePlaybackState(socket.id, {
      isPlaying,
      positionMs,
      serverTimestamp,
    });

    if (result) {
      // Broadcast synchronized state to all guests in the room
      socket.to(result.roomCode).emit('room:sync-state', {
        isPlaying: result.playbackState.isPlaying,
        positionMs: result.playbackState.positionMs,
        serverTimestamp: result.playbackState.serverTimestamp,
      });
    }
  });

  /**
   * Device explicitly leaves room
   */
  socket.on('room:leave', (callback) => {
    handleDeviceLeave(socket);
    if (typeof callback === 'function') {
      callback({ success: true });
    }
  });

  /**
   * Socket disconnects
   */
  socket.on('disconnect', () => {
    handleDeviceLeave(socket);
  });
});

/**
 * Handles device departure and host failover
 */
function handleDeviceLeave(socket) {
  const result = roomManager.leaveRoom(socket.id);
  if (!result) return;

  const { action, roomCode } = result;

  if (action === 'guest_left') {
    io.to(roomCode).emit('room:device-left', {
      socketId: socket.id,
      deviceName: result.departedGuest ? result.departedGuest.deviceName : 'Guest',
      totalDevices: result.roomSummary.totalDevices,
    });
  } else if (action === 'host_promoted') {
    // Notify room of the new host
    io.to(roomCode).emit('room:host-promoted', {
      newHostSocketId: result.newHostSocketId,
      newHostDeviceName: result.newHostDeviceName,
      roomSummary: result.roomSummary,
    });
  } else if (action === 'room_closed') {
    // Room empty and closed
  }
}

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log('====================================================');
  console.log('            🎵 SYNPLAY SIGNALING SERVER 🎵           ');
  console.log('====================================================');
  console.log(`Port: ${PORT}`);
  console.log('Connect mobile devices on the same WiFi to:');
  ips.forEach((ip) => {
    console.log(`  👉 http://${ip}:${PORT}`);
  });
  console.log('====================================================');
});
