import * as fsp from 'fs/promises';
import * as path from 'path';

/**
 * Recursively scan directory for .als files (without parsing them)
 */
export async function scanForALSFiles(
  directoryPath: string,
  maxDepth: number = 1
): Promise<string[]> {
  const alsFiles: string[] = [];

  async function scanDirectory(dirPath: string, currentDepth: number = 0) {
    try {
      // Use async readdir
      const files = await fsp.readdir(dirPath);

      // Check each file
      for (const file of files) {
        const filePath = path.join(dirPath, file);

        // Skip backup directories
        if (file === 'Backup' || file === 'Ableton Project Info') {
          continue;
        }

        try {
          const stat = await fsp.lstat(filePath);

          if (stat.isDirectory()) {
            // Recurse into subdirectories if not at max depth
            if (currentDepth < maxDepth) {
              await scanDirectory(filePath, currentDepth + 1);
            }
          } else if (path.extname(file) === '.als') {
            // Found an .als file
            alsFiles.push(filePath);
          }

          // Yield to event loop periodically
          if (alsFiles.length % 10 === 0) {
            await new Promise(resolve => setImmediate(resolve));
          }
        } catch (error) {
          console.error(`Error accessing ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
  }

  await scanDirectory(directoryPath, 0);
  return alsFiles;
}
