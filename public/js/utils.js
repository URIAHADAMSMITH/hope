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

// Debounce function
function debounce(func, wait = CONFIG.UI.DEBOUNCE_DELAY) {
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

// Throttle function
function throttle(func, limit = CONFIG.UI.THROTTLE_DELAY) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Toast notifications
const toast = {
  container: document.getElementById('toast-container'),
  
  show(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas ${this.getIcon(type)}"></i>
        <span>${message}</span>
      </div>
    `;
    
    this.container.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Remove after delay
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), CONFIG.UI.ANIMATION_DURATION);
    }, CONFIG.UI.TOAST_DURATION);
  },
  
  getIcon(type) {
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    return icons[type] || icons.info;
  }
};

// Loading indicator
const loader = {
  overlay: document.getElementById('loading-overlay'),
  count: 0,
  
  show() {
    this.count++;
    if (this.count === 1) {
      this.overlay.classList.remove('hidden');
    }
  },
  
  hide() {
    this.count = Math.max(0, this.count - 1);
    if (this.count === 0) {
      this.overlay.classList.add('hidden');
    }
  },
  
  reset() {
    this.count = 0;
    this.overlay.classList.add('hidden');
  }
};

// Error boundary
const errorBoundary = {
  container: document.getElementById('error-boundary'),
  messageElement: document.getElementById('error-message'),
  
  show(error) {
    this.messageElement.textContent = error.message || 'An unexpected error occurred';
    this.container.classList.remove('hidden');
  },
  
  hide() {
    this.container.classList.add('hidden');
  }
};

// Date formatting
const dateUtils = {
  format(date) {
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(new Date(date));
  },
  
  timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
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
};

// Form validation
const validation = {
  password(value) {
    return {
      isValid: CONFIG.VALIDATION.PASSWORD_REGEX.test(value),
      requirements: CONFIG.VALIDATION.PASSWORD_REQUIREMENTS.map(req => ({
        text: req,
        met: this.checkRequirement(value, req)
      }))
    };
  },
  
  checkRequirement(password, requirement) {
    switch (requirement) {
      case 'At least 8 characters':
        return password.length >= 8;
      case 'At least one letter':
        return /[A-Za-z]/.test(password);
      case 'At least one number':
        return /\d/.test(password);
      case 'At least one special character':
        return /[@$!%*#?&]/.test(password);
      default:
        return false;
    }
  },
  
  email(value) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }
};

// Network status
const network = {
  isOnline: navigator.onLine,
  
  init() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      toast.show('Back online', 'success');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      toast.show('No internet connection', 'warning');
    });
  }
};

// Export utilities
window.utils = {
  debounce,
  throttle,
  toast,
  loader,
  errorBoundary,
  dateUtils,
  validation,
  network
}; 