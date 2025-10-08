#!/usr/bin/env python3
"""
Clean up problematic songs from the database and add missing correct versions
"""

import json
import os
from datetime import datetime

def load_database():
    """Load the current music database"""
    try:
        with open('music_database_final.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Error loading database: {e}")
        return None

def save_database(data, filename):
    """Save the updated database"""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"✅ Database saved to {filename}")
        return True
    except Exception as e:
        print(f"❌ Error saving database: {e}")
        return False

def identify_problematic_songs(songs):
    """Identify songs that need to be removed"""
    problematic_songs = []
    
    for song in songs:
        title = song.get('title', '').lower()
        artist = song.get('artist', '').lower()
        
        # Japanese versions and wrong versions to remove
        if any(japanese in title for japanese in ['カリフォルニケイション', 'スメルズ・ライク・ティーン・スピリット', 'イントゥ・ユー']):
            problematic_songs.append({
                'song': song,
                'reason': 'Japanese version'
            })
        
        # Wrong artist versions
        elif title == 'grenade' and 'wayne martin' in artist:
            problematic_songs.append({
                'song': song,
                'reason': 'Wrong artist (Wayne Martin instead of Bruno Mars)'
            })
        
        elif title == 'prayer in c' and 'som livre' in artist:
            problematic_songs.append({
                'song': song,
                'reason': 'Wrong artist (Som Livre instead of Robin Schulz)'
            })
        
        elif title == 'sucker for pain' and 'lorche & lusttqwe & bexter' in artist:
            problematic_songs.append({
                'song': song,
                'reason': 'Wrong artist (should be Lil Wayne, Wiz Khalifa, etc.)'
            })
        
        # Specific version to remove
        elif title == 'stay (album version)' and 'rihanna' in artist:
            problematic_songs.append({
                'song': song,
                'reason': 'Specific album version (keep original)'
            })
    
    return problematic_songs

def create_bruno_mars_grenade():
    """Create the correct Bruno Mars - Grenade entry"""
    return {
        "uuid": "bruno_mars_grenade_manual",
        "title": "Grenade",
        "artist": "Bruno Mars",
        "spotify_rank": 1000,  # Placeholder rank
        "release_date": "2010-09-28T00:00:00+00:00",
        "imageUrl": "https://assets.soundcharts.com/song/placeholder.jpg",
        "key_name": "D",
        "mode_name": "Major",
        "tempo": 110,
        "genres": [{"root": "Pop"}],
        "metadata_collected": True,
        "metadata_date": datetime.now().isoformat(),
        "note": "Manually added - correct version of Grenade by Bruno Mars"
    }

def cleanup_database():
    """Main cleanup function"""
    print("🧹 Starting database cleanup...")
    
    # Load current database
    data = load_database()
    if not data:
        return
    
    songs = data.get('songs_with_metadata', [])
    original_count = len(songs)
    print(f"📊 Original database has {original_count} songs")
    
    # Identify problematic songs
    problematic = identify_problematic_songs(songs)
    print(f"\n🔍 Found {len(problematic)} problematic songs:")
    
    for i, item in enumerate(problematic, 1):
        song = item['song']
        reason = item['reason']
        print(f"  {i}. {song.get('title', 'Unknown')} by {song.get('artist', 'Unknown')}")
        print(f"     Reason: {reason}")
    
    if not problematic:
        print("✅ No problematic songs found!")
        return
    
    # Confirm removal
    print(f"\n⚠️  About to remove {len(problematic)} songs")
    confirm = input("Proceed with removal? (y/N): ").strip().lower()
    
    if confirm != 'y':
        print("❌ Cleanup cancelled")
        return
    
    # Remove problematic songs
    problematic_titles = [item['song'].get('title', '') for item in problematic]
    cleaned_songs = [song for song in songs if song.get('title', '') not in problematic_titles]
    
    print(f"✅ Removed {len(problematic)} songs")
    print(f"📊 Database now has {len(cleaned_songs)} songs")
    
    # Add Bruno Mars - Grenade
    print("\n➕ Adding Bruno Mars - Grenade...")
    bruno_mars_grenade = create_bruno_mars_grenade()
    cleaned_songs.append(bruno_mars_grenade)
    
    print(f"✅ Added: {bruno_mars_grenade['title']} by {bruno_mars_grenade['artist']}")
    print(f"📊 Final database has {len(cleaned_songs)} songs")
    
    # Update database
    data['songs_with_metadata'] = cleaned_songs
    data['total_count'] = len(cleaned_songs)
    data['cleanup_date'] = datetime.now().isoformat()
    data['cleanup_stats'] = {
        'songs_removed': len(problematic),
        'songs_added': 1,
        'net_change': len(problematic) - 1
    }
    
    # Save updated database
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    new_filename = f"music_database_cleaned_{timestamp}.json"
    
    if save_database(data, new_filename):
        print(f"\n🎉 Cleanup complete!")
        print(f"   Original songs: {original_count}")
        print(f"   Songs removed: {len(problematic)}")
        print(f"   Songs added: 1")
        print(f"   Final count: {len(cleaned_songs)}")
        print(f"   Saved to: {new_filename}")
        
        # Also save as the main database
        if save_database(data, 'music_database_final.json'):
            print(f"   Updated main database: music_database_final.json")

if __name__ == "__main__":
    cleanup_database()

