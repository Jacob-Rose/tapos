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
const addDirectoryBtn = document.getElementById('add-directory-btn');
const directoriesList = document.getElementById('directories-list');
const safeModeOverlay = document.getElementById('safe-mode-overlay');
const manualLoadBtn = document.getElementById('manual-load-btn');

let currentProjects = [];
let currentPreferences = {
  hideReturnTracks: false,
  hideMasterTrack: false,
  directories: []
};
let tempDirectories = []; // Temporary directories list for modal editing
let projectGroups = new Map(); // Track project groups by directory path

// Load preferences on startup
async function loadPreferences() {
  try {
    currentPreferences = await window.electronAPI.getPreferences();
    hideReturnTracksCheckbox.checked = currentPreferences.hideReturnTracks;
    hideMasterTrackCheckbox.checked = currentPreferences.hideMasterTrack;

    // Ensure directories array exists
    if (!currentPreferences.directories) {
      currentPreferences.directories = [];
    }
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

// Listen for individual project added (incremental)
window.electronAPI.onProjectAdded((project) => {
  currentProjects.push(project);

  // Add to appropriate group
  addProjectToGroup(project);

  // Hide empty state if this is the first project
  if (currentProjects.length === 1) {
    emptyState.classList.remove('visible');
  }

  // Update status
  statusText.textContent = `Loaded ${currentProjects.length} project${currentProjects.length !== 1 ? 's' : ''}`;
});

// Listen for projects loaded (full refresh)
window.electronAPI.onProjectsLoaded((projects) => {
  console.log('Projects loaded (full refresh):', projects);
  currentProjects = projects;

  // Clear everything and start fresh
  projectGroups.clear();
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

// Listen for safe mode status
window.electronAPI.onSafeModeStatus((isSafeMode) => {
  console.log('Safe mode:', isSafeMode);
  if (isSafeMode) {
    safeModeOverlay.style.display = 'flex';
  }
});

// Manual load button handler
manualLoadBtn.addEventListener('click', async () => {
  console.log('Manual load clicked');
  manualLoadBtn.disabled = true;
  manualLoadBtn.textContent = 'Loading...';

  try {
    await window.electronAPI.manualLoadProjects();
    // Hide overlay after loading starts
    safeModeOverlay.style.display = 'none';
  } catch (error) {
    console.error('Error triggering manual load:', error);
    manualLoadBtn.disabled = false;
    manualLoadBtn.textContent = 'Load Projects';
  }
});

/**
 * Add a single project to its group and update the UI
 */
function addProjectToGroup(project) {
  // Get the directory path (parent folder of the .als file)
  const pathParts = project.filePath.split(/[\\/]/);
  const fileName = pathParts.pop(); // Remove filename
  const directoryPath = pathParts.join('/');

  // Check if group exists
  if (!projectGroups.has(directoryPath)) {
    // Create new group
    const directoryName = pathParts[pathParts.length - 1] || 'Unknown Project';
    const newGroup = {
      directoryPath: directoryPath,
      projectName: directoryName,
      versions: [project],
      selectedVersionIndex: 0
    };
    projectGroups.set(directoryPath, newGroup);

    // Create and append card
    const card = createProjectGroupCard(newGroup);
    card.dataset.directoryPath = directoryPath; // Store reference
    projectsGrid.appendChild(card);
  } else {
    // Add to existing group
    const group = projectGroups.get(directoryPath);
    group.versions.push(project);

    // Sort versions by last modified (newest first)
    group.versions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    // Find and update the existing card
    const existingCard = projectsGrid.querySelector(`[data-directory-path="${directoryPath}"]`);
    if (existingCard) {
      const newCard = createProjectGroupCard(group);
      newCard.dataset.directoryPath = directoryPath;
      existingCard.replaceWith(newCard);
    }
  }
}

/**
 * Group projects by their parent directory
 */
function groupProjectsByDirectory(projects) {
  const groups = new Map();

  projects.forEach(project => {
    // Get the directory path (parent folder of the .als file)
    const pathParts = project.filePath.split(/[\\/]/);
    const fileName = pathParts.pop(); // Remove filename
    const directoryPath = pathParts.join('/');

    if (!groups.has(directoryPath)) {
      // Use the directory name as the project name
      const directoryName = pathParts[pathParts.length - 1] || 'Unknown Project';

      groups.set(directoryPath, {
        directoryPath: directoryPath,
        projectName: directoryName,
        versions: [],
        selectedVersionIndex: 0
      });
    }

    groups.get(directoryPath).versions.push(project);
  });

  // Sort versions within each group by last modified (newest first)
  groups.forEach(group => {
    group.versions.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
  });

  return Array.from(groups.values());
}

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

  // Group projects by directory (creates new Map)
  const groupsArray = groupProjectsByDirectory(currentProjects);

  // Rebuild the projectGroups map
  projectGroups.clear();
  groupsArray.forEach(group => {
    projectGroups.set(group.directoryPath, group);
  });

  // Create a card for each project group
  groupsArray.forEach(group => {
    const card = createProjectGroupCard(group);
    card.dataset.directoryPath = group.directoryPath; // Store reference
    projectsGrid.appendChild(card);
  });
}

/**
 * Create a project group card with version selector
 */
function createProjectGroupCard(group) {
  const card = document.createElement('div');
  card.className = 'project-card';

  // Project title (directory name)
  const title = document.createElement('h3');
  title.textContent = group.projectName;
  card.appendChild(title);

  // Version selector (always show, but disable if only one version)
  const versionSelector = document.createElement('div');
  versionSelector.className = 'version-selector';

  const versionLabel = document.createElement('label');
  versionLabel.textContent = 'Version: ';
  versionLabel.className = 'version-label';

  const versionDropdown = document.createElement('select');
  versionDropdown.className = 'version-dropdown';

  // Disable if only one version
  if (group.versions.length === 1) {
    versionDropdown.disabled = true;
  }

  group.versions.forEach((version, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = version.name;
    if (index === group.selectedVersionIndex) {
      option.selected = true;
    }
    versionDropdown.appendChild(option);
  });

  // Handle version change (only if multiple versions)
  if (group.versions.length > 1) {
    versionDropdown.addEventListener('change', (e) => {
      group.selectedVersionIndex = parseInt(e.target.value);
      // Re-render just this card
      const newCard = createProjectGroupCard(group);
      card.replaceWith(newCard);
    });
  }

  versionSelector.appendChild(versionLabel);
  versionSelector.appendChild(versionDropdown);
  card.appendChild(versionSelector);

  // Get the currently selected version
  const selectedProject = group.versions[group.selectedVersionIndex];

  // Project info section
  const infoSection = document.createElement('div');
  infoSection.className = 'project-info';

  // Last modified date
  const dateInfo = createInfoItem('Last Modified', formatDate(selectedProject.lastModified));
  infoSection.appendChild(dateInfo);

  // Filter tracks based on preferences
  const filteredTracks = filterTracks(selectedProject.tracks);

  // Track count (filtered)
  const trackCount = createInfoItem('Track Count', filteredTracks.length);
  infoSection.appendChild(trackCount);

  // Show version count
  if (group.versions.length > 1) {
    const versionCount = createInfoItem('Versions', group.versions.length);
    infoSection.appendChild(versionCount);
  }

  // File name (just the .als file)
  const fileName = selectedProject.filePath.split(/[\\/]/).pop();
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
 * Create a project card element (legacy - kept for reference)
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
 * Render directories list in preferences modal
 */
function renderDirectoriesList() {
  directoriesList.innerHTML = '';

  if (tempDirectories.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.color = '#999';
    emptyMsg.style.fontStyle = 'italic';
    emptyMsg.style.fontSize = '0.9em';
    emptyMsg.textContent = 'No directories added yet';
    directoriesList.appendChild(emptyMsg);
    return;
  }

  tempDirectories.forEach((dir, index) => {
    const dirItem = document.createElement('div');
    dirItem.className = 'directory-item';

    // Checkbox to enable/disable
    const enableCheckbox = document.createElement('input');
    enableCheckbox.type = 'checkbox';
    enableCheckbox.checked = dir.enabled;
    enableCheckbox.title = 'Enable/disable this directory';
    enableCheckbox.addEventListener('change', (e) => {
      tempDirectories[index].enabled = e.target.checked;
    });

    // Directory path
    const pathSpan = document.createElement('span');
    pathSpan.className = 'directory-path';
    pathSpan.textContent = dir.path;
    pathSpan.title = dir.path; // Full path on hover

    // Recursive checkbox
    const recursiveLabel = document.createElement('label');
    recursiveLabel.className = 'directory-recursive-label';
    recursiveLabel.title = 'Enable full recursive scan (unlimited depth)';

    const recursiveCheckbox = document.createElement('input');
    recursiveCheckbox.type = 'checkbox';
    recursiveCheckbox.checked = dir.recursive || false;
    recursiveCheckbox.addEventListener('change', (e) => {
      tempDirectories[index].recursive = e.target.checked;
    });

    const recursiveText = document.createElement('span');
    recursiveText.textContent = 'Deep scan';
    recursiveText.style.fontSize = '0.85em';

    recursiveLabel.appendChild(recursiveCheckbox);
    recursiveLabel.appendChild(recursiveText);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'directory-remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      tempDirectories.splice(index, 1);
      renderDirectoriesList();
    });

    dirItem.appendChild(enableCheckbox);
    dirItem.appendChild(pathSpan);
    dirItem.appendChild(recursiveLabel);
    dirItem.appendChild(removeBtn);

    directoriesList.appendChild(dirItem);
  });
}

/**
 * Add directory handler
 */
async function handleAddDirectory() {
  try {
    const directoryPath = await window.electronAPI.selectDirectory();

    if (directoryPath) {
      // Check if directory already exists
      const exists = tempDirectories.some(d => d.path === directoryPath);

      if (exists) {
        alert('This directory is already added');
        return;
      }

      // Add new directory (recursive: false by default = 2 levels deep)
      tempDirectories.push({ path: directoryPath, enabled: true, recursive: false });
      renderDirectoriesList();
    }
  } catch (error) {
    console.error('Error selecting directory:', error);
  }
}

/**
 * Open preferences modal
 */
function openPreferencesModal() {
  hideReturnTracksCheckbox.checked = currentPreferences.hideReturnTracks;
  hideMasterTrackCheckbox.checked = currentPreferences.hideMasterTrack;

  // Clone current directories to temporary array for editing
  tempDirectories = JSON.parse(JSON.stringify(currentPreferences.directories));
  renderDirectoriesList();

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
    hideMasterTrack: hideMasterTrackCheckbox.checked,
    directories: tempDirectories
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
addDirectoryBtn.addEventListener('click', handleAddDirectory);

// Close modal when clicking outside
preferencesModal.addEventListener('click', (e) => {
  if (e.target === preferencesModal) {
    closePreferencesModal();
  }
});

// Initialize
loadPreferences();
emptyState.classList.add('visible');
