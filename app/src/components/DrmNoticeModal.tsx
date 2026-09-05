/**
 * SyncPlay - DRM Audio Education & Consent Modal
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  visible: boolean;
  onProceed: () => void;
  onCancel: () => void;
}

export const DrmNoticeModal: React.FC<Props> = ({
  visible,
  onProceed,
  onCancel,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <Text style={styles.icon}>🎙️</Text>
          <Text style={styles.title}>Share Phone Audio (Beta)</Text>
          <Text style={styles.subtitle}>
            Broadcast internal audio from your phone to all connected speakers in real time.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.sectionHeader}>Supported Audio:</Text>
            <Text style={styles.supportedText}>
              ✓ YouTube videos (non-DRM){'\n'}
              ✓ Mobile games & sound effects{'\n'}
              ✓ Web browser audio & podcasts{'\n'}
              ✓ Local music/video player apps
            </Text>

            <View style={styles.divider} />

            <Text style={styles.sectionHeader}>Platform Restrictions (DRM):</Text>
            <Text style={styles.restrictedText}>
              ⚠️ Apps like Netflix, Prime Video, Disney+, Spotify, and JioCinema block audio capture at the Android OS level. If you play DRM-protected content, audio will output silence.
            </Text>
          </View>

          <TouchableOpacity style={styles.proceedButton} onPress={onProceed}>
            <Text style={styles.proceedButtonText}>I Understand — Start Sharing</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: colors.cardBackground,
    borderRadius: 22,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  icon: {
    fontSize: 40,
    marginBottom: 10,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.cardActive,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  supportedText: {
    fontSize: 12,
    color: colors.syncGood,
    lineHeight: 18,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 10,
  },
  restrictedText: {
    fontSize: 12,
    color: colors.syncAdjusting,
    lineHeight: 17,
  },
  proceedButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  proceedButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
});
