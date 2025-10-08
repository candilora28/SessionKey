import React, { useState, useEffect, useRef } from 'react';
import {
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
  Switch,
  Modal,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import KeyWheel from './KeyWheel';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import DropboxBrowser from './DropboxBrowser';
import DropboxFolderPicker from './DropboxFolderPicker';
import Keyboard from './src/components/Keyboard';
import WaveformAnimation from './src/components/WaveformAnimation';
import LottieView from 'lottie-react-native'; 
import { StatusBar } from 'expo-status-bar';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { styles, compactPickerStyles, sessionStyles } from './styles';

// --- 1. FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

// --- Server Configuration ---
// TODO: Replace with your actual Railway deployment URL
const SERVER_URL = 'https://your-app-name.railway.app'; // Replace this with your Railway URL
const ANALYZE_URL = `${SERVER_URL}/analyze`;
const SEARCH_ARTIST_URL = `${SERVER_URL}/search_artist`;
const SEARCH_BY_KEY_URL = `${SERVER_URL}/search_by_key`;
const CHORD_PROGRESSIONS_URL = `${SERVER_URL}/get_chord_progressions`;
const ARTISTS_BY_KEY_URL = `${SERVER_URL}/get_artists_by_key`;

const DROPBOX_APP_KEY = '1qfdizul5aujvge';
const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

const firebaseConfig = {
  apiKey: "AIzaSyDxol2vFJreQ3NEfNguCPaU6CrIhVCRVko",
  authDomain: "keyfinder-prod-app.firebaseapp.com",
  projectId: "keyfinder-prod-app",
  storageBucket: "keyfinder-prod-app.firebasestorage.app",
  messagingSenderId: "926639284309",
  appId: "1:926639284309:web:393eeffea74634442bf4dc",
  measurementId: "G-F9LEBNTQ6W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const CustomPicker = ({ items, selectedValue, onValueChange, placeholder }) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [tempSelectedValue, setTempSelectedValue] = useState(selectedValue);
    const selectedLabel = items.find(item => item.value === selectedValue)?.label || placeholder;

    const openModal = () => {
        setTempSelectedValue(selectedValue);
        setModalVisible(true);
    };

    const handleDone = () => {
        onValueChange(tempSelectedValue);
        setModalVisible(false);
    };

    return (
        <>
            <TouchableOpacity style={styles.pickerDisplayButton} onPress={openModal}>
                <Text style={styles.pickerDisplayText}>{selectedLabel}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={() => setModalVisible(false)}>
                    <View onStartShouldSetResponder={() => true}>
                        {/* --- THE FIX: Removed fixed height and added padding --- */}
                        <View style={[styles.modalContent, { height: 'auto', paddingBottom: 40 }]}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{placeholder}</Text>
                                <TouchableOpacity onPress={handleDone}>
                                    <Text style={styles.modalCloseButtonText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                            <Picker
                                selectedValue={tempSelectedValue}
                                onValueChange={(itemValue) => setTempSelectedValue(itemValue)}
                                itemStyle={{ color: 'white' }}
                            >
                                {items.map((item) => (
                                    <Picker.Item key={item.value} label={item.label} value={item.value} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
};


// --- Screen Components ---
const MainMenu = ({ navigate }) => {
  return (
    <View style={styles.mainContent}>
      <View style={{ flex: 0.6, width: '115%' }}>
        {/* --- THE FIX: Added a style prop with width and height --- */}
        <LottieView
            style={{ width: '100%', height: '100%' }}
            source={require('./assets/wave-animation.json')} // Make sure your file is named this and in the assets folder
            autoPlay
            loop
        />
         {/* The foreground animation, layered on top */}
        <LottieView
            style={{ 
                width: '60%', 
                height: '60%', 
                position: 'absolute', // This is the key
                top: 55,
                left: 85,
                
            }}
            source={require('./assets/piano-icon.json')} // Your new Lottie file
            autoPlay
            loop
            speed={0.5}
        />
      </View>
      <View style={{ flex: 1, width: '100%', justifyContent: 'center' }}>
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
    </View>
  );
};

const SessionsScreen = ({ navigate, db }) => { // <-- Receive db as a prop
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "sessions"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const sessionsData = [];
            querySnapshot.forEach((doc) => {
                sessionsData.push({ ...doc.data(), id: doc.id });
            });
            setSessions(sessionsData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleOpenSession = (session) => {
        console.log('Opening session:', session);
        // Navigate to NewSession screen with the session data for editing
        navigate('NewSession', { editMode: true, sessionData: session });
    };

    const editSession = (session) => {
        // Navigate to edit mode - for now just log
        console.log('Edit session:', session.id);
        // You could navigate to the NewSession screen with pre-filled data
        // navigate('NewSession', { editMode: true, sessionData: session });
    };

    const renderSessionItem = ({ item }) => (
        <TouchableOpacity style={sessionStyles.sessionCard} onPress={() => handleOpenSession(item)}>
            <View style={sessionStyles.sessionCardContent}>
                {/* Artist image */}
                <View style={sessionStyles.sessionArtistImageContainer}>
                    {item.artistDetails?.top_songs?.[0]?.cover_art_url ? (
                        <Image 
                            source={{ uri: item.artistDetails.top_songs[0].cover_art_url }} 
                            style={sessionStyles.sessionArtistImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={sessionStyles.sessionArtistImagePlaceholder}>
                            <MaterialCommunityIcons 
                                name={item.artistDetails?.custom ? "account" : "account-music"} 
                                size={20} 
                                color="#666" 
                            />
                        </View>
                    )}
                </View>
                
                {/* Session info */}
                <View style={sessionStyles.sessionCardInfo}>
                    <Text style={sessionStyles.sessionCardTitle}>{item.artistName}</Text>
                    <View style={sessionStyles.sessionCardDetails}>
                        <Text style={sessionStyles.sessionCardDate}>
                            {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
                        </Text>
                        {item.artistDetails?.custom ? (
                            <Text style={sessionStyles.sessionCardType}>Custom Artist</Text>
                        ) : item.artistDetails?.most_used_keys?.[0] ? (
                            <Text style={sessionStyles.sessionCardType}>
                                Key: {item.artistDetails.most_used_keys[0]}
                            </Text>
                        ) : null}
                    </View>
                    {item.sessionNotes && (
                        <Text style={sessionStyles.sessionCardNotes} numberOfLines={1}>
                            {item.sessionNotes}
                        </Text>
                    )}
                </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.featureScreen}>
            <Text style={styles.featureTitle}>Your Sessions</Text>
            {isLoading ? (
                <ActivityIndicator size="large" color="#8420d0" />
            ) : sessions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="clipboard-text-off-outline" size={32} color="#666" />
                    <Text style={styles.emptyText}>No Sessions Yet</Text>
                    <Text style={styles.emptySubtext}>Create a new session to get started.</Text>
                </View>
            ) : (
                <FlatList
                    data={sessions}
                    renderItem={renderSessionItem}
                    keyExtractor={item => item.id}
                    style={{ width: '100%' }}
                />
            )}
            <TouchableOpacity style={styles.primaryButton} onPress={() => navigate('NewSession')}>
                <Text style={styles.primaryButtonText}>Create New Session</Text>
            </TouchableOpacity>
        </View>
    );
};

const NewSessionScreen = ({ navigate, appState, setAppState, db, params }) => { // <-- Receive db and params as props
    // Check if we're in edit mode
    const isEditMode = params?.editMode && params?.sessionData;
    const sessionData = params?.sessionData;
    
    const [artistName, setArtistName] = useState(isEditMode ? sessionData.artistName : '');
    const [sessionNotes, setSessionNotes] = useState(isEditMode ? sessionData.sessionNotes : '');
    const [artistData, setArtistData] = useState(isEditMode ? sessionData.artistDetails : null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isFolderPickerVisible, setFolderPickerVisible] = useState(false);
    const [isContentBrowserVisible, setIsContentBrowserVisible] = useState(false);
    const [selectedBrowseFolderPath, setSelectedBrowseFolderPath] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);


    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: DROPBOX_APP_KEY,
            scopes: ['files.metadata.read', 'files.content.read', 'sharing.write'],
            responseType: 'token',
            redirectUri,
            usePKCE: false,
        },
        {
            authorizationEndpoint: 'https://www.dropbox.com/oauth2/authorize',
        }
    );

    // Initialize data if in edit mode
    useEffect(() => {
        if (isEditMode && sessionData.dropboxFolder) {
            setAppState(prevState => ({ 
                ...prevState, 
                selectedFolder: sessionData.dropboxFolder 
            }));
            setSelectedBrowseFolderPath(sessionData.dropboxFolder.path_lower || '');
        }
    }, [isEditMode, sessionData]);

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
        setSelectedBrowseFolderPath(folder.path_lower);
        setIsContentBrowserVisible(true);
    };

    const handleArtistSearch = async () => {
        if (!artistName) return;
        setIsLoading(true);
        setError('');
        setArtistData(null); // Clear previous results
        setSearchSuggestions([]);
        setShowSuggestions(false);
        
        try {
            const resp = await fetch(SEARCH_ARTIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    artist: artistName,
                    include_suggestions: true, // Request suggestions for fuzzy matching
                    max_suggestions: 3
                }),
            });
            const result = await resp.json();
            
            if (result.success) {
                // Exact artist found in database
                setArtistData(result);
                setError(''); // Clear any previous errors
                setShowSuggestions(false);
            } else if (result.suggestions && result.suggestions.length > 0) {
                // No exact match, but we have suggestions
                setArtistData(null);
                setSearchSuggestions(result.suggestions);
                setShowSuggestions(true);
                setError(''); // Clear error since we have suggestions
            } else {
                // No exact match and no suggestions - offer custom option
                setArtistData(null);
                setSearchSuggestions([]);
                setShowSuggestions(false);
                setError(`"${artistName}" not found in our database. You can still create a custom session below.`);
            }
        } catch (err) {
            console.error("Artist Search Error:", err);
            setError('Unable to search database. Please check your connection and try again.');
            setArtistData(null);
            setSearchSuggestions([]);
            setShowSuggestions(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCustomArtist = () => {
        if (!artistName) return;
        setArtistData({ 
            artist: artistName, 
            custom: true,
            created_at: new Date().toISOString()
        });
        setError(''); // Clear error when creating custom artist
        setShowSuggestions(false);
    };

    const handleSelectSuggestion = async (suggestedArtist) => {
        setArtistName(suggestedArtist.artist);
        setIsLoading(true);
        setShowSuggestions(false);
        
        try {
            // Fetch full data for the suggested artist
            const resp = await fetch(SEARCH_ARTIST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist: suggestedArtist.artist }),
            });
            const result = await resp.json();
            
            if (result.success) {
                setArtistData(result);
                setError('');
            }
        } catch (err) {
            console.error("Error fetching suggested artist:", err);
            setError('Failed to load artist data.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSession = async () => {
        if (!artistName) {
            setError('Please enter an artist name.');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            const sessionData = {
                artistName: artistName,
                sessionNotes: sessionNotes,
                artistDetails: artistData || {},
                dropboxFolder: appState.selectedFolder || null,
                createdAt: new Date(),
            };

            await addDoc(collection(db, "sessions"), sessionData);
            
            navigate('Sessions');

        } catch (e) {
            console.error("Error adding document: ", e);
            setError('Failed to save session. Please try again.');
        } finally {
            setIsSaving(false);
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
                <Text style={styles.featureTitle}>{isEditMode ? 'Edit Session' : 'New Session'}</Text>
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Artist Name</Text>
                    <View style={styles.searchContainer2}>
                        <TextInput placeholder="Who is the session for?" placeholderTextColor="#888" style={styles.inputField} value={artistName} onChangeText={setArtistName} onSubmitEditing={handleArtistSearch}/>
                        <TouchableOpacity style={styles.searchIconButton} onPress={handleArtistSearch} disabled={isLoading}>
                            {isLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <MaterialCommunityIcons name="magnify" size={24} color="#8420d0" />}
                        </TouchableOpacity>
                    </View>
                </View>
                
                {/* Search suggestions for fuzzy matching */}
                {showSuggestions && searchSuggestions.length > 0 && (
                    <View style={styles.searchSuggestionsContainer}>
                        <View style={styles.suggestionsHeader}>
                            <MaterialCommunityIcons name="help-circle" size={20} color="#8420d0" />
                            <Text style={styles.suggestionsHeaderText}>Did you mean?</Text>
                        </View>
                        {searchSuggestions.map((suggestion, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={styles.suggestionItem}
                                onPress={() => handleSelectSuggestion(suggestion)}
                            >
                                <View style={styles.suggestionContent}>
                                    {suggestion.profile_image ? (
                                        <Image 
                                            source={{ uri: suggestion.profile_image }} 
                                            style={styles.suggestionImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.suggestionImagePlaceholder}>
                                            <MaterialCommunityIcons name="account-music" size={20} color="#666" />
                                        </View>
                                    )}
                                    <View style={styles.suggestionInfo}>
                                        <Text style={styles.suggestionName}>{suggestion.artist}</Text>
                                        <Text style={styles.suggestionDetails}>
                                            {suggestion.most_used_keys?.[0] && `Key: ${suggestion.most_used_keys[0]}`}
                                            {suggestion.bpm_range && ` • ${suggestion.bpm_range.min}-${suggestion.bpm_range.max} BPM`}
                                        </Text>
                                    </View>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={20} color="#8420d0" />
                            </TouchableOpacity>
                        ))}
                        <View style={styles.suggestionsDivider} />
                        <TouchableOpacity style={styles.createCustomSuggestionButton} onPress={handleCreateCustomArtist}>
                            <MaterialCommunityIcons name="account-plus" size={20} color="#666" />
                            <Text style={styles.createCustomSuggestionText}>Or create custom artist: "{artistName}"</Text>
                        </TouchableOpacity>
                    </View>
                )}
                
                {/* Error message and custom artist option */}
                {error && !artistData && !showSuggestions && (
                    <View style={styles.searchErrorContainer}>
                        <View style={styles.errorMessageCard}>
                            <MaterialCommunityIcons name="information" size={20} color="#FFA500" />
                            <Text style={styles.errorMessageText}>{error}</Text>
                        </View>
                        {artistName && (
                            <TouchableOpacity style={styles.createCustomButton} onPress={handleCreateCustomArtist}>
                                <MaterialCommunityIcons name="account-plus" size={20} color="#8420d0" />
                                <Text style={styles.createCustomButtonText}>Create Custom Artist: "{artistName}"</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
                
                {artistData && (
                    <View style={styles.artistInfoCard}>
                        {artistData.profile_image || artistData.top_songs?.[0]?.cover_art_url ? (
                            <Image 
                                source={{ uri: artistData.profile_image || artistData.top_songs?.[0]?.cover_art_url }} 
                                style={styles.artistImage} 
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.artistImagePlaceholder}>
                                <MaterialCommunityIcons 
                                    name={artistData.custom ? "account" : "account-music"} 
                                    size={30} 
                                    color="#666" 
                                />
                            </View>
                        )}
                        <View style={styles.artistInfoText}>
                            <Text style={styles.artistName}>{artistData.artist}</Text>
                            {artistData.custom ? (
                                <Text style={styles.artistSubtext}>Custom Artist</Text>
                            ) : (
                                <>
                                    <Text style={styles.artistSubtext}>Top Key: {artistData.most_used_keys?.[0] || 'N/A'}</Text>
                                    <Text style={styles.artistSubtext}>BPM Range: {artistData.bpm_range?.min}-{artistData.bpm_range?.max}</Text>
                                    {artistData.total_songs && (
                                        <Text style={styles.artistSubtext}>{artistData.total_songs} songs in database</Text>
                                    )}
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
                    <TouchableOpacity
                        style={appState.dropboxAuth ? styles.dropboxButtonLinked : styles.dropboxButton}
                        onPress={handleDropboxLink}
                        disabled={!request}
                    >
                        <MaterialCommunityIcons name="dropbox" size={24} color={appState.dropboxAuth ? "#FFFFFF" : "#0061FF"} style={styles.menuIcon} />
                        <Text style={appState.dropboxAuth ? styles.dropboxButtonTextLinked : styles.dropboxButtonText}>
                            {appState.selectedFolder ? appState.selectedFolder.name : (appState.dropboxAuth ? `Linked as ${appState.dropboxAuth.name}` : 'Link Dropbox Folder')}
                        </Text>
                    </TouchableOpacity>
                </View>

                {appState.selectedFolder && (
                    <View style={styles.selectedFolderDisplay}>
                        <Text style={styles.selectedFolderText}>
                            Current Folder: {appState.selectedFolder.name}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setIsContentBrowserVisible(prev => !prev)}
                            style={styles.browseButton}
                        >
                            <Text style={styles.browseButtonText}>
                                {isContentBrowserVisible ? 'Hide Files' : 'Browse Files'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}


                {isContentBrowserVisible && appState.selectedFolder && (
                    <DropboxBrowser
                        accessToken={appState.dropboxAuth?.token}
                        initialPath={selectedBrowseFolderPath}
                        initialFolderName={appState.selectedFolder?.name || 'Selected Folder'}
                        useScrollView={true}
                    />
                )}

                <TouchableOpacity style={styles.primaryButton} onPress={handleSaveSession} disabled={isSaving}>
                    {isSaving ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.primaryButtonText}>{isEditMode ? 'Update Session' : 'Save Session'}</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </>
    );
};



const SearchByKeyScreen = () => {
  const [selectedKey, setSelectedKey] = useState('A Minor');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [bpmRange, setBpmRange] = useState([40, 220]);
  const [isBpmFilterEnabled, setIsBpmFilterEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [songs, setSongs] = useState([]);
  const [error, setError] = useState('');
  const [showWheel, setShowWheel] = useState(true);
  const [musicDatabase, setMusicDatabase] = useState(null);
  const [availableGenres, setAvailableGenres] = useState([]);
  const [displayedSongs, setDisplayedSongs] = useState([]);
  const [songsPerPage, setSongsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Fallback genres and keys (used if database fails to load)
  const genres = [ 
    { label: 'All Genres', value: 'all' }, 
    { label: 'Hip-Hop', value: 'hip-hop' }, 
    { label: 'Pop', value: 'pop' }, 
    { label: 'R&B', value: 'r&b' }, 
    { label: 'Trap', value: 'trap' }, 
  ];
  const musicalKeys = [ 
    { label: 'A Minor', value: 'A Minor' }, 
    { label: 'C Minor', value: 'C Minor' }, 
    { label: 'D Minor', value: 'D Minor' }, 
    { label: 'E Minor', value: 'E Minor' }, 
    { label: 'G Minor', value: 'G Minor' }, 
    { label: 'F Minor', value: 'F Minor' }, 
    { label: 'B Minor', value: 'B Minor' }, 
    { label: 'F# Minor', value: 'F# Minor' }, 
    { label: 'C# Minor', value: 'C# Minor' }, 
    { label: 'G# Minor', value: 'G# Minor' }, 
    { label: 'D# Minor', value: 'D# Minor' }, 
    { label: 'A# Minor', value: 'A# Minor' }, 
    { label: 'C Major', value: 'C Major' }, 
    { label: 'D Major', value: 'D Major' }, 
    { label: 'E Major', value: 'E Major' }, 
    { label: 'F Major', value: 'F Major' }, 
    { label: 'G Major', value: 'G Major' }, 
    { label: 'A Major', value: 'A Major' }, 
    { label: 'B Major', value: 'B Major' }, 
    { label: 'F# Major', value: 'F# Major' }, 
    { label: 'C# Major', value: 'C# Major' }, 
    { label: 'G# Major', value: 'G# Major' }, 
    { label: 'D# Major', value: 'D# Major' }, 
    { label: 'A# Major', value: 'A# Major' }, 
  ];

  // Load music database and genres on component mount
  useEffect(() => {
    loadMusicDatabase();
    loadAvailableGenres();
  }, []);

  const loadMusicDatabase = async () => {
    try {
      // For now, we'll use a local fetch to get the database
      // In production, this could be bundled with the app or fetched from a CDN
      const response = await fetch('http://192.168.50.242:5000/get_music_database');
      const data = await response.json();
      if (data.success) {
        setMusicDatabase(data.database);
      }
    } catch (err) {
      console.log('Using fallback database loading...');
      // Fallback: try to load from local assets or use a smaller dataset
      loadFallbackDatabase();
    }
  };

  const loadAvailableGenres = async () => {
    try {
      const response = await fetch('http://192.168.50.242:5000/get_available_genres');
      const data = await response.json();
      if (data.success) {
        const genres = data.genres.map(genre => ({
          label: genre,
          value: genre
        }));
        // Add "All Genres" option at the beginning
        genres.unshift({ label: 'All Genres', value: 'all' });
        setAvailableGenres(genres);
      }
    } catch (err) {
      console.log('Failed to load genres from server, using fallback');
      // Use fallback genres if server fails
      setAvailableGenres(genres);
    }
  };

  const loadFallbackDatabase = () => {
    // This would be a smaller, bundled version of the database
    // For now, we'll use the existing hardcoded approach
    console.log('Using fallback database');
  };



  const searchSongs = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Call the server to get filtered songs
      const response = await fetch(SEARCH_BY_KEY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: selectedKey,
          genre: selectedGenre,
          min_bpm: isBpmFilterEnabled ? bpmRange[0] : null,
          max_bpm: isBpmFilterEnabled ? bpmRange[1] : null
          // No limit - get all matching songs
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success === false) {
        throw new Error(data.error || 'Failed to get songs');
      }
      
      setSongs(data.songs || []);
      // Reset pagination when new search is performed
      setCurrentPage(1);
      updateDisplayedSongs(data.songs || [], 1);
      
    } catch (err) {
      console.error("Search Error:", err);
      setError('Failed to search database');
      setSongs([]);
      setDisplayedSongs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDisplayedSongs = (allSongs, page) => {
    const startIndex = (page - 1) * songsPerPage;
    const endIndex = startIndex + songsPerPage;
    const songsToShow = allSongs.slice(startIndex, endIndex);
    setDisplayedSongs(songsToShow);
  };

  const loadMoreSongs = () => {
    const nextPage = currentPage + 1;
    const startIndex = (nextPage - 1) * songsPerPage;
    
    if (startIndex < songs.length) {
      setCurrentPage(nextPage);
      updateDisplayedSongs(songs, nextPage);
    }
  };

  const hasMoreSongs = () => {
    return (currentPage * songsPerPage) < songs.length;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchSongs();
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedKey, selectedGenre, bpmRange, isBpmFilterEnabled]);

  const handleKeyChange = (newKey) => setSelectedKey(newKey);

  const renderSongItem = ({ item }) => (
    <View style={styles.songCard}>
      <View style={styles.songCardContent}>
        {/* Cover Art */}
        <View style={styles.songCoverContainer}>
          {item.imageUrl ? (
            <Image 
              source={{ uri: item.imageUrl }} 
              style={styles.songCoverArt}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.songCoverPlaceholder}>
              <MaterialCommunityIcons name="music" size={24} color="#666" />
            </View>
          )}
        </View>
        
        {/* Song Info */}
        <View style={styles.songInfoContainer}>
          <View style={styles.songHeader}>
            <Text style={styles.songTitle} numberOfLines={2}>
              {item.title || 'Unknown Title'}
            </Text>
            {item.spotify_rank && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{item.spotify_rank}</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.songArtist} numberOfLines={1}>
            {item.artist || 'Unknown Artist'}
          </Text>
          
          <View style={styles.songDetails}>
            {item.tempo && (
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="metronome" size={14} color="#8420d0" />
                <Text style={styles.detailText}>
                  {Math.round(item.tempo)} BPM
                </Text>
              </View>
            )}
            
            {item.releaseDate && (
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="calendar" size={14} color="#8420d0" />
                <Text style={styles.detailText}>
                  {new Date(item.releaseDate).getFullYear()}
                </Text>
              </View>
            )}
            
            {item.genres && item.genres.length > 0 && (
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="music-note" size={14} color="#8420d0" />
                <Text style={styles.detailText} numberOfLines={1}>
                  {(() => {
                    const genre = item.genres[0].root || item.genres[0].sub?.[0] || 'Unknown Genre';
                    // Capitalize the first letter of each word
                    return genre.split(' ').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ');
                  })()}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View>
      <View style={styles.searchHeader}>
        <Text style={styles.searchTitle}>Search by Key</Text>
        <TouchableOpacity style={styles.toggleButton} onPress={() => setShowWheel(!showWheel)}>
          <MaterialCommunityIcons name={showWheel ? "view-list" : "circle-outline"} size={18} color="#8420d0" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.selectionSection}>
        {showWheel ? ( 
          <KeyWheel selectedKey={selectedKey} onKeyChange={handleKeyChange}/> 
        ) : (
          <View style={styles.dropdownSection}>
            <Text style={styles.selectorLabel}>Key:</Text>
            <CustomPicker
                items={musicalKeys}
                selectedValue={selectedKey}
                onValueChange={setSelectedKey}
                placeholder="Select a Key"
            />
          </View>
        )}
        
        <View style={styles.genreSection}>
          <Text style={styles.selectorLabel}>Genre (Optional):</Text>
          <CustomPicker
                items={availableGenres.length > 0 ? availableGenres : genres}
                selectedValue={selectedGenre}
                onValueChange={setSelectedGenre}
                placeholder="Select a Genre"
            />
        </View>

        <View style={styles.filterToggleContainer}>
            <Text style={styles.filterToggleLabel}>Filter by BPM</Text>
            <Switch
                trackColor={{ false: "#767577", true: "#8420d0" }}
                thumbColor={isBpmFilterEnabled ? "#f4f3f4" : "#f4f3f4"}
                onValueChange={() => setIsBpmFilterEnabled(previousState => !previousState)}
                value={isBpmFilterEnabled}
            />
        </View>

        {isBpmFilterEnabled && (
            <View style={styles.bpmSliderContainer}>
                <View style={styles.bpmLabelContainer}>
                    <Text style={styles.selectorLabel}>BPM Range</Text>
                    <Text style={styles.bpmValueText}>
                      {bpmRange[0] === bpmRange[1] ? bpmRange[0] : `${bpmRange[0]} - ${bpmRange[1]}`}
                    </Text>
                </View>
                <MultiSlider
                    values={[bpmRange[0], bpmRange[1]]}
                    onValuesChange={(values) => setBpmRange(values)}
                    min={40}
                    max={220}
                    step={1}
                    allowOverlap={false}
                    snapped
                    minMarkerOverlapDistance={20}
                    enabled={isBpmFilterEnabled}
                    containerStyle={{
                        alignSelf: 'center',
                        height: 30,
                    }}
                    trackStyle={{
                        height: 3,
                        backgroundColor: '#555',
                    }}
                    selectedStyle={{
                        backgroundColor: '#8420d0',
                    }}
                    markerStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#8420d0',
                        borderWidth: 2,
                        height: 20,
                        width: 20,
                    }}
                />
            </View>
        )}
      </View>
      
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>Results</Text>
        {songs.length > 0 && (
          <Text style={styles.resultsCount}>
            {displayedSongs.length} of {songs.length} songs
          </Text>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.searchContainer}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8420d0" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.searchContainer}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#FF453A" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (songs.length === 0) {
    return (
      <View style={styles.searchContainer}>
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="music-off" size={32} color="#666" />
          <Text style={styles.emptyText}>No songs found</Text>
          <Text style={styles.emptySubtext}>Try different filters or keys</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.searchContainer}>
      <FlatList
        data={displayedSongs}
        renderItem={renderSongItem}
        keyExtractor={(item, index) => item.uuid || item.title || `song-${index}`}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={() => (
          <View>
            {/* Load More Button */}
            {hasMoreSongs() && (
              <TouchableOpacity 
                style={styles.loadMoreButton} 
                onPress={loadMoreSongs}
              >
                <Text style={styles.loadMoreText}>
                  Load More Songs ({songs.length - displayedSongs.length} remaining)
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Results Summary */}
            {songs.length > 0 && (
              <View style={styles.resultsSummary}>
                <Text style={styles.resultsSummaryText}>
                  Showing {displayedSongs.length} of {songs.length} songs
                </Text>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
};

const SearchByArtistScreen = () => {
  const [artistName, setArtistName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [artistData, setArtistData] = useState(null);
  const [error, setError] = useState('');
  
  // Updated popular artists list based on our comprehensive database
  const popularArtists = [
    'Drake', 'The Weeknd', 'Post Malone', 'Travis Scott', 'Kendrick Lamar',
    'Future', 'Lil Baby', 'Juice WRLD', 'Ed Sheeran', 'Ariana Grande',
    'Billie Eilish', 'Dua Lipa', 'Bad Bunny', 'J Balvin', 'Maluma'
  ];
  
  const searchArtist = async (artist) => {
    setIsLoading(true);
    setError('');
    setArtistData(null);
    
    try {
      const response = await fetch(SEARCH_ARTIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist }),
      });
      
      const result = await response.json();
      if (result.success) {
        setArtistData(result);
      } else {
        setError(result.error || 'Artist not found');
      }
    } catch (err) {
      console.error("Search By Artist Error:", err);
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderPopularArtist = (artist) => (
    <TouchableOpacity
      key={artist}
      style={styles.popularArtistButton}
      onPress={() => {
        setArtistName(artist);
        searchArtist(artist);
      }}
    >
      <Text style={styles.popularArtistText}>{artist}</Text>
    </TouchableOpacity>
  );
  
  const renderKeyAnalysis = () => {
    if (!artistData?.most_used_keys) return null;
    
    return (
      <View style={styles.analysisSection}>
        <Text style={styles.analysisSectionTitle}>Most Used Keys</Text>
        <View style={styles.keyGrid}>
          {artistData.most_used_keys.map((key, index) => (
            <View key={`${key}-${index}`} style={styles.keyBadge}>
              <Text style={styles.keyBadgeText}>{key}</Text>
              <Text style={styles.keyBadgeRank}>#{index + 1}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  const renderBpmAnalysis = () => {
    if (!artistData?.bpm_range) return null;
    
    return (
      <View style={styles.analysisSection}>
        <Text style={styles.analysisSectionTitle}>BPM Analysis</Text>
        <View style={styles.bpmContainer}>
          <View style={styles.bpmStat}>
            <Text style={styles.bpmStatLabel}>Min</Text>
            <Text style={styles.bpmStatValue}>{artistData.bpm_range.min}</Text>
          </View>
          <View style={styles.bpmStat}>
            <Text style={styles.bpmStatLabel}>Avg</Text>
            <Text style={styles.bpmStatValue}>{artistData.bpm_range.avg}</Text>
          </View>
          <View style={styles.bpmStat}>
            <Text style={styles.bpmStatLabel}>Max</Text>
            <Text style={styles.bpmStatValue}>{artistData.bpm_range.max}</Text>
          </View>
        </View>
        <Text style={styles.bpmRecommendation}>
          💡 Recommended BPM range: {artistData.bpm_range.min}-{artistData.bpm_range.max}
        </Text>
      </View>
    );
  };
  
  const renderGenreAnalysis = () => {
    if (!artistData?.preferred_genres) return null;
    
    return (
      <View style={styles.analysisSection}>
        <Text style={styles.analysisSectionTitle}>Preferred Genres</Text>
        <View style={styles.genreContainer}>
          {artistData.preferred_genres.map((genre, index) => (
            <View key={`${genre}-${index}`} style={styles.genreBadge}>
              <Text style={styles.genreBadgeText}>{genre}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  const renderTopSongs = () => {
    if (!artistData?.top_songs) return null;
    
    return (
      <View style={styles.analysisSection}>
        <Text style={styles.analysisSectionTitle}>
          Top Songs
        </Text>
        {artistData.top_songs.map((song, index) => (
          <View key={`${song.title || 'song'}-${index}`} style={styles.songCard}>
            <View style={styles.songCardContent}>
              {/* Cover Art */}
              <View style={styles.songCoverContainer}>
                {song.imageUrl ? (
                  <Image 
                    source={{ uri: song.imageUrl }} 
                    style={styles.songCoverArt}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.songCoverPlaceholder}>
                    <MaterialCommunityIcons name="music" size={24} color="#666" />
                  </View>
                )}
              </View>
              
              {/* Song Info */}
              <View style={styles.songInfoContainer}>
                <View style={styles.songHeader}>
                  <Text style={styles.songTitle} numberOfLines={2}>
                    {song.title || 'Unknown Title'}
                  </Text>
                  {song.key && song.key !== 'N/A' && (
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{song.key}</Text>
                    </View>
                    )}
                </View>
                
                <Text style={styles.songArtist} numberOfLines={1}>
                  {song.artist || 'Unknown Artist'}
                </Text>
                
                <View style={styles.songDetails}>
                  {song.bpm && song.bpm !== 'N/A' && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="metronome" size={14} color="#8420d0" />
                      <Text style={styles.detailText}>
                        {Math.round(song.bpm)} BPM
                      </Text>
                    </View>
                  )}
                  
                  {song.release_date && song.release_date !== 'N/A' && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="calendar" size={14} color="#8420d0" />
                      <Text style={styles.detailText}>
                        {new Date(song.release_date).getFullYear()}
                      </Text>
                    </View>
                  )}
                  
                  {song.genres && song.genres.length > 0 && (
                    <View style={styles.detailItem}>
                      <MaterialCommunityIcons name="music-note" size={14} color="#8420d0" />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {song.genres[0] || 'Unknown Genre'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };
  
  return (
    <View style={styles.featureScreen}>
      <Text style={styles.featureTitle}>Artist Analysis</Text>
      
      <View style={styles.searchContainer2}>
        <TextInput
          placeholder="Enter Artist Name"
          placeholderTextColor="#888"
          style={styles.inputField}
          value={artistName}
          onChangeText={setArtistName}
          onSubmitEditing={() => artistName && searchArtist(artistName)}
        />
        <TouchableOpacity
          style={styles.searchIconButton}
          onPress={() => artistName && searchArtist(artistName)}
          disabled={isLoading}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={24}
            color={isLoading ? "#666" : "#8420d0"}
          />
        </TouchableOpacity>
      </View>
      
      <View style={styles.popularArtistsContainer}>
        <Text style={styles.popularArtistsTitle}>Popular Artists:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularArtistsScroll}>
          {popularArtists.map(renderPopularArtist)}
        </ScrollView>
      </View>
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8420d0" />
          <Text style={styles.loadingText}>Analyzing {artistName}...</Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={24} color="#FF453A" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {artistData && (
        <ScrollView style={styles.analysisResults} showsVerticalScrollIndicator={false}>
          <Text style={styles.analysisTitle}>Analysis for {artistData.artist}</Text>
          
          {/* Artist Profile Picture */}
          {artistData.profile_image && (
            <View style={styles.artistProfileContainer}>
              <Image 
                source={{ uri: artistData.profile_image }} 
                style={styles.artistProfileImage}
                resizeMode="cover"
              />
            </View>
          )}
          
          {artistData.source && (
            <Text style={styles.dataSource}>
              Data source: {artistData.source === 'comprehensive_database' ? 'Comprehensive Database' : 
                           artistData.source === 'legacy_curated' ? 'Legacy Database' : artistData.source}
            </Text>
          )}
          
          {renderKeyAnalysis()}
          {renderBpmAnalysis()}
          {renderGenreAnalysis()}
          {renderTopSongs()}
        </ScrollView>
      )}
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

  const getArtistsForKey = async (detectedKey, detectedBpm) => {
    try {
      const response = await fetch(ARTISTS_BY_KEY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: detectedKey }),
      });
      
      const result = await response.json();
      if (result.success && result.artists) {
        // Transform the database format to match the expected format
        return result.artists.map((artist, index) => ({
          name: artist.artist,
          keyRank: index + 1,
          avgBpm: artist.sample_song ? 'N/A' : 'N/A', // We don't have avg BPM per artist yet
          confidence: 85, // Default confidence since we don't calculate this
          bpmMatch: false, // We don't have BPM matching logic yet
          songsInKey: [{
            title: artist.sample_song,
            bpm: 'N/A'
          }]
        }));
      }
      return [];
    } catch (err) {
      console.error('Failed to get artists for key:', err);
      return [];
    }
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
      // Get artists asynchronously
      getArtistsForKey(analysisResult.key, analysisResult.bpm).then(artists => {
        setSuggestedArtists(artists);
      });
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

  const setRecordingAudioMode = async (isRecordingActive) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: isRecordingActive, // Set true for recording, false for playback
        playsInSilentModeIOS: true, // Maintain this for overall app behavior
        shouldDuckAndroid: false, // Maintain this for overall app behavior
        defaultToSpeaker: true, // Maintain this for desired speaker output
      });
      console.log(`DEBUG: Audio mode set for recording: ${isRecordingActive}`);
    } catch (error) {
      console.error('DEBUG: Failed to set recording audio mode:', error);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { setError('Microphone permission was not granted.'); return; }
      if (recording) return;

      await setRecordingAudioMode(true);

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await newRecording.startAsync();
      setRecording(newRecording);
      stopTimeoutRef.current = setTimeout(() => { stopRecordingAndAnalyze(newRecording); }, 15000);
    } catch (err) {
      console.error('Failed to start recording', err);
      setError('Failed to start recording.');
      await setRecordingAudioMode(false);
    }
  };

  const stopRecordingAndAnalyze = async (activeRecording) => {
    if (!activeRecording) return;
    try {
      setIsAnalyzing(true);
      if (stopTimeoutRef.current) { clearTimeout(stopTimeoutRef.current); stopTimeoutRef.current = null; }
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();

      await setRecordingAudioMode(false);

      const formData = new FormData();
      formData.append('audio', { uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri, type: 'audio/x-m4a', name: 'recording.m4m', });
      const response = await fetch(ANALYZE_URL, { method: 'POST', body: formData, headers: { 'Content-Type': 'multipart/form-data' }, });
      const result = await response.json();
      if (result.error) { setError(`Analysis failed: ${result.error}`); }
      else { setAnalysisResult(result); }
    } catch (e) {
      console.error('stopRecordingAndAnalyze error:', e);
      setError('Could not analyze audio.');
      await setRecordingAudioMode(false);
    } finally {
      setRecording(null);
      setIsAnalyzing(false);
    }
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
    return <Image source={require('./assets/logoicon.png')} style={styles.detectButtonIcon} />;
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
            {analysisResult.database_insights && analysisResult.common_artists && analysisResult.common_artists.length > 0 && (
              <View style={styles.detectedSongContainer}>
                <Text style={styles.suggestionsTitle}>📊 Database Insights</Text>
                <Text style={styles.suggestionsSubtitle}>Based on our comprehensive music database:</Text>
                <View style={styles.databaseInsightsCard}>
                  <Text style={styles.databaseInsightsText}>
                    Found {analysisResult.common_artists.length} artists commonly using {analysisResult.key}
                  </Text>
                  <Text style={styles.databaseInsightsText}>
                    Top artist: {analysisResult.common_artists[0]?.artist} ({analysisResult.common_artists[0]?.song_count} songs)
                  </Text>
                </View>
              </View>
            )}
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

function App() {
  const [currentScreen, setCurrentScreen] = useState('MainMenu');
  const [navigationParams, setNavigationParams] = useState(null);
  const [appState, setAppState] = useState({
      dropboxAuth: null,
      selectedFolder: null,
  });
  useEffect(() => {
  const setAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        defaultToSpeaker: true,
      });

      console.log('Expo AV audio mode set successfully.');
    } catch (e) {
      console.error('Failed to set Expo AV audio mode:', e);
    }
  };
  setAudioMode();
}, []);
  const navigate = (screen, params = null) => {
    setCurrentScreen(screen);
    setNavigationParams(params);
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
        return <SessionsScreen navigate={navigate} db={db} />;
      case 'NewSession':
        return <NewSessionScreen navigate={navigate} appState={appState} setAppState={setAppState} db={db} params={navigationParams} />;
      default:
        return <MainMenu navigate={navigate} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
            {currentScreen !== 'MainMenu' && (
              <TouchableOpacity onPress={() => navigate('MainMenu')}>
                <MaterialCommunityIcons name="arrow-left" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            )}
        </View>
        <View style={styles.headerCenter}>
            <Image source={require('./assets/logo.png')} style={styles.logoImage} />
        </View>
        <View style={styles.headerRight} />
      </View>
      {currentScreen === 'MainMenu' && <Text style={styles.subtitle}>A Producer Companion App</Text>}
      {renderScreen()}
    </SafeAreaView>
  );
}

// Authentication wrapper component
function AuthenticatedApp() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        // Sign in anonymously if no user
        signInAnonymously(auth)
          .then((result) => {
            setUser(result.user);
            console.log('Signed in anonymously');
          })
          .catch((error) => {
            console.error('Anonymous sign-in failed:', error);
          });
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#8420d0" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 16 }}>Initializing...</Text>
      </SafeAreaView>
    );
  }

  return <App />;
}

export default AuthenticatedApp;

