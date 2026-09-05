/**
 * SyncPlay - Socket.io Client Connection Manager
 * Manages WebSocket lifecycle, auto-reconnection, and server address switching.
 */

import { io, Socket } from 'socket.io-client';
import { clockSync } from '../sync/ClockSync';
import { ConnectionState } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private currentServerUrl: string = 'http://192.168.0.105:4000';
  private connectionStateListeners: Array<(state: ConnectionState) => void> = [];

  constructor() {}

  public getServerUrl(): string {
    return this.currentServerUrl;
  }

  public setServerUrl(url: string) {
    let clean = (url || '').trim();
    if (clean && !clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `http://${clean}`;
    }
    this.currentServerUrl = clean;
  }

  public onConnectionStateChange(cb: (state: ConnectionState) => void) {
    this.connectionStateListeners.push(cb);
    return () => {
      this.connectionStateListeners = this.connectionStateListeners.filter((c) => c !== cb);
    };
  }

  private notifyState(state: ConnectionState) {
    this.connectionStateListeners.forEach((cb) => cb(state));
  }

  public connect(url?: string): Promise<Socket> {
    if (url) {
      this.setServerUrl(url);
    }

    if (this.socket && this.socket.connected) {
      return Promise.resolve(this.socket);
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.notifyState('connecting');

    return new Promise((resolve, reject) => {
      const socket = io(this.currentServerUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      socket.on('connect', () => {
        console.log(`Connected to SyncPlay server: ${this.currentServerUrl}`);
        this.notifyState('connected');
        clockSync.start(socket);
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        console.warn('Socket connection error:', err.message);
        this.notifyState('disconnected');
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.notifyState('disconnected');
        clockSync.stop();
      });

      socket.on('reconnect_attempt', () => {
        this.notifyState('connecting');
      });

      this.socket = socket;
    });
  }

  public disconnect() {
    if (this.socket) {
      clockSync.stop();
      this.socket.disconnect();
      this.socket = null;
      this.notifyState('disconnected');
    }
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public isConnected(): boolean {
    return Boolean(this.socket && this.socket.connected);
  }
}

export const socketService = new SocketService();
