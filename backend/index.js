require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

// Import all routers
const authRouter = require('./routers/AuthRouter');
const userRouter = require('./routers/UserRouter');
const departmentRouter = require('./routers/DepartmentRouter');
const positionRouter = require('./routers/PositionRouter');
const referralRouter = require('./routers/ReferralRouter');
const attendanceRouter = require('./routers/AttendanceRouter');
const projectRouter = require('./routers/ProjectRouter');
const taskRouter = require('./routers/TaskRouter');
const eventRouter = require('./routers/EventRouter');
const notificationRouter = require('./routers/NotificationRouter');
const activityRouter = require('./routers/ActivityRouter');

// Import Socket.IO service
const socketService = require('./services/socketService');

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// Memory monitoring
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
let memoryMonitorInterval;

function monitorMemory() {
  const memUsage = process.memoryUsage();
  const formattedUsage = {
    rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(memUsage.external / 1024 / 1024)} MB`,
    onlineUsers: socketService.getOnlineUsersCount()
  };

  console.log('Memory Usage:', formattedUsage);

  // Force garbage collection if memory usage is high
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    if (global.gc) {
      global.gc();
      console.log('Forced garbage collection due to high memory usage');
    }
  }
}

// Middleware
const allowedOrigins = [
  "http://intersystem.fuchsius.com",
  "https://intersystem.fuchsius.com",
  "http://localhost:5173",
  "http://fuchsius.com",
  "https://fuchsius.com"
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy to properly handle IP addresses
app.set('trust proxy', true);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize Socket.IO
socketService.initialize(server);

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Fuchsius System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      departments: '/api/departments',
      positions: '/api/positions',
      referrals: '/api/referrals',
      attendance: '/api/attendance',
      projects: '/api/projects',
      tasks: '/api/tasks',
      events: '/api/events',
      notifications: '/api/notifications',
      activities: '/api/activities',
      health: '/health'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/positions', positionRouter);
app.use('/api/referrals', referralRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/projects', projectRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/events', eventRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/activities', activityRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Start memory monitoring
  memoryMonitorInterval = setInterval(monitorMemory, MEMORY_CHECK_INTERVAL);
  console.log('Memory monitoring started');
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
  console.log(`Received ${signal}, starting graceful shutdown...`);

  // Stop memory monitoring
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
  }

  // Cleanup socket service
  socketService.cleanup();

  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.log('Forcing shutdown');
    process.exit(1);
  }, 10000);
}