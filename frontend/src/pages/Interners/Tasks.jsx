import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
  CheckSquare, Clock, CircleCheck, X, Calendar, User, AlertCircle, Loader2
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Loading from '../../components/Loading';
import { tasksAPI } from '../../api/tasks';

const normalizeStatus = (status = 'pending') => status.toString().toLowerCase();
const normalizePriority = (priority = 'medium') => priority.toString().toLowerCase();

const mapUser = (user = {}) => {
  if (!user) return null;
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim() || user.name || user.email || 'Unknown User';

  return {
    id: user.id,
    name: fullName,
    role: user.position?.name || user.role || 'Team Member',
    avatar: user.avatar || null,
    initials: `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || fullName?.[0]?.toUpperCase() || 'U'
  };
};

const normalizeTask = (task = {}, currentUser = null) => {
  const assignedUser = task.user || currentUser;
  const assignedTo = mapUser(assignedUser);

  return {
    id: task.id,
    title: task.title || 'Untitled Task',
    description: task.description || 'No description provided yet.',
    status: normalizeStatus(task.status || 'pending'),
    priority: normalizePriority(task.priority || 'medium'),
    deadline: task.deadline || task.project?.deadline || null,
    completedDate: task.completedAt || task.completedDate || null,
    project: task.project?.title || 'Unassigned Project',
    projectInfo: task.project || null,
    assignedTo,
    createdBy: null
  };
};

const mapTaskDetail = (task = {}) => {
  const assignedTo = mapUser(task.user);
  const projectManager = task.project?.projectManager ? mapUser(task.project.projectManager) : null;

  return {
    id: task.id,
    title: task.title || 'Untitled Task',
    description: task.description || 'No description provided yet.',
    status: normalizeStatus(task.status || 'pending'),
    priority: normalizePriority(task.priority || 'medium'),
    deadline: task.deadline || task.project?.deadline || null,
    completedDate: task.completedAt || task.completedDate || null,
    project: task.project?.title || 'Unassigned Project',
    projectInfo: task.project || null,
    assignedTo,
    createdBy: projectManager
  };
};

const getDaysLeft = (deadline) => {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const diffTime = deadlineDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getDeadlineLabel = (task) => {
  if (task.status === 'completed') {
    if (!task.completedDate) return 'Completed';
    return `Completed ${new Date(task.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  const daysLeft = getDaysLeft(task.deadline);
  if (daysLeft === null) return 'No deadline';
  if (daysLeft < 0) return `Overdue by ${Math.abs(daysLeft)}d`;
  if (daysLeft === 0) return 'Due today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
};

const Tasks = ({ userRole }) => {
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [taskDetails, setTaskDetails] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const itemsPerPage = 10;

  const sendStatusNotifications = useCallback(async (taskId, taskTitle, status) => {
    // Notifications are now handled by backend automatically
    return;
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (error) {
      }
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: itemsPerPage
      };

      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }

      const response = await tasksAPI.getMine(params);

      if (!response.success) {
        throw new Error(response.message || 'Failed to load tasks');
      }

      const fetchedTasks = response.data?.tasks || [];
      const normalizedTasks = fetchedTasks.map((task) => normalizeTask(task, currentUser));

      setTasks(normalizedTasks);
      setPagination(response.data?.pagination || { page: currentPage, limit: itemsPerPage, total: fetchedTasks.length, pages: 1 });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, itemsPerPage, currentUser]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const loadTaskDetail = useCallback(async (taskId) => {
    try {
      setLoading(true);
      if (taskDetails[taskId]) return;

      const response = await tasksAPI.getById(taskId);

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch task');
      }

      const detail = mapTaskDetail(response.data);
      setTaskDetails((prev) => ({ ...prev, [taskId]: detail }));
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  }, [taskDetails]);

  const updateTaskStatus = useCallback(async (taskId, status, successMessage) => {
    try {
      setLoading(true);
      const response = await tasksAPI.updateStatus(taskId, status);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update task');
      }

      toast.success(successMessage);
      setShowTaskModal(false);
      await fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  }, [fetchTasks]);

  const handleMarkComplete = useCallback(async (taskId) => {
    try {
      setLoading(true);
      const response = await tasksAPI.updateStatus(taskId, 'completed');
      if (!response.success) {
        throw new Error(response.message || 'Failed to update task');
      }

      toast.success('Task marked as complete');
      const task = tasks.find((t) => t.id === taskId);
      // Notifications handled by backend automatically
      setTaskDetails(prev => {
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });
      setShowTaskModal(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  }, [fetchTasks, tasks]);

  const handleMarkInProgress = useCallback(async (taskId) => {
    try {
      setLoading(true);
      const response = await tasksAPI.updateStatus(taskId, 'in_progress');
      if (!response.success) {
        throw new Error(response.message || 'Failed to update task');
      }

      toast.success('Task marked as in progress');
      const task = tasks.find((t) => t.id === taskId);
      // Notifications handled by backend automatically
      setTaskDetails(prev => {
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });
      setShowTaskModal(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  }, [fetchTasks]);

  const employeeTasks = tasks;

  const filteredTasks = employeeTasks.filter(task => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  const totalPages = pagination.pages || 1;
  const paginatedTasks = filteredTasks;
  const startIndex = ((pagination.page || 1) - 1) * itemsPerPage;

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  const handleViewTask = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);

    if (task && !taskDetails[task.id]) {
      loadTaskDetail(task.id);
    }
  };

  const handleCloseModal = () => {
    setShowTaskModal(false);
    setSelectedTask(null);
  };


  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'default';
      default: return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  const displayedTask = useMemo(() => {
    if (!selectedTask) return null;
    return taskDetails[selectedTask.id] || selectedTask;
  }, [selectedTask, taskDetails]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {loading && <Loading size={80} bg="bg-black/20" />}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-semibold text-slate-700">
            My Assigned Tasks
          </h3>
          <div className="flex gap-2 text-sm flex-wrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded font-medium transition-colors ${filterStatus === 'all'
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:bg-white/50'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1 rounded font-medium transition-colors ${filterStatus === 'pending'
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:bg-white/50'
                }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`px-3 py-1 rounded font-medium transition-colors ${filterStatus === 'in_progress'
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:bg-white/50'
                }`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 rounded font-medium transition-colors ${filterStatus === 'completed'
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:bg-white/50'
                }`}
            >
              Completed
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
                <Loader2 className="animate-spin" size={18} /> Loading tasks...
              </div>
            ) : paginatedTasks.length ? (
              paginatedTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all cursor-pointer"
                  onClick={() => handleViewTask(task)}
                >
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${task.status === 'completed'
                        ? 'bg-slate-500 border-slate-500'
                        : task.status === 'in_progress'
                          ? 'border-[#7E006C] text-[#7E006C]'
                          : 'border-slate-300 hover:border-[#7E006C]'
                      }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (task.status === 'pending') {
                        handleMarkInProgress(task.id);
                      } else if (task.status === 'in_progress') {
                        handleMarkComplete(task.id);
                      }
                    }}
                  >
                    {task.status === 'completed' && <CheckSquare size={12} className="text-white" />}
                  </div>

                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800 group-hover:text-[#7E006C] transition-colors">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge color={getPriorityColor(task.priority)}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </Badge>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={10} />
                        {getDeadlineLabel(task)}
                      </span>
                      <span className="text-xs text-slate-400">{task.project}</span>
                    </div>
                  </div>

                  <Avatar
                    size="sm"
                    src={task.assignedTo?.avatar}
                    fallback={task.assignedTo?.initials || 'ME'}
                    title={task.assignedTo?.name}
                    className="border border-white shadow-sm"
                  />
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center py-12 text-slate-500">
                No tasks found
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, pagination.total)} of {pagination.total} tasks
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(page)}
                    className={currentPage === page ? "bg-[#C4009A] hover:bg-[#C4009A]/90 text-white" : ""}
                  >
                    {page}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Task Detail Modal */}
      {showTaskModal && displayedTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Task Details</h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{displayedTask.title}</h3>
                <p className="text-slate-600">{displayedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Status</p>
                  <Badge color={getStatusColor(displayedTask.status)}>
                    {displayedTask.status === 'completed' ? 'Completed' :
                      displayedTask.status === 'in_progress' ? 'In Progress' : 'Pending'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Priority</p>
                  <Badge color={getPriorityColor(displayedTask.priority)}>
                    {displayedTask.priority.charAt(0).toUpperCase() + displayedTask.priority.slice(1)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Project</p>
                  <p className="font-medium text-slate-800">{displayedTask.project}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Deadline</p>
                  <p className="font-medium text-slate-800">
                    {displayedTask.deadline
                      ? new Date(displayedTask.deadline).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                      : 'No deadline set'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Assigned by</p>
                  {displayedTask.createdBy ? (
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" fallback={displayedTask.createdBy.initials} src={displayedTask.createdBy.avatar} />
                      <div>
                        <p className="font-medium text-slate-800">{displayedTask.createdBy.name}</p>
                        <p className="text-sm text-slate-500">{displayedTask.createdBy.role}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Assignment details unavailable.</p>
                  )}
                </div>

                {displayedTask.status === 'completed' && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Completed on</p>
                    <p className="font-medium text-slate-800">
                      {displayedTask.completedDate
                        ? new Date(displayedTask.completedDate).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                        : 'Completion date unavailable'}
                    </p>
                  </div>
                )}
              </div>

              {displayedTask.status !== 'completed' && (
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <Button
                    variant={displayedTask.status === 'in_progress' ? 'default' : 'outline'}
                    icon={Clock}
                    onClick={() => handleMarkInProgress(displayedTask.id)}
                    disabled={loading}
                    className={displayedTask.status === 'in_progress' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}
                  >
                    In Progress
                  </Button>
                  <Button
                    variant={displayedTask.status === 'completed' ? 'default' : 'outline'}
                    icon={CircleCheck}
                    onClick={() => handleMarkComplete(displayedTask.id)}
                    disabled={loading}
                    className={displayedTask.status === 'completed' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                  >
                    Completed
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
