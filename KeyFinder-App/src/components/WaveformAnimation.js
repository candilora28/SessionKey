// src/components/WaveformAnimation.js
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';
import { styles } from '../../styles';

const WaveformAnimation = () => {
  const animValues = useRef([...Array(7)].map(() => new Animated.Value(0.2))).current;

  useEffect(() => {
    const animations = animValues.map((anim, i) => {
      const duration = 400;
      const delay = i * 100;
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.7, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true, delay }),
          Animated.timing(anim, { toValue: 0.2, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    });
    Animated.parallel(animations).start();
  }, [animValues]);

  return (
    <View style={styles.waveformContainer}>
      {animValues.map((anim, index) => (
        <Animated.View key={index} style={[styles.waveformBar, { transform: [{ scaleY: anim }] }]} />
      ))}
    </View>
  );
};


export default WaveformAnimation;