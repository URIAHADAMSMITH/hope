// Utility functions for the Earth application

// Cache implementation with LRU (Least Recently Used) strategy
class Cache {
  constructor(maxItems = CONFIG.CACHE.MAX_ITEMS) {
    this.maxItems = maxItems;
    this.cache = new Map();
  }

  set(key, value, duration) {
    // Remove oldest item if cache is full
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + duration
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Move item to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  clear() {
    this.cache.clear();
  }
}

// Create global cache instances
window.issueCache = new Cache();
window.locationCache = new Cache();

// Utility functions
const utils = {
  // Logger utility
  logger: {
    error: (error, context = '') => {
      console.error(`[Earth Error] ${context}:`, error);
      // You could also send errors to a monitoring service here
    },
    info: (message, data = '') => {
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[Earth Info] ${message}:`, data);
      }
    },
    warn: (message, data = '') => {
      console.warn(`[Earth Warning] ${message}:`, data);
    }
  },

  // Loading indicator
  loader: {
    count: 0,
    show: () => {
      const overlay = document.getElementById('loading-overlay');
      utils.loader.count++;
      if (utils.loader.count === 1) {
        overlay.classList.remove('hidden');
      }
    },
    hide: () => {
      const overlay = document.getElementById('loading-overlay');
      utils.loader.count = Math.max(0, utils.loader.count - 1);
      if (utils.loader.count === 0) {
        overlay.classList.add('hidden');
      }
    },
    reset: () => {
      const overlay = document.getElementById('loading-overlay');
      utils.loader.count = 0;
      overlay.classList.add('hidden');
    }
  },

  // Toast notifications
  toast: {
    show: (message, type = 'info', persistent = false, onClick = null) => {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
        <div class="toast-content">
          <i class="fas ${utils.toast.getIcon(type)}"></i>
          <span>${message}</span>
        </div>
      `;

      if (onClick) {
        toast.style.cursor = 'pointer';
        toast.addEventListener('click', onClick);
      }

      container.appendChild(toast);

      if (!persistent) {
        setTimeout(() => {
          toast.classList.add('fade-out');
          setTimeout(() => toast.remove(), 300);
        }, 3000);
      }
    },
    getIcon: (type) => {
      const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
      };
      return icons[type] || icons.info;
    }
  },

  // Error boundary
  errorBoundary: {
    show: (error) => {
      utils.logger.error(error, 'Error Boundary');
      const boundary = document.getElementById('error-boundary');
      const message = document.getElementById('error-message');
      boundary.classList.remove('hidden');
      message.textContent = error.message || 'An unexpected error occurred';
    },
    hide: () => {
      const boundary = document.getElementById('error-boundary');
      boundary.classList.add('hidden');
    }
  },

  // Network status
  network: {
    isOnline: navigator.onLine,
    init: () => {
      const updateOnlineStatus = () => {
        const indicator = document.getElementById('offline-indicator');
        if (navigator.onLine) {
          indicator.classList.add('hidden');
          utils.toast.show('You are back online!', 'success');
        } else {
          indicator.classList.remove('hidden');
          utils.toast.show('You are offline. Some features may be limited.', 'warning', true);
        }
      };

      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);
      updateOnlineStatus();
    }
  },

  // Form validation
  validate: {
    required: (value) => {
      return value && value.trim().length > 0;
    },
    email: (email) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    length: (value, min, max) => {
      const length = value.trim().length;
      return length >= min && length <= max;
    }
  },

  // Security
  security: {
    sanitizeInput: (input) => {
      const div = document.createElement('div');
      div.textContent = input;
      return div.innerHTML;
    },
    validateOrigin: () => {
      return window.location.origin === 'https://voteearth.glitch.me';
    }
  },

  // Date formatting
  formatDate: (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  },

  // Helper functions
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle: (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
};

// Export utilities
window.utils = utils; 