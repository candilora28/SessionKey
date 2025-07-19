import os
import json
import traceback
from flask import Flask, request, jsonify
import requests
import firebase_admin
from firebase_admin import credentials, firestore
from collections import Counter
import librosa
import numpy as np
from datetime import datetime, timedelta
import hashlib
import base64
import hmac
import time
from acrcloud.recognizer import ACRCloudRecognizer
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv() 

# Initialize Flask app
app = Flask(__name__)

# --- Firebase Initialization ---
try:
    # Get the path to your key file from the environment variable
    cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
    
    if not cred_path:
        raise ValueError("GOOGLE_APPLICATION_CREDENTIALS environment variable not set.")

    # Initialize the Firebase Admin SDK using the path
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Successfully connected to Firebase.")

except Exception as e:
    print(f"!!! FIREBASE CONNECTION FAILED: {e} !!!")
    db = None

# --- API Configurations ---
# --- API Configurations ---
ACRCLOUD_CONFIG = {
    'host': 'identify-us-west-2.acrcloud.com',
    'access_key': os.getenv('ACRCLOUD_ACCESS_KEY'),
    'access_secret': os.getenv('ACRCLOUD_ACCESS_SECRET'),
    'timeout': 10
}
GENIUS_ACCESS_TOKEN = os.getenv('GENIUS_ACCESS_TOKEN')

# Initialize ACRCloud recognizer
acr = ACRCloudRecognizer(ACRCLOUD_CONFIG)



# Initialize Flask app
app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- Key & BPM Detection Profiles ---
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

# --- Curated Database (Expandable) ---
CURATED_SONGS_BY_KEY = {
    'A Minor': [
        {'title': 'Sicko Mode', 'artist': 'Travis Scott', 'bpm': 155, 'genre': 'Hip-Hop', 'popularity': 95},
        {'title': "God's Plan", 'artist': 'Drake', 'bpm': 77, 'genre': 'Hip-Hop', 'popularity': 98},
        {'title': 'HUMBLE.', 'artist': 'Kendrick Lamar', 'bpm': 150, 'genre': 'Hip-Hop', 'popularity': 92},
        {'title': 'Bad Guy', 'artist': 'Billie Eilish', 'bpm': 135, 'genre': 'Pop', 'popularity': 90},
    ],
    'D Minor': [
        {'title': 'Hotline Bling', 'artist': 'Drake', 'bpm': 135, 'genre': 'Hip-Hop', 'popularity': 94},
        {'title': 'Congratulations', 'artist': 'Post Malone', 'bpm': 123, 'genre': 'Hip-Hop', 'popularity': 89},
        {'title': 'Somebody That I Used to Know', 'artist': 'Gotye', 'bpm': 129, 'genre': 'Pop', 'popularity': 85},
    ],
    'E Minor': [
        {'title': 'Rockstar', 'artist': 'Post Malone ft. 21 Savage', 'bpm': 160, 'genre': 'Hip-Hop', 'popularity': 96},
        {'title': 'Lucid Dreams', 'artist': 'Juice WRLD', 'bpm': 84, 'genre': 'Hip-Hop', 'popularity': 93},
        {'title': 'Lose Yourself', 'artist': 'Eminem', 'bpm': 86, 'genre': 'Hip-Hop', 'popularity': 97},
    ],
    'C Major': [
        {'title': 'Old Town Road', 'artist': 'Lil Nas X ft. Billy Ray Cyrus', 'bpm': 136, 'genre': 'Hip-Hop', 'popularity': 99},
        {'title': 'Sunflower', 'artist': 'Post Malone & Swae Lee', 'bpm': 90, 'genre': 'Hip-Hop', 'popularity': 91},
        {'title': 'Perfect', 'artist': 'Ed Sheeran', 'bpm': 95, 'genre': 'Pop', 'popularity': 88},
    ],
    'G Major': [
        {'title': 'Circles', 'artist': 'Post Malone', 'bpm': 120, 'genre': 'Hip-Hop', 'popularity': 87},
        {'title': 'The Box', 'artist': 'Roddy Ricch', 'bpm': 83, 'genre': 'Hip-Hop', 'popularity': 95},
        {'title': 'Shape of You', 'artist': 'Ed Sheeran', 'bpm': 96, 'genre': 'Pop', 'popularity': 94},
    ]
}

