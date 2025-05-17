// Map module

const map = {
  // Map instance
  instance: null,
  
  // Current location state
  currentLocation: {
    type: 'global',
    name: 'World',
    center: CONFIG.MAP.DEFAULT_CENTER,
    bounds: null
  },
  
  // Initialize map
  async initialize() {
    try {
      // Create map instance
      this.instance = new mapboxgl.Map({
        container: 'map',
        style: CONFIG.MAP.STYLES.satellite,
        center: this.currentLocation.center,
        zoom: CONFIG.MAP.DEFAULT_ZOOM,
        projection: 'mercator',
        maxBounds: CONFIG.MAP.MAX_BOUNDS,
        renderWorldCopies: false
      });
      
      // Wait for map to load
      await new Promise((resolve, reject) => {
        this.instance.on('load', resolve);
        this.instance.on('error', reject);
      });
      
      // Add controls
      this.addControls();
      
      // Initialize layers
      this.initializeLayers();
      
      // Add event listeners
      this.setupEventListeners();
      
      // Load initial issues
      await this.loadIssues();
      
      return true;
    } catch (error) {
      console.error('Error initializing map:', error);
      utils.toast.show('Error initializing map', 'error');
      return false;
    }
  },
  
  // Add map controls
  addControls() {
    // Navigation control
    this.instance.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Scale control
    this.instance.addControl(new mapboxgl.ScaleControl(), 'bottom-left');
    
    // Fullscreen control
    this.instance.addControl(new mapboxgl.FullscreenControl());
    
    // Geocoder control
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      types: 'country,region',
      placeholder: 'Search for a location...'
    });
    this.instance.addControl(geocoder);
    
    // Style control
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
      this.instance.setStyle(CONFIG.MAP.STYLES[e.target.value]);
      this.instance.once('style.load', () => {
        this.initializeLayers();
      });
    });
    
    // Disable map rotation
    this.instance.dragRotate.disable();
    this.instance.touchZoomRotate.disableRotation();
  },
  
  // Initialize map layers
  initializeLayers() {
    // Add source for issue locations
    this.instance.addSource('issue-locations', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      },
      cluster: true,
      clusterMaxZoom: CONFIG.MAP.CLUSTER_MAX_ZOOM,
      clusterRadius: CONFIG.MAP.CLUSTER_RADIUS
    });
    
    // Add source for heatmap
    this.instance.addSource('issue-heat', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });
    
    // Add heatmap layer
    this.instance.addLayer({
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
    this.instance.addLayer({
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
    this.instance.addLayer({
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
    this.instance.addLayer({
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
  },
  
  // Set up event listeners
  setupEventListeners() {
    // Update location on map move
    this.instance.on('moveend', utils.debounce(() => {
      this.updateLocation();
    }));
    
    // Handle cluster click
    this.instance.on('click', 'clusters', (e) => {
      const features = this.instance.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties.cluster_id;
      
      this.instance.getSource('issue-locations').getClusterExpansionZoom(
        clusterId,
        (err, zoom) => {
          if (err) return;
          
          this.instance.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom
          });
        }
      );
    });
    
    // Handle unclustered point click
    this.instance.on('click', 'unclustered-point', (e) => {
      const coordinates = e.features[0].geometry.coordinates.slice();
      const properties = e.features[0].properties;
      
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }
      
      window.issues.showDetails(properties);
    });
    
    // Change cursor on hover
    this.instance.on('mouseenter', 'clusters', () => {
      this.instance.getCanvas().style.cursor = 'pointer';
    });
    this.instance.on('mouseleave', 'clusters', () => {
      this.instance.getCanvas().style.cursor = '';
    });
    
    this.instance.on('mouseenter', 'unclustered-point', () => {
      this.instance.getCanvas().style.cursor = 'pointer';
    });
    this.instance.on('mouseleave', 'unclustered-point', () => {
      this.instance.getCanvas().style.cursor = '';
    });
  },
  
  // Update location based on map position
  async updateLocation() {
    const zoom = this.instance.getZoom();
    const bounds = this.instance.getBounds();
    const center = this.instance.getCenter();
    
    let locationType = 'global';
    let locationName = 'World';
    
    if (zoom >= CONFIG.LOCATION.ZOOM_LEVELS.STATE) {
      locationType = 'state';
      const stateInfo = await api.locations.getInfo([center.lng, center.lat], 'region');
      locationName = stateInfo.place_name;
    } else if (zoom >= CONFIG.LOCATION.ZOOM_LEVELS.COUNTRY) {
      locationType = 'country';
      const countryInfo = await api.locations.getInfo([center.lng, center.lat], 'country');
      locationName = countryInfo.place_name;
    } else if (zoom >= CONFIG.LOCATION.ZOOM_LEVELS.CONTINENT) {
      locationType = 'continent';
      locationName = this.getContinentFromCoordinates(center);
    }
    
    this.currentLocation = {
      type: locationType,
      name: locationName,
      bounds: [
        [bounds._sw.lng, bounds._sw.lat],
        [bounds._ne.lng, bounds._ne.lat]
      ],
      center: [center.lng, center.lat]
    };
    
    // Update UI
    document.getElementById('current-location').textContent = locationName;
    
    // Load issues for new location
    await this.loadIssues();
  },
  
  // Load issues for current location
  async loadIssues() {
    try {
      const { issues } = await api.issues.getAll({
        bounds: this.currentLocation.bounds,
        type: this.currentLocation.type
      });
      
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
          created_at: issue.created_at,
          location_name: issue.location_name,
          username: issue.profiles?.username
        }
      }));
      
      // Update map sources
      this.instance.getSource('issue-locations').setData({
        type: 'FeatureCollection',
        features: features
      });
      
      this.instance.getSource('issue-heat').setData({
        type: 'FeatureCollection',
        features: features
      });
    } catch (error) {
      console.error('Error loading issues:', error);
      utils.toast.show('Error loading issues', 'error');
    }
  },
  
  // Helper function to get continent name from coordinates
  getContinentFromCoordinates(center) {
    // This is a simplified version. In a real app, you'd use a proper geocoding service
    // or a more accurate continent detection algorithm
    if (center.lat > 35) return 'North America';
    if (center.lat < -35) return 'South America';
    if (center.lng > 60) return 'Asia';
    if (center.lng < -30) return 'Europe';
    if (center.lng < -60) return 'Africa';
    return 'Unknown Continent';
  },
  
  // Public methods
  flyTo(coordinates, zoom = 15) {
    this.instance.flyTo({
      center: coordinates,
      zoom: zoom,
      essential: true
    });
  },
  
  resetView() {
    this.instance.flyTo({
      center: CONFIG.MAP.DEFAULT_CENTER,
      zoom: CONFIG.MAP.DEFAULT_ZOOM
    });
  }
};

// Export map module
window.map = map; 