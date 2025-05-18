require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Check if running on Glitch
const isGlitch = !!process.env.PROJECT_DOMAIN;
if (isGlitch) {
  console.log(`Starting on Glitch (${process.env.PROJECT_DOMAIN})`);
  
  // Optimize memory usage
  if (typeof global.gc === 'function') {
    // Force garbage collection to free up memory
    setInterval(() => {
      try {
        global.gc();
        console.log('Garbage collection completed');
      } catch (e) {
        console.error('Error during garbage collection:', e);
      }
    }, 30000); // Every 30 seconds
  }
}

// Check if .env file exists, if not create it with defaults
const envFile = path.join(__dirname, '.env');
if (!fs.existsSync(envFile)) {
  console.log('No .env file found, creating with default values...');
  const defaultEnv = `NODE_ENV=production
PORT=${process.env.PORT || 3001}
CORS_ORIGIN=${isGlitch ? `https://${process.env.PROJECT_DOMAIN}.glitch.me` : 'http://localhost:3001'}
MAPBOX_TOKEN=${process.env.MAPBOX_TOKEN || ''}
SUPABASE_URL=${process.env.SUPABASE_URL || ''}
SUPABASE_ANON_KEY=${process.env.SUPABASE_ANON_KEY || ''}`;

  fs.writeFileSync(envFile, defaultEnv);
  console.log('.env file created. Please edit it to add your API keys.');
}

// Glitch-specific optimizations
if (isGlitch) {
  console.log('Applying Glitch-specific optimizations...');
  
  // Keep alive ping to prevent idle timeout
  setInterval(() => {
    console.log('Ping to keep alive');
  }, 280000); // 4.7 minutes
}

// Performance monitoring
const startTime = Date.now();
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for rate limiting behind reverse proxies like on Glitch
app.set('trust proxy', 1);

// Enhanced logging
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  // Add request ID for tracking
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : 
                    res.statusCode >= 400 ? 'warn' : 'info';
    
    console[logLevel](`[${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`[SLOW] Request ${req.id} took ${duration}ms to process`);
    }
  });
  
  next();
};

app.use(logRequest);

// Security middleware with optimized CSP for Glitch
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'", process.env.CORS_ORIGIN],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "api.mapbox.com",
        "cdn.jsdelivr.net",
        "*.supabase.co",
        "cdnjs.cloudflare.com",
        // Glitch-specific
        isGlitch ? "*.glitch.me" : null,
        isGlitch ? "cdn.glitch.global" : null,
        isGlitch ? "cdn.glitch.me" : null
      ].filter(Boolean),
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "api.mapbox.com",
        "cdnjs.cloudflare.com",
        // Glitch-specific
        isGlitch ? "*.glitch.me" : null,
        isGlitch ? "cdn.glitch.global" : null,
        isGlitch ? "cdn.glitch.me" : null
      ].filter(Boolean),
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "api.mapbox.com",
        "*.supabase.co",
        process.env.CORS_ORIGIN,
        "*.mapbox.com",
        // Glitch-specific
        isGlitch ? "*.glitch.me" : null,
        isGlitch ? "cdn.glitch.global" : null,
        isGlitch ? "cdn.glitch.me" : null
      ].filter(Boolean),
      connectSrc: [
        "'self'",
        "api.mapbox.com",
        "events.mapbox.com",
        process.env.SUPABASE_URL,
        "wss://*.supabase.co",
        // Glitch-specific
        isGlitch ? "*.glitch.me" : null,
        isGlitch ? "wss://*.glitch.me" : null
      ].filter(Boolean)
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  cacheControl: true
}));

// Advanced rate limiting with different limits for different routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  handler: (req, res, next, options) =>
    res.status(429).json({ error: 'Too many requests, please try again later' }),
  skip: (req, res) => process.env.NODE_ENV === 'development'
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // stricter limit for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  handler: (req, res, next, options) =>
    res.status(429).json({ error: 'Too many authentication attempts, please try again later' }),
  skip: (req, res) => process.env.NODE_ENV === 'development'
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

// Enable CORS with specific origin
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Enhanced compression
app.use(compression({
  level: 6, // Higher compression level
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  strategy: 0 // Use zlib's default strategy for best balance
}));

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Cache control middleware for static files
const cacheControl = (req, res, next) => {
  const extension = path.extname(req.path).toLowerCase();
  
  // Set different cache times based on file type
  if (['.css', '.js'].includes(extension)) {
    // Cache CSS and JS for 1 week
    res.setHeader('Cache-Control', 'public, max-age=604800');
  } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(extension)) {
    // Cache images for 1 month
    res.setHeader('Cache-Control', 'public, max-age=2592000');
  } else if (['.woff', '.woff2'].includes(extension)) {
    // Cache fonts for 1 year
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
  next();
};

