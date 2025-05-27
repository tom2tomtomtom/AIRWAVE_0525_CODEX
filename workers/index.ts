// workers/index.ts
import { Worker } from 'bullmq';
import { connection } from '@/lib/queue/connection';
import { renderWorker } from './render';
import { emailWorker } from './email';

// Parse command line arguments
const args = process.argv.slice(2);
const onlyWorker = args.find(arg => arg.startsWith('--only='))?.split('=')[1];

async function startWorkers() {
  console.log('Starting workers...');
  
  const workers: Worker[] = [];
  
  // Start render worker
  if (!onlyWorker || onlyWorker === 'render') {
    workers.push(renderWorker);
    console.log('✓ Render worker started');
  }
  
  // Start email worker
  if (!onlyWorker || onlyWorker === 'email') {
    workers.push(emailWorker);
    console.log('✓ Email worker started');
  }
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down workers...');
    await Promise.all(workers.map(worker => worker.close()));
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('Shutting down workers...');
    await Promise.all(workers.map(worker => worker.close()));
    process.exit(0);
  });
}

startWorkers().catch(error => {
  console.error('Failed to start workers:', error);
  process.exit(1);
});