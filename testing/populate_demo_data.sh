#!/bin/bash

# Demo script to populate the analyst with fake data
# This shows how to use the fake data generator

set -e

echo "🎭 Populating analyst with demo data..."

# Check if we're in the testing directory
if [ ! -f "generate_fake_data.py" ]; then
    echo "❌ Please run this script from the testing directory"
    exit 1
fi

# Stop any running analyst
echo "⏹️  Stopping analyst server..."
pkill -f "next dev" || true

# Generate fake data
echo "🔄 Generating fake data..."
source venv/bin/activate
python generate_fake_data.py

# Copy database to project root
echo "📋 Copying database..."
cp nweb-analyst.db ../

# Start analyst with the fake data
echo "🚀 Starting analyst with demo data..."
cd ..
./run-analyst.sh

