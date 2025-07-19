import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated, // Import Animated
  Easing,   // Import Easing
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// --- Helper Functions (unchanged - these still perform analysis on server) ---
const listFolderContents = async (path, accessToken) => {
  console.log('DEBUG: listFolderContents - Attempting to list path:', path);
  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: path,
      }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('DEBUG: Dropbox API Error (listFolderContents):', response.status, errorText);
        throw new Error('Failed to list folder contents');
    }
    const data = await response.json();
    return data.entries;
  } catch (error) {
    console.error('DEBUG: Error listing Dropbox folder:', error);
    Alert.alert('Error', 'Could not load folder contents.');
    return [];
  }
};

const getTemporaryLink = async (path, accessToken) => {
  console.log('DEBUG: getTemporaryLink - Attempting to get link for path:', path);
  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: path }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('DEBUG: Dropbox API Error (getTemporaryLink):', response.status, errorText);
        throw new Error('Failed to get temporary link');
    }
    const data = await response.json();
    return data.link;
  } catch (error) {
    console.error('DEBUG: Error getting temporary link:', error);
    return null;
  }
};

const analyzeFileFromServer = async (file, accessToken, serverUrl) => {
    console.log('DEBUG: analyzeFileFromServer - Attempting to analyze file:', file.name);
    const downloadUrl = await getTemporaryLink(file.path_lower, accessToken);
    if (!downloadUrl) {
      return null;
    }

    const localUri = FileSystem.cacheDirectory + file.name.replace(/ /g, '-');

    try {
      const { uri } = await FileSystem.downloadAsync(downloadUrl, localUri);
      console.log('DEBUG: analyzeFileFromServer - File downloaded to local URI:', uri);

      const formData = new FormData();
      formData.append('audio', {
        uri: uri,
        type: 'audio/mpeg',
        name: file.name,
      });

      const response = await fetch(serverUrl, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!response.ok) {
          const errorText = await response.text();
          console.error('DEBUG: Server analysis failed response:', response.status, errorText);
          throw new Error('Server analysis failed');
      }

      const analysisResult = await response.json();
      console.log('DEBUG: Server analysis result:', analysisResult);
      return analysisResult;

    } catch (error) {
      console.error('DEBUG: Error during analysis process:', error);
      return null;
    } finally {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(localUri);
        console.log('DEBUG: analyzeFileFromServer - Local file cleaned up:', localUri);
      }
    }
};

// --- NEW SUB-COMPONENT: NowPlayingVisualizer ---
const NowPlayingVisualizer = ({ fileName }) => {
  const animValues = React.useRef([...Array(5)].map(() => new Animated.Value(0.2))).current; // Fewer bars for smaller visual
  
  React.useEffect(() => {
    const animations = animValues.map((anim, i) => {
      const duration = 400;
      const delay = i * 80; // Slightly faster delay
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 0.8, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true, delay }), // Taller peak
          Animated.timing(anim, { toValue: 0.2, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
    });
    Animated.parallel(animations).start();
  }, [animValues]);

  return (
    <View style={visualizerStyles.container}>
      <Text style={visualizerStyles.text}>{fileName}</Text>
      <View style={visualizerStyles.waveformContainer}>
        {animValues.map((anim, index) => (
          <Animated.View key={index} style={[visualizerStyles.waveformBar, { transform: [{ scaleY: anim }] }]}/>
        ))}
      </View>
    </View>
  );
};

// Styles for NowPlayingVisualizer
const visualizerStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flex: 1, // Allows the text to take up space
    },
    text: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
        flex: 1, // Take up space
        marginRight: 10,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 20, // Small height for visualizer
        width: 60, // Small width for visualizer
        overflow: 'hidden',
    },
    waveformBar: {
        width: 4, // Thin bars
        backgroundColor: '#1DB954', // Green accent for visualizer
        marginHorizontal: 1, // Very small space between bars
        borderRadius: 2,
        height: '100%',
    },
});


