# SyncPlay Mobile App (React Native / Expo)

Cross-platform mobile client for synchronized multi-device audio playback over local WiFi.

## Key Features
- **Host Mode**: Create rooms, display dynamic QR codes, choose audio (local phone files or built-in test tracks), seek/play/pause, and monitor connected speakers.
- **Guest Mode**: Scan QR code with camera or enter 5-digit room code, sync playback in real-time, view live sync health badge, and adjust local volume/boost mode.
- **SyncEngine**:
  - Sub-100ms synchronization across all devices.
  - Hard seek on track changes or large drift (>1000ms).
  - Micro-rate adjustments ($\pm 3-5\%$) with pitch preservation (`shouldCorrectPitch: true`) for gradual drift correction without audible jumps.
  - High latency / weak WiFi detection and warnings.
- **Background Audio**: Enabled for iOS and Android via `expo-av` audio session configuration and background modes.
- **Host Auto-Promotion**: If the host drops, the next connected guest is promoted seamlessly to Host.

## Running on Real Devices

### 1. Requirements
- Node.js installed on your computer.
- Expo Go app installed on your physical iOS or Android phones (available free in App Store & Google Play).
- Both your computer and phones connected to the **same WiFi network**.

### 2. Start the Backend Server First
In one terminal:
```bash
cd server
npm start
```
Note the IP address displayed (e.g. `http://192.168.1.50:4000`).

### 3. Start the Expo Mobile App
In another terminal:
```bash
cd app
npx expo start
```

### 4. Open on Devices
- **Android**: Scan the Metro QR code using the Expo Go app.
- **iOS**: Scan the Metro QR code using the iPhone Camera app, which opens Expo Go.
- On the home screen of SyncPlay:
  - If the server IP differs from the default, tap **Configure** and enter `http://<YOUR_COMPUTER_IP>:4000`.
  - Tap **Create New Room** on Phone 1 (Host).
  - Tap **Scan Host QR Code** on Phone 2 (Guest) and point the camera at Phone 1.
  - Both phones are now synced! Tap **Choose Track** on Phone 1 and hit **Play**!
