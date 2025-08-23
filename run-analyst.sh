#!/bin/bash

# nweb Analyst Runner Script
# This script runs the analyst frontend application

set -e

# Set up logging
LOG_FILE="analyst.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🚀 Starting nweb Analyst..."

# Check if we're in the right directory
if [ ! -d "analyst" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Error: analyst directory not found. Please run this script from the project root."
    exit 1
fi

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  Analyst server is already running on port 3000"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🔍 Check http://localhost:3000 for the running instance"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] 📄 View logs at: $LOG_FILE"
    exit 0
fi

cd analyst

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] 📦 Installing dependencies..."
    if ! npm install; then
        echo "[$(date +'%Y-%m-%d %H:%M:%S')] ❌ Failed to install dependencies. Please check your Node.js installation."
        exit 1
    fi
fi

# Set default environment variables if not provided
export POSTGRES_URL=${POSTGRES_URL:-""}
export NODE_ENV=${NODE_ENV:-"development"}

echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🌐 Starting Next.js development server..."
echo "[$(date +'%Y-%m-%d %H:%M:%S')] 📊 Database: $([ -n "$POSTGRES_URL" ] && echo "PostgreSQL" || echo "PGLite (fallback)")"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🌐 Server will be available at: http://localhost:3000"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] 📄 Logs are being written to: ../$LOG_FILE"
echo "[$(date +'%Y-%m-%d %H:%M:%S')] 🔗 Press Ctrl+C to stop the server"

# Start the development server on port 3000
PORT=3000 npm run dev
