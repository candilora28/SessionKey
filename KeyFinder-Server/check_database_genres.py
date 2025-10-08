import json
import os

def check_database_genres():
    """Check what genres are actually available in the comprehensive database"""
    try:
        # Find the comprehensive database
        metadata_files = [f for f in os.listdir('.') if f.startswith('music_database_final') and f.endswith('.json')]
        if not metadata_files:
            print("No comprehensive database found!")
            return
        
        latest_file = sorted(metadata_files)[-1]
        print(f"Checking genres in: {latest_file}")
        
        with open(latest_file, 'r', encoding='utf-8') as f:
            database = json.load(f)
        
        songs = database.get('songs_with_metadata', [])
        print(f"Total songs: {len(songs)}")
        
        # Collect all unique genres
        all_genres = set()
        songs_with_genres = 0
        songs_without_genres = 0
        
        for song in songs:
            song_genres = song.get('genres', [])
            if song_genres:
                songs_with_genres += 1
                for genre in song_genres:
                    if isinstance(genre, dict):
                        root_genre = genre.get('root', '')
                        sub_genre = genre.get('sub', '')
                        if root_genre:
                            all_genres.add(root_genre)
                        if sub_genre:
                            # Handle sub_genre which might be a list
                            if isinstance(sub_genre, list):
                                for sg in sub_genre:
                                    if sg:
                                        all_genres.add(sg)
                            else:
                                all_genres.add(sub_genre)
            else:
                songs_without_genres += 1
        
        print(f"\nSongs with genres: {songs_with_genres}")
        print(f"Songs without genres: {songs_without_genres}")
        print(f"\nAvailable genres ({len(all_genres)} total):")
        
        # Sort genres alphabetically
        sorted_genres = sorted(all_genres)
        for genre in sorted_genres:
            print(f"  - {genre}")
        
        # Check a few sample songs to see genre structure
        print(f"\nSample genre structures:")
        for i, song in enumerate(songs[:5]):
            if song.get('genres'):
                print(f"  {i+1}. {song.get('title', 'Unknown')} - {song.get('genres')}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_database_genres()
