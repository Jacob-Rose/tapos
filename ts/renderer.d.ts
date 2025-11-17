import { ProjectInfo } from './types';
import { UserPreferences } from './preferences';

export interface ElectronAPI {
  onProjectsLoading: (callback: () => void) => void;
  onProjectsLoaded: (callback: (projects: ProjectInfo[]) => void) => void;
  onProjectAdded: (callback: (project: ProjectInfo) => void) => void;
  onProjectsError: (callback: (error: string) => void) => void;
  onOpenPreferences: (callback: () => void) => void;
  getPreferences: () => Promise<UserPreferences>;
  setPreferences: (preferences: UserPreferences) => Promise<UserPreferences>;
  selectDirectory: () => Promise<string | null>;
  onSafeModeStatus: (callback: (isSafeMode: boolean) => void) => void;
  manualLoadProjects: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    versions: {
      node: () => string;
      chrome: () => string;
      electron: () => string;
    };
  }
}