// --- Main Component ---
const DropboxBrowser = ({accessToken, initialPath = '', initialFolderName = 'Selected Folder' }) => {
  const [folderContents, setFolderContents] = useState([]);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [isLoading, setIsLoading] = useState(false); // For general folder loading (listing contents)
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingFile, setCurrentPlayingFile] = useState(null);

  // State to store analysis results (key and loading status) for individual files
  const [analyzedFileResults, setAnalyzedFileResults] = useState({}); // { [fileId]: { key: 'C Minor', isAnalyzing: false } }

  const YOUR_SERVER_URL = 'http://192.168.50.242:5000/analyze'; // Ensure this is your server URL

  useEffect(() => {
    if (accessToken) {
      console.log('DEBUG: DropboxBrowser useEffect - Modal visible, loading initialPath:', initialPath);
      setCurrentPath(initialPath);
      loadFolder(initialPath);
    }
  }, [accessToken, initialPath]);

  useEffect(() => {
    return () => {
      if (sound) {
        console.log('DEBUG: DropboxBrowser cleanup - Unloading sound.');
        sound.unloadAsync();
      }
    };
  }, [sound]);


  const loadFolder = async (path) => {
    setIsLoading(true); // Show general loading for folder contents
    if (sound) { // Stop any playing audio when changing folders
        console.log('DEBUG: loadFolder - Stopping currently playing audio.');
        await sound.unloadAsync();
        setSound(null);
        setIsPlaying(false);
        setCurrentPlayingFile(null);
    }

    setAnalyzedFileResults({}); // Clear analysis results for new folder

    const contents = await listFolderContents(path, accessToken);
    setFolderContents(contents);
    setCurrentPath(path);
    setIsLoading(false); // Hide general loading now that contents are fetched

    // NO AUTOMATIC ANALYSIS TRIGGERED HERE
  };

  const playAudio = async (url, file) => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      setCurrentPlayingFile(null);
    }
    try {
      console.log('DEBUG: playAudio - Attempting to play URL:', url);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
      setCurrentPlayingFile(file);
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          console.log('DEBUG: playAudio - Playback finished.');
          setIsPlaying(false);
          setCurrentPlayingFile(null);
          newSound.unloadAsync();
          setSound(null);
        }
      });
    } catch (error) {
      console.error('DEBUG: Error playing audio (in playAudio function):', error);
      Alert.alert('Error', 'Could not play the audio file.');
      setIsPlaying(false);
      setCurrentPlayingFile(null);
    }
  };

  const stopAudio = async () => {
    if (sound) {
      console.log('DEBUG: stopAudio - Stopping audio.');
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      setCurrentPlayingFile(null);
    }
  };

  const handleFilePlay = async (file) => {
    console.log('DEBUG: handleFilePlay - Function started for file:', file.name);
    console.log('DEBUG: handleFilePlay - AccessToken status:', accessToken ? 'Present' : 'MISSING!');
    if (!accessToken) {
      Alert.alert('Error', 'Not authenticated. Please link Dropbox again.');
      return;
    }

    console.log('DEBUG: handleFilePlay - Requesting link for:', file.path_lower);
    const streamUrl = await getTemporaryLink(file.path_lower, accessToken);
    if (streamUrl) {
      console.log('DEBUG: handleFilePlay - Received stream URL:', streamUrl);
      await playAudio(streamUrl, file);
    } else {
      console.log('DEBUG: handleFilePlay - Did NOT receive stream URL.');
      Alert.alert('Error', 'Could not get a link to play the file.');
    }
  };

  const handleFileAnalyze = async (file) => {
    console.log('DEBUG: handleFileAnalyze - Function started for file:', file.name);
    console.log('DEBUG: handleFileAnalyze - AccessToken status:', accessToken ? 'Present' : 'MISSING!');
    if (!accessToken) {
      Alert.alert('Error', 'Not authenticated. Please link Dropbox again.');
      return;
    }

    setAnalyzedFileResults(prev => ({
        ...prev,
        [file.id]: { key: null, isAnalyzing: true } // Set analyzing true for this item
    }));

    console.log('DEBUG: handleFileAnalyze - Requesting analysis for:', file.path_lower);
    const result = await analyzeFileFromServer(file, accessToken, YOUR_SERVER_URL);

    if (result && !result.error) {
      setAnalyzedFileResults(prev => ({
          ...prev,
          [file.id]: { key: result.key, isAnalyzing: false } // Update with detected key
      }));
      console.log('DEBUG: handleFileAnalyze - Analysis successful. Key:', result.key);
    } else {
      setAnalyzedFileResults(prev => ({
          ...prev,
          [file.id]: { key: 'N/A (Error)', isAnalyzing: false } // Mark as error
      }));
      console.error('DEBUG: handleFileAnalyze - Analysis failed or returned error:', result?.error || 'Unknown error');
    }
  };

  const handleGoBack = () => {
    console.log('DEBUG: handleGoBack - currentPath:', currentPath, 'initialPath:', initialPath);
    // If we're at the root of the currently selected folder (initialPath),
    // going back should navigate to the actual Dropbox root ('').
    // Otherwise, navigate up a subfolder.
    if (currentPath === initialPath) {
        loadFolder(''); // Go to actual Dropbox root
    } else {
        const lastSlashIndex = currentPath.lastIndexOf('/');
        let parentPath = currentPath.substring(0, lastSlashIndex);
        // If navigating up from a subfolder would go above the initialPath, reset to initialPath
        if (parentPath.length < initialPath.length) {
            parentPath = initialPath;
        }
        console.log('DEBUG: handleGoBack - Navigating to parentPath:', parentPath);
        loadFolder(parentPath);
    }
  };


  // --- MODIFIED renderItem: Move Stop button, add Playing indicator ---
  const renderItem = ({ item }) => {
    const isFolder = item['.tag'] === 'folder';
    // This isCurrentPlaying check only for the text indicator, not for button logic
    const isCurrentPlayingFileItem = currentPlayingFile && currentPlayingFile.id === item.id;

    const analysisData = analyzedFileResults[item.id];
    const itemKey = analysisData?.key;
    const itemIsAnalyzing = analysisData?.isAnalyzing;

    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={isFolder ? () => loadFolder(item.path_lower) : null}
        disabled={isLoading} // General loading for folder contents (listing)
      >
        <Text style={styles.itemName}>
          {isFolder ? '📁' : '🎵'} {item.name}
        </Text>
        {!isFolder && ( // Show action buttons only for files
          <View style={styles.actions}>
            {isCurrentPlayingFileItem && isPlaying ? ( // Display "Playing..." text if this specific file is playing
              <Text style={styles.playingStatusText}>Playing...</Text>
            ) : (
              // Play button remains here (Stop button is now in global Now Playing bar)
              <TouchableOpacity onPress={() => handleFilePlay(item)} style={[styles.actionButton, { backgroundColor: '#007AFF' }]}>
                <Text style={styles.actionButtonText}>Play</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => handleFileAnalyze(item)}
              style={[styles.actionButton, { backgroundColor: '#8420d0' }]}
              disabled={itemIsAnalyzing || isLoading}
            >
              {itemIsAnalyzing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>
                  {itemKey ? `Key: ${itemKey}` : 'Analyze Key'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    // NO LONGER A MODAL. Directly return the content View.
    <View style={styles.contentContainer}> {/* Use a new style name */}
        <View style={styles.headerBar}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.pathHeader}>
                {currentPath === initialPath ? initialFolderName : currentPath.substring(initialPath.length) || '/'}
            </Text>
            {/* <<< REMOVED: No close button as it's not a modal */}
            {/* <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity> */}
        </View>

        {isLoading ? ( // This isLoading is for initial folder content loading
            <ActivityIndicator size="large" style={styles.loader} />
        ) : (
            <FlatList
                data={folderContents}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={<Text style={styles.emptyText}>This folder is empty.</Text>}
            />
        )}

        {/* --- Now Playing Bar at the bottom --- */}
        {isPlaying && currentPlayingFile && (
            <View style={styles.nowPlayingBar}>
                <NowPlayingVisualizer fileName={currentPlayingFile.name} />
                <TouchableOpacity onPress={stopAudio} style={[styles.actionButton, { backgroundColor: 'red' }]}>
                    <Text style={styles.actionButtonText}>Stop</Text>
                </TouchableOpacity>
            </View>
        )}
    </View>
  );
};

// --- Styles for DropboxBrowser Modal ---
const styles = StyleSheet.create({
  contentContainer: { // NEW: This will be the main container style for the embedded browser
    backgroundColor: '#1A1A1A', // Your preferred background color
    borderRadius: 12, // Keep some rounded corners for visual appeal
    padding: 10,
    flex: 1, // Allows it to take available height in its parent's flex layout
    width: '100%', // Takes full width of its parent
    marginTop: 15, // Add some space from elements above it in NewSessionScreen
    marginBottom: 15, // Space from elements below it
    overflow: 'hidden', // Ensures content stays within rounded corners
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 5,
  },
  closeButton: {
    padding: 5,
  },
  pathHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  loader: {
    marginTop: 50,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#282828',
  },
  itemName: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // Aligns buttons to the right
    alignItems: 'center', // Vertically centers items in action view
    minWidth: 180, // Ensuring enough space for both buttons
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginLeft: 8, // Space between buttons
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#888',
  },
  // --- NEW STYLES ---
  playingStatusText: { // For the "Playing..." text next to the filename
    color: '#1DB954', // Green for playing status
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8, // Adjust as needed
    marginRight: 8, // Space for analysis button
  },
  nowPlayingBar: { // Container for the global Now Playing bar
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#282828', // Darker background for the bar
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 10, // Space from FlatList
    width: '100%', // Take full width of modal content
  },
});

export default DropboxBrowser;