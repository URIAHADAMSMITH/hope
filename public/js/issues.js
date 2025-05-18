// Issues management module
const issues = {
  // State
  currentIssues: [],
  filters: {
    category: null,
    search: '',
    location: null
  },
  
  // Initialize issues module
  async initialize() {
    try {
      // Set up event listeners
      this.setupEventListeners();
      
      // Load initial issues
      await this.loadIssues();
      
      return true;
    } catch (error) {
      console.error('Error initializing issues:', error);
      return false;
    }
  },
  
  // Set up event listeners
  setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('issue-search');
    searchInput.addEventListener('input', utils.debounce(() => {
      this.filters.search = searchInput.value;
      this.loadIssues();
    }, CONFIG.UI.DEBOUNCE_DELAY));
    
    // Category filters
    const categoryFilters = document.getElementById('category-filters');
    Object.values(CONFIG.CATEGORIES).forEach(category => {
      const button = document.createElement('button');
      button.className = 'category-filter';
      button.dataset.category = category.id;
      button.innerHTML = `<i class="fas fa-${category.icon}"></i> ${category.label}`;
      button.style.setProperty('--category-color', category.color);
      
      button.addEventListener('click', () => {
        this.filters.category = this.filters.category === category.id ? null : category.id;
        this.updateCategoryFilters();
        this.loadIssues();
      });
      
      categoryFilters.appendChild(button);
    });
    
    // Create issue button
    document.getElementById('create-issue').addEventListener('click', () => {
      if (auth.currentUser) {
        this.showCreateModal();
      } else {
        utils.toast.show('Please sign in to create an issue', 'warning');
        auth.showAuthModal('sign-in');
      }
    });
  },
  
  // Load issues based on current filters
  async loadIssues() {
    try {
      utils.loader.show();
      
      // Build query
      const query = db
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Apply filters
      if (this.filters.category) {
        query.eq('category', this.filters.category);
      }
      
      if (this.filters.search) {
        query.or(`title.ilike.%${this.filters.search}%,description.ilike.%${this.filters.search}%`);
      }
      
      if (this.filters.location) {
        // Add location-based filtering
        const [lng, lat] = this.filters.location;
        query.filter('location', 'near', lng, lat);
      }
      
      const { data: issues, error } = await query;
      
      if (error) throw error;
      
      this.currentIssues = issues;
      this.renderIssues();
      map.updateMarkers(issues);
      
      utils.loader.hide();
    } catch (error) {
      console.error('Error loading issues:', error);
      utils.toast.show('Failed to load issues', 'error');
      utils.loader.hide();
    }
  },
  
  // Render issues list
  renderIssues() {
    const issuesList = document.getElementById('issues-list');
    issuesList.innerHTML = '';
    
    if (this.currentIssues.length === 0) {
      issuesList.innerHTML = `
        <div class="no-issues">
          <i class="fas fa-search"></i>
          <p>No issues found</p>
        </div>
      `;
      return;
    }
    
    this.currentIssues.forEach(issue => {
      const category = CONFIG.CATEGORIES[issue.category.toUpperCase()];
      const card = document.createElement('div');
      card.className = 'issue-card';
      card.innerHTML = `
        <div class="issue-header">
          <span class="category-tag" style="--category-color: ${category.color}">
            <i class="fas fa-${category.icon}"></i>
            ${category.label}
          </span>
          <span class="issue-date">${utils.formatDate(issue.created_at)}</span>
        </div>
        <h3 class="issue-title">${utils.escapeHtml(issue.title)}</h3>
        <p class="issue-description">${utils.escapeHtml(issue.description)}</p>
        <div class="issue-footer">
          <button class="vote-button ${issue.voted ? 'voted' : ''}" data-issue-id="${issue.id}">
            <i class="fas fa-arrow-up"></i>
            <span>${issue.votes || 0}</span>
          </button>
          <button class="comment-button" data-issue-id="${issue.id}">
            <i class="fas fa-comment"></i>
            <span>${issue.comments || 0}</span>
          </button>
        </div>
      `;
      
      // Add event listeners
      const voteButton = card.querySelector('.vote-button');
      voteButton.addEventListener('click', async () => {
        if (!auth.currentUser) {
          utils.toast.show('Please sign in to vote', 'warning');
          auth.showAuthModal('sign-in');
          return;
        }
        
        try {
          const { data, error } = await db
            .from('votes')
            .upsert({ 
              issue_id: issue.id,
              user_id: auth.currentUser.id
            });
            
          if (error) throw error;
          
          issue.voted = !issue.voted;
          issue.votes = issue.voted ? (issue.votes || 0) + 1 : (issue.votes || 1) - 1;
          voteButton.classList.toggle('voted');
          voteButton.querySelector('span').textContent = issue.votes;
        } catch (error) {
          console.error('Error voting:', error);
          utils.toast.show('Failed to register vote', 'error');
        }
      });
      
      const commentButton = card.querySelector('.comment-button');
      commentButton.addEventListener('click', () => {
        this.showCommentModal(issue);
      });
      
      issuesList.appendChild(card);
    });
  },
  
  // Update category filter UI
  updateCategoryFilters() {
    const buttons = document.querySelectorAll('.category-filter');
    buttons.forEach(button => {
      button.classList.toggle('active', button.dataset.category === this.filters.category);
    });
  },
  
  // Show create issue modal
  showCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal create-issue-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Create New Issue</h2>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <form id="create-issue-form">
            <div class="form-group">
              <label for="issue-title">Title</label>
              <input type="text" id="issue-title" required maxlength="${CONFIG.VALIDATION.MAX_TITLE_LENGTH}">
            </div>
            <div class="form-group">
              <label for="issue-description">Description</label>
              <textarea id="issue-description" required maxlength="${CONFIG.VALIDATION.MAX_DESCRIPTION_LENGTH}"></textarea>
            </div>
            <div class="form-group">
              <label for="issue-category">Category</label>
              <select id="issue-category" required>
                ${Object.values(CONFIG.CATEGORIES)
                  .map(category => `<option value="${category.id}">${category.label}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="issue-location">Location</label>
              <div id="location-picker" class="location-picker"></div>
            </div>
            <button type="submit" class="primary-button">Create Issue</button>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Initialize location picker
    const locationPicker = new mapboxgl.Map({
      container: 'location-picker',
      style: CONFIG.MAP.STYLES.streets,
      center: map.getCenter(),
      zoom: map.getZoom(),
      interactive: true
    });
    
    const marker = new mapboxgl.Marker({
      draggable: true
    }).setLngLat(map.getCenter())
      .addTo(locationPicker);
    
    // Add geocoder
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false
    });
    locationPicker.addControl(geocoder);
    
    // Handle form submission
    const form = document.getElementById('create-issue-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      try {
        const location = marker.getLngLat();
        const { data, error } = await db
          .from('issues')
          .insert({
            title: form.querySelector('#issue-title').value,
            description: form.querySelector('#issue-description').value,
            category: form.querySelector('#issue-category').value,
            location: `POINT(${location.lng} ${location.lat})`,
            user_id: auth.currentUser.id
          });
          
        if (error) throw error;
        
        utils.toast.show('Issue created successfully', 'success');
        modal.remove();
        this.loadIssues();
      } catch (error) {
        console.error('Error creating issue:', error);
        utils.toast.show('Failed to create issue', 'error');
      }
    });
    
    // Handle close button
    const closeButton = modal.querySelector('.close-button');
    closeButton.addEventListener('click', () => {
      modal.classList.add('fade-out');
      setTimeout(() => {
        modal.remove();
        locationPicker.remove();
      }, CONFIG.UI.ANIMATION_DURATION);
    });
    
    // Animate in
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  },
  
  // Show comment modal
  showCommentModal(issue) {
    const modal = document.createElement('div');
    modal.className = 'modal comment-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Comments</h2>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <div id="comments-list" class="comments-list">
            <div class="loading">Loading comments...</div>
          </div>
          <form id="comment-form" class="comment-form">
            <textarea id="comment-text" required placeholder="Add a comment..."></textarea>
            <button type="submit" class="primary-button">Post</button>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load comments
    this.loadComments(issue.id);
    
    // Handle form submission
    const form = document.getElementById('comment-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!auth.currentUser) {
        utils.toast.show('Please sign in to comment', 'warning');
        auth.showAuthModal('sign-in');
        return;
      }
      
      try {
        const { data, error } = await db
          .from('comments')
          .insert({
            issue_id: issue.id,
            user_id: auth.currentUser.id,
            content: form.querySelector('#comment-text').value
          });
          
        if (error) throw error;
        
        form.reset();
        this.loadComments(issue.id);
        
        // Update comment count
        issue.comments = (issue.comments || 0) + 1;
        this.renderIssues();
      } catch (error) {
        console.error('Error posting comment:', error);
        utils.toast.show('Failed to post comment', 'error');
      }
    });
    
    // Handle close button
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
  
  // Load comments for an issue
  async loadComments(issueId) {
    const commentsList = document.getElementById('comments-list');
    
    try {
      const { data: comments, error } = await db
        .from('comments')
        .select(`
          *,
          users (
            id,
            username,
            avatar_url
          )
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;
      
      commentsList.innerHTML = comments.length ? '' : '<div class="no-comments">No comments yet</div>';
      
      comments.forEach(comment => {
        const div = document.createElement('div');
        div.className = 'comment';
        div.innerHTML = `
          <div class="comment-header">
            <img src="${comment.users.avatar_url || '/assets/default-avatar.png'}" alt="Avatar" class="avatar">
            <span class="username">${utils.escapeHtml(comment.users.username)}</span>
            <span class="date">${utils.formatDate(comment.created_at)}</span>
          </div>
          <div class="comment-content">${utils.escapeHtml(comment.content)}</div>
        `;
        commentsList.appendChild(div);
      });
    } catch (error) {
      console.error('Error loading comments:', error);
      commentsList.innerHTML = '<div class="error">Failed to load comments</div>';
    }
  }
};

// Export module
window.issues = issues; 