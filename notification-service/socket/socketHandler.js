/**
 * Socket.io Connection Handler
 * Manages WebSocket connections, rooms, and real-time notifications
 */

let connectedClients = new Map(); // Track connected clients: socketId -> userId

const initializeSocketHandlers = (io) => {
  
  // Track total connections
  let totalConnections = 0;
  let peakConnections = 0;
  
  // Connection event
  io.on('connection', (socket) => {
    totalConnections++;
    const currentConnections = io.engine.clientsCount;
    
    if (currentConnections > peakConnections) {
      peakConnections = currentConnections;
    }
    
    console.log(`\n🔌 New client connected`);
    console.log(`   Socket ID: ${socket.id}`);
    console.log(`   Transport: ${socket.conn.transport.name}`);
    console.log(`   Total connections: ${currentConnections}`);
    console.log(`   Peak connections: ${peakConnections}\n`);

    // Send welcome message
    socket.emit('connected', {
      message: 'Successfully connected to notification service',
      socketId: socket.id,
      timestamp: new Date().toISOString()
    });

    // Handle user identification
    socket.on('identify', (data) => {
      const { userId, username } = data;
      
      // Store user info
      socket.userId = userId;
      socket.username = username || userId;
      
      // Track in map
      connectedClients.set(socket.id, {
        userId,
        username: socket.username,
        connectedAt: new Date().toISOString()
      });
      
      // Join user-specific room
      socket.join(`user:${userId}`);
      
      console.log(`👤 User identified: ${socket.username} (${userId})`);
      console.log(`   Joined room: user:${userId}`);
      
      socket.emit('identified', {
        userId,
        username: socket.username,
        room: `user:${userId}`,
        timestamp: new Date().toISOString()
      });
    });

    // Handle joining custom rooms
    socket.on('join_room', (data) => {
      const { room } = data;
      
      socket.join(room);
      console.log(`📥 Socket ${socket.id} joined room: ${room}`);
      
      socket.emit('room_joined', {
        room,
        message: `Successfully joined room: ${room}`,
        timestamp: new Date().toISOString()
      });
      
      // Notify others in the room
      socket.to(room).emit('user_joined_room', {
        socketId: socket.id,
        username: socket.username || 'Anonymous',
        room,
        timestamp: new Date().toISOString()
      });
    });

    // Handle leaving rooms
    socket.on('leave_room', (data) => {
      const { room } = data;
      
      socket.leave(room);
      console.log(`📤 Socket ${socket.id} left room: ${room}`);
      
      socket.emit('room_left', {
        room,
        message: `Successfully left room: ${room}`,
        timestamp: new Date().toISOString()
      });
      
      // Notify others in the room
      socket.to(room).emit('user_left_room', {
        socketId: socket.id,
        username: socket.username || 'Anonymous',
        room,
        timestamp: new Date().toISOString()
      });
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString()
      });
    });

    // Handle custom notification request
    socket.on('request_notification', (data) => {
      console.log(`📬 Notification requested by ${socket.id}:`, data);
      
      socket.emit('notification', {
        type: 'custom',
        title: data.title || 'Notification',
        message: data.message || 'You have a new notification',
        data: data.data || {},
        timestamp: new Date().toISOString()
      });
    });

    // Handle broadcast to all users
    socket.on('broadcast', (data) => {
      if (socket.userId) {
        console.log(`📢 Broadcasting message from user ${socket.userId}`);
        
        io.emit('broadcast_message', {
          from: socket.username || socket.userId,
          message: data.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      const currentConnections = io.engine.clientsCount;
      
      console.log(`\n❌ Client disconnected`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   User: ${socket.username || 'Unknown'}`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Remaining connections: ${currentConnections}\n`);
      
      // Remove from tracking
      connectedClients.delete(socket.id);
      
      // Notify others if user was identified
      if (socket.userId) {
        socket.broadcast.emit('user_disconnected', {
          userId: socket.userId,
          username: socket.username,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error);
    });
  });

  // Log statistics every 60 seconds
  setInterval(() => {
    const rooms = Array.from(io.sockets.adapter.rooms.keys())
      .filter(room => !io.sockets.adapter.sids.has(room));
    
    console.log(`\n📊 Notification Service Stats:`);
    console.log(`   • Connected Clients: ${io.engine.clientsCount}`);
    console.log(`   • Peak Connections: ${peakConnections}`);
    console.log(`   • Total Connections (since start): ${totalConnections}`);
    console.log(`   • Active Rooms: ${rooms.length}`);
    console.log(`   • Tracked Users: ${connectedClients.size}\n`);
  }, 60000);

  return io;
};

// Helper function to send notification to specific user
const sendNotificationToUser = (io, userId, notification) => {
  io.to(`user:${userId}`).emit('notification', notification);
  console.log(`📨 Notification sent to user:${userId}`);
};

// Helper function to send notification to specific room
const sendNotificationToRoom = (io, room, notification) => {
  io.to(room).emit('notification', notification);
  console.log(`📨 Notification sent to room:${room}`);
};

// Helper function to broadcast to all connected clients
const broadcastNotification = (io, notification) => {
  io.emit('notification', notification);
  console.log(`📢 Notification broadcast to all clients`);
};

module.exports = {
  initializeSocketHandlers,
  sendNotificationToUser,
  sendNotificationToRoom,
  broadcastNotification
};
