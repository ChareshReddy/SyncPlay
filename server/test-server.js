/**
 * SyncPlay - Server Automated Test Suite
 * Validates endpoints, room creation, socket signaling, clock sync, and host promotion.
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
