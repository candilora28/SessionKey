#!/usr/bin/env python3
"""
Original Working Soundcharts Script - Restored from successful collection patterns
Based on the scripts that successfully collected 998 songs with full metadata
"""

import json
import os
import requests
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# API Configuration
BASE_URL = "https://customer.api.soundcharts.com"
APP_ID = os.getenv('SOUNDCHARTS_APP_ID', 'CANDILORA_4AE68CA2')
API_KEY = os.getenv('SOUNDCHARTS_API_KEY', 'ba51ed017fd917e3')

HEADERS = {
    'x-app-id': APP_ID,
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
}

def test_api_connection():
    """Test API connection with a small request"""
    try:
        url = f"{BASE_URL}/api/v2/top/songs"
        payload = {
            "platforms": ["spotify"],
            "dateRange": {"period": "week"},
            "startOffset": 0,
            "limit": 1
        }
        
        response = requests.post(url, headers=HEADERS, json=payload)
        print(f"🔗 Testing API connection...")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API Connection successful!")
            print(f"Total available songs: {data.get('totalItems', 'Unknown')}")
            return True
        else:
            print(f"❌ API Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Connection error: {e}")
        return False

def get_top_songs_batch(start_offset=0, limit=100, platform="spotify"):
    """Get a batch of top songs from Soundcharts"""
    try:
        url = f"{BASE_URL}/api/v2/top/songs"
        
        payload = {
            "platforms": [platform],
            "dateRange": {
                "period": "week"
            },
            "startOffset": start_offset,
            "limit": limit
        }
        
        print(f"🔄 Fetching songs {start_offset+1}-{start_offset+limit}...")
        
        response = requests.post(url, headers=HEADERS, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            songs = data.get('items', [])
            
            # Process and add ranking information
            processed_songs = []
            for i, song in enumerate(songs):
                song_obj = song.get('song', {})  # Get the nested song object
                song_data = {
                    'uuid': song_obj.get('uuid'),
                    'title': song_obj.get('name'),  # Fixed: song.name
                    'artist': song_obj.get('creditName'),  # Fixed: song.creditName
                    'spotify_rank': start_offset + i + 1,
                    'platform_data': song.get('platforms', {}),
                    'release_date': song_obj.get('releaseDate'),
                    'imageUrl': song_obj.get('imageUrl'),
                    'raw_song_data': song  # Keep original for reference
                }
                processed_songs.append(song_data)
            
            print(f"✅ Successfully fetched {len(processed_songs)} songs")
            return {
                'success': True,
                'songs': processed_songs,
                'total_items': data.get('totalItems'),
                'next_offset': start_offset + len(songs)
            }
        else:
            print(f"❌ API Error {response.status_code}: {response.text}")
            return {'success': False, 'error': response.text}
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return {'success': False, 'error': str(e)}

def get_song_metadata(uuid):
    """Get detailed metadata for a song using its UUID"""
    try:
        url = f"{BASE_URL}/api/v2.25/song/{uuid}"
        
        response = requests.get(url, headers=HEADERS)
        
        if response.status_code == 200:
            return {
                'success': True,
                'metadata': response.json()
            }
        else:
            print(f"❌ Metadata failed for {uuid}: {response.status_code}")
            return {
                'success': False,
                'error': response.text,
                'uuid': uuid
            }
            
    except Exception as e:
        print(f"❌ Metadata error for {uuid}: {e}")
        return {
            'success': False,
            'error': str(e),
            'uuid': uuid
        }

def collect_songs_range(start_offset, total_songs, platform="spotify"):
    """Collect a range of songs with basic info"""
    all_songs = []
    current_offset = start_offset
    
    while len(all_songs) < total_songs:
        remaining = total_songs - len(all_songs)
        batch_size = min(100, remaining)
        
        result = get_top_songs_batch(current_offset, batch_size, platform)
        
        if result['success']:
            songs = result['songs']
            all_songs.extend(songs)
            current_offset = result['next_offset']
            
            print(f"📊 Progress: {len(all_songs)}/{total_songs} songs collected")
            
            if len(songs) < batch_size:
                print("📄 Reached end of available songs")
                break
                
            # Small delay to be nice to the API
            time.sleep(0.5)
        else:
            print(f"❌ Batch failed: {result['error']}")
            break
    
    return all_songs

def collect_metadata_for_songs(songs, max_calls=None):
    """Collect detailed metadata for a list of songs"""
    songs_with_metadata = []
    calls_made = 0
    
    for i, song in enumerate(songs):
        if max_calls and calls_made >= max_calls:
            print(f"🛑 Reached API call limit of {max_calls}")
            break
            
        uuid = song.get('uuid')
        if not uuid:
            print(f"⚠️ Skipping song {i+1}: No UUID")
            continue
            
        print(f"🔍 Getting metadata for song {i+1}/{len(songs)}: {song.get('title', 'Unknown')}")
        
        result = get_song_metadata(uuid)
        calls_made += 1
        
        if result['success']:
            metadata = result['metadata']
            song_obj = metadata.get('object', {})
            
            # Merge basic song data with detailed metadata
            enhanced_song = {
                **song,  # Basic info from top songs
                'key_signature': song_obj.get('key'),
                'key_name': song_obj.get('keyName'),
                'mode': song_obj.get('mode'),
                'mode_name': song_obj.get('modeName'),
                'tempo': song_obj.get('tempo'),
                'genres': song_obj.get('genres', []),
                'audio_features': song_obj.get('audio', {}),
                'metadata_collected': True,
                'metadata_date': datetime.now().isoformat()
            }
            
            songs_with_metadata.append(enhanced_song)
            print(f"✅ Metadata collected for: {song.get('title', 'Unknown')}")
            
        else:
            # Add song without metadata but mark as failed
            song_with_error = {
                **song,
                'metadata_collected': False,
                'metadata_error': result['error']
            }
            songs_with_metadata.append(song_with_error)
            print(f"❌ Metadata failed for: {song.get('title', 'Unknown')}")
        
        # Small delay between requests
        time.sleep(0.3)
    
    print(f"\n📊 Final Results:")
    print(f"   Total songs processed: {len(songs_with_metadata)}")
    print(f"   API calls made: {calls_made}")
    print(f"   Successful metadata: {sum(1 for s in songs_with_metadata if s.get('metadata_collected', False))}")
    
    return songs_with_metadata

def save_songs_to_file(songs, filename=None):
    """Save songs to JSON file"""
    if filename is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"soundcharts_collection_{timestamp}.json"
    
    try:
        data = {
            'songs_with_metadata': songs,
            'total_count': len(songs),
            'collection_date': datetime.now().isoformat(),
            'api_source': 'soundcharts',
            'metadata_stats': {
                'total_songs': len(songs),
                'with_metadata': sum(1 for s in songs if s.get('metadata_collected', False)),
                'without_metadata': sum(1 for s in songs if not s.get('metadata_collected', False))
            }
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Saved to: {filename}")
        print(f"   Total songs: {len(songs)}")
        return filename
        
    except Exception as e:
        print(f"❌ Save error: {e}")
        return None

def main():
    """Interactive script for collecting Soundcharts data"""
    print("🎵 Original Working Soundcharts Collector")
    print("=" * 50)
    
    # Test connection first
    if not test_api_connection():
        print("❌ Cannot proceed without API connection")
        return
    
    print("\nWhat would you like to do?")
    print("1. Test fetch 10 songs (with titles/artists)")
    print("2. Collect songs batch (basic info)")
    print("3. Collect songs with full metadata")
    print("4. Get metadata for existing song list")
    print("5. Exit")
    
    choice = input("\nEnter choice (1-5): ").strip()
    
    if choice == "1":
        # Test with proper data display
        result = get_top_songs_batch(0, 10)
        if result['success']:
            print(f"\n✅ Test successful! Here are the songs:")
            for i, song in enumerate(result['songs'][:5], 1):
                print(f"  {i}. {song['title']} by {song['artist']}")
                print(f"     Rank: #{song['spotify_rank']}")
        else:
            print(f"❌ Test failed: {result['error']}")
    
    elif choice == "2":
        try:
            start = int(input("Start offset (0): ") or "0")
            total = int(input("Total songs (100): ") or "100")
            platform = input("Platform (spotify): ").strip() or "spotify"
            
            songs = collect_songs_range(start, total, platform)
            if songs:
                filename = save_songs_to_file(songs)
                print(f"✅ Collected {len(songs)} songs and saved to {filename}")
            
        except ValueError:
            print("❌ Invalid input")
    
    elif choice == "3":
        try:
            start = int(input("Start offset (0): ") or "0")
            total = int(input("Total songs (50): ") or "50")
            max_calls = input("Max API calls (leave empty for unlimited): ").strip()
            max_calls = int(max_calls) if max_calls else None
            
            print(f"\n🚀 Starting collection...")
            songs = collect_songs_range(start, total)
            
            if songs:
                print(f"\n🔍 Now collecting metadata...")
                songs_with_metadata = collect_metadata_for_songs(songs, max_calls)
                filename = save_songs_to_file(songs_with_metadata)
                print(f"✅ Complete! Saved to {filename}")
            
        except ValueError:
            print("❌ Invalid input")
    
    elif choice == "4":
        json_file = input("Path to JSON file with songs: ").strip()
        max_calls = input("Max API calls (leave empty for unlimited): ").strip()
        max_calls = int(max_calls) if max_calls else None
        
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            songs = data.get('songs_with_metadata', data.get('songs', []))
            print(f"📂 Loaded {len(songs)} songs from {json_file}")
            
            songs_with_metadata = collect_metadata_for_songs(songs, max_calls)
            filename = save_songs_to_file(songs_with_metadata)
            print(f"✅ Enhanced metadata saved to {filename}")
            
        except Exception as e:
            print(f"❌ Error loading file: {e}")
    
    elif choice == "5":
        print("👋 Goodbye!")
    
    else:
        print("❌ Invalid choice")

if __name__ == "__main__":
    main()
