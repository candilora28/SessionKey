import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Image,
  Linking,
  TextInput,
  Modal,
} from 'react-native';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import RNPickerSelect from 'react-native-picker-select';
import KeyWheel from './KeyWheel';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

// Server configuration
const SERVER_IP = '192.168.50.242';
const ANALYZE_URL = `http://${SERVER_IP}:5000/analyze`;
const SEARCH_ARTIST_URL = `http://${SERVER_IP}:5000/search_artist`;
const SEARCH_BY_KEY_URL = `http://${SERVER_IP}:5000/search_by_key`;
const CHORD_PROGRESSIONS_URL = `http://${SERVER_IP}:5000/get_chord_progressions`;

// --- Dropbox Configuration ---
const DROPBOX_APP_KEY = '1qfdizul5aujvge';
const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

// --- Reusable Components ---
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
        <Animated.View key={index} style={[styles.waveformBar, { transform: [{ scaleY: anim }] }]}/>
      ))}
    </View>
  );
};

// --- FIX: Moved DropboxFolderPicker before NewSessionScreen ---
const DropboxFolderPicker = ({ visible, onClose, onSelectFolder, dropboxAuth }) => {
    const [currentPath, setCurrentPath] = useState('');
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchItems = async (path) => {
        if (!dropboxAuth?.token) return;
        setIsLoading(true);
        try {
            const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${dropboxAuth.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: path === '/' ? '' : path }),
            });
            const data = await response.json();
            if (data.entries) {
                const audioExtensions = ['.wav', '.mp3', '.aiff', '.m4a'];
                const filteredItems = data.entries.filter(entry => 
                    entry['.tag'] === 'folder' || audioExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))
                );
                setItems(filteredItems);
            }
        } catch (e) {
            console.error("Failed to fetch Dropbox items:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlayFile = async (filePath) => {
        try {
            const response = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${dropboxAuth.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ path: filePath }),
            });
            let data = await response.json();
            if (data.error && data.error['.tag'] === 'shared_link_already_exists') {
                const listResponse = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${dropboxAuth.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: filePath, direct_only: true }),
                });
                data = await listResponse.json();
                if(!data.links || data.links.length === 0) throw new Error("Could not retrieve existing link.");
            }
            const directUrl = data.links ? data.links[0].url.replace('www.dropbox.com', 'dl.dropboxusercontent.com') : data.url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
            Linking.openURL(directUrl);
        } catch (e) {
            console.error("Failed to create shareable link:", e);
            alert('Could not play this file.');
        }
    };

    useEffect(() => {
        if (visible) {
            fetchItems(currentPath);
        }
    }, [visible, currentPath]);

    const navigateTo = (path) => {
        setCurrentPath(path);
    };

    const goUp = () => {
        if (currentPath === '') return;
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
        setCurrentPath(parentPath);
    };

    const renderItem = ({ item }) => {
        const isFolder = item['.tag'] === 'folder';
        return (
            <TouchableOpacity style={styles.folderItem} onPress={() => isFolder ? navigateTo(item.path_lower) : handlePlayFile(item.path_lower)}>
                <MaterialCommunityIcons name={isFolder ? "folder" : "music-box"} size={24} color={isFolder ? "#0061FF" : "#FFFFFF"} style={styles.menuIcon} />
                <Text style={styles.folderName}>{item.name}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select a Dropbox Folder</Text>
                    <View style={styles.folderNavBar}>
                        <TouchableOpacity onPress={goUp} disabled={currentPath === ''}>
                            <MaterialCommunityIcons name="arrow-up-bold-box-outline" size={28} color={currentPath === '' ? "#444" : "#FFFFFF"} />
                        </TouchableOpacity>
                        <Text style={styles.currentPathText} numberOfLines={1}>{currentPath === '' ? 'Root Folder' : currentPath}</Text>
                        <TouchableOpacity style={styles.selectFolderButton} onPress={() => onSelectFolder({ name: currentPath.split('/').pop() || 'Root', path: currentPath })}>
                            <Text style={styles.selectFolderButtonText}>Select</Text>
                        </TouchableOpacity>
                    </View>
                    {isLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                        <FlatList
                            data={items}
                            keyExtractor={(item) => item.id}
                            renderItem={renderItem}
                        />
                    )}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};


// --- Screen Components ---
const MainMenu = ({ navigate }) => (
  <View style={styles.mainContent}>
    <TouchableOpacity style={styles.menuButton} onPress={() => navigate('Sessions')}>
      <MaterialCommunityIcons name="clipboard-text-multiple" size={24} color="#FFFFFF" style={styles.menuIcon} />
      <Text style={styles.menuButtonText}>Sessions</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.menuButton} onPress={() => navigate('SearchByKey')}>
      <MaterialCommunityIcons name="music-note" size={24} color="#FFFFFF" style={styles.menuIcon} />
      <Text style={styles.menuButtonText}>Search by Key & BPM</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.menuButton} onPress={() => navigate('SearchByArtist')}>
      <MaterialCommunityIcons name="account-music" size={24} color="#FFFFFF" style={styles.menuIcon} />
      <Text style={styles.menuButtonText}>Search By Artist</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.menuButton} onPress={() => navigate('Detect')}>
      <MaterialCommunityIcons name="microphone-variant" size={24} color="#FFFFFF" style={styles.menuIcon} />
      <Text style={styles.menuButtonText}>Detect & Analyze Audio</Text>
    </TouchableOpacity>
  </View>
);

const SessionsScreen = ({ navigate }) => (
    <View style={styles.featureScreen}>
        <Text style={styles.featureTitle}>Your Sessions</Text>
        <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={32} color="#666" />
            <Text style={styles.emptyText}>No Sessions Yet</Text>
            <Text style={styles.emptySubtext}>Create a new session to get started.</Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigate('NewSession')}>
            <Text style={styles.primaryButtonText}>Create New Session</Text>
        </TouchableOpacity>
    </View>
);

