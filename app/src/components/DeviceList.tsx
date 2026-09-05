/**
 * SyncPlay - Connected Devices List Component
 */

import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Device } from '../types';
import { colors } from '../theme/colors';

interface Props {
  hostDeviceName: string;
  isHostDevice: boolean;
  guests: Device[];
  maxDevices: number;
}

export const DeviceList: React.FC<Props> = ({
  hostDeviceName,
  isHostDevice,
  guests,
  maxDevices,
}) => {
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
            <Text style={styles.roleText}>Host Device</Text>
          </View>
        </View>
        <View style={styles.hostBadge}>
          <Text style={styles.hostBadgeText}>MASTER</Text>
        </View>
      </View>

      {/* Guest Devices */}
      {guests.map((item) => {
        const isLagging = item.latencyMs > 100;
        return (
          <View key={item.socketId} style={styles.deviceRow}>
            <View style={styles.deviceInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>📱</Text>
              </View>
              <View>
                <Text style={styles.deviceName}>{item.deviceName}</Text>
                <Text style={styles.roleText}>Synced Speaker</Text>
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
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
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
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  roleText: {
    fontSize: 12,
    color: colors.textSecondary,
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
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
});
