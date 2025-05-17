// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://acwnjyexyxtxtcdmmytr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;

// Initialize Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Authentication state and handlers
let currentUser = null;
const SESSION_KEY = 'earth_session';
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

// Map configuration
mapboxgl.accessToken = MAPBOX_TOKEN;

// Location state
let currentLocation = {
  type: 'global', // 'global', 'continent', 'country', 'state'
  name: 'World',
  bounds: null,
  center: [0, 20]
};

// Initialize map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/satellite-streets-v12',
  center: currentLocation.center,
  zoom: 2,
  projection: 'mercator',
  maxBounds: [[-180, -85], [180, 85]],
  renderWorldCopies: false
});

// Add navigation controls
map.addControl(new mapboxgl.NavigationControl());

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

// Location detection based on zoom level
const ZOOM_LEVELS = {
  GLOBAL: 0,
  CONTINENT: 2,
  COUNTRY: 4,
  STATE: 6
};

// Global state
let isLoading = false;
let isOnline = navigator.onLine;

// Network status handlers
window.addEventListener('online', () => {
  isOnline = true;
  showToast('Back online');
  loadLocationPolls();
});

window.addEventListener('offline', () => {
  isOnline = false;
  showToast('You are offline', 'error');
});

// UI feedback functions
function showLoading(show = true) {
  isLoading = show;
  document.body.classList.toggle('loading', show);
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = show ? 'block' : 'none';
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Enhanced error handling
async function handleApiCall(apiCall, errorMessage) {
  if (!isOnline) {
    showToast('No internet connection', 'error');
    return null;
  }

  showLoading(true);
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    console.error(error);
    showToast(errorMessage || 'An error occurred', 'error');
    return null;
  } finally {
    showLoading(false);
  }
}

// Initialize location markers layer
map.on('load', () => {
  map.addSource('poll-locations', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    },
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50
  });

  // Add clusters layer
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'poll-locations',
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
    source: 'poll-locations',
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
    source: 'poll-locations',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#11b4da',
      'circle-radius': 8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    }
  });
});

// Update location info based on map movement
map.on('moveend', () => {
  const zoom = map.getZoom();
  const bounds = map.getBounds();
  const center = map.getCenter();
  
  updateLocationBasedOnZoom(zoom, bounds, center);
});

// Handle cluster click
map.on('click', 'clusters', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
  const clusterId = features[0].properties.cluster_id;
  map.getSource('poll-locations').getClusterExpansionZoom(
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

// Handle individual poll point click
map.on('click', 'unclustered-point', (e) => {
  const coordinates = e.features[0].geometry.coordinates.slice();
  const pollId = e.features[0].properties.pollId;
  
  while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
  }

  showPollDetails(pollId);
});

// Change cursor on hover
map.on('mouseenter', 'clusters', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'clusters', () => {
  map.getCanvas().style.cursor = '';
});

map.on('mouseenter', 'unclustered-point', () => {
  map.getCanvas().style.cursor = 'pointer';
});
map.on('mouseleave', 'unclustered-point', () => {
  map.getCanvas().style.cursor = '';
});

// Update location info and polls based on zoom level
async function updateLocationBasedOnZoom(zoom, bounds, center) {
  let locationType = 'global';
  let locationName = 'World';

  if (zoom >= ZOOM_LEVELS.STATE) {
    locationType = 'state';
    const stateInfo = await getLocationInfo(center, 'region');
    locationName = stateInfo.name;
  } else if (zoom >= ZOOM_LEVELS.COUNTRY) {
    locationType = 'country';
    const countryInfo = await getLocationInfo(center, 'country');
    locationName = countryInfo.name;
  } else if (zoom >= ZOOM_LEVELS.CONTINENT) {
    locationType = 'continent';
    locationName = getContinentFromCoordinates(center);
  }

  currentLocation = {
    type: locationType,
    name: locationName,
    bounds: bounds,
    center: [center.lng, center.lat]
  };

  // Update UI
  document.getElementById('current-location').textContent = locationName;
  
  // Load polls for the current location
  await loadLocationPolls();
  
  // Update poll markers on the map
  await updatePollMarkers();
}

// Get location information using Mapbox Geocoding API
async function getLocationInfo(center, type) {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${center.lng},${center.lat}.json?types=${type}&access_token=${mapboxgl.accessToken}`
  );
  const data = await response.json();
  return data.features[0] || { name: 'Unknown Location' };
}

// Cache configuration
const CACHE_CONFIG = {
  POLL_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  LOCATION_CACHE_DURATION: 30 * 60 * 1000, // 30 minutes
};

// Cache implementation
const cache = {
  polls: new Map(),
  locations: new Map(),
  
  set: function(key, value, duration) {
    const item = {
      value,
      expiry: Date.now() + duration
    };
    this.polls.set(key, item);
  },
  
  get: function(key) {
    const item = this.polls.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.polls.delete(key);
      return null;
    }
    return item.value;
  },
  
  clear: function() {
    this.polls.clear();
    this.locations.clear();
  }
};

// Pagination state
let paginationState = {
  currentPage: 1,
  itemsPerPage: 10,
  totalItems: 0
};

// Load polls with pagination and caching
async function loadLocationPolls(page = 1) {
  const cacheKey = `${currentLocation.type}-${currentLocation.name}-${page}`;
  const cachedPolls = cache.get(cacheKey);
  
  if (cachedPolls) {
    displayPolls(cachedPolls.polls);
    updatePagination(cachedPolls.total);
    return;
  }

  const result = await handleApiCall(async () => {
    let query = db
      .from('polls')
      .select('*', { count: 'exact' })
      .order('votes_count', { ascending: false })
      .range((page - 1) * paginationState.itemsPerPage, page * paginationState.itemsPerPage - 1);

    if (currentLocation.type !== 'global') {
      query = query
        .eq('location_type', currentLocation.type)
        .eq('location_name', currentLocation.name);
    }

    const { data: polls, error, count } = await query;
    if (error) throw error;
    
    cache.set(cacheKey, { polls, total: count }, CACHE_CONFIG.POLL_CACHE_DURATION);
    return { polls, total: count };
  }, 'Failed to load polls');

  if (result) {
    displayPolls(result.polls);
    updatePagination(result.total);
  }
}

// Update pagination UI
function updatePagination(totalItems) {
  paginationState.totalItems = totalItems;
  const totalPages = Math.ceil(totalItems / paginationState.itemsPerPage);
  
  const paginationContainer = document.getElementById('pagination');
  if (!paginationContainer) return;
  
  paginationContainer.innerHTML = `
    <button 
      class="pagination-btn" 
      onclick="changePage(${paginationState.currentPage - 1})"
      ${paginationState.currentPage <= 1 ? 'disabled' : ''}
    >
      Previous
    </button>
    <span class="pagination-info">
      Page ${paginationState.currentPage} of ${totalPages}
    </span>
    <button 
      class="pagination-btn" 
      onclick="changePage(${paginationState.currentPage + 1})"
      ${paginationState.currentPage >= totalPages ? 'disabled' : ''}
    >
      Next
    </button>
  `;
}

// Change page handler
async function changePage(newPage) {
  if (newPage < 1 || newPage > Math.ceil(paginationState.totalItems / paginationState.itemsPerPage)) {
    return;
  }
  
  paginationState.currentPage = newPage;
  await loadLocationPolls(newPage);
}

// Update poll markers on the map
async function updatePollMarkers() {
  try {
    const { data: polls, error } = await db
      .from('polls')
      .select('*')
      .in('location_type', [currentLocation.type, 'global']);

    if (error) throw error;

    const features = (polls || []).map(poll => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [poll.longitude, poll.latitude]
      },
      properties: {
        pollId: poll.id,
        title: poll.title,
        category: poll.category,
        votes_count: poll.votes_count
      }
    }));

    map.getSource('poll-locations').setData({
      type: 'FeatureCollection',
      features: features
    });
  } catch (error) {
    console.error('Error updating poll markers:', error);
  }
}

// Sanitize user input
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Display polls in the side panel
function displayPolls(polls) {
  const pollsList = document.getElementById('issues-list');
  pollsList.innerHTML = polls.map(poll => `
    <div class="poll-item" onclick="showPollDetails('${sanitizeHTML(poll.id)}')">
      <div class="poll-header">
        <span class="category-tag">${sanitizeHTML(poll.category)}</span>
        <span class="location-tag">${sanitizeHTML(poll.location_name)}</span>
      </div>
      <h3>${sanitizeHTML(poll.title)}</h3>
      <p>${sanitizeHTML(poll.description.substring(0, 150))}${poll.description.length > 150 ? '...' : ''}</p>
      <div class="poll-footer">
        <div class="poll-stats">
          <span><i class="fas fa-vote-yea"></i> ${sanitizeHTML(String(poll.votes_count || 0))}</span>
          <span><i class="fas fa-comments"></i> ${sanitizeHTML(String(poll.comments_count || 0))}</span>
        </div>
        <span class="poll-date">${new Date(poll.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');
}

// Show poll details
async function showPollDetails(pollId) {
  try {
    const { data: poll, error } = await db
      .from('polls')
      .select('*')
      .eq('id', pollId)
      .single();

    if (error) throw error;

    const discussionContainer = document.getElementById('discussion-container');
    discussionContainer.innerHTML = `
      <div class="poll-details">
        <h2>${poll.title}</h2>
        <p>${poll.description}</p>
        <div class="poll-options">
          ${poll.options.map(option => `
            <button class="vote-option" onclick="castVote('${pollId}', '${option}')" ${!currentUser ? 'disabled' : ''}>
              ${option}
              <span class="vote-count">${poll.votes[option] || 0}</span>
            </button>
          `).join('')}
        </div>
        <div class="poll-meta">
          <span><i class="fas fa-map-marker-alt"></i> ${poll.location_name}</span>
          <span><i class="fas fa-calendar"></i> ${new Date(poll.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error loading poll details:', error);
  }
}

// Cast a vote
const voteThrottle = new Map();
async function castVote(pollId, option) {
  if (!currentUser) {
    showToast('Please sign in to vote', 'error');
    return;
  }

  const throttleKey = `${currentUser.id}-${pollId}`;
  const lastVote = voteThrottle.get(throttleKey);
  if (lastVote && Date.now() - lastVote < 1000) {
    showToast('Please wait before voting again', 'warning');
    return;
  }

  // Get current poll state
  const pollElement = document.querySelector(`[data-poll-id="${pollId}"]`);
  const currentVoteCount = parseInt(pollElement.querySelector(`[data-option="${option}"]`).dataset.votes);

  // Optimistically update UI
  pollElement.querySelector(`[data-option="${option}"]`).dataset.votes = currentVoteCount + 1;
  updateVoteDisplay(pollElement, option);

  const result = await handleApiCall(async () => {
    const { error } = await db.from('votes').insert({
      poll_id: pollId,
      user_id: currentUser.id,
      option: option,
      created_at: new Date().toISOString()
    });

    if (error) throw error;
    voteThrottle.set(throttleKey, Date.now());
    return true;
  }, 'Failed to cast vote');

  if (!result) {
    // Revert optimistic update on failure
    pollElement.querySelector(`[data-option="${option}"]`).dataset.votes = currentVoteCount;
    updateVoteDisplay(pollElement, option);
  } else {
    showToast('Vote recorded successfully');
    // Clear cache for this poll
    cache.polls.delete(`poll-${pollId}`);
    // Refresh poll details in background
    loadLocationPolls(paginationState.currentPage);
  }
}

// Update vote display
function updateVoteDisplay(pollElement, option) {
  const voteCount = parseInt(pollElement.querySelector(`[data-option="${option}"]`).dataset.votes);
  pollElement.querySelector(`[data-option="${option}"] .vote-count`).textContent = voteCount;
}

// Helper function to get continent from coordinates
function getContinentFromCoordinates(center) {
  // This is a simplified version. You might want to use a more accurate method
  const lng = center.lng;
  const lat = center.lat;
  
  if (lat > 35) return 'North America';
  if (lat < -35) return 'South America';
  if (lng > -30 && lng < 60) return 'Europe/Africa';
  if (lng >= 60) return 'Asia/Oceania';
  return 'Unknown Continent';
}

// Event listeners
document.getElementById('zoom-out').addEventListener('click', () => {
  map.flyTo({
    center: [0, 20],
    zoom: 2
  });
});

// Session management
function saveSession(session) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function loadSession() {
  const savedSession = localStorage.getItem(SESSION_KEY);
  return savedSession ? JSON.parse(savedSession) : null;
}

// Enhanced authentication
async function handleAuth(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const isLogin = document.getElementById('auth-title').textContent === 'Sign In';

  if (!email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }

  if (!isLogin && !PASSWORD_REGEX.test(password)) {
    showToast('Password must be at least 8 characters and contain letters, numbers, and special characters', 'error');
    return;
  }

  const result = await handleApiCall(async () => {
    const { data, error } = isLogin
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({ email, password });

    if (error) throw error;
    return data;
  }, isLogin ? 'Sign in failed' : 'Registration failed');

  if (result?.user) {
    currentUser = result.user;
    saveSession(result.session);
    updateAuthUI();
    closeModal(document.getElementById('auth-modal'));
    showToast(isLogin ? 'Signed in successfully' : 'Registration successful');
  }
}

// Sign out handler
async function handleSignOut() {
  const result = await handleApiCall(async () => {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    return true;
  }, 'Sign out failed');

  if (result) {
    currentUser = null;
    saveSession(null);
    updateAuthUI();
    showToast('Signed out successfully');
  }
}

// Update UI based on auth state
function updateAuthUI() {
  const authButtons = document.getElementById('auth-buttons');
  const userInfo = document.getElementById('user-info');
  
  if (currentUser) {
    authButtons.style.display = 'none';
    userInfo.style.display = 'flex';
    userInfo.querySelector('.user-email').textContent = currentUser.email;
  } else {
    authButtons.style.display = 'flex';
    userInfo.style.display = 'none';
  }
}

// Initialize authentication
async function initializeAuth() {
  const savedSession = loadSession();
  if (savedSession) {
    const { data: { session }, error } = await db.auth.getSession();
    if (!error && session) {
      currentUser = session.user;
      saveSession(session);
      updateAuthUI();
    } else {
      saveSession(null);
    }
  }
}

// Event listeners
document.getElementById('auth-form').addEventListener('submit', handleAuth);
document.getElementById('sign-out-button').addEventListener('click', handleSignOut);

// Initialize auth on load
initializeAuth();

// Initialize
loadLocationPolls();
