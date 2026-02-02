const { Server } = require("socket.io");
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socket.id
    this.userActivityTimers = new Map(); // userId -> { lastActive, dbUpdateTimeout }
    this.userMeta = new Map(); // userId -> user profile snapshot
    this.idleAlertCache = new Map(); // userId -> last alert timestamp

    // Memory optimization settings
    this.MAX_INACTIVE_TIME = 30 * 60 * 1000; // 30 minutes
    this.CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    this.MAX_MEMORY_USERS = 10000; // Maximum users to track
    this.IDLE_ALERT_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    this.IDLE_CHECK_INTERVAL = 15 * 1000; // 15 seconds cadence for idle scan
    this.IDLE_ALERT_WINDOW = 10 * 1000; // allow 10s window to treat as "exact" 1-minute mark
    this.SUPERVISOR_ROLES = ['admin', 'pm', 'hr'];
    this.IDLE_ELIGIBLE_ROLES = ['employee', 'intern', 'interner', 'interners'];
    this.supervisorCache = { ids: [], expires: 0 };

    // Memory cleanup interval - run every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveUsers();
      this.checkMemoryUsage();
    }, this.CLEANUP_INTERVAL);

    // Track memory usage
    this.lastMemoryCheck = Date.now();

    // Idle user monitoring interval
    this.idleCheckInterval = setInterval(() => {
      this.checkForIdleUsers().catch((error) => {
        console.error('Idle monitor error:', error);
      });
    }, this.IDLE_CHECK_INTERVAL);
  }

  initialize(server) {
    const allowedOrigins = [
      "http://intersystem.fuchsius.com",
      "https://intersystem.fuchsius.com",
      "http://localhost:5173",
      "http://fuchsius.com",
      "https://fuchsius.com"
    ];

    this.io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.io.on("connection", (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle user authentication and registration
      socket.on("authenticate", async (data) => {
        try {
          const { token } = data;
          if (!token) {
            console.error('No token provided for authentication');
            socket.disconnect();
            return;
          }

          const { verifyToken } = require('../auth/jwtUtils');
          const decoded = verifyToken(token);

          if (!decoded.id) {
            console.error('Invalid token: no user id found');
            socket.disconnect();
            return;
          }

          const userRecord = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeId: true,
              role: true,
              status: true
            }
          });

          if (!userRecord) {
            console.error(`User ${decoded.id} not found during socket auth`);
            socket.disconnect();
            return;
          }

          this.userMeta.set(decoded.id, userRecord);

          // Store user connection
          this.connectedUsers.set(decoded.id, socket.id);
          socket.userId = decoded.id;

          // Update user's last active time immediately
          await this.updateUserLastActive(decoded.id);

          // Join user to their personal room
          socket.join(`user_${decoded.id}`);

          console.log(`User ${decoded.id} (${decoded.email}) authenticated and connected`);

          // Broadcast user online status
          this.broadcast('user_status', {
            type: 'online',
            userId: decoded.id,
            lastActiveAt: new Date()
          });

        } catch (error) {
          console.error("Socket authentication error:", error.message);
          socket.disconnect();
        }
      });

      // Handle user activity
      socket.on("user_activity", async (data) => {
        if (socket.userId) {
          await this.updateUserLastActive(socket.userId);
        } else {
          console.error('No userId found for socket:', socket.id);
        }
      });

      socket.on("idle_threshold", async (payload = {}) => {
        if (!socket.userId) return;
        await this.handleClientIdleThreshold(socket.userId, payload);
      });

      // Handle disconnection
      socket.on("disconnect", async () => {
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);

          this.userMeta.delete(socket.userId);
          this.idleAlertCache.delete(socket.userId);

          // Clean up user activity data and update database immediately
          const userActivity = this.userActivityTimers.get(socket.userId);
          if (userActivity) {
            if (userActivity.dbUpdateTimeout) {
              clearTimeout(userActivity.dbUpdateTimeout);
            }

            // Update database immediately on disconnect
            try {
              const { PrismaClient } = require('@prisma/client');
              const prisma = new PrismaClient();

              await prisma.user.update({
                where: { id: socket.userId },
                data: { lastActiveAt: userActivity.lastActive }
              });
            } catch (error) {
              console.error('Error updating last active time on disconnect:', error);
            }
          }

          // Clean up all user data
          this.cleanupUserData(socket.userId);
          console.log(`User ${socket.userId} disconnected`);

          // Broadcast user offline status
          this.broadcast('user_status', {
            type: 'offline',
            userId: socket.userId,
            lastActiveAt: userActivity?.lastActive || new Date()
          });
        }
      });
    });

    console.log("Socket.IO server initialized");
  }

  async updateUserLastActive(userId) {
    if (!userId) {
      console.error('No userId provided for updating last active time');
      return;
    }

    const now = new Date();
    const userActivity = this.userActivityTimers.get(userId) || {
      lastActive: now,
      dbUpdateTimeout: null,
      lastDbUpdate: null
    };

    // Update the in-memory last active time
    userActivity.lastActive = now;
    this.userActivityTimers.set(userId, userActivity);

    // Reset idle alert cache so future inactivity can re-trigger alerts
    this.idleAlertCache.delete(userId);

    // Always broadcast the real-time update
    this.broadcast('user_activity_update', {
      userId,
      lastActiveAt: now,
      isOnline: true
    });

    // Clear existing timeout if any
    if (userActivity.dbUpdateTimeout) {
      clearTimeout(userActivity.dbUpdateTimeout);
    }

    // Set up database update every 30 seconds continuously
    const updateDatabase = async () => {
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();

        const currentActivity = this.userActivityTimers.get(userId);
        if (currentActivity && this.connectedUsers.has(userId)) {
          await prisma.user.update({
            where: { id: userId },
            data: { lastActiveAt: currentActivity.lastActive }
          });
          console.log(`Updated last active time for user ${userId} in database: ${currentActivity.lastActive}`);

          currentActivity.lastDbUpdate = now;
          this.userActivityTimers.set(userId, currentActivity);

          // Schedule next update in 30 seconds if user is still connected
          currentActivity.dbUpdateTimeout = setTimeout(updateDatabase, 30000);
        }
      } catch (error) {
        console.error('Error updating last active time in database:', error);
        // Retry in 30 seconds even on error
        const currentActivity = this.userActivityTimers.get(userId);
        if (currentActivity && this.connectedUsers.has(userId)) {
          currentActivity.dbUpdateTimeout = setTimeout(updateDatabase, 30000);
        }
      }
    };

    // Start the continuous update cycle
    userActivity.dbUpdateTimeout = setTimeout(updateDatabase, 30000);
  }

  // Emit events to specific users
  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user_${userId}`).emit(event, data);
    }
  }

  // Broadcast events to all connected clients
  broadcast(event, data) {
    if (this.io) {
      console.log(`Broadcasting event ${event}:`, data);
      this.io.emit(event, data);
    } else {
      console.warn('Socket.IO not initialized, cannot broadcast');
    }
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.connectedUsers.size;
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Get user activity info
  getUserActivity(userId) {
    return this.userActivityTimers.get(userId);
  }

  // Clean up user data on disconnect
  cleanupUserData(userId) {
    const userActivity = this.userActivityTimers.get(userId);
    if (userActivity) {
      if (userActivity.dbUpdateTimeout) {
        clearTimeout(userActivity.dbUpdateTimeout);
      }
      userActivity.dbUpdateTimeout = null;
      userActivity.lastDbUpdate = null;
    }
    this.userActivityTimers.delete(userId);
  }

  // Get all online users
  getOnlineUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  // Clean up inactive users and orphaned timers
  cleanupInactiveUsers() {
    const now = new Date();
    const THIRTY_MINUTES_AGO = new Date(now.getTime() - this.MAX_INACTIVE_TIME);
    let cleanedCount = 0;

    for (const [userId, activity] of this.userActivityTimers.entries()) {
      // Clean up users who haven't been active for 30 minutes and aren't connected
      if (!this.connectedUsers.has(userId) && activity.lastActive < THIRTY_MINUTES_AGO) {
        if (activity.dbUpdateTimeout) {
          clearTimeout(activity.dbUpdateTimeout);
        }
        activity.dbUpdateTimeout = null;
        activity.lastDbUpdate = null;
        this.userActivityTimers.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} inactive users`);
    }
  }

  // Check memory usage and optimize
  checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const now = Date.now();

    // Log memory usage every 5 minutes
    if (now - this.lastMemoryCheck > 5 * 60 * 1000) {
      console.log(`Socket Memory - Connected: ${this.connectedUsers.size}, Tracked: ${this.userActivityTimers.size}, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      this.lastMemoryCheck = now;
    }

    // If we're tracking too many users, clean up oldest inactive ones
    if (this.userActivityTimers.size > this.MAX_MEMORY_USERS) {
      this.forceCleanupOldestUsers();
    }

    // Force garbage collection if memory is high
    if (memUsage.heapUsed > 300 * 1024 * 1024 && global.gc) { // 300MB
      global.gc();
      console.log('Forced garbage collection in socket service');
    }
  }

  // Force cleanup of oldest users when memory is high
  forceCleanupOldestUsers() {
    const entries = Array.from(this.userActivityTimers.entries());
    // Sort by last active time (oldest first)
    entries.sort((a, b) => a[1].lastActive - b[1].lastActive);

    // Remove oldest 20% of users
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      const [userId, activity] = entries[i];
      if (!this.connectedUsers.has(userId)) {
        if (activity.dbUpdateTimeout) {
          clearTimeout(activity.dbUpdateTimeout);
        }
        activity.dbUpdateTimeout = null;
        activity.lastDbUpdate = null;
        this.userActivityTimers.delete(userId);
      }
    }

    console.log(`Force cleaned ${toRemove} oldest users due to memory pressure`);
  }

  // Force cleanup all data (for server shutdown)
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    // Clear all timeouts and reset user data
    for (const [userId, activity] of this.userActivityTimers.entries()) {
      if (activity.dbUpdateTimeout) {
        clearTimeout(activity.dbUpdateTimeout);
      }
      activity.dbUpdateTimeout = null;
      activity.lastDbUpdate = null;
    }

    // Clear all maps
    this.connectedUsers.clear();
    this.userActivityTimers.clear();
    this.userMeta.clear();
    this.idleAlertCache.clear();
    this.supervisorCache = { ids: [], expires: 0 };
  }

  async getSupervisorIds() {
    const now = Date.now();
    if (this.supervisorCache.ids.length && this.supervisorCache.expires > now) {
      return this.supervisorCache.ids;
    }

    const supervisors = await prisma.user.findMany({
      where: {
        role: { in: this.SUPERVISOR_ROLES },
        status: 'active'
      },
      select: { id: true }
    });

    const ids = supervisors.map((user) => user.id);
    this.supervisorCache = {
      ids,
      expires: now + (5 * 60 * 1000) // cache for 5 minutes
    };
    return ids;
  }

  async notifySupervisorsOfIdleUser(userMeta, idleDurationMs) {
    try {
      const supervisorIds = await this.getSupervisorIds();
      if (!supervisorIds.length) return;

      const idleMinutes = Math.max(1, Math.floor(idleDurationMs / 60000));
      const userName = [userMeta.firstName, userMeta.lastName].filter(Boolean).join(' ') || userMeta.email || `User ${userMeta.employeeId || userMeta.id}`;
      const email = userMeta.email || 'no-email@fuchsius.com';
      const message = `${userName} (${email}) has been idle for ${idleMinutes} minute${idleMinutes > 1 ? 's' : ''}.`;

      await Promise.all(supervisorIds.map(async (supervisorId) => {
        const notification = await prisma.notification.create({
          data: {
            title: 'Idle activity alert',
            message,
            type: 'warning',
            userId: supervisorId,
            read: false,
            description: `Employee ID: ${userMeta.employeeId || 'N/A'} | Email: ${email} | Role: ${userMeta.role}`
          }
        });

        this.emitToUser(supervisorId, 'new_notification', notification);
      }));
    } catch (error) {
      console.error('Failed to notify supervisors of idle user:', error);
    }
  }

  async checkForIdleUsers() {
    const now = Date.now();
    const alertPromises = [];

    for (const [userId, activity] of this.userActivityTimers.entries()) {
      const userMeta = this.userMeta.get(userId);
      if (!userMeta) continue;

      const normalizedRole = (userMeta.role || '').toLowerCase();
      if (!this.isIdleEligibleRole(normalizedRole)) {
        continue;
      }

      const lastActiveTs = new Date(activity.lastActive).getTime();
      const idleDuration = now - lastActiveTs;

      const crossedThreshold = idleDuration >= this.IDLE_ALERT_THRESHOLD;
      const withinFirstWindow = idleDuration < (this.IDLE_ALERT_THRESHOLD + this.IDLE_ALERT_WINDOW);

      if (!crossedThreshold) {
        continue;
      }

      if (!withinFirstWindow) {
        // already past the 1-minute window; don't send repeat notifications
        continue;
      }

      if (this.idleAlertCache.has(userId)) {
        continue;
      }

      this.idleAlertCache.set(userId, now);
      alertPromises.push(this.notifySupervisorsOfIdleUser(userMeta, idleDuration));
    }

    if (alertPromises.length) {
      await Promise.allSettled(alertPromises);
    }
  }

  isIdleEligibleRole(role) {
    return this.IDLE_ELIGIBLE_ROLES.includes((role || '').toLowerCase());
  }

  async handleClientIdleThreshold(userId, payload = {}) {
    try {
      const userMeta = this.userMeta.get(userId);
      if (!userMeta) return;

      if (!this.isIdleEligibleRole(userMeta.role)) {
        return;
      }

      if (this.idleAlertCache.has(userId)) {
        return;
      }

      const idleMs = (payload.idleSeconds ? payload.idleSeconds * 1000 : this.IDLE_ALERT_THRESHOLD);
      this.idleAlertCache.set(userId, Date.now());
      await this.notifySupervisorsOfIdleUser(userMeta, idleMs);
    } catch (error) {
      console.error('Failed to process client idle threshold event:', error);
    }
  }
}

module.exports = new SocketService();
