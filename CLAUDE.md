# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TAPOS (That Audio Project Organization System)** is an Electron-based desktop application for managing Ableton Live projects. It scans directories for `.als` files, extracts track information, and displays projects in a filterable grid interface.

This was migrated from an earlier JUCE-based C++ implementation (found in `talon-juce/`) to Electron + TypeScript.

## Core Architecture

### Process Model

**Main Process** (`ts/main.ts` → `js/generated/main.js`)
- Manages application lifecycle and native OS integration
- Handles file system operations (scanning directories)
- Stores user preferences via `electron-store`
- Communicates with renderer via IPC

**Renderer Process** (`index.html` + `renderer.js`)
- Renders UI using HTML/CSS
- Receives project data via IPC events
- Manages user interactions and preferences modal
- No direct file system access (security via context isolation)

**Preload Script** (`ts/preload.ts` → `js/generated/preload.js`)
- Bridges main ↔ renderer with `contextBridge`
- Exposes safe IPC methods to renderer
- Maintains context isolation for security

### Data Flow

```
User selects folder
    ↓
Main Process: loadProjectsInDirectory()
    ↓
For each .als file:
  - Decompress (gzipped XML)
  - Parse XML structure
  - Extract tracks & metadata
    ↓
Main Process: IPC send 'projects-loaded'
    ↓
Renderer: Receive projects array
    ↓
Renderer: Filter based on user preferences
    ↓
Renderer: Render project cards in grid
```

## TypeScript Structure

### Type Definitions (`ts/types.ts`)

```typescript
interface TrackInfo {
  name: string;
  type: 'Audio' | 'MIDI' | 'Return' | 'Master' | 'Unknown';
  colorId: number;
}

interface ProjectInfo {
  name: string;
  filePath: string;
  trackCount: number;
  tracks: TrackInfo[];
  lastModified: Date;
}
```

### User Preferences (`ts/preferences.ts`)

```typescript
interface UserPreferences {
  hideReturnTracks: boolean;
  hideMasterTrack: boolean;
}
```

Stored persistently in `electron-store`. Loaded on startup and applied as filters in renderer.

## Ableton File Format

### .als File Structure

Ableton Live project files are **gzipped XML documents**:

```
.als file → gzip decompress → XML → parse → project data
```

**XML Hierarchy**:
```
Ableton
  └── LiveSet
      └── Tracks
          ├── AudioTrack[]
          ├── MidiTrack[]
          ├── ReturnTrack[]
          └── MasterTrack
```

**Track Data Extraction** (`ts/project-loading.ts`):
- Iterate through track types (AudioTrack, MidiTrack, etc.)
- Extract `Name.EffectiveName` or `Name.UserName`
- Extract `Color` attribute (Ableton color palette ID)
- Map track type to enum

### Parsing Pipeline

1. **Scan**: Recursively find `.als` files, skip `Backup/` folders
2. **Decompress**: `fs.createReadStream` → `zlib.createUnzip` → `fs.createWriteStream`
3. **Parse**: `fast-xml-parser` with attribute preservation
4. **Extract**: Navigate XML tree to find track arrays
5. **Return**: Structured `ProjectInfo` objects

## UI Architecture

### Grid Layout (`styles.css`)

- CSS Grid with `repeat(auto-fill, minmax(350px, 1fr))`
- Cards expand/contract based on viewport width
- Smooth hover animations with transforms

### Project Card Components

**Structure**:
```
.project-card
  ├── h3 (project name)
  ├── .project-info
  │   ├── Last Modified
  │   ├── Track Count (filtered)
  │   └── File Name
  └── .tracks-section
      └── .tracks-list (scrollable)
          └── .track-item[] (color-coded badges)
```

**Track Type Styling**:
- Audio: Red (#ff6b6b)
- MIDI: Teal (#4ecdc4)
- Return: Yellow (#ffd93d)
- Master: Purple (#a29bfe)

### Filtering Mechanism

Tracks are filtered **in the renderer** before display:
```javascript
filterTracks(tracks) {
  return tracks.filter(track => {
    if (preferences.hideReturnTracks && track.type === 'Return') return false;
    if (preferences.hideMasterTrack && track.type === 'Master') return false;
    return true;
  });
}
```

Track counts reflect filtered results.

## IPC Communication

### Main → Renderer Events

```javascript
// Loading started
webContents.send('projects-loading')

// Projects parsed and ready
webContents.send('projects-loaded', projects: ProjectInfo[])

// Error occurred
webContents.send('projects-error', error: string)

// Open preferences modal
webContents.send('open-preferences')
```

### Renderer → Main Handlers

```javascript
// Get stored preferences
ipcMain.handle('get-preferences') → UserPreferences

// Save new preferences
ipcMain.handle('set-preferences', preferences) → void
```

## Key Patterns

### Async Project Loading

Projects are loaded asynchronously to avoid blocking the UI:
```typescript
async function loadProjectsInDirectory(dir: string): Promise<ProjectInfo[]> {
  // Recursively scan directories
  // Parse each .als file in parallel
  // Return aggregated results
}
```

### Preferences Persistence

User settings are saved immediately on change:
```typescript
// Save
store.set('preferences', newPreferences);

// Load on startup
const prefs = store.get('preferences', defaultPreferences);
```

### Modal Management

Preferences modal uses visibility classes:
```javascript
modal.classList.add('visible')    // Show
modal.classList.remove('visible') // Hide
```

Click outside or cancel/save buttons trigger close.

## Development Workflow

### Build Process

```bash
npm run build    # Compile TypeScript (ts/ → js/generated/)
npm run watch    # Auto-compile on file changes
npm start        # Build + launch Electron
```

### File Organization

```
ts/                     # TypeScript source (canonical)
├── main.ts            # Main process logic
├── preload.ts         # IPC bridge
├── project-loading.ts # .als parser
├── types.ts           # Shared interfaces
├── preferences.ts     # Preferences types
└── renderer.d.ts      # Window interface declarations

js/generated/          # Compiled output (gitignored)

renderer.js            # Renderer logic (plain JS)
styles.css             # All UI styling
index.html             # App window structure
```

### Adding New Features

**New Track Filter**:
1. Add boolean to `UserPreferences` interface
2. Add checkbox to preferences modal in `index.html`
3. Update `filterTracks()` in `renderer.js`
4. Preferences auto-persist via existing handlers

**New Project Metadata**:
1. Add field to `ProjectInfo` interface
2. Extract data in `parseProject()` function
3. Display in `createProjectCard()` renderer function

## Dependencies

- **electron**: Cross-platform desktop framework
- **electron-forge**: Build tooling and packaging
- **electron-store**: Simple persistent storage
- **fast-xml-parser**: XML parsing with attribute support
- **typescript**: Type-safe development
- **zlib**: Built-in Node.js decompression

## Future Roadmap

Features planned but not yet implemented:

- **Search/Sort**: Filter projects by name, date, track count
- **Project Opening**: Launch Ableton with selected project
- **Sample Analysis**: Detect missing samples and plugins
- **Timeline Length**: Extract and display project duration
- **Export**: Generate project reports or transfer packages
- **Settings**: Additional preferences (theme, layout density)

## JUCE Reference Code

The `talon-juce/` folder contains the original C++ implementation. Key insights:

- **AbletonColorPalette**: Maps color IDs to RGB (useful for future enhancements)
- **Track Rendering**: JUCE renders tracks as colored bars (we use badges)
- **Grid Layout**: 3-column grid with object pooling for performance

Reference but don't copy directly - the Electron version uses web technologies with different patterns.
