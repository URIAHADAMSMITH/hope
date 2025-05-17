// Map configuration
const MAPBOX_TOKEN = 'pk.eyJ1IjoidXJpYWhhZGFtc21pdGgiLCJhIjoiY21hcmF5OGlxMDhyajJscTd2eWUwOWppYyJ9.QyRYVNllITqSNxXYixHgmw';
mapboxgl.accessToken = MAPBOX_TOKEN;

// Initialize Supabase
const SUPABASE_URL = 'https://acwnjyexyxtxtcdmmytr.supabase.co';
const SUPABASE_KEY = 'your_supabase_key_here'; // You'll need to provide this
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global state
let currentLocation = {
  type: 'global',
  name: 'World',
  center: [0, 20]
};

// Initialize map when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeMap();
  setupEventListeners();
});

function initializeMap() {
  // Create the map
  const map = new mapboxgl.Map({
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
    accessToken: MAPBOX_TOKEN,
    mapboxgl: mapboxgl,
    types: 'country,region',
    placeholder: 'Search for a location...'
  });
  map.addControl(geocoder);

  // Initialize map layers when the map loads
  map.on('load', () => {
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
    loadLocationIssues(map);
  });

  // Update location info based on map movement
  map.on('moveend', () => {
    const zoom = map.getZoom();
    const center = map.getCenter();
    updateLocationInfo(zoom, center);
    loadLocationIssues(map);
  });

  // Handle cluster click
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

  // Handle individual issue point click
  map.on('click', 'unclustered-point', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice();
    const issue = e.features[0].properties;
    
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    showIssueDetails(issue);
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

  return map;
}

function setupEventListeners() {
  // New Issue button
  const createIssueButton = document.getElementById('create-issue');
  const issueModal = document.getElementById('issue-modal');
  
  if (createIssueButton) {
    createIssueButton.addEventListener('click', () => {
      issueModal.classList.remove('hidden');
    });
  }

  // Close modal when clicking cancel
  const cancelButtons = document.querySelectorAll('.cancel-button');
  cancelButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = e.target.closest('.modal');
      if (modal) {
        modal.classList.add('hidden');
      }
    });
  });

  // Handle issue form submission
  const issueForm = document.getElementById('issue-form');
  if (issueForm) {
    issueForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await createNewIssue();
    });
  }
}

async function createNewIssue() {
  const title = document.getElementById('issue-title').value;
  const description = document.getElementById('issue-description').value;
  const category = document.getElementById('issue-category').value;

  try {
    const { data, error } = await supabase
      .from('issues')
      .insert([
        {
          title,
          description,
          category,
          location_type: currentLocation.type,
          location_name: currentLocation.name,
          latitude: currentLocation.center[1],
          longitude: currentLocation.center[0],
          created_at: new Date().toISOString()
        }
      ]);

    if (error) throw error;

    // Hide modal and reset form
    document.getElementById('issue-modal').classList.add('hidden');
    document.getElementById('issue-form').reset();

    // Reload issues
    loadLocationIssues(map);
    showToast('Issue created successfully!');
  } catch (error) {
    console.error('Error creating issue:', error);
    showToast('Failed to create issue', 'error');
  }
}

async function loadLocationIssues(map) {
  try {
    const bounds = map.getBounds();
    
    const { data: issues, error } = await supabase
      .from('issues')
      .select('*')
      .gte('latitude', bounds._sw.lat)
      .lte('latitude', bounds._ne.lat)
      .gte('longitude', bounds._sw.lng)
      .lte('longitude', bounds._ne.lng);

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
        description: issue.description
      }
    }));

    map.getSource('issue-locations').setData({
      type: 'FeatureCollection',
      features: features
    });

    // Update side panel
    displayIssues(issues);
  } catch (error) {
    console.error('Error loading issues:', error);
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
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
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
