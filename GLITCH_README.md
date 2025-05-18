# Earth App - Glitch Deployment Guide

## Quick Start

1. **First time setup**: 
   - Wait for the app to initialize (may take up to 2 minutes)
   - Visit `/glitch-debug.html` to verify all services are running

2. **If you encounter a 503 error**:
   - Go to the Glitch editor → Tools → Terminal
   - Run: `chmod +x start.sh && ./start.sh`
   - Or use the built-in restart URL: `/restart?key=earth2025secure`

## Troubleshooting

### Common Issues

1. **503 Request Timeout**
   - The app is taking too long to initialize
   - Solution: Visit `/restart?key=earth2025secure` to restart with optimized settings

2. **API Keys Missing**
   - Make sure to add your Mapbox and Supabase keys to the `.env` file
   - Use the Glitch editor to update the `.env` file in the project root

3. **Memory Issues**
   - The app is already optimized to use less than 512MB of RAM
   - If you still see issues, remove unused dependencies in `package.json`

### Debug Tools

- `/glitch-debug.html` - Interactive debugging dashboard
- `/health` - Check server health and memory usage
- `/glitch-status` - View Glitch-specific status info

## Additional Notes

- The app uses a startup script (`start.sh`) that optimizes for Glitch hosting
- Environment is automatically set to production mode
- Memory usage is limited to 460MB to prevent Glitch's memory limit errors
- A keep-alive system prevents idle timeouts

## Getting Help

If you're still experiencing issues, check the Glitch support forum or contact the Earth App team. 