#!/usr/bin/env python3
"""
Soundcharts API Client - Clean version for future API calls
This script provides essential functions to interact with the Soundcharts API.
"""

import json
import os
import requests
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class SoundchartsAPI:
    """Clean Soundcharts API client for future use."""
    
    def __init__(self):
        self.base_url = "https://customer.api.soundcharts.com"
        self.app_id = os.getenv('SOUNDCHARTS_APP_ID', 'CANDILORA_4AE68CA2')
        self.api_key = os.getenv('SOUNDCHARTS_API_KEY', 'ba51ed017fd917e3')
        self.headers = {
            'x-app-id': self.app_id,
            'x-api-key': self.api_key,
            'Content-Type': 'application/json'
        }
    
    def test_connection(self):
        """Test the API connection."""
        try:
            # Try a simple POST request to test the endpoint
            url = f"{self.base_url}/api/v2/top/songs"
            payload = {
                "platforms": ["spotify"],
                "dateRange": {
                    "period": "week"
                },
                "startOffset": 0,
                "limit": 1
            }
            
            response = requests.post(url, headers=self.headers, json=payload)
            if response.status_code == 200:
                print("✅ Soundcharts API connection successful")
                return True
            elif response.status_code == 401:
                print("❌ API authentication failed - check credentials")
                return False
            elif response.status_code == 403:
                print("❌ API access denied - check permissions")
                return False
            elif response.status_code == 429:
                print("❌ API rate limit exceeded")
                return False
            else:
                print(f"❌ API connection failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Connection error: {e}")
            return False
    
    def get_top_songs(self, start_offset=0, limit=100, platform="spotify"):
        """
        Get top songs from Soundcharts.
        
        Args:
            start_offset (int): Starting position (0-based)
            limit (int): Number of songs to fetch (max 100)
            platform (str): Platform to fetch from ("spotify", "youtube", etc.)
        
        Returns:
            dict: API response with songs data
        """
        try:
            url = f"{self.base_url}/api/v2/top/songs"
            
            payload = {
                "platforms": [platform],
                "dateRange": {
                    "period": "week"
                },
                "startOffset": start_offset,
                "limit": limit
            }
            
            print(f"🔄 Fetching {limit} songs starting from offset {start_offset}...")
            
            response = requests.post(url, headers=self.headers, json=payload)
            
            if response.status_code == 200:
                data = response.json()
                songs = data.get('items', [])
                print(f"✅ Successfully fetched {len(songs)} songs")
                return {
                    'success': True,
                    'songs': songs,
                    'total_items': data.get('totalItems', len(songs)),
                    'offset': start_offset
                }
            else:
                print(f"❌ API Error: {response.status_code}")
                print(f"Response: {response.text}")
                return {
                    'success': False,
                    'error': f"HTTP {response.status_code}: {response.text}"
                }
                
        except Exception as e:
            print(f"❌ Error fetching songs: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_song_metadata(self, song_uuid):
        """
        Get detailed metadata for a specific song.
        
        Args:
            song_uuid (str): The UUID of the song
        
        Returns:
            dict: Song metadata including key, BPM, genre, etc.
        """
        try:
            url = f"{self.base_url}/api/v2.25/song/{song_uuid}"
            
            response = requests.get(url, headers=self.headers)
            
            if response.status_code == 200:
                return {
                    'success': True,
                    'metadata': response.json()
                }
            else:
                print(f"❌ Metadata Error for {song_uuid}: {response.status_code}")
                return {
                    'success': False,
                    'error': f"HTTP {response.status_code}: {response.text}",
                    'uuid': song_uuid
                }
                
        except Exception as e:
            print(f"❌ Error getting metadata for {song_uuid}: {e}")
            return {
                'success': False,
                'error': str(e),
                'uuid': song_uuid
            }
    
    def collect_songs_batch(self, start_offset=0, total_songs=100, platform="spotify"):
        """
        Collect a batch of songs with basic info.
        
        Args:
            start_offset (int): Starting position
            total_songs (int): Total number of songs to collect
            platform (str): Platform to collect from
        
        Returns:
            list: List of collected songs
        """
        all_songs = []
        current_offset = start_offset
        
        while len(all_songs) < total_songs:
            remaining = total_songs - len(all_songs)
            batch_size = min(100, remaining)  # API limit is 100 per request
            
            result = self.get_top_songs(current_offset, batch_size, platform)
            
            if result['success']:
                songs = result['songs']
                all_songs.extend(songs)
                current_offset += len(songs)
                
                print(f"📊 Progress: {len(all_songs)}/{total_songs} songs collected")
                
                if len(songs) < batch_size:
                    print("📄 Reached end of available songs")
                    break
            else:
                print(f"❌ Failed to fetch batch: {result['error']}")
                break
        
        return all_songs
    
    def save_songs_to_file(self, songs, filename=None):
        """Save songs to a JSON file."""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"soundcharts_songs_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump({
                    'songs': songs,
                    'total_count': len(songs),
                    'collected_date': datetime.now().isoformat(),
                    'api_source': 'soundcharts'
                }, f, indent=2, ensure_ascii=False)
            
            print(f"💾 Saved {len(songs)} songs to {filename}")
            return filename
            
        except Exception as e:
            print(f"❌ Error saving to file: {e}")
            return None

