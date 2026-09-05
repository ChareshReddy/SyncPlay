/**
 * SyncPlay - Audio Selector Modal
 * Allows Host to pick from built-in sample tracks or upload local phone audio files.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Track } from '../types';
import { colors } from '../theme/colors';
import { pickAndUploadAudioFile } from '../api/audioUpload';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectTrack: (track: Track) => void;
  builtInSamples: Track[];
  serverUrl: string;
}

export const AudioPickerModal: React.FC<Props> = ({
  visible,
  onClose,
  onSelectTrack,
  builtInSamples,
  serverUrl,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');

  const handlePickLocalFile = async () => {
    try {
      setIsUploading(true);
      const track = await pickAndUploadAudioFile(serverUrl);
      if (track) {
        onSelectTrack(track);
        onClose();
      }
    } catch (err: any) {
      Alert.alert(
        'Upload Error',
        'Could not upload audio file to local server. Make sure server is reachable on WiFi.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleUseCustomUrl = () => {
    const url = customUrl.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Invalid URL', 'Audio URL must start with http:// or https://');
      return;
    }

    onSelectTrack({
      url,
      title: 'Remote Audio Stream',
      artist: 'Web Stream',
      durationMs: 0,
    });
    setCustomUrl('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose Audio to Play</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll}>
            {/* Pick Local File Button */}
            <TouchableOpacity
              style={styles.uploadCard}
              onPress={handlePickLocalFile}
              disabled={isUploading}
            >
              {isUploading ? (
                <View style={styles.uploadingState}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={styles.uploadingText}>
                    Uploading to local WiFi server...
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.uploadIcon}>📁</Text>
                  <View style={styles.uploadTextContainer}>
                    <Text style={styles.uploadTitle}>Pick Local Audio File</Text>
                    <Text style={styles.uploadSubtitle}>
                      MP3, WAV, M4A, AAC from phone storage
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            {/* Built-in Sample Tracks Section */}
            <Text style={styles.sectionHeader}>Instant Test Samples</Text>
            {builtInSamples.map((sample) => (
              <TouchableOpacity
                key={sample.url}
                style={styles.sampleItem}
                onPress={() => {
                  onSelectTrack(sample);
                  onClose();
                }}
              >
                <View style={styles.sampleIcon}>
                  <Text style={{ fontSize: 18 }}>🎵</Text>
                </View>
                <View style={styles.sampleInfo}>
                  <Text style={styles.sampleTitle}>{sample.title}</Text>
                  <Text style={styles.sampleSubtitle}>
                    {sample.artist} • {(sample.durationMs / 1000).toFixed(0)}s loop
                  </Text>
                </View>
                <Text style={styles.selectText}>Play</Text>
              </TouchableOpacity>
            ))}

            {/* Direct URL Input */}
            <Text style={styles.sectionHeader}>Or Audio URL</Text>
            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.input}
                placeholder="http://example.com/audio.mp3"
                placeholderTextColor={colors.textMuted}
                value={customUrl}
                onChangeText={setCustomUrl}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.urlButton}
                onPress={handleUseCustomUrl}
              >
                <Text style={styles.urlButtonText}>Use</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  closeIcon: {
    fontSize: 18,
    color: colors.textSecondary,
    padding: 4,
  },
  scroll: {
    marginBottom: 20,
  },
  uploadCard: {
    backgroundColor: colors.cardActive,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: 20,
  },
  uploadingState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 6,
  },
  uploadingText: {
    color: colors.accent,
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '600',
  },
  uploadIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  uploadTextContainer: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  uploadSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 6,
  },
  sampleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardActive,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  sampleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sampleInfo: {
    flex: 1,
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sampleSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  selectText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
    paddingHorizontal: 8,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: colors.cardActive,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: 8,
  },
  urlButton: {
    backgroundColor: colors.buttonPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  urlButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
