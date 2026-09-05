/**
 * SyncPlay - QR Code Display Modal
 * Renders QR code encoding both Server URL and Room Code for instant guest joining.
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  roomCode: string;
  serverUrl: string;
}

export const QRCodeModal: React.FC<Props> = ({
  visible,
  onClose,
  roomCode,
  serverUrl,
}) => {
  // QR payload contains both roomCode and serverUrl so guests can join over LAN with 0 typing
  const qrPayload = JSON.stringify({
    room: roomCode,
    server: serverUrl,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Join Audio Session</Text>
          <Text style={styles.subtitle}>
            Point another phone's camera to join instantly
          </Text>

          <View style={styles.qrContainer}>
            <QRCode
              value={qrPayload}
              size={200}
              color="#0B0D14"
              backgroundColor="#FFFFFF"
              quietZone={12}
            />
          </View>

          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>ROOM CODE</Text>
            <Text style={styles.codeText}>{roomCode}</Text>
          </View>

          <Text style={styles.serverInfo}>Server: {serverUrl}</Text>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 20,
  },
  codeContainer: {
    alignItems: 'center',
    backgroundColor: colors.cardActive,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 10,
    width: '100%',
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1.5,
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 4,
  },
  serverInfo: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
