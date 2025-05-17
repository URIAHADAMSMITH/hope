// Authentication module

const auth = {
  // Current user state
  currentUser: null,
  
  // Session management
  async initialize() {
    try {
      // Check for existing session
      const { data: { session }, error } = await window.db.auth.getSession();
      
      if (error) throw error;
      
      if (session) {
        this.currentUser = session.user;
        await this.loadUserProfile();
        this.updateUI(true);
      } else {
        this.updateUI(false);
      }
      
      // Listen for auth state changes
      window.db.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
          this.currentUser = session.user;
          await this.loadUserProfile();
          this.updateUI(true);
          utils.toast.show('Successfully signed in!', 'success');
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.updateUI(false);
          utils.toast.show('Successfully signed out', 'info');
        } else if (event === 'USER_UPDATED') {
          this.currentUser = session.user;
          await this.loadUserProfile();
          this.updateUI(true);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing auth:', error);
      utils.toast.show('Error initializing authentication', 'error');
      return false;
    }
  },
  
  // Profile management
  async loadUserProfile() {
    try {
      const { data: profile, error } = await window.db
        .from('profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();
      
      if (error) throw error;
      
      if (!profile) {
        // Create profile if it doesn't exist
        await window.db
          .from('profiles')
          .insert([{
            id: this.currentUser.id,
            username: this.currentUser.email.split('@')[0],
            avatar_url: null,
            created_at: new Date().toISOString()
          }]);
      }
      
      return profile;
    } catch (error) {
      console.error('Error loading user profile:', error);
      utils.toast.show('Error loading user profile', 'error');
      return null;
    }
  },
  
  // Authentication methods
  async signUp(email, password) {
    try {
      utils.loader.show();
      
      // Validate input
      if (!utils.validation.email(email)) {
        throw new Error('Please enter a valid email address');
      }
      
      const passwordValidation = utils.validation.password(password);
      if (!passwordValidation.isValid) {
        throw new Error('Password does not meet requirements');
      }
      
      const { data, error } = await window.db.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            email_confirmed: false
          }
        }
      });
      
      if (error) throw error;
      
      utils.toast.show('Please check your email to verify your account', 'success');
      return data;
    } catch (error) {
      console.error('Error signing up:', error);
      utils.toast.show(error.message, 'error');
      return null;
    } finally {
      utils.loader.hide();
    }
  },
  
  async signIn(email, password) {
    try {
      utils.loader.show();
      
      const { data, error } = await window.db.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error signing in:', error);
      utils.toast.show(error.message, 'error');
      return null;
    } finally {
      utils.loader.hide();
    }
  },
  
  async signInWithProvider(provider) {
    try {
      utils.loader.show();
      utils.toast.show('Connecting to ' + provider + '...', 'info');
      
      // Check if provider is enabled
      const { data: providers } = await window.db.auth.getSettings();
      const isEnabled = providers?.external?.[provider]?.enabled;
      
      if (!isEnabled) {
        throw new Error(`${provider} sign in is not configured yet. Please try email sign in.`);
      }
      
      const { data, error } = await window.db.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error signing in with provider:', error);
      utils.toast.show(error.message, 'error');
      return null;
    } finally {
      utils.loader.hide();
    }
  },
  
  async signOut() {
    try {
      utils.loader.show();
      
      const { error } = await window.db.auth.signOut();
      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error signing out:', error);
      utils.toast.show('Error signing out', 'error');
      return false;
    } finally {
      utils.loader.hide();
    }
  },
  
  async resetPassword(email) {
    try {
      utils.loader.show();
      
      const { error } = await window.db.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
      });
      
      if (error) throw error;
      
      utils.toast.show('Password reset instructions sent to your email', 'success');
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      utils.toast.show(error.message, 'error');
      return false;
    } finally {
      utils.loader.hide();
    }
  },
  
  // UI updates
  updateUI(isAuthenticated) {
    const authSection = document.getElementById('auth-section');
    
    if (isAuthenticated && this.currentUser) {
      authSection.innerHTML = `
        <div class="user-menu">
          <button id="profile-button" class="profile-button">
            <i class="fas fa-user"></i>
            <span>${this.currentUser.email}</span>
          </button>
          <button id="sign-out" class="auth-button">Sign Out</button>
        </div>
      `;
      
      // Add event listeners
      document.getElementById('sign-out').addEventListener('click', () => this.signOut());
      document.getElementById('profile-button').addEventListener('click', () => this.showProfileModal());
    } else {
      authSection.innerHTML = `
        <button id="sign-in" class="auth-button">Sign In</button>
        <button id="sign-up" class="auth-button">Sign Up</button>
      `;
      
      // Add event listeners
      document.getElementById('sign-in').addEventListener('click', () => this.showAuthModal('sign-in'));
      document.getElementById('sign-up').addEventListener('click', () => this.showAuthModal('sign-up'));
    }
  },
  
  // Modal handlers
  showAuthModal(type = 'sign-in') {
    const modal = document.createElement('div');
    modal.className = 'modal auth-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${type === 'sign-in' ? 'Sign In' : 'Sign Up'}</h2>
          <button class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <form id="auth-form" class="auth-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" required>
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" required minlength="6">
              <small class="help-text">Password must be at least 6 characters long</small>
            </div>
            ${type === 'sign-up' ? `
              <div class="form-group">
                <label for="confirm-password">Confirm Password</label>
                <input type="password" id="confirm-password" required minlength="6">
              </div>
            ` : ''}
            <div class="form-actions">
              <button type="submit" class="submit-button" id="auth-submit">
                ${type === 'sign-in' ? 'Sign In' : 'Sign Up'}
              </button>
            </div>
          </form>
          <div class="auth-separator">
            <span>or</span>
          </div>
          <div class="social-auth">
            <button onclick="auth.signInWithProvider('google')" class="social-button google">
              <i class="fab fa-google"></i>
              Continue with Google
            </button>
            <button onclick="auth.signInWithProvider('github')" class="social-button github">
              <i class="fab fa-github"></i>
              Continue with GitHub
            </button>
          </div>
          <p class="auth-switch">
            ${type === 'sign-in'
              ? 'Don\'t have an account? <a href="#" id="switch-to-signup">Sign Up</a>'
              : 'Already have an account? <a href="#" id="switch-to-signin">Sign In</a>'
            }
          </p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    const closeButton = modal.querySelector('.close-button');
    const form = modal.querySelector('#auth-form');
    const submitButton = modal.querySelector('#auth-submit');
    const switchLink = modal.querySelector('#switch-to-signup, #switch-to-signin');
    
    const closeModal = () => {
      modal.classList.add('fade-out');
      setTimeout(() => modal.remove(), CONFIG.UI.ANIMATION_DURATION);
    };
    
    closeButton.addEventListener('click', closeModal);
    
    // Switch between sign in and sign up
    switchLink.addEventListener('click', (e) => {
      e.preventDefault();
      modal.remove();
      this.showAuthModal(type === 'sign-in' ? 'sign-up' : 'sign-in');
    });
    
    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = form.querySelector('#email').value;
      const password = form.querySelector('#password').value;
      
      try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        
        let result;
        
        if (type === 'sign-up') {
          const confirmPassword = form.querySelector('#confirm-password').value;
          if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
          }
          
          result = await this.signUp(email, password);
        } else {
          result = await this.signIn(email, password);
        }
        
        if (result) {
          closeModal();
        }
      } catch (error) {
        console.error('Auth error:', error);
        utils.toast.show(error.message, 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = type === 'sign-in' ? 'Sign In' : 'Sign Up';
      }
    });
    
    // Animate modal in
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  },
  
  showProfileModal() {
    // Implementation for viewing/editing profile
    // This will be implemented in a separate PR
  }
};

// Export auth module
window.auth = auth; 