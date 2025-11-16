import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { loadProjectsInDirectory } from './project-loading';
import { ProjectInfo } from './types';
import { UserPreferences, defaultPreferences } from './preferences';

const store = new Store();
let mainWindow: BrowserWindow | null = null;

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
    }
  ]);
  mainWindow.setMenu(menu);

  // Open dev tools
  mainWindow.webContents.openDevTools();
};

async function openProjectFolder() {
  const result = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  });

  if (!result || result.length === 0) {
    return;
  }

  const directory = result[0];
  store.set('directory', directory);
  console.log('Selected directory:', directory);

  // Send loading status to renderer
  if (mainWindow) {
    mainWindow.webContents.send('projects-loading');
  }

  try {
    // Load and parse all projects
    const projects = await loadProjectsInDirectory(directory);
    console.log(`Loaded ${projects.length} projects`);

    // Send projects to renderer
    if (mainWindow) {
      mainWindow.webContents.send('projects-loaded', projects);
    }
  } catch (error) {
    console.error('Error loading projects:', error);
    if (mainWindow) {
      mainWindow.webContents.send('projects-error', String(error));
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
  return preferences;
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

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
