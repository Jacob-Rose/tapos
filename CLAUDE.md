# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TALON (Tool for Ableton Library Organization and Navigation)** is an Electron-based desktop application designed to navigate, label, store, modify, track, and transfer Ableton Live projects. The application extracts useful information from Ableton project files (.als) and displays them in a grid-based interface.

This is a migration/rewrite from an earlier JUCE-based C++ implementation (found in `talon-juce/`) to a modern Electron + TypeScript architecture.

## Development Commands

### Start the Application
```bash
npm start
```
Launches the Electron application using electron-forge.

### Build the Application
```bash
npm run package
```
Packages the application for distribution.

### Create Distributables
```bash
npm run make
```
Creates platform-specific installers (Windows Squirrel, macOS ZIP, Linux DEB/RPM).

### TypeScript Compilation
TypeScript files in `ts/` are compiled to `js/generated/` according to `tsconfig.json`. Currently the project has TypeScript source files but the main process still uses plain JavaScript files in the root directory.

## Architecture

### Main Process (Electron)
- **Entry Point**: `main.js` (should eventually use `js/generated/main.js` from TypeScript)
- **Menu System**: File menu with "Open Project" to select directories containing Ableton projects
- **Storage**: Uses `electron-store` to persist the last selected directory
- **Project Loading**: Orchestrates scanning directories for `.als` files

### Renderer Process
- **Entry Point**: `index.html`
- **Preload Script**: `preload.js` - Exposes version information to renderer
- **UI**: Currently minimal, contains a template for project cards but not yet implemented

### TypeScript Source Files (`ts/`)
- **`main.ts`**: TypeScript version of main process entry point (mirrors `main.js`)
- **`project-loading.ts`**: Handles recursive directory scanning and project file processing

### Project File Processing Flow

1. **Directory Selection**: User selects folder via File > Open Project
2. **Recursive Scanning**: `loadProjectsInDirectory()` recursively finds all `.als` files
3. **Decompression**: `.als` files are gzipped XML; they're decompressed using zlib
4. **XML Parsing**: Uncompressed XML is parsed using `xml2js`
5. **Data Storage**: Parsed project info should be stored and displayed (not yet implemented)

### Key Dependencies

- **electron-store**: Persistent key-value storage
- **fast-xml-parser** & **xml2js**: XML parsing (both are included, choose one)
- **zlib**: Decompressing .als files (Ableton files are gzipped XML)

### JUCE Reference Implementation (`talon-juce/`)

The JUCE codebase provides reference for the desired functionality:

**Key Components**:
- **`AbletonFile`** (`Source/Ableton/AbletonFile.h/.cpp`): Represents an Ableton project file
  - Decompresses .als files to XML
  - Parses track information (name, color, type)
  - Extracts project metadata

- **`ProjectTile`** (`Source/ProjectListBox/ProjectTile.h/.cpp`): Visual card for each project
  - Displays project name
  - Shows track list with color-coded bars
  - Renders in a grid layout

- **`ProjectListBox`** (`Source/ProjectListBox/ProjectListView.h/.cpp`): Grid container
  - Uses JUCE Grid layout with 3 columns
  - Implements viewport with scrolling
  - Updates dynamically when projects are loaded

- **`ProjectFileManager`**: Singleton that manages the list of loaded projects
- **`AbletonColorPalette`**: Maps Ableton's predefined color IDs to RGB values

### Desired Features (from JUCE README)

**Core Features**:
- Track breakdown showing all tracks in a project
- Track prerequisite analysis (required plugins, missing samples)
- Project prerequisite breakdown
- Custom extraction settings for transferring projects
- Cleaning utility to remove unused samples
- Version control integration (git for uncompressed XML)

**MVP Target**:
- Scroll grid with per-project breakdown
- Display critical info: track count, track names, longest track length
- Visual project cards similar to JUCE implementation

## Current State (MVP COMPLETE!)

### What Works ✅
- Electron application with TypeScript source
- Directory selection via File > Open Project Folder
- Recursive `.als` file discovery
- Decompression of `.als` to XML
- Full XML parsing with track extraction
- IPC communication (main → renderer)
- Grid layout with responsive project cards
- Track display with type badges (Audio/MIDI/Return/Master)
- Beautiful gradient UI with smooth animations
- Empty state when no projects loaded

### Implementation Details
- **TypeScript Source**: All logic in `ts/` directory, compiled to `js/generated/`
- **Type Safety**: Interfaces defined in `ts/types.ts` for ProjectInfo and TrackInfo
- **Parser**: `ts/project-loading.ts` handles .als decompression and XML parsing
- **Main Process**: `ts/main.ts` orchestrates directory scanning and IPC
- **Preload**: `ts/preload.ts` exposes safe IPC methods via contextBridge
- **Renderer**: `renderer.js` creates dynamic project cards
- **Styling**: `styles.css` with modern gradient design

### Known Limitations
- Longest track length not yet extracted (need to parse timeline data from XML)
- No project sorting/filtering
- No search functionality
- Performance untested with large project libraries (100+ projects)

### Working with Ableton .als Files

**.als File Structure**:
- Gzip-compressed XML document
- Must decompress first, then parse XML
- Contains nested structure with LiveSet > Tracks > Track elements
- Each track has: Name, Color ID, Type (Audio/MIDI/Return/Master)

**Processing Steps**:
1. Create read stream from `.als` file
2. Pipe through `zlib.createUnzip()`
3. Write to temporary XML file or parse stream directly
4. Parse XML to extract track information
5. Store structured data for UI rendering

## File Structure

```
talon-electron/
├── main.js              # Main process entry (active)
├── preload.js           # Preload script
├── project-loading.js   # Project scanning logic (active)
├── index.html           # Renderer HTML
├── package.json         # Dependencies & scripts
├── tsconfig.json        # TypeScript configuration
├── forge.config.js      # Electron Forge config
├── ts/                  # TypeScript sources
│   ├── main.ts
│   └── project-loading.ts
├── js/generated/        # Compiled TypeScript output
└── talon-juce/          # JUCE reference implementation (C++)
    └── Source/
        ├── Ableton/
        ├── ProjectListBox/
        └── Managers/
```
