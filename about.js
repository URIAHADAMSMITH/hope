// Supabase configuration
const SUPABASE_URL = 'https://acwnjyexyxtxtcdmmytr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd25qeWV4eXh0eHRjZG1teXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MjQ2NTAsImV4cCI6MjA2MzAwMDY1MH0.f2ugCi7I9M6jYcuNMMRBOs9-LXzZJsJwqWHQYXOXYnM';

// Initialize Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Current user state
let currentUser = null;

// Auth functions
async function handleAuth(event) {
  event.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const isLogin = authModal.querySelector('h2').textContent === 'Sign In';

  try {
    const { data, error } = isLogin
      ? await db.auth.signInWithPassword({ email, password })
      : await db.auth.signUp({ email, password });

    if (error) throw error;
    
    if (data.user) {
      currentUser = data.user;
      updateAuthUI();
      closeModal(authModal);
    }
  } catch (error) {
    alert(error.message);
  }
}

function updateAuthUI() {
  const authButtons = document.getElementById('auth-buttons');
  const userInfo = document.getElementById('user-info');
  
  if (currentUser) {
    authButtons.classList.add('hidden');
    userInfo.classList.remove('hidden');
    document.getElementById('user-name').textContent = currentUser.email;
  } else {
    authButtons.classList.remove('hidden');
    userInfo.classList.add('hidden');
  }
}

// Event listeners
document.getElementById('login-button').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = 'Sign In';
  document.getElementById('auth-switch').innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Register</a>';
  document.getElementById('auth-modal').classList.remove('hidden');
});

document.getElementById('register-button').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = 'Register';
  document.getElementById('auth-switch').innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Sign In</a>';
  document.getElementById('auth-modal').classList.remove('hidden');
});

document.getElementById('join-button').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = 'Register';
  document.getElementById('auth-switch').innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Sign In</a>';
  document.getElementById('auth-modal').classList.remove('hidden');
});

document.getElementById('auth-form').addEventListener('submit', handleAuth);

document.querySelectorAll('.cancel-button').forEach(button => {
  button.addEventListener('click', () => {
    document.getElementById('auth-modal').classList.add('hidden');
  });
});

// Add smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth'
    });
  });
});

// Check for existing session
db.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    updateAuthUI();
  }
}); 