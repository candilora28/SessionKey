# KeyFinder Server Deployment Guide

## Environment Variables Required

Set these environment variables in your Railway deployment:

### Required:
- `ACRCLOUD_ACCESS_KEY`: Your ACRCloud access key for song identification
- `ACRCLOUD_ACCESS_SECRET`: Your ACRCloud access secret

### Optional:
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to Firebase service account JSON (for analytics)
- `GENIUS_ACCESS_TOKEN`: Genius API token (for lyrics)
- `PORT`: Port number (Railway sets this automatically)

## Deployment Steps

1. Create a new Railway project
2. Connect your GitHub repository or upload the KeyFinder-Server folder
3. Set the environment variables in Railway dashboard
4. Railway will automatically detect the Python app and deploy

## Files Added for Deployment:
- `Procfile`: Tells Railway how to start the server
- `railway.json`: Railway-specific configuration
- `requirements.txt`: Updated with specific versions for cloud deployment

## Health Check
The server includes a `/health` endpoint for monitoring.