ARTIST_PROFILES = {
    'Drake': {
        'most_used_keys': ['A Minor', 'D Minor', 'E Minor', 'C Major'],
        'bpm_range': {'min': 70, 'max': 140, 'avg': 105},
        'preferred_genres': ['Hip-Hop', 'R&B'],
        'top_songs': [
            {'title': "God's Plan", 'key': 'A Minor', 'bpm': 77, 'popularity': 98},
            {'title': 'Hotline Bling', 'key': 'D Minor', 'bpm': 135, 'popularity': 94},
            {'title': 'In My Feelings', 'key': 'E Minor', 'bpm': 91, 'popularity': 92},
            {'title': 'One Dance', 'key': 'C Major', 'bpm': 104, 'popularity': 89}
        ]
    },
    'Travis Scott': {
        'most_used_keys': ['A Minor', 'G Minor', 'D Major', 'E Major'],
        'bpm_range': {'min': 130, 'max': 180, 'avg': 155},
        'preferred_genres': ['Hip-Hop', 'Trap'],
        'top_songs': [
            {'title': 'Sicko Mode', 'key': 'A Minor', 'bpm': 155, 'popularity': 95},
            {'title': 'Antidote', 'key': 'D Major', 'bpm': 140, 'popularity': 88},
            {'title': 'Goosebumps', 'key': 'E Major', 'bpm': 130, 'popularity': 90},
            {'title': 'Highest in the Room', 'key': 'G Minor', 'bpm': 130, 'popularity': 87}
        ]
    },
    'Post Malone': {
        'most_used_keys': ['D Minor', 'E Minor', 'C Major', 'G Major'],
        'bpm_range': {'min': 90, 'max': 160, 'avg': 125},
        'preferred_genres': ['Hip-Hop', 'Pop'],
        'top_songs': [
            {'title': 'Congratulations', 'key': 'D Minor', 'bpm': 123, 'popularity': 89},
            {'title': 'Rockstar', 'key': 'E Minor', 'bpm': 160, 'popularity': 96},
            {'title': 'Sunflower', 'key': 'C Major', 'bpm': 90, 'popularity': 91},
            {'title': 'Circles', 'key': 'G Major', 'bpm': 120, 'popularity': 87}
        ]
    }
}

