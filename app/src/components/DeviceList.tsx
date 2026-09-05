/**
 * SyncPlay - Connected Devices List Component
 * Supports real-time speaker assignment (Left, Both, Right) with stereo channel splitting controls.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Device, SpeakerRole } from '../types';
import { colors } from '../theme/colors';

interface Props {
  hostDeviceName: string;
  isHostDevice: boolean;
  guests: Device[];
  maxDevices: number;
  onSetSpeakerRole?: (socketId: string, role: SpeakerRole) => void;
}

export const DeviceList: React.FC<Props> = ({
  hostDeviceName,
  isHostDevice,
  guests,
  maxDevices,
  onSetSpeakerRole,
}) => {
  const [showTooltip, setShowTooltip] = useState(true);
  const totalConnected = 1 + guests.length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Connected Speakers</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {totalConnected} / {maxDevices}
          </Text>
        </View>
      </View>

      {/* One-time Stereo Tooltip for Host */}
      {isHostDevice && showTooltip && guests.length > 0 && (
        <View style={styles.tooltipBox}>
          <View style={styles.tooltipContent}>
            <Text style={styles.tooltipIcon}>💡</Text>
            <Text style={styles.tooltipText}>
              Assign phones to Left or Right for stereo sound — place them on the matching side of the room.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowTooltip(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.tooltipDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Host Device Row */}
      <View style={styles.deviceRow}>
        <View style={styles.deviceInfo}>
          <View style={[styles.avatar, styles.hostAvatar]}>
            <Text style={styles.avatarText}>👑</Text>
          </View>
          <View>
            <Text style={styles.deviceName}>
              {hostDeviceName} {isHostDevice ? '(You)' : ''}
            </Text>
            <Text style={styles.roleText}>Host Controller</Text>
          </View>
        </View>
        <View style={styles.hostBadge}>
          <Text style={styles.hostBadgeText}>MASTER</Text>
        </View>
      </View>

      {/* Guest Devices */}
      {guests.map((item) => {
        const isLagging = item.latencyMs > 100;
        const currentRole = item.speakerRole || 'both';

        let roleLabel = 'Full Stereo Mix';
        if (currentRole === 'left') roleLabel = 'Left Channel Speaker';
        if (currentRole === 'right') roleLabel = 'Right Channel Speaker';

        return (
          <View key={item.socketId} style={styles.deviceCardRow}>
            <View style={styles.deviceRowMain}>
              <View style={styles.deviceInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>📱</Text>
                </View>
                <View>
                  <View style={styles.nameRow}>
                    <Text style={styles.deviceName}>{item.deviceName}</Text>
                    <View
                      style={[
                        styles.roleMiniBadge,
                        currentRole === 'left' && styles.roleMiniBadgeLeft,
                        currentRole === 'right' && styles.roleMiniBadgeRight,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleMiniBadgeText,
                          currentRole === 'left' && styles.roleMiniBadgeTextLeft,
                          currentRole === 'right' && styles.roleMiniBadgeTextRight,
                        ]}
                      >
                        {currentRole === 'left' ? '◀ L' : currentRole === 'right' ? 'R ▶' : '◀▶ Both'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.roleText}>{roleLabel}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.latencyBadge,
                  isLagging ? styles.latencyLagging : styles.latencyGood,
                ]}
              >
                <Text
                  style={[
                    styles.latencyText,
                    { color: isLagging ? colors.syncWarning : colors.syncGood },
                  ]}
                >
                  {item.latencyMs > 0 ? `${item.latencyMs}ms` : 'Syncing'}
                </Text>
              </View>
            </View>

            {/* Host Speaker Role Selector */}
            {isHostDevice && (
              <View style={styles.segmentedRow}>
                <Text style={styles.assignLabel}>Channel:</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      currentRole === 'left' && styles.segmentBtnActiveLeft,
                    ]}
                    onPress={() => onSetSpeakerRole && onSetSpeakerRole(item.socketId, 'left')}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        currentRole === 'left' && styles.segmentBtnTextActive,
                      ]}
                    >
                      ◀ Left
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      currentRole === 'both' && styles.segmentBtnActiveBoth,
                    ]}
                    onPress={() => onSetSpeakerRole && onSetSpeakerRole(item.socketId, 'both')}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        currentRole === 'both' && styles.segmentBtnTextActive,
                      ]}
                    >
                      Both
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      currentRole === 'right' && styles.segmentBtnActiveRight,
                    ]}
                    onPress={() => onSetSpeakerRole && onSetSpeakerRole(item.socketId, 'right')}
                  >
                    <Text
                      style={[
                        styles.segmentBtnText,
                        currentRole === 'right' && styles.segmentBtnTextActive,
                      ]}
                    >
                      Right ▶
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {guests.length === 0 && (
        <Text style={styles.emptyText}>
          Waiting for guest devices to connect... Share the room code or QR code!
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginVertical: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  countBadge: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  tooltipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    padding: 10,
    marginBottom: 12,
  },
  tooltipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tooltipIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  tooltipText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
  tooltipDismiss: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  deviceCardRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  deviceRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardActive,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  hostAvatar: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  avatarText: {
    fontSize: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginRight: 6,
  },
  roleMiniBadge: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleMiniBadgeLeft: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
  },
  roleMiniBadgeRight: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
  },
  roleMiniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  roleMiniBadgeTextLeft: {
    color: colors.primary,
  },
  roleMiniBadgeTextRight: {
    color: '#c084fc',
  },
  roleText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  hostBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  hostBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  latencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  latencyGood: {
    backgroundColor: colors.syncGoodBg,
    borderColor: colors.syncGood,
  },
  latencyLagging: {
    backgroundColor: colors.syncWarningBg,
    borderColor: colors.syncWarning,
  },
  latencyText: {
    fontSize: 11,
    fontWeight: '600',
  },
  segmentedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  assignLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  segmentBtnActiveLeft: {
    backgroundColor: colors.primary,
  },
  segmentBtnActiveBoth: {
    backgroundColor: colors.accent,
  },
  segmentBtnActiveRight: {
    backgroundColor: '#9333ea',
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: '#ffffff',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
});
