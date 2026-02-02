import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import socketService from '../../services/socketService';
import { usersAPI } from '../../api/users';
import { projectsAPI } from '../../api/projects';
import { tasksAPI } from '../../api/tasks';
import { eventsAPI } from '../../api/events';
import axios from 'axios';
import {
  Users, FolderKanban, TrendingUp, Shield, Clock, CheckSquare,
  FileText, Share2, Briefcase, Calendar, Loader2, AlertTriangle,
  CheckCircle, XCircle, Activity, DollarSign, BarChart3, RefreshCw, Circle
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Loading from '../../components/Loading';
import Avatar from '../../components/Avatar';

const Dashboard = ({ userRole }) => {
  const navigate = useNavigate();
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    upcomingEvents: 0,
    totalEvents: 0,
    unreadNotifications: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Format last active time with relative time
  const formatLastActive = useCallback((lastActiveAt) => {
    if (!lastActiveAt) return 'Never';
    
    const lastActive = new Date(lastActiveAt);
    const now = new Date();
    const diffInSeconds = Math.floor((now - lastActive) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return lastActive.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Handle user status updates - similar to UsersPage
  const handleUserStatus = useCallback((data) => {
    
    setRecentUsers(prevUsers => {
      const userIndex = prevUsers.findIndex(u => u.id === data.userId);
      if (userIndex === -1) return prevUsers;
      
      const newUsers = [...prevUsers];
      newUsers[userIndex] = {
        ...newUsers[userIndex],
        lastActiveAt: data.lastActiveAt,
        isOnline: data.type === 'online'
      };
      return newUsers;
    });

    setOnlineUsers(prevOnline => {
      const userIndex = prevOnline.findIndex(u => u.id === data.userId);
      if (userIndex === -1) return prevOnline;
      
      const newOnline = [...prevOnline];
      newOnline[userIndex] = {
        ...newOnline[userIndex],
        lastActiveAt: data.lastActiveAt,
        isOnline: data.type === 'online'
      };
      return newOnline;
    });
  }, []);

  // Handle real-time activity updates
  const handleActivityUpdate = useCallback((data) => {
    setRecentUsers(prevUsers => {
      const userIndex = prevUsers.findIndex(u => u.id === data.userId);
      if (userIndex === -1) return prevUsers;
      
      const newUsers = [...prevUsers];
      newUsers[userIndex] = {
        ...newUsers[userIndex],
        lastActiveAt: data.lastActiveAt,
        isOnline: data.isOnline
      };
      return newUsers;
    });

    setOnlineUsers(prevOnline => {
      const userIndex = prevOnline.findIndex(u => u.id === data.userId);
      if (userIndex === -1) return prevOnline;
      
      const newOnline = [...prevOnline];
      newOnline[userIndex] = {
        ...newOnline[userIndex],
        lastActiveAt: data.lastActiveAt,
        isOnline: data.isOnline
      };
      return newOnline;
    });
  }, []);

  // Optimized data fetching with separate loading states for each section
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setStatsLoading(true);
        setUsersLoading(true);
        setEventsLoading(true);
      } else {
        setLoading(true);
        setStatsLoading(true);
        setUsersLoading(true);
        setEventsLoading(true);
      }

      // Fetch stats data (users, projects, tasks, events stats)
      const token = localStorage.getItem('accessToken');
      const statsPromises = [
        usersAPI.getStats(),
        projectsAPI.getStats(),
        tasksAPI.getStats(),
        eventsAPI.getStats(),
        axios.get(`${API_BASE_URL}/notifications/my`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ];

      // Fetch users data - sort by recent activity
      const usersPromise = usersAPI.getAll({ limit: 20, sort: 'lastActiveAt:desc' });

      // Fetch events data
      const eventsPromise = eventsAPI.getAll({ status: 'upcoming', limit: 5 });

      // Process stats
      const [
        userStatsResponse,
        projectStatsResponse,
        taskStatsResponse,
        eventStatsResponse,
        notifResponse
      ] = await Promise.all(statsPromises);

      const userStats = userStatsResponse.data || {};
      const projectStats = projectStatsResponse.data || {};
      const taskStats = taskStatsResponse.data || {};
      const eventStats = eventStatsResponse.data || {};
      const unreadCount = notifResponse.data.data.notifications.filter(n => !n.read).length;

      const updates = {
        totalUsers: userStats.totalUsers || 0,
        activeUsers: userStats.activeUsers || 0,
        totalProjects: projectStats.totalProjects || 0,
        activeProjects: projectStats.activeProjects || 0,
        totalTasks: taskStats.totalTasks || 0,
        completedTasks: taskStats.completedTasks || 0,
        pendingTasks: taskStats.pendingTasks || 0,
        totalEvents: eventStats.totalEvents || 0,
        upcomingEventsCount: eventStats.upcomingEvents || 0,
        unreadNotifications: unreadCount
      };

      setStats(prev => ({ ...prev, ...updates }));
      setStatsLoading(false);

      // Process users
      const usersResponse = await usersPromise;
      const recentUsers = usersResponse.data?.users || [];
      setRecentUsers(recentUsers);
      
      // Determine online status based on recent activity (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const usersWithOnlineStatus = recentUsers.map(user => ({
        ...user,
        isOnline: user.lastActiveAt && new Date(user.lastActiveAt) > fiveMinutesAgo,
        lastActiveAt: user.lastActiveAt || null
      }));
      
      setOnlineUsers(usersWithOnlineStatus);
      setUsersLoading(false);

      // Process events
      const upcomingEventsResponse = await eventsPromise;
      const upcomingEvents = upcomingEventsResponse.data?.events || [];
      setUpcomingEvents(upcomingEvents);
      setEventsLoading(false);

      if (isRefresh) {
        toast.success('Dashboard data refreshed successfully');
      }

    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to load dashboard data';
      toast.error(errorMessage);
      // Set loading states to false on error
      setStatsLoading(false);
      setUsersLoading(false);
      setEventsLoading(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch unread notifications separately for real-time updates
  const fetchUnreadNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(`${API_BASE_URL}/notifications/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const unreadCount = response.data.data.notifications.filter(n => !n.read).length;
      setStats(prev => ({ ...prev, unreadNotifications: unreadCount }));
    } catch (error) {
    }
  }, []);

  // Socket event listeners - similar to UsersPage
  useEffect(() => {
    // Set up event listeners
    const unsubscribeUserStatus = socketService.on('user_status', handleUserStatus);
    const unsubscribeActivityListener = socketService.onUserStatusUpdate(handleActivityUpdate);

    // Cleanup
    return () => {
      if (unsubscribeUserStatus) unsubscribeUserStatus();
      if (unsubscribeActivityListener) unsubscribeActivityListener();
    };
  }, [handleUserStatus, handleActivityUpdate]);

  // Socket listener for real-time notification updates
  useEffect(() => {
    const unsubscribe = socketService.on('new_notification', () => {
      fetchUnreadNotifications();
    });

    return () => unsubscribe();
  }, [fetchUnreadNotifications]);

  // Event listeners for notification read updates
  useEffect(() => {
    const handleNotificationRead = () => {
      fetchUnreadNotifications();
    };

    const handleAllNotificationsRead = () => {
      fetchUnreadNotifications();
    };

    window.addEventListener('notification-read', handleNotificationRead);
    window.addEventListener('notifications-all-read', handleAllNotificationsRead);

    return () => {
      window.removeEventListener('notification-read', handleNotificationRead);
      window.removeEventListener('notifications-all-read', handleAllNotificationsRead);
    };
  }, [fetchUnreadNotifications]);

  // Memory optimization for online users list - cleanup old data
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setOnlineUsers(prevOnline => {
        // Remove users that haven't been updated in 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        return prevOnline.filter(user => {
          // Keep users who are online or have recent activity
          return user.isOnline || (user.lastActiveAt && new Date(user.lastActiveAt) > twoHoursAgo);
        });
      });
    }, 30 * 60 * 1000); // Run every 30 minutes

    return () => clearInterval(cleanupInterval);
  }, []);

  // Handle refresh with loading state
  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
    fetchUnreadNotifications();
  }, [fetchDashboardData, fetchUnreadNotifications]);

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-[#C4009A]",
      bg: "bg-fuchsia-50",
      trend: "+12%",
      trendUp: true
    },
    {
      label: "Active Projects",
      value: stats.activeProjects,
      icon: FolderKanban,
      color: "text-blue-600",
      bg: "bg-blue-50",
      trend: "+8%",
      trendUp: true
    },
    {
      label: "Total Tasks",
      value: stats.totalTasks,
      icon: CheckSquare,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      trend: "+24%",
      trendUp: true
    },
    {
      label: "Revenue",
      value: `LKR ${(stats.monthlyRevenue).toLocaleString()}`,
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
      trend: "+15%",
      trendUp: true
    },
  ];

  const quickStats = [
    { label: "Completed Tasks", value: stats.completedTasks, total: stats.totalTasks, icon: CheckCircle, color: "text-emerald-500" },
    { label: "Pending Tasks", value: stats.pendingTasks, total: stats.totalTasks, icon: Clock, color: "text-amber-500" },
    { label: "Upcoming Events", value: stats.upcomingEventsCount, total: stats.totalEvents, icon: Calendar, color: "text-blue-500" },
    { label: "Unread Notifications", value: stats.unreadNotifications, total: 0, icon: Activity, color: "text-red-500" },
  ];

  const THEME = {
    gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  };

  return (
    <div className="space-y-6">
      {loading && <Loading size={80} bg="bg-black/20" />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            icon={refreshing ? Loader2 : RefreshCw}
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 sm:flex-none"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-500">{stat.label}</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{stat.value}</h3>
                <div className={`flex items-center gap-1 mt-2 text-xs sm:text-sm ${stat.trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                  {stat.trendUp ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                  <span className="font-medium">{stat.trend}</span>
                  <span className="hidden sm:inline text-slate-400">from last month</span>
                </div>
              </div>
              <div className={`p-2 sm:p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={18} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {quickStats.map((stat, i) => (
          <Card key={i} className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-lg ${stat.color} bg-opacity-10`}>
                <stat.icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs text-slate-500 truncate">{stat.label}</p>
                <p className="text-base sm:text-lg font-bold text-slate-800">{stat.value}</p>
              </div>
              {stat.total > 0 && (
                <div className="text-[10px] sm:text-xs text-slate-400 whitespace-nowrap">
                  of {stat.total}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Users - Now showing only online users */}
        <Card className="lg:col-span-2 p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h3 className="font-semibold text-slate-800 text-sm sm:text-base">Online Users</h3>
            <div className="flex items-center gap-2">
              <Badge color="success" size="sm">
                {onlineUsers.filter(u => u.isOnline).length} Active
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs sm:text-sm" 
                onClick={() => navigate('/admin/users')}
              >
                View All
              </Button>
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {usersLoading ? (
              <div className="text-center py-6 sm:py-8 text-slate-400">
                <Loader2 className="animate-spin text-[#C4009A] mx-auto mb-2" size={24} />
                <p className="text-xs sm:text-sm">Loading users...</p>
              </div>
            ) : onlineUsers.filter(user => user.isOnline).slice(0, 5).map((user, i) => (
              <div key={i} className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="relative">
                    <Avatar
                      src={user.avatar}
                      fallback={`${user.firstName?.[0]?.toUpperCase() || ''}${user.lastName?.[0]?.toUpperCase() || ''}`}
                      size="sm"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shrink-0"></div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 truncate">{user.role} - {user.position?.name || 'N/A'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] sm:text-xs text-green-600">
                        Active {formatLastActive(user.lastActiveAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge color="success" size="sm" className="text-[10px] sm:text-xs">
                    Online
                  </Badge>
                </div>
              </div>
            ))}
            {onlineUsers.filter(user => user.isOnline).length === 0 && (
              <div className="text-center py-6 sm:py-8 text-slate-400">
                <Circle size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">No users currently online</p>
                <p className="text-[10px] sm:text-xs mt-1">Users will appear here when they're active</p>
              </div>
            )}
            {onlineUsers.filter(user => user.isOnline).length > 5 && (
              <div className="text-center pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/admin/users')}
                  className="text-xs"
                >
                  View All {onlineUsers.filter(u => u.isOnline).length} Online Users
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Upcoming Events */}
        <Card className="p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h3 className="font-semibold text-slate-800 text-sm sm:text-base">Upcoming Events</h3>
            <Button variant="ghost" size="sm" className="text-xs sm:text-sm" onClick={() => navigate('/admin/events')}>View All</Button>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {eventsLoading ? (
              <div className="text-center py-6 sm:py-8 text-slate-400">
                <Loader2 className="animate-spin text-[#C4009A] mx-auto mb-2" size={24} />
                <p className="text-xs sm:text-sm">Loading events...</p>
              </div>
            ) : upcomingEvents.slice(0, 4).map((event, i) => (
              <div key={i} className="p-2 sm:p-3 border border-slate-200 rounded-lg hover:border-[#C4009A] transition-colors">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 rounded-lg ${THEME.gradient} text-white flex-shrink-0`}>
                    <Calendar size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-700 truncate">{event.title}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500 mt-1 truncate">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {event.time && ` at ${event.time}`}
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1 truncate">{event.location || 'Location TBD'}</p>
                  </div>
                </div>
              </div>
            ))}
            {upcomingEvents.length === 0 && (
              <div className="text-center py-6 sm:py-8 text-slate-400">
                <Calendar size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">No upcoming events</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-4 sm:p-6">
        <h3 className="font-semibold text-slate-800 mb-4 sm:mb-5 text-base">Quick Actions</h3>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-1 text-xs sm:text-sm p-2 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/admin/users')}
          >
            <Users size={20} className="flex-shrink-0" />
            <span className="text-center">Add User</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-1 text-xs sm:text-sm p-2 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/admin/projects')}
          >
            <FolderKanban size={20} className="flex-shrink-0" />
            <span className="text-center">New Project</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-1 text-xs sm:text-sm p-2 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/admin/events')}
          >
            <Calendar size={20} className="flex-shrink-0" />
            <span className="text-center">Event</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-1 text-xs sm:text-sm p-2 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/admin/tasks')}
          >
            <CheckSquare size={20} className="flex-shrink-0" />
            <span className="text-center">Tasks</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-1 text-xs sm:text-sm p-2 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/admin/departments')}
          >
            <Shield size={20} className="flex-shrink-0" />
            <span className="text-center">Dept</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex flex-col items-center justify-center gap-1 text-xs sm:text-sm p-2 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/admin/referrals')}
          >
            <Share2 size={20} className="flex-shrink-0" />
            <span className="text-center">Ref</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