# --- Chord Progressions Database ---
CHORD_PROGRESSIONS = {
    # --- Major Keys ---
    'C Major': [
        'C - G - Am - F',
        'C - F - G - C',
        'C - Am - Dm - G',
        'C - G/B - Am - G',    
        'F - C - G - Am'
    ],
    'C# Major': [
        'C# - G# - A#m - F#',
        'C# - F# - G# - C#',
        'C# - A#m - D#m - G#',
        'F# - C# - G# - A#m'
    ],
    'D Major': [
        'D - A - Bm - G',
        'D - G - A - D',
        'D - Bm - Em - A',
        'G - D - A - Bm'
    ],
    'D# Major': [
        'D# - A# - Cm - G#',
        'D# - G# - A# - D#',
        'D# - Cm - Fm - A#',
        'G# - D# - A# - Cm'
    ],
    'E Major': [
        'E - B - C#m - A',
        'E - A - B - E',
        'E - C#m - F#m - B',
        'A - E - B - C#m'
    ],
    'F Major': [
        'F - C - Dm - Bb',
        'F - Bb - C - F',
        'F - Dm - Gm - C',
        'Bb - F - C - Dm'
    ],
    'F# Major': [
        'F# - C# - D#m - B',
        'F# - B - C# - F#',
        'F# - D#m - G#m - C#',
        'B - F# - C# - D#m'
    ],
    'G Major': [
        'G - D - Em - C',
        'G - C - D - G',
        'G - Em - Am - D',
        'C - G - D - Em'
    ],
    'G# Major': [
        'G# - D# - Fm - C#',
        'G# - C# - D# - G#',
        'G# - Fm - A#m - D#',
        'C# - G# - D# - Fm'
    ],
    'A Major': [
        'A - E - F#m - D',
        'A - D - E - A',
        'A - F#m - Bm - E',
        'D - A - E - F#m'
    ],
    'A# Major': [
        'A# - F - Gm - D#',
        'A# - D# - F - A#',
        'A# - Gm - Cm - F',
        'D# - A# - F - Gm'
    ],
    'B Major': [
        'B - F# - G#m - E',
        'B - E - F# - B',
        'B - G#m - C#m - F#',
        'E - B - F# - G#m'
    ],

    # --- Minor Keys ---
    'C Minor': [
        'Cm - G - G# - D#',
        'Cm - Fm - G - Cm',
        'Cm - G# - D# - A#',
        'Fm - Cm - G - Cm'
    ],
    'C# Minor': [
        'C#m - G# - A - E',
        'C#m - F#m - G# - C#m',
        'C#m - A - E - B',
        'F#m - C#m - G# - C#m'
    ],
    'D Minor': [
        'Dm - A - Bb - F',
        'Dm - Gm - A - Dm',
        'Dm - Bb - F - C',
        'Gm - Dm - A - Dm'
    ],
    'D# Minor': [
        'D#m - A# - B - F#',
        'D#m - G#m - A# - D#m',
        'D#m - B - F# - C#',
        'G#m - D#m - A# - D#m'
    ],
    'E Minor': [
        'Em - Bm - C - G',
        'Em - Am - B - Em',
        'Em - C - G - D',
        'Am - Em - B - Em'
    ],
    'F Minor': [
        'Fm - C - C# - G#',
        'Fm - A#m - C - Fm',
        'Fm - C# - G# - D#',
        'A#m - Fm - C - Fm'
    ],
    'F# Minor': [
        'F#m - C# - D - A',
        'F#m - Bm - C# - F#m',
        'F#m - D - A - E',
        'Bm - F#m - C# - F#m'
    ],
    'G Minor': [
        'Gm - D - D# - A#',
        'Gm - Cm - D - Gm',
        'Gm - D# - A# - F',
        'Cm - Gm - D - Gm'
    ],
    'G# Minor': [
        'G#m - D# - E - B',
        'G#m - C#m - D# - G#m',
        'G#m - E - B - F#',
        'C#m - G#m - D# - G#m'
    ],
    'A Minor': [
        'Am - G - C - F',
        'Am - F - C - G',
        'Am - Dm - E - Am',
        'F - C - G - Am'
    ],
    'A# Minor': [
        'A#m - F - F# - C#',
        'A#m - D#m - F - A#m',
        'A#m - F# - C# - G#',
        'D#m - A#m - F - A#m'
    ],
    'B Minor': [
        'Bm - F# - G - D',
        'Bm - Em - F# - Bm',
        'Bm - G - D - A',
        'Em - Bm - F# - Bm'
    ]
}

# --- Helper Functions ---
def detect_tempo(y, sr):
    """Enhanced tempo detection using a more robust algorithm."""
    try:
        # Use the more direct and robust tempo estimation function
        tempo = librosa.feature.tempo(y=y, sr=sr)

        # tempo is an array, take the first element
        tempo = float(tempo[0])

        # Your octave adjustment logic is great, keep it!
        if tempo > 200:
            tempo = tempo / 2
        elif tempo < 60:
            tempo = tempo * 2

        return int(np.round(tempo))
    except Exception as e:
        print(f"Tempo detection error: {e}")
        return 120  # Default BPM
    """Enhanced tempo detection with multiple methods for accuracy."""
    try:
        # Method 1: Standard beat tracking
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(tempo) if np.isscalar(tempo) else float(np.mean(tempo))
        
        # Method 2: Onset detection for validation
        onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
        if len(onset_frames) > 1:
            onset_times = librosa.frames_to_time(onset_frames, sr=sr)
            intervals = np.diff(onset_times)
            if len(intervals) > 0:
                avg_interval = np.median(intervals)
                onset_tempo = 60.0 / avg_interval if avg_interval > 0 else tempo
                
                # Use onset tempo if it's reasonable and close to beat tempo
                if 60 <= onset_tempo <= 200 and abs(tempo - onset_tempo) < 20:
                    tempo = (tempo + onset_tempo) / 2
        
        # Adjust for common tempo ranges
        if tempo > 200:
            tempo = tempo / 2
        elif tempo < 60:
            tempo = tempo * 2
            
        return int(np.round(tempo))
    except Exception as e:
        print(f"Tempo detection error: {e}")
        return 120  # Default BPM

