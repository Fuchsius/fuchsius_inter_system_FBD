import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.activityInterval = null;
    this.eventListeners = new Map(); // event -> Set of callbacks
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    
    // Memory optimization
    this.MAX_LISTENERS_PER_EVENT = 10;
    this.CLEANUP_INTERVAL = 60000; // 1 minute
    this.lastCleanup = Date.now();
    
    // Ping/pong for connection health
    this.pingInterval = null;
    this.pongTimeout = null;
    
    // Browser suspension detection
    this.lastActivity = Date.now();
    this.suspensionCheckInterval = null;
    this.reconnectOnResume = false;
    
    // Auto-cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  connect(token) {
    if (this.socket && this.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000', {
        auth: {
          token: token
        },
        reconnection: true,
        reconnectionAttempts: 10, // Increased attempts
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      this.socket.on('connect', () => {
        this.connected = true;
        
        // Authenticate with the server
        this.socket.emit('authenticate', { token });
        resolve();
      });

      this.socket.on('authenticated', () => {
        // Restart activity tracking if it was stopped
        if (!this.activityInterval) {
          this.startActivityTracker(1000);
        }
        // Start ping/pong to keep connection alive
        this.startPingPong();
        // Start suspension detection
        this.startSuspensionDetection();
      });

      this.socket.on('authentication_error', (error) => {
        console.error('Socket.IO authentication failed:', error);
        this.disconnect();
        reject(new Error('Authentication failed'));
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        
        // Mark for reconnection on resume
        this.reconnectOnResume = true;
        
        // Stop activity tracking when disconnected
        this.stopActivityTracker();
        // Stop ping/pong
        this.stopPingPong();
        // Stop suspension detection
        this.stopSuspensionDetection();
      });

      this.socket.on('reconnect', (attemptNumber) => {
        this.connected = true;
        
        // Re-authenticate on reconnection
        if (token) {
          this.socket.emit('authenticate', { token });
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        if (!this.connected) {
          reject(error);
        }
      });
    });
  }

  disconnect() {
    // Clear activity interval
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Stop ping/pong
    this.stopPingPong();
    
    // Stop suspension detection
    this.stopSuspensionDetection();
    
    // Clear all event listeners
    this.eventListeners.clear();
    
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.connected = false;
    this.reconnectAttempts = 0;
    this.reconnectOnResume = false;
  }

  // Start suspension detection to detect browser throttling
  startSuspensionDetection() {
    if (this.suspensionCheckInterval) return;
    
    this.lastActivity = Date.now();
    this.suspensionCheckInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - this.lastActivity;
      
      // If no activity for more than 45 seconds, browser likely suspended
      if (timeSinceLastActivity > 45000) {
        console.warn('Browser likely suspended, marking for reconnection');
        this.reconnectOnResume = true;
        this.connected = false;
      }
    }, 10000); // Check every 10 seconds
  }

  // Stop suspension detection
  stopSuspensionDetection() {
    if (this.suspensionCheckInterval) {
      clearInterval(this.suspensionCheckInterval);
      this.suspensionCheckInterval = null;
    }
  }

  // Update last activity time
  updateLastActivity() {
    this.lastActivity = Date.now();
  }

  // Check if reconnection is needed on resume
  shouldReconnectOnResume() {
    return this.reconnectOnResume || !this.connected;
  }

  // Clear reconnection flag
  clearReconnectFlag() {
    this.reconnectOnResume = false;
  }

  // Start ping/pong to keep connection alive during minimize
  startPingPong() {
    if (this.pingInterval) return;
    
    this.pingInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('ping');
        
        // Set timeout for pong response
        this.pongTimeout = setTimeout(() => {
          console.warn('No pong response, connection may be lost');
          this.connected = false;
        }, 5000);
      }
    }, 30000); // Ping every 30 seconds
    
    // Listen for pong responses
    if (this.socket) {
      this.socket.on('pong', () => {
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
      });
    }
  }

  // Stop ping/pong
  stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  // Perform memory cleanup
  performCleanup() {
    const now = Date.now();
    
    // Log memory usage periodically
    if (now - this.lastCleanup > 5 * 60 * 1000) { // 5 minutes
      const totalListeners = Array.from(this.eventListeners.values())
        .reduce((sum, set) => sum + set.size, 0);
      this.lastCleanup = now;
    }
    
    // Clean up events with too many listeners
    for (const [event, listeners] of this.eventListeners.entries()) {
      if (listeners.size > this.MAX_LISTENERS_PER_EVENT) {
        console.warn(`Event ${event} has too many listeners (${listeners.size}), cleaning up oldest ones`);
        const listenersArray = Array.from(listeners);
        // Keep only the most recent listeners
        const toKeep = listenersArray.slice(-this.MAX_LISTENERS_PER_EVENT);
        listeners.clear();
        toKeep.forEach(listener => listeners.add(listener));
      }
    }
  }

  // Optimized event listener management
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);
    
    if (this.socket) {
      this.socket.on(event, callback);
    }
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.eventListeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.eventListeners.delete(event);
        }
      }
      if (this.socket) {
        this.socket.off(event, callback);
      }
    };
  }

  off(event, callback) {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.eventListeners.delete(event);
      }
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // Subscribe to user status updates (optimized)
  onUserStatusUpdate(callback) {
    return this.on('user_activity_update', callback);
  }
  
  // Get user status (online/offline) - optimized with timeout
  getUserStatus(userId) {
    if (!this.socket || !this.connected) return Promise.resolve('offline');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve('unknown');
      }, 5000); // 5 second timeout
      
      this.socket.emit('get_user_status', { userId }, (status) => {
        clearTimeout(timeout);
        resolve(status);
      });
    });
  }
  
  // Emit user activity to update last active time
  emitActivity() {
    if (this.socket && this.connected) {
      this.socket.emit('user_activity');
    } else {
      console.warn('Socket not connected, cannot emit activity');
    }
  }

  emitIdleThreshold(payload = {}) {
    if (this.socket && this.connected) {
      this.socket.emit('idle_threshold', payload);
    }
  }

  // Start tracking user activity (emits every second)
  startActivityTracker(interval = 1000) {
    if (this.activityInterval) {
      return;
    }
    
    this.activityInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('user_activity');
        this.updateLastActivity(); // Update activity timestamp
      }
    }, interval);
  }

  // Stop tracking user activity
  stopActivityTracker() {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
  }

  // Listen for user online/offline events
  onUserOnline(callback) {
    if (this.socket) {
      this.socket.on('user_online', callback);
    }
  }

  onUserOffline(callback) {
    if (this.socket) {
      this.socket.on('user_offline', callback);
    }
  }

  // Listen for real-time updates
  onUserUpdate(callback) {
    if (this.socket) {
      this.socket.on('user_update', (data) => {
        callback(data);
      });
    }
  }
}

export default new SocketService();
