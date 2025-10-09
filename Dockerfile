# Use Python 3.9
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy server requirements and install dependencies
COPY KeyFinder-Server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY KeyFinder-Server/ .

# Set environment variables
ENV PYTHONPATH=/app
ENV FLASK_APP=server.py
ENV FLASK_ENV=production

# Expose port (Railway will set PORT automatically)
EXPOSE $PORT

# Start the server
CMD ["python", "server.py"]
