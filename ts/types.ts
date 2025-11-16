export interface TrackInfo {
  name: string;
  type: 'Audio' | 'MIDI' | 'Return' | 'Master' | 'Unknown';
  colorId: number;
}

export interface ProjectInfo {
  name: string;
  filePath: string;
  trackCount: number;
  tracks: TrackInfo[];
  lastModified: Date;
  longestTrackLength?: number; // in seconds
}
