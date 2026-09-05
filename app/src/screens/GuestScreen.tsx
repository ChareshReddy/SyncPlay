/**
 * SyncPlay - Guest Speaker Screen
 * Receives synchronized audio (file-based sync or live system audio relay),
 * handles network drop reconnection overlays, jitter buffer settings, and WiFi health monitoring.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRoom } from '../context/RoomContext';
import { colors } from '../theme/colors';
import { PlayerControls } from '../components/PlayerControls';
import { DeviceList } from '../components/DeviceList';
import { SyncBadge } from '../components/SyncBadge';
import { LiveWaveform } from '../components/LiveWaveform';
import { StreamSettingsModal } from '../components/StreamSettingsModal';

interface Props {
  onLeave: () => void;
  onPromotedToHost: () => void;
}

export const GuestScreen: React.FC<Props> = ({ onLeave, onPromotedToHost }) => {
  const {
    room,
    roomMode,
    isHost,
    currentTrack,
    playbackState,
    syncStatus,
    volume,
    setVolume,
    isBoostMode,
    setIsBoostMode,
    hostPromotedMessage,
    dismissHostPromoted,
    isReconnecting,
    reconnectFailed,
    rejoinSession,
    leaveRoom,
    streamBufferMs,
    setStreamBufferMs,
    streamStats,
    mySpeakerRole,
    isMonoSource,
  } = useRoom();

  const [isRejoiningManual, setIsRejoiningManual] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleLeavePress = () => {
    Alert.alert('Leave Session', 'Disconnect this speaker from the room?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await leaveRoom();
          onLeave();
        },
      },
    ]);
  };

  const handleManualRejoin = async () => {
    setIsRejoiningManual(true);
    const success = await rejoinSession();
    setIsRejoiningManual(false);
    if (!success) {
      Alert.alert(
        'Rejoin Failed',
        'Could not reconnect to the room. Make sure the Host is active and you are on the same WiFi.'
      );
    }
  };

  const roomCode = room?.code || '-----';
  const hostName = room?.hostDeviceName || 'Host';

  // If this device was promoted to host, show prompt
  if (isHost) {
    onPromotedToHost();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>📱 SPEAKER</Text>
          </View>

          <View style={styles.codePill}>
            <Text style={styles.codeLabel}>ROOM: </Text>
            <Text style={styles.codeValue}>{roomCode}</Text>
          </View>

          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeavePress}>
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Assigned Speaker Channel Badge */}
        <View style={styles.channelBar}>
          <View
            style={[
              styles.channelBadge,
              mySpeakerRole === 'left' && styles.channelBadgeLeft,
              mySpeakerRole === 'right' && styles.channelBadgeRight,
            ]}
          >
            <Text
              style={[
                styles.channelBadgeText,
                mySpeakerRole === 'left' && styles.channelBadgeTextLeft,
                mySpeakerRole === 'right' && styles.channelBadgeTextRight,
              ]}
            >
              {mySpeakerRole === 'left'
                ? '◀ LEFT SPEAKER'
                : mySpeakerRole === 'right'
                ? 'RIGHT SPEAKER ▶'
                : '◀▶ STEREO MIX (BOTH)'}
            </Text>
          </View>
          {isMonoSource && mySpeakerRole !== 'both' && (
            <View style={styles.monoNoticeBox}>
              <Text style={styles.monoNoticeText}>
                ⚠️ Source is mono — stereo split not available
              </Text>
            </View>
          )}
        </View>

        {/* Reconnecting Mid-Session Banner */}
        {isReconnecting && !reconnectFailed && (
          <View style={styles.reconnectingBanner}>
            <ActivityIndicator size="small" color={colors.syncAdjusting} style={{ marginRight: 8 }} />
            <Text style={styles.reconnectingText}>
              Reconnecting to room... Playback continuing
            </Text>
          </View>
        )}

        {/* Host Promotion Notification Banner */}
        {hostPromotedMessage && (
          <TouchableOpacity
            style={styles.promotionBanner}
            onPress={dismissHostPromoted}
          >
            <Text style={styles.promotionText}>👑 {hostPromotedMessage}</Text>
          </TouchableOpacity>
        )}

        {/* Live Audio Relay Mode View */}
        {roomMode === 'live_stream' ? (
          <View style={styles.liveStreamCard}>
            <View style={styles.liveStreamPill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveStreamPillText}>LIVE SYSTEM AUDIO RELAY</Text>
            </View>

            <Text style={styles.hostListeningTitle}>
              Listening to {hostName}'s phone
            </Text>
            <Text style={styles.hostListeningSubtitle}>
              Playing internal audio stream in real time
            </Text>

            <LiveWaveform isActive={true} rms={streamStats?.currentRms || 0.4} />

            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeLabel}>Buffer Delay</Text>
                <Text style={styles.statBadgeVal}>{streamBufferMs}ms</Text>
              </View>
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeLabel}>Loss</Text>
                <Text style={styles.statBadgeVal}>{streamStats?.packetLossPercent || 0}%</Text>
              </View>
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={() => setIsSettingsOpen(true)}
              >
                <Text style={styles.settingsBtnText}>⚙️ Advanced</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.videoDelayDisclaimer}>
              ℹ️ Video may appear slightly out of sync with audio on guest devices.
            </Text>

            {/* Local Volume Controls */}
            <View style={styles.volumeBox}>
              <Text style={styles.volumeBoxLabel}>Speaker Volume</Text>
              <View style={styles.volPresetsRow}>
                <TouchableOpacity
                  style={[styles.volPreset, volume <= 0.25 && styles.volPresetActive]}
                  onPress={() => setVolume(0.25)}
                >
                  <Text style={styles.volPresetText}>25%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.volPreset, volume > 0.25 && volume <= 0.5 && styles.volPresetActive]}
                  onPress={() => setVolume(0.5)}
                >
                  <Text style={styles.volPresetText}>50%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.volPreset, volume > 0.5 && volume <= 0.75 && styles.volPresetActive]}
                  onPress={() => setVolume(0.75)}
                >
                  <Text style={styles.volPresetText}>75%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.volPreset, volume > 0.75 && styles.volPresetActive]}
                  onPress={() => setVolume(1.0)}
                >
                  <Text style={styles.volPresetText}>MAX</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.boostToggleBtn, isBoostMode && styles.boostToggleBtnActive]}
                onPress={() => setIsBoostMode(!isBoostMode)}
              >
                <Text style={styles.boostToggleText}>
                  {isBoostMode ? '🚀 Boost Mode Active (Max Gain)' : '⚡ Enable Boost Mode'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Real-time Drift & Network Health Badge (File Mode) */}
            <SyncBadge syncStatus={syncStatus} />

            {/* Synced Audio Player (File Mode) */}
            <PlayerControls
              track={currentTrack}
              playbackState={playbackState}
              isHost={false}
              onTogglePlayPause={() => {}}
              onSeek={() => {}}
              volume={volume}
              onVolumeChange={setVolume}
              isBoostMode={isBoostMode}
              onToggleBoost={setIsBoostMode}
            />
          </>
        )}

        {/* Connected Speakers */}
        <DeviceList
          hostDeviceName={hostName}
          isHostDevice={false}
          guests={room?.guests || []}
          maxDevices={room?.maxDevices || 5}
        />
      </ScrollView>

      {/* Advanced Stream Settings Modal */}
      <StreamSettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        bufferDelayMs={streamBufferMs}
        onSelectBufferDelay={setStreamBufferMs}
        stats={streamStats}
      />

      {/* Disconnected Modal (when 15s retry window expires) */}
      <Modal
        visible={reconnectFailed}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIcon}>⚠️</Text>
            <Text style={styles.modalTitle}>Disconnected from Room</Text>
            <Text style={styles.modalSubtitle}>
              WiFi connection was interrupted and could not automatically reconnect within 15 seconds.
            </Text>

            <TouchableOpacity
              style={styles.rejoinButton}
              onPress={handleManualRejoin}
              disabled={isRejoiningManual}
            >
              {isRejoiningManual ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.rejoinButtonText}>🔄 Rejoin Room</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalLeaveBtn}
              onPress={async () => {
                await leaveRoom();
                onLeave();
              }}
            >
              <Text style={styles.modalLeaveBtnText}>Leave to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardActive,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  codeLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  codeValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 1.5,
  },
  leaveBtn: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  leaveBtnText: {
    color: colors.syncWarning,
    fontSize: 12,
    fontWeight: '600',
  },
  reconnectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.syncAdjustingBg,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.syncAdjusting,
    marginBottom: 10,
  },
  reconnectingText: {
    fontSize: 12,
    color: colors.syncAdjusting,
    fontWeight: '700',
  },
  promotionBanner: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 10,
  },
  promotionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  liveStreamCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  liveStreamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: 6,
  },
  liveStreamPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  hostListeningTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  hostListeningSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  statBadge: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statBadgeLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statBadgeVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  settingsBtn: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  settingsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  videoDelayDisclaimer: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: 8,
    paddingHorizontal: 10,
  },
  volumeBox: {
    width: '100%',
    backgroundColor: colors.cardActive,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  volumeBoxLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  volPresetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  volPreset: {
    flex: 1,
    backgroundColor: colors.cardBackground,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 3,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  volPresetActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
  },
  volPresetText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  boostToggleBtn: {
    backgroundColor: colors.cardBackground,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  boostToggleBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  boostToggleText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  rejoinButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  rejoinButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalLeaveBtn: {
    paddingVertical: 10,
  },
  modalLeaveBtnText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  channelBar: {
    marginBottom: 10,
    alignItems: 'center',
  },
  channelBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  channelBadgeLeft: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: colors.primary,
  },
  channelBadgeRight: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#c084fc',
  },
  channelBadgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  channelBadgeTextLeft: {
    color: colors.primary,
  },
  channelBadgeTextRight: {
    color: '#c084fc',
  },
  monoNoticeBox: {
    marginTop: 6,
    backgroundColor: colors.syncWarningBg,
    borderWidth: 1,
    borderColor: colors.syncWarning,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  monoNoticeText: {
    color: colors.syncWarning,
    fontSize: 11,
    fontWeight: '600',
  },
});
