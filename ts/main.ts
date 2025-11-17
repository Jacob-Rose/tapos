import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import Store from 'electron-store';
import { loadProjectsInDirectory } from './project-loading';
import { ProjectInfo } from './types';
import { UserPreferences, defaultPreferences } from './preferences';

const store = new Store();
let mainWindow: BrowserWindow | null = null;

// Timeout duration for loading from each directory (5 minutes)
const DIRECTORY_LOAD_TIMEOUT = 300000;

// Check if launched in safe mode
const isSafeMode = process.argv.includes('--safe-mode');

/**
 * Check if a directory exists and is accessible
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

// No longer needed - timeout is per-project now
// Kept for backward compatibility but with very long timeout as safety net
async function loadProjectsWithTimeout(
  dirPath: string,
  timeoutMs: number,
  maxDepth: number = 1,
  onProjectFound?: (project: ProjectInfo) => void
): Promise<ProjectInfo[]> {
  // Just pass through to loadProjectsInDirectory with callback
  // Individual projects have their own timeouts now
  return loadProjectsInDirectory(dirPath, maxDepth, onProjectFound);
}

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the index.html
  mainWindow.loadFile('index.html');

  // Send safe mode status to renderer when ready
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      mainWindow.webContents.send('safe-mode-status', isSafeMode);
    }
  });

  // Create menu
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project Folder',
          click() { openProjectFolder(); }
        },
        {
          label: 'Preferences',
          click() {
            if (mainWindow) {
              mainWindow.webContents.send('open-preferences');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          click() { app.quit(); }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click() {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click() {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        }
      ]
    }
  ]);
  mainWindow.setMenu(menu);

  // Open dev tools only in development
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
};

async function openProjectFolder() {
  const result = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  });

  if (!result || result.length === 0) {
    return;
  }

  const directory = result[0];

  // Add directory to preferences
  const prefs = store.get('preferences', defaultPreferences) as UserPreferences;

  // Check if directory already exists
  const existingDir = prefs.directories.find(d => d.path === directory);
  if (!existingDir) {
    prefs.directories.push({ path: directory, enabled: true, recursive: false });
    store.set('preferences', prefs);
  }

  console.log('Selected directory:', directory);

  // Reload all projects from enabled directories (non-blocking)
  loadAllProjects().catch(error => {
    console.error('Error in loadAllProjects:', error);
  });
}

async function loadAllProjects() {
  const prefs = store.get('preferences', defaultPreferences) as UserPreferences;
  const enabledDirs = prefs.directories.filter(d => d.enabled);

  if (enabledDirs.length === 0) {
    if (mainWindow) {
      mainWindow.webContents.send('projects-loaded', []);
    }
    return;
  }

  // Send loading status to renderer immediately
  if (mainWindow) {
    mainWindow.webContents.send('projects-loading');
    // Clear existing projects for fresh load
    mainWindow.webContents.send('projects-loaded', []);
  }

  console.log(`Starting parallel load of ${enabledDirs.length} directories...`);

  const allProjectsCollector: ProjectInfo[] = [];

  // Load all directories in parallel using Promise.allSettled
  const loadPromises = enabledDirs.map(async (dir) => {
    console.log(`Checking directory: ${dir.path}`);

    // Check if directory exists
    const exists = await directoryExists(dir.path);

    if (!exists) {
      console.warn(`Directory not found or inaccessible: ${dir.path}`);
      return {
        path: dir.path,
        projects: [] as ProjectInfo[],
        error: 'Directory not found',
        invalid: true
      };
    }

    try {
      const recursionDepth = dir.recursive ? Infinity : 1;
      console.log(`Loading projects from: ${dir.path} (depth: ${dir.recursive ? 'unlimited' : '1 level'})`);

      // Load projects with incremental updates
      const projects = await loadProjectsWithTimeout(
        dir.path,
        DIRECTORY_LOAD_TIMEOUT,
        recursionDepth,
        (project: ProjectInfo) => {
          // Send each project to renderer as it's found
          allProjectsCollector.push(project);
          if (mainWindow) {
            mainWindow.webContents.send('projects-loaded', [...allProjectsCollector]);
          }
        }
      );

      console.log(`  > Loaded ${projects.length} projects from ${dir.path}`);

      return {
        path: dir.path,
        projects: projects,
        error: null,
        invalid: false
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error loading from ${dir.path}:`, errorMsg);

      return {
        path: dir.path,
        projects: [] as ProjectInfo[],
        error: errorMsg,
        invalid: false
      };
    }
  });

  // Wait for all directories to finish loading (in parallel)
  const results = await Promise.allSettled(loadPromises);

  // Process results
  const allProjects: ProjectInfo[] = [];
  const errors: string[] = [];
  const invalidDirs: string[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      const { path, projects, error, invalid } = result.value;

      if (invalid) {
        invalidDirs.push(path);
        errors.push(`Directory not found: ${path}`);
      } else if (error) {
        errors.push(`${path}: ${error}`);
      } else {
        allProjects.push(...projects);
      }
    } else {
      console.error('Unexpected promise rejection:', result.reason);
    }
  });

  // Clean up invalid directories from preferences
  if (invalidDirs.length > 0) {
    prefs.directories = prefs.directories.filter(d => !invalidDirs.includes(d.path));
    store.set('preferences', prefs);
    console.log(`Removed ${invalidDirs.length} invalid directories from preferences`);
  }

  console.log(`Total: Loaded ${allProjectsCollector.length} projects from ${enabledDirs.length - invalidDirs.length} valid directories`);

  // Final update to renderer (already sent incrementally, but ensure final state)
  if (mainWindow) {
    mainWindow.webContents.send('projects-loaded', allProjectsCollector);

    // If there were errors but we still loaded some projects, log them
    if (errors.length > 0) {
      console.warn('Some directories had errors:', errors);
    }
  }
}

// IPC handlers for preferences
ipcMain.handle('get-preferences', (): UserPreferences => {
  const prefs = store.get('preferences', defaultPreferences) as UserPreferences;
  return prefs;
});

ipcMain.handle('set-preferences', (_event, preferences: UserPreferences) => {
  store.set('preferences', preferences);

  // Reload projects when preferences change (in case directories were enabled/disabled)
  // Non-blocking - fire and forget
  loadAllProjects().catch(error => {
    console.error('Error in loadAllProjects:', error);
  });

  return preferences;
});

// IPC handler for selecting a directory
ipcMain.handle('select-directory', (): string | null => {
  const result = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  });

  if (!result || result.length === 0) {
    return null;
  }

  return result[0];
});

// IPC handler for manually triggering project load (safe mode)
ipcMain.handle('manual-load-projects', async () => {
  console.log('Manual load triggered');
  await loadAllProjects();
  return true;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // Load projects from saved directories on startup (unless in safe mode)
  if (!isSafeMode) {
    setTimeout(() => {
      loadAllProjects();
    }, 500); // Small delay to ensure window is ready
  } else {
    console.log('Safe mode: Auto-load disabled. Use the "Load Projects" button to start loading.');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
