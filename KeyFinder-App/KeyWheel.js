import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

const KeyWheel = ({ selectedKey, onKeyChange }) => {
  // --- 1. ADD STATE TO MANAGE THE PRIMARY MODE ---
  const [primaryMode, setPrimaryMode] = useState('Major');

  const wheelSize = Math.min(screenWidth * 0.85, 340);
  const centerX = wheelSize / 2;
  const centerY = wheelSize / 2;
  const outerRadius = wheelSize * 0.4;
  const innerRadius = wheelSize * 0.25;
  const majorKeySize = wheelSize * 0.13;
  const minorKeySize = wheelSize * 0.11;
  const centerDisplaySize = wheelSize * 0.28;

  const majorKeys = [
    { name: 'C', angle: 0 }, { name: 'G', angle: 30 }, { name: 'D', angle: 60 },
    { name: 'A', angle: 90 }, { name: 'E', angle: 120 }, { name: 'B', angle: 150 },
    { name: 'F#', angle: 180 }, { name: 'C#', angle: 210 }, { name: 'G#', angle: 240 },
    { name: 'D#', angle: 270 }, { name: 'A#', angle: 300 }, { name: 'F', angle: 330 },
  ];

  const minorKeys = [
    { name: 'A', angle: 0 }, { name: 'E', angle: 30 }, { name: 'B', angle: 60 },
    { name: 'F#', angle: 90 }, { name: 'C#', angle: 120 }, { name: 'G#', angle: 150 },
    { name: 'D#', angle: 180 }, { name: 'A#', angle: 210 }, { name: 'F', angle: 240 },
    { name: 'C', angle: 270 }, { name: 'G', angle: 300 }, { name: 'D', angle: 330 },
  ];

  // --- 2. DETERMINE WHICH KEYS ARE OUTER/INNER BASED ON STATE ---
  const isPrimaryMajor = primaryMode === 'Major';
  const outerKeys = isPrimaryMajor ? majorKeys : minorKeys;
  const innerKeys = isPrimaryMajor ? minorKeys : majorKeys;
  const outerMode = isPrimaryMajor ? 'Major' : 'Minor';
  const innerMode = isPrimaryMajor ? 'Minor' : 'Major';

  const handleKeyPress = (keyName, mode) => {
    const fullKeyName = `${keyName} ${mode}`;
    onKeyChange(fullKeyName);
  };

  const getKeyPosition = (angle, radius) => {
    const angleInRadians = ((angle - 90) * Math.PI) / 180;
    const x = centerX + Math.cos(angleInRadians) * radius;
    const y = centerY + Math.sin(angleInRadians) * radius;
    return { x, y };
  };

  const isSelected = (keyName, mode) => {
    return selectedKey === `${keyName} ${mode}`;
  };

  const renderKey = (key, mode, radius, size) => {
    const position = getKeyPosition(key.angle, radius);
    const selected = isSelected(key.name, mode);
    const isMajor = mode === 'Major';
    
    return (
      <TouchableOpacity
        key={`${key.name}-${mode}`}
        style={[
          styles.keyButton,
          {
            position: 'absolute',
            left: position.x - size / 2,
            top: position.y - size / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: selected ? '#8420d0' : (isMajor ? '#4A4A4A' : '#2A2A2A'),
            borderColor: selected ? '#A95BFF' : '#1C1C1C',
            borderWidth: selected ? 2 : 1,
          },
        ]}
        onPress={() => handleKeyPress(key.name, mode)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.keyText,
          {
            color: selected ? '#FFFFFF' : '#CCCCCC',
            fontSize: size * 0.35,
            fontWeight: selected ? 'bold' : '600',
          }
        ]}>
          {key.name}
        </Text>
        <Text style={[
          styles.modeText,
          {
            color: selected ? '#FFFFFF' : '#999999',
            fontSize: size * 0.2,
          }
        ]}>
          {isMajor ? 'maj' : 'min'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.wheel, { width: wheelSize, height: wheelSize }]}>
        {/* --- 3. MAKE THE CENTER DISPLAY A TOGGLE BUTTON --- */}
        <TouchableOpacity
          style={[styles.centerDisplay, {
            width: centerDisplaySize,
            height: centerDisplaySize,
            borderRadius: centerDisplaySize / 2,
            left: centerX - centerDisplaySize / 2,
            top: centerY - centerDisplaySize / 2,
          }]}
          onPress={() => setPrimaryMode(prev => prev === 'Major' ? 'Minor' : 'Major')}
          activeOpacity={0.8}
        >
          <Text style={[styles.centerText, { fontSize: centerDisplaySize * 0.2 }]}>
              {selectedKey.split(' ')[0]}
          </Text>
          <Text style={[styles.centerModeText, { fontSize: centerDisplaySize * 0.15 }]}>
              {selectedKey.split(' ')[1]}
          </Text>
          <MaterialCommunityIcons 
            name="swap-vertical-bold" 
            size={centerDisplaySize * 0.15} 
            color="#B3B3B3"
            style={{ marginTop: 4 }}
          />
        </TouchableOpacity>

        {/* --- 4. RENDER KEYS DYNAMICALLY --- */}
        {outerKeys.map(key => renderKey(key, outerMode, outerRadius, majorKeySize))}
        {innerKeys.map(key => renderKey(key, innerMode, innerRadius, minorKeySize))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  wheel: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerDisplay: {
    position: 'absolute',
    backgroundColor: '#1C1C1C',
    borderWidth: 2,
    borderColor: '#8420d0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#8420d0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  centerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  centerModeText: {
    color: '#B3B3B3',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  keyButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 8,
  },
  keyText: {
    textAlign: 'center',
  },
  modeText: {
    textAlign: 'center',
    marginTop: 1,
    textTransform: 'lowercase',
  },
});

export default KeyWheel;