// Serve static files with cache control
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  index: ['index.html']
}));
app.use(cacheControl);
app.use(express.static(__dirname));

// API routes
app.get('/api/config', (req, res) => {
  try {
    const config = {
      mapboxToken: process.env.MAPBOX_TOKEN,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    };
    
    // Check for undefined values
    const missingValues = Object.entries(config)
      .filter(([_, value]) => value === undefined)
      .map(([key]) => key);
    
    if (missingValues.length > 0) {
      console.warn(`Warning: Missing environment variables: ${missingValues.join(', ')}`);
    }
    
    res.json(config);
  } catch (error) {
    console.error('Error in /api/config:', error);
    res.status(500).json({ error: 'Failed to get configuration' });
  }
});

// Glitch-specific routes
if (isGlitch) {
  // Quick restart route (password protected)
  app.get('/restart', (req, res) => {
    if (req.query.key === process.env.RESTART_KEY) {
      res.send('Restarting server...');
      setTimeout(() => process.exit(0), 500);
    } else {
      res.status(403).send('Not authorized');
    }
  });
  
  // Status route for Glitch
  app.get('/glitch-status', (req, res) => {
    res.json({
      status: 'running',
      uptime: Math.floor(process.uptime()),
      started: new Date(Date.now() - (process.uptime() * 1000)).toISOString(),
      env: process.env.NODE_ENV
    });
  });
}

// Performance metrics endpoint
app.get('/metrics', (req, res) => {
  // Only allow in development mode
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Metrics endpoint is only available in development mode' });
  }
  
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  res.json({
    uptime: {
      seconds: uptime,
      formatted: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      arrayBuffers: `${Math.round((memoryUsage.arrayBuffers || 0) / 1024 / 1024)} MB`
    },
    cpu: cpuUsage,
    processId: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    startedAt: new Date(Date.now() - (uptime * 1000)).toISOString()
  });
});

// Health check endpoint with enhanced diagnostics
app.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    cors_origin: process.env.CORS_ORIGIN,
    uptime: `${uptime} seconds`,
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    }
  });
});

// Debug route with enhanced environment check
app.get('/debug-env', (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Debug endpoint is only available in development mode' });
    }
    
    res.json({
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      CORS_ORIGIN: process.env.CORS_ORIGIN,
      // Only show the fact that these exist, not their values for security
      MAPBOX_TOKEN: process.env.MAPBOX_TOKEN ? "defined" : "undefined",
      SUPABASE_URL: process.env.SUPABASE_URL ? "defined" : "undefined",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? "defined" : "undefined"
    });
  } catch (error) {
    console.error('Error in /debug-env:', error);
    res.status(500).json({ error: 'Failed to get environment information' });
  }
});

// Self-test route to verify all services are working
app.get('/self-test', async (req, res) => {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Self-test endpoint is only available in development mode' });
    }
    
    const tests = {
      staticFiles: fs.existsSync(path.join(__dirname, 'public', 'index.html')) || 
                  fs.existsSync(path.join(__dirname, 'index.html')),
      envVars: {
        mapbox: !!process.env.MAPBOX_TOKEN,
        supabaseUrl: !!process.env.SUPABASE_URL,
        supabaseKey: !!process.env.SUPABASE_ANON_KEY
      }
    };
    
    const allPassed = tests.staticFiles && 
                     Object.values(tests.envVars).every(v => v === true);
    
    res.json({
      success: allPassed,
      tests,
      message: allPassed ? 'All tests passed' : 'Some tests failed'
    });
  } catch (error) {
    console.error('Error in /self-test:', error);
    res.status(500).json({ error: 'Self-test failed' });
  }
});

// Serve index.html for all routes (SPA support) with better error handling
app.get('*', (req, res) => {
  try {
    // Try both locations for index.html
    const publicPath = path.join(__dirname, 'public', 'index.html');
    const rootPath = path.join(__dirname, 'index.html');
    
    if (fs.existsSync(publicPath)) {
      res.sendFile(publicPath);
    } else if (fs.existsSync(rootPath)) {
      res.sendFile(rootPath);
    } else {
      res.status(404).send('index.html not found in either public/ or root directory');
    }
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Server error: Could not serve application');
  }
});

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorId = `err_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  console.error(`Error [${errorId}]:`, err.message);
  console.error('Stack:', err.stack);
  
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    errorId: errorId,
    status: statusCode
  });
});

// Start server with graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'unknown'}`);
  console.log(`CORS Origin: ${process.env.CORS_ORIGIN || 'any'}`);
  console.log(`Public directory: ${path.join(__dirname, 'public')}`);
  console.log(`Root directory: ${__dirname}`);
  console.log('Server started successfully!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 