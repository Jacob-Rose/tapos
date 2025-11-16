export interface UserPreferences {
  hideReturnTracks: boolean;
  hideMasterTrack: boolean;
}

export const defaultPreferences: UserPreferences = {
  hideReturnTracks: false,
  hideMasterTrack: false
};
