import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import { ProjectInfo } from './types';

export class WorkerPool {
  private workers: Worker[] = [];
  private queue: string[] = [];
  private activeCount: number = 0;
  private onProjectFound: (project: ProjectInfo) => void;
  private onComplete: () => void;
  private onError: (filePath: string, error: string) => void;
  private totalFiles: number = 0;
  private processedFiles: number = 0;

  constructor(
    poolSize: number = os.cpus().length,
    onProjectFound: (project: ProjectInfo) => void,
    onComplete: () => void,
    onError: (filePath: string, error: string) => void
  ) {
    this.onProjectFound = onProjectFound;
    this.onComplete = onComplete;
    this.onError = onError;

    // Create worker pool
    const workerPath = path.join(__dirname, 'file-worker.js');
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerPath);

      worker.on('message', (message) => {
        this.handleWorkerMessage(worker, message);
      });

      worker.on('error', (error) => {
        console.error('Worker error:', error);
        this.activeCount--;
        this.processNext(worker);
      });

      this.workers.push(worker);
    }

    console.log(`Worker pool created with ${poolSize} workers`);
  }

  /**
   * Add files to processing queue
   */
  addFiles(files: string[]): void {
    this.queue.push(...files);
    this.totalFiles += files.length;
  }

  /**
   * Start processing the queue
   */
  start(): void {
    console.log(`Starting worker pool with ${this.queue.length} files`);

    // Start all workers
    this.workers.forEach(worker => {
      this.processNext(worker);
    });
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(worker: Worker, message: any): void {
    if (message.type === 'file-parsed') {
      this.processedFiles++;
      this.activeCount--;
      this.onProjectFound(message.project);
      this.processNext(worker);
    } else if (message.type === 'file-error') {
      this.processedFiles++;
      this.activeCount--;
      this.onError(message.filePath, message.error);
      this.processNext(worker);
    }
  }

  /**
   * Process next file in queue with given worker
   */
  private processNext(worker: Worker): void {
    if (this.queue.length > 0) {
      const filePath = this.queue.shift()!;
      this.activeCount++;

      worker.postMessage({
        type: 'parse-file',
        filePath: filePath
      });
    } else if (this.activeCount === 0 && this.queue.length === 0) {
      // All done!
      this.terminate();
      this.onComplete();
    }
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    console.log(`Worker pool processed ${this.processedFiles}/${this.totalFiles} files`);
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
  }
}
