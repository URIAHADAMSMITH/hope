// Map configuration
const MAPBOX_TOKEN = 'pk.eyJ1IjoidXJpYWhhZGFtc21pdGgiLCJhIjoiY21hcmF5OGlxMDhyajJscTd2eWUwOWppYyJ9.QyRYVNllITqSNxXYixHgmw';

// Initialize Supabase
const SUPABASE_URL = 'https://acwnjyexyxtxtcdmmytr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd25qeWV4eXh0eHRjZG1teXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg5NzQwMDAsImV4cCI6MjAyNDU1MDAwMH0.H7S8MhFp6E6uJ8ZHJ4JqJM2SQOqyM-mmVj5J3qa3CD4';

// Create Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Map styles
const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/streets-v12'
};

// Global state
let map;
let heatmap;
let currentLocation = {
  type: 'global',
  name: 'World',
  center: [0, 20],
  bounds: null
};

// Cache and optimization
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const issueCache = new Map();
let lastMapUpdate = 0;
const MAP_UPDATE_THROTTLE = 100; // ms

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle helper
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// Optimized location update
const debouncedUpdateLocation = debounce(updateLocationFromMap, 250);
const throttledLoadIssues = throttle(loadLocationIssues, 1000);

// Cache management
function getCachedIssues(key) {
  const cached = issueCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedIssues(key, data) {
  issueCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// Error handling and recovery
class AppError extends Error {
  constructor(message, type, originalError = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.originalError = originalError;
  }
}

const ErrorTypes = {
  MAP: 'map',
  DATABASE: 'database',
  NETWORK: 'network',
  AUTH: 'auth',
  VALIDATION: 'validation',
  UNKNOWN: 'unknown'
};

async function handleError(error, context = '') {
  console.error(`Error in ${context}:`, error);

  let appError;
  if (error instanceof AppError) {
    appError = error;
  } else {
    // Categorize error
    appError = categorizeError(error);
  }

  // Log error to monitoring service (if implemented)
  logError(appError);

  // Attempt recovery
  await attemptRecovery(appError);

  // Show user-friendly message
  showToast(appError.message, appError.type);
}

function categorizeError(error) {
  if (error.code && error.code.startsWith('PG')) {
    return new AppError(error.message, ErrorTypes.DATABASE, error);
  }
  if (error.message && error.message.includes('network')) {
    return new AppError('Network connection issue', ErrorTypes.NETWORK, error);
  }
  if (error.message && error.message.includes('authentication')) {
    return new AppError('Authentication error', ErrorTypes.AUTH, error);
  }
  return new AppError('An unexpected error occurred', ErrorTypes.UNKNOWN, error);
}

async function attemptRecovery(error) {
  switch (error.type) {
    case ErrorTypes.MAP:
      await reinitializeMap();
      break;
    case ErrorTypes.DATABASE:
      await reconnectDatabase();
      break;
    case ErrorTypes.NETWORK:
      await retryWithBackoff(error.originalError?.retryFn);
      break;
    case ErrorTypes.AUTH:
      redirectToAuth();
      break;
  }
}

async function reinitializeMap() {
  try {
    if (map) {
      map.remove();
    }
    await initializeMap();
    showToast('Map has been reinitialized', 'info');
  } catch (error) {
    showToast('Could not reinitialize map. Please refresh the page.', 'error');
  }
}

async function reconnectDatabase() {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await supabase.auth.getSession();
    showToast('Database connection restored', 'success');
  } catch (error) {
    showToast('Could not reconnect to database', 'error');
  }
}

async function retryWithBackoff(fn, maxRetries = 3) {
  if (!fn) return;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fn();
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

function redirectToAuth() {
  const currentPath = window.location.pathname;
  window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <i class="fas ${getToastIcon(type)}"></i>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function getToastIcon(type) {
  switch (type) {
    case 'success':
      return 'fa-check-circle';
    case 'error':
      return 'fa-times-circle';
    case 'warning':
      return 'fa-exclamation-triangle';
    default:
      return 'fa-info-circle';
  }
}

function logError(error) {
  // Implement error logging to your preferred service
  console.error('Logged error:', {
    type: error.type,
    message: error.message,
    originalError: error.originalError,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent
  });
}

// Auth state
let currentUser = null;

// Initialize auth state
async function initializeAuth() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    
    if (session) {
      currentUser = session.user;
      updateAuthUI(true);
      await loadUserProfile();
    } else {
      updateAuthUI(false);
    }

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        currentUser = session.user;
        updateAuthUI(true);
        await loadUserProfile();
        showToast('Successfully signed in!', 'success');
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        updateAuthUI(false);
        showToast('Successfully signed out', 'info');
      }
    });
  } catch (error) {
    console.error('Error initializing auth:', error);
    showToast('Error initializing authentication', 'error');
  }
}