def detect_key(y, sr):
    """Enhanced key detection with confidence scoring."""
    try:
        # Use CQT for better frequency resolution
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
        chroma_mean = np.mean(chroma, axis=1)
        
        # Normalize chroma
        chroma_mean = chroma_mean / (np.sum(chroma_mean) + 1e-8)
        
        scores = []
        for i in range(12):
            major_profile = np.roll(MAJOR_PROFILE, i) / np.sum(MAJOR_PROFILE)
            minor_profile = np.roll(MINOR_PROFILE, i) / np.sum(MINOR_PROFILE)
            
            # Use correlation coefficient
            score_maj = np.corrcoef(chroma_mean, major_profile)[0,1]
            score_min = np.corrcoef(chroma_mean, minor_profile)[0,1]
            
            # Handle NaN values
            score_maj = score_maj if not np.isnan(score_maj) else 0
            score_min = score_min if not np.isnan(score_min) else 0
            
            scores.append((score_maj, 'Major', NOTE_NAMES[i]))
            scores.append((score_min, 'Minor', NOTE_NAMES[i]))
        
        # Sort by score
        scores.sort(key=lambda x: x[0], reverse=True)
        
        # Calculate confidence
        best_score = max(scores[0][0], 0)
        second_best = max(scores[1][0], 0) if len(scores) > 1 else 0
        confidence = min(100, max(0, (best_score - second_best) * 100 + 50))
        
        best = scores[0]
        alternatives = [f"{s[2]} {s[1]}" for s in scores[1:4] if s[0] > 0.1]
        
        main_key = f"{best[2]} {best[1]}"
        
        # Calculate relative key
        root_idx = NOTE_NAMES.index(best[2])
        if best[1] == 'Major':
            rel_idx = (root_idx + 9) % 12
            relative_key = f"{NOTE_NAMES[rel_idx]} Minor"
        else:
            rel_idx = (root_idx + 3) % 12
            relative_key = f"{NOTE_NAMES[rel_idx]} Major"
        
        return main_key, confidence, alternatives, relative_key
        
    except Exception as e:
        print(f"Key detection error: {e}")
        return "C Major", 0, [], "A Minor"

