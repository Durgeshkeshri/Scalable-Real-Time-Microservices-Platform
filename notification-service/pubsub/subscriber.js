/**
 * Redis Pub/Sub Subscriber
 * Listens to task events from worker service and broadcasts to Socket.io clients
 */

const Redis = require('ioredis');

let redisSubscriber = null;

const initializeRedisSubscriber = (io) => {
  
  // Create Redis subscriber connection
  redisSubscriber = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }
  });

  // Connection event handlers
  redisSubscriber.on('connect', () => {
    console.log('✅ Redis Pub/Sub subscriber connected');
  });

  redisSubscriber.on('ready', () => {
    console.log('✅ Redis subscriber ready');
  });

  redisSubscriber.on('error', (err) => {
    console.error('❌ Redis subscriber error:', err);
  });

  redisSubscriber.on('reconnecting', () => {
    console.log('🔄 Redis subscriber reconnecting...');
  });

  // Subscribe to channels
  const channels = ['task:completed', 'task:failed', 'task:started', 'system:broadcast'];
  
  redisSubscriber.subscribe(...channels, (err, count) => {
    if (err) {
      console.error('❌ Failed to subscribe to channels:', err);
      return;
    }
    console.log(`📡 Subscribed to ${count} channel(s):`);
    channels.forEach(channel => console.log(`   • ${channel}`));
  });

  // Handle incoming messages
  redisSubscriber.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      
      console.log(`\n📩 Message received on channel: ${channel}`);
      console.log(`   Job ID: ${data.jobId}`);
      console.log(`   User ID: ${data.userId}`);
      
      // Route messages based on channel
      switch (channel) {
        case 'task:completed':
          handleTaskCompleted(io, data);
          break;
          
        case 'task:failed':
          handleTaskFailed(io, data);
          break;
          
        case 'task:started':
          handleTaskStarted(io, data);
          break;
          
        case 'system:broadcast':
          handleSystemBroadcast(io, data);
          break;
          
        default:
          console.warn(`⚠️  Unknown channel: ${channel}`);
      }
      
    } catch (error) {
      console.error('❌ Error processing message:', error);
      console.error('   Raw message:', message);
    }
  });

  return redisSubscriber;
};

// Handle task completion notification
const handleTaskCompleted = (io, data) => {
  const notification = {
    type: 'success',
    event: 'task:completed',
    title: 'Task Completed Successfully',
    message: `Your ${data.taskType} task has been completed`,
    data: {
      jobId: data.jobId,
      taskType: data.taskType,
      result: data.result,
      duration: data.duration,
      completedAt: data.completedAt,
      workerName: data.workerName
    },
    timestamp: new Date().toISOString()
  };

  // Send to specific user
  if (data.userId && data.userId !== 'anonymous') {
    io.to(`user:${data.userId}`).emit('notification', notification);
    io.to(`user:${data.userId}`).emit('task:completed', notification);
    console.log(`   ✅ Sent to user:${data.userId}`);
  } else {
    // Broadcast to all if no specific user
    io.emit('notification', notification);
    console.log(`   ✅ Broadcast to all users`);
  }
};

// Handle task failure notification
const handleTaskFailed = (io, data) => {
  const notification = {
    type: 'error',
    event: 'task:failed',
    title: 'Task Failed',
    message: `Your ${data.taskType} task has failed`,
    data: {
      jobId: data.jobId,
      taskType: data.taskType,
      error: data.error,
      attemptsMade: data.attemptsMade,
      failedAt: data.failedAt,
      workerName: data.workerName
    },
    timestamp: new Date().toISOString()
  };

  // Send to specific user
  if (data.userId && data.userId !== 'anonymous') {
    io.to(`user:${data.userId}`).emit('notification', notification);
    io.to(`user:${data.userId}`).emit('task:failed', notification);
    console.log(`   ❌ Sent to user:${data.userId}`);
  } else {
    // Broadcast to all if no specific user
    io.emit('notification', notification);
    console.log(`   ❌ Broadcast to all users`);
  }
};

// Handle task started notification (optional)
const handleTaskStarted = (io, data) => {
  const notification = {
    type: 'info',
    event: 'task:started',
    title: 'Task Started',
    message: `Your ${data.taskType} task is being processed`,
    data: {
      jobId: data.jobId,
      taskType: data.taskType,
      startedAt: data.startedAt
    },
    timestamp: new Date().toISOString()
  };

  if (data.userId && data.userId !== 'anonymous') {
    io.to(`user:${data.userId}`).emit('notification', notification);
    console.log(`   🔄 Sent to user:${data.userId}`);
  }
};

// Handle system-wide broadcast
const handleSystemBroadcast = (io, data) => {
  const notification = {
    type: 'info',
    event: 'system:broadcast',
    title: data.title || 'System Announcement',
    message: data.message,
    data: data.data || {},
    timestamp: new Date().toISOString()
  };

  io.emit('notification', notification);
  io.emit('system:broadcast', notification);
  console.log(`   📢 System broadcast sent to all users`);
};

// Close Redis subscriber connection
const closeRedisSubscriber = async () => {
  if (redisSubscriber) {
    await redisSubscriber.quit();
    console.log('✅ Redis subscriber connection closed');
  }
};

module.exports = {
  initializeRedisSubscriber,
  closeRedisSubscriber
};