const NewSessionScreen = ({ navigate, appState, setAppState }) => {
    const [artistName, setArtistName] = useState('');
    const [sessionNotes, setSessionNotes] = useState('');
    const [artistData, setArtistData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isFolderPickerVisible, setFolderPickerVisible] = useState(false);

    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: DROPBOX_APP_KEY,
            scopes: ['files.metadata.read', 'sharing.write'],
            responseType: 'token',
            redirectUri,
            usePKCE: false,
            useProxy: true,
        },
        {
            authorizationEndpoint: 'https://www.dropbox.com/oauth2/authorize',
        }
    );

    useEffect(() => {
        if (response?.type === 'success') {
            const { access_token } = response.params;
            fetchDropboxAccountInfo(access_token);
        } else if (response?.type === 'error') {
            setError('Dropbox authentication failed.');
        }
    }, [response]);

    const fetchDropboxAccountInfo = async (token) => {
        try {
            const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await res.json();
            const displayName = data?.name?.display_name || 'Dropbox User';
            setAppState(prevState => ({ ...prevState, dropboxAuth: { token, name: displayName } }));
            setFolderPickerVisible(true);
        } catch (e) {
            setError('Failed to fetch Dropbox user info.');
        }
    };

    const handleDropboxLink = () => {
        if (appState.dropboxAuth) {
            setFolderPickerVisible(true);
        } else {
            promptAsync();
        }
    };
    
    const handleSelectFolder = (folder) => {
        setAppState(prevState => ({ ...prevState, selectedFolder: folder }));
        setFolderPickerVisible(false);
    };

    const handleArtistSearch = async () => {
        if (!artistName) return;
        setIsLoading(true);
        setError('');
        try {
            const resp = await fetch(SEARCH_ARTIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist: artistName }),
            });
            const result = await resp.json();
            if (result.success) {
                setArtistData(result);
            } else {
                setArtistData({ artist: artistName, custom: true });
                setError('Artist not in database. Creating custom session.');
            }
        } catch (err) {
            setError('Failed to search for artist.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <DropboxFolderPicker 
                visible={isFolderPickerVisible}
                onClose={() => setFolderPickerVisible(false)}
                onSelectFolder={handleSelectFolder}
                dropboxAuth={appState.dropboxAuth}
            />
            <ScrollView style={styles.featureScreenContainer} contentContainerStyle={styles.featureScreenContent}>
                <Text style={styles.featureTitle}>New Session</Text>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Artist Name</Text>
                    <View style={styles.searchContainer2}>
                        <TextInput placeholder="Who is the session for?" placeholderTextColor="#888" style={styles.inputField} value={artistName} onChangeText={setArtistName} onSubmitEditing={handleArtistSearch}/>
                        <TouchableOpacity style={styles.searchIconButton} onPress={handleArtistSearch} disabled={isLoading}>
                            {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="magnify" size={24} color="#8420d0" />}
                        </TouchableOpacity>
                    </View>
                </View>
                {artistData && (
                    <View style={styles.artistInfoCard}>
                        <Image source={{ uri: artistData.top_songs?.[0]?.cover_art_url || 'https://placehold.co/100x100/282828/FFF?text=?' }} style={styles.artistImage} />
                        <View style={styles.artistInfoText}>
                            <Text style={styles.artistName}>{artistData.artist}</Text>
                            {artistData.custom ? (<Text style={styles.artistSubtext}>Custom Artist</Text>) : (
                                <>
                                    <Text style={styles.artistSubtext}>Top Key: {artistData.most_used_keys?.[0] || 'N/A'}</Text>
                                    <Text style={styles.artistSubtext}>BPM Range: {artistData.bpm_range?.min}-{artistData.bpm_range?.max}</Text>
                                </>
                            )}
                        </View>
                    </View>
                )}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Session Notes</Text>
                    <TextInput placeholder="e.g., Artist wants dark trap beats, 140-150bpm..." placeholderTextColor="#888" style={[styles.inputField, { height: 120, textAlignVertical: 'top' }]} value={sessionNotes} onChangeText={setSessionNotes} multiline/>
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Dropbox Folder</Text>
                    <TouchableOpacity style={appState.dropboxAuth ? styles.dropboxButtonLinked : styles.dropboxButton} onPress={handleDropboxLink} disabled={!request}>
                        <MaterialCommunityIcons name="dropbox" size={24} color={appState.dropboxAuth ? "#FFFFFF" : "#0061FF"} style={styles.menuIcon} />
                        <Text style={appState.dropboxAuth ? styles.dropboxButtonTextLinked : styles.dropboxButtonText}>
                            {appState.selectedFolder ? appState.selectedFolder.name : (appState.dropboxAuth ? `Linked as ${appState.dropboxAuth.name}` : 'Link Dropbox Folder')}
                        </Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.primaryButton}><Text style={styles.primaryButtonText}>Save Session</Text></TouchableOpacity>
            </ScrollView>
        </>
    );
};


