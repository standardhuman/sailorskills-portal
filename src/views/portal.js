/**
 * Customer Portal Dashboard
 * Main landing page for authenticated customers
 */

import { requireAuth, getCurrentUser, getUserBoats, logout } from '../auth/auth.js';
import { getPaintCondition, getPaintStatus, daysSinceService, getServiceMedia } from '../api/boat-data.js';

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

  // Load paint condition data
  await loadPaintCondition(boat.id);

  // Load service media/videos
  await loadServiceMedia(boat.id);
}

/**
 * Load and display paint condition
 * @param {string} boatId - Boat UUID
 */
async function loadPaintCondition(boatId) {
  const { paintData, error } = await getPaintCondition(boatId);

  if (error || !paintData) {
    console.error('Error loading paint condition:', error);
    return;
  }

  // Show the paint condition section
  const section = document.getElementById('paint-condition-section');
  section.style.display = 'block';

  // Map paint condition to position percentage on gradient
  const conditionMap = {
    'not-inspected': 0,
    'excellent': 12.5,
    'exc-good': 18.75,
    'good': 37.5,
    'good-fair': 50,
    'fair': 62.5,
    'fair-poor': 75,
    'poor': 87.5,
    'very-poor': 100
  };

  const position = conditionMap[paintData.overall] || 0;

  // Position the marker on the gradient
  const marker = document.getElementById('condition-marker');
  marker.style.left = `${position}%`;

  // Get paint status
  const days = daysSinceService(paintData.serviceDate);
  const status = getPaintStatus(paintData.overall, days);

  // Update status message
  const messageEl = document.getElementById('paint-status-message');
  messageEl.textContent = status.message;
  messageEl.className = `paint-status-message ${status.status}`;

  // Update service date info
  const dateInfo = document.getElementById('service-date-info');
  if (paintData.serviceDate && days !== null) {
    dateInfo.textContent = `Last inspected ${days} day${days !== 1 ? 's' : ''} ago (${formatDate(paintData.serviceDate)})`;
  }

  // Update condition stat
  const conditionStat = document.getElementById('condition-stat');
  conditionStat.textContent = formatConditionText(paintData.overall);
}

/**
 * Load and display service media/videos
 * @param {string} boatId - Boat UUID
 */
async function loadServiceMedia(boatId) {
  const { media, error } = await getServiceMedia(boatId);

  if (error) {
    console.error('Error loading service media:', error);
  }

  // Show videos section
  const section = document.getElementById('videos-section');
  const grid = document.getElementById('video-grid');

  // TODO: For now, show a placeholder since videos aren't implemented yet
  // Once we have YouTube playlist integration, we'll populate this
  if (!media || media.length === 0) {
    grid.innerHTML = '<div class="no-videos-message">No videos available yet. Videos from your latest service will appear here.</div>';
    section.style.display = 'block';
  }
}

/**
 * Format paint condition text for display
 * @param {string} condition - Paint condition value
 * @returns {string} Formatted text
 */
function formatConditionText(condition) {
  const textMap = {
    'not-inspected': 'Not Inspected',
    'excellent': 'Excellent',
    'exc-good': 'Exc-Good',
    'good': 'Good',
    'good-fair': 'Good-Fair',
    'fair': 'Fair',
    'fair-poor': 'Fair-Poor',
    'poor': 'Poor',
    'very-poor': 'Very Poor'
  };
  return textMap[condition] || 'Unknown';
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
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
