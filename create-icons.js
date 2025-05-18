// Simple script to create placeholder icon files
const fs = require('fs');
const path = require('path');

// Ensure the assets directory exists
const assetsDir = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a minimal 1x1 pixel PNG file (transparent pixel)
// This is the minimal valid PNG file
const transparentPixelPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

// Write the files
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), transparentPixelPNG);
fs.writeFileSync(path.join(assetsDir, 'icon-192.png'), transparentPixelPNG);

console.log('Created placeholder icon files in public/assets/'); 