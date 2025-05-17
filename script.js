// Map configuration
const MAPBOX_TOKEN = 'pk.eyJ1IjoidXJpYWhhZGFtc21pdGgiLCJhIjoiY21hcmF5OGlxMDhyajJscTd2eWUwOWppYyJ9.QyRYVNllITqSNxXYixHgmw';
mapboxgl.accessToken = MAPBOX_TOKEN;

// Initialize map when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeMap();
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
    // Add source for poll locations
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
    updateLocationInfo(zoom, center);
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

  // Change cursor on hover
  map.on('mouseenter', 'clusters', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'clusters', () => {
    map.getCanvas().style.cursor = '';
  });

  // Handle zoom out button click
  const zoomOutButton = document.getElementById('zoom-out');
  if (zoomOutButton) {
    zoomOutButton.addEventListener('click', () => {
      map.flyTo({
        center: [0, 20],
        zoom: 2
      });
    });
  }
}

// Update location information based on zoom level
async function updateLocationInfo(zoom, center) {
  let locationName = 'World';
  const locationElement = document.getElementById('current-location');

  if (zoom >= 6) {
    // State level
    const info = await getLocationInfo(center, 'region');
    locationName = info.name || 'Unknown Region';
  } else if (zoom >= 4) {
    // Country level
    const info = await getLocationInfo(center, 'country');
    locationName = info.name || 'Unknown Country';
  } else if (zoom >= 2) {
    // Continent level
    locationName = getContinentFromCoordinates(center);
  }

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
