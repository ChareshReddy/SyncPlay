/**
 * SyncPlay - Real-time Live Audio Waveform Visualizer
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  isActive: boolean;
  rms?: number;
}

export const LiveWaveform: React.FC<Props> = ({ isActive, rms = 0 }) => {
  const bars = [
    useRef(new Animated.Value(8)).current,
    useRef(new Animated.Value(14)).current,
    useRef(new Animated.Value(22)).current,
    useRef(new Animated.Value(30)).current,
    useRef(new Animated.Value(22)).current,
    useRef(new Animated.Value(14)).current,
    useRef(new Animated.Value(8)).current,
  ];

  useEffect(() => {
    if (!isActive) {
      bars.forEach((b) => b.setValue(6));
      return;
    }

    const multiplier = Math.max(0.2, Math.min(1.0, rms * 2.5));
    const heights = [10, 24, 38, 48, 38, 24, 10];

    bars.forEach((bar, i) => {
      Animated.spring(bar, {
        toValue: heights[i] * multiplier,
        friction: 4,
        tension: 40,
        useNativeDriver: false,
      }).start();
    });
  }, [isActive, rms]);

  return (
    <View style={styles.container}>
      {bars.map((barAnim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              height: barAnim,
              backgroundColor: isActive ? colors.accent : colors.sliderTrack,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 6,
    marginVertical: 12,
  },
  bar: {
    width: 6,
    borderRadius: 3,
    minHeight: 6,
  },
});
