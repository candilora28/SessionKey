#!/usr/bin/env python3
"""
Debug script to examine the actual API response structure
"""

import json
import os
import requests
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

def debug_api_response():
    """Debug the API response structure"""
    try:
        url = f"{BASE_URL}/api/v2/top/songs"
        payload = {
            "platforms": ["spotify"],
            "dateRange": {"period": "week"},
            "startOffset": 0,
            "limit": 3
        }
        
        print("🔗 Making API request...")
        response = requests.post(url, headers=HEADERS, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API Response received")
            print(f"Response keys: {list(data.keys())}")
            print(f"Total items: {data.get('totalItems', 'Unknown')}")
            
            items = data.get('items', [])
            print(f"Number of items: {len(items)}")
            
            if items:
                print("\n🔍 First song structure:")
                first_song = items[0]
                print(f"Song keys: {list(first_song.keys())}")
                
                print("\n📝 Song details:")
                for key, value in first_song.items():
                    if isinstance(value, (str, int, float, bool)) or value is None:
                        print(f"  {key}: {value}")
                    elif isinstance(value, list):
                        print(f"  {key}: [List with {len(value)} items]")
                        if value and len(value) > 0:
                            print(f"    First item: {value[0]}")
                    elif isinstance(value, dict):
                        print(f"  {key}: [Dict with keys: {list(value.keys())}]")
                
                print("\n🎵 Sample songs:")
                for i, song in enumerate(items[:3], 1):
                    print(f"\nSong {i}:")
                    print(f"  Raw song: {song}")
                    print(f"  Name field: {song.get('name')}")
                    print(f"  Title field: {song.get('title')}")
                    print(f"  Artists: {song.get('artists')}")
                    if song.get('artists'):
                        print(f"  First artist: {song.get('artists')[0] if song.get('artists') else 'None'}")
        else:
            print(f"❌ API Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    debug_api_response()

