/**
 * Customer Portal Dashboard
 * Main landing page for authenticated customers
 */

import { requireAuth, getCurrentUser, getUserBoats, logout } from '../auth/auth.js';

// Require authentication
const isAuth = await requireAuth();
if (!isAuth) {
  // requireAuth handles redirect
  throw new Error('Not authenticated');
}

// Load user data
let currentUser = null;
let userBoats = [];
let selectedBoatId = null;

/**
 * Initialize portal
 */
async function init() {
  // Get current user
  const { user, error: userError } = await getCurrentUser();

  if (userError || !user) {
    console.error('Error loading user:', userError);
    window.location.href = '/login.html';
    return;
  }

  currentUser = user;

  // Display user email
  document.getElementById('user-email').textContent = user.email;

  // Load boats
  await loadBoats();

  // Update welcome message
  updateWelcomeMessage();
}

/**
 * Load user's accessible boats
 */
async function loadBoats() {
  const { boats, error } = await getUserBoats(currentUser.id);

  if (error) {
    console.error('Error loading boats:', error);
    return;
  }

  userBoats = boats;

  // If multiple boats, show selector
  if (boats.length > 1) {
    document.getElementById('boat-selector').style.display = 'block';
    populateBoatSelector(boats);
  }

  // Set initial selected boat
  if (boats.length > 0) {
    // Check localStorage for previously selected boat
    const savedBoatId = localStorage.getItem('currentBoatId');
    if (savedBoatId && boats.find(b => b.id === savedBoatId)) {
      selectedBoatId = savedBoatId;
    } else {
      // Select primary boat or first boat
      const primaryBoat = boats.find(b => b.isPrimary);
      selectedBoatId = primaryBoat ? primaryBoat.id : boats[0].id;
    }

    // Update selector if visible
    if (boats.length > 1) {
      document.getElementById('current-boat').value = selectedBoatId;
    }

    // Load boat data
    await loadBoatData();
  }
}

/**
 * Populate boat selector dropdown
 * @param {Array} boats - User's boats
 */
function populateBoatSelector(boats) {
  const select = document.getElementById('current-boat');
  select.innerHTML = '';

  boats.forEach(boat => {
    const option = document.createElement('option');
    option.value = boat.id;
    option.textContent = boat.name;
    if (boat.isPrimary) {
      option.textContent += ' (Primary)';
    }
    select.appendChild(option);
  });

  // Listen for changes
  select.addEventListener('change', async (e) => {
    selectedBoatId = e.target.value;
    localStorage.setItem('currentBoatId', selectedBoatId);
    await loadBoatData();
  });
}

/**
 * Load data for selected boat
 */
async function loadBoatData() {
  const boat = userBoats.find(b => b.id === selectedBoatId);
  if (!boat) return;

  // Update welcome message with boat name
  document.getElementById('welcome-heading').textContent = `Welcome to ${boat.name}'s Portal`;

  // TODO: Load service history, invoices, messages, etc.
  // This will be implemented in future phases
}

/**
 * Update welcome message
 */
function updateWelcomeMessage() {
  if (userBoats.length === 0) {
    document.getElementById('welcome-heading').textContent = 'Welcome to Your Portal';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Logout button
  document.getElementById('logout-btn').addEventListener('click', async () => {
    const { success } = await logout();
    if (success) {
      window.location.href = '/login.html';
    }
  });
}

// Initialize portal
async function startPortal() {
  setupEventListeners();
  await init();
}

startPortal();