async function loadUserProfile() {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error) throw error;

    if (!profile) {
      // Create profile if it doesn't exist
      const { error: createError } = await supabase
        .from('profiles')
        .insert([
          {
            id: currentUser.id,
            username: currentUser.email.split('@')[0],
            avatar_url: null,
            bio: '',
            created_at: new Date().toISOString()
          }
        ]);

      if (createError) throw createError;
    }

    return profile;
  } catch (error) {
    console.error('Error loading user profile:', error);
    showToast('Error loading user profile', 'error');
  }
}

function updateAuthUI(isAuthenticated) {
  const authSection = document.getElementById('auth-section');
  
  if (isAuthenticated) {
    authSection.innerHTML = `
      <div class="user-menu">
        <button id="profile-button" class="profile-button">
          <i class="fas fa-user"></i>
          <span>${currentUser.email}</span>
        </button>
        <button id="sign-out" class="auth-button">Sign Out</button>
      </div>
    `;

    // Add sign out handler
    document.getElementById('sign-out').addEventListener('click', async () => {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        showToast('Successfully signed out', 'success');
      } catch (error) {
        console.error('Error signing out:', error);
        showToast('Error signing out', 'error');
      }
    });
  } else {
    authSection.innerHTML = `
      <button id="sign-in" class="auth-button">Sign In</button>
      <button id="sign-up" class="auth-button">Sign Up</button>
    `;

    // Add auth button handlers
    document.getElementById('sign-in').addEventListener('click', () => showAuthModal('sign-in'));
    document.getElementById('sign-up').addEventListener('click', () => showAuthModal('sign-up'));
  }
}

function showAuthModal(type = 'sign-in') {
  const modal = document.createElement('div');
  modal.className = 'modal auth-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${type === 'sign-in' ? 'Sign In' : 'Sign Up'}</h2>
        <button class="close-button">&times;</button>
      </div>
      <div class="modal-body">
        <form id="auth-form" class="auth-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" required minlength="6">
            <small class="help-text">Password must be at least 6 characters long</small>
          </div>
          ${type === 'sign-up' ? `
            <div class="form-group">
              <label for="confirm-password">Confirm Password</label>
              <input type="password" id="confirm-password" required minlength="6">
            </div>
          ` : ''}
          <div class="form-actions">
            <button type="submit" class="submit-button" id="auth-submit">
              ${type === 'sign-in' ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </form>
        <div class="auth-separator">
          <span>or</span>
        </div>
        <div class="social-auth">
          <button onclick="signInWithProvider('google')" class="social-button google">
            <i class="fab fa-google"></i>
            Continue with Google
          </button>
          <button onclick="signInWithProvider('github')" class="social-button github">
            <i class="fab fa-github"></i>
            Continue with GitHub
          </button>
        </div>
        <p class="auth-switch">
          ${type === 'sign-in'
            ? 'Don\'t have an account? <a href="#" id="switch-to-signup">Sign Up</a>'
            : 'Already have an account? <a href="#" id="switch-to-signin">Sign In</a>'
          }
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  const closeButton = modal.querySelector('.close-button');
  const form = modal.querySelector('#auth-form');
  const submitButton = modal.querySelector('#auth-submit');
  const switchLink = modal.querySelector('#switch-to-signup, #switch-to-signin');

  const closeModal = () => {
    modal.classList.add('fade-out');
    setTimeout(() => modal.remove(), 300);
  };

  closeButton.addEventListener('click', closeModal);

  // Switch between sign in and sign up
  switchLink.addEventListener('click', (e) => {
    e.preventDefault();
    modal.remove();
    showAuthModal(type === 'sign-in' ? 'sign-up' : 'sign-in');
  });

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = form.querySelector('#email').value;
    const password = form.querySelector('#password').value;

    try {
      submitButton.disabled = true;
      submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
      
      let result;
      
      if (type === 'sign-up') {
        const confirmPassword = form.querySelector('#confirm-password').value;
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              email_confirmed: false
            }
          }
        });
      } else {
        result = await supabase.auth.signInWithPassword({
          email,
          password
        });
      }

      if (result.error) throw result.error;

      if (type === 'sign-up') {
        showToast('Please check your email to verify your account', 'success');
      } else {
        showToast('Successfully signed in!', 'success');
      }

      closeModal();
    } catch (error) {
      console.error('Auth error:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('invalid api key')) {
        errorMessage = 'Authentication service is not properly configured. Please try again later.';
      }
      
      showToast(errorMessage, 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = type === 'sign-in' ? 'Sign In' : 'Sign Up';
    }
  });

  // Animate modal in
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });
}

