// App configuration
const CONFIG = {
  // Map settings
  MAP: {
    STYLES: {
      satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
      light: 'mapbox://styles/mapbox/light-v11',
      dark: 'mapbox://styles/mapbox/dark-v11',
      streets: 'mapbox://styles/mapbox/streets-v12'
    },
    DEFAULT_CENTER: [0, 20],
    DEFAULT_ZOOM: 2,
    MAX_BOUNDS: [[-180, -85], [180, 85]],
    CLUSTER_MAX_ZOOM: 14,
    CLUSTER_RADIUS: 50
  },

  // Location settings
  LOCATION: {
    ZOOM_LEVELS: {
      GLOBAL: 0,
      CONTINENT: 2,
      COUNTRY: 4,
      STATE: 6
    },
    CACHE_DURATION: 30 * 60 * 1000 // 30 minutes
  },

  // Issue categories
  CATEGORIES: {
    ENVIRONMENT: {
      id: 'environment',
      label: 'Environment',
      icon: 'leaf',
      color: '#4CAF50'
    },
    INFRASTRUCTURE: {
      id: 'infrastructure',
      label: 'Infrastructure',
      icon: 'road',
      color: '#FF9800'
    },
    SAFETY: {
      id: 'safety',
      label: 'Safety',
      icon: 'shield-alt',
      color: '#F44336'
    },
    COMMUNITY: {
      id: 'community',
      label: 'Community',
      icon: 'users',
      color: '#2196F3'
    },
    EDUCATION: {
      id: 'education',
      label: 'Education',
      icon: 'graduation-cap',
      color: '#9C27B0'
    },
    HEALTH: {
      id: 'health',
      label: 'Health',
      icon: 'heartbeat',
      color: '#E91E63'
    },
    OTHER: {
      id: 'other',
      label: 'Other',
      icon: 'dot-circle',
      color: '#607D8B'
    }
  },

  // Cache settings
  CACHE: {
    ISSUE_DURATION: 5 * 60 * 1000, // 5 minutes
    LOCATION_DURATION: 30 * 60 * 1000, // 30 minutes
    MAX_ITEMS: 100
  },

  // API endpoints
  API: {
    CONFIG: '/api/config',
    ISSUES: '/api/issues',
    AUTH: '/api/auth'
  },

  // UI settings
  UI: {
    TOAST_DURATION: 3000,
    ANIMATION_DURATION: 300,
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 1000
  },

  // Validation
  VALIDATION: {
    PASSWORD_REGEX: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
    PASSWORD_REQUIREMENTS: [
      'At least 8 characters',
      'At least one letter',
      'At least one number',
      'At least one special character'
    ],
    MAX_TITLE_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 1000
  }
};

// Load environment-specific configuration
async function loadConfig() {
  try {
    const response = await fetch(CONFIG.API.CONFIG);
    const envConfig = await response.json();
    
    // Initialize Mapbox
    mapboxgl.accessToken = envConfig.mapboxToken;
    
    // Initialize Supabase
    const { createClient } = supabase;
    window.db = createClient(envConfig.supabaseUrl, envConfig.supabaseAnonKey);
    
    return true;
  } catch (error) {
    console.error('Failed to load configuration:', error);
    throw new Error('Failed to initialize application. Please refresh the page.');
  }
}

// Export configuration
window.CONFIG = CONFIG;
window.loadConfig = loadConfig; 