/**
 * SyncPlay - Time Synchronization & Latency Handlers
 * Implements high-precision clock sync (Cristian's algorithm / NTP) over WebSockets
 */

const roomManager = require('./rooms');

function setupSyncHandlers(io, socket) {
  /**
   * Clock Synchronization Ping-Pong
   * Client sends { clientSendTime: number }
   * Server immediately responds with { clientSendTime, serverReceiveTime, serverSendTime }
   */
  socket.on('sync:ping', (data) => {
    const serverReceiveTime = Date.now();
    const clientSendTime = (data && data.clientSendTime) || serverReceiveTime;

    socket.emit('sync:pong', {
      clientSendTime,
      serverReceiveTime,
      serverSendTime: Date.now(),
    });
  });

  /**
   * Guest device reports its measured RTT and one-way latency
   * This is stored and broadcast to the room host for live status display
   */
  socket.on('sync:latency-report', (data) => {
    const latencyMs = Number(data && data.latencyMs) || 0;
    const result = roomManager.updateLatency(socket.id, latencyMs);

    if (result) {
      const { roomCode, guest } = result;
      // Broadcast updated latency to all room members (especially the Host)
      io.to(roomCode).emit('room:guest-latency-updated', {
        socketId: socket.id,
        deviceName: guest.deviceName,
        latencyMs: guest.latencyMs,
      });
    }
  });
}

module.exports = { setupSyncHandlers };