async function signInWithProvider(provider) {
  try {
    showToast('Connecting to ' + provider + '...', 'info');
    
    // Check if provider is enabled
    const { data: providers } = await supabase.auth.getSettings();
    const isEnabled = providers?.external?.[provider]?.enabled;
    
    if (!isEnabled) {
      throw new Error(`${provider} sign in is not configured yet. Please try email sign in.`);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) throw error;

    // Success will be handled by the OAuth redirect
  } catch (error) {
    console.error('Social auth error:', error);
    
    let errorMessage = 'Error signing in with ' + provider;
    if (error.message) {
      errorMessage = error.message;
    } else if (error.error_description) {
      errorMessage = error.error_description;
    }
    
    showToast(errorMessage, 'error');
  }
}

function showProfileModal() {
  // Implementation for viewing profile
}

function showProfileEditModal() {
  // Implementation for editing profile
}

async function showMyIssues() {
  try {
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Update the issues list with user's issues
    displayIssues(issues);
    
    // Update map to focus on user's issues
    if (issues.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      issues.forEach(issue => {
        bounds.extend([issue.longitude, issue.latitude]);
      });
      map.fitBounds(bounds, { padding: 50 });
    }
  } catch (error) {
    console.error('Error loading user issues:', error);
    showToast('Error loading your issues', 'error');
  }
}

function showSettingsModal() {
  // Implementation for user settings
}

// Initialize map when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeApp().catch(error => {
    console.error('Error initializing application:', error);
    showToast('Error initializing application', 'error');
  });
});

// New async initialization function
async function initializeApp() {
  try {
    // Set Mapbox access token
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Check if Mapbox GL JS is supported
    if (!mapboxgl.supported()) {
      throw new Error('Your browser does not support Mapbox GL JS. Please try a different browser.');
    }

    // Create the map
    map = new mapboxgl.Map({
      container: 'map',
      style: MAP_STYLES.satellite,
      center: [0, 20],
      zoom: 2,
      projection: 'mercator',
      maxBounds: [[-180, -85], [180, 85]],
      renderWorldCopies: false
    });

    // Wait for map to load
    await new Promise((resolve, reject) => {
      map.on('load', resolve);
      map.on('error', reject);
    });

    console.log('Map loaded successfully');

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add scale control
    map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

    // Add fullscreen control
    map.addControl(new mapboxgl.FullscreenControl());

    // Add style control
    const styleControl = document.createElement('div');
    styleControl.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    styleControl.innerHTML = `
      <select id="map-style" class="mapboxgl-ctrl">
        <option value="satellite">Satellite</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="streets">Streets</option>
      </select>
    `;
    document.querySelector('.mapboxgl-ctrl-top-right').appendChild(styleControl);

    // Handle style changes
    document.getElementById('map-style').addEventListener('change', (e) => {
      map.setStyle(MAP_STYLES[e.target.value]);
      map.once('style.load', () => {
        initializeMapLayers();
      });
    });

    // Disable map rotation
    map.dragRotate.disable();
    map.touchZoomRotate.disableRotation();

    // Add geocoder control for location search
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      types: 'country,region',
      placeholder: 'Search for a location...'
    });
    map.addControl(geocoder);

    // Handle geocoder results
    geocoder.on('result', (e) => {
      const result = e.result;
      updateLocationFromGeocoder(result);
    });

    // Update location on map move with debouncing
    map.on('moveend', () => {
      debouncedUpdateLocation();
    });

    // Update issues with throttling
    map.on('moveend', () => {
      throttledLoadIssues();
    });

    // Handle map errors
    map.on('error', (e) => {
      console.error('Map error:', e);
      showToast('Error loading map. Please refresh the page.', 'error');
    });

    // Initialize authentication
    await initializeAuth();

    // Setup event listeners
    await setupEventListeners();

    // Setup issue creation (after map is initialized)
    setupIssueCreation();

    // Load initial issues
    await loadLocationIssues();

  } catch (error) {
    console.error('Error initializing application:', error);
    showToast('Error initializing application: ' + error.message, 'error');
  }
}

