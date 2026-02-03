import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import socketService from '../services/socketService';
import { attendanceAPI } from '../api/attendance';
import {
  Search, Bell, Menu, X, CheckCircle, Clock, AlertCircle, Calendar, Circle
} from 'lucide-react';
import Avatar from './Avatar';
import notificationSound from '../assets/notification.mp3';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const SHIFT_DURATION_MS = 8 * 60 * 60 * 1000;
const DEFAULT_COUNTDOWN = { hours: 8, minutes: 0, seconds: 0 };

const Header = ({ title, toggleMobileMenu, userRole }) => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [countdown, setCountdown] = useState(DEFAULT_COUNTDOWN);
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [lastActiveAt, setLastActiveAt] = useState(null);
  const [checkInTime, setCheckInTime] = useState(null);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const notificationRef = useRef(null);
  const audioRef = useRef(null);
  const [now, setNow] = useState(Date.now());

  const roleLabels = {
    admin: 'Administrator',
    pm: 'Project Manager',
    employee: 'Employee',
    hr: 'Human Resources',
    interners: 'Intern',
    intern: 'Intern'
  };

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const userData = response.data.data;
        setUser(userData);
        // Initialize online status from user data if available
        setIsOnline(userData.isOnline || false);
        setLastActiveAt(userData.lastActiveAt || null);
      } catch (error) {
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchTodayAttendance = async () => {
      try {
        const response = await attendanceAPI.getTodayAttendance();
        
        if (response.success && response.data.attendance.length > 0) {
          const today = response.data.attendance[0];
          
          if (today.checkInTime) {
            const checkInDate = new Date(today.checkInTime);
            setCheckInTime(checkInDate);
            setHasCheckedOut(Boolean(today.checkOutTime));
            return;
          }
        }
        
        setCheckInTime(null);
        setHasCheckedOut(false);
      } catch (error) {
      }
    };

    fetchTodayAttendance();
    const interval = setInterval(fetchTodayAttendance, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleAttendanceUpdate = (event) => {
      const { checkInTime: updatedCheckInTime, hasCheckedOut: checkedOut } = event.detail || {};
      
      if (updatedCheckInTime) {
        const checkInDate = new Date(updatedCheckInTime);
        setCheckInTime(checkInDate);
      }
      if (typeof checkedOut === 'boolean') {
        setHasCheckedOut(checkedOut);
      }
    };

    window.addEventListener('attendance-status-updated', handleAttendanceUpdate);
    return () => window.removeEventListener('attendance-status-updated', handleAttendanceUpdate);
  }, []);

  useEffect(() => {
    const handleProfileUpdate = (event) => {
      const { user: updatedUser, avatar: newAvatar } = event.detail || {};
      
      if (updatedUser) {
        // Update user data including avatar
        setUser(prevUser => ({
          ...prevUser,
          ...updatedUser
        }));
      }
      
      if (newAvatar) {
        // Update just the avatar
        setUser(prevUser => ({
          ...prevUser,
          avatar: newAvatar
        }));
      }
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('profile-updated', handleProfileUpdate);
  }, []);

  // Handle user status updates from socket
  const handleUserStatusUpdate = useCallback((data) => {
    if (user && data.userId === user.id) {
      setIsOnline(data.isOnline);
      setLastActiveAt(data.lastActiveAt);
    }
  }, [user]);

  // Handle global user status events
  const handleUserStatus = useCallback((data) => {
    if (user && data.userId === user.id) {
      setIsOnline(data.type === 'online');
      setLastActiveAt(data.lastActiveAt);
    }
  }, [user]);

  // Setup socket listeners for online status
  useEffect(() => {
    if (!user) return;

    const unsubscribeUserStatus = socketService.on('user_status', handleUserStatus);
    const unsubscribeActivityListener = socketService.onUserStatusUpdate(handleUserStatusUpdate);

    return () => {
      if (unsubscribeUserStatus) unsubscribeUserStatus();
      if (unsubscribeActivityListener) unsubscribeActivityListener();
    };
  }, [user, handleUserStatus, handleUserStatusUpdate]);

  // Generate initials from name
  const getInitials = (firstName, lastName) => {
    if (!firstName && !lastName) return 'U';
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial || 'U';
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = useCallback((date) => {
    if (!date) return '';
    const targetDate = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const diff = now - targetDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }, [now]);

  // Fetch notifications on mount and setup Socket.IO
  useEffect(() => {
    audioRef.current = new Audio(notificationSound);
    audioRef.current.preload = 'auto';

    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await axios.get(`${API_BASE_URL}/notifications/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const formattedNotifications = response.data.data.notifications.map(notif => ({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          createdAt: notif.createdAt,
          read: notif.read
        }));
        setNotifications(formattedNotifications);
      } catch (error) {
      }
    };

    // Listen for new notifications using global socketService
    const unsubscribe = socketService.on('new_notification', (notification) => {
      const formatted = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
        read: notification.read
      };
      setNotifications(prev => [formatted, ...prev]);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        const playback = audioRef.current.play();
        if (playback?.catch) {
          playback.catch(() => {});
        }
      }

      // Show toast notification
      const toastType = notification.type === 'success' ? toast.success :
        notification.type === 'error' ? toast.error :
          notification.type === 'warning' ? toast.warning :
            toast.info;

      toastType(notification.message);
    });

    fetchNotifications();

    return () => {
      unsubscribe();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 8-hour count-up timer based on check-in time
  useEffect(() => {
    if (!checkInTime) {
      setCountdown({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    // If already checked out, show 0 and hide timer
    if (hasCheckedOut) {
      setCountdown({ hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsedMs = now - checkInTime.getTime();
      
      // Count elapsed time without capping
      const totalSeconds = Math.floor(elapsedMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const newCountdown = { hours, minutes, seconds };
      setCountdown(newCountdown);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [checkInTime, hasCheckedOut]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-500" size={16} />;
      case 'warning': return <AlertCircle className="text-amber-500" size={16} />;
      case 'error': return <AlertCircle className="text-red-500" size={16} />;
      case 'info': return <Clock className="text-blue-500" size={16} />;
      default: return <Clock className="text-slate-500" size={16} />;
    }
  };

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.patch(`${API_BASE_URL}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      // Dispatch custom event for real-time updates across components
      window.dispatchEvent(new CustomEvent('notification-read', { detail: { id } }));
    } catch (error) {
    }
  };

  const handleProfileClick = () => {
    if (!user?.role) return;
    
    // Redirect to appropriate profile page based on user role
    const profileRoutes = {
      admin: '/admin/profile',
      pm: '/pm/profile',
      employee: '/employee/profile',
      hr: '/hr/profile',
      intern: '/interners/profile',
      interners: '/interners/profile'
    };
    
    const route = profileRoutes[user.role] || '/pm/profile';
    navigate(route);
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.patch(`${API_BASE_URL}/notifications/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      // Dispatch custom event for real-time updates across components
      window.dispatchEvent(new CustomEvent('notifications-all-read'));
    } catch (error) {
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 bg-white/95 backdrop-blur-sm border-b border-slate-200 z-40">
      <div className="h-full px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={toggleMobileMenu} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
            <Menu size={20} className="text-slate-600" />
          </button>

          <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile Countdown Timer - Centered (hidden for admin) */}
          {user?.role !== 'admin' && checkInTime && !hasCheckedOut && (
            <div className="sm:hidden flex-1 flex justify-center">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-linear-to-r from-[#7E006C]/10 to-[#C4009A]/10 rounded-lg border border-[#C4009A]/20">
                <Clock className="text-[#7E006C]" size={14} />
                <span className="text-xs font-medium text-[#7E006C]">
                  {String(countdown.hours).padStart(2, '0')}:
                  {String(countdown.minutes).padStart(2, '0')}:
                  {String(countdown.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          {/* Desktop 8-Hour Countdown Timer (hidden for admin) */}
          {user?.role !== 'admin' && checkInTime && !hasCheckedOut && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-linear-to-r from-[#7E006C]/10 to-[#C4009A]/10 rounded-lg border border-[#C4009A]/20">
              <Clock className="text-[#7E006C]" size={16} />
              <div className="flex items-center gap-1 text-sm font-medium">
                <span className="text-[#7E006C]">
                  {String(countdown.hours).padStart(2, '0')}:
                  {String(countdown.minutes).padStart(2, '0')}:
                  {String(countdown.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          <div className="relative notification-dropdown" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-[#7E006C] transition-colors cursor-pointer"
              title="View Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-slate-200 z-50 max-h-[40rem] overflow-hidden">
                {/* Header */}
                <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-sm sm:text-base">Notifications</h3>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-[#7E006C] hover:text-[#C4009A] font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="p-1 hover:bg-slate-100 rounded"
                    >
                      <X size={16} className="text-slate-500" />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-64 sm:max-h-80 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.slice(0, 40).map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => markAsRead(notification.id)}
                        className={`group p-3 sm:p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50/30' : ''
                          }`}
                      >
                        <div className="flex gap-2 sm:gap-3">
                          <div className="shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={`text-xs sm:text-sm font-medium text-slate-800 ${!notification.read ? 'font-semibold' : ''
                                }`}>
                                {notification.title}
                              </h4>
                              {!notification.read && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1"></span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2 group-hover:line-clamp-none">
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-1 mt-2">
                              <Clock size={12} className="text-slate-400" />
                              <span className="text-xs text-slate-500">{formatTimeAgo(notification.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 sm:p-8 text-center">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Bell className="text-slate-400" size={18} />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500">No notifications yet</p>
                      <p className="text-xs text-slate-400 mt-1">We'll notify you when something important happens</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="p-2 sm:p-3 border-t border-slate-200 bg-slate-50">
                    <button className="w-full text-center text-xs sm:text-sm text-[#7E006C] hover:text-[#C4009A] font-medium">
                      View all notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Section */}
          <div
            className="flex items-center gap-2 sm:gap-3 sm:pl-4 sm:border-l sm:border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleProfileClick}
            title="View Profile"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-700">
                {user ? `${user.firstName} ${user.lastName}` : 'Loading...'}
              </p>
              <p className="text-xs text-[#7E006C] font-semibold">
                {user ? roleLabels[user.role] : 'Loading...'}
              </p>
            </div>
            <div className="relative">
              <Avatar
                src={user?.avatar}
                fallback={user ? getInitials(user.firstName, user.lastName) : 'U'}
                cacheKey={user?.avatar || user?.id}
              />
              {/* Online Status Dot on Avatar */}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`}></div>
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 animate-ping"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
