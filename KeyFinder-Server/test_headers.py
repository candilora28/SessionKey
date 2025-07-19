import requests
import json

# --- Your API Configuration ---
SOUNDCHARTS_ID = 'CANDILORA_4AE68CA2'
SOUNDCHARTS_TOKEN = 'ba51ed017fd917e3'

def check_headers():
    """Makes a call to a test server to verify our headers are being sent."""
    
    test_url = 'https://httpbin.org/headers'

    headers = {
        'x-app-id': SOUNDCHARTS_ID,
        'x-api-key': SOUNDCHARTS_TOKEN
    }

    # --- FIX: Explicitly tell requests to not use any proxies ---
    proxies = {
      "http": None,
      "https": None,
    }

    print("Sending request with proxies disabled...")

    try:
        # Pass the proxies=proxies parameter to the request
        response = requests.get(test_url, headers=headers, proxies=proxies)
        response.raise_for_status()
        data = response.json()

        print("✅ Test server received the following headers from your script:")
        print(json.dumps(data, indent=4))
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    check_headers()