function initializeMapLayers() {
  try {
    // Add source for issue locations
    map.addSource('issue-locations', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50
    });

    // Add source for heatmap
    map.addSource('issue-heat', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    // Add heatmap layer
    map.addLayer({
      id: 'issue-heat',
      type: 'heatmap',
      source: 'issue-heat',
      maxzoom: 15,
      paint: {
        'heatmap-weight': [
          'interpolate',
          ['linear'],
          ['get', 'mag'],
          0, 0,
          6, 1
        ],
        'heatmap-intensity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1,
          15, 3
        ],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33,102,172,0)',
          0.2, 'rgb(103,169,207)',
          0.4, 'rgb(209,229,240)',
          0.6, 'rgb(253,219,199)',
          0.8, 'rgb(239,138,98)',
          1, 'rgb(178,24,43)'
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 2,
          15, 20
        ],
        'heatmap-opacity': 0.7
      }
    }, 'waterway-label');

    // Add clusters layer
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'issue-locations',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6',
          100,
          '#f1f075',
          750,
          '#f28cb1'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          100,
          30,
          750,
          40
        ]
      }
    });

    // Add cluster count layer
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'issue-locations',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12
      }
    });

    // Add unclustered point layer
    map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'issue-locations',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#11b4da',
        'circle-radius': 8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff'
      }
    });

    // Add click event for clusters
    map.on('click', 'clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties.cluster_id;
      map.getSource('issue-locations').getClusterExpansionZoom(
        clusterId,
        (err, zoom) => {
          if (err) return;
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom
          });
        }
      );
    });

    // Add click event for unclustered points
    map.on('click', 'unclustered-point', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const properties = e.features[0].properties;
      
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }
      
      showIssueDetails(properties);
    });

    // Change cursor on hover
    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = '';
    });

    // Add visualization toggle control
    const vizControl = document.createElement('div');
    vizControl.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    vizControl.innerHTML = `
      <button id="toggle-heatmap" class="mapboxgl-ctrl-icon" title="Toggle heatmap">
        <i class="fas fa-fire"></i>
      </button>
    `;
    document.querySelector('.mapboxgl-ctrl-top-right').appendChild(vizControl);

    // Handle visualization toggle
    document.getElementById('toggle-heatmap').addEventListener('click', () => {
      const visibility = map.getLayoutProperty('issue-heat', 'visibility');
      if (visibility === 'visible') {
        map.setLayoutProperty('issue-heat', 'visibility', 'none');
        map.setLayoutProperty('clusters', 'visibility', 'visible');
        map.setLayoutProperty('cluster-count', 'visibility', 'visible');
        map.setLayoutProperty('unclustered-point', 'visibility', 'visible');
      } else {
        map.setLayoutProperty('issue-heat', 'visibility', 'visible');
        map.setLayoutProperty('clusters', 'visibility', 'none');
        map.setLayoutProperty('cluster-count', 'visibility', 'none');
        map.setLayoutProperty('unclustered-point', 'visibility', 'none');
      }
    });

    // Load initial issues
    loadLocationIssues();
  } catch (error) {
    console.error('Error initializing map layers:', error);
    showToast('Error setting up map features. Please refresh the page.', 'error');
  }
}

async function setupEventListeners() {
  try {
    // Close modals when clicking outside
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
          modal.classList.add('hidden');
        }
      });
    });

    // Close modal when clicking cancel
    const cancelButtons = document.querySelectorAll('.cancel-button');
    cancelButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const modal = e.target.closest('.modal');
        if (modal) {
          modal.classList.remove('show');
          modal.classList.add('hidden');
        }
      });
    });

    // Handle escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const visibleModals = document.querySelectorAll('.modal:not(.hidden)');
        visibleModals.forEach(modal => {
          modal.classList.remove('show');
          modal.classList.add('hidden');
        });
      }
    });

    // Handle authentication buttons
    const loginButton = document.getElementById('login-button');
    const registerButton = document.getElementById('register-button');
    const authModal = document.getElementById('auth-modal');
    const authTitle = document.getElementById('auth-title');
    const authSwitch = document.getElementById('auth-switch');
    const authSwitchLink = document.getElementById('auth-switch-link');

    if (loginButton && registerButton && authModal) {
      loginButton.addEventListener('click', () => {
        authTitle.textContent = 'Sign In';
        authSwitch.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Register</a>';
        authModal.classList.remove('hidden');
      });

      registerButton.addEventListener('click', () => {
        authTitle.textContent = 'Register';
        authSwitch.innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Sign In</a>';
        authModal.classList.remove('hidden');
      });

      authSwitch.addEventListener('click', (e) => {
        if (e.target.id === 'auth-switch-link') {
          e.preventDefault();
          const isLogin = authTitle.textContent === 'Sign In';
          authTitle.textContent = isLogin ? 'Register' : 'Sign In';
          authSwitch.innerHTML = isLogin 
            ? 'Already have an account? <a href="#" id="auth-switch-link">Sign In</a>'
            : 'Don\'t have an account? <a href="#" id="auth-switch-link">Register</a>';
        }
      });
    }
  } catch (error) {
    console.error('Error setting up event listeners:', error);
    showToast('Error setting up application', 'error');
  }
}