const SearchByKeyScreen = () => {
  const [selectedKey, setSelectedKey] = useState('A Minor');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [songs, setSongs] = useState([]);
  const [error, setError] = useState('');
  const [showWheel, setShowWheel] = useState(true);

  const genres = [ { label: 'All Genres', value: 'all' }, { label: 'Hip-Hop', value: 'hip-hop' }, { label: 'Pop', value: 'pop' }, { label: 'R&B', value: 'r&b' }, { label: 'Trap', value: 'trap' }, ];
  const musicalKeys = [ { label: 'A Minor', value: 'A Minor' }, { label: 'C Minor', value: 'C Minor' }, { label: 'D Minor', value: 'D Minor' }, { label: 'E Minor', value: 'E Minor' }, { label: 'G Minor', value: 'G Minor' }, { label: 'F Minor', value: 'F Minor' }, { label: 'B Minor', value: 'B Minor' }, { label: 'F# Minor', value: 'F# Minor' }, { label: 'C# Minor', value: 'C# Minor' }, { label: 'G# Minor', value: 'G# Minor' }, { label: 'D# Minor', value: 'D# Minor' }, { label: 'A# Minor', value: 'A# Minor' }, { label: 'C Major', value: 'C Major' }, { label: 'D Major', value: 'D Major' }, { label: 'E Major', value: 'E Major' }, { label: 'F Major', value: 'F Major' }, { label: 'G Major', value: 'G Major' }, { label: 'A Major', value: 'A Major' }, { label: 'B Major', value: 'B Major' }, { label: 'F# Major', value: 'F# Major' }, { label: 'C# Major', value: 'C# Major' }, { label: 'G# Major', value: 'G# Major' }, { label: 'D# Major', value: 'D# Major' }, { label: 'A# Major', value: 'A# Major' }, ];

  const searchSongs = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(SEARCH_BY_KEY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: selectedKey, genre: selectedGenre, limit: 20 }),
      });
      const result = await response.json();
      if (result.success) { setSongs(result.songs || []); } 
      else { setError(result.error || 'Failed to search songs'); setSongs([]); }
    } catch (err) { setError('Failed to connect to server'); setSongs([]);
    } finally { setIsLoading(false); }
  };

  useEffect(() => { searchSongs(); }, [selectedKey, selectedGenre]);
  const handleKeyChange = (newKey) => setSelectedKey(newKey);
  const renderSongItem = ({ item }) => (
    <View style={styles.songCard}>
      <View style={styles.songHeader}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.title || 'Unknown Title'}</Text>
        {item.popularity && (<View style={styles.popularityBadge}><Text style={styles.popularityText}>{item.popularity}%</Text></View>)}
      </View>
      <Text style={styles.songArtist}>{item.artist || 'Unknown Artist'}</Text>
      <View style={styles.songDetails}>
        <Text style={styles.songBpm}>BPM: {item.bpm || 'N/A'}</Text>
        <Text style={styles.songGenre}>{item.genre || 'Unknown'}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.searchContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.searchHeader}>
        <Text style={styles.searchTitle}>Search by Key</Text>
        <TouchableOpacity style={styles.toggleButton} onPress={() => setShowWheel(!showWheel)}>
          <MaterialCommunityIcons name={showWheel ? "view-list" : "circle-outline"} size={18} color="#8420d0" />
        </TouchableOpacity>
      </View>
      <View style={styles.selectionSection}>
        {showWheel ? ( <KeyWheel selectedKey={selectedKey} onKeyChange={handleKeyChange}/> ) : (
          <View style={styles.dropdownSection}>
            <Text style={styles.selectorLabel}>Key:</Text>
            <RNPickerSelect value={selectedKey} onValueChange={setSelectedKey} items={musicalKeys} style={compactPickerStyles}/>
          </View>
        )}
        <View style={styles.genreSection}>
          <Text style={styles.selectorLabel}>Genre:</Text>
          <RNPickerSelect value={selectedGenre} onValueChange={setSelectedGenre} items={genres} style={compactPickerStyles}/>
        </View>
      </View>
      <View style={styles.resultsSection}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>Results</Text>
          {songs.length > 0 && (<Text style={styles.resultsCount}>{songs.length} songs</Text>)}
        </View>
        {isLoading ? ( <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#8420d0" /><Text style={styles.loadingText}>Searching...</Text></View>
        ) : error ? ( <View style={styles.errorContainer}><MaterialCommunityIcons name="alert-circle" size={20} color="#FF453A" /><Text style={styles.errorText}>{error}</Text></View>
        ) : songs.length === 0 ? ( <View style={styles.emptyContainer}><MaterialCommunityIcons name="music-off" size={32} color="#666" /><Text style={styles.emptyText}>No songs found</Text><Text style={styles.emptySubtext}>Try different filters</Text></View>
        ) : ( <FlatList data={songs} renderItem={renderSongItem} keyExtractor={(item, index) => `${item.title || 'song'}-${index}`} scrollEnabled={false} showsVerticalScrollIndicator={false}/>
        )}
      </View>
    </ScrollView>
  );
};

