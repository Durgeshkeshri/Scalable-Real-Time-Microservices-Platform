const { Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const dotenv = require('dotenv');
const { processTask } = require('./processors/taskProcessor');

// Load environment variables
dotenv.config();

// Redis connection for worker
const redisConnection = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Redis connection for Pub/Sub (separate connection required)
const redisPubSub = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Redis connection event handlers
redisConnection.on('connect', () => {
  console.log('✅ Redis connected (Worker)');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error (Worker):', err);
});

redisPubSub.on('connect', () => {
  console.log('✅ Redis Pub/Sub connected (Worker)');
});

redisPubSub.on('error', (err) => {
  console.error('❌ Redis Pub/Sub connection error:', err);
});

// Worker configuration
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY) || 100;
const WORKER_NAME = process.env.WORKER_NAME || `worker-${process.pid}`;

console.log(`🚀 Starting ${WORKER_NAME} with concurrency: ${CONCURRENCY}`);

// Create worker
const worker = new Worker(
  'tasks',
  async (job) => {
    const startTime = Date.now();
    
    console.log(`[${WORKER_NAME}] 📥 Processing job ${job.id} (${job.name}) - Attempt ${job.attemptsMade + 1}`);

    try {
      // Update progress to 10%
      await job.updateProgress(10);

      // Process the task
      const result = await processTask(job);

      // Update progress to 90%
      await job.updateProgress(90);

      const duration = Date.now() - startTime;
      console.log(`[${WORKER_NAME}] ✅ Job ${job.id} completed in ${duration}ms`);

      // Publish completion event to Redis Pub/Sub
      await publishTaskEvent('task:completed', {
        jobId: job.id,
        taskType: job.name,
        userId: job.data.userId,
        result: result,
        duration,
        completedAt: new Date().toISOString(),
        workerName: WORKER_NAME
      });

      // Update progress to 100%
      await job.updateProgress(100);

      return result;

    } catch (error) {
      console.error(`[${WORKER_NAME}] ❌ Job ${job.id} failed:`, error.message);

      // Publish failure event to Redis Pub/Sub
      await publishTaskEvent('task:failed', {
        jobId: job.id,
        taskType: job.name,
        userId: job.data.userId,
        error: error.message,
        attemptsMade: job.attemptsMade + 1,
        failedAt: new Date().toISOString(),
        workerName: WORKER_NAME
      });

      throw error; // Re-throw for BullMQ retry logic
    }
  },
  {
    connection: redisConnection,
    concurrency: CONCURRENCY,
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    limiter: {
      max: 100, // Max 100 jobs per duration
      duration: 1000 // 1 second
    }
  }
);

// Publish events to Redis Pub/Sub
const publishTaskEvent = async (channel, data) => {
  try {
    const message = JSON.stringify(data);
    await redisPubSub.publish(channel, message);
    console.log(`[${WORKER_NAME}] 📤 Published event to ${channel}:`, data.jobId);
  } catch (error) {
    console.error(`[${WORKER_NAME}] ❌ Failed to publish event:`, error.message);
  }
};

// Queue Events for monitoring
const queueEvents = new QueueEvents('tasks', {
  connection: new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
  })
});

// Event listeners
queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`[${WORKER_NAME}] 🎉 Job ${jobId} completed with result:`, returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.log(`[${WORKER_NAME}] 💥 Job ${jobId} failed: ${failedReason}`);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log(`[${WORKER_NAME}] 📊 Job ${jobId} progress: ${data}%`);
});

// Worker event listeners
worker.on('ready', () => {
  console.log(`[${WORKER_NAME}] ⚡ Worker is ready and waiting for jobs`);
});

worker.on('active', (job) => {
  console.log(`[${WORKER_NAME}] 🔄 Job ${job.id} is now active`);
});

worker.on('stalled', (jobId) => {
  console.warn(`[${WORKER_NAME}] ⚠️  Job ${jobId} has stalled`);
});

worker.on('error', (error) => {
  console.error(`[${WORKER_NAME}] ❌ Worker error:`, error);
});

// Performance metrics
let processedCount = 0;
let failedCount = 0;
let totalProcessingTime = 0;

worker.on('completed', (job, result) => {
  processedCount++;
  if (job.finishedOn && job.processedOn) {
    totalProcessingTime += (job.finishedOn - job.processedOn);
  }
});

worker.on('failed', (job, error) => {
  failedCount++;
});

// Log metrics every 30 seconds
setInterval(() => {
  const avgProcessingTime = processedCount > 0 ? (totalProcessingTime / processedCount).toFixed(2) : 0;
  console.log(`\n[${WORKER_NAME}] 📈 Performance Metrics:`);
  console.log(`  • Processed: ${processedCount} jobs`);
  console.log(`  • Failed: ${failedCount} jobs`);
  console.log(`  • Success Rate: ${processedCount > 0 ? ((processedCount / (processedCount + failedCount)) * 100).toFixed(2) : 0}%`);
  console.log(`  • Avg Processing Time: ${avgProcessingTime}ms`);
  console.log(`  • Throughput: ${(processedCount / 30).toFixed(2)} jobs/sec\n`);
  
  // Reset counters
  processedCount = 0;
  failedCount = 0;
  totalProcessingTime = 0;
}, 30000);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n[${WORKER_NAME}] 🛑 ${signal} received, shutting down gracefully...`);
  
  try {
    await worker.close();
    await queueEvents.close();
    await redisConnection.quit();
    await redisPubSub.quit();
    
    console.log(`[${WORKER_NAME}] ✅ Worker shut down successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`[${WORKER_NAME}] ❌ Error during shutdown:`, error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(`[${WORKER_NAME}] 💀 Uncaught Exception:`, error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${WORKER_NAME}] 💀 Unhandled Rejection at:`, promise, 'reason:', reason);
});

console.log(`[${WORKER_NAME}] 🎯 Worker started successfully. Listening for tasks...`);
