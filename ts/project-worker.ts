import { parentPort } from 'worker_threads';
import { loadProjectsInDirectory } from './project-loading';
import { ProjectInfo } from './types';

// Listen for messages from main thread
if (parentPort) {
  parentPort.on('message', async (message) => {
    const { type, directoryPath, maxDepth } = message;

    if (type === 'load-directory') {
      try {
        // Load projects with callback for incremental updates
        await loadProjectsInDirectory(
          directoryPath,
          maxDepth,
          (project: ProjectInfo) => {
            // Send each project back to main thread as it's found
            if (parentPort) {
              parentPort.postMessage({
                type: 'project-found',
                project: project
              });
            }
          }
        );

        // Signal completion
        if (parentPort) {
          parentPort.postMessage({
            type: 'directory-complete',
            directoryPath: directoryPath
          });
        }
      } catch (error) {
        // Send error back to main thread
        if (parentPort) {
          parentPort.postMessage({
            type: 'error',
            directoryPath: directoryPath,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  });
}