const SearchByArtistScreen = () => {
  const [artistName, setArtistName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [artistData, setArtistData] = useState(null);
  const [error, setError] = useState('');
  const popularArtists = ['Drake', 'Travis Scott', 'Post Malone', 'Kendrick Lamar', 'Future'];
  const searchArtist = async (artist) => {
    setIsLoading(true);
    setError('');
    setArtistData(null);
    try {
      const response = await fetch(SEARCH_ARTIST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artist }), });
      const result = await response.json();
      if (result.success) { setArtistData(result); } 
      else { setError(result.error || 'Artist not found'); }
    } catch (err) { setError('Failed to connect to server');
    } finally { setIsLoading(false); }
  };
  const renderPopularArtist = (artist) => (<TouchableOpacity key={artist} style={styles.popularArtistButton} onPress={() => { setArtistName(artist); searchArtist(artist); }}><Text style={styles.popularArtistText}>{artist}</Text></TouchableOpacity>);
  const renderKeyAnalysis = () => {
    if (!artistData?.most_used_keys) return null;
    return (<View style={styles.analysisSection}><Text style={styles.analysisSectionTitle}>Most Used Keys</Text><View style={styles.keyGrid}>{artistData.most_used_keys.map((key, index) => (<View key={`${key}-${index}`} style={styles.keyBadge}><Text style={styles.keyBadgeText}>{key}</Text><Text style={styles.keyBadgeRank}>#{index + 1}</Text></View>))}</View></View>);
  };
  const renderBpmAnalysis = () => {
    if (!artistData?.bpm_range) return null;
    return (<View style={styles.analysisSection}><Text style={styles.analysisSectionTitle}>BPM Analysis</Text><View style={styles.bpmContainer}><View style={styles.bpmStat}><Text style={styles.bpmStatLabel}>Min</Text><Text style={styles.bpmStatValue}>{artistData.bpm_range?.min || artistData.bpm_range.min}</Text></View><View style={styles.bpmStat}><Text style={styles.bpmStatLabel}>Avg</Text><Text style={styles.bpmStatValue}>{artistData.bpm_range?.avg || artistData.bpm_range.avg}</Text></View><View style={styles.bpmStat}><Text style={styles.bpmStatLabel}>Max</Text><Text style={styles.bpmStatValue}>{artistData.bpm_range?.max || artistData.bpm_range.max}</Text></View></View><Text style={styles.bpmRecommendation}>💡 Recommended BPM range: {artistData.bpm_range.min}-{artistData.bpm_range.max}</Text></View>);
  };
  const renderTopSongs = () => {
    if (!artistData?.top_songs) return null;
    return (<View style={styles.analysisSection}><Text style={styles.analysisSectionTitle}>Top Songs</Text>{artistData.top_songs.map((song, index) => (<View key={`${song.title || 'song'}-${index}`} style={styles.artistSongCard}><View style={styles.artistSongHeader}><Text style={styles.artistSongTitle} numberOfLines={1}>{song.title || 'Unknown Title'}</Text>{song.popularity && (<Text style={styles.artistSongPopularity}>{song.popularity}%</Text>)}</View><View style={styles.artistSongDetails}><Text style={styles.artistSongKey}>Key: {song.key || 'N/A'}</Text><Text style={styles.artistSongBpm}>BPM: {song.bpm || 'N/A'}</Text></View></View>))}</View>);
  };
  return (
    <View style={styles.featureScreen}>
      <Text style={styles.featureTitle}>Artist Analysis</Text>
      <View style={styles.searchContainer2}><TextInput placeholder="Enter Artist Name" placeholderTextColor="#888" style={styles.inputField} value={artistName} onChangeText={setArtistName} onSubmitEditing={() => artistName && searchArtist(artistName)}/><TouchableOpacity style={styles.searchIconButton} onPress={() => artistName && searchArtist(artistName)} disabled={isLoading}><MaterialCommunityIcons name="magnify" size={24} color={isLoading ? "#666" : "#8420d0"} /></TouchableOpacity></View>
      <View style={styles.popularArtistsContainer}><Text style={styles.popularArtistsTitle}>Popular Artists:</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularArtistsScroll}>{popularArtists.map(renderPopularArtist)}</ScrollView></View>
      {isLoading && (<View style={styles.loadingContainer}><ActivityIndicator size="large" color="#8420d0" /><Text style={styles.loadingText}>Analyzing {artistName}...</Text></View>)}
      {error && (<View style={styles.errorContainer}><MaterialCommunityIcons name="alert-circle" size={24} color="#FF453A" /><Text style={styles.errorText}>{error}</Text></View>)}
      {artistData && (<ScrollView style={styles.analysisResults} showsVerticalScrollIndicator={false}><Text style={styles.analysisTitle}>Analysis for {artistData.artist}</Text>{artistData.source && (<Text style={styles.dataSource}>Data source: {artistData.source === 'curated' ? 'Curated Database' : 'Genius API'}</Text>)}{renderKeyAnalysis()}{renderBpmAnalysis()}{renderTopSongs()}</ScrollView>)}
    </View>
  );
};

const EnhancedDetectScreen = () => {
  const [recording, setRecording] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const [displayedConfidence, setDisplayedConfidence] = useState(0);
  const [chordProgressions, setChordProgressions] = useState([]);
  const [suggestedArtists, setSuggestedArtists] = useState([]);
  const stopTimeoutRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const confidenceAnim = useRef(new Animated.Value(0)).current;

  const getArtistsForKey = (detectedKey, detectedBpm) => {
    const artistDatabase = { 'Drake': { mostUsedKeys: ['A Minor', 'D Minor', 'E Minor', 'C Major'], bpmRange: { min: 70, max: 140, avg: 105 }, topSongs: [ { title: "God's Plan", key: 'A Minor', bpm: 77, popularity: 98 }, { title: 'Hotline Bling', key: 'D Minor', bpm: 135, popularity: 94 }, { title: 'In My Feelings', key: 'E Minor', bpm: 91, popularity: 92 }, { title: 'One Dance', key: 'C Major', bpm: 104, popularity: 89 } ] }, 'Travis Scott': { mostUsedKeys: ['A Minor', 'G Minor', 'D Major', 'E Major'], bpmRange: { min: 130, max: 180, avg: 155 }, topSongs: [ { title: 'Sicko Mode', key: 'A Minor', bpm: 155, popularity: 95 }, { title: 'Antidote', key: 'D Major', bpm: 140, popularity: 88 }, { title: 'Goosebumps', key: 'E Major', bpm: 130, popularity: 90 }, { title: 'Highest in the Room', key: 'G Minor', bpm: 130, popularity: 87 } ] }, 'Post Malone': { mostUsedKeys: ['D Minor', 'E Minor', 'C Major', 'G Major'], bpmRange: { min: 90, max: 160, avg: 125 }, topSongs: [ { title: 'Congratulations', key: 'D Minor', bpm: 123, popularity: 89 }, { title: 'Rockstar', key: 'E Minor', bpm: 160, popularity: 96 }, { title: 'Sunflower', key: 'C Major', bpm: 90, popularity: 91 }, { title: 'Circles', key: 'G Major', bpm: 120, popularity: 87 } ] }, 'Kendrick Lamar': { mostUsedKeys: ['A Minor', 'D Minor', 'G Minor', 'D Major'], bpmRange: { min: 80, max: 160, avg: 120 }, topSongs: [ { title: 'HUMBLE.', key: 'A Minor', bpm: 150, popularity: 92 }, { title: 'DNA', key: 'G Minor', bpm: 95, popularity: 85 }, { title: 'Money Trees', key: 'D Major', bpm: 130, popularity: 78 }, { title: 'Alright', key: 'D Minor', bpm: 100, popularity: 82 } ] }, 'Future': { mostUsedKeys: ['C Minor', 'A Minor', 'E Major', 'G Minor'], bpmRange: { min: 130, max: 180, avg: 155 }, topSongs: [ { title: 'Mask Off', key: 'C Minor', bpm: 150, popularity: 88 }, { title: 'Life Is Good', key: 'E Major', bpm: 140, popularity: 85 }, { title: 'Jumpman', key: 'A Minor', bpm: 135, popularity: 82 }, { title: 'March Madness', key: 'G Minor', bpm: 145, popularity: 80 } ] }, 'The Weeknd': { mostUsedKeys: ['G Minor', 'A Minor', 'E Minor', 'D Minor'], bpmRange: { min: 80, max: 140, avg: 110 }, topSongs: [ { title: 'Starboy', key: 'G Minor', bpm: 186, popularity: 90 }, { title: 'Blinding Lights', key: 'G Minor', bpm: 171, popularity: 94 }, { title: 'The Hills', key: 'A Minor', bpm: 113, popularity: 88 }, { title: 'Can\'t Feel My Face', key: 'E Minor', bpm: 108, popularity: 86 } ] }, 'Juice WRLD': { mostUsedKeys: ['E Minor', 'A Minor', 'D Minor', 'G Major'], bpmRange: { min: 70, max: 140, avg: 105 }, topSongs: [ { title: 'Lucid Dreams', key: 'E Minor', bpm: 84, popularity: 93 }, { title: 'All Girls Are The Same', key: 'A Minor', bpm: 85, popularity: 78 }, { title: 'Robbery', key: 'D Minor', bpm: 140, popularity: 82 }, { title: 'Legends', key: 'G Major', bpm: 72, popularity: 75 } ] }, 'Lil Baby': { mostUsedKeys: ['A Minor', 'C Minor', 'D Minor', 'G Minor'], bpmRange: { min: 120, max: 160, avg: 140 }, topSongs: [ { title: 'Drip Too Hard', key: 'A Minor', bpm: 140, popularity: 85 }, { title: 'Yes Indeed', key: 'C Minor', bpm: 143, popularity: 82 }, { title: 'Life Goes On', key: 'D Minor', bpm: 135, popularity: 78 }, { title: 'Emotionally Scarred', key: 'G Minor', bpm: 125, popularity: 80 } ] } };
    const matchingArtists = [];
    Object.entries(artistDatabase).forEach(([artistName, data]) => {
      if (data.mostUsedKeys.includes(detectedKey)) {
        const keyMatchRank = data.mostUsedKeys.indexOf(detectedKey) + 1;
        const bpmMatch = detectedBpm >= data.bpmRange.min && detectedBpm <= data.bpmRange.max;
        const bpmDistance = Math.abs(detectedBpm - data.bpmRange.avg);
        const songsInKey = data.topSongs.filter(song => song.key === detectedKey);
        matchingArtists.push({ name: artistName, keyRank: keyMatchRank, bpmMatch, bpmDistance, avgBpm: data.bpmRange.avg, songsInKey, confidence: bpmMatch ? (keyMatchRank === 1 ? 95 : 85) : (keyMatchRank === 1 ? 75 : 65) });
      }
    });
    return matchingArtists.sort((a, b) => {
      if (a.bpmMatch !== b.bpmMatch) return b.bpmMatch - a.bpmMatch;
      if (a.keyRank !== b.keyRank) return a.keyRank - b.keyRank;
      return a.bpmDistance - b.bpmDistance;
    }).slice(0, 5);
  };

  const getChordProgressions = async (key) => {
    try {
      const response = await fetch(CHORD_PROGRESSIONS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
      });
      const result = await response.json();
      if (result.success) { setChordProgressions(result.chord_progressions || []); }
    } catch (err) { console.error('Failed to get chord progressions:', err); }
  };

  useEffect(() => {
    if (analysisResult?.key) {
      getChordProgressions(analysisResult.key);
      const artists = getArtistsForKey(analysisResult.key, analysisResult.bpm);
      setSuggestedArtists(artists);
    }
  }, [analysisResult?.key, analysisResult?.bpm]);

  useEffect(() => {
    if (!recording && !isAnalyzing) {
      Animated.loop(Animated.sequence([ Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), ])).start();
    } else { pulseAnim.setValue(1); }
  }, [recording, isAnalyzing, pulseAnim]);

  useEffect(() => {
    if (recording) {
      rippleAnim.setValue(0);
      Animated.loop(Animated.timing(rippleAnim, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true })).start();
    } else { rippleAnim.setValue(0); }
  }, [recording, rippleAnim]);

  useEffect(() => {
    if (analysisResult?.key_confidence != null) {
      confidenceAnim.setValue(0);
      Animated.timing(confidenceAnim, { toValue: analysisResult.key_confidence, duration: 1000, useNativeDriver: false, }).start();
      const id = confidenceAnim.addListener(({ value }) => { setDisplayedConfidence(Math.round(value * 10) / 10); });
      return () => confidenceAnim.removeListener(id);
    }
  }, [analysisResult?.key_confidence, confidenceAnim]);

  const getConfidenceColor = (value) => {
    if (value >= 80) return '#8420d0';
    if (value >= 50) return '#FFA500';
    return '#FF453A';
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { setError('Microphone permission was not granted.'); return; }
      if (recording) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);
      stopTimeoutRef.current = setTimeout(() => { stopRecordingAndAnalyze(newRecording); }, 15000);
    } catch (err) { console.error('Failed to start recording', err); setError('Failed to start recording.'); }
  };

  const stopRecordingAndAnalyze = async (activeRecording) => {
    if (!activeRecording) return;
    try {
      setIsAnalyzing(true);
      if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      const formData = new FormData();
      formData.append('audio', { uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri, type: 'audio/x-m4a', name: 'recording.m4a', });
      const response = await fetch(ANALYZE_URL, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' }, });
      const result = await response.json();
      if (result.error) { setError(`Analysis failed: ${result.error}`); } 
      else { setAnalysisResult(result); }
    } catch (e) { console.error('stopRecordingAndAnalyze error:', e); setError('Could not analyze audio.');
    } finally { setRecording(null); setIsAnalyzing(false); }
  };

  const handleListenPress = async () => {
    setError('');
    if (recording) { await stopRecordingAndAnalyze(recording); } 
    else { await startRecording(); }
  };

  const handleReset = () => {
    if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
    setAnalysisResult(null);
    setChordProgressions([]);
    setSuggestedArtists([]);
  };

  const handleOpenSpotify = (url) => { if (url) Linking.openURL(url).catch(err => console.error("Couldn't load page", err)); };

  const getButtonContent = () => {
    if (isAnalyzing) return <ActivityIndicator size="large" color="#FFFFFF" />;
    if (recording) return <WaveformAnimation />;
    return <MaterialCommunityIcons name="music-circle-outline" size={100} color="white" />;
  };

  const renderArtistSuggestions = () => {
    if (suggestedArtists.length === 0) return null;
    return (
      <View style={styles.detectedSongContainer}>
        <Text style={styles.suggestionsTitle}>🎤 Artists Who Use {analysisResult.key}</Text>
        <Text style={styles.suggestionsSubtitle}>These artists frequently use this key in their music:</Text>
        {suggestedArtists.map((artist, index) => (
          <View key={artist.name} style={styles.artistSuggestionCard}>
            <View style={styles.artistSuggestionHeader}>
              <Text style={styles.artistSuggestionName}>{artist.name}</Text>
              <View style={styles.artistBadges}>
                <View style={[ styles.keyRankBadge, { backgroundColor: artist.keyRank === 1 ? '#8420d0' : '#FFA500' } ]}>
                  <Text style={styles.keyRankText}>#{artist.keyRank} Key</Text>
                </View>
                {artist.bpmMatch && (<View style={styles.bpmMatchBadge}><Text style={styles.bpmMatchText}>BPM Match</Text></View>)}
              </View>
            </View>
            <Text style={styles.artistSuggestionDetails}>Avg BPM: {artist.avgBpm} • Confidence: {artist.confidence}%</Text>
            {artist.songsInKey.length > 0 && (
              <View style={styles.songsInKeyContainer}>
                <Text style={styles.songsInKeyTitle}>Songs in {analysisResult.key}:</Text>
                {artist.songsInKey.slice(0, 2).map((song, songIndex) => (<Text key={songIndex} style={styles.songInKeyText}>• {song.title} ({song.bpm} BPM)</Text>))}
              </View>
            )}
          </View>
        ))}
        <View style={styles.producerTipCard}>
          <MaterialCommunityIcons name="lightbulb-on" size={20} color="#8420d0" />
          <View style={styles.producerTipContent}>
            <Text style={styles.producerTipTitle}>Producer Tip</Text>
            <Text style={styles.producerTipText}>Try making beats in {analysisResult.key} at {analysisResult.bpm} BPM to match the style of these artists!</Text>
          </View>
        </View>
      </View>
    );
  };

  if (analysisResult) {
    return (
      <View style={styles.resultsPage}>
        <ScrollView style={styles.resultsScrollView}>
          <View style={styles.analysisContainer}>
            <View style={styles.mainKeyContainer}>
              <Text style={styles.resultLabel}>DETECTED KEY</Text>
              {typeof displayedConfidence === 'number' && (<Text style={[styles.confidenceText, { color: getConfidenceColor(displayedConfidence) }]}>Confidence: {displayedConfidence.toFixed(1)}%</Text>)}
              <Text style={styles.mainKeyValue}>{analysisResult.key}</Text>
              {analysisResult.relative_key && (<Text style={styles.relativeKeyText}>Relative Key: {analysisResult.relative_key}</Text>)}
              <Keyboard detectedKey={analysisResult} />
            </View>
            <View style={styles.secondaryResultsContainer}>
              <View style={[styles.resultBox, { flex: 2 }]}><Text style={styles.resultLabel}>Other Possible Keys</Text>{analysisResult.alternative_keys?.length > 0 ? (<Text style={styles.alternativeKeyText}>{analysisResult.alternative_keys.slice(0, 2).join(', ')}</Text>) : (<Text style={styles.alternativeKeyText}>N/A</Text>)}</View>
              <View style={[styles.resultBox, { flex: 1 }]}><Text style={styles.resultLabel}>BPM</Text><Text style={styles.resultValue}>{analysisResult.bpm}</Text></View>
            </View>
            {analysisResult.status === 'recognized' ? (
              <View style={styles.detectedSongContainer}>
                <Text style={styles.suggestionsTitle}>🎵 Song Recognized</Text>
                <TouchableOpacity onPress={() => handleOpenSpotify(analysisResult.spotify_url)} activeOpacity={0.7} disabled={!analysisResult.spotify_url}>
                  <View style={[styles.suggestionCard, styles.recognizedCard]}>
                    <View style={styles.recognizedCardContent}>
                      {analysisResult.cover_art_url ? (<Image source={{ uri: analysisResult.cover_art_url }} style={styles.albumArt} />) : (<View style={styles.albumArtPlaceholder}><MaterialCommunityIcons name="album" size={40} color="#B3B3B3" /></View>)}
                      <View style={styles.recognizedSongInfo}>
                        <Text style={styles.suggestionTitle} numberOfLines={1}>{analysisResult.title}</Text>
                        <Text style={styles.suggestionArtist} numberOfLines={1}>{analysisResult.artist}</Text>
                        {analysisResult.album && (<Text style={styles.albumInfo} numberOfLines={1}>{analysisResult.album} ({analysisResult.release_date?.split('-')[0]})</Text>)}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ) : analysisResult.status === 'not_recognized' && (
              <View style={styles.detectedSongContainer}><View style={styles.suggestionCard}><Text style={styles.suggestionTitle}>No Song Detected</Text><Text style={styles.suggestionArtist}>But we analyzed the musical elements!</Text></View></View>
            )}
            {renderArtistSuggestions()}
            {chordProgressions.length > 0 && (
              <View style={styles.detectedSongContainer}>
                <Text style={styles.suggestionsTitle}>🎹 Common Chord Progressions</Text>
                <Text style={styles.suggestionsSubtitle}>Try these progressions in {analysisResult.key}:</Text>
                {chordProgressions.map((progression, index) => (<View key={index} style={styles.chordProgressionCard}><Text style={styles.chordProgressionText}>{progression}</Text></View>))}
              </View>
            )}
          </View>
        </ScrollView>
        <TouchableOpacity style={styles.detectAnotherButton} onPress={handleReset}><Text style={styles.detectAnotherButtonText}>Detect Another Song</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.mainContent}>
      <Text style={styles.statusLabel}>{recording ? 'Listening for 15 seconds…' : 'Click the icon to start detecting audio'}</Text>
      <TouchableOpacity style={styles.listenButtonWrapper} onPress={handleListenPress} disabled={isAnalyzing}>
        {recording && [...Array(3).keys()].map(i => (<Animated.View key={i} style={[ styles.ripple, { opacity: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 4 + i * 2] }) }], }, ]}/>))}
        <Animated.View style={[ styles.listenButton, recording ? styles.recordingButton : styles.idleButton, { transform: [{ scale: pulseAnim }] }, ]}>{getButtonContent()}</Animated.View>
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('MainMenu');
  const [appState, setAppState] = useState({
      dropboxAuth: null,
      selectedFolder: null,
  });

  const navigate = (screen) => {
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'SearchByKey':
        return <SearchByKeyScreen />;
      case 'SearchByArtist':
        return <SearchByArtistScreen />;
      case 'Detect':
        return <EnhancedDetectScreen />;
      case 'Sessions':
        return <SessionsScreen navigate={navigate} />;
      case 'NewSession':
        return <NewSessionScreen navigate={navigate} appState={appState} setAppState={setAppState} />;
      case 'LinkDropbox':
        return <LinkDropboxScreen navigate={navigate} setAppState={setAppState} />;
      default:
        return <MainMenu navigate={navigate} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigate('MainMenu')} style={styles.headerTouchable} disabled={currentScreen === 'MainMenu'}>
            {currentScreen !== 'MainMenu' && (
              <MaterialCommunityIcons name="arrow-left" size={28} color="#FFFFFF" style={styles.backIcon} />
            )}
            <Image source={require('./assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
        </TouchableOpacity>
        {currentScreen === 'MainMenu' && <Text style={styles.subtitle}>A Producer Companion App</Text>}
      </View>
      {renderScreen()}
    </SafeAreaView>
  );
}

