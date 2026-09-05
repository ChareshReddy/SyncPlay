/**
 * SyncPlay - Player Controls Component
 * Waveform visualizer, synced track timeline, host controls, and per-device volume/boost.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Track, PlaybackState } from '../types';
import { colors } from '../theme/colors';

interface Props {
  track: Track | null;
  playbackState: PlaybackState;
  isHost: boolean;
  onTogglePlayPause: () => void;
  onSeek: (positionMs: number) => void;
  volume: number;
  onVolumeChange: (vol: number) => void;
  isBoostMode: boolean;
  onToggleBoost: (enabled: boolean) => void;
  onChangeTrackPress?: () => void;
}

export const PlayerControls: React.FC<Props> = ({
  track,
  playbackState,
  isHost,
  onTogglePlayPause,
  onSeek,
  volume,
  onVolumeChange,
  isBoostMode,
  onToggleBoost,
  onChangeTrackPress,
}) => {
  const [currentPosition, setCurrentPosition] = useState(playbackState.positionMs);

  // Smooth position ticker while playing
  useEffect(() => {
    setCurrentPosition(playbackState.positionMs);

    if (playbackState.isPlaying) {
      const interval = setInterval(() => {
        setCurrentPosition((pos) => {
          const dur = track?.durationMs || 60000;
          return Math.min(dur, pos + 250);
        });
      }, 250);
      return () => clearInterval(interval);
    }
  }, [playbackState.isPlaying, playbackState.positionMs, track]);

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const duration = track?.durationMs || 20000;
  const progressPercent = Math.min(100, Math.max(0, (currentPosition / duration) * 100));

  const handleProgressBarPress = (e: any) => {
    if (!isHost) return;
    const { locationX } = e.nativeEvent;
    // Assuming container width ~ 300px, or we can use percentage
    // For simple touch seek:
    const targetMs = Math.round((locationX / 280) * duration);
    onSeek(Math.min(duration, Math.max(0, targetMs)));
  };

  return (
    <View style={styles.container}>
      {/* Waveform / Visualizer Art */}
      <View style={styles.artContainer}>
        <View
          style={[
            styles.outerRing,
            playbackState.isPlaying && styles.outerRingPulsing,
          ]}
        >
          <View
            style={[
              styles.innerRing,
              playbackState.isPlaying && styles.innerRingPulsing,
            ]}
          >
            <Text style={styles.artIcon}>
              {playbackState.isPlaying ? '🔊' : '🔈'}
            </Text>
          </View>
        </View>
      </View>

      {/* Track Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {track ? track.title : 'No Track Loaded'}
        </Text>
        <Text style={styles.artist}>
          {track ? track.artist || 'SyncPlay Audio' : 'Select audio to start'}
        </Text>
      </View>

      {/* Progress Timeline */}
      <View style={styles.timelineContainer}>
        <TouchableOpacity
          activeOpacity={isHost ? 0.7 : 1}
          style={styles.progressBarBg}
          onPress={handleProgressBarPress}
        >
          <View
            style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
          />
        </TouchableOpacity>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(currentPosition)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Host Control Buttons */}
      <View style={styles.controlsRow}>
        {isHost ? (
          <>
            <TouchableOpacity
              style={styles.trackSelectButton}
              onPress={onChangeTrackPress}
            >
              <Text style={styles.trackSelectText}>🎵 Choose Track</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.playPauseButton,
                playbackState.isPlaying && styles.pauseButton,
              ]}
              onPress={onTogglePlayPause}
            >
              <Text style={styles.playPauseIcon}>
                {playbackState.isPlaying ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.guestStatusBox}>
            <Text style={styles.guestStatusText}>
              {playbackState.isPlaying
                ? '▶ Playing in sync with Host'
                : '⏸ Playback paused by Host'}
            </Text>
          </View>
        )}
      </View>

      {/* Local Volume & Boost Mode Section */}
      <View style={styles.volumeCard}>
        <View style={styles.volumeRow}>
          <Text style={styles.volumeLabel}>Device Volume</Text>
          <View style={styles.volumeButtons}>
            <TouchableOpacity
              style={[styles.volBtn, volume <= 0.25 && styles.volBtnActive]}
              onPress={() => onVolumeChange(0.25)}
            >
              <Text style={styles.volBtnText}>25%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.volBtn,
                volume > 0.25 && volume <= 0.5 && styles.volBtnActive,
              ]}
              onPress={() => onVolumeChange(0.5)}
            >
              <Text style={styles.volBtnText}>50%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.volBtn,
                volume > 0.5 && volume <= 0.75 && styles.volBtnActive,
              ]}
              onPress={() => onVolumeChange(0.75)}
            >
              <Text style={styles.volBtnText}>75%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.volBtn, volume > 0.75 && styles.volBtnActive]}
              onPress={() => onVolumeChange(1.0)}
            >
              <Text style={styles.volBtnText}>MAX</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Boost Mode Toggle */}
        <View style={styles.boostRow}>
          <View>
            <Text style={styles.boostTitle}>🚀 Boost Mode</Text>
            <Text style={styles.boostSubtitle}>Max gain for quiet speakers</Text>
          </View>
          <Switch
            value={isBoostMode}
            onValueChange={onToggleBoost}
            trackColor={{ false: colors.sliderTrack, true: colors.accent }}
            thumbColor={isBoostMode ? '#FFFFFF' : '#94A3B8'}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  artContainer: {
    marginVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  outerRingPulsing: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  innerRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.cardActive,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  innerRingPulsing: {
    borderColor: colors.accent,
  },
  artIcon: {
    fontSize: 36,
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  artist: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  timelineContainer: {
    width: '100%',
    marginBottom: 16,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.sliderTrack,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 16,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  pauseButton: {
    backgroundColor: colors.primary,
  },
  playPauseIcon: {
    fontSize: 26,
    color: '#FFFFFF',
  },
  trackSelectButton: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  trackSelectText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  guestStatusBox: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  guestStatusText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  volumeCard: {
    width: '100%',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  volumeRow: {
    marginBottom: 14,
  },
  volumeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  volumeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  volBtn: {
    flex: 1,
    backgroundColor: colors.cardActive,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  volBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
  },
  volBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  boostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  boostTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  boostSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
