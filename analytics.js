// Supabase configuration
const SUPABASE_URL = 'https://acwnjyexyxtxtcdmmytr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjd25qeWV4eXh0eHRjZG1teXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MjQ2NTAsImV4cCI6MjA2MzAwMDY1MH0.f2ugCi7I9M6jYcuNMMRBOs9-LXzZJsJwqWHQYXOXYnM';

// Initialize Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Current user state
let currentUser = null;

// Chart configurations
const votingTrendsChart = new Chart(
  document.getElementById('votingTrends'),
  {
    type: 'line',
    data: {
      labels: ['7 days ago', '6 days ago', '5 days ago', '4 days ago', '3 days ago', '2 days ago', 'Today'],
      datasets: [{
        label: 'Total Votes',
        data: [1200, 1350, 1500, 1800, 2000, 2200, 2500],
        borderColor: '#3498db',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Voting Activity Over Time'
        }
      }
    }
  }
);

const categoryDistributionChart = new Chart(
  document.getElementById('categoryDistribution'),
  {
    type: 'doughnut',
    data: {
      labels: ['Environment', 'Education', 'Healthcare', 'Economy', 'Social', 'Technology'],
      datasets: [{
        data: [30, 20, 15, 12, 13, 10],
        backgroundColor: [
          '#2ecc71',
          '#3498db',
          '#e74c3c',
          '#f1c40f',
          '#9b59b6',
          '#1abc9c'
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'right'
        },
        title: {
          display: true,
          text: 'Poll Distribution by Category'
        }
      }
    }
  }
);

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
      loadAnalytics();
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

// Analytics functions
async function loadAnalytics() {
  try {
    const [pollsStats, votingStats, userStats] = await Promise.all([
      db.from('polls').select('count'),
      db.from('votes').select('count'),
      db.from('users').select('count')
    ]);

    updateStatCards(pollsStats.count, votingStats.count, userStats.count);
    await loadTopIssues();
    await loadTrendingTopics();
  } catch (error) {
    console.error('Error loading analytics:', error);
  }
}

async function loadTopIssues() {
  try {
    const { data: issues, error } = await db
      .from('polls')
      .select('*')
      .order('votes_count', { ascending: false })
      .limit(5);

    if (error) throw error;

    const topIssuesList = document.querySelector('.top-issues-list');
    topIssuesList.innerHTML = (issues || []).map(issue => `
      <div class="top-issue-item">
        <h4>${issue.title}</h4>
        <div class="issue-stats">
          <span><i class="fas fa-vote-yea"></i> ${issue.votes_count || 0}</span>
          <span><i class="fas fa-comments"></i> ${issue.comments_count || 0}</span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading top issues:', error);
  }
}

async function loadTrendingTopics() {
  try {
    const { data: topics, error } = await db
      .from('tags')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(10);

    if (error) throw error;

    const trendingTopics = document.querySelector('.trending-topics');
    trendingTopics.innerHTML = (topics || []).map(topic => `
      <div class="trending-topic">
        <span class="topic-name">#${topic.name}</span>
        <span class="topic-count">${topic.usage_count} mentions</span>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading trending topics:', error);
  }
}

function updateStatCards(pollsCount, votesCount, usersCount) {
  // Update the statistics in the stat cards
  document.querySelector('.stat-card:nth-child(1) .stat-number').textContent = pollsCount;
  document.querySelector('.stat-card:nth-child(2) .stat-number').textContent = votesCount;
  document.querySelector('.stat-card:nth-child(3) .stat-number').textContent = usersCount;
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

document.getElementById('auth-form').addEventListener('submit', handleAuth);

document.querySelectorAll('.cancel-button').forEach(button => {
  button.addEventListener('click', () => {
    document.getElementById('auth-modal').classList.add('hidden');
  });
});

// Time range buttons
document.querySelectorAll('.time-range button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.time-range button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    loadAnalytics(); // Reload analytics with new time range
  });
});

// Check for existing session
db.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentUser = session.user;
    updateAuthUI();
    loadAnalytics();
  }
}); 