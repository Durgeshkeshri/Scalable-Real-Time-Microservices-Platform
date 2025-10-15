const { Queue } = require('bullmq');
const Redis = require('ioredis');

// Redis connection
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

// Create task queue
const taskQueue = new Queue('tasks', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600 // 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600 // 7 days
    }
  }
});

// Redis connection event handlers
redisConnection.on('connect', () => {
  console.log('✅ Redis connected (Producer)');
});

redisConnection.on('error', (err) => {
  console.error('❌ Redis connection error (Producer):', err);
});

// Add task to queue
const addTaskToQueue = async (taskData) => {
  try {
    const { type, data, priority = 5, userId } = taskData;

    const job = await taskQueue.add(
      type, // job name
      {
        type,
        data,
        userId,
        createdAt: new Date().toISOString()
      },
      {
        priority: 10 - priority, // BullMQ: lower number = higher priority
        jobId: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }
    );

    console.log(`📤 Task added to queue: ${job.id} (Type: ${type}, Priority: ${priority})`);
    
    return job;
  } catch (error) {
    console.error('Error adding task to queue:', error);
    throw error;
  }
};

// Get task status
const getTaskStatus = async (taskId) => {
  try {
    const job = await taskQueue.getJob(taskId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;
    
    return {
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
      createdAt: new Date(job.timestamp).toISOString(),
      processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      failedReason: job.failedReason,
      returnValue: job.returnvalue
    };
  } catch (error) {
    console.error('Error getting task status:', error);
    throw error;
  }
};

// Get queue stats
const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      taskQueue.getWaitingCount(),
      taskQueue.getActiveCount(),
      taskQueue.getCompletedCount(),
      taskQueue.getFailedCount(),
      taskQueue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed
    };
  } catch (error) {
    console.error('Error getting queue stats:', error);
    throw error;
  }
};

// Graceful shutdown
const closeQueue = async () => {
  await taskQueue.close();
  await redisConnection.quit();
  console.log('Queue and Redis connection closed');
};

process.on('SIGTERM', closeQueue);
process.on('SIGINT', closeQueue);

module.exports = {
  taskQueue,
  addTaskToQueue,
  getTaskStatus,
  getQueueStats,
  closeQueue
};
