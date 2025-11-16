// Renderer process script
console.log('Renderer loaded');

const projectsGrid = document.getElementById('projects-grid');
const emptyState = document.getElementById('empty-state');
const statusText = document.getElementById('status-text');
const preferencesModal = document.getElementById('preferences-modal');
const closePreferencesBtn = document.getElementById('close-preferences');
const savePreferencesBtn = document.getElementById('save-preferences');
const cancelPreferencesBtn = document.getElementById('cancel-preferences');
const hideReturnTracksCheckbox = document.getElementById('hide-return-tracks');
const hideMasterTrackCheckbox = document.getElementById('hide-master-track');

let currentProjects = [];
let currentPreferences = {
  hideReturnTracks: false,
  hideMasterTrack: false
};

// Load preferences on startup
async function loadPreferences() {
  try {
    currentPreferences = await window.electronAPI.getPreferences();
    hideReturnTracksCheckbox.checked = currentPreferences.hideReturnTracks;
    hideMasterTrackCheckbox.checked = currentPreferences.hideMasterTrack;
  } catch (error) {
    console.error('Error loading preferences:', error);
  }
}

// Listen for projects loading
window.electronAPI.onProjectsLoading(() => {
  console.log('Projects loading...');
  statusText.textContent = 'Loading projects...';
  projectsGrid.innerHTML = '';
  emptyState.classList.remove('visible');
});

// Listen for projects loaded
window.electronAPI.onProjectsLoaded((projects) => {
  console.log('Projects loaded:', projects);
  currentProjects = projects;
  displayProjects();
});

// Listen for errors
window.electronAPI.onProjectsError((error) => {
  console.error('Error loading projects:', error);
  statusText.textContent = `Error: ${error}`;
  emptyState.classList.add('visible');
});

// Listen for preferences modal open
window.electronAPI.onOpenPreferences(() => {
  openPreferencesModal();
});

// Display projects with current filter preferences
function displayProjects() {
  statusText.textContent = `Loaded ${currentProjects.length} project${currentProjects.length !== 1 ? 's' : ''}`;

  // Clear the grid
  projectsGrid.innerHTML = '';

  if (currentProjects.length === 0) {
    emptyState.classList.add('visible');
    return;
  }

  emptyState.classList.remove('visible');

  // Create a card for each project
  currentProjects.forEach(project => {
    const card = createProjectCard(project);
    projectsGrid.appendChild(card);
  });
}

/**
 * Create a project card element
 */
function createProjectCard(project) {
  const card = document.createElement('div');
  card.className = 'project-card';

  // Project title
  const title = document.createElement('h3');
  title.textContent = project.name;
  card.appendChild(title);

  // Project info section
  const infoSection = document.createElement('div');
  infoSection.className = 'project-info';

  // Last modified date
  const dateInfo = createInfoItem('Last Modified', formatDate(project.lastModified));
  infoSection.appendChild(dateInfo);

  // Filter tracks based on preferences
  const filteredTracks = filterTracks(project.tracks);

  // Track count (filtered)
  const trackCount = createInfoItem('Track Count', filteredTracks.length);
  infoSection.appendChild(trackCount);

  // File path (truncated)
  const fileName = project.filePath.split(/[\\/]/).pop();
  const filePath = createInfoItem('File', fileName);
  infoSection.appendChild(filePath);

  card.appendChild(infoSection);

  // Tracks section
  if (filteredTracks.length > 0) {
    const tracksSection = document.createElement('div');
    tracksSection.className = 'tracks-section';

    const tracksHeader = document.createElement('div');
    tracksHeader.className = 'tracks-header';
    tracksHeader.textContent = 'Tracks:';
    tracksSection.appendChild(tracksHeader);

    const tracksList = document.createElement('div');
    tracksList.className = 'tracks-list';

    filteredTracks.forEach(track => {
      const trackItem = createTrackItem(track);
      tracksList.appendChild(trackItem);
    });

    tracksSection.appendChild(tracksList);
    card.appendChild(tracksSection);
  }

  return card;
}

/**
 * Filter tracks based on current preferences
 */
function filterTracks(tracks) {
  if (!tracks) return [];

  return tracks.filter(track => {
    if (currentPreferences.hideReturnTracks && track.type === 'Return') {
      return false;
    }
    if (currentPreferences.hideMasterTrack && track.type === 'Master') {
      return false;
    }
    return true;
  });
}

/**
 * Create a project info item
 */
function createInfoItem(label, value) {
  const item = document.createElement('div');
  item.className = 'project-info-item';

  const labelEl = document.createElement('span');
  labelEl.className = 'project-info-label';
  labelEl.textContent = label + ':';

  const valueEl = document.createElement('span');
  valueEl.className = 'project-info-value';
  valueEl.textContent = value;

  item.appendChild(labelEl);
  item.appendChild(valueEl);

  return item;
}

/**
 * Create a track item element
 */
function createTrackItem(track) {
  const item = document.createElement('div');
  item.className = 'track-item';

  const type = document.createElement('span');
  type.className = `track-type ${track.type.toLowerCase()}`;
  type.textContent = track.type;

  const name = document.createElement('span');
  name.className = 'track-name';
  name.textContent = track.name;

  item.appendChild(type);
  item.appendChild(name);

  return item;
}

/**
 * Format date to readable string
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // If within last 7 days, show relative time
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  // Otherwise show formatted date
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  return date.toLocaleDateString(undefined, options);
}

/**
 * Open preferences modal
 */
function openPreferencesModal() {
  hideReturnTracksCheckbox.checked = currentPreferences.hideReturnTracks;
  hideMasterTrackCheckbox.checked = currentPreferences.hideMasterTrack;
  preferencesModal.classList.add('visible');
}

/**
 * Close preferences modal
 */
function closePreferencesModal() {
  preferencesModal.classList.remove('visible');
}

/**
 * Save preferences
 */
async function savePreferences() {
  const newPreferences = {
    hideReturnTracks: hideReturnTracksCheckbox.checked,
    hideMasterTrack: hideMasterTrackCheckbox.checked
  };

  try {
    await window.electronAPI.setPreferences(newPreferences);
    currentPreferences = newPreferences;

    // Redisplay projects with new filter
    displayProjects();

    closePreferencesModal();
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
}

// Event listeners for modal buttons
closePreferencesBtn.addEventListener('click', closePreferencesModal);
cancelPreferencesBtn.addEventListener('click', closePreferencesModal);
savePreferencesBtn.addEventListener('click', savePreferences);

// Close modal when clicking outside
preferencesModal.addEventListener('click', (e) => {
  if (e.target === preferencesModal) {
    closePreferencesModal();
  }
});

// Initialize
loadPreferences();
emptyState.classList.add('visible');
