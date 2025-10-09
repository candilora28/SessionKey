# Use Python 3.9
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy server requirements and install dependencies
COPY KeyFinder-Server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code
COPY KeyFinder-Server/ .

# Expose port
EXPOSE 5000

# Start the server
CMD ["python", "server.py"]
