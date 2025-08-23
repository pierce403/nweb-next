#!/bin/bash

# nweb Test Data Setup Script
# This script generates fake data and sets it up for the analyst

set -e

echo "🧪 Setting up test data for nweb analyst..."

# Check if we're in the testing directory
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Run this from the testing directory."
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Generate fake data
echo "🎭 Generating fake data..."
python generate_fake_data.py

# Copy database to project root for analyst
echo "📋 Copying database to project root..."
cp nweb-analyst.db ../

echo "✅ Test data setup complete!"
echo "📊 Database available at: ../nweb-analyst.db"
echo "🌐 Start analyst with: ./run-analyst.sh"
