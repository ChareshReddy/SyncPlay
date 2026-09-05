/**
 * SyncPlay - Guest Speaker Screen
 * Receives synchronized audio stream, continuously micro-adjusts playback, and monitors WiFi health.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
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
    leaveRoom,
  } = useRoom();

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
});
