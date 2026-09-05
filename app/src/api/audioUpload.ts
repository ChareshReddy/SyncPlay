/**
 * SyncPlay - Audio API Service
 * Handles uploading local audio files and fetching sample tracks.
 */

import * as DocumentPicker from 'expo-document-picker';
import { Track } from '../types';
import { normalizeServerUrl } from './serverConfig';

export async function fetchSampleTracks(serverUrl: string): Promise<Track[]> {
  try {
    const cleanUrl = normalizeServerUrl(serverUrl);
    const res = await fetch(`${cleanUrl}/api/samples`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data: Track[] = await res.json();

    // If remote server is HTTPS, ensure sample URLs are also HTTPS
    if (cleanUrl.startsWith('https://')) {
      return data.map((track) => ({
        ...track,
        url: track.url.replace(/^http:\/\//i, 'https://'),
      }));
    }
    return data;
  } catch (err) {
    console.warn('Failed to fetch sample tracks:', err);
    return [];
  }
}

export async function pickAndUploadAudioFile(serverUrl: string): Promise<Track | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    const formData = new FormData();

    // Append file for multipart upload
    // @ts-ignore
    formData.append('audio', {
      uri: asset.uri,
      name: asset.name || 'uploaded_track.mp3',
      type: asset.mimeType || 'audio/mpeg',
    });

    const cleanUrl = normalizeServerUrl(serverUrl);
    const res = await fetch(`${cleanUrl}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Upload failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.success && data.file) {
      let fileUrl = data.file.url;
      if (cleanUrl.startsWith('https://')) {
        fileUrl = fileUrl.replace(/^http:\/\//i, 'https://');
      }
      return {
        url: fileUrl,
        title: asset.name || 'Local Audio Track',
        artist: 'Host Device',
        durationMs: 0, // Duration will be detected when loaded in expo-av
      };
    }

    return null;
  } catch (err) {
    console.error('Failed to pick and upload audio:', err);
    throw err;
  }
}
