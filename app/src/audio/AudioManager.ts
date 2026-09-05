/**
 * SyncPlay - Audio Manager
 * Wraps expo-av with background playback support, pitch-preserving micro rate adjustments, and seek controls.
 */

import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';

export class AudioManager {
  private sound: Audio.Sound | null = null;
  private currentUrl: string | null = null;
  private isLoaded = false;
  private currentVolume = 1.0;
  private isBoosted = false;
  private onStatusUpdateCb: ((status: AVPlaybackStatusSuccess) => void) | null = null;

  constructor() {
    this.configureAudioSession();
  }

  /**
   * Configure background audio playback mode for iOS & Android
   */
  public async configureAudioSession() {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
    } catch (e) {
      console.warn('Failed to configure Audio Mode:', e);
    }
  }

  /**
   * Load track from URL, optionally starting playback at an initial position
   */
  public async loadTrack(url: string, initialPositionMs = 0, shouldPlay = false): Promise<boolean> {
    try {
      if (this.currentUrl === url && this.sound && this.isLoaded) {
        // Track already loaded; seek to position
        await this.sound.setPositionAsync(Math.max(0, initialPositionMs));
        if (shouldPlay) {
          await this.sound.playAsync();
        } else {
          await this.sound.pauseAsync();
        }
        return true;
      }

      // Unload previous sound
      await this.unload();

      this.currentUrl = url;
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        {
          positionMillis: Math.max(0, initialPositionMs),
          shouldPlay: shouldPlay,
          rate: 1.0,
          shouldCorrectPitch: true,
          volume: this.getEffectiveVolume(),
          progressUpdateIntervalMillis: 100, // Frequent updates for tight sync monitoring
        },
        this.handlePlaybackStatusUpdate.bind(this)
      );

      this.sound = sound;
      this.isLoaded = true;
      return true;
    } catch (err) {
      console.error('Error loading audio track:', err);
      return false;
    }
  }

  public async play(): Promise<void> {
    if (!this.sound || !this.isLoaded) return;
    try {
      await this.sound.playAsync();
    } catch (e) {
      console.warn('Play error:', e);
    }
  }

  public async pause(): Promise<void> {
    if (!this.sound || !this.isLoaded) return;
    try {
      await this.sound.pauseAsync();
    } catch (e) {
      console.warn('Pause error:', e);
    }
  }

  public async setPosition(positionMs: number): Promise<void> {
    if (!this.sound || !this.isLoaded) return;
    try {
      await this.sound.setPositionAsync(Math.max(0, Math.round(positionMs)));
    } catch (e) {
      console.warn('Seek error:', e);
    }
  }

  /**
   * Adjust playback rate with pitch correction enabled
   * rate: e.g. 0.96 for slight slow-down, 1.04 for slight speed-up, 1.0 for normal
   */
  public async setRate(rate: number): Promise<void> {
    if (!this.sound || !this.isLoaded) return;
    try {
      // Clamped to subtle micro-adjust range (0.90 - 1.10) to avoid jarring pitch artifacts
      const clampedRate = Math.max(0.9, Math.min(1.1, rate));
      await this.sound.setRateAsync(clampedRate, true);
    } catch (e) {
      console.warn('Rate adjustment error:', e);
    }
  }

  public async setVolume(volume: number): Promise<void> {
    this.currentVolume = Math.max(0, Math.min(1.0, volume));
    if (!this.sound || !this.isLoaded) return;
    try {
      await this.sound.setVolumeAsync(this.getEffectiveVolume());
    } catch (e) {
      console.warn('Volume error:', e);
    }
  }

  public setBoostMode(enabled: boolean) {
    this.isBoosted = enabled;
    if (this.sound && this.isLoaded) {
      this.sound.setVolumeAsync(this.getEffectiveVolume());
    }
  }

  private getEffectiveVolume(): number {
    if (this.isBoosted) {
      return 1.0; // Max volume for boost
    }
    return this.currentVolume;
  }

  public async getStatus(): Promise<AVPlaybackStatusSuccess | null> {
    if (!this.sound || !this.isLoaded) return null;
    try {
      const status = await this.sound.getStatusAsync();
      if (status.isLoaded) {
        return status as AVPlaybackStatusSuccess;
      }
    } catch (e) {
      console.warn('Status error:', e);
    }
    return null;
  }

  public setStatusListener(cb: (status: AVPlaybackStatusSuccess) => void) {
    this.onStatusUpdateCb = cb;
  }

  private handlePlaybackStatusUpdate(status: AVPlaybackStatus) {
    if (status.isLoaded && this.onStatusUpdateCb) {
      this.onStatusUpdateCb(status as AVPlaybackStatusSuccess);
    }
  }

  public async unload(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (e) {
        // ignore unload error
      }
      this.sound = null;
      this.isLoaded = false;
      this.currentUrl = null;
    }
  }
}

export const audioManager = new AudioManager();
