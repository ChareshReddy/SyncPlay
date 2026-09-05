/**
 * SyncPlay - Server Automated Test Suite
 * Validates endpoints, room creation, socket signaling, clock sync,
 * host promotion, guest reconnection mid-playback, and monetization gating.
 */

const http = require('http');
const ioClient = require('socket.io-client');

// Import server
const serverProcess = require('./index');

const TEST_PORT = process.env.PORT || 4000;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpGet(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${SERVER_URL}${path}`, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
  });
}

async function runTests() {
  console.log('\n--- STARTING SYNCPLAY SERVER TEST SUITE ---\n');
  await sleep(1000);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. HTTP Health Check
    console.log('[1] Testing HTTP Health Check...');
    const health = await httpGet('/health');
    assert(health.statusCode === 200, 'GET /health returns 200 OK');
    const healthJson = JSON.parse(health.body);
    assert(healthJson.status === 'ok', 'GET /health status is "ok"');
    assert(Array.isArray(healthJson.ipAddresses), 'GET /health returns IP addresses array');

    // 2. HTTP Audio Samples
    console.log('\n[2] Testing HTTP Audio Samples...');
    const samples = await httpGet('/api/samples');
    assert(samples.statusCode === 200, 'GET /api/samples returns 200 OK');
    const samplesJson = JSON.parse(samples.body);
    assert(samplesJson.length >= 2, 'GET /api/samples returns built-in tracks');

    // 3. HTTP Audio Range Streaming
    console.log('\n[3] Testing HTTP Audio Range Streaming...');
    const rangeReq = await httpGet('/audio/samples/sync_beat.wav', { Range: 'bytes=0-1023' });
    assert(rangeReq.statusCode === 206, 'GET /audio/... with Range header returns 206 Partial Content');

    // 4. Socket.io Clock Sync (NTP Ping-Pong)
    console.log('\n[4] Testing Clock Sync (NTP Ping-Pong)...');
    const clientHost = ioClient(SERVER_URL, { reconnection: false });
    const clientGuest = ioClient(SERVER_URL, { reconnection: false });

    await new Promise((resolve) => clientHost.on('connect', resolve));
    await new Promise((resolve) => clientGuest.on('connect', resolve));

    assert(clientHost.connected && clientGuest.connected, 'Host and Guest clients connected to Socket.io');

    const pingPromise = new Promise((resolve) => {
      const t1 = Date.now();
      clientGuest.emit('sync:ping', { clientSendTime: t1 });
      clientGuest.on('sync:pong', (pong) => {
        const t4 = Date.now();
        const rtt = t4 - pong.clientSendTime;
        const oneWayDelay = rtt / 2;
        const serverOffset = pong.serverReceiveTime - (t1 + oneWayDelay);
        resolve({ rtt, serverOffset });
      });
    });

    const syncResult = await pingPromise;
    assert(syncResult.rtt >= 0, `Measured local loopback RTT: ${syncResult.rtt}ms`);
    assert(typeof syncResult.serverOffset === 'number', `Computed clock offset: ${syncResult.serverOffset}ms`);

    // 5. Room Creation & Joining
    console.log('\n[5] Testing Room Creation & Joining...');
    let roomCode = '';
    const createPromise = new Promise((resolve) => {
      clientHost.emit('room:create', { deviceName: 'Host iPhone' }, (response) => {
        resolve(response);
      });
    });

    const createRes = await createPromise;
    assert(createRes.success, 'Host successfully created room');
    assert(createRes.room.code && createRes.room.code.length === 5, `Room code generated: ${createRes.room.code}`);
    roomCode = createRes.room.code;

    const joinPromise = new Promise((resolve) => {
      clientGuest.emit('room:join', { roomCode, deviceName: 'Guest Pixel' }, (response) => {
        resolve(response);
      });
    });

    const joinRes = await joinPromise;
    assert(joinRes.success, 'Guest successfully joined room');
    assert(joinRes.room.totalDevices === 2, 'Room total devices updated to 2 (1 Host + 1 Guest)');

    // 6. Playback State Synchronization
    console.log('\n[6] Testing Playback State Synchronization...');
    const syncStatePromise = new Promise((resolve) => {
      clientGuest.on('room:sync-state', (state) => {
        resolve(state);
      });
    });

    clientHost.emit('room:sync-state', {
      isPlaying: true,
      positionMs: 4500,
      timestamp: Date.now(),
    });

    const receivedState = await syncStatePromise;
    assert(receivedState.isPlaying === true, 'Guest received isPlaying: true');
    assert(receivedState.positionMs === 4500, 'Guest received positionMs: 4500');
    assert(typeof receivedState.serverTimestamp === 'number', 'Guest received server timestamp');

    // 7. Host Disconnection & Auto-Promotion
    console.log('\n[7] Testing Host Disconnection & Auto-Promotion...');
    const promoPromise = new Promise((resolve) => {
      clientGuest.on('room:host-promoted', (promo) => {
        resolve(promo);
      });
    });

    // Host disconnects
    clientHost.disconnect();

    const promoRes = await promoPromise;
    assert(promoRes.newHostSocketId === clientGuest.id, 'Remaining guest was automatically promoted to Host!');

    clientGuest.disconnect();

    // 8. Guest Disconnect & Reconnect Mid-Playback with Position Resumption
    console.log('\n[8] Testing Guest Disconnect & Reconnect Mid-Playback...');
    const testHost = ioClient(SERVER_URL, { reconnection: false });
    await new Promise((resolve) => testHost.on('connect', resolve));

    const hostRoomRes = await new Promise((resolve) => {
      testHost.emit('room:create', { deviceName: 'DJ Host' }, resolve);
    });
    const activeRoomCode = hostRoomRes.room.code;

    // Set active playing track at 5000ms
    testHost.emit('room:set-track', {
      track: { url: 'http://test/sample.mp3', title: 'Dance Beat', durationMs: 120000 },
    });
    testHost.emit('room:sync-state', {
      isPlaying: true,
      positionMs: 5000,
      timestamp: Date.now(),
    });

    // Guest connects and joins mid-song
    let reconnectingGuest = ioClient(SERVER_URL, { reconnection: false });
    await new Promise((resolve) => reconnectingGuest.on('connect', resolve));

    const initialJoinRes = await new Promise((resolve) => {
      reconnectingGuest.emit('room:join', { roomCode: activeRoomCode, deviceName: 'Synced Speaker 1' }, resolve);
    });
    assert(initialJoinRes.success, 'Guest initially joined playing room');
    assert(initialJoinRes.room.playbackState.positionMs === 5000, 'Guest received initial playback position 5000ms');

    // Simulate network drop on guest
    console.log('  Simulating guest network drop...');
    reconnectingGuest.disconnect();

    // Host continues playing and advances position to 8500ms
    await sleep(200);
    const hostAdvanceTimestamp = Date.now();
    testHost.emit('room:sync-state', {
      isPlaying: true,
      positionMs: 8500,
      timestamp: hostAdvanceTimestamp,
    });

    // Guest reconnects with new socket
    console.log('  Guest reconnecting with new socket...');
    const reconnectedGuest = ioClient(SERVER_URL, { reconnection: false });
    await new Promise((resolve) => reconnectedGuest.on('connect', resolve));

    // Request current state on reconnect
    const stateOnReconnect = await new Promise((resolve) => {
      reconnectedGuest.emit('room:get-state', { roomCode: activeRoomCode }, resolve);
    });

    assert(stateOnReconnect.success, 'Reconnected guest fetched room state via room:get-state');
    assert(stateOnReconnect.playbackState.isPlaying === true, 'Playback is still playing on reconnect');
    assert(stateOnReconnect.playbackState.positionMs >= 8500, 'Playback position resumed at >= 8500ms (did NOT restart at 0)');

    // Compute expected target position with clock offset
    const elapsedSinceState = Date.now() - stateOnReconnect.playbackState.serverTimestamp;
    const computedTarget = stateOnReconnect.playbackState.positionMs + elapsedSinceState;
    assert(computedTarget >= 8500, `Computed target seek position (${computedTarget}ms) resumes accurately mid-track`);

    // Clean up
    reconnectedGuest.disconnect();
    testHost.disconnect();

    // 9. Monetization Gating (Free 5-Device Limit & Pro Upgrade)
    console.log('\n[9] Testing Monetization Gating (5-Device Free Limit & Pro Upgrade)...');
    const gateHost = ioClient(SERVER_URL, { reconnection: false });
    await new Promise((resolve) => gateHost.on('connect', resolve));

    const gateRoomRes = await new Promise((resolve) => {
      gateHost.emit('room:create', { deviceName: 'Free Tier Host', isPro: false }, resolve);
    });
    const gateRoomCode = gateRoomRes.room.code;
    assert(gateRoomRes.room.isPro === false, 'Room created in Free Tier (isPro: false)');

    // Listen for capacity alert on Host
    const capacityAlertPromise = new Promise((resolve) => {
      gateHost.on('room:capacity-limit-reached', (data) => {
        resolve(data);
      });
    });

    // Connect 4 guests (Total = 5 devices: 1 Host + 4 Guests)
    const guestSockets = [];
    for (let i = 1; i <= 4; i++) {
      const g = ioClient(SERVER_URL, { reconnection: false });
      await new Promise((resolve) => g.on('connect', resolve));
      const gJoin = await new Promise((resolve) => {
        g.emit('room:join', { roomCode: gateRoomCode, deviceName: `Free Guest ${i}` }, resolve);
      });
      assert(gJoin.success, `Guest ${i} joined successfully (Total devices: ${1 + i}/5)`);
      guestSockets.push(g);
    }

    // Now try to connect a 5th guest (6th device) -> Should be rejected
    const excessGuest = ioClient(SERVER_URL, { reconnection: false });
    await new Promise((resolve) => excessGuest.on('connect', resolve));

    const excessJoinRes = await new Promise((resolve) => {
      excessGuest.emit('room:join', { roomCode: gateRoomCode, deviceName: 'Excess Guest 5' }, resolve);
    });

    assert(excessJoinRes.success === false, '6th device was rejected in Free Tier');
    assert(excessJoinRes.code === 'ROOM_FULL_FREE_TIER', 'Error code is ROOM_FULL_FREE_TIER');

    const alertReceived = await capacityAlertPromise;
    assert(alertReceived.attemptedDeviceName === 'Excess Guest 5', 'Host received room:capacity-limit-reached alert with device name');
    assert(alertReceived.limit === 5, 'Host alert specifies limit of 5 devices');

    // Host upgrades room to Pro
    console.log('  Upgrading room to Pro tier...');
    const upgradeRes = await new Promise((resolve) => {
      gateHost.emit('room:upgrade-pro', { roomCode: gateRoomCode }, resolve);
    });
    assert(upgradeRes.success === true, 'Room upgraded to Pro via room:upgrade-pro');
    assert(upgradeRes.room.isPro === true, 'Room state reflects isPro: true');

    // 6th device joins again -> Should now succeed
    const proJoinRes = await new Promise((resolve) => {
      excessGuest.emit('room:join', { roomCode: gateRoomCode, deviceName: 'Excess Guest 5' }, resolve);
    });
    assert(proJoinRes.success === true, '6th device successfully joined after Pro upgrade!');
    assert(proJoinRes.room.totalDevices === 6, 'Total devices now 6 in Pro room');

    // Clean up
    excessGuest.disconnect();
    guestSockets.forEach((g) => g.disconnect());
    gateHost.disconnect();

    // 10. Live Audio Stream Relay (Start, Chunk Relay, Mid-Stream Join, Drop/Reconnect, Stop)
    console.log('\n[10] Testing Live Audio Stream Relay...');
    const streamHost = ioClient(SERVER_URL, { reconnection: false });
    const streamGuest1 = ioClient(SERVER_URL, { reconnection: false });
    await new Promise((resolve) => streamHost.on('connect', resolve));
    await new Promise((resolve) => streamGuest1.on('connect', resolve));

    // Host creates room and guest 1 joins in normal file mode
    const sRoomRes = await new Promise((resolve) => {
      streamHost.emit('room:create', { deviceName: 'Streamer Phone' }, resolve);
    });
    const sRoomCode = sRoomRes.room.code;
    await new Promise((resolve) => {
      streamGuest1.emit('room:join', { roomCode: sRoomCode, deviceName: 'Speaker 1' }, resolve);
    });

    // 10a: Host starts live stream
    console.log('  Testing stream:start...');
    const streamStartOnGuestPromise = new Promise((resolve) => {
      streamGuest1.on('room:stream-started', (data) => resolve(data));
    });

    const startAck = await new Promise((resolve) => {
      streamHost.emit('stream:start', {
        metadata: { sampleRate: 48000, channels: 2, bitDepth: 16 },
      }, resolve);
    });
    assert(startAck.success === true, 'Host successfully started live stream');

    const guestStreamStartData = await streamStartOnGuestPromise;
    assert(guestStreamStartData.mode === 'live_stream', 'Guest received room:stream-started with mode live_stream');
    assert(guestStreamStartData.metadata.sampleRate === 48000, 'Guest received stream metadata (48000Hz)');

    // 10b: Host sends audio chunk -> Guest receives it
    console.log('  Testing stream:chunk relay...');
    const chunkPromise = new Promise((resolve) => {
      streamGuest1.on('stream:chunk', (data) => resolve(data));
    });

    const mockChunk = {
      data: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8w',
      timestamp: Date.now(),
      seq: 1,
      rms: 0.35,
    };
    streamHost.emit('stream:chunk', mockChunk);

    const receivedChunk = await chunkPromise;
    assert(receivedChunk.seq === 1, 'Guest 1 received stream chunk seq: 1');
    assert(receivedChunk.data === mockChunk.data, 'Guest 1 received exact audio chunk data');
    assert(receivedChunk.rms === 0.35, 'Guest 1 received audio RMS level');

    // 10c: Guest 2 joins mid-stream
    console.log('  Testing mid-stream guest join...');
    const streamGuest2 = ioClient(SERVER_URL, { reconnection: false });
    await new Promise((resolve) => streamGuest2.on('connect', resolve));

    const midJoinRes = await new Promise((resolve) => {
      streamGuest2.emit('room:join', { roomCode: sRoomCode, deviceName: 'Speaker 2 (Mid-Stream)' }, resolve);
    });
    assert(midJoinRes.success === true, 'Guest 2 joined room mid-stream');
    assert(midJoinRes.room.mode === 'live_stream', 'Guest 2 room summary reflects active live_stream mode');
    assert(midJoinRes.room.streamMetadata.sampleRate === 48000, 'Guest 2 has streamMetadata immediately');

    // Guest 2 should immediately receive subsequent chunks
    const chunk2OnGuest2Promise = new Promise((resolve) => {
      streamGuest2.on('stream:chunk', (data) => resolve(data));
    });
    streamHost.emit('stream:chunk', {
      data: 'CHUNK_TWO_DATA',
      timestamp: Date.now(),
      seq: 2,
      rms: 0.42,
    });
    const receivedChunk2 = await chunk2OnGuest2Promise;
    assert(receivedChunk2.seq === 2, 'Mid-stream joined Guest 2 received next chunk seq: 2 immediately');

    // 10d: Guest 1 disconnects & reconnects during stream
    console.log('  Testing guest disconnect/reconnect during stream...');
    streamGuest1.disconnect();
    await sleep(100);

    const reconnectedGuest1 = ioClient(SERVER_URL, { reconnection: false });
    await new Promise((resolve) => reconnectedGuest1.on('connect', resolve));

    const reconnState = await new Promise((resolve) => {
      reconnectedGuest1.emit('room:get-state', { roomCode: sRoomCode }, resolve);
    });
    assert(reconnState.success === true, 'Reconnecting guest queried state');
    assert(reconnState.mode === 'live_stream', 'Reconnecting guest confirmed active live_stream mode');

    // 10e: Host stops live stream
    console.log('  Testing stream:stop...');
    const stopPromiseOnGuest2 = new Promise((resolve) => {
      streamGuest2.on('room:stream-stopped', (data) => resolve(data));
    });

    const stopAck = await new Promise((resolve) => {
      streamHost.emit('stream:stop', resolve);
    });
    assert(stopAck.success === true, 'Host successfully stopped live stream');

    const stopData = await stopPromiseOnGuest2;
    assert(stopData.mode === 'file', 'Guest received room:stream-stopped reverting mode to file');

    // Clean up
    streamHost.disconnect();
    streamGuest2.disconnect();
    reconnectedGuest1.disconnect();

    console.log(`\n========================================`);
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unexpected error during tests:', err);
    process.exit(1);
  }
}

runTests();
