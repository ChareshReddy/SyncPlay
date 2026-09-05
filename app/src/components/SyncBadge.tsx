/**
 * SyncPlay - Sync Health & Network Latency Badge
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SyncStatus } from '../types';
import { colors } from '../theme/colors';

interface Props {
  syncStatus: SyncStatus;
}

export const SyncBadge: React.FC<Props> = ({ syncStatus }) => {
  const { driftMs, rttMs, isLocked, isAdjusting, warning } = syncStatus;

  let bg = colors.syncGoodBg;
  let borderColor = colors.syncGood;
  let textColor = colors.syncGood;
  let dotColor = '#10B981';
  let label = `Synced (±${Math.abs(driftMs)}ms)`;

  if (isAdjusting) {
    bg = colors.syncAdjustingBg;
    borderColor = colors.syncAdjusting;
    textColor = colors.syncAdjusting;
    dotColor = '#F59E0B';
    label = `Micro-adjusting (${driftMs > 0 ? '+' : ''}${driftMs}ms)`;
  } else if (!isLocked && Math.abs(driftMs) > 40) {
    bg = colors.syncAdjustingBg;
    borderColor = colors.syncAdjusting;
    textColor = colors.syncAdjusting;
    dotColor = '#F59E0B';
    label = `Aligning (${driftMs > 0 ? '+' : ''}${driftMs}ms)`;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: bg, borderColor }]}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
        <Text style={styles.rttText}>RTT: {rttMs}ms</Text>
      </View>

      {warning && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>⚠️ {warning}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  rttText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  warningContainer: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.syncWarningBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.syncWarning,
  },
  warningText: {
    fontSize: 11,
    color: colors.syncWarning,
    fontWeight: '500',
    textAlign: 'center',
  },
});
