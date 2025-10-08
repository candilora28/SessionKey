import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../../styles';

const Keyboard = ({ detectedKey }) => {
  if (!detectedKey || !detectedKey.key) return null;
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
  const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

  const getScaleNotes = () => {
    const [rootNoteName, mode] = detectedKey.key.split(' ');
    const rootNoteIndex = NOTES.indexOf(rootNoteName);
    if (rootNoteIndex === -1) return [];
    const intervals = mode === 'Major' ? MAJOR_SCALE_INTERVALS : MINOR_SCALE_INTERVALS;
    return intervals.map(interval => NOTES[(rootNoteIndex + interval) % 12]);
  };

  const scaleNotes = getScaleNotes();
  const whiteKeys = NOTES.filter(note => !note.includes('#'));

  return (
    <View style={styles.keyboardContainer}>
      {whiteKeys.map(note => (
        <View key={note} style={[styles.whiteKey, scaleNotes.includes(note) && styles.highlightedKey]}>
          <Text style={styles.keyText}>{note}</Text>
        </View>
      ))}
      <View style={styles.blackKeysContainer}>
        <View style={styles.blackKeyWrapper}><View style={[styles.blackKey, scaleNotes.includes('C#') && styles.highlightedKey]}><Text style={styles.blackKeyText}>C#</Text></View></View>
        <View style={styles.blackKeyWrapper}><View style={[styles.blackKey, scaleNotes.includes('D#') && styles.highlightedKey]}><Text style={styles.blackKeyText}>D#</Text></View></View>
        <View style={styles.blackKeyWrapper} />
        <View style={styles.blackKeyWrapper}><View style={[styles.blackKey, scaleNotes.includes('F#') && styles.highlightedKey]}><Text style={styles.blackKeyText}>F#</Text></View></View>
        <View style={styles.blackKeyWrapper}><View style={[styles.blackKey, scaleNotes.includes('G#') && styles.highlightedKey]}><Text style={styles.blackKeyText}>G#</Text></View></View>
        <View style={styles.blackKeyWrapper}><View style={[styles.blackKey, scaleNotes.includes('A#') && styles.highlightedKey]}><Text style={styles.blackKeyText}>A#</Text></View></View>
      </View>
    </View>
  );
};

export default Keyboard;