def analyze_audio_locally(file_path):
    """Enhanced audio analysis with HPSS for better key detection."""
    try:
        # Load audio
        y, sr = librosa.load(file_path, sr=22050, mono=True)
        y, _ = librosa.effects.trim(y, top_db=20)
        
        # --- NEW: Separate harmonic and percussive components ---
        y_harmonic, _ = librosa.effects.hpss(y)
        # --- -------------------------------------------------- ---
        
        # Check if audio is valid
        if len(y_harmonic) < sr * 2:  # At least 2 seconds
            return {"error": "Audio clip too short or lacks harmonic content"}
        
        if np.max(np.abs(y)) < 1e-5:
            return {"error": "Audio appears to be silent or too quiet"}
        
        # Analyze tempo using the full signal
        bpm = detect_tempo(y, sr)
        
        # Analyze key using ONLY the harmonic part for better accuracy
        key, confidence, alternatives, relative_key = detect_key(y_harmonic, sr)
        
        # --- The rest of your function remains exactly the same ---
        
        # Try to identify the song using ACRCloud
        song_info = identify_song_acrcloud(file_path)
        
        result = {
            'key': key,
            'key_confidence': round(confidence, 1),
            'bpm': bpm,
            'alternative_keys': alternatives,
            'relative_key': relative_key,
            'chord_progressions': CHORD_PROGRESSIONS.get(key, []),
            'analysis_timestamp': datetime.now().isoformat()
        }
        
        # Add song identification if found
        if song_info and song_info.get('status') == 'success':
            result.update({
                'status': 'recognized',
                'title': song_info.get('title'),
                'artist': song_info.get('artist'),
                'album': song_info.get('album'),
                'release_date': song_info.get('release_date'),
                'spotify_url': song_info.get('spotify_url'),
                'cover_art_url': song_info.get('cover_art_url')
            })
        else:
            result['status'] = 'not_recognized'
        
        # Save analysis to Firebase for database building
        if db:
            save_analysis_to_firebase(result)
        
        return result
        
    except Exception as e:
        print(f"Analysis error: {e}")
        return {"error": f"Analysis failed: {str(e)}"}
    """Enhanced audio analysis with better error handling."""
    try:
        # Load audio
        y, sr = librosa.load(file_path, sr=22050, mono=True)
        y, _ = librosa.effects.trim(y, top_db=20)
        
        # Check if audio is valid
        if len(y) < sr * 2:  # At least 2 seconds
            return {"error": "Audio clip too short (minimum 2 seconds required)"}
        
        if np.max(np.abs(y)) < 1e-5:
            return {"error": "Audio appears to be silent or too quiet"}
        
        # Analyze tempo and key
        bpm = detect_tempo(y, sr)
        key, confidence, alternatives, relative_key = detect_key(y, sr)
        
        # Try to identify the song using ACRCloud
        song_info = identify_song_acrcloud(file_path)
        
        result = {
            'key': key,
            'key_confidence': round(confidence, 1),
            'bpm': bpm,
            'alternative_keys': alternatives,
            'relative_key': relative_key,
            'chord_progressions': CHORD_PROGRESSIONS.get(key, []),
            'analysis_timestamp': datetime.now().isoformat()
        }
        
        # Add song identification if found
        if song_info and song_info.get('status') == 'success':
            result.update({
                'status': 'recognized',
                'title': song_info.get('title'),
                'artist': song_info.get('artist'),
                'album': song_info.get('album'),
                'release_date': song_info.get('release_date'),
                'spotify_url': song_info.get('spotify_url'),
                'cover_art_url': song_info.get('cover_art_url')
            })
        else:
            result['status'] = 'not_recognized'
        
        # Save analysis to Firebase for database building
        if db:
            save_analysis_to_firebase(result)
        
        return result
        
    except Exception as e:
        print(f"Analysis error: {e}")
        return {"error": f"Analysis failed: {str(e)}"}

def identify_song_acrcloud(file_path):
    """Identify song using ACRCloud."""
    try:
        with open(file_path, 'rb') as f:
            audio_data = f.read()
        
        result = acr.recognize_by_filebuffer(audio_data, 0)
        result_data = json.loads(result)
        
        if result_data.get('status', {}).get('code') == 0:
            metadata = result_data.get('metadata', {})
            music = metadata.get('music', [])
            
            if music:
                track = music[0]
                return {
                    'status': 'success',
                    'title': track.get('title'),
                    'artist': ', '.join([a.get('name', '') for a in track.get('artists', [])]),
                    'album': track.get('album', {}).get('name'),
                    'release_date': track.get('release_date'),
                    'spotify_url': next((s.get('external_ids', {}).get('spotify') for s in track.get('external_metadata', {}).get('spotify', [])), None),
                    'cover_art_url': track.get('album', {}).get('cover_art_url')
                }
        
        return {'status': 'not_found'}
        
    except Exception as e:
        print(f"ACRCloud identification error: {e}")
        return {'status': 'error', 'error': str(e)}

def save_analysis_to_firebase(analysis_result):
    """Save analysis results to Firebase for database building."""
    try:
        if not db:
            return
        
        doc_data = {
            'timestamp': datetime.now(),
            'key': analysis_result.get('key'),
            'bpm': analysis_result.get('bpm'),
            'confidence': analysis_result.get('key_confidence'),
            'title': analysis_result.get('title'),
            'artist': analysis_result.get('artist'),
            'status': analysis_result.get('status', 'not_recognized')
        }
        
        # Only save if we have meaningful data
        if doc_data['key'] and doc_data['bpm']:
            db.collection('audio_analyses').add(doc_data)
            
    except Exception as e:
        print(f"Firebase save error: {e}")

def get_songs_by_key_and_genre(key, genre=None, limit=20):
    """Get songs by key with optional genre filtering."""
    try:
        songs = CURATED_SONGS_BY_KEY.get(key, [])
        
        # Filter by genre if specified
        if genre and genre.lower() != 'all':
            songs = [s for s in songs if genre.lower() in s.get('genre', '').lower()]
        
        # Sort by popularity
        songs.sort(key=lambda x: x.get('popularity', 0), reverse=True)
        
        # Try to supplement with Firebase data
        if db and len(songs) < limit:
            firebase_songs = get_firebase_songs_by_key(key, genre, limit - len(songs))
            songs.extend(firebase_songs)
        
        return songs[:limit]
        
    except Exception as e:
        print(f"Error getting songs by key: {e}")
        return []

