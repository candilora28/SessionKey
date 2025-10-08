import json
import os

def debug_genre_filtering():
    """Debug the genre filtering logic"""
    try:
        # Load the database
        with open('music_database_final.json', 'r', encoding='utf-8') as f:
            database = json.load(f)
        
        songs = database.get('songs_with_metadata', [])
        print(f"Total songs: {len(songs)}")
        
        # Test A Minor songs
        a_minor_songs = []
        for song in songs:
            song_key = song.get('key_name', '')
            song_mode = song.get('mode_name', '')
            if song_key and song_mode:
                full_key = f"{song_key} {song_mode}"
                if full_key == "A Minor":
                    a_minor_songs.append(song)
        
        print(f"\nFound {len(a_minor_songs)} songs in A Minor")
        
        # Test genre filtering for "Pop"
        search_genre = "Pop"
        print(f"\nTesting genre filtering for: '{search_genre}'")
        
        genre_matches = []
        for song in a_minor_songs:
            song_genres = song.get('genres', [])
            if song_genres:
                genre_names = []
                for g in song_genres:
                    if isinstance(g, dict):
                        root_genre = g.get('root', '')
                        sub_genre = g.get('sub', '')
                        if root_genre:
                            genre_names.append(root_genre)
                        if sub_genre:
                            if isinstance(sub_genre, list):
                                for sg in sub_genre:
                                    if sg:
                                        genre_names.append(sg)
                            else:
                                genre_names.append(sub_genre)
                
                # Test our filtering logic
                search_genre_lower = search_genre.lower().strip()
                matched = False
                for g in genre_names:
                    g_lower = g.lower().strip()
                    if search_genre_lower == g_lower:
                        matched = True
                        break
                    elif search_genre_lower in g_lower or g_lower in search_genre_lower:
                        matched = True
                        break
                
                if matched:
                    genre_matches.append(song)
                    print(f"  ✓ {song.get('title', 'Unknown')} - Genres: {genre_names}")
                else:
                    print(f"  ✗ {song.get('title', 'Unknown')} - Genres: {genre_names}")
            else:
                print(f"  ? {song.get('title', 'Unknown')} - No genres")
        
        print(f"\nTotal matches for '{search_genre}': {len(genre_matches)}")
        
        # Show some sample genre structures
        print(f"\nSample genre structures from A Minor songs:")
        for i, song in enumerate(a_minor_songs[:5]):
            print(f"  {i+1}. {song.get('title', 'Unknown')}")
            print(f"     Genres: {song.get('genres', [])}")
            print()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_genre_filtering()

