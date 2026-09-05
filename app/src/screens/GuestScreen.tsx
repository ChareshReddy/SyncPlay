/**
 * SyncPlay - Guest Speaker Screen
 * Receives synchronized audio stream, continuously micro-adjusts playback,
 * handles network drop reconnection overlays, and WiFi health monitoring.
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

interface Props {
  onLeave: () => void;
  onPromotedToHost: () => void;
}

export const GuestScreen: React.FC<Props> = ({ onLeave, onPromotedToHost }) => {
  const {
    room,
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
  } = useRoom();

  const [isRejoiningManual, setIsRejoiningManual] = useState(false);

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

        {/* Real-time Drift & Network Health Badge */}
        <SyncBadge syncStatus={syncStatus} />

        {/* Synced Audio Player */}
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

        {/* Connected Speakers */}
        <DeviceList
          hostDeviceName={room?.hostDeviceName || 'Host Phone'}
          isHostDevice={false}
          guests={room?.guests || []}
          maxDevices={room?.maxDevices || 5}
        />
      </ScrollView>

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
});
