// Supabase configuration
const SUPABASE_URL = 'https://acwnjyexyxtxtcdmmytr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd25qeWV4eXh0eHRjZG1teXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MjQ2NTAsImV4cCI6MjA2MzAwMDY1MH0.f2ugCi7I9M6jYcuNMMRBOs9-LXzZJsJwqWHQYXOXYnM';

// Initialize Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Current user state
let currentUser = null;

// DOM Elements
const authModal = document.getElementById('auth-modal');
const threadModal = document.getElementById('thread-modal');
const authForm = document.getElementById('auth-form');
const threadForm = document.getElementById('thread-form');
const authButtons = document.getElementById('auth-buttons');
const userInfo = document.getElementById('user-info');
const threadsList = document.querySelector('.threads-list');
const activityFeed = document.querySelector('.activity-feed');

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
  if (currentUser) {
    authButtons.classList.add('hidden');
    userInfo.classList.remove('hidden');
    document.getElementById('user-name').textContent = currentUser.email;
  } else {
    authButtons.classList.remove('hidden');
    userInfo.classList.add('hidden');
  }
}

// Thread functions
async function createThread(event) {
  event.preventDefault();
  
  if (!currentUser) {
    alert('Please sign in to create a thread');
    return;
  }

  const title = document.getElementById('thread-title').value;
  const content = document.getElementById('thread-content').value;
  const category = document.getElementById('thread-category').value;
  const tags = document.getElementById('thread-tags').value
    .split(',')
    .map(tag => tag.trim())
    .filter(tag => tag);

  try {
    const { error } = await db.from('threads').insert({
      title,
      content,
      category,
      tags,
      user_id: currentUser.id,
      created_at: new Date().toISOString()
    });

    if (error) throw error;
    
    closeModal(threadModal);
    loadThreads();
  } catch (error) {
    alert(error.message);
  }
}

async function loadThreads() {
  try {
    const { data: threads, error } = await db
      .from('threads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    displayThreads(threads || []);
  } catch (error) {
    console.error('Error loading threads:', error);
  }
}

function displayThreads(threads) {
  threadsList.innerHTML = threads.map(thread => `
    <div class="thread-item">
      <div class="thread-header">
        <span class="category-tag">${thread.category}</span>
        <span class="created-at">${new Date(thread.created_at).toLocaleDateString()}</span>
      </div>
      <h3>${thread.title}</h3>
      <p>${thread.content.substring(0, 200)}${thread.content.length > 200 ? '...' : ''}</p>
      <div class="thread-footer">
        <div class="thread-stats">
          <span><i class="fas fa-comment"></i> ${thread.comments_count || 0}</span>
          <span><i class="fas fa-heart"></i> ${thread.likes_count || 0}</span>
        </div>
        <div class="thread-tags">
          ${(thread.tags || []).map(tag => `<span class="tag">#${tag}</span>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// Event listeners
document.getElementById('login-button').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = 'Sign In';
  document.getElementById('auth-switch').innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Register</a>';
  authModal.classList.remove('hidden');
});

document.getElementById('register-button').addEventListener('click', () => {
  document.getElementById('auth-title').textContent = 'Register';
  document.getElementById('auth-switch').innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Sign In</a>';
  authModal.classList.remove('hidden');
});

document.getElementById('create-thread').addEventListener('click', () => {
  if (!currentUser) {
    alert('Please sign in to create a thread');
    return;
  }
  threadModal.classList.remove('hidden');
});

authForm.addEventListener('submit', handleAuth);
threadForm.addEventListener('submit', createThread);

document.querySelectorAll('.cancel-button').forEach(button => {
  button.addEventListener('click', () => {
    authModal.classList.add('hidden');
    threadModal.classList.add('hidden');
  });
});

// Load initial data
loadThreads();

// Check for existing session
db.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    updateAuthUI();
  }
}); 