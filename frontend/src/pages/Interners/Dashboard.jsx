import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { 
  CheckSquare, Clock, CircleCheck, BookOpen, Calendar, User, AlertCircle, Share2, GraduationCap, TrendingUp, Shield, FolderKanban, Users, Target, Award, Briefcase, Loader2, Eye, X, MapPin
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { tasksAPI } from '../../api/tasks';
import { projectsAPI } from '../../api/projects';
import { referralsAPI } from '../../api/referrals';
import { attendanceAPI } from '../../api/attendance';
import { eventsAPI } from '../../api/events';
import Loading from '../../components/Loading';

const Dashboard = ({ userRole }) => {
  const navigate = useNavigate();
  const [loadingCount, setLoadingCount] = useState(0);
  const [stats, setStats] = useState({
    myTasks: 0,
    hoursThisWeek: 0,
    referrals: 0,
    internshipDuration: '0mo',
    attendanceRate: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [learningProjects, setLearningProjects] = useState([]);
  const [learningProgress, setLearningProgress] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const internerStats = [
    { label: "My Tasks", val: stats.myTasks, icon: CheckSquare, color: "text-[#C4009A]", bg: "bg-fuchsia-50" },
    { label: "Hours This Week", val: stats.hoursThisWeek + 'h', icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Referrals", val: stats.referrals, icon: Share2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Attendance Rate", val: stats.attendanceRate + '%', icon: Shield, color: "text-amber-600", bg: "bg-amber-50" },
  ];

  const THEME = {
    gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  };

  const summarizeTasks = (tasks = []) => {
    return tasks.reduce(
      (acc, task) => {
        const status = task.status || 'pending';

        if (status === 'completed') {
          acc.completed += 1;
        } else if (status === 'in_progress') {
          acc.inProgress += 1;
        } else {
          acc.pending += 1;
        }

        acc.total += 1;
        return acc;
      },
      { total: 0, completed: 0, inProgress: 0, pending: 0 }
    );
  };

  const computeProgress = (summary) => {
    if (!summary.total) return 0;
    const weighted = (summary.completed * 100 + summary.inProgress * 50) / summary.total;
    return Math.min(100, Math.round(weighted));
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      startLoading();
      
      // Fetch tasks
      const tasksResponse = await tasksAPI.getMine({ limit: 10 });
      if (tasksResponse.success) {
        const tasks = tasksResponse.data?.tasks || [];
        setRecentTasks(tasks.slice(0, 5));
        setStats(prev => ({ ...prev, myTasks: tasks.length }));
      }

      // Fetch projects
      const projectsResponse = await projectsAPI.getMyProjects({ limit: 5 });
      if (projectsResponse.success) {
        const projects = projectsResponse.data?.projects || [];
        const tasks = tasksResponse.success ? tasksResponse.data?.tasks || [] : [];
        
        // Calculate real progress for each project
        const projectsWithProgress = projects.map(project => {
          const projectTasks = tasks.filter(task => task.project?.id === project.id);
          const summary = summarizeTasks(projectTasks);
          return {
            ...project,
            tasks: projectTasks,
            summary,
            progress: computeProgress(summary)
          };
        });
        
        setLearningProjects(projectsWithProgress.slice(-3)); // Show last 3 projects
      }

      // Generate learning progress data based on completed tasks and projects
      const progressData = [
        { day: 'M', progress: 65, date: 'Monday' },
        { day: 'T', progress: 75, date: 'Tuesday' },
        { day: 'W', progress: 80, date: 'Wednesday' },
        { day: 'T', progress: 85, date: 'Thursday' },
        { day: 'F', progress: 90, date: 'Friday' },
        { day: 'S', progress: 70, date: 'Saturday' },
        { day: 'S', progress: 60, date: 'Sunday' },
      ];
      setLearningProgress(progressData);

      // Fetch referrals
      const referralsResponse = await referralsAPI.getMy();
      if (referralsResponse.success) {
        const referrals = referralsResponse.data?.referrals || [];
        setStats(prev => ({ ...prev, referrals: referrals.length }));
      }

      // Fetch events
      const eventsResponse = await eventsAPI.getAll({ status: 'upcoming', limit: 5 });
      if (eventsResponse.success) {
        const events = eventsResponse.data?.events || [];
        // Sort by date and get upcoming events
        const sortedEvents = events
          .filter(event => event.status === 'upcoming')
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 3);
        setUpcomingEvents(sortedEvents);
      }

      // Fetch today's attendance status
      try {
        const todayAttendanceResponse = await attendanceAPI.getTodayAttendance();
        if (todayAttendanceResponse.success) {
          const attendance = todayAttendanceResponse.data?.attendance?.[0] || null;
          setTodayAttendance(attendance);
        }
      } catch (error) {
        setTodayAttendance(null);
      }

      // Fetch attendance data for real hours and attendance stats
      try {
        const attendanceResponse = await attendanceAPI.getMyAttendance({ limit: 7 }); // Last 7 days
        if (attendanceResponse.success) {
          const attendances = attendanceResponse.data?.attendances || [];
          
          // Calculate hours this week from actual attendance data
          const hoursThisWeek = attendances.reduce((total, att) => {
            if (att.checkInTime && att.checkOutTime) {
              const checkIn = new Date(att.checkInTime);
              const checkOut = new Date(att.checkOutTime);
              const hours = (checkOut - checkIn) / (1000 * 60 * 60); // Convert to hours
              return total + hours;
            }
            return total;
          }, 0);
          
          // Calculate attendance percentage
          const daysWithAttendance = attendances.filter(att => att.checkInTime).length;
          const attendanceSkill = attendances.length > 0 ? Math.round((daysWithAttendance / attendances.length) * 100) : 0;
          
          setStats(prev => ({ 
            ...prev, 
            hoursThisWeek: Math.round(hoursThisWeek),
            attendanceRate: attendanceSkill
          }));
        }
      } catch (error) {
        setStats(prev => ({ ...prev, hoursThisWeek: 0, attendanceRate: 0 }));
      }

    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  const handleNotificationPageChange = (direction) => {
    // This function can be removed if notifications are not implemented
  };

  const handleViewEvent = (event) => {
    setViewingEvent(event);
    setShowEventModal(true);
  };

  const getCategoryColor = (category) => {
    const colors = { meeting: 'brand', workshop: 'warning', conference: 'success', corporate: 'info', social: 'rose', training: 'indigo', business: 'emerald', wellness: 'sky' };
    return colors[category] || 'default';
  };

  const getStatusColor = (status) => {
    const colors = { upcoming: 'success', ongoing: 'warning', completed: 'default', cancelled: 'danger' };
    return colors[status] || 'default';
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6">
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="p-6 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded mb-2 w-20"></div>
                  <div className="h-8 bg-slate-200 rounded w-16"></div>
                </div>
                <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
              </div>
            </Card>
          ))
        ) : (
          internerStats.map((s, i) => (
            <Card key={i} className="p-6 flex items-start justify-between hover:shadow-md transition-shadow">
              <div>
                <p className="text-sm font-medium text-slate-500">{s.label}</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-2">{s.val}</h3>
              </div>
              <div className={`p-3 rounded-lg ${s.bg} ${s.color}`}>
                <s.icon size={20} />
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1">
        {isLoading ? (
          <Card className="lg:col-span-2 p-6 flex flex-col justify-center items-center bg-white text-slate-800 border border-slate-200 animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-64 mb-4"></div>
            <div className="h-4 bg-slate-200 rounded w-96 mb-2"></div>
            <div className="h-4 bg-slate-200 rounded w-80 mb-6"></div>
            <div className="h-10 bg-slate-200 rounded w-32"></div>
          </Card>
        ) : (
          <Card className="lg:col-span-2 p-6 flex flex-col justify-center items-center bg-white text-slate-800 border border-slate-200">
            <h2 className="text-2xl font-bold mb-2 text-slate-900">Welcome Back, Intern!</h2>
            <p className="text-slate-600 mb-4 text-center max-w-md">
              You have {recentTasks.filter(task => task.status !== 'completed').length} pending tasks today.
              {stats.attendanceRate > 80 ? ' Great job maintaining your attendance!' : ' Keep up the good work!'}
            </p>
            <div className="flex gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-slate-500">Today's Status</p>
                <p className="text-lg font-semibold text-slate-700">
                  {todayAttendance ? 
                    (todayAttendance.checkInTime && todayAttendance.checkOutTime ? 'Completed' :
                     todayAttendance.checkInTime ? 'Checked In' : 'Pending') : 
                    'Not Started'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500">Week Progress</p>
                <p className="text-lg font-semibold text-slate-700">{stats.hoursThisWeek}h</p>
              </div>
            </div>
            <Button 
              className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
              onClick={() => navigate('/interners/tasks')}
            >
              View My Tasks
            </Button>
          </Card>
        )}
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-800">All Projects</h3>
            <Button variant="outline" size="sm" onClick={() => navigate('/interners/projects')}>
              View All
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projectsLoading ? (
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="p-4 bg-white rounded-lg border border-slate-200 animate-pulse">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
                    <div className="h-5 bg-slate-200 rounded w-12"></div>
                  </div>
                  <div className="h-4 bg-slate-200 rounded mb-2 w-full"></div>
                  <div className="h-3 bg-slate-200 rounded mb-3 w-full"></div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <div className="h-3 bg-slate-200 rounded w-16"></div>
                      <div className="h-3 bg-slate-200 rounded w-8"></div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full"></div>
                  </div>
                </div>
              ))
            ) : learningProjects.length > 0 ? learningProjects.map((project) => (
              <div
                key={project.id}
                className="p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate('/interners/projects')}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    project.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                    project.status === 'in_progress' ? 'bg-blue-50 text-blue-600' :
                    'bg-fuchsia-50 text-[#C4009A]'
                  }`}>
                    <FolderKanban size={16} />
                  </div>
                  <Badge color={
                    project.status === 'completed' ? 'success' :
                    project.status === 'in_progress' ? 'warning' : 'default'
                  } className="text-xs">
                    {project.status === 'completed' ? 'Done' :
                     project.status === 'in_progress' ? 'Active' : 'Pending'}
                  </Badge>
                </div>
                <h4 className="font-medium text-slate-800 text-sm mb-2 group-hover:text-[#C4009A] transition-colors line-clamp-2">
                  {project.title}
                </h4>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                  {project.description || 'No description available'}
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-medium text-slate-700">
                      {project.progress || 0}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${THEME.gradient}`}
                      style={{
                        width: `${project.progress || 0}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center py-8">
                <FolderKanban size={48} className="mx-auto mb-4 opacity-50 text-slate-400" />
                <p className="font-medium text-slate-700">No projects available</p>
                <p className="text-sm text-slate-500 mt-1">Projects will appear here once assigned</p>
              </div>
            )}
          </div>
        </Card>

      </div> */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Attendance Status */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Today's Attendance</h3>
            <Clock size={16} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            {todayAttendance ? (
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  todayAttendance.checkInTime && todayAttendance.checkOutTime ? 'bg-emerald-500' :
                  todayAttendance.checkInTime ? 'bg-blue-500' : 'bg-slate-300'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    {todayAttendance.checkInTime && todayAttendance.checkOutTime ? 'Completed' :
                     todayAttendance.checkInTime ? 'Checked In' : 'Not Started'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {todayAttendance.checkInTime && `In: ${new Date(todayAttendance.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                    {todayAttendance.checkOutTime && ` | Out: ${new Date(todayAttendance.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Clock size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No attendance record for today</p>
                {/* <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => navigate('/interners/attendance')}
                >
                  Mark Attendance
                </Button> */}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Upcoming Events</h3>
            <Calendar size={16} className="text-slate-400" />
          </div>
          <div className="space-y-3">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event, index) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => handleViewEvent(event)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      index === 0 ? 'bg-[#C4009A]' : 
                      index === 1 ? 'bg-blue-500' : 'bg-emerald-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700">{event.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(event.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}, {event.time || 'All day'}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-4">
                <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No upcoming events</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Quick Actions</h3>
          </div>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/interners/tasks')} disabled={isLoading}>
              {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckSquare size={16} className="mr-2" />}
              View Tasks
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/interners/projects')} disabled={isLoading}>
              {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <BookOpen size={16} className="mr-2" />}
              Learning Projects
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/interners/attendance')} disabled={isLoading}>
              {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Clock size={16} className="mr-2" />}
              Mark Attendance
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/interners/referrals')} disabled={isLoading}>
              {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Share2 size={16} className="mr-2" />}
              Submit Referral
            </Button>
          </div>
        </Card>

        {/* <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Skills Progress</h3>
            <GraduationCap size={16} className="text-slate-400" />
          </div>
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex justify-between text-sm mb-1">
                    <div className="h-4 bg-slate-200 rounded w-24"></div>
                    <div className="h-4 bg-slate-200 rounded w-8"></div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-200 rounded-full w-3/4"></div>
                  </div>
                  <div className="h-3 bg-slate-200 rounded w-32 mt-1"></div>
                </div>
              ))
            ) : (
              (() => {
                // Calculate skills progress based on tasks only (since projects section is commented out)
                const totalTasks = recentTasks.length;
                const completedTasks = recentTasks.filter(task => task.status === 'completed').length;
                
                // Calculate task-related skills
                const taskCompletionSkill = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                
                // For interns, focus on task completion and real attendance data
                const attendanceSkill = stats.attendanceRate || 0;
                const overallProgress = Math.round((taskCompletionSkill + attendanceSkill) / 2);

                const skills = [
                  {
                    name: 'Task Completion',
                    progress: taskCompletionSkill,
                    description: `${completedTasks}/${totalTasks} tasks completed`
                  },
                  {
                    name: 'Attendance & Punctuality',
                    progress: attendanceSkill,
                    description: `${Math.round(attendanceSkill)}% attendance rate`
                  },
                  {
                    name: 'Overall Performance',
                    progress: overallProgress,
                    description: 'Combined task performance'
                  }
                ];

                return skills.map((skill, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{skill.name}</span>
                      <span className="font-medium">{skill.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${THEME.gradient}`}
                        style={{ width: `${skill.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{skill.description}</p>
                  </div>
                ));
              })()
            )}
          </div>
        </Card> */}
      </div>

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
