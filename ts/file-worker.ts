import { parentPort } from 'worker_threads';
import * as zlib from 'zlib';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ProjectInfo, TrackInfo } from './types';

// Timeout for parsing a single project file (30 seconds)
const PROJECT_PARSE_TIMEOUT = 30000;

/**
 * Parse a single .als project file
 */
async function parseProject(projectPath: string): Promise<ProjectInfo> {
  const projectDir = path.dirname(projectPath);
  const projectFile = path.basename(projectPath);
  const projectName = projectFile.replace('.als', '');

  // Get file stats for last modified date (async)
  const stats = await fsp.stat(projectPath);
  const lastModified = stats.mtime;

  // Create temp directory if it doesn't exist (async)
  const tempDir = path.join(projectDir, 'Ableton Project Info');
  await fsp.mkdir(tempDir, { recursive: true });

  const outputPath = path.join(tempDir, projectFile.replace('.als', '.xml'));

  // Decompress the .als file (it's gzipped XML)
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(projectPath);
    const output = fs.createWriteStream(outputPath);
    const unzip = zlib.createUnzip();

    input.pipe(unzip).pipe(output);

    output.on('finish', async () => {
      try {
        // Read and parse the XML (async)
        const xmlData = await fsp.readFile(outputPath, 'utf-8');
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '@_'
        });

        const parsed = parser.parse(xmlData);

        // Extract track information
        const tracks: TrackInfo[] = [];

        // Navigate the XML structure to find tracks
        const liveSet = parsed.Ableton?.LiveSet;
        if (liveSet && liveSet.Tracks) {
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

        resolve(projectInfo);

      } catch (error) {
        reject(error);
      }
    });

    output.on('error', (error) => {
      reject(error);
    });

    input.on('error', (error) => {
      reject(error);
    });
  });
}

// Listen for messages from main thread
if (parentPort) {
  parentPort.on('message', async (message) => {
    const { type, filePath } = message;

    if (type === 'parse-file') {
      try {
        // Parse with timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), PROJECT_PARSE_TIMEOUT);
        });

        const project = await Promise.race([
          parseProject(filePath),
          timeoutPromise
        ]);

        // Send result back
        if (parentPort) {
          parentPort.postMessage({
            type: 'file-parsed',
            project: project
          });
        }
      } catch (error) {
        // Send error back
        if (parentPort) {
          parentPort.postMessage({
            type: 'file-error',
            filePath: filePath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  });
}
