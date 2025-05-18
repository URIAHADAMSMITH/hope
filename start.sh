#!/bin/bash

# Show what we're doing
echo "=== Earth App Glitch Startup Script ==="

# Clear node_modules to solve dependency issues
if [ -d "node_modules" ]; then
  echo "Clearing node_modules to prevent conflicts..."
  rm -rf node_modules
fi

# Install critical dependencies
echo "Installing essential dependencies..."
npm install express dotenv helmet compression cors express-rate-limit @supabase/supabase-js

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  cat > .env << EOF
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://voteearth.glitch.me
RESTART_KEY=earth2025secure
# Add your API keys below
MAPBOX_TOKEN=
SUPABASE_URL=
SUPABASE_ANON_KEY=
EOF
fi

# Create .gitignore if it doesn't exist
if [ ! -f ".gitignore" ]; then
  echo "Creating .gitignore file..."
  cat > .gitignore << EOF
node_modules
.env
.data
.DS_Store
EOF
fi

# Start with memory optimizations
echo "Starting server with memory optimizations..."
node --optimize_for_size --max_old_space_size=460 server.js 