import requests
import json

# --- Your API Configuration ---
SOUNDCHARTS_ID = 'CANDILORA_4AE68CA2'
SOUNDCHARTS_TOKEN = 'ba51ed017fd917e3'
API_BASE_URL = 'https://customer.api.soundcharts.com/api/v2.25'

def fetch_top_500_songs():
    """
    Makes a single API call to fetch the top 500 songs and prints the result.
    """
    print("Fetching top 500 songs from Soundcharts...")

    # The correct endpoint for getting a ranked list of songs
    url = f"{API_BASE_URL}/top/songs"

    # The headers for authentication
    headers = {
        'x-app-id': SOUNDCHARTS_ID,
        'x-api-key': SOUNDCHARTS_TOKEN,
        'Content-Type': 'application/json'
    }

    # The body of the request to specify sorting and limit
    payload = {
        "sort": {
            "field": "streams",
            "order": "desc",
            "period": "month"
        },
        "limit": 500
    }

    try:
        # Make the POST request
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()  # Raise an exception for bad status codes (like 404, 500)

        # Get the JSON data from the response
        data = response.json()

        # Print the data in a readable format
        print("\n✅ Successfully fetched data! You can use this as your new mock data.\n")
        print(json.dumps(data, indent=4))

    except requests.exceptions.HTTPError as http_err:
        print(f"\n❌ HTTP error occurred: {http_err}")
        print(f"Response body: {http_err.response.text}")
    except Exception as err:
        print(f"\n❌ An other error occurred: {err}")

# This line makes the script runnable from the command line
if __name__ == "__main__":
    fetch_top_500_songs()