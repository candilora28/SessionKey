#!/usr/bin/env python3
"""
KeyFinder Server Entry Point
This file helps Railway detect this as a Python project and starts the Flask server.
"""

import os
import sys

# Add the KeyFinder-Server directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'KeyFinder-Server'))

# Change to the KeyFinder-Server directory
os.chdir(os.path.join(os.path.dirname(__file__), 'KeyFinder-Server'))

# Import and run the server
if __name__ == '__main__':
    import server
