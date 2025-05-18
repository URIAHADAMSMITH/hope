require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for rate limiting behind reverse proxies like on Glitch
app.set('trust proxy', 1);

// Security middleware with relaxed CSP for Glitch
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", process.env.CORS_ORIGIN],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "api.mapbox.com",
        "cdn.jsdelivr.net",
        "*.supabase.co"
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "api.mapbox.com",
        "cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "api.mapbox.com",
        "*.supabase.co",
        process.env.CORS_ORIGIN
      ],
      connectSrc: [
        "'self'",
        "api.mapbox.com",
        process.env.SUPABASE_URL,
        "wss://*.supabase.co"
      ],
      fontSrc: ["'self'", "cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true
});
app.use('/api/', limiter);

// Enable CORS with specific origin
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files - try both /public and root directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// API routes
app.get('/api/config', (req, res) => {
  // Only send necessary frontend configuration
  res.json({
    mapboxToken: process.env.MAPBOX_TOKEN,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    cors_origin: process.env.CORS_ORIGIN
  });
});

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
  // Try both locations for index.html
  const publicPath = path.join(__dirname, 'public', 'index.html');
  const rootPath = path.join(__dirname, 'index.html');
  
  if (require('fs').existsSync(publicPath)) {
    res.sendFile(publicPath);
  } else if (require('fs').existsSync(rootPath)) {
    res.sendFile(rootPath);
  } else {
    res.status(404).send('index.html not found in either public/ or root directory');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`CORS Origin: ${process.env.CORS_ORIGIN}`);
  console.log(`Public directory: ${path.join(__dirname, 'public')}`);
  console.log(`Root directory: ${__dirname}`);
}); 