// COMPLETE STYLES OBJECT
const styles = StyleSheet.create({
  // Main app styles
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
  },
  header: {
    marginTop: 60,
    marginBottom: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  backIcon: {
    marginRight: 10,
  },
  logoImage: {
    width: 300,
    height: 100,
    marginBottom: -20,
  },
  subtitle: {
    fontSize: 16,
    color: '#B3B3B3',
    marginTop: 8,
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
    width: '90%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    backgroundColor: '#282828',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 25,
    width: '100%',
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  featureScreen: {
    flex: 1,
    width: '90%',
    alignItems: 'center',
    paddingTop: 20,
  },
  featureScreenContainer: {
    flex: 1,
    width: '90%',
  },
  featureScreenContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  artistSuggestionCard: {
    backgroundColor: '#282828',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#8420d0',
  },
  artistSuggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  artistSuggestionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  artistBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyRankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  keyRankText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bpmMatchBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 6,
  },
  bpmMatchText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  artistSuggestionDetails: {
    fontSize: 14,
    color: '#B3B3B3',
    marginBottom: 10,
  },
  songsInKeyContainer: {
    backgroundColor: '#1C1C1C',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  songsInKeyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8420d0',
    marginBottom: 6,
  },
  songInKeyText: {
    fontSize: 13,
    color: '#CCCCCC',
    marginBottom: 3,
    paddingLeft: 5,
  },
  producerTipCard: {
    flexDirection: 'row',
    backgroundColor: '#1A2F1A',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#8420d0',
  },
  producerTipContent: {
    flex: 1,
    marginLeft: 10,
  },
  producerTipTitle: {
    color: '#8420d0',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  producerTipText: {
    color: '#CCCCCC',
    fontSize: 13,
    lineHeight: 18,
  },

  // SearchByKey specific styles
  searchContainer: {
    flex: 1,
    backgroundColor: '#121212',
    width: '100%',
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  searchTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  toggleButton: {
    backgroundColor: '#282828',
    padding: 8,
    borderRadius: 20,
  },
  selectionSection: {
    backgroundColor: '#1A1A1A',
    marginHorizontal: 15,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 15,
  },
  dropdownSection: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  genreSection: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  selectorLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  resultsSection: {
    paddingHorizontal: 20,
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  resultsCount: {
    fontSize: 12,
    color: '#8420d0',
    fontWeight: '600',
  },

  // SearchByArtist specific styles
  searchContainer2: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  inputField: {
    backgroundColor: '#282828',
    color: '#FFFFFF',
    flex: 1,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginRight: 10,
  },
  searchIconButton: {
    backgroundColor: '#282828',
    padding: 15,
    borderRadius: 8,
  },
  popularArtistsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  popularArtistsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  popularArtistsScroll: {
    flexDirection: 'row',
  },
  popularArtistButton: {
    backgroundColor: '#8420d0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
  },
  popularArtistText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  analysisSection: {
    width: '100%',
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  analysisSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  keyBadge: {
    backgroundColor: '#8420d0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    width: '48%',
    alignItems: 'center',
  },
  keyBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  keyBadgeRank: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
  },
  bpmContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  bpmStat: {
    alignItems: 'center',
  },
  bpmStatLabel: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 4,
  },
  bpmStatValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  bpmRecommendation: {
    color: '#8420d0',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  artistSongCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  artistSongHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  artistSongTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  artistSongPopularity: {
    color: '#8420d0',
    fontSize: 12,
    fontWeight: 'bold',
  },
  artistSongDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  artistSongKey: {
    color: '#8420d0',
    fontSize: 14,
  },
  artistSongBpm: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  analysisResults: {
    width: '100%',
    flex: 1,
  },
  analysisTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  dataSource: {
    fontSize: 12,
    color: '#B3B3B3',
    textAlign: 'center',
    marginBottom: 20,
  },

  // Song card styles
  songCard: {
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  songHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  popularityBadge: {
    backgroundColor: '#8420d0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  songArtist: {
    fontSize: 14,
    color: '#B3B3B3',
    marginBottom: 8,
  },
  songDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  songBpm: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  songGenre: {
    fontSize: 14,
    color: '#8420d0',
    fontWeight: '500',
  },

  // Common styles
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#B3B3B3',
    marginTop: 10,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 14,
    marginLeft: 8,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#B3B3B3',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 5,
  },

  // Detect screen styles
  listenButtonWrapper: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listenButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    overflow: 'hidden',
  },
  idleButton: {
    backgroundColor: '#8420d0',
  },
  recordingButton: {
    backgroundColor: '#FF453A',
  },
  ripple: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 69, 58, 0.5)',
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#B3B3B3',
    marginBottom: 20,
    textAlign: 'center',
  },
  resultsPage: {
    flex: 1,
    width: '100%',
  },
  resultsScrollView: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
  },
  analysisContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20,
  },
  mainKeyContainer: {
    width: '100%',
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  mainKeyValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#8420d0',
    marginVertical: 5,
  },
  relativeKeyText: {
    fontSize: 16,
    color: '#B3B3B3',
    fontWeight: '600',
    marginTop: 5,
  },
  secondaryResultsContainer: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 10,
  },
  resultBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#282828',
    padding: 20,
    borderRadius: 12,
    marginHorizontal: 5,
    flex: 1,
  },
  resultLabel: {
    fontSize: 14,
    color: '#B3B3B3',
    fontWeight: '600',
    marginBottom: 8,
  },
  resultValue: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  alternativeKeyText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  keyboardContainer: {
    width: '100%',
    height: 80,
    flexDirection: 'row',
    position: 'relative',
    marginTop: 15,
  },
  whiteKey: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    margin: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 5,
  },
  blackKeysContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    flexDirection: 'row',
    paddingHorizontal: '7.14%',
  },
  blackKeyWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  blackKey: {
    width: '70%',
    height: '100%',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 4,
    zIndex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 2,
  },
  blackKeyText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
  },
  highlightedKey: {
    backgroundColor: '#8420d0',
  },
  keyText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 10,
  },
  detectedSongContainer: {
    width: '100%',
    marginTop: 10,
  },
  suggestionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    paddingLeft: 10,
  },
  suggestionsSubtitle: {
    fontSize: 14,
    color: '#B3B3B3',
    marginBottom: 10,
    paddingLeft: 10,
  },
  suggestionCard: {
    backgroundColor: '#282828',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  recognizedCard: {
    backgroundColor: '#8420d0',
    padding: 10,
  },
  recognizedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 15,
  },
  albumArtPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 6,
    marginRight: 15,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recognizedSongInfo: {
    flex: 1,
  },
  albumInfo: {
    fontSize: 12,
    color: '#DDDDDD',
    marginTop: 4,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  suggestionArtist: {
    fontSize: 14,
    color: '#B3B3B3',
    marginTop: 4,
  },
  chordProgressionCard: {
    backgroundColor: '#1C1C1C',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
  },
  chordProgressionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60%',
    width: '100%',
  },
  waveformBar: {
    width: 10,
    backgroundColor: 'white',
    marginHorizontal: 4,
    borderRadius: 5,
    height: '80%',
  },
  detectAnotherButton: {
    backgroundColor: '#8420d0',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    margin: 20,
    alignItems: 'center',
  },
  detectAnotherButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confidenceText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  // New Session Screen Styles
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  artistInfoCard: {
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 15,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  artistImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 15,
  },
  artistInfoText: {
    flex: 1,
  },
  artistName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  artistSubtext: {
    fontSize: 14,
    color: '#B3B3B3',
    marginTop: 4,
  },
  dropboxButton: {
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropboxButtonLinked: {
    backgroundColor: '#0061FF',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropboxButtonText: {
    color: '#0061FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dropboxButtonTextLinked: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#8420d0',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
   modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#282828',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  folderName: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  closeButton: {
    backgroundColor: '#FF453A',
    borderRadius: 8,
    padding: 15,
    marginTop: 20,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  redirectUriText: {
      color: '#B3B3B3',
      marginTop: 20,
      fontSize: 14,
      textAlign: 'center',
  },
  redirectUriInput: {
      backgroundColor: '#282828',
      color: '#FFFFFF',
      width: '100%',
      borderRadius: 8,
      padding: 10,
      fontSize: 12,
      marginTop: 10,
      textAlign: 'center',
  },
  folderNavBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: 10,
      marginBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#404040',
  },
  currentPathText: {
      color: '#FFFFFF',
      fontSize: 16,
      flex: 1,
      textAlign: 'center',
      marginHorizontal: 10,
  },
  selectFolderButton: {
      backgroundColor: '#1DB954',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
  },
  selectFolderButtonText: {
      color: '#FFFFFF',
      fontWeight: 'bold',
  },
  statsText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginVertical: 4,
  },
  songStats: {
      marginLeft: 'auto',
      alignItems: 'flex-end',
  }
});

// Compact picker styles
const compactPickerStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 6,
    color: '#FFFFFF',
    backgroundColor: '#282828',
    paddingRight: 25,
  },
  inputAndroid: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 6,
    color: '#FFFFFF',
    backgroundColor: '#282828',
    paddingRight: 25,
  },
});
