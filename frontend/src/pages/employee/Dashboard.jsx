import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  CheckSquare, Clock, CircleCheck, BookOpen, Calendar,
  User, AlertCircle, Share2, GraduationCap, TrendingUp, Shield,
  FolderKanban, Users, Target, Award, Briefcase, Loader2, Eye, X, MapPin
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { tasksAPI } from '../../api/tasks';
import { projectsAPI } from '../../api/projects';
import { referralsAPI } from '../../api/referrals';
import { eventsAPI } from '../../api/events';
import { attendanceAPI } from '../../api/attendance';
import Loading from '../../components/Loading';

const Dashboard = ({ userRole }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employeeMetrics, setEmployeeMetrics] = useState({
    myTasks: 0,
    hoursThisWeek: 0,
    referrals: 0,
    yearsOfService: 0,
    activeProjects: 0,
    totalProjects: 0,
    completedTasks: 0,
    teamContribution: 0,
    performanceScore: 0
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [learningProjects, setLearningProjects] = useState([]);
  const [learningProgress, setLearningProgress] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [viewingEvent, setViewingEvent] = useState(null);

  const employeeStats = [
    { label: "Active Projects", val: employeeMetrics.activeProjects, icon: FolderKanban, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Completed Tasks", val: employeeMetrics.completedTasks, icon: CircleCheck, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending Tasks", val: employeeMetrics.myTasks - employeeMetrics.completedTasks, icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Performance Score", val: employeeMetrics.performanceScore, icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
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
      setLoading(true);

      const [tasksResponse, projectsResponse, referralsResponse, eventsResponse, attendanceResponse, todayAttendanceResponse] = await Promise.all([
        tasksAPI.getMine({ limit: 100 }),
        projectsAPI.getMyProjects({ limit: 5 }),
        referralsAPI.getMy(),
        eventsAPI.getAll({ status: 'upcoming', limit: 5 }),
        attendanceAPI.getMyAttendance(),
        attendanceAPI.getTodayAttendance()
      ]);

      if (tasksResponse.success) {
        const tasks = tasksResponse.data?.tasks || [];
        setRecentTasks(tasks.slice(0, 5));
        const completedTasks = tasks.filter(task => task.status === 'completed').length;
        setEmployeeMetrics(prev => ({
          ...prev,
          myTasks: tasks.length,
          completedTasks: completedTasks
        }));
      }

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
        
        setLearningProjects(projectsWithProgress.slice(-3));
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

      if (referralsResponse.success) {
        const referrals = referralsResponse.data?.referrals || [];
        setEmployeeMetrics(prev => ({ ...prev, referrals: referrals.length }));
      }

      if (eventsResponse.success) {
        const events = eventsResponse.data?.events || [];
        // Sort by date and get upcoming events
        const sortedEvents = events
          .filter(event => event.status === 'upcoming')
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(0, 3);
        setUpcomingEvents(sortedEvents);
      }

      if (attendanceResponse.success) {
        const attendance = attendanceResponse.data?.attendance || [];
        setAttendanceData(attendance);
        
        // Calculate hours this week from attendance data
        const currentWeek = attendance.filter(record => {
          const recordDate = new Date(record.date);
          const today = new Date();
          const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
          const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
          return recordDate >= weekStart && recordDate <= weekEnd;
        });
        
        const hoursThisWeek = currentWeek.reduce((total, record) => {
          return total + (record.hoursWorked || 0);
        }, 0);
        
        setEmployeeMetrics(prev => ({ ...prev, hoursThisWeek }));
      }

      // Set today's attendance
      if (todayAttendanceResponse.success) {
        const attendance = todayAttendanceResponse.data?.attendance?.[0] || null;
        setTodayAttendance(attendance);
      }

      // Calculate team contribution and performance score
      const projects = projectsResponse.success ? projectsResponse.data?.projects || [] : [];
      const tasks = tasksResponse.success ? tasksResponse.data?.tasks || [] : [];

      // Calculate projects from actual projects data (more accurate)
      const activeProjectsCount = projects.filter(p => p.status === 'active').length;
      const completedProjects = projects.filter(p => p.status === 'completed').length;
      const totalProjects = projects.length;
      const totalTasks = tasks.length;
      const completedTasksCount = tasks.filter(task => task.status === 'completed').length;

      const teamContribution = totalProjects; // Number of projects assigned to employee

      const taskCompletionRate = totalTasks > 0 ? (completedTasksCount / totalTasks) * 100 : 0;
      const projectCompletionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;
      const performanceScore = Math.round((taskCompletionRate + projectCompletionRate) / 2);

      // Update all metrics correctly
      setEmployeeMetrics(prev => ({
        ...prev,
        activeProjects: activeProjectsCount,
        totalProjects: totalProjects,
        teamContribution,
        performanceScore,
        completedTasks: completedTasksCount,
        myTasks: totalTasks
      }));

      setEmployeeMetrics(prev => ({ ...prev, yearsOfService: 2 }));

    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

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
      {loading && <Loading size={80} bg="bg-black/20" />}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {employeeStats.map((s, i) => (
          <Card key={i} className="p-6 flex items-start justify-between hover:shadow-md transition-shadow">
            <div>
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-2">{s.val}</h3>
            </div>
            <div className={`p-3 rounded-lg ${s.bg} ${s.color}`}>
              <s.icon size={20} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1">
        <Card className="lg:col-span-2 p-6 flex flex-col justify-center items-center bg-white text-slate-800 border border-slate-200">
          <h2 className="text-2xl font-bold mb-2 text-slate-900">Welcome Back, Employee!</h2>
          <p className="text-slate-600 mb-4 text-center max-w-md">
            You have {recentTasks.filter(task => task.status !== 'completed').length} pending tasks today.
            {employeeMetrics.performanceScore > 80 ? ' Excellent performance this week!' : ' Keep up the great work!'}
          </p>
          <div className="flex gap-6 mb-6">
            <div className="text-center">
              <p className="text-sm text-slate-500">Active Projects</p>
              <p className="text-lg font-semibold text-slate-700">{employeeMetrics.activeProjects}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500">Week Progress</p>
              <p className="text-lg font-semibold text-slate-700">{employeeMetrics.hoursThisWeek}h</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500">Performance</p>
              <p className="text-lg font-semibold text-slate-700">{employeeMetrics.performanceScore}%</p>
            </div>
          </div>
          <Button
            className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
            onClick={() => navigate('/employee/tasks')}
          >
            View My Tasks
          </Button>
        </Card>
      </div>

      {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-800">All Projects</h3>
            <Button variant="outline" size="sm" onClick={() => navigate('/employee/projects')}>
              View All
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {learningProjects.length > 0 ? learningProjects.map((project) => (
              <div
                key={project.id}
                className="p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(`/employee/projects`)}
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
                    {project.status === 'completed' ? 'Completed' :
                     project.status === 'in_progress' ? 'In Progress' : 'Not Started'}
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
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => navigate('/employee/attendance')}
                >
                  Mark Attendance
                </Button>
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
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/employee/tasks')}>
              <CheckSquare size={16} className="mr-2" />
              View Tasks
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/employee/projects')}>
              <BookOpen size={16} className="mr-2" />
              Active Projects
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/employee/attendance')}>
              <Clock size={16} className="mr-2" />
              Attendance
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/employee/referrals')}>
              <Share2 size={16} className="mr-2" />
              Submit Referral
            </Button>
          </div>
        </Card>

        {/* <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800">Attendance Overview</h3>
            <Clock size={16} className="text-slate-400" />
          </div>
          <div className="space-y-4">
            {(() => {
              // Calculate attendance metrics
              const totalDays = attendanceData.length;
              const presentDays = attendanceData.filter(record => record.status === 'present').length;
              const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
              
              // Calculate current week attendance
              const currentWeek = attendanceData.filter(record => {
                const recordDate = new Date(record.date);
                const today = new Date();
                const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
                const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
                return recordDate >= weekStart && recordDate <= weekEnd;
              });
              
              const weekHours = currentWeek.reduce((total, record) => {
                return total + (record.hoursWorked || 0);
              }, 0);

              const attendanceMetrics = [
                {
                  name: 'Attendance Rate',
                  progress: attendanceRate,
                  description: `${presentDays}/${totalDays} days present`
                },
                {
                  name: 'Monthly Attendance',
                  progress: attendanceRate, // Use same attendance rate but for monthly context
                  description: `${presentDays} days this month`
                },
                {
                  name: 'Punctuality',
                  progress: 90, // Could be calculated from actual check-in times
                  description: 'Excellent punctuality'
                }
              ];

              return attendanceMetrics.map((metric, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{metric.name}</span>
                    <span className="font-medium">{metric.progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${THEME.gradient}`}
                      style={{ width: `${metric.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{metric.description}</p>
                </div>
              ));
            })()}
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
