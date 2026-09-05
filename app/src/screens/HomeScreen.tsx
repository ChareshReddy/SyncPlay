/**
 * SyncPlay - Home / Landing Screen
 * Allows creating a host session, joining via code or camera QR scanner, and configuring local WiFi IP.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoom } from '../context/RoomContext';
import { colors } from '../theme/colors';
import { QRScannerModal } from '../components/QRScannerModal';

interface Props {
  onEnterHostScreen: () => void;
  onEnterGuestScreen: () => void;
}

export const HomeScreen: React.FC<Props> = ({
  onEnterHostScreen,
  onEnterGuestScreen,
}) => {
  const {
    serverUrl,
    setServerUrl,
    deviceName,
    setDeviceName,
    createRoom,
    joinRoom,
  } = useRoom();

  const [inputCode, setInputCode] = useState('');
  const [isServerEditOpen, setIsServerEditOpen] = useState(false);
  const [tempServerUrl, setTempServerUrl] = useState(serverUrl);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateRoom = async () => {
    setIsLoading(true);
    const success = await createRoom();
    setIsLoading(false);
    if (success) {
      onEnterHostScreen();
    } else {
      Alert.alert(
        'Connection Error',
        `Could not reach server at ${serverUrl}. Make sure the Node.js server is running and both devices are on the same WiFi.`
      );
    }
  };

  const handleJoinByCode = async (codeToJoin?: string, customServer?: string) => {
    const code = (codeToJoin || inputCode).trim().toUpperCase();
    if (!code) {
      Alert.alert('Missing Code', 'Please enter a 5-digit room code.');
      return;
    }

    setIsLoading(true);
    const result = await joinRoom(code, customServer);
    setIsLoading(false);

    if (result.success) {
      onEnterGuestScreen();
    } else {
      Alert.alert('Join Error', result.error || 'Failed to join room.');
    }
  };

  const handleSaveServerUrl = () => {
    setServerUrl(tempServerUrl);
    setIsServerEditOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Branding Header */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandBadge}>LOCAL WIFI AUDIO SYNC</Text>
          <Text style={styles.brandTitle}>SyncPlay</Text>
          <Text style={styles.brandSubtitle}>
            Turn multiple phones into a synchronized multi-speaker sound system.
          </Text>
        </View>

        {/* Server IP Connection Bar */}
        <View style={styles.serverCard}>
          <View style={styles.serverRow}>
            <View style={styles.serverStatusDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.serverLabel}>WiFi Signaling Server</Text>
              <Text style={styles.serverUrlText} numberOfLines={1}>
                {serverUrl}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.serverEditBtn}
              onPress={() => {
                setTempServerUrl(serverUrl);
                setIsServerEditOpen(!isServerEditOpen);
              }}
            >
              <Text style={styles.serverEditText}>
                {isServerEditOpen ? 'Close' : 'Configure'}
              </Text>
            </TouchableOpacity>
          </View>

          {isServerEditOpen && (
            <View style={styles.serverEditForm}>
              <Text style={styles.inputHelp}>
                Enter the IP address shown in your server terminal:
              </Text>
              <TextInput
                style={styles.serverInput}
                value={tempServerUrl}
                onChangeText={setTempServerUrl}
                placeholder="http://192.168.1.50:4000"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.saveServerBtn}
                onPress={handleSaveServerUrl}
              >
                <Text style={styles.saveServerBtnText}>Update Server URL</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Device Name Input */}
        <View style={styles.fieldCard}>
          <Text style={styles.fieldLabel}>Your Speaker Name</Text>
          <TextInput
            style={styles.textInput}
            value={deviceName}
            onChangeText={setDeviceName}
            placeholder="e.g. Living Room Phone"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Action 1: Host a Room */}
        <View style={styles.card}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionIcon}>👑</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Host a Room</Text>
              <Text style={styles.actionSubtitle}>
                Control playback and stream audio to surrounding guest devices.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.hostButton}
            onPress={handleCreateRoom}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.hostButtonText}>Create New Room</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Action 2: Join a Room */}
        <View style={styles.card}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionIcon}>🔊</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Join a Room</Text>
              <Text style={styles.actionSubtitle}>
                Sync as a guest speaker with a host on the same WiFi.
              </Text>
            </View>
          </View>

          <View style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              placeholder="CODE"
              placeholderTextColor={colors.textMuted}
              value={inputCode}
              onChangeText={(t) => setInputCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.joinCodeBtn}
              onPress={() => handleJoinByCode()}
              disabled={isLoading}
            >
              <Text style={styles.joinCodeBtnText}>Join</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => setIsScannerOpen(true)}
          >
            <Text style={styles.scanButtonIcon}>📷</Text>
            <Text style={styles.scanButtonText}>Scan Host QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* Fair Pricing & Anti-Lockin Notice */}
        <View style={styles.transparencyCard}>
          <Text style={styles.transparencyTitle}>🤝 Fair Multi-Speaker Audio</Text>
          <Text style={styles.transparencyText}>
            Up to 5 devices per room in free tier. No deceptive weekly trials, no ads, and no cloud surveillance.
          </Text>
        </View>
      </ScrollView>

      {/* QR Code Camera Scanner Modal */}
      <QRScannerModal
        visible={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={({ roomCode, serverUrl: scannedServer }) => {
          handleJoinByCode(roomCode, scannedServer);
        }}
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
    padding: 20,
    paddingBottom: 40,
  },
  brandHeader: {
    alignItems: 'center',
    marginVertical: 20,
  },
  brandBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
    marginBottom: 6,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  serverCard: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serverStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.syncGood,
    marginRight: 10,
  },
  serverLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  serverUrlText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
  serverEditBtn: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  serverEditText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  serverEditForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  inputHelp: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 6,
  },
  serverInput: {
    backgroundColor: colors.cardActive,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 8,
  },
  saveServerBtn: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveServerBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  fieldCard: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 16,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  actionIcon: {
    fontSize: 26,
    marginRight: 12,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  hostButton: {
    backgroundColor: colors.buttonPrimary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  hostButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.cardActive,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 10,
  },
  joinCodeBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 12,
  },
  joinCodeBtnText: {
    color: '#0B0D14',
    fontSize: 15,
    fontWeight: '800',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardActive,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scanButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  scanButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  transparencyCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    marginTop: 8,
  },
  transparencyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  transparencyText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
