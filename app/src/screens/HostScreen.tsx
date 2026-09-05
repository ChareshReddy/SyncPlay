/**
 * SyncPlay - Host Session Screen
 * Gives host full control of audio selection, playback, seeking, and room monitoring.
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
} from 'react-native';
import { useRoom } from '../context/RoomContext';
import { colors } from '../theme/colors';
import { PlayerControls } from '../components/PlayerControls';
import { DeviceList } from '../components/DeviceList';
import { SyncBadge } from '../components/SyncBadge';
import { QRCodeModal } from '../components/QRCodeModal';
import { AudioPickerModal } from '../components/AudioPickerModal';

interface Props {
  onLeave: () => void;
}

export const HostScreen: React.FC<Props> = ({ onLeave }) => {
  const {
    serverUrl,
    room,
    currentTrack,
    playbackState,
    syncStatus,
    volume,
    setVolume,
    isBoostMode,
    setIsBoostMode,
    builtInSamples,
    selectTrack,
    togglePlayPause,
    seekTo,
    leaveRoom,
  } = useRoom();

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleLeavePress = () => {
    Alert.alert(
      'Leave Room',
      'If you leave, another connected guest will be automatically promoted to Host.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leaveRoom();
            onLeave();
          },
        },
      ]
    );
  };

  const roomCode = room?.code || '-----';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>👑 HOST</Text>
          </View>

          <TouchableOpacity
            style={styles.codePill}
            onPress={() => setIsQrOpen(true)}
          >
            <Text style={styles.codeLabel}>ROOM: </Text>
            <Text style={styles.codeValue}>{roomCode}</Text>
            <Text style={styles.qrIcon}> 📷</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeavePress}>
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Sync Health Badge */}
        <SyncBadge syncStatus={syncStatus} />

        {/* Audio Player Controls */}
        <PlayerControls
          track={currentTrack}
          playbackState={playbackState}
          isHost={true}
          onTogglePlayPause={togglePlayPause}
          onSeek={seekTo}
          volume={volume}
          onVolumeChange={setVolume}
          isBoostMode={isBoostMode}
          onToggleBoost={setIsBoostMode}
          onChangeTrackPress={() => setIsPickerOpen(true)}
        />

        {/* Connected Speakers List */}
        <DeviceList
          hostDeviceName={room?.hostDeviceName || 'Host Phone'}
          isHostDevice={true}
          guests={room?.guests || []}
          maxDevices={room?.maxDevices || 5}
        />
      </ScrollView>

      {/* QR Code Modal */}
      <QRCodeModal
        visible={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        roomCode={roomCode}
        serverUrl={serverUrl}
      />

      {/* Audio Picker Modal */}
      <AudioPickerModal
        visible={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelectTrack={selectTrack}
        builtInSamples={builtInSamples}
        serverUrl={serverUrl}
      />
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
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
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
    color: colors.accent,
    letterSpacing: 1.5,
  },
  qrIcon: {
    fontSize: 12,
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
});
