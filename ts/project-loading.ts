import * as zlib from 'zlib';
import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ProjectInfo, TrackInfo } from './types';

// Parse a single .als project file
function parseProject(projectPath: string): Promise<ProjectInfo> {
  return new Promise((resolve, reject) => {
    const projectDir = path.dirname(projectPath);
    const projectFile = path.basename(projectPath);
    const projectName = projectFile.replace('.als', '');

    // Get file stats for last modified date
    const stats = fs.statSync(projectPath);
    const lastModified = stats.mtime;

    // Create temp directory if it doesn't exist
    const tempDir = path.join(projectDir, 'Ableton Project Info');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputPath = path.join(tempDir, projectFile.replace('.als', '.xml'));

    // Decompress the .als file (it's gzipped XML)
    const input = fs.createReadStream(projectPath);
    const output = fs.createWriteStream(outputPath);
    const unzip = zlib.createUnzip();

    input.pipe(unzip).pipe(output);

    output.on('finish', () => {
      try {
        // Read and parse the XML
        const xmlData = fs.readFileSync(outputPath, 'utf-8');
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_'
        });

        const parsed = parser.parse(xmlData);

        // Extract track information
        const tracks: TrackInfo[] = [];

        // Navigate the XML structure to find tracks
        // Typical structure: Ableton > LiveSet > Tracks
        const liveSet = parsed.Ableton?.LiveSet;
        if (liveSet && liveSet.Tracks) {
          // Handle different track types
          const trackTypes = ['AudioTrack', 'MidiTrack', 'ReturnTrack', 'MasterTrack'];

          for (const trackType of trackTypes) {
            const trackArray = liveSet.Tracks[trackType];
            if (trackArray) {
              const tracksOfType = Array.isArray(trackArray) ? trackArray : [trackArray];

              for (const track of tracksOfType) {
                if (track && track.Name) {
                  const trackName = track.Name.EffectiveName?.['@_Value'] ||
                                   track.Name.UserName?.['@_Value'] ||
                                   'Unnamed Track';

                  const colorId = parseInt(track.Color?.['@_Value'] || '0', 10);

                  let type: TrackInfo['type'] = 'Unknown';
                  if (trackType === 'AudioTrack') type = 'Audio';
                  else if (trackType === 'MidiTrack') type = 'MIDI';
                  else if (trackType === 'ReturnTrack') type = 'Return';
                  else if (trackType === 'MasterTrack') type = 'Master';

                  tracks.push({
                    name: trackName,
                    type: type,
                    colorId: colorId
                  });
                }
              }
            }
          }
        }

        const projectInfo: ProjectInfo = {
          name: projectName,
          filePath: projectPath,
          trackCount: tracks.length,
          tracks: tracks,
          lastModified: lastModified
        };

        console.log(`Parsed project: ${projectName} with ${tracks.length} tracks`);
        resolve(projectInfo);

      } catch (error) {
        console.error(`Error parsing XML for ${projectPath}:`, error);
        reject(error);
      }
    });

    output.on('error', (error) => {
      console.error(`Error writing XML for ${projectPath}:`, error);
      reject(error);
    });

    input.on('error', (error) => {
      console.error(`Error reading project file ${projectPath}:`, error);
      reject(error);
    });
  });
}

// Recursively scan directory for .als files and parse them
export async function loadProjectsInDirectory(directoryPath: string): Promise<ProjectInfo[]> {
  const allProjects: ProjectInfo[] = [];

  async function scanDirectory(dirPath: string) {
    const files = fs.readdirSync(dirPath);
    const alsFiles = files.filter(file => path.extname(file) === '.als');

    // Parse .als files in this directory
    for (const alsFile of alsFiles) {
      const filePath = path.join(dirPath, alsFile);
      // Skip files in Backup directories
      if (!filePath.includes('Backup')) {
        try {
          const projectInfo = await parseProject(filePath);
          allProjects.push(projectInfo);
        } catch (error) {
          console.error(`Failed to parse ${filePath}:`, error);
        }
      }
    }

    // Recursively scan subdirectories
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      if (fs.lstatSync(filePath).isDirectory() && file !== 'Ableton Project Info' && file !== 'Backup') {
        await scanDirectory(filePath);
      }
    }
  }

  await scanDirectory(directoryPath);
  return allProjects;
}
