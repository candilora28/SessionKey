import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const KeyWheel = ({ selectedKey, onKeyChange }) => {
  // Simplified key layout
  const majorKeys = [
    { name: 'C', angle: 0 },
    { name: 'G', angle: 30 },
    { name: 'D', angle: 60 },
    { name: 'A', angle: 90 },
    { name: 'E', angle: 120 },
    { name: 'B', angle: 150 },
    { name: 'F#', angle: 180 },
    { name: 'C#', angle: 210 },
    { name: 'G#', angle: 240 },
    { name: 'D#', angle: 270 },
    { name: 'A#', angle: 300 },
    { name: 'F', angle: 330 },
  ];

  const minorKeys = [
    { name: 'A', angle: 0 },
    { name: 'E', angle: 30 },
    { name: 'B', angle: 60 },
    { name: 'F#', angle: 90 },
    { name: 'C#', angle: 120 },
    { name: 'G#', angle: 150 },
    { name: 'D#', angle: 180 },
    { name: 'A#', angle: 210 },
    { name: 'F', angle: 240 },
    { name: 'C', angle: 270 },
    { name: 'G', angle: 300 },
    { name: 'D', angle: 330 },
  ];

  const wheelSize = Math.min(screenWidth * 0.7, 260); // Smaller wheel
  const centerX = wheelSize / 2;
  const centerY = wheelSize / 2;
  const outerRadius = wheelSize * 0.35;
  const innerRadius = wheelSize * 0.23;

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
    const fullKeyName = `${keyName} ${mode}`;
    return selectedKey === fullKeyName;
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
            backgroundColor: selected 
              ? '#8420d0' 
              : isMajor 
                ? '#4A4A4A' 
                : '#2A2A2A',
            borderColor: selected 
              ? '#8420d0' 
              : '#666',
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
            fontSize: isMajor ? 13 : 11,
            fontWeight: selected ? 'bold' : '600',
          }
        ]}>
          {key.name}
        </Text>
        <Text style={[
          styles.modeText,
          {
            color: selected ? '#FFFFFF' : '#999999',
            fontSize: 7,
          }
        ]}>
          {isMajor ? 'M' : 'm'} {/* Uppercase M for Major, lowercase m for minor */}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.wheel, { width: wheelSize, height: wheelSize }]}>
        {/* Center display */}
        <View style={[styles.centerDisplay, {
          left: centerX - 35,
          top: centerY - 25,
        }]}>
          <Text style={styles.centerText}>{selectedKey}</Text>
        </View>

        {/* Render keys */}
        {majorKeys.map(key => renderKey(key, 'Major', outerRadius, 36))}
        {minorKeys.map(key => renderKey(key, 'Minor', innerRadius, 28))}
      </View>

      {/* Compact legend */}
      <View style={styles.legend}>
        <Text style={styles.legendText}>
          <Text style={styles.majorIndicator}>M</Text> Major • <Text style={styles.minorIndicator}>m</Text> Minor
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  wheel: {
    position: 'relative',
    marginBottom: 15,
  },
  centerDisplay: {
    position: 'absolute',
    width: 70,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1C1C1C',
    borderWidth: 2,
    borderColor: '#8420d0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  centerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  keyButton: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  keyText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  modeText: {
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 1,
  },
  legend: {
    alignItems: 'center',
  },
  legendText: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  majorIndicator: {
    color: '#4A4A4A',
    fontWeight: 'bold',
    backgroundColor: '#4A4A4A',
    color: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  minorIndicator: {
    color: '#2A2A2A',
    fontWeight: 'bold',
    backgroundColor: '#2A2A2A',
    color: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
});

export default KeyWheel;