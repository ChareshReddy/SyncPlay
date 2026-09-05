/**
 * SyncPlay - Host Session Screen
 * Gives host full control of audio selection, playback, seeking, room monitoring,
 * and handles monetization capacity gating alerts when a 6th device tries to join.
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
  Modal,
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
    capacityAlert,
    dismissCapacityAlert,
    upgradeToPro,
  } = useRoom();

  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

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

  const handleUpgradePress = async () => {
    setIsUpgrading(true);
    const success = await upgradeToPro();
    setIsUpgrading(false);
    if (success) {
      Alert.alert(
        'Pro Activated!',
        'Your room now supports unlimited connected speakers and future remote rooms.'
      );
    }
  };

  const roomCode = room?.code || '-----';
  const isPro = Boolean(room?.isPro);

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

        {/* Tier Status Badge */}
        <View style={styles.tierBar}>
          {isPro ? (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>✨ PRO TIER: UNLIMITED SPEAKERS</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.freeTierBadge}
              onPress={handleUpgradePress}
            >
              <Text style={styles.freeTierText}>
                FREE TIER (Max 5 Speakers) • <Text style={styles.upgradeLink}>Upgrade to Pro</Text>
              </Text>
            </TouchableOpacity>
          )}
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

      {/* Capacity Gating Modal (Prompt when 6th device tries to join) */}
      <Modal
        visible={Boolean(capacityAlert)}
        transparent
        animationType="slide"
        onRequestClose={dismissCapacityAlert}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.upgradeBox}>
            <Text style={styles.upgradeEmoji}>🚀</Text>
            <Text style={styles.upgradeTitle}>Upgrade to Add More Speakers</Text>
            <Text style={styles.upgradeMessage}>
              "{capacityAlert?.attemptedDeviceName}" tried to join your session, but the free tier is limited to {capacityAlert?.limit} devices.
            </Text>

            <View style={styles.featureList}>
              <Text style={styles.featureItem}>✓ Connect unlimited phone speakers</Text>
              <Text style={styles.featureItem}>✓ Remote rooms over internet (coming soon)</Text>
              <Text style={styles.featureItem}>✓ No ads, no weekly subscriptions</Text>
            </View>

            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={handleUpgradePress}
              disabled={isUpgrading}
            >
              <Text style={styles.upgradeButtonText}>
                {isUpgrading ? 'Activating Pro...' : 'Upgrade to SyncPlay Pro'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissButton}
              onPress={dismissCapacityAlert}
            >
              <Text style={styles.dismissButtonText}>Maybe Later</Text>
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
    marginBottom: 10,
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
  tierBar: {
    alignItems: 'center',
    marginBottom: 6,
  },
  proBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  freeTierBadge: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  freeTierText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  upgradeLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  upgradeBox: {
    backgroundColor: colors.cardBackground,
    borderRadius: 22,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  upgradeEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  upgradeTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  upgradeMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  featureList: {
    width: '100%',
    backgroundColor: colors.cardActive,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  featureItem: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  upgradeButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dismissButton: {
    paddingVertical: 8,
  },
  dismissButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