// Update location from geocoder result
async function updateLocationFromGeocoder(result) {
  try {
    if (!result || !result.geometry) return;

    const { place_name, geometry, properties, place_type } = result;
    
    // Update current location
    currentLocation = {
      name: place_name,
      center: geometry.coordinates,
      type: place_type[0] || 'unknown',
      bounds: result.bbox ? [
        [result.bbox[0], result.bbox[1]], // Southwest
        [result.bbox[2], result.bbox[3]]  // Northeast
      ] : null
    };

    // Update UI
    document.getElementById('current-location').textContent = currentLocation.name;
    
    // Load issues for the new location
    await loadLocationIssues();
  } catch (error) {
    console.error('Error updating location from geocoder:', error);
  }
}

// Update location based on map position
async function updateLocationFromMap() {
  try {
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bounds = map.getBounds();

    // Determine location type based on zoom level
    let locationType = 'global';
    if (zoom >= 6) {
      locationType = 'state';
    } else if (zoom >= 4) {
      locationType = 'country';
    } else if (zoom >= 2) {
      locationType = 'continent';
    }

    // Get location name from coordinates
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${center.lng},${center.lat}.json?types=country,region&access_token=${MAPBOX_TOKEN}`
    );
    const data = await response.json();
    const locationName = data.features[0]?.place_name || 'Unknown Location';

    // Update current location
    currentLocation = {
      type: locationType,
      name: locationName,
      center: [center.lng, center.lat],
      bounds: [
        [bounds._sw.lng, bounds._sw.lat],
        [bounds._ne.lng, bounds._ne.lat]
      ]
    };

    // Update UI
    document.getElementById('current-location').textContent = currentLocation.name;
    
    // Load issues for the new location
    await loadLocationIssues();
  } catch (error) {
    console.error('Error updating location from map:', error);
  }
}

// Load issues for current location
async function loadLocationIssues() {
  if (!map) {
    await handleError(new AppError('Map not initialized', ErrorTypes.MAP));
    return;
  }

  try {
    const bounds = currentLocation.bounds || map.getBounds();
    const sw = bounds[0] || bounds._sw;
    const ne = bounds[1] || bounds._ne;

    // Generate cache key based on bounds and zoom
    const zoom = Math.floor(map.getZoom());
    const cacheKey = `${sw.lat.toFixed(2)},${sw.lng.toFixed(2)},${ne.lat.toFixed(2)},${ne.lng.toFixed(2)},${zoom}`;
    
    // Check cache first
    const cachedData = getCachedIssues(cacheKey);
    if (cachedData) {
      updateMapWithIssues(cachedData);
      return;
    }

    // Subscribe to real-time updates
    const issueSubscription = supabase
      .channel('issues_channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'issues',
          filter: `latitude.gte.${sw.lat}
            ,latitude.lte.${ne.lat}
            ,longitude.gte.${sw.lng}
            ,longitude.lte.${ne.lng}`
        }, 
        (payload) => {
          handleRealtimeUpdate(payload);
        }
      )
      .subscribe();

    let query = supabase
      .from('issues')
      .select('*, profiles(username)')  // Join with user profiles
      .gte('latitude', sw.lat)
      .lte('latitude', ne.lat)
      .gte('longitude', sw.lng)
      .lte('longitude', ne.lng);

    // Add location type filter if not global
    if (currentLocation.type !== 'global') {
      query = query.eq('location_type', currentLocation.type);
    }

    const { data: issues, error } = await query;

    if (error) {
      if (error.code === 'PGRST301') {
        // Handle authentication error
        showToast('Please sign in to view issues', 'error');
        return;
      }
      throw error;
    }

    // Cache the results
    setCachedIssues(cacheKey, issues);
    updateMapWithIssues(issues);
  } catch (error) {
    await handleError(error, 'loadLocationIssues');
  }
}

async function handleRealtimeUpdate(payload) {
  try {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    const source = map.getSource('issue-locations');
    if (!source) return;

    const currentData = source._data;
    let features = [...currentData.features];

    switch (eventType) {
      case 'INSERT':
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [newRecord.longitude, newRecord.latitude]
          },
          properties: {
            id: newRecord.id,
            title: newRecord.title,
            category: newRecord.category,
            description: newRecord.description,
            created_at: newRecord.created_at,
            location_name: newRecord.location_name
          }
        });
        showToast('New issue added!', 'success');
        break;

      case 'UPDATE':
        features = features.map(feature => 
          feature.properties.id === oldRecord.id 
            ? {
                ...feature,
                properties: {
                  ...feature.properties,
                  title: newRecord.title,
                  category: newRecord.category,
                  description: newRecord.description
                }
              }
            : feature
        );
        showToast('Issue updated!', 'success');
        break;

      case 'DELETE':
        features = features.filter(feature => feature.properties.id !== oldRecord.id);
        showToast('Issue deleted!', 'info');
        break;
    }

    source.setData({
      type: 'FeatureCollection',
      features: features
    });

    // Refresh issues display
    loadLocationIssues();
  } catch (error) {
    handleError(error, 'handleRealtimeUpdate').catch(console.error);
  }
}

function handleDatabaseError(error) {
  let message = 'An error occurred while accessing the database';
  
  switch (error.code) {
    case '23505':
      message = 'This issue already exists';
      break;
    case '23503':
      message = 'Referenced record does not exist';
      break;
    case '42P01':
      message = 'Database table not found';
      break;
    case 'PGRST301':
      message = 'Authentication required';
      break;
    case '28P01':
      message = 'Invalid database credentials';
      break;
    default:
      if (error.message) {
        message = error.message;
      }
  }
  
  showToast(message, 'error');
}

function displayIssues(issues) {
  const issuesList = document.getElementById('issues-list');
  if (!issuesList) return;

  // Show loading state
  issuesList.innerHTML = '<div class="loading-spinner"></div>';

  // Group issues by category
  const groupedIssues = issues.reduce((acc, issue) => {
    if (!acc[issue.category]) {
      acc[issue.category] = [];
    }
    acc[issue.category].push(issue);
    return acc;
  }, {});

  // Create HTML for grouped issues
  const issuesHTML = Object.entries(groupedIssues).map(([category, categoryIssues]) => `
    <div class="category-group">
      <h2 class="category-title">
        <span class="category-icon">
          <i class="fas fa-${getCategoryIcon(category)}"></i>
        </span>
        ${category}
        <span class="category-count">${categoryIssues.length}</span>
      </h2>
      <div class="issues-grid">
        ${categoryIssues.map(issue => `
          <div class="issue-card" data-id="${issue.id}">
            <div class="issue-header">
              <span class="category-tag">${issue.category}</span>
              <span class="issue-date">${formatDate(issue.created_at)}</span>
            </div>
            <h3 class="issue-title">${issue.title}</h3>
            <p class="issue-description">${truncateText(issue.description, 150)}</p>
            <div class="issue-footer">
              <span class="issue-location">
                <i class="fas fa-map-marker-alt"></i>
                ${issue.location_name}
              </span>
              <span class="issue-author">
                <i class="fas fa-user"></i>
                ${issue.username || 'Anonymous'}
              </span>
            </div>
            <button class="view-details-btn" onclick="showIssueDetails(${JSON.stringify(issue)})">
              View Details
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Add filter controls
  const filterControls = `
    <div class="filter-controls">
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input type="text" id="issue-search" placeholder="Search issues...">
      </div>
      <div class="category-filters">
        ${Object.keys(groupedIssues).map(category => `
          <button class="category-filter" data-category="${category}">
            <i class="fas fa-${getCategoryIcon(category)}"></i>
            ${category}
          </button>
        `).join('')}
      </div>
      <div class="sort-controls">
        <select id="sort-issues">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="category">By Category</option>
        </select>
      </div>
    </div>
  `;

  // Update the DOM
  issuesList.innerHTML = filterControls + issuesHTML;

  // Add event listeners for filtering and sorting
  setupFilterListeners();
}

function showIssueDetails(issue) {
  const modal = document.createElement('div');
  modal.className = 'modal issue-detail-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>${issue.title}</h2>
        <button class="close-button">&times;</button>
      </div>
      <div class="modal-body">
        <div class="issue-metadata">
          <span class="category-tag large">${issue.category}</span>
          <span class="issue-date">
            <i class="fas fa-calendar"></i>
            ${formatDate(issue.created_at)}
          </span>
          <span class="issue-location">
            <i class="fas fa-map-marker-alt"></i>
            ${issue.location_name}
          </span>
          <span class="issue-author">
            <i class="fas fa-user"></i>
            ${issue.username || 'Anonymous'}
          </span>
        </div>
        <div class="issue-content">
          <p>${issue.description}</p>
        </div>
        <div class="issue-actions">
          <button class="action-button" onclick="focusOnMap([${issue.longitude}, ${issue.latitude}])">
            <i class="fas fa-map-marked-alt"></i>
            Show on Map
          </button>
          <button class="action-button" onclick="shareIssue('${issue.id}')">
            <i class="fas fa-share-alt"></i>
            Share
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  const closeButton = modal.querySelector('.close-button');
  closeButton.addEventListener('click', () => {
    modal.classList.add('fade-out');
    setTimeout(() => modal.remove(), 300);
  });

  // Animate in
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });
}

// Helper functions
function getCategoryIcon(category) {
  const icons = {
    'Environment': 'leaf',
    'Infrastructure': 'road',
    'Safety': 'shield-alt',
    'Community': 'users',
    'Education': 'graduation-cap',
    'Health': 'heartbeat',
    'Other': 'dot-circle'
  };
  return icons[category] || 'dot-circle';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 86400000) { // Less than 24 hours
    return timeAgo(date);
  }
  return date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' years ago';
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' months ago';
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' days ago';
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hours ago';
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minutes ago';
  
  return 'just now';
}

function truncateText(text, length) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

function setupFilterListeners() {
  const searchInput = document.getElementById('issue-search');
  const categoryFilters = document.querySelectorAll('.category-filter');
  const sortSelect = document.getElementById('sort-issues');

  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      filterIssues(e.target.value);
    }, 300));
  }

  categoryFilters.forEach(filter => {
    filter.addEventListener('click', () => {
      filter.classList.toggle('active');
      filterIssuesByCategory();
    });
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      sortIssues(sortSelect.value);
    });
  }
}

function filterIssues(searchTerm) {
  const issueCards = document.querySelectorAll('.issue-card');
  searchTerm = searchTerm.toLowerCase();

  issueCards.forEach(card => {
    const title = card.querySelector('.issue-title').textContent.toLowerCase();
    const description = card.querySelector('.issue-description').textContent.toLowerCase();
    const shouldShow = title.includes(searchTerm) || description.includes(searchTerm);
    
    card.style.display = shouldShow ? 'block' : 'none';
  });
}

function filterIssuesByCategory() {
  const activeFilters = Array.from(document.querySelectorAll('.category-filter.active'))
    .map(filter => filter.dataset.category);
  
  const categoryGroups = document.querySelectorAll('.category-group');
  
  if (activeFilters.length === 0) {
    categoryGroups.forEach(group => group.style.display = 'block');
    return;
  }

  categoryGroups.forEach(group => {
    const category = group.querySelector('.category-title').textContent.trim();
    group.style.display = activeFilters.includes(category) ? 'block' : 'none';
  });
}

function sortIssues(sortType) {
  const issuesList = document.getElementById('issues-list');
  const categoryGroups = Array.from(document.querySelectorAll('.category-group'));

  switch (sortType) {
    case 'newest':
      categoryGroups.forEach(group => {
        const cards = Array.from(group.querySelectorAll('.issue-card'));
        cards.sort((a, b) => {
          const dateA = new Date(a.querySelector('.issue-date').textContent);
          const dateB = new Date(b.querySelector('.issue-date').textContent);
          return dateB - dateA;
        });
        const grid = group.querySelector('.issues-grid');
        cards.forEach(card => grid.appendChild(card));
      });
      break;

    case 'oldest':
      categoryGroups.forEach(group => {
        const cards = Array.from(group.querySelectorAll('.issue-card'));
        cards.sort((a, b) => {
          const dateA = new Date(a.querySelector('.issue-date').textContent);
          const dateB = new Date(b.querySelector('.issue-date').textContent);
          return dateA - dateB;
        });
        const grid = group.querySelector('.issues-grid');
        cards.forEach(card => grid.appendChild(card));
      });
      break;

    case 'category':
      categoryGroups.sort((a, b) => {
        const categoryA = a.querySelector('.category-title').textContent;
        const categoryB = b.querySelector('.category-title').textContent;
        return categoryA.localeCompare(categoryB);
      });
      categoryGroups.forEach(group => issuesList.appendChild(group));
      break;
  }
}

function focusOnMap(coordinates) {
  map.flyTo({
    center: coordinates,
    zoom: 15,
    essential: true
  });
}

function shareIssue(issueId) {
  const url = `${window.location.origin}/issue/${issueId}`;
  
  if (navigator.share) {
    navigator.share({
      title: 'View Issue on Earth',
      text: 'Check out this issue on Earth',
      url: url
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(url)
      .then(() => showToast('Link copied to clipboard!', 'success'))
      .catch(() => showToast('Failed to copy link', 'error'));
  }
}

function setupIssueCreation() {
  const createIssueButton = document.getElementById('create-issue');
  if (!createIssueButton) {
    console.error('Create issue button not found');
    return;
  }

  createIssueButton.addEventListener('click', () => {
    if (!currentUser) {
      showToast('Please sign in to create an issue', 'warning');
      showAuthModal('sign-in');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal issue-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Create New Issue</h2>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <form id="issue-form">
            <div class="form-group">
              <label for="issue-title">Title</label>
              <input type="text" id="issue-title" required>
            </div>
            <div class="form-group">
              <label for="issue-category">Category</label>
              <select id="issue-category" required>
                <option value="Environment">Environment</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Safety">Safety</option>
                <option value="Community">Community</option>
                <option value="Education">Education</option>
                <option value="Health">Health</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label for="issue-description">Description</label>
              <textarea id="issue-description" required></textarea>
            </div>
            <div class="form-group">
              <label>Location</label>
              <div class="location-options">
                <button type="button" id="use-map-location" class="location-option">
                  <i class="fas fa-map-marker-alt"></i>
                  Click on Map
                </button>
                <button type="button" id="use-current-location" class="location-option">
                  <i class="fas fa-location-arrow"></i>
                  Current Location
                </button>
                <button type="button" id="search-location" class="location-option">
                  <i class="fas fa-search"></i>
                  Search Location
                </button>
              </div>
              <input type="text" id="selected-location" readonly>
              <input type="hidden" id="location-lat">
              <input type="hidden" id="location-lng">
            </div>
            <div class="form-actions">
              <button type="button" class="cancel-button">Cancel</button>
              <button type="submit" class="submit-button">Create Issue</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    const closeButton = modal.querySelector('.close-button');
    const cancelButton = modal.querySelector('.cancel-button');
    const form = modal.querySelector('#issue-form');
    const useMapLocation = modal.querySelector('#use-map-location');
    const useCurrentLocation = modal.querySelector('#use-current-location');
    const searchLocation = modal.querySelector('#search-location');

    const closeModal = () => {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), 300);
    };

    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    // Handle map location selection
    let mapClickListener;
    useMapLocation.addEventListener('click', () => {
      closeModal();
      showToast('Click on the map to select a location', 'info');
      
      // Change cursor to crosshair
      map.getCanvas().style.cursor = 'crosshair';
      
      // Add one-time click listener
      mapClickListener = (e) => {
        const { lng, lat } = e.lngLat;
        
        // Reverse geocode the location
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`)
          .then(response => response.json())
          .then(data => {
            const locationName = data.features[0]?.place_name || 'Unknown location';
            showIssueModal(locationName, lat, lng);
          })
          .catch(error => {
            console.error('Error getting location name:', error);
            showIssueModal('Unknown location', lat, lng);
          });

        // Remove click listener and reset cursor
        map.off('click', mapClickListener);
        map.getCanvas().style.cursor = '';
      };
      
      map.on('click', mapClickListener);
    });

    // Handle current location
    useCurrentLocation.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
      }

      useCurrentLocation.disabled = true;
      useCurrentLocation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode the location
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`)
            .then(response => response.json())
            .then(data => {
              const locationName = data.features[0]?.place_name || 'Unknown location';
              document.getElementById('selected-location').value = locationName;
              document.getElementById('location-lat').value = latitude;
              document.getElementById('location-lng').value = longitude;
            })
            .catch(error => {
              console.error('Error getting location name:', error);
              showToast('Error getting location name', 'error');
            })
            .finally(() => {
              useCurrentLocation.disabled = false;
              useCurrentLocation.innerHTML = '<i class="fas fa-location-arrow"></i> Current Location';
            });
        },
        (error) => {
          console.error('Error getting location:', error);
          showToast('Error getting your location', 'error');
          useCurrentLocation.disabled = false;
          useCurrentLocation.innerHTML = '<i class="fas fa-location-arrow"></i> Current Location';
        }
      );
    });

    // Handle location search
    searchLocation.addEventListener('click', () => {
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl
      });

      const searchModal = document.createElement('div');
      searchModal.className = 'modal search-modal';
      searchModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>Search Location</h2>
            <button class="close-button">&times;</button>
          </div>
          <div class="modal-body">
            <div id="geocoder" class="geocoder"></div>
          </div>
        </div>
      `;

      document.body.appendChild(searchModal);
      geocoder.addTo('#geocoder');

      geocoder.on('result', (e) => {
        const { place_name, center } = e.result;
        document.getElementById('selected-location').value = place_name;
        document.getElementById('location-lat').value = center[1];
        document.getElementById('location-lng').value = center[0];
        searchModal.remove();
      });

      searchModal.querySelector('.close-button').addEventListener('click', () => {
        searchModal.remove();
      });
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('issue-title').value;
      const category = document.getElementById('issue-category').value;
      const description = document.getElementById('issue-description').value;
      const locationName = document.getElementById('selected-location').value;
      const latitude = document.getElementById('location-lat').value;
      const longitude = document.getElementById('location-lng').value;

      if (!latitude || !longitude) {
        showToast('Please select a location', 'error');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('issues')
          .insert([
            {
              title,
              category,
              description,
              latitude: parseFloat(latitude),
              longitude: parseFloat(longitude),
              location_name: locationName,
              user_id: currentUser.id
            }
          ]);

        if (error) throw error;

        showToast('Issue created successfully!', 'success');
        closeModal();
        loadLocationIssues();
      } catch (error) {
        console.error('Error creating issue:', error);
        showToast('Error creating issue', 'error');
      }
    });

    // Animate modal in
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  });
}

// Helper function to show issue modal with location
function showIssueModal(locationName, lat, lng) {
  document.getElementById('selected-location').value = locationName;
  document.getElementById('location-lat').value = lat;
  document.getElementById('location-lng').value = lng;
}

