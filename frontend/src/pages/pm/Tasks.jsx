import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  CheckSquare, Clock, CircleCheck, X, Eye, Calendar, User, AlertCircle, Search
} from 'lucide-react';
import { tasksAPI } from '../../api/tasks';
import { projectsAPI } from '../../api/projects';
import { usersAPI } from '../../api/users';
import { notificationsAPI } from '../../api/notifications';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import SearchableDropdown from '../../components/SearchableDropdown';
import Loading from '../../components/Loading';

const Tasks = ({ userRole }) => {
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const itemsPerPage = 10;
  const [loadingCount, setLoadingCount] = useState(0);

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);


  const getAvatarFallback = (user = {}) => {
    return `${user.firstName?.[0]?.toUpperCase() || ''}${user.lastName?.[0]?.toUpperCase() || ''}` || 'U';
  };

  const normalizeTask = (task) => {
    const user = task.user || {};
    const normalizedUser = {
      id: user.id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.position?.name || user.role || 'Team Member',
      email: user.email || '',
      avatar: user.avatar || null,
      initials: `${user.firstName?.[0]?.toUpperCase() || ''}${user.lastName?.[0]?.toUpperCase() || ''}` || 'U'
    };

    return {
      ...task,
      assignedTo: normalizedUser,
      project: task.project?.title || 'Unknown Project'
    };
  };

  const fetchTasks = async () => {
    startLoading();
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(selectedPriority !== 'all' && { priority: selectedPriority }),
        ...(selectedProject !== 'all' && { projectId: selectedProject }),
        ...(selectedUser !== 'all' && { userId: selectedUser }),
        ...(userSearchTerm && { search: userSearchTerm })
      };

      const [tasksResponse, projectsResponse, usersResponse] = await Promise.all([
        tasksAPI.getAll(params),
        projectsAPI.getAll(),
        usersAPI.getAll()
      ]);

      if (tasksResponse.success) {
        const fetchedTasks = tasksResponse.data?.tasks || [];
        const normalizedTasks = fetchedTasks.map(normalizeTask);
        setTasks(normalizedTasks);
        setPagination(tasksResponse.data?.pagination || pagination);
      }

      if (projectsResponse.success) {
        setProjects(projectsResponse.data.projects);
      }

      if (usersResponse.success) {
        setUsers(usersResponse.data.users);
      }
    } catch (error) {
      toast.error('Failed to fetch tasks');
    } finally {
      stopLoading();
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentPage, filterStatus, selectedPriority, selectedProject, userSearchTerm, selectedUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, selectedPriority, selectedProject, userSearchTerm, selectedUser]);

  const filteredTasks = tasks;

  const handleViewTask = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleMarkComplete = async (taskId) => {
    startLoading();
    try {
      const response = await tasksAPI.updateStatus(taskId, 'completed');

      if (response.success) {
        toast.success('Task marked as complete');

        const task = tasks.find(t => t.id === taskId);
        if (task && task.assignedTo && task.assignedTo.id) {
          await notificationsAPI.create({
            title: 'Task Completed',
            message: `Your task "${task.title}" has been marked as completed`,
            type: 'success',
            userId: task.assignedTo.id
          });
        }

        fetchTasks();
        setShowTaskModal(false);
      }
    } catch (error) {
      toast.error('Failed to mark task as complete');
    } finally {
      stopLoading();
    }
  };

  const handleMarkInProgress = async (taskId) => {
    startLoading();
    try {
      const response = await tasksAPI.updateStatus(taskId, 'in_progress');

      if (response.success) {
        toast.success('Task marked as in progress');

        const task = tasks.find(t => t.id === taskId);
        if (task && task.assignedTo && task.assignedTo.id) {
          await notificationsAPI.create({
            title: 'Task In Progress',
            message: `Your task "${task.title}" has been marked as in progress`,
            type: 'info',
            userId: task.assignedTo.id
          });
        }

        fetchTasks();
        setShowTaskModal(false);
      }
    } catch (error) {
      toast.error('Failed to mark task as in progress');
    } finally {
      stopLoading();
    }
  };


  const handleMarkPending = async (taskId) => {
    startLoading();
    try {
      const response = await tasksAPI.updateStatus(taskId, 'pending');

      if (response.success) {
        toast.success('Task marked as pending');

        const task = tasks.find(t => t.id === taskId);
        if (task && task.assignedTo && task.assignedTo.id) {
          await notificationsAPI.create({
            title: 'Task Pending',
            message: `Your task "${task.title}" has been marked as pending`,
            type: 'warning',
            userId: task.assignedTo.id
          });
        }

        fetchTasks();
        setShowTaskModal(false);
      }
    } catch (error) {
      toast.error('Failed to mark task as pending');
    } finally {
      stopLoading();
    }
  };

  const handleUnmarkComplete = async (taskId) => {
    startLoading();
    try {
      const response = await tasksAPI.updateStatus(taskId, 'in_progress');

      if (response.success) {
        toast.success('Task marked as in progress');
        fetchTasks();
        setShowTaskModal(false);
      }
    } catch (error) {
      toast.error('Failed to mark task as pending');
    }
  };

  const getDaysLeft = (deadline) => {
    if (!deadline) return 'No deadline';

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate calculation

    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0); // Set to start of day for accurate calculation

    const diffTime = deadlineDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="font-semibold text-slate-700">
              {userRole === 'employee' ? 'My Assigned Tasks' : 'All Team Tasks'}
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

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center ">
            <div className="relative w-full lg:max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
              />
            </div>
            <SearchableDropdown
              options={[
                { id: 'high', name: 'High' },
                { id: 'medium', name: 'Medium' },
                { id: 'low', name: 'Low' }
              ]}
              value={selectedPriority}
              onChange={(value) => setSelectedPriority(value)}
              placeholder="All Priorities"
              allOptionLabel="All Priorities"
              className="min-w-[140px]"
            />
            <SearchableDropdown
              options={projects.map(p => ({ id: p.id, name: p.title }))}
              value={selectedProject}
              onChange={(value) => setSelectedProject(value)}
              placeholder="All Projects"
              allOptionLabel="All Projects"
              className="min-w-[140px]"
            />
            <div className="relative">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onFocus={() => setIsUserDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsUserDropdownOpen(false), 100)}
                placeholder="Search user..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A] min-w-[140px]"
              />
              {isUserDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <div
                    className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                    onMouseDown={() => { setSelectedUser('all'); setUserSearch(''); }}
                  >
                    All Users
                  </div>
                  {users
                    .filter(user => `${user.firstName} ${user.lastName}`.toLowerCase().includes(userSearch.toLowerCase()))
                    .map(user => (
                      <div
                        key={user.id}
                        className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                        onMouseDown={() => { setSelectedUser(user.id); setUserSearch(`${user.firstName} ${user.lastName}`); }}
                      >
                        {`${user.firstName} ${user.lastName}`}
                      </div>
                    ))}
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setUserSearchTerm(''); setSelectedPriority('all'); setSelectedProject('all'); setFilterStatus('all'); setSelectedUser('all'); }}
              >
                Clear
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-slate-500">Loading tasks...</div>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {filteredTasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-500">
                  No tasks found
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-100 transition-all cursor-pointer"
                    onClick={() => handleViewTask(task)}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${task.status === 'completed'
                      ? 'bg-slate-500 border-slate-500'
                      : 'border-slate-300 hover:border-[#7E006C]'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (task.status === 'completed' && (userRole === 'admin' || userRole === 'pm')) {
                          handleUnmarkComplete(task.id);
                        } else if (task.status !== 'completed') {
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
                        <Badge color={getStatusColor(task.status)}>
                          {task.status === 'completed' ? 'Completed' :
                            task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                        </Badge>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock size={10} />
                          {task.status === 'completed'
                            ? (
                              <span className={task.completedAt && task.deadline && new Date(task.completedAt) > new Date(task.deadline) ? 'text-red-600 font-medium' : ''}>
                                {`Completed ${new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                {task.completedAt && task.deadline && new Date(task.completedAt) > new Date(task.deadline) && ' (overdue)'}
                              </span>
                            )
                            : (
                              <span className={task.deadline && getDaysLeft(task.deadline) < 0 ? 'text-red-600 font-medium' : ''}>
                                {!task.deadline ? 'No deadline' :
                                  getDaysLeft(task.deadline) < 0 ? `${Math.abs(getDaysLeft(task.deadline))} days overdue` : `${getDaysLeft(task.deadline)} days left`}
                              </span>
                            )
                          }
                        </span>
                        <span className="text-xs text-slate-400">{task.project}</span>
                      </div>
                    </div>

                    <Avatar
                      size="sm"
                      src={task.assignedTo?.avatar}
                      fallback={`${task.assignedTo?.firstName?.[0]?.toUpperCase() || ''}${task.assignedTo?.lastName?.[0]?.toUpperCase() || ''}`}
                      title={task.assignedTo?.name}
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {pagination.page * pagination.limit - pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} tasks
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 text-sm border rounded ${
                      currentPage === page
                        ? "bg-[#C4009A] text-white border-[#C4009A]"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Task Detail Modal */}
      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Task Details</h2>
              <button
                onClick={() => setShowTaskModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">{selectedTask.title}</h3>
                <p className="text-slate-600">{selectedTask.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Status</p>
                  <Badge color={getStatusColor(selectedTask.status)}>
                    {selectedTask.status === 'completed' ? 'Completed' :
                      selectedTask.status === 'in_progress' ? 'In Progress' : 'Pending'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Priority</p>
                  <Badge color={getPriorityColor(selectedTask.priority)}>
                    {selectedTask.priority.charAt(0).toUpperCase() + selectedTask.priority.slice(1)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Project</p>
                  <p className="font-medium text-slate-800">{selectedTask.project}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Deadline</p>
                  <p className="font-medium text-slate-800">
                    {selectedTask.deadline ?
                      new Date(selectedTask.deadline).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'No deadline set'
                    }
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Assigned to</p>
                  <div className="flex items-center gap-2">
                    <Avatar
                      size="sm"
                      src={selectedTask.assignedTo?.avatar}
                      fallback={`${selectedTask.assignedTo?.firstName?.[0]?.toUpperCase() || ''}${selectedTask.assignedTo?.lastName?.[0]?.toUpperCase() || ''}`}
                    />
                    <div>
                      <p className="font-medium text-slate-800">{selectedTask.assignedTo.name}</p>
                      <p className="text-sm text-slate-500">{selectedTask.assignedTo.role}</p>
                    </div>
                  </div>
                </div>

                {selectedTask.status === 'completed' && (
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Completed on</p>
                    <p className="font-medium text-slate-800">
                      {new Date(selectedTask.completedAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <Button
                  variant={selectedTask.status === 'pending' ? 'default' : 'outline'}
                  icon={Clock}
                  onClick={() => handleMarkPending(selectedTask.id)}
                  className={selectedTask.status === 'pending' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}
                >
                  Pending
                </Button>
                <Button
                  variant={selectedTask.status === 'in_progress' ? 'default' : 'outline'}
                  icon={Clock}
                  onClick={() => handleMarkInProgress(selectedTask.id)}
                  className={selectedTask.status === 'in_progress' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}
                >
                  In Progress
                </Button>
                <Button
                  variant={selectedTask.status === 'completed' ? 'default' : 'outline'}
                  icon={CircleCheck}
                  onClick={() => handleMarkComplete(selectedTask.id)}
                  className={selectedTask.status === 'completed' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}
                >
                  Completed
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
