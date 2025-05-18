require('dotenv').config();
console.log('DEBUG ENV:', process.env);
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

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
        "blob:",
        "api.mapbox.com",
        "cdn.jsdelivr.net",
        "*.supabase.co",
        "cdnjs.cloudflare.com",
        "raw.githubusercontent.com"
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
        "blob:",
        "api.mapbox.com",
        "*.supabase.co",
        "raw.githubusercontent.com",
        process.env.CORS_ORIGIN,
        "*.mapbox.com"
      ],
      connectSrc: [
        "'self'",
        "api.mapbox.com",
        "events.mapbox.com",
        "*.mapbox.com",
        process.env.SUPABASE_URL,
        "wss://*.supabase.co",
        "raw.githubusercontent.com"
      ],
      fontSrc: ["'self'", "cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", process.env.CORS_ORIGIN],
      frameAncestors: ["'self'", process.env.CORS_ORIGIN],
      workerSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
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
  const config = {
    mapboxToken: process.env.MAPBOX_TOKEN,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  };
  console.log('API CONFIG:', config);
  res.json(config);
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

// Debug route - remove in production
app.get('/debug-env', (req, res) => {
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    // Only show the fact that these exist, not their values for security
    MAPBOX_TOKEN: process.env.MAPBOX_TOKEN ? "defined" : "undefined",
    SUPABASE_URL: process.env.SUPABASE_URL ? "defined" : "undefined",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? "defined" : "undefined"
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
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`CORS Origin: ${process.env.CORS_ORIGIN}`);
  console.log(`Public directory: ${path.join(__dirname, 'public')}`);
  console.log(`Root directory: ${__dirname}`);
}); 