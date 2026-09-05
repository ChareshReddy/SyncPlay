# 🎵 SyncPlay — Portable Multi-Speaker Audio System

SyncPlay turns multiple smartphones into a synchronized multi-speaker sound system over local WiFi. One host phone controls playback (play, pause, seek, audio selection), and all connected guest phones play the exact same audio in lockstep with sub-100ms sync drift.

Unlike AmpMe, SyncPlay has **no deceptive weekly auto-renewing subscriptions, no hidden trials, and no cloud surveillance**.

---

## 📁 Repository Structure

```
SyncPlay/
├── app/                          # React Native mobile app (Expo SDK 54, iOS + Android)
│   ├── App.tsx                   # App root with navigation & background audio setup
│   ├── app.json                  # Native permissions (background audio, camera)
│   ├── src/
│   │   ├── api/
│   │   │   ├── socket.ts         # Socket.io connection manager & auto-reconnection
│   │   │   └── audioUpload.ts    # Multipart local audio file uploader
│   │   ├── audio/
│   │   │   └── AudioManager.ts   # expo-av wrapper with pitch-preserving rate adjust & boost
│   │   ├── components/
│   │   │   ├── AudioPickerModal.tsx # Audio selector (Local files + Built-in samples)
│   │   │   ├── DeviceList.tsx    # Connected speakers list with live ping indicators
│   │   │   ├── PlayerControls.tsx# Track visualizer, seek timeline, volume & boost toggle
│   │   │   ├── QRCodeModal.tsx   # Host dynamic QR code display
│   │   │   ├── QRScannerModal.tsx# Guest camera QR code scanner (expo-camera)
│   │   │   └── SyncBadge.tsx     # Live sync drift & WiFi health badge (<40ms green, >150ms warning)
│   │   ├── context/
│   │   │   └── RoomContext.tsx   # Global room state, host failover, playback sync
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx    # Mode selection (Host / Join / QR Scan), IP config
│   │   │   ├── HostScreen.tsx    # Host management view: room code, QR, controls, guest list
│   │   │   └── GuestScreen.tsx   # Guest synced listening view: latency monitor, volume, boost
│   │   ├── sync/
│   │   │   ├── ClockSync.ts      # Cristian's algorithm clock offset calculator & jitter filter
│   │   │   └── SyncEngine.ts     # Core drift detector, hard seek & micro-rate adjuster (±3-5%)
│   │   ├── theme/
│   │   │   └── colors.ts         # Futuristic audio aesthetic (deep violet & neon cyan)
│   │   └── types/
│   │       └── index.ts          # TypeScript type definitions
│   └── package.json
│
└── server/                       # Node.js + Express + Socket.io backend
    ├── index.js                  # Express server, Socket.io signaling, LAN IP auto-detection
    ├── rooms.js                  # In-memory room manager (host, guests, play state, auto-promotion)
    ├── sync.js                   # High-precision time sync handlers (NTP / Cristian's algorithm)
    ├── generate-samples.js       # Synthesizer generating click track WAV for instant testing
    ├── test-server.js            # Automated test suite (17 tests covering all server capabilities)
    ├── public/audio/             # Bundled royalty-free sample tracks
    ├── uploads/                  # Host-uploaded audio files
    └── package.json
```

---

## ⚡ Quick Start: Testing Locally on Real Devices

### Step 1: Connect to the Same WiFi
Ensure your computer and all testing smartphones are connected to the **same WiFi network**.

### Step 2: Start the Signaling Server
Open a terminal on your computer:
```bash
cd server
npm install
npm start
```
The server will print its local LAN IP addresses:
```
====================================================
            🎵 SYNPLAY SIGNALING SERVER 🎵           
====================================================
Port: 4000
Connect mobile devices on the same WiFi to:
  👉 http://192.168.1.50:4000
====================================================
```

### Step 3: Start the Expo Mobile App
Open a second terminal on your computer:
```bash
cd app
npm install
npx expo start
```
A QR code will appear in your terminal.

### Step 4: Open on Phones
- **Phone 1 (Host)**: 
  - Scan the Metro QR code with **Expo Go** (Android) or **Camera app** (iOS).
  - On the SyncPlay Home screen, tap **Configure** and verify the server URL matches `http://<YOUR_COMPUTER_IP>:4000`.
  - Tap **Create New Room**.
  - A 5-letter room code (e.g. `SYNC7`) and QR code modal will appear.
  - Tap **Choose Track** and pick the built-in `Sync Beat (120 BPM Click Track)` or upload a local song from your phone storage.

- **Phone 2 (Guest)**:
  - Open SyncPlay in Expo Go.
  - Tap **Scan Host QR Code** and point Phone 2's camera at Phone 1's screen.
  - Phone 2 joins immediately with zero manual typing!
  - Both devices will now play in perfect synchronization.

---

## 🧠 Synchronization Algorithm (The Core Hard Problem)

### 1. Clock Synchronization (Cristian's Algorithm + EMA Filter)
Mobile device internal clocks can differ by hundreds of milliseconds or drift seconds apart. NTP-style timestamp exchange solves this:
- Client sends ping at local time $T_1$.
- Server logs receive time $T_2$ and reply time $T_3$.
- Client logs reception at $T_4$.
- Round Trip Time: $RTT = (T_4 - T_1) - (T_3 - T_2)$.
- One-Way Delay: $D = RTT / 2$.
- Clock Offset: $\theta = T_2 - (T_1 + D)$.
- SyncPlay runs an initial burst of 6 rapid pings, filters out outliers, applies an Exponential Moving Average (EMA, $\alpha = 0.25$), and recalibrates every 5 seconds.
- Any client timestamp converts to server time: $T_{server}(t_{local}) = t_{local} + \theta$.

### 2. Authoritative Playback State & Target Position
- The Host phone holds authoritative state. Every 500ms (and instantly on play/pause/seek), the host emits:
  `{ isPlaying, positionMs, serverTimestamp }`.
- Any guest device calculates the true target position at any instant:
  $$P_{target} = \text{positionMs} + (\text{isPlaying} ? (T_{now\_server} - \text{serverTimestamp}) : 0)$$
- Drift measurement:
  $$\text{drift} = P_{guest} - P_{target}$$

### 3. Gradual Micro-Rate Correction (No Audible Jumps)
- **Large Drift / Initial Seek ($|\text{drift}| > 1000\text{ms}$)**:
  Hard seek: `sound.setPositionAsync(targetPosition)`.
- **Gradual Micro-Adjustment ($40\text{ms} < |\text{drift}| \le 1000\text{ms}$)**:
  Rather than pausing or jumping, SyncPlay slightly alters playback speed by $\pm 3-5\%$:
  - If guest is ahead ($\text{drift} > 0$): tempo slows to `0.96x`.
  - If guest is behind ($\text{drift} < 0$): tempo speeds up to `1.04x`.
  - Pitch correction is enabled (`shouldCorrectPitch: true`), making the speed micro-adjustment **completely imperceptible to human ears**.
- **Phase-Locked ($|\text{drift}| \le 40\text{ms}$)**:
  Playback returns to `1.00x`. Green badge displays `Synced (±18ms)`.

---

## 🛡️ Edge Cases Handled

| Edge Case | Solution in SyncPlay |
|---|---|
| **Guest joins mid-song** | Server sends current track and timestamped playback position. Guest loads audio, calculates $P_{target}$, seeks, and starts playing in sync. |
| **Host disconnects / leaves** | Server automatically promotes the oldest connected guest to Host (`room:host-promoted`), transferring playback controls without terminating the session. |
| **Network drop / WiFi stutter** | Socket.io auto-reconnects with exponential backoff. Guest silently re-syncs position and clock offset without restarting the song. |
| **Weak WiFi / High latency** | Continuous RTT monitoring. If RTT > 150ms, a warning banner alerts the user and displays ping on the Host device list. |
| **Background playback** | Configured `Audio.setAudioModeAsync({ staysActiveInBackground: true })` and iOS background audio entitlements. |
| **Phone volume differences** | Independent volume slider per device plus a **Boost Mode** switch for maximum gain on quieter phone speakers. |

---

## 💰 Monetization: Avoiding AmpMe's Mistakes
- **No auto-renewing weekly subscriptions or dark-pattern trial traps.**
- **Free Tier**: Unlimited hosting, up to 5 devices per room (enforced in `rooms.js`).
- **Fair Future Upgrade**: Optional one-time purchase or flat fair price to unlock unlimited devices and remote (non-LAN) rooms.
- **Zero forced sign-up to use core features.**
