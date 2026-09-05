/**
 * SyncPlay - Main App Component
 * Cross-platform synchronized multi-device audio playback.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { RoomProvider } from './src/context/RoomContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { HostScreen } from './src/screens/HostScreen';
import { GuestScreen } from './src/screens/GuestScreen';
import { audioManager } from './src/audio/AudioManager';
import { colors } from './src/theme/colors';

type ScreenName = 'home' | 'host' | 'guest';

function MainNavigator() {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('home');

  useEffect(() => {
    // Initialize background audio mode
    audioManager.configureAudioSession();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {currentScreen === 'home' && (
        <HomeScreen
          onEnterHostScreen={() => setCurrentScreen('host')}
          onEnterGuestScreen={() => setCurrentScreen('guest')}
        />
      )}
      {currentScreen === 'host' && (
        <HostScreen onLeave={() => setCurrentScreen('home')} />
      )}
      {currentScreen === 'guest' && (
        <GuestScreen
          onLeave={() => setCurrentScreen('home')}
          onPromotedToHost={() => setCurrentScreen('host')}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <RoomProvider>
      <MainNavigator />
    </RoomProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
