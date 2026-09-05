/**
 * SyncPlay - QR Code Camera Scanner Modal
 * Uses expo-camera to scan room QR codes and join sessions with 0 manual typing.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (data: { roomCode: string; serverUrl?: string }) => void;
}

export const QRScannerModal: React.FC<Props> = ({
  visible,
  onClose,
  onScanSuccess,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (hasScanned) return;
    setHasScanned(true);

    try {
      // Check if data is JSON { room: "...", server: "..." }
      if (data.trim().startsWith('{')) {
        const parsed = JSON.parse(data);
        if (parsed.room) {
          onScanSuccess({
            roomCode: parsed.room,
            serverUrl: parsed.server,
          });
          onClose();
          return;
        }
      }

      // Or if raw room code
      const cleanCode = data.trim().toUpperCase();
      if (cleanCode.length >= 4 && cleanCode.length <= 8) {
        onScanSuccess({ roomCode: cleanCode });
        onClose();
        return;
      }
    } catch (e) {
      console.warn('QR parse error:', e);
    }

    // Reset scanner after 2 seconds if invalid
    setTimeout(() => setHasScanned(false), 2000);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {!permission?.granted ? (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionTitle}>Camera Permission Required</Text>
            <Text style={styles.permissionSubtitle}>
              SyncPlay needs camera access to scan room QR codes.
            </Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scannerWrapper}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />

            {/* Target Reticle Overlay */}
            <View style={styles.overlay}>
              <View style={styles.topBar}>
                <Text style={styles.headerText}>Scan Room QR Code</Text>
                <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reticle}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>

              <Text style={styles.hintText}>
                Align the host's QR code within the frame
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerWrapper: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  closeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reticle: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: colors.buttonPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
