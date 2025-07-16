# SessionKey

SessionKey is a music companion application that can identify a song's key and BPM from an audio file and provide suggestions for compatible songs and artists. The project consists of a React Native mobile app and a Python Flask backend server.

## Tech Stack

- **Frontend:** React Native
- **Backend:** Python, Flask
- **Database:** Google Firestore
- **Audio Analysis:** Librosa, ACRCloud

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Python 3.11+
- Node.js (with npm)
- FFmpeg

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/candilora28/SessionKey.git](https://github.com/candilora28/SessionKey.git)
    cd SessionKey
    ```

2.  **Set up the Backend Server:**
    ```bash
    # Navigate to the server directory
    cd KeyFinder-Server

    # Create and activate a virtual environment
    python -m venv .venv
    .\.venv\Scripts\Activate.ps1

    # Install Python dependencies
    pip install -r requirements.txt

    # Create a .env file and add your secret API keys
    ```

3.  **Set up the Frontend App:**
    ```bash
    # Navigate to the app directory
    cd ../KeyFinder-App

    # Install Node.js dependencies
    npm install
    ```