// Map configuration
const MAPBOX_TOKEN = 'pk.eyJ1IjoidXJpYWhhZGFtc21pdGgiLCJhIjoiY21hcmF5OGlxMDhyajJscTd2eWUwOWppYyJ9.QyRYVNllITqSNxXYixHgmw';

// Initialize Supabase
const SUPABASE_URL = 'https://acwnjyexyxtxtcdmmytr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd25qeWV4eXh0eHRjZG1teXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDg5NzQwMDAsImV4cCI6MjAyNDU1MDAwMH0.H7S8MhFp6E6uJ8ZHJ4JqJM2SQOqyM-mmVj5J3qa3CD4';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global state
let map; // Make map globally accessible
let currentLocation = {
  type: 'global',
  name: 'World',
  center: [0, 20]
};

// Initialize map when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Set Mapbox access token
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Check if Mapbox GL JS is supported
    if (!mapboxgl.supported()) {
      alert('Your browser does not support Mapbox GL JS. Please try a different browser.');
      return;
    }

    // Create the map
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [0, 20],
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

    // Wait for map to load before adding layers
    map.on('load', () => {
      console.log('Map loaded successfully');
      initializeMapLayers();
    });

    // Handle map errors
    map.on('error', (e) => {
      console.error('Map error:', e);
      showToast('Error loading map. Please refresh the page.', 'error');
    });

    setupEventListeners();
  } catch (error) {
    console.error('Error initializing map:', error);
    showToast('Error initializing map. Please refresh the page.', 'error');
  }
});

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

    // Load initial issues
    loadLocationIssues();
  } catch (error) {
    console.error('Error initializing map layers:', error);
    showToast('Error setting up map features. Please refresh the page.', 'error');
  }
}

function setupEventListeners() {
  try {
    // New Issue button
    const createIssueButton = document.getElementById('create-issue');
    const issueModal = document.getElementById('issue-modal');
    const issueForm = document.getElementById('issue-form');
    
    if (createIssueButton && issueModal) {
      createIssueButton.addEventListener('click', () => {
        console.log('Create Issue button clicked');
        if (issueForm) issueForm.reset();
        issueModal.classList.remove('hidden');
        issueModal.classList.add('show');
      });
    }

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

    // Handle issue form submission
    if (issueForm) {
      issueForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createNewIssue();
      });
    }

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

async function createNewIssue() {
  const title = document.getElementById('issue-title').value.trim();
  const description = document.getElementById('issue-description').value.trim();
  const category = document.getElementById('issue-category').value;
  const submitButton = document.querySelector('#issue-form .submit-button');
  const loadingOverlay = document.getElementById('loading-overlay');
  const issueModal = document.getElementById('issue-modal');

  // Validate inputs
  if (!title || !description || !category) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    // Show loading state
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    loadingOverlay.classList.remove('hidden');

    // Get current map center for location
    const center = map.getCenter();
    const zoom = map.getZoom();
    
    // Determine location type based on zoom level
    let locationType = 'global';
    if (zoom >= 6) {
      locationType = 'state';
    } else if (zoom >= 4) {
      locationType = 'country';
    } else if (zoom >= 2) {
      locationType = 'continent';
    }

    const { data, error } = await supabase
      .from('issues')
      .insert([
        {
          title,
          description,
          category,
          location_type: locationType,
          location_name: document.getElementById('current-location').textContent,
          latitude: center.lat,
          longitude: center.lng,
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) throw error;

    // Hide modal and reset form
    issueModal.classList.remove('show');
    issueModal.classList.add('hidden');
    document.getElementById('issue-form').reset();

    // Reload issues and show success message
    await loadLocationIssues();
    showToast('Issue created successfully!', 'success');
  } catch (error) {
    console.error('Error creating issue:', error);
    showToast(error.message || 'Failed to create issue', 'error');
  } finally {
    // Reset loading state
    submitButton.disabled = false;
    submitButton.classList.remove('loading');
    loadingOverlay.classList.add('hidden');
  }
}

async function loadLocationIssues() {
  if (!map) {
    console.error('Map not initialized');
    return;
  }

  try {
    const bounds = map.getBounds();
    
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .gte('latitude', bounds._sw.lat)
      .lte('latitude', bounds._ne.lat)
      .gte('longitude', bounds._sw.lng)
      .lte('longitude', bounds._ne.lng)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const features = issues.map(issue => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [issue.longitude, issue.latitude]
      },
      properties: {
        id: issue.id,
        title: issue.title,
        category: issue.category,
        description: issue.description,
        created_at: issue.created_at
      }
    }));

    if (map.getSource('issue-locations')) {
      map.getSource('issue-locations').setData({
        type: 'FeatureCollection',
        features: features
      });
    }

    // Update side panel
    displayIssues(issues);
  } catch (error) {
    console.error('Error loading issues:', error);
    showToast('Error loading issues', 'error');
  }
}

function displayIssues(issues) {
  const issuesList = document.getElementById('issues-list');
  if (!issuesList) return;

  issuesList.innerHTML = issues.map(issue => `
    <div class="issue-item">
      <div class="issue-header">
        <span class="category-tag">${issue.category}</span>
      </div>
      <h3>${issue.title}</h3>
      <p>${issue.description.substring(0, 150)}${issue.description.length > 150 ? '...' : ''}</p>
      <div class="issue-footer">
        <span class="issue-date">${new Date(issue.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');
}

function showIssueDetails(issue) {
  const issuesList = document.getElementById('issues-list');
  if (!issuesList) return;

  issuesList.innerHTML = `
    <div class="issue-detail">
      <h2>${issue.title}</h2>
      <span class="category-tag">${issue.category}</span>
      <p>${issue.description}</p>
    </div>
  `;
}

function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Add icon based on type
  const icon = document.createElement('i');
  icon.className = `fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}`;
  toast.appendChild(icon);
  
  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);
  
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Update location information based on zoom level
async function updateLocationInfo(zoom, center) {
  let locationName = 'World';
  const locationElement = document.getElementById('current-location');

  if (zoom >= 6) {
    // State level
    const info = await getLocationInfo(center, 'region');
    locationName = info.name || 'Unknown Region';
    currentLocation.type = 'state';
  } else if (zoom >= 4) {
    // Country level
    const info = await getLocationInfo(center, 'country');
    locationName = info.name || 'Unknown Country';
    currentLocation.type = 'country';
  } else if (zoom >= 2) {
    // Continent level
    locationName = getContinentFromCoordinates(center);
    currentLocation.type = 'continent';
  } else {
    currentLocation.type = 'global';
  }

  currentLocation.name = locationName;
  currentLocation.center = [center.lng, center.lat];

  if (locationElement) {
    locationElement.textContent = locationName;
  }
}

// Get location information from Mapbox
async function getLocationInfo(center, type) {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${center.lng},${center.lat}.json?types=${type}&access_token=${MAPBOX_TOKEN}`
    );
    const data = await response.json();
    return data.features[0] || { name: 'Unknown Location' };
  } catch (error) {
    console.error('Error getting location info:', error);
    return { name: 'Unknown Location' };
  }
}

// Helper function to get continent from coordinates
function getContinentFromCoordinates(center) {
  const lng = center.lng;
  const lat = center.lat;
  
  if (lat > 35) return 'North America';
  if (lat < -35) return 'South America';
  if (lng > -30 && lng < 60) return 'Europe/Africa';
  if (lng >= 60) return 'Asia/Oceania';
  return 'Unknown Continent';
}
