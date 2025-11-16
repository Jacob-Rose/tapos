import { contextBridge, ipcRenderer } from 'electron';
import { ProjectInfo } from './types';
import { UserPreferences } from './preferences';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  onProjectsLoading: (callback: () => void) => {
    ipcRenderer.on('projects-loading', callback);
  },
  onProjectsLoaded: (callback: (projects: ProjectInfo[]) => void) => {
    ipcRenderer.on('projects-loaded', (_event, projects) => callback(projects));
  },
  onProjectsError: (callback: (error: string) => void) => {
    ipcRenderer.on('projects-error', (_event, error) => callback(error));
  },
  onOpenPreferences: (callback: () => void) => {
    ipcRenderer.on('open-preferences', callback);
  },
  getPreferences: (): Promise<UserPreferences> => {
    return ipcRenderer.invoke('get-preferences');
  },
  setPreferences: (preferences: UserPreferences): Promise<UserPreferences> => {
    return ipcRenderer.invoke('set-preferences', preferences);
  }
});

// Also expose version info for debugging
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});
