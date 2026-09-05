/**
 * SyncPlay - Native Audio Capture Module Interface
 * Wraps Android AudioPlaybackCaptureConfiguration and MediaProjection.
 */

import { Platform } from 'react-native';
import { EventEmitter, NativeModule, requireNativeModule } from 'expo-modules-core';

export interface AudioChunkPayload {
  data: string; // base64 encoded PCM 16-bit stereo 48kHz
  timestamp: number;
  seq: number;
  rms: number;
}

export interface DrmBlockedPayload {
  message: string;
}

export interface CapturePermissionResult {
  granted: boolean;
  resultCode?: number;
  data?: any;
}

let nativeModule: any = null;
let eventEmitter: any = null;

try {
  if (Platform.OS === 'android') {
    nativeModule = requireNativeModule('SyncPlayAudioCapture');
    if (nativeModule) {
      eventEmitter = new EventEmitter(nativeModule);
    }
  }
} catch (err) {
  console.warn('SyncPlayAudioCapture native module not linked or running in Expo Go:', err);
}

export const isSystemCaptureSupported = (): boolean => {
  if (Platform.OS !== 'android') return false;
  if (nativeModule && typeof nativeModule.isSupported === 'function') {
    return nativeModule.isSupported();
  }
  return Platform.Version >= 29;
};

export const requestCapturePermission = async (): Promise<CapturePermissionResult> => {
  if (Platform.OS !== 'android') {
    throw new Error('Live audio capture is not supported on iOS due to OS restrictions');
  }

  if (nativeModule && typeof nativeModule.requestCapturePermission === 'function') {
    return await nativeModule.requestCapturePermission();
  }

  // Simulated fallback for development testing without native build
  console.log('[Native Module Fallback] Simulating Android capture permission consent');
  return { granted: true, resultCode: -1, data: {} };
};

export const startCapture = async (resultCode: number, resultData: any): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    throw new Error('Live audio capture is not supported on iOS due to OS restrictions');
  }

  if (nativeModule && typeof nativeModule.startCapture === 'function') {
    return await nativeModule.startCapture(resultCode, resultData);
  }

  return true;
};

export const stopCapture = async (): Promise<boolean> => {
  if (nativeModule && typeof nativeModule.stopCapture === 'function') {
    return await nativeModule.stopCapture();
  }
  return true;
};

export const startPlaybackStream = async (): Promise<boolean> => {
  if (nativeModule && typeof nativeModule.startPlaybackStream === 'function') {
    return await nativeModule.startPlaybackStream();
  }
  return true;
};

export const writeAudioChunk = (base64Data: string): void => {
  if (nativeModule && typeof nativeModule.writeAudioChunk === 'function') {
    nativeModule.writeAudioChunk(base64Data);
  }
};

export const stopPlaybackStream = async (): Promise<boolean> => {
  if (nativeModule && typeof nativeModule.stopPlaybackStream === 'function') {
    return await nativeModule.stopPlaybackStream();
  }
  return true;
};

export const addAudioChunkListener = (listener: (chunk: AudioChunkPayload) => void) => {
  if (eventEmitter) {
    return eventEmitter.addListener('onAudioChunk', listener);
  }
  return { remove: () => {} };
};

export const addDrmBlockedListener = (listener: (payload: DrmBlockedPayload) => void) => {
  if (eventEmitter) {
    return eventEmitter.addListener('onDrmBlocked', listener);
  }
  return { remove: () => {} };
};
