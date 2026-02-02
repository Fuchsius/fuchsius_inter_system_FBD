import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../api/projects';
import { tasksAPI } from '../../api/tasks';
import { usersAPI } from '../../api/users';
import { attendanceAPI } from '../../api/attendance';
import { eventsAPI } from '../../api/events';
import {
  Users, FolderKanban, CheckSquare, CheckCircle, FileText, Calendar, TrendingUp,
  Clock, AlertCircle, Target, Award, Activity, Loader2, RefreshCw,
  MapPin, Eye, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import SearchableDropdown from '../../components/SearchableDropdown';
import Loading from '../../components/Loading';


const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

const THEME = {
  gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
};

const EVENTS_PER_PAGE = 3;

const Dashboard = ({ userRole }) => {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [loadingCount, setLoadingCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    myProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    teamTasks: 0,
    completedTasks: 0,
    pendingReviews: 0,
    upcomingDeadlines: 0,
    teamMembers: 0,
    teamProductivity: 0
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [eventPage, setEventPage] = useState(1);
  const [attendanceRange, setAttendanceRange] = useState('week');
  const [attendanceSeries, setAttendanceSeries] = useState([]);
  const [attendanceLabels, setAttendanceLabels] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [teamUserIds, setTeamUserIds] = useState(new Set());

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Fetch dashboard data from backend
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      }
      startLoading();
      setError(null);

      // Get current user ID for filtering
      const userId = currentUser?.id;
      if (!userId) {
        throw new Error('User not found');
      }

      const [
        projectStatsResponse,
        taskStatsResponse,
        myProjectsResponse,
        teamTasksResponse,
        usersResponse,
        attendanceResponse,
        eventsResponse
      ] = await Promise.all([
        projectsAPI.getStats({ projectManager: userId }),
        tasksAPI.getStats(),
        projectsAPI.getAll({ projectManager: userId, limit: 5 }),
        tasksAPI.getAll({ limit: 200 }),
        usersAPI.getAll({ limit: 20 }),
        attendanceAPI.getAll({ limit: 1000 }),
        eventsAPI.getAll({ limit: 5 })
      ]);

      // Process responses
      const updates = {};

      if (projectStatsResponse.success) {
        const projectData = projectStatsResponse.data;
        updates.myProjects = projectData.totalProjects || 0;
        updates.activeProjects = projectData.activeProjects || 0;
        updates.completedProjects = projectData.completedProjects || 0;
      }

      if (taskStatsResponse.success) {
        const taskData = taskStatsResponse.data;
        updates.teamTasks = taskData.totalTasks || 0;
        updates.completedTasks = taskData.completedTasks || 0;
        updates.pendingReviews = taskData.pendingTasks || 0;
      }

      // Extract team user IDs from PM's projects
      let teamUserIds = new Set();
      if (myProjectsResponse.success) {
        const projects = myProjectsResponse.data?.projects || [];
        setRecentProjects(projects);
        projects.forEach(project => {
          project.tasks?.forEach(task => {
            if (task.user) teamUserIds.add(task.user.id);
          });
        });
      }
      setTeamUserIds(teamUserIds);

      if (teamTasksResponse.success) {
        setTeamTasks(teamTasksResponse.data?.tasks || []);
      }

      if (usersResponse.success) {
        const users = usersResponse.data?.users || [];
        const filteredUsers = users.filter(user => user.role !== 'admin');
        setTeamMembers(filteredUsers);
        updates.teamMembers = usersResponse.data?.pagination?.total || users.length; // Use total from pagination for accurate count
      }

      const attendanceRecords = attendanceResponse.success
        ? attendanceResponse.data?.attendance || []
        : [];
      // Filter attendance to only team members
      const filteredAttendanceRecords = attendanceRecords.filter(record => record.user && teamUserIds.has(record.user.id));
      setAttendanceHistory(filteredAttendanceRecords);

      if (eventsResponse.success) {
        setEvents(eventsResponse.data?.events || []);
      } else {
        setEvents([]);
      }

      // Update stats in one go
      setStats(prev => ({ ...prev, ...updates }));

      if (isRefresh) {
        toast.success('Dashboard data refreshed successfully');
      }

    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to load dashboard data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      stopLoading();
      setRefreshing(false);
    }
  }, [currentUser, startLoading, stopLoading]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, []); // Remove fetchDashboardData from dependencies to prevent infinite loop

  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const attendancePlaceholders = {
    week: {
      values: [85, 92, 78, 96, 88, 35, 40],
      labels: weekLabels
    },
    month: {
      values: [82, 88, 91, 84, 79],
      labels: ['W1', 'W2', 'W3', 'W4', 'W5']
    }
  };

  const getMonthBuckets = useCallback(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthStart.setHours(0, 0, 0, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const buckets = [];
    let cursor = new Date(monthStart);
    let weekIndex = 1;
    while (cursor <= monthEnd) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + 6);
      if (bucketEnd > monthEnd) {
        bucketEnd.setTime(monthEnd.getTime());
      }
      buckets.push({ label: `W${weekIndex}`, start: bucketStart, end: bucketEnd });
      cursor.setDate(cursor.getDate() + 7);
      weekIndex += 1;
    }
    return buckets;
  }, []);

  const buildAttendanceSeries = useCallback((records, range, teamUserIds) => {
    if (!records.length || !teamUserIds.size) {
      setAttendanceSeries([]);
      setAttendanceLabels([]);
      return;
    }

    const normalizedRecords = records
      .map((record) => {
        const recordDateValue = record.date || record.checkInTime || record.checkOutTime;
        if (!recordDateValue) return null;
        const recordDate = new Date(recordDateValue);
        if (Number.isNaN(recordDate.getTime())) return null;
        return {
          date: recordDate,
          present: Boolean(record.checkInTime),
          userId: record.user?.id
        };
      })
      .filter(Boolean);

    if (range === 'month') {
      const buckets = getMonthBuckets();
      let hasRecordsInRange = false;
      const series = buckets.map((bucket) => {
        const bucketRecords = normalizedRecords.filter(({ date }) => date >= bucket.start && date <= bucket.end);
        if (bucketRecords.length > 0) {
          hasRecordsInRange = true;
        }
        const presentUsers = new Set(bucketRecords.filter(({ present }) => present).map(({ userId }) => userId));
        const presentCount = presentUsers.size;
        const totalExpected = teamUserIds.size;
        return totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100) : 0;
      });

      if (!hasRecordsInRange) {
        setAttendanceSeries([]);
        setAttendanceLabels([]);
        return;
      }

      setAttendanceSeries(series);
      setAttendanceLabels(buckets.map((bucket) => bucket.label));
      return;
    }

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday of current week
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekRecords = normalizedRecords.filter(({ date }) => date >= weekStart && date <= weekEnd);
    if (weekRecords.length === 0) {
      setAttendanceSeries([]);
      setAttendanceLabels([]);
      return;
    }

    const attendanceByDay = weekRecords.reduce((acc, record) => {
      const key = record.date.toDateString();
      if (!acc[key]) {
        acc[key] = { presentUsers: new Set() };
      }
      if (record.present) {
        acc[key].presentUsers.add(record.userId);
      }
      return acc;
    }, {});

    const series = weekLabels.map((_, i) => {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + i);
      const dayStats = attendanceByDay[currentDate.toDateString()] || { presentUsers: new Set() };
      const presentCount = dayStats.presentUsers.size;
      const totalExpected = teamUserIds.size;
      return totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100) : 0;
    });

    setAttendanceSeries(series);
    setAttendanceLabels(weekLabels);
  }, [getMonthBuckets]);

  useEffect(() => {
    buildAttendanceSeries(attendanceHistory, attendanceRange, teamUserIds);
  }, [attendanceHistory, attendanceRange, buildAttendanceSeries, teamUserIds]);

  // Handle refresh
  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const handleViewEvent = (event) => {
    setViewingEvent(event);
    setShowEventModal(true);
  };

  useEffect(() => {
    const totalPages = Math.max(Math.ceil(events.length / EVENTS_PER_PAGE), 1);
    setEventPage(prev => Math.min(prev, totalPages));
  }, [events]);

  const handleEventPageChange = (direction) => {
    setEventPage(prev => {
      const totalPages = Math.max(Math.ceil(events.length / EVENTS_PER_PAGE), 1);
      if (direction === 'prev') {
        return Math.max(prev - 1, 1);
      }
      if (direction === 'next') {
        return Math.min(prev + 1, totalPages);
      }
      return prev;
    });
  };

  const getCategoryColor = (category) => {
    const colors = { meeting: 'brand', workshop: 'warning', conference: 'success', corporate: 'info', social: 'rose', training: 'indigo', business: 'emerald', wellness: 'sky' };
    return colors[category] || 'default';
  };

  const getStatusColor = (status) => {
    const colors = { upcoming: 'success', ongoing: 'warning', completed: 'default', cancelled: 'danger' };
    return colors[status] || 'default';
  };

  // Calculate upcoming deadlines
  useEffect(() => {
    const upcoming = teamTasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      const today = new Date();
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7; // Next 7 days
    });
    setUpcomingDeadlines(upcoming);
    // Remove setStats call to prevent infinite loop
  }, [teamTasks]);

  const statCards = [
    {
      label: "My Projects",
      value: stats.myProjects,
      icon: FolderKanban,
      color: "text-[#C4009A]",
      bg: "bg-fuchsia-50"
    },
    {
      label: "Team Tasks",
      value: stats.teamTasks,
      icon: CheckSquare,
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      label: "Completed Tasks",
      value: stats.completedTasks,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    },
    {
      label: "Upcoming Deadlines",
      value: upcomingDeadlines.length,
      icon: Calendar,
      color: "text-rose-600",
      bg: "bg-rose-50"
    },
  ];

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Failed to Load Dashboard</h3>
          <p className="text-slate-600 mb-4">{error}</p>
          <Button
            onClick={handleRefresh}
            icon={refreshing ? Loader2 : RefreshCw}
            disabled={refreshing}
            className="w-full"
          >
            {refreshing ? 'Retrying...' : 'Try Again'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Project Manager Dashboard</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">Welcome back! Here's your team's progress.</p>
        </div>
        {/* <div className="flex gap-2 w-full sm:w-auto">
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
        </div> */}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs sm:text-sm font-medium text-slate-500">{stat.label}</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 mt-2">{stat.value}</h3>
              </div>
              <div className={`p-2 sm:p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon size={18} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-800">Attendance Overview</h3>
            <SearchableDropdown
              options={[
                { id: 'week', name: 'This Week' },
                { id: 'month', name: 'This Month' }
              ]}
              value={attendanceRange}
              onChange={(value) => setAttendanceRange(value)}
              placeholder="Select Range"
              showAllOption={false}
              className="w-40"
            />
          </div>
          <div className="h-64 flex items-end justify-between gap-2 px-4">
            {attendanceSeries.length > 0 ? (
              // Use real attendance rates from database
              attendanceSeries.map((rate, i) => {
                const label = attendanceLabels[i] || '';
                return (
                  <div key={i} className="flex flex-col items-center flex-1">
                    <div className="text-xs font-medium text-slate-600 mb-1">
                      {rate}%
                    </div>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${THEME.gradient}`}
                      style={{ height: `${(rate / 100) * 160}px` }}
                    />
                    <span className="text-xs text-slate-500 mt-1">
                      {label}
                    </span>
                  </div>
                );
              })
            ) : (
              // Show 0% when no data
              (attendanceRange === 'week' ? weekLabels : attendancePlaceholders.month.labels).map((label, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div className="text-xs font-medium text-slate-600 mb-1">
                    0%
                  </div>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-300 ${THEME.gradient}`}
                    style={{ height: '0px' }}
                  />
                  <span className="text-xs text-slate-500 mt-1">
                    {label}
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${THEME.gradient}`} />
              <span className="text-slate-600">
                {attendanceSeries.length > 0
                  ? `Avg Attendance: ${Math.round(attendanceSeries.reduce((a, b) => a + b, 0) / attendanceSeries.length)}%`
                  : 'No attendance data'
                }
              </span>
            </div>
            <div className="text-slate-500">
              {attendanceSeries.length > 0
                ? `Peak: ${Math.max(...attendanceSeries)}% on ${attendanceLabels[attendanceSeries.indexOf(Math.max(...attendanceSeries))]}`
                : 'Awaiting data'
              }
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Team Members</h3>
            <Badge color="info" size="sm">
              {stats.teamMembers} Total Users
            </Badge>
          </div>
          <div className="space-y-4">
            {teamMembers.slice(0, 4).map((member, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <Avatar
                  src={member.avatar}
                  fallback={`${member.firstName?.[0]?.toUpperCase() || ''}${member.lastName?.[0]?.toUpperCase() || ''}`}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {member.position?.name || member.role}
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full ${member.isOnline ? 'bg-green-500' : 'bg-slate-300'
                  }`} />
              </div>
            ))}
            {teamMembers.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Users size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No team members found</p>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full mt-6"
            onClick={() => navigate('/pm/users')}
          >
            View All Users
          </Button>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-800">Recent Projects</h3>
            <div className="flex items-center gap-2">
              <Badge color="info" size="sm">
                {stats.activeProjects} Active
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/pm/projects')}
              >
                View All
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {recentProjects.slice(0, 3).map((project, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-lg ${THEME.gradient} text-white flex items-center justify-center`}>
                    <FolderKanban size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 truncate">{project.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {project.status} • {project.priority} priority
                    </p>
                    {project.startDate && (
                      <p className="text-xs text-slate-400 mt-1">
                        Started: {new Date(project.startDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  color={project.status === 'active' ? 'success' : project.status === 'completed' ? 'info' : 'warning'}
                  size="sm"
                >
                  {project.status}
                </Badge>
              </div>
            ))}
            {recentProjects.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <FolderKanban size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No projects found</p>
                <p className="text-xs mt-1">Your projects will appear here</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-800">Latest Events</h3>
            <Badge color="info" size="sm">
              {events.length} Showing
            </Badge>
          </div>
          <div className="space-y-4">
            {events.slice((eventPage - 1) * EVENTS_PER_PAGE, eventPage * EVENTS_PER_PAGE).map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => handleViewEvent(event)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-600">
                      <Calendar size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{event.title}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {event.date ? new Date(event.date).toLocaleDateString() : 'No date'}
                        {event.time ? ` • ${event.time}` : ''}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {event.location || 'No location'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={getStatusColor(event.status)} size="sm">
                      {event.status}
                    </Badge>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Eye size={14} />
                      View
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {events.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <Calendar size={28} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No events found</p>
                <p className="text-xs mt-1">Events will appear here once created</p>
              </div>
            )}
          </div>
          {events.length > EVENTS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEventPageChange('prev')}
                disabled={eventPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                Prev
              </Button>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                {Array.from({ length: Math.ceil(events.length / EVENTS_PER_PAGE) }, (_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEventPage(idx + 1)}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${eventPage === idx + 1 ? 'bg-[#C4009A]' : 'bg-slate-300 hover:bg-slate-400'}`}
                    aria-label={`Go to events page ${idx + 1}`}
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEventPageChange('next')}
                disabled={eventPage === Math.ceil(events.length / EVENTS_PER_PAGE)}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-800 mb-5">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center gap-1 text-sm p-3 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/pm/projects')}
          >
            <FolderKanban size={20} className="flex-shrink-0" />
            <span className="text-center">Projects</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center gap-1 text-sm p-3 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/pm/tasks')}
          >
            <CheckSquare size={20} className="flex-shrink-0" />
            <span className="text-center">Tasks</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center gap-1 text-sm p-3 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/pm/users')}
          >
            <Users size={20} className="flex-shrink-0" />
            <span className="text-center">Users</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center gap-1 text-sm p-3 h-auto min-h-[64px] hover:bg-slate-50 transition-colors"
            onClick={() => navigate('/pm/referrals')}
          >
            <Target size={20} className="flex-shrink-0" />
            <span className="text-center">Referrals</span>
          </Button>
        </div>
      </Card>

      {showEventModal && viewingEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Event Details</h2>
              <button onClick={() => setShowEventModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {viewingEvent.imageUrl && (
                <div className="w-full">
                  <img
                    src={viewingEvent.imageUrl.startsWith('http') ? viewingEvent.imageUrl : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${viewingEvent.imageUrl}`}
                    alt={viewingEvent.title}
                    className="w-full h-80 object-cover rounded-lg border border-slate-200"
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <h3 className="text-2xl font-bold text-slate-800">{viewingEvent.title}</h3>
                  <Badge color={getCategoryColor(viewingEvent.category)}>{viewingEvent.category}</Badge>
                  <Badge color={getStatusColor(viewingEvent.status)}>{viewingEvent.status}</Badge>
                </div>
                <p className="text-slate-600">{viewingEvent.description || 'No description available.'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-fuchsia-50 text-[#C4009A] flex items-center justify-center"><Calendar size={20} /></div>
                    <div>
                      <p className="text-sm text-slate-500">Date</p>
                      <p className="font-medium text-slate-800">
                        {viewingEvent.date
                          ? new Date(viewingEvent.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                          : '-'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Clock size={20} /></div>
                    <div><p className="text-sm text-slate-500">Time</p><p className="font-medium text-slate-800">{viewingEvent.time || '-'}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><MapPin size={20} /></div>
                    <div><p className="text-sm text-slate-500">Location</p><p className="font-medium text-slate-800">{viewingEvent.location || '-'}</p></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><Users size={20} /></div>
                    <div><p className="text-sm text-slate-500">Capacity</p><p className="font-medium text-slate-800">{viewingEvent.maxAttendees || '-'}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Calendar size={20} /></div>
                    <div><p className="text-sm text-slate-500">Organizer</p><p className="font-medium text-slate-800">{viewingEvent.organizer || '-'}</p></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <Button onClick={() => setShowEventModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
