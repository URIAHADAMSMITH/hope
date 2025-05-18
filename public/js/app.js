// Main application module

const app = {
  // Initialize application
  async initialize() {
    try {
      utils.loader.show();
      
      // Initialize network status monitoring
      utils.network.init();
      
      // Register service worker first
      await this.registerServiceWorker();
      
      // Load configuration
      const configLoaded = await loadConfig();
      if (!configLoaded) {
        throw new Error('Failed to load configuration');
      }

      // Initialize map after config is loaded
      const mapInitialized = await map.initialize();
      if (!mapInitialized) {
        throw new Error('Failed to initialize map');
      }
      
      // Initialize authentication
      const authInitialized = await auth.initialize();
      if (!authInitialized) {
        throw new Error('Failed to initialize authentication');
      }
      
      // Initialize issues last
      const issuesInitialized = await issues.initialize();
      if (!issuesInitialized) {
        throw new Error('Failed to initialize issues');
      }
      
      // Add keyboard shortcuts
      this.setupKeyboardShortcuts();
      
      // Add PWA support
      this.setupPWA();
      
      utils.loader.hide();
      return true;
    } catch (error) {
      console.error('Error initializing application:', error);
      utils.errorBoundary.show(error);
      utils.loader.hide();
      return false;
    }
  },
  
  // Register service worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Unregister any existing service workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }

        // Clear all caches
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );

        // Register new service worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('ServiceWorker registration successful');
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              utils.toast.show(
                'A new version is available! Click to update.',
                'info',
                true,
                () => window.location.reload()
              );
            }
          });
        });

        return true;
      } catch (error) {
        console.error('ServiceWorker registration failed:', error);
        return false;
      }
    }
    return true;
  },
  
  // Set up keyboard shortcuts
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle keyboard shortcuts if no modal is open and no input is focused
      if (document.querySelector('.modal') || 
          document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case 'n':
          // New issue
          if (auth.currentUser) {
            issues.showCreateModal();
          } else {
            utils.toast.show('Please sign in to create an issue', 'warning');
            auth.showAuthModal('sign-in');
          }
          break;
          
        case 'f':
          // Focus search
          document.getElementById('issue-search').focus();
          break;
          
        case 'r':
          // Reset map view
          map.resetView();
          break;
          
        case 'l':
          // Toggle list/grid view
          document.getElementById('issues-list').classList.toggle('grid-view');
          break;
          
        case '?':
          // Show keyboard shortcuts help
          this.showKeyboardShortcuts();
          break;
      }
    });
  },
  
  // Show keyboard shortcuts help
  showKeyboardShortcuts() {
    const modal = document.createElement('div');
    modal.className = 'modal keyboard-shortcuts-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <div class="shortcuts-grid">
            <div class="shortcut">
              <kbd>N</kbd>
              <span>Create new issue</span>
            </div>
            <div class="shortcut">
              <kbd>F</kbd>
              <span>Focus search</span>
            </div>
            <div class="shortcut">
              <kbd>R</kbd>
              <span>Reset map view</span>
            </div>
            <div class="shortcut">
              <kbd>L</kbd>
              <span>Toggle list/grid view</span>
            </div>
            <div class="shortcut">
              <kbd>?</kbd>
              <span>Show this help</span>
            </div>
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
  
  // Set up Progressive Web App support
  setupPWA() {
    // Handle "Add to Home Screen" event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      const deferredPrompt = e;
      
      // Show install button if not installed
      const installButton = document.createElement('button');
      installButton.className = 'install-button';
      installButton.innerHTML = '<i class="fas fa-download"></i> Install App';
      
      installButton.addEventListener('click', async () => {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          utils.toast.show('Thank you for installing Earth!', 'success');
        }
        
        installButton.remove();
      });
      
      document.querySelector('.app-header').appendChild(installButton);
    });
  }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  app.initialize().catch(error => {
    console.error('Fatal error initializing application:', error);
    utils.errorBoundary.show(error);
  });
}); 