/**
 * SyncPlay - PCM Audio Processor
 * Handles stereo channel extraction (Left / Right / Both) and mono source detection for 16-bit PCM.
 */

import { toByteArray, fromByteArray } from 'base64-js';
import { SpeakerRole } from '../types';

export interface ProcessedAudioResult {
  data: string; // base64
  isMono: boolean;
}

export class PcmAudioProcessor {
  /**
   * Processes an interleaved 16-bit stereo PCM chunk (base64 encoded)
   * Interleaving: [L0_low, L0_high, R0_low, R0_high, L1_low, L1_high, ...]
   *
   * - If role === 'left': copies Left channel to Right channel ([L, L])
   * - If role === 'right': copies Right channel to Left channel ([R, R])
   * - If role === 'both': leaves untouched ([L, R])
   *
   * Detects if the source audio is mono (difference between L and R is near zero).
   */
  public static processChunk(
    base64Data: string,
    role: SpeakerRole = 'both'
  ): ProcessedAudioResult {
    if (!base64Data) {
      return { data: base64Data, isMono: false };
    }

    let bytes: Uint8Array;
    try {
      bytes = toByteArray(base64Data);
    } catch {
      return { data: base64Data, isMono: false };
    }

    // Must have at least 1 stereo frame (4 bytes = 2 bytes L + 2 bytes R)
    const frameCount = Math.floor(bytes.length / 4);
    if (frameCount === 0) {
      return { data: base64Data, isMono: false };
    }

    // 1. Detect mono vs stereo
    // Check mean difference between Left and Right 16-bit samples
    let totalDiff = 0;
    for (let i = 0; i < frameCount; i++) {
      const offset = i * 4;
      const leftSample = bytes[offset] | (bytes[offset + 1] << 8);
      const signedLeft = leftSample > 32767 ? leftSample - 65536 : leftSample;

      const rightSample = bytes[offset + 2] | (bytes[offset + 3] << 8);
      const signedRight = rightSample > 32767 ? rightSample - 65536 : rightSample;

      totalDiff += Math.abs(signedLeft - signedRight);
    }

    const avgDiff = totalDiff / frameCount;
    // If average difference is less than 50 (out of 32767), consider it mono
    const isMono = avgDiff < 50;

    // If source is mono, role 'left' and 'right' are equivalent to 'both'
    if (isMono || role === 'both') {
      return {
        data: base64Data,
        isMono,
      };
    }

    // Create a mutable copy of bytes for channel extraction
    const outputBytes = new Uint8Array(bytes);

    if (role === 'left') {
      // Duplicate Left channel to Right channel
      for (let i = 0; i < frameCount; i++) {
        const offset = i * 4;
        outputBytes[offset + 2] = outputBytes[offset];
        outputBytes[offset + 3] = outputBytes[offset + 1];
      }
    } else if (role === 'right') {
      // Duplicate Right channel to Left channel
      for (let i = 0; i < frameCount; i++) {
        const offset = i * 4;
        outputBytes[offset] = outputBytes[offset + 2];
        outputBytes[offset + 1] = outputBytes[offset + 3];
      }
    }

    return {
      data: fromByteArray(outputBytes),
      isMono: false,
    };
  }
}
