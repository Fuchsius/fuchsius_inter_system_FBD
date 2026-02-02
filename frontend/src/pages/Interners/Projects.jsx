import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { 
  FolderKanban, X, CheckCircle, Clock, AlertCircle
} from 'lucide-react';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Loading from '../../components/Loading';
import { tasksAPI } from '../../api/tasks';
import { projectsAPI } from '../../api/projects';

const PRIORITY_LEVELS = ['low', 'medium', 'high', 'urgent'];

const normalizePriority = (value = 'medium') => {
  const normalized = (value || '').toString().toLowerCase();
  return PRIORITY_LEVELS.includes(normalized) ? normalized : 'medium';
};

const normalizeStatus = (value = 'pending') => {
  if (!value) return 'pending';
  return value.toString().toLowerCase();
};

const getHighestPriority = (current = 'medium', candidate = 'medium') => {
  const currentIndex = PRIORITY_LEVELS.indexOf(current);
  const candidateIndex = PRIORITY_LEVELS.indexOf(candidate);

  if (candidateIndex === -1) return current;
  if (currentIndex === -1) return candidate;
  return candidateIndex > currentIndex ? candidate : current;
};

const getEarliestDate = (current, candidate) => {
  if (!candidate) return current || null;
  if (!current) return candidate;

  const currentDate = new Date(current);
  const candidateDate = new Date(candidate);

  return candidateDate < currentDate ? candidate : current;
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

const formatShortDate = (date, fallback = 'No deadline') => {
  if (!date) return fallback;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatLongDate = (date) => {
  if (!date) return 'Not set';
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getPriorityBadgeColor = (priority) => {
  switch (priority) {
    case 'high':
    case 'urgent':
      return 'brand';
    case 'medium':
      return 'warning';
    default:
      return 'default';
  }
};

const getTaskStatusBadgeColor = (status) => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'warning';
    default:
      return 'default';
  }
};

const formatStatusLabel = (status = '') =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const formatPriorityLabel = (priority = 'medium') =>
  priority.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

// Function to convert URLs in text to clickable links
const convertUrlsToLinks = (text) => {
  if (!text) return text;

  // Regex to match URLs (http, https, www, etc.)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[^\s]+\.[a-z]{2,}[^\s]*)/gi;

  return text.replace(urlRegex, (url) => {
    // Add protocol if missing
    let href = url;
    if (url.startsWith('www.')) {
      href = 'http://' + url;
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      href = 'http://' + url;
    }

    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-[#C4009A] hover:text-[#7E006C] underline">${url}</a>`;
  });
};

const getUserInitials = (firstName = '', lastName = '') => {
  const first = firstName.trim()[0] || '';
  const last = lastName.trim()[0] || '';
  return `${first}${last}`.toUpperCase() || 'U';
};

const resolveAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http') || avatar.startsWith('data:')) {
    return avatar;
  }
  if (avatar.startsWith('/uploads/')) {
    return avatar;
  }
  return `/uploads/${avatar}`;
};

const mapUserToDisplay = (user = {}) => {
  if (!user) return null;
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const name = `${firstName} ${lastName}`.trim() || user.email || 'Unknown User';

  return {
    id: user.id,
    name,
    firstName,
    lastName,
    role: user.position?.name || user.role || 'Team Member',
    avatar: resolveAvatarUrl(user.avatar),
    initials: getUserInitials(firstName, lastName)
  };
};

const deriveAssignedEmployeesFromTasks = (tasks = []) => {
  const lookup = new Map();
  tasks.forEach((task = {}) => {
    const member = task.user || task.assignee;
    if (!member) return;
    const display = mapUserToDisplay(member);
    if (display?.id && !lookup.has(display.id)) {
      lookup.set(display.id, display);
    }
  });
  return Array.from(lookup.values());
};

