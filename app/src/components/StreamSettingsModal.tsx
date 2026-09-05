/**
 * SyncPlay - Advanced Live Stream Settings & Diagnostics Modal
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { StreamStats } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  bufferDelayMs: number;
  onSelectBufferDelay: (ms: number) => void;
  stats: StreamStats | null;
}

export const StreamSettingsModal: React.FC<Props> = ({
  visible,
  onClose,
  bufferDelayMs,
  onSelectBufferDelay,
  stats,
}) => {
  const presets = [
    { label: '100ms', desc: 'Ultra-low delay', value: 100 },
    { label: '150ms', desc: 'Balanced (Recommended)', value: 150 },
    { label: '300ms', desc: 'High stability (Weak WiFi)', value: 300 },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <Text style={styles.title}>Advanced Stream Settings</Text>
          <Text style={styles.subtitle}>
            Adjust receiver jitter buffer to trade latency for stability.
          </Text>

          <Text style={styles.sectionHeader}>Buffer Target Size</Text>
          <View style={styles.presetsRow}>
            {presets.map((preset) => {
              const isSelected = bufferDelayMs === preset.value;
              return (
                <TouchableOpacity
                  key={preset.value}
                  style={[styles.presetCard, isSelected && styles.presetCardActive]}
                  onPress={() => onSelectBufferDelay(preset.value)}
                >
                  <Text style={[styles.presetLabel, isSelected && styles.presetLabelActive]}>
                    {preset.label}
                  </Text>
                  <Text style={styles.presetDesc}>{preset.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionHeader}>Live Network Diagnostics</Text>
          <View style={styles.statsCard}>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Current Delay Target:</Text>
              <Text style={styles.statVal}>{bufferDelayMs}ms</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Packet Loss:</Text>
              <Text
                style={[
                  styles.statVal,
                  { color: (stats?.packetLossPercent || 0) > 3 ? colors.syncWarning : colors.syncGood },
                ]}
              >
                {stats?.packetLossPercent || 0}%
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statKey}>Frames Received:</Text>
              <Text style={styles.statVal}>{stats?.framesReceived || 0}</Text>
            </View>
          </View>

          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              ℹ️ Video may appear slightly out of sync with audio on guest devices. SyncPlay is optimized for multi-speaker music and party audio.
            </Text>
          </View>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  presetsRow: {
    marginBottom: 16,
    gap: 8,
  },
  presetCard: {
    backgroundColor: colors.cardActive,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  presetCardActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  presetLabelActive: {
    color: colors.accent,
  },
  presetDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statsCard: {
    backgroundColor: colors.cardActive,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statKey: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  disclaimerBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.syncAdjusting,
    marginBottom: 18,
  },
  disclaimerText: {
    fontSize: 11,
    color: colors.syncAdjusting,
    lineHeight: 16,
  },
  doneBtn: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
