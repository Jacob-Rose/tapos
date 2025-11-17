# JAPOS - **Jakes Audio Project Organization System**

> **⚠️ NOTE: This project was vibe coded** - Don't judge my code quality on this, i made this in a day.

JAPOS is a modern desktop application built with Electron and TypeScript that helps you organize, visualize, and manage your Ableton Live projects (with other DAWs planned for future). Quickly browse through your entire project library, see track breakdowns, and filter your view to focus on what matters.

## Features

### 🎵 Project Analysis
- **Automatic scanning** of `.als` files in any directory (recursive)
- **Track extraction** showing all Audio, MIDI, Return, and Master tracks
- **Last modified dates** with smart formatting (Today, Yesterday, etc.)
- **Track count** and detailed breakdowns for each project

### 🎨 Beautiful Interface
- **Grid layout** with responsive project cards
- **Color-coded track badges** for easy identification
  - 🔴 Audio tracks
  - 🔵 MIDI tracks
  - 🟡 Return tracks
  - 🟣 Master track
- **Smooth animations** and hover effects

### ⚙️ Customizable Preferences
- **Filter tracks** by type (hide returns/master)
- **Persistent settings** across sessions
- **Real-time updates** when preferences change

## Screenshots

<!-- TODO: Add screenshots here -->

*Screenshots coming soon*

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd talon-electron
```

2. Install dependencies:
```bash
npm install
```

3. Build TypeScript files:
```bash
npm run build
```

4. Start the application:
```bash
npm start
```

## Usage

1. **Open a project folder**: Go to `File > Open Project Folder` and select a directory containing Ableton projects
2. **Browse projects**: Scroll through the grid to see all your projects with their track breakdowns
3. **Customize view**: Open `File > Preferences` to hide return tracks or master tracks
4. **Click on cards**: (Future) Click project cards to see more details or open in Ableton

## Development

### Project Structure

```
talon-electron/
├── ts/                      # TypeScript source files
│   ├── main.ts             # Main process (Electron)
│   ├── preload.ts          # Preload script (IPC bridge)
│   ├── project-loading.ts  # .als file parser
│   ├── types.ts            # TypeScript interfaces
│   └── preferences.ts      # User preferences
├── js/generated/           # Compiled JavaScript
├── styles.css              # UI styling
├── renderer.js             # Renderer process
├── index.html              # Main window HTML
└── CLAUDE.md              # Development documentation
```

### Tech Stack

- **Electron** - Cross-platform desktop framework
- **TypeScript** - Type-safe development
- **fast-xml-parser** - XML parsing for .als files
- **electron-store** - Persistent settings storage
- **electron-forge** - Build and packaging

### Build Commands

```bash
# Compile TypeScript
npm run build

# Watch mode (auto-compile on changes)
npm run watch

# Start application
npm start

# Package for distribution
npm run package

# Create installers
npm run make
```

### Development Workflow

1. Make changes to TypeScript files in `ts/`
2. Run `npm run build` or `npm run watch`
3. Test with `npm start`
4. Commit to `dev` branch
5. Merge to `main` when ready

## How It Works

### Ableton File Parsing

Ableton Live project files (`.als`) are actually **gzipped XML** files. JAPOS:

1. Recursively scans directories for `.als` files
2. Decompresses each file using zlib
3. Parses the XML structure to extract:
   - Track names
   - Track types (Audio/MIDI/Return/Master)
   - Track colors
   - Project metadata
4. Displays everything in a beautiful grid interface

## Contributing

This is a personal project, but suggestions and feedback are welcome! Feel free to open issues for bugs or feature requests.