const Projects = ({ userRole }) => {
  const [showViewProjectModal, setShowViewProjectModal] = useState(false);
  const [viewingProject, setViewingProject] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectDetails, setProjectDetails] = useState({});
  const itemsPerPage = 10;

  const THEME = {
    gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  };

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.getMine({ limit: 100 });

      if (!response.success) {
        throw new Error(response.message || 'Failed to load your tasks');
      }

      const normalizedTasks = (response.data?.tasks || []).map((task) => ({
        id: task.id,
        title: task.title || 'Untitled task',
        description: task.description || 'No description available yet.',
        status: normalizeStatus(task.status || 'pending'),
        priority: normalizePriority(task.priority || 'medium'),
        deadline: task.deadline || null,
        completedDate: task.completedDate || task.completedAt || null,
        user: task.user || null,
        project: task.project
          ? {
              id: task.project.id,
              title: task.project.title || 'Untitled project',
              status: normalizeStatus(task.project.status || 'active'),
              deadline: task.project.deadline || null
            }
          : null
      }));

      setTasks(normalizedTasks);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const fetchProjectDetails = useCallback(async (projectIds = []) => {
    if (!projectIds.length) {
      setProjectDetails({});
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.all(
        projectIds.map(async (projectId) => {
          try {
            const response = await projectsAPI.getById(projectId);
            if (!response.success) {
              throw new Error(response.message || 'Failed to fetch project');
            }

            const detail = response.data;
            const normalizedTasks = (detail.tasks || []).map((task) => ({
              id: task.id,
              title: task.title || 'Untitled task',
              description: task.description || 'No description available yet.',
              status: normalizeStatus(task.status || 'pending'),
              priority: normalizePriority(task.priority || 'medium'),
              deadline: task.deadline || null,
              completedDate: task.completedDate || task.completedAt || null,
              assignee: task.user ? mapUserToDisplay(task.user) : null
            }));

            const assignedEmployees = deriveAssignedEmployeesFromTasks(normalizedTasks);
            const summary = summarizeTasks(normalizedTasks);

            return [projectId, {
              id: detail.id,
              description: detail.description || 'No description available yet.',
              manager: detail.projectManager ? mapUserToDisplay(detail.projectManager) : null,
              tasks: normalizedTasks,
              assignedEmployees,
              summary,
              status: normalizeStatus(detail.status || 'active'),
              priority: normalizePriority(detail.priority || 'medium'),
              deadline: detail.deadline || null
            }];
          } catch (error) {
            return [projectId, null];
          }
        })
      );

      const detailsMap = results.reduce((acc, [projectId, detail]) => {
        if (projectId && detail) {
          acc[projectId] = detail;
        }
        return acc;
      }, {});

      setProjectDetails(detailsMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const projectIds = Array.from(
      new Set(
        tasks
          .map((task) => task.project?.id)
          .filter(Boolean)
      )
    );

    if (projectIds.length) {
      fetchProjectDetails(projectIds);
    } else {
      setProjectDetails({});
    }
  }, [tasks, fetchProjectDetails]);

  const projects = useMemo(() => {
    const grouped = new Map();

    tasks.forEach((task) => {
      const projectId = task.project?.id || 'unassigned';

      if (!grouped.has(projectId)) {
        grouped.set(projectId, {
          id: projectId,
          name: task.project?.title || 'Unassigned Tasks',
          description:
            task.project?.description || 'These tasks are not linked to a specific project yet.',
          priority: task.priority || 'medium',
          status: task.project?.status || 'active',
          deadline: task.project?.deadline || task.deadline || null,
          myTasks: []
        });
      }

      const projectEntry = grouped.get(projectId);
      projectEntry.myTasks.push(task);
      projectEntry.deadline = getEarliestDate(
        projectEntry.deadline,
        task.project?.deadline || task.deadline
      );
      projectEntry.priority = getHighestPriority(projectEntry.priority, task.priority);
    });

    return Array.from(grouped.values()).map((project) => {
      const detail = project.id !== 'unassigned' ? projectDetails[project.id] : null;
      const detailTasks = detail?.tasks || project.myTasks;
      const summary = detail?.summary || summarizeTasks(detailTasks);

      return {
        ...project,
        priority: detail?.priority || project.priority || 'medium',
        status: detail?.status || normalizeStatus(project.status || 'active'),
        description: detail?.description || project.description,
        deadline: detail?.deadline || project.deadline,
        manager: detail?.manager || null,
        assignedEmployees: detail?.assignedEmployees || deriveAssignedEmployeesFromTasks(detailTasks),
        tasks: detailTasks,
        myTasks: project.myTasks,
        summary,
        progress: computeProgress(summary)
      };
    });
  }, [tasks, projectDetails]);

  const totalPages = Math.max(1, Math.ceil(projects.length / itemsPerPage) || 1);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProjects = projects.slice(startIndex, startIndex + itemsPerPage);
  const showPagination = projects.length > itemsPerPage;

  useEffect(() => {
    if (projects.length === 0) {
      setCurrentPage(1);
      return;
    }

    const maxPage = Math.max(1, Math.ceil(projects.length / itemsPerPage));
    if (currentPage > maxPage) {
      setCurrentPage(maxPage);
    }
  }, [projects, currentPage, itemsPerPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleViewProject = (project) => {
    setViewingProject(project);
    setShowViewProjectModal(true);
  };

  useEffect(() => {
    if (!showViewProjectModal || !viewingProject) return;
    const updatedProject = projects.find((proj) => proj.id === viewingProject.id);
    if (updatedProject && updatedProject !== viewingProject) {
      setViewingProject(updatedProject);
    }
  }, [projects, showViewProjectModal, viewingProject]);

  return (
    <div className="space-y-6">
      {loading && <Loading size={80} bg="bg-black/20" />}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {loading ? (
            <span className="text-sm text-slate-500">Syncing your assigned projects…</span>
          ) : projects.length ? (
            <span className="text-sm text-slate-500">
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, projects.length)} of {projects.length} project{projects.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-sm text-slate-500">No assigned projects yet</span>
          )}
          {!loading && (
            <p className="text-xs text-slate-400">
              {tasks.length} task{tasks.length === 1 ? '' : 's'} assigned to you
            </p>
          )}
        </div>
      
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm"
            >
              <div className="animate-pulse space-y-4">
                <div className="flex justify-between items-center">
                  <div className="w-10 h-10 rounded-lg bg-slate-100" />
                  <div className="w-20 h-6 bg-slate-100 rounded" />
                </div>
                <div className="h-5 bg-slate-100 rounded" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="space-y-2">
                  <div className="h-2 bg-slate-100 rounded" />
                  <div className="h-2 bg-slate-100 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : paginatedProjects.length ? (
          paginatedProjects.map((project) => (
            <div
              key={project.id}
              className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
              onClick={() => handleViewProject(project)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-fuchsia-50 text-[#C4009A] flex items-center justify-center">
                  <FolderKanban size={20} />
                </div>
                <Badge color={getPriorityBadgeColor(project.priority)}>
                  {formatPriorityLabel(project.priority)}
                </Badge>
              </div>
              <h3 className="font-bold text-slate-800 text-lg group-hover:text-[#C4009A] transition-colors">
                {project.name}
              </h3>
              <p className="text-slate-500 text-sm mt-2 mb-6 line-clamp-2">{project.description}</p>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${THEME.gradient}`} style={{ width: `${project.progress}%` }}></div>
                </div>
              </div>

              

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <div className="flex -space-x-2">
                  {project.assignedEmployees?.length ? (
                    <>
                      {project.assignedEmployees.slice(0, 3).map((employee) => (
                        <Avatar
                          key={employee.id}
                          size="sm"
                          fallback={employee.initials}
                          src={employee.avatar}
                        />
                      ))}
                      {project.assignedEmployees.length > 3 && (
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-xs text-slate-500">
                          +{project.assignedEmployees.length - 3}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Only you assigned</span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {project.deadline ? `Due ${formatShortDate(project.deadline)}` : 'Deadline not set'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 border border-dashed border-slate-200 rounded-xl">
            <p className="font-medium text-slate-700">No tasks assigned yet</p>
            <p className="text-sm text-slate-500 mt-1">You'll see your project assignments here once they are created.</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, projects.length)} of {projects.length} projects
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

      {/* View Project Modal */}
      {showViewProjectModal && viewingProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Project Details</h2>
              <button 
                onClick={() => setShowViewProjectModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Project Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Project Information</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-slate-500">Project Name</p>
                      <p className="font-medium text-slate-800">{viewingProject.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Description</p>
                      <div
                        className="text-slate-700"
                        dangerouslySetInnerHTML={{ __html: convertUrlsToLinks(viewingProject.description) }}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Priority</p>
                      <Badge color={getPriorityBadgeColor(viewingProject.priority)}>
                        {formatPriorityLabel(viewingProject.priority)}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Deadline</p>
                      <p className="font-medium text-slate-800">{formatLongDate(viewingProject.deadline)}</p>
                    </div>
                    {viewingProject.manager && (
                      <div>
                        <p className="text-sm text-slate-500">Project Manager</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Avatar size="sm" fallback={viewingProject.manager.initials} src={viewingProject.manager.avatar} />
                          <div>
                            <p className="font-medium text-slate-800">{viewingProject.manager.name}</p>
                            <p className="text-xs text-slate-500">{viewingProject.manager.role}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-slate-500">Progress</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${THEME.gradient}`} 
                            style={{ width: `${viewingProject.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-slate-700">{viewingProject.progress}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Total Tasks</p>
                      <p className="text-xl font-semibold text-slate-800">{viewingProject.summary.total}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Completed</p>
                      <p className="text-xl font-semibold text-emerald-600">{viewingProject.summary.completed}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">In Progress</p>
                      <p className="text-xl font-semibold text-amber-600">{viewingProject.summary.inProgress}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Pending</p>
                      <p className="text-xl font-semibold text-slate-700">{viewingProject.summary.pending}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-600 mb-2">Team Members</p>
                    {viewingProject.assignedEmployees?.length ? (
                      <div className="flex flex-wrap gap-3">
                        {viewingProject.assignedEmployees.map((employee) => (
                          <div key={employee.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                            <Avatar size="sm" fallback={employee.initials} src={employee.avatar} />
                            <div>
                              <p className="font-medium text-slate-800">{employee.name}</p>
                              <p className="text-xs text-slate-500">{employee.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Team information will appear once available.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tasks Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Tasks</h3>
                <div className="space-y-3">
                  {viewingProject.tasks.map(task => (
                    <div key={task.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-800">{task.title}</h4>
                            <Badge color={getTaskStatusBadgeColor(task.status)}>
                              {formatStatusLabel(task.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <span>Assigned to: {task.assignee?.name || 'Unassigned'}</span>
                            <span>Deadline: {task.deadline ? formatShortDate(task.deadline) : 'Not set'}</span>
                            {task.completedDate && (
                              <span className="text-green-600 font-medium">
                                Completed: {formatShortDate(task.completedDate)}
                              </span>
                            )}
                          </div>
                        </div>
                        {task.status === 'completed' && (
                          <div className="ml-4">
                            <CheckCircle size={20} className="text-green-600" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={20} className="text-green-600" />
                    <span className="font-medium text-green-800">Completed Tasks</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {viewingProject.summary.completed}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={20} className="text-amber-600" />
                    <span className="font-medium text-amber-800">In Progress</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">
                    {viewingProject.summary.inProgress}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={20} className="text-slate-600" />
                    <span className="font-medium text-slate-800">Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {viewingProject.summary.pending}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <Button onClick={() => setShowViewProjectModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