def get_firebase_songs_by_key(key, genre, limit):
    """Get additional songs from Firebase database."""
    try:
        if not db:
            return []
        
        query = db.collection('audio_analyses').where('key', '==', key).where('status', '==', 'recognized')
        
        docs = query.limit(limit).stream()
        songs = []
        
        for doc in docs:
            data = doc.to_dict()
            if data.get('title') and data.get('artist'):
                songs.append({
                    'title': data['title'],
                    'artist': data['artist'],
                    'bpm': data.get('bpm', 0),
                    'genre': 'Unknown',  # Would need genre classification
                    'popularity': 50  # Default popularity
                })
        
        return songs
        
    except Exception as e:
        print(f"Firebase query error: {e}")
        return []

def get_enhanced_artist_analysis(artist_name):
    """Get enhanced artist analysis with Genius API integration."""
    try:
        # Check curated database first
        if artist_name in ARTIST_PROFILES:
            profile = ARTIST_PROFILES[artist_name].copy()
            profile['source'] = 'curated'
            return {'success': True, 'data': profile}
        
        return {'success': False, 'error': 'Artist not found'}
        
    except Exception as e:
        print(f"Artist analysis error: {e}")
        return {'success': False, 'error': str(e)}

# --- API Endpoints ---

@app.route('/analyze', methods=['POST'])
def handle_analysis():
    """Enhanced analysis endpoint with song recognition."""
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    file = request.files['audio']
    if not file or file.filename == '':
        return jsonify({"error": "Invalid file"}), 400
    
    # Save uploaded file
    filename = f"audio_{int(time.time())}_{file.filename}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)
    
    try:
        # Analyze the audio
        result = analyze_audio_locally(file_path)
        return jsonify(result)
    
    finally:
        # Clean up uploaded file
        if os.path.exists(file_path):
            os.remove(file_path)

@app.route('/search_by_key', methods=['POST'])
def handle_search_by_key():
    """Search songs by key and genre."""
    data = request.get_json()
    key = data.get('key')
    genre = data.get('genre', 'all')
    limit = min(data.get('limit', 20), 50)  # Max 50 songs
    
    if not key:
        return jsonify({"error": "Key is required"}), 400
    
    songs = get_songs_by_key_and_genre(key, genre, limit)
    
    return jsonify({
        'success': True,
        'key': key,
        'genre': genre,
        'songs': songs,
        'total': len(songs)
    })

@app.route('/search_artist', methods=['POST'])
def handle_search_artist():
    """Enhanced artist search with analysis."""
    data = request.get_json()
    artist_name = data.get('artist')
    
    if not artist_name:
        return jsonify({"error": "Artist name is required"}), 400
    
    result = get_enhanced_artist_analysis(artist_name)
    
    if result['success']:
        return jsonify({
            'success': True,
            'artist': artist_name,
            **result['data']
        })
    else:
        return jsonify({"error": result['error']}), 404

@app.route('/get_chord_progressions', methods=['POST'])
def handle_chord_progressions():
    """Get chord progressions for a specific key."""
    data = request.get_json()
    key = data.get('key')
    
    if not key:
        return jsonify({"error": "Key is required"}), 400
    
    progressions = CHORD_PROGRESSIONS.get(key, [])
    
    return jsonify({
        'success': True,
        'key': key,
        'chord_progressions': progressions
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'services': {
            'firebase': db is not None,
            'acrcloud': True
        }
    })

if __name__ == '__main__':
    print("🎵 Music Producer Companion Server Starting...")
    print(f"📊 Curated songs database: {sum(len(songs) for songs in CURATED_SONGS_BY_KEY.values())} songs")
    print(f"🎤 Artist profiles: {len(ARTIST_PROFILES)} artists")
    print(f"🎹 Chord progressions: {len(CHORD_PROGRESSIONS)} keys")
    app.run(host='0.0.0.0', port=5000, debug=True)