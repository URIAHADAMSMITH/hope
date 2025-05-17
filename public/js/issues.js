// Issues module

const issues = {
  // State
  currentPage: 1,
  itemsPerPage: 10,
  totalItems: 0,
  activeFilters: new Set(),
  searchTerm: '',
  
  // Initialize issues module
  async initialize() {
    try {
      // Set up event listeners
      this.setupEventListeners();
      
      // Set up real-time updates
      this.setupRealtimeUpdates();
      
      // Load initial issues
      await this.loadIssues();
      
      return true;
    } catch (error) {
      console.error('Error initializing issues:', error);
      utils.toast.show('Error initializing issues', 'error');
      return false;
    }
  },
  
  // Set up event listeners
  setupEventListeners() {
    // Create issue button
    document.getElementById('create-issue').addEventListener('click', () => {
      if (!auth.currentUser) {
        utils.toast.show('Please sign in to create an issue', 'warning');
        auth.showAuthModal('sign-in');
        return;
      }
      this.showCreateModal();
    });
    
    // Search input
    const searchInput = document.getElementById('issue-search');
    searchInput.addEventListener('input', utils.debounce((e) => {
      this.searchTerm = e.target.value;
      this.filterIssues();
    }, CONFIG.UI.DEBOUNCE_DELAY));
    
    // Category filters
    this.initializeCategoryFilters();
    
    // Refresh button
    document.getElementById('refresh-issues').addEventListener('click', () => {
      this.loadIssues();
    });
    
    // View toggle
    document.getElementById('toggle-view').addEventListener('click', () => {
      document.getElementById('issues-list').classList.toggle('grid-view');
    });
  },
  
  // Initialize category filters
  initializeCategoryFilters() {
    const filtersContainer = document.getElementById('category-filters');
    
    Object.values(CONFIG.CATEGORIES).forEach(category => {
      const button = document.createElement('button');
      button.className = 'category-filter';
      button.dataset.category = category.id;
      button.innerHTML = `
        <i class="fas fa-${category.icon}"></i>
        ${category.label}
      `;
      
      button.addEventListener('click', () => {
        button.classList.toggle('active');
        if (button.classList.contains('active')) {
          this.activeFilters.add(category.id);
        } else {
          this.activeFilters.delete(category.id);
        }
        this.filterIssues();
      });
      
      filtersContainer.appendChild(button);
    });
  },
  
  // Set up real-time updates
  setupRealtimeUpdates() {
    api.issues.subscribe(payload => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      switch (eventType) {
        case 'INSERT':
          utils.toast.show('New issue added!', 'success');
          this.loadIssues();
          break;
          
        case 'UPDATE':
          utils.toast.show('Issue updated!', 'success');
          this.loadIssues();
          break;
          
        case 'DELETE':
          utils.toast.show('Issue deleted!', 'info');
          this.loadIssues();
          break;
      }
    });
  },
  
  // Load issues
  async loadIssues() {
    try {
      const { issues, total } = await api.issues.getAll({
        bounds: map.currentLocation.bounds,
        type: map.currentLocation.type,
        page: this.currentPage,
        perPage: this.itemsPerPage
      });
      
      this.totalItems = total;
      this.displayIssues(issues);
      this.updatePagination();
    } catch (error) {
      console.error('Error loading issues:', error);
      utils.toast.show('Error loading issues', 'error');
    }
  },
  
  // Display issues
  displayIssues(issues) {
    const issuesList = document.getElementById('issues-list');
    
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
            <i class="fas fa-${CONFIG.CATEGORIES[category.toUpperCase()]?.icon || 'dot-circle'}"></i>
          </span>
          ${category}
          <span class="category-count">${categoryIssues.length}</span>
        </h2>
        <div class="issues-grid">
          ${categoryIssues.map(issue => this.createIssueCard(issue)).join('')}
        </div>
      </div>
    `).join('');
    
    issuesList.innerHTML = issuesHTML || '<div class="no-issues">No issues found</div>';
  },
  
  // Create issue card HTML
  createIssueCard(issue) {
    const category = CONFIG.CATEGORIES[issue.category.toUpperCase()];
    return `
      <div class="issue-card" data-id="${issue.id}">
        <div class="issue-header">
          <span class="category-tag" style="background: ${category?.color || '#607D8B'}">
            <i class="fas fa-${category?.icon || 'dot-circle'}"></i>
            ${issue.category}
          </span>
          <span class="issue-date">${utils.dateUtils.timeAgo(issue.created_at)}</span>
        </div>
        <h3 class="issue-title">${issue.title}</h3>
        <p class="issue-description">${this.truncateText(issue.description, 150)}</p>
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
        <button class="view-details-btn" onclick="issues.showDetails(${JSON.stringify(issue)})">
          View Details
        </button>
      </div>
    `;
  },
  
  // Update pagination
  updatePagination() {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }
    
    let paginationHTML = `
      <button class="page-btn" 
        onclick="issues.changePage(1)" 
        ${this.currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-angle-double-left"></i>
      </button>
      <button class="page-btn" 
        onclick="issues.changePage(${this.currentPage - 1})" 
        ${this.currentPage === 1 ? 'disabled' : ''}>
        <i class="fas fa-angle-left"></i>
      </button>
    `;
    
    for (let i = Math.max(1, this.currentPage - 2); i <= Math.min(totalPages, this.currentPage + 2); i++) {
      paginationHTML += `
        <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
          onclick="issues.changePage(${i})">
          ${i}
        </button>
      `;
    }
    
    paginationHTML += `
      <button class="page-btn" 
        onclick="issues.changePage(${this.currentPage + 1})" 
        ${this.currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-angle-right"></i>
      </button>
      <button class="page-btn" 
        onclick="issues.changePage(${totalPages})" 
        ${this.currentPage === totalPages ? 'disabled' : ''}>
        <i class="fas fa-angle-double-right"></i>
      </button>
    `;
    
    pagination.innerHTML = paginationHTML;
  },
  
  // Change page
  async changePage(page) {
    this.currentPage = page;
    await this.loadIssues();
  },
  
  // Filter issues
  filterIssues() {
    const issueCards = document.querySelectorAll('.issue-card');
    const searchTerm = this.searchTerm.toLowerCase();
    
    issueCards.forEach(card => {
      const title = card.querySelector('.issue-title').textContent.toLowerCase();
      const description = card.querySelector('.issue-description').textContent.toLowerCase();
      const category = card.querySelector('.category-tag').textContent.trim().toLowerCase();
      
      const matchesSearch = !searchTerm || 
        title.includes(searchTerm) || 
        description.includes(searchTerm);
      
      const matchesFilter = this.activeFilters.size === 0 || 
        this.activeFilters.has(category);
      
      card.style.display = matchesSearch && matchesFilter ? 'block' : 'none';
    });
    
    // Update category groups visibility
    document.querySelectorAll('.category-group').forEach(group => {
      const hasVisibleIssues = group.querySelector('.issue-card[style="display: block"]');
      group.style.display = hasVisibleIssues ? 'block' : 'none';
    });
  },
  
  // Show issue details
  showDetails(issue) {
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
            <span class="category-tag large" style="background: ${CONFIG.CATEGORIES[issue.category.toUpperCase()]?.color || '#607D8B'}">
              <i class="fas fa-${CONFIG.CATEGORIES[issue.category.toUpperCase()]?.icon || 'dot-circle'}"></i>
              ${issue.category}
            </span>
            <span class="issue-date">
              <i class="fas fa-calendar"></i>
              ${utils.dateUtils.format(issue.created_at)}
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
            <button class="action-button" onclick="map.flyTo([${issue.longitude}, ${issue.latitude}])">
              <i class="fas fa-map-marked-alt"></i>
              Show on Map
            </button>
            <button class="action-button" onclick="issues.shareIssue('${issue.id}')">
              <i class="fas fa-share-alt"></i>
              Share
            </button>
            ${issue.user_id === auth.currentUser?.id ? `
              <button class="action-button warning" onclick="issues.deleteIssue('${issue.id}')">
                <i class="fas fa-trash-alt"></i>
                Delete
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), CONFIG.UI.ANIMATION_DURATION);
    });
    
    // Animate in
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  },
  
  // Show create issue modal
  showCreateModal() {
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
              <input type="text" id="issue-title" required maxlength="${CONFIG.VALIDATION.MAX_TITLE_LENGTH}">
              <small class="help-text">Maximum ${CONFIG.VALIDATION.MAX_TITLE_LENGTH} characters</small>
            </div>
            <div class="form-group">
              <label for="issue-category">Category</label>
              <select id="issue-category" required>
                ${Object.values(CONFIG.CATEGORIES).map(category => `
                  <option value="${category.id}">${category.label}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="issue-description">Description</label>
              <textarea id="issue-description" required maxlength="${CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH}"></textarea>
              <small class="help-text">Maximum ${CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH} characters</small>
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
    this.setupCreateModalListeners(modal);
    
    // Animate in
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  },
  
  // Set up create modal listeners
  setupCreateModalListeners(modal) {
    const closeButton = modal.querySelector('.close-button');
    const cancelButton = modal.querySelector('.cancel-button');
    const form = modal.querySelector('#issue-form');
    const useMapLocation = modal.querySelector('#use-map-location');
    const useCurrentLocation = modal.querySelector('#use-current-location');
    const searchLocation = modal.querySelector('#search-location');
    
    const closeModal = () => {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), CONFIG.UI.ANIMATION_DURATION);
    };
    
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    
    // Handle map location selection
    let mapClickListener;
    useMapLocation.addEventListener('click', () => {
      closeModal();
      utils.toast.show('Click on the map to select a location', 'info');
      
      // Change cursor to crosshair
      map.instance.getCanvas().style.cursor = 'crosshair';
      
      // Add one-time click listener
      mapClickListener = (e) => {
        const { lng, lat } = e.lngLat;
        
        // Reverse geocode the location
        api.locations.getInfo([lng, lat], 'region')
          .then(location => {
            this.showCreateModal();
            document.getElementById('selected-location').value = location.place_name;
            document.getElementById('location-lat').value = lat;
            document.getElementById('location-lng').value = lng;
          })
          .catch(error => {
            console.error('Error getting location name:', error);
            this.showCreateModal();
            document.getElementById('selected-location').value = 'Unknown location';
            document.getElementById('location-lat').value = lat;
            document.getElementById('location-lng').value = lng;
          });
        
        // Remove click listener and reset cursor
        map.instance.off('click', mapClickListener);
        map.instance.getCanvas().style.cursor = '';
      };
      
      map.instance.on('click', mapClickListener);
    });
    
    // Handle current location
    useCurrentLocation.addEventListener('click', () => {
      if (!navigator.geolocation) {
        utils.toast.show('Geolocation is not supported by your browser', 'error');
        return;
      }
      
      useCurrentLocation.disabled = true;
      useCurrentLocation.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          api.locations.getInfo([longitude, latitude], 'region')
            .then(location => {
              document.getElementById('selected-location').value = location.place_name;
              document.getElementById('location-lat').value = latitude;
              document.getElementById('location-lng').value = longitude;
            })
            .catch(error => {
              console.error('Error getting location name:', error);
              document.getElementById('selected-location').value = 'Unknown location';
              document.getElementById('location-lat').value = latitude;
              document.getElementById('location-lng').value = longitude;
            })
            .finally(() => {
              useCurrentLocation.disabled = false;
              useCurrentLocation.innerHTML = '<i class="fas fa-location-arrow"></i> Current Location';
            });
        },
        (error) => {
          console.error('Error getting location:', error);
          utils.toast.show('Error getting your location', 'error');
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
        utils.toast.show('Please select a location', 'error');
        return;
      }
      
      const issue = await api.issues.create({
        title,
        category,
        description,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        location_name: locationName
      });
      
      if (issue) {
        closeModal();
        map.flyTo([issue.longitude, issue.latitude]);
      }
    });
  },
  
  // Share issue
  async shareIssue(issueId) {
    const url = `${window.location.origin}/issue/${issueId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'View Issue on Earth',
          text: 'Check out this issue on Earth',
          url: url
        });
      } catch (error) {
        console.error('Error sharing:', error);
        await this.copyToClipboard(url);
      }
    } else {
      await this.copyToClipboard(url);
    }
  },
  
  // Copy to clipboard
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      utils.toast.show('Link copied to clipboard!', 'success');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      utils.toast.show('Failed to copy link', 'error');
    }
  },
  
  // Delete issue
  async deleteIssue(issueId) {
    if (confirm('Are you sure you want to delete this issue?')) {
      const success = await api.issues.delete(issueId);
      if (success) {
        document.querySelector(`.issue-detail-modal`)?.remove();
      }
    }
  },
  
  // Helper function to truncate text
  truncateText(text, length) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }
};

// Export issues module
window.issues = issues; 