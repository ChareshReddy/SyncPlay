# SyncPlay Backend Signaling & Audio Server

Lightweight Node.js + Express + Socket.io server providing real-time room signaling, Cristian's algorithm clock synchronization, and local audio streaming with HTTP 206 Partial Content range requests.

## Features
- **In-Memory Room Management**: 5-character room codes (`SYNC7`), host tracking, 5-device capacity limit (Free tier).
- **Automatic Host Failover**: If the host disconnects or leaves, the oldest connected guest device is automatically promoted to Host without breaking the session.
- **Clock Synchronization**: NTP / Cristian's algorithm ping-pong measuring RTT, network jitter, and sub-millisecond server clock offset.
- **Local Audio Upload & Stream**: Multipart file upload (`POST /upload`) allowing hosts to pick local audio files from their phones and stream them to all guests over WiFi with HTTP Range support.
- **Pre-bundled Test Samples**: Ready-to-play stereo click track (`sync_beat.wav`) and ambient groove (`melodic_groove.wav`) with sharp percussive beats for audible synchronization verification.
- **Zero-Config WiFi Discovery**: Automatically detects and displays local IPv4 network interfaces on startup (e.g. `http://192.168.1.50:4000`).

## Prerequisites
- Node.js (v18+)
- npm (v9+)

## Installation & Running

```bash
# 1. Navigate to server folder
cd server

# 2. Install dependencies (if not already done)
npm install

# 3. Generate sample audio tracks (already pre-generated)
npm run gen-samples

# 4. Start the server
npm start
```

## Running Automated Tests

```bash
npm test
```
Runs the automated test suite verifying HTTP health, sample streaming, Range headers, socket ping-pong clock sync, room creation/joining, state broadcasting, and host auto-promotion.

## Socket.io Events Reference

### Client -> Server
- `sync:ping`: `{ clientSendTime: number }` -> Pings server for clock offset.
- `sync:latency-report`: `{ latencyMs: number }` -> Reports measured client latency to display on host screen.
- `room:create`: `{ deviceName: string }` -> Creates a new room with caller as Host.
- `room:join`: `{ roomCode: string, deviceName: string }` -> Joins room as guest.
- `room:set-track`: `{ track: { url, title, artist, durationMs } }` -> Host sets active audio track.
- `room:sync-state`: `{ isPlaying: boolean, positionMs: number, timestamp: number }` -> Authoritative playback state broadcast.
- `room:leave`: Leaves room cleanly.

### Server -> Client
- `sync:pong`: `{ clientSendTime, serverReceiveTime, serverSendTime }`
- `room:device-joined`: `{ device: { socketId, deviceName, latencyMs }, totalDevices }`
- `room:device-left`: `{ socketId, deviceName, totalDevices }`
- `room:track-changed`: `{ track, playbackState }`
- `room:sync-state`: `{ isPlaying, positionMs, serverTimestamp }`
- `room:host-promoted`: `{ newHostSocketId, newHostDeviceName, roomSummary }`
- `room:guest-latency-updated`: `{ socketId, deviceName, latencyMs }`
