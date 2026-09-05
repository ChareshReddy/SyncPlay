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
import {
  checkServerHealth,
  HealthCheckResult,
  normalizeServerUrl,
  DEFAULT_RENDER_SERVER_URL,
  DEFAULT_LOCAL_SERVER_URL,
} from '../api/serverConfig';

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
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<HealthCheckResult | null>(null);

  const handleTestConnection = async (urlOverride?: string) => {
    const targetUrl = urlOverride || tempServerUrl || serverUrl;
    setIsTestingConnection(true);
    setTestNotice(null);
    setTestResult(null);

    const result = await checkServerHealth(targetUrl, (notice) => {
      setTestNotice(notice);
    });

    setIsTestingConnection(false);
    setTestNotice(null);
    setTestResult(result);

    if (!result.ok) {
      Alert.alert(
        'Connection Test Failed',
        `${result.message}\n\nMake sure the server is awake or check your network URL.`
      );
    }
  };

  const handleCreateRoom = async () => {
    setIsLoading(true);
    const success = await createRoom();
    setIsLoading(false);
    if (success) {
      onEnterHostScreen();
    } else {
      Alert.alert(
        'Connection Error',
        `Could not reach server at ${serverUrl}.\n\nIf using the free cloud server, it may be waking up (cold start can take ~60s).`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Test Server', onPress: () => handleTestConnection() },
          { text: 'Retry', onPress: () => handleCreateRoom() },
        ]
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
      Alert.alert(
        'Join Error',
        result.error || 'Failed to join room.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Test Server', onPress: () => handleTestConnection(customServer) },
        ]
      );
    }
  };

  const handleSaveServerUrl = async () => {
    const normalized = normalizeServerUrl(tempServerUrl);
    setServerUrl(normalized);
    setTempServerUrl(normalized);
    setIsServerEditOpen(false);
    await handleTestConnection(normalized);
  };

  const isRemoteServer = normalizeServerUrl(serverUrl).startsWith('https://');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Branding Header */}
        <View style={styles.brandHeader}>
          <Text style={styles.brandBadge}>MULTI-SPEAKER AUDIO SYNC</Text>
          <Text style={styles.brandTitle}>SyncPlay</Text>
          <Text style={styles.brandSubtitle}>
            Turn multiple phones into a synchronized multi-speaker sound system.
          </Text>
        </View>

        {/* Server IP Connection Bar */}
        <View style={styles.serverCard}>
          <View style={styles.serverRow}>
            <View
              style={[
                styles.serverStatusDot,
                testResult
                  ? { backgroundColor: testResult.ok ? colors.syncGood : colors.syncWarning }
                  : isTestingConnection
                  ? { backgroundColor: colors.syncAdjusting }
                  : undefined,
              ]}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.serverHeaderRow}>
                <Text style={styles.serverLabel}>Signaling Server</Text>
                <View style={styles.serverTypeBadge}>
                  <Text style={styles.serverTypeBadgeText}>
                    {isRemoteServer ? '🌐 Cloud' : '🏠 Local LAN'}
                  </Text>
                </View>
              </View>
              <Text style={styles.serverUrlText} numberOfLines={1}>
                {serverUrl}
              </Text>
              {testResult && (
                <Text
                  style={[
                    styles.testResultStatusText,
                    { color: testResult.ok ? colors.syncGood : colors.syncWarning },
                  ]}
                  numberOfLines={1}
                >
                  {testResult.ok ? `✓ ${testResult.message}` : `✗ ${testResult.message}`}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.testBtn}
              onPress={() => handleTestConnection()}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.testBtnText}>Test</Text>
              )}
            </TouchableOpacity>
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

          {/* Render Free-Tier Cold-Start Notice */}
          {testNotice && (
            <View style={styles.coldStartBanner}>
              <ActivityIndicator size="small" color="#F59E0B" style={{ marginRight: 8 }} />
              <Text style={styles.coldStartText}>{testNotice}</Text>
            </View>
          )}

          {isServerEditOpen && (
            <View style={styles.serverEditForm}>
              <Text style={styles.inputHelp}>
                Choose a preset or enter a custom server URL (Render or LAN IP):
              </Text>

              {/* Quick Presets */}
              <View style={styles.presetRow}>
                <TouchableOpacity
                  style={[
                    styles.presetBtn,
                    tempServerUrl === DEFAULT_RENDER_SERVER_URL && styles.presetBtnActive,
                  ]}
                  onPress={() => setTempServerUrl(DEFAULT_RENDER_SERVER_URL)}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      tempServerUrl === DEFAULT_RENDER_SERVER_URL && styles.presetBtnTextActive,
                    ]}
                  >
                    🌐 Render Cloud
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.presetBtn,
                    tempServerUrl.includes('192.168.') && styles.presetBtnActive,
                  ]}
                  onPress={() => setTempServerUrl(DEFAULT_LOCAL_SERVER_URL)}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      tempServerUrl.includes('192.168.') && styles.presetBtnTextActive,
                    ]}
                  >
                    🏠 Local WiFi
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.serverInput}
                value={tempServerUrl}
                onChangeText={setTempServerUrl}
                placeholder="https://syncplay-7qwj.onrender.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.saveServerBtn}
                onPress={handleSaveServerUrl}
                disabled={isTestingConnection}
              >
                <Text style={styles.saveServerBtnText}>
                  {isTestingConnection ? 'Testing...' : 'Save & Test Connection'}
                </Text>
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
  serverHeaderRow: {
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
  serverTypeBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  serverTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
  },
  serverUrlText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
    marginTop: 2,
  },
  testResultStatusText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  testBtn: {
    backgroundColor: colors.cardActive,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 6,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtnText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '700',
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
  coldStartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  coldStartText: {
    fontSize: 12,
    color: '#F59E0B',
    flex: 1,
    fontWeight: '500',
    lineHeight: 16,
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
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.cardActive,
    alignItems: 'center',
    marginRight: 6,
  },
  presetBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  presetBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  presetBtnTextActive: {
    color: colors.accent,
    fontWeight: '700',
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