def main():
    """Example usage of the Soundcharts API client."""
    print("🎵 Soundcharts API Client")
    print("=" * 40)
    
    # Initialize API client
    api = SoundchartsAPI()
    
    # Test connection
    if not api.test_connection():
        print("❌ Cannot connect to Soundcharts API")
        return
    
    print("\nChoose an option:")
    print("1. Test fetch 10 songs")
    print("2. Collect custom batch")
    print("3. Get song metadata (requires UUID)")
    print("4. Exit")
    
    choice = input("\nEnter your choice (1-4): ").strip()
    
    if choice == "1":
        # Test fetch
        result = api.get_top_songs(start_offset=0, limit=10)
        if result['success']:
            print(f"\n✅ Successfully fetched {len(result['songs'])} songs")
            for i, song in enumerate(result['songs'][:5], 1):
                title = song.get('name', 'Unknown')
                artists = ', '.join([a.get('name', 'Unknown') for a in song.get('artists', [])])
                print(f"  {i}. {title} by {artists}")
        else:
            print(f"❌ Failed: {result['error']}")
    
    elif choice == "2":
        # Custom batch
        try:
            start = int(input("Start offset (0): ") or "0")
            total = int(input("Total songs to collect (50): ") or "50")
            platform = input("Platform (spotify): ").strip() or "spotify"
            
            songs = api.collect_songs_batch(start, total, platform)
            if songs:
                filename = api.save_songs_to_file(songs)
                print(f"✅ Collected {len(songs)} songs and saved to {filename}")
            else:
                print("❌ No songs collected")
                
        except ValueError:
            print("❌ Invalid input. Please enter numbers for offset and total.")
    
    elif choice == "3":
        # Get metadata
        uuid = input("Enter song UUID: ").strip()
        if uuid:
            result = api.get_song_metadata(uuid)
            if result['success']:
                metadata = result['metadata']
                song_data = metadata.get('object', {})
                print(f"\n✅ Song Metadata:")
                print(f"  Title: {song_data.get('name', 'N/A')}")
                print(f"  Key: {song_data.get('key', 'N/A')}")
                print(f"  Mode: {song_data.get('mode', 'N/A')}")
                print(f"  Tempo: {song_data.get('tempo', 'N/A')} BPM")
                
                audio_features = song_data.get('audio', {})
                if audio_features:
                    print(f"  Audio Features: {len(audio_features)} available")
                
                genres = song_data.get('genres', [])
                if genres:
                    print(f"  Genres: {[g.get('root', 'N/A') for g in genres[:3]]}")
            else:
                print(f"❌ Failed: {result['error']}")
        else:
            print("❌ UUID is required")
    
    elif choice == "4":
        print("👋 Goodbye!")
    
    else:
        print("❌ Invalid choice")

if __name__ == "__main__":
    main()
