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
  onProjectAdded: (callback: (project: ProjectInfo) => void) => {
    ipcRenderer.on('project-added', (_event, project) => callback(project));
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
  },
  selectDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke('select-directory');
  },
  onSafeModeStatus: (callback: (isSafeMode: boolean) => void) => {
    ipcRenderer.on('safe-mode-status', (_event, isSafeMode) => callback(isSafeMode));
  },
  manualLoadProjects: (): Promise<boolean> => {
    return ipcRenderer.invoke('manual-load-projects');
  }
});

// Also expose version info for debugging
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
});
