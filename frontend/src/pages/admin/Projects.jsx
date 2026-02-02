import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { projectsAPI } from '../../api/projects';
import { tasksAPI } from '../../api/tasks';
import { usersAPI } from '../../api/users';
import { notificationsAPI } from '../../api/notifications';
import {
  FolderKanban, Plus, X, Users, Calendar, Target, CheckCircle,
  Clock, AlertCircle, UserPlus, Trash2, ChevronDown, Eye, Edit, Search, Loader2
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import SearchableDropdown from '../../components/SearchableDropdown';
import DatePicker from '../../components/DatePicker';
import Loading from '../../components/Loading';
const ITEMS_PER_PAGE = 10;
const MANAGER_ROLES = ['admin', 'pm', 'lead', 'supervisor'];

const INITIAL_NEW_PROJECT = {
  title: '',
  description: '',
  priority: 'medium',
  deadline: '',
  projectManagerId: '',
  assignedEmployees: [],
  tasks: []
};

const getUserInitials = (firstName = '', lastName = '') => {
  const first = firstName.trim()[0] || '';
  const last = lastName.trim()[0] || '';
  return `${first}${last}`.toUpperCase() || 'U';
};

const mapUserToOption = (user = {}) => {
  const firstName = user.firstName || '';
  const lastName = user.lastName || '';
  const name = `${firstName} ${lastName}`.trim() || user.email || 'Unknown User';
  // Handle avatar - ensure it's a valid path or null
  let avatar = null;
  if (user.avatar) {
    // If avatar is already a full URL, use it as-is
    if (user.avatar.startsWith('http') || user.avatar.startsWith('data:')) {
      avatar = user.avatar;
    } else if (user.avatar.startsWith('/uploads/')) {
      // If it's a path starting with /uploads/, keep it as-is
      avatar = user.avatar;
    } else {
      // If it's just a filename, prepend /uploads/
      avatar = `/uploads/${user.avatar}`;
    }
  }
  return {
    id: user.id,
    name,
    firstName,
    lastName,
    role: user.role,
    position: user.position?.name || user.role || 'Team Member',
    email: user.email || '',
    avatar,
    initials: getUserInitials(firstName, lastName)
  };
};

const getAvatarFallback = (user = {}) => {
  if (user.initials) return user.initials;
  const fromNames = getUserInitials(user.firstName, user.lastName);
  if (fromNames) return fromNames;
  const name = (user.name || '').trim();
  if (!name) return 'U';
  const [first = '', ...rest] = name.split(/\s+/);
  return getUserInitials(first, rest.join(' '));
};

const deriveAssignedEmployeesFromTasks = (tasks = []) => {
  const unique = new Map();
  tasks.forEach((task) => {
    if (task.user) {
      const option = mapUserToOption(task.user);
      if (option.id) {
        unique.set(option.id, option);
      }
    }
  });
  return Array.from(unique.values());
};

const uniqueById = (items = []) => {
  const lookup = new Map();
  items.forEach((item) => {
    if (item?.id) {
      lookup.set(item.id, item);
    }
  });
  return Array.from(lookup.values());
};

const summarizeTasks = (tasks = []) => {
  const summary = {
    total: tasks.length,
    completed: 0,
    inProgress: 0,
    pending: 0
  };

  tasks.forEach((task) => {
    const status = (task.status || '').toLowerCase();
    if (status === 'completed') {
      summary.completed += 1;
    } else if (status === 'in_progress' || status === 'in-progress') {
      summary.inProgress += 1;
    } else {
      summary.pending += 1;
    }
  });

  summary.progress = statusToProgress({
    completed: summary.completed,
    inProgress: summary.inProgress,
    totalTasks: summary.total
  });

  return summary;
};

const formatDateForInput = (date) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const mapTaskResponseToState = (task) => ({
  id: task.id,
  title: task.title || '',
  description: task.description || '',
  assignedTo: task.user?.id || '',
  priority: task.priority || 'medium',
  status: task.status || 'pending',
  deadline: formatDateForInput(task.deadline)
});

const mapTaskResponseToView = (task) => ({
  id: task.id,
  title: task.title || '',
  description: task.description || '',
  assignedTo: task.user?.id || '',
  priority: task.priority || 'medium',
  status: task.status || 'pending',
  deadline: task.deadline || null,
  completedDate: task.completedDate || task.completedAt || null
});

const statusToProgress = ({ completed, inProgress, totalTasks }) => {
  if (totalTasks === 0) return 0;
  // Count in-progress tasks as 50% complete, completed tasks as 100% complete
  const weightedProgress = (completed * 100 + inProgress * 50) / totalTasks;
  return Math.min(100, Math.round(weightedProgress));
};

const createEmptyTaskRow = () => ({
  id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: '',
  description: '',
  assignedTo: '',
  priority: 'medium',
  status: 'pending',
  deadline: ''
});

const unassignTasksForEmployee = (tasks = [], employeeId) =>
  tasks.map((task) =>
    task.assignedTo === employeeId ? { ...task, assignedTo: '' } : task
  );

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

const hasTaskChanged = (original, updated) => {
  if (!original || !updated) return false;
  return (
    original.title !== updated.title ||
    (original.description || '') !== (updated.description || '') ||
    (original.priority || 'medium') !== (updated.priority || 'medium') ||
    (original.status || 'pending') !== (updated.status || 'pending') ||
    (original.deadline || '') !== (updated.deadline || '') ||
    (original.assignedTo || '') !== (updated.assignedTo || '')
  );
};

const Projects = ({ userRole }) => {
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showViewProjectModal, setShowViewProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [editEmployeeSearchTerm, setEditEmployeeSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [projects, setProjects] = useState([]);
  const [projectPagination, setProjectPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [loadingCount, setLoadingCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [savingProject, setSavingProject] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);
  const [projectDetailLoading, setProjectDetailLoading] = useState(false);
  const [editingProjectOriginalTasks, setEditingProjectOriginalTasks] = useState([]);
  const [newProject, setNewProject] = useState(INITIAL_NEW_PROJECT);
  const THEME = {
    gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  };

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);


  const fetchProjects = async (page = currentPage) => {
    startLoading();
    try {
      const response = await projectsAPI.getAll({ page, limit: 10 });

      if (response.success) {
        const fetchedProjects = response.data?.projects || [];
        const normalizedProjects = fetchedProjects.map((project) => {
          const taskEmployees = deriveAssignedEmployeesFromTasks(project.tasks);

          const taskSummary = summarizeTasks(project.tasks || []);

          return {
            ...project,
            tasks: project.tasks || [],
            taskSummary,
            progress: taskSummary.progress,
            assignedEmployees: taskEmployees
          };
        });

        setProjects(normalizedProjects);
        setProjectPagination(response.data?.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      } else {
        toast.error(response.message || 'Failed to fetch projects');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch projects');
    } finally {
      stopLoading();
    }
  };

  const fetchUsers = async () => {
    try {
      startLoading();
      const response = await usersAPI.getAll({ limit: 100 });

      if (response.success) {
        const rawUsers = response.data.users || [];
        // Filter to only active users
        const activeUsers = rawUsers.filter(user => user.status === 'active');
        setUsers(activeUsers.map(mapUserToOption));
      } else {
        toast.error(response.message || 'Failed to fetch users');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch users');
    } finally {
      stopLoading();
    }
  };

  useEffect(() => {
    fetchProjects(currentPage);
  }, [currentPage]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const availableEmployees = useMemo(() => users, [users]);
  const managerOptions = useMemo(
    () => {
      const filtered = users.filter((user) => {
        const userRole = user.role || '';
        // Check if user has a management role
        const isManager = MANAGER_ROLES.includes(userRole);
        return isManager;
      });
      
      // If no managers found with specific roles, show all users as fallback
      return filtered.length > 0 ? filtered : users;
    },
    [users]
  );
  const managerOptionsForNewProject = useMemo(() => {
    if (!newProject.projectManagerId) return managerOptions;
    if (managerOptions.some((option) => option.id === newProject.projectManagerId)) {
      return managerOptions;
    }

    const fallback =
      users.find((user) => user.id === newProject.projectManagerId) ||
      newProject.assignedEmployees.find((employee) => employee.id === newProject.projectManagerId) ||
      null;

    return fallback ? [...managerOptions, fallback] : managerOptions;
  }, [managerOptions, newProject.projectManagerId, newProject.assignedEmployees, users]);

  const managerOptionsForEditProject = useMemo(() => {
    if (!editingProject?.projectManagerId) return managerOptions;
    if (managerOptions.some((option) => option.id === editingProject.projectManagerId)) {
      return managerOptions;
    }

    const fallback =
      users.find((user) => user.id === editingProject.projectManagerId) ||
      editingProject.assignedEmployees?.find((employee) => employee.id === editingProject.projectManagerId) ||
      null;

    return fallback ? [...managerOptions, fallback] : managerOptions;
  }, [managerOptions, editingProject?.projectManagerId, editingProject?.assignedEmployees, users]);

  const fetchProjectById = async (projectId) => {
    const response = await projectsAPI.getById(projectId);

    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch project');
    }

    return response.data;
  };

  const normalizeAssignedEmployees = (project) =>
    uniqueById([
      ...(project.projectManager ? [mapUserToOption(project.projectManager)] : []),
      ...deriveAssignedEmployeesFromTasks(project.tasks)
    ]);

  const handleAddEmployeeToNewProject = (employee) => {
    setNewProject((prev) => {
      if (prev.assignedEmployees.some((e) => e.id === employee.id)) {
        return prev;
      }

      return {
        ...prev,
        assignedEmployees: [...prev.assignedEmployees, employee]
      };
    });
  };

  const handleRemoveEmployeeFromNewProject = (employeeId) => {
    setNewProject((prev) => ({
      ...prev,
      assignedEmployees: prev.assignedEmployees.filter((e) => e.id !== employeeId),
      tasks: unassignTasksForEmployee(prev.tasks, employeeId)
    }));
  };

  const handleAddTaskToNewProject = () => {
    setNewProject((prev) => ({
      ...prev,
      tasks: [...prev.tasks, createEmptyTaskRow()]
    }));
  };

  const handleUpdateNewProjectTask = (taskId, field, value) => {
    setNewProject((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId ? { ...task, [field]: value } : task
      )
    }));
  };

  const handleRemoveNewProjectTask = (taskId) => {
    setNewProject((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== taskId)
    }));
  };

  const handleNewProjectManagerChange = (managerId) => {
    setNewProject((prev) => {
      const previousManagerId = prev.projectManagerId;
      let updatedTasks = prev.tasks;
      let updatedAssignedEmployees = prev.assignedEmployees.filter((emp) => emp.id !== previousManagerId);

      if (previousManagerId && previousManagerId !== managerId) {
        updatedTasks = unassignTasksForEmployee(updatedTasks, previousManagerId);
      }

      if (!managerId) {
        return {
          ...prev,
          projectManagerId: '',
          assignedEmployees: updatedAssignedEmployees,
          tasks: updatedTasks
        };
      }

      const selectedManager =
        users.find(
          (user) =>
            user.id === managerId &&
            MANAGER_ROLES.includes((user.role || '').toLowerCase())
        ) ||
        prev.assignedEmployees.find((employee) => employee.id === managerId);

      if (!selectedManager) {
        return {
          ...prev,
          projectManagerId: '',
          assignedEmployees: updatedAssignedEmployees,
          tasks: updatedTasks
        };
      }

      const nextAssigned = uniqueById([...updatedAssignedEmployees, selectedManager]);
      return {
        ...prev,
        projectManagerId: managerId,
        assignedEmployees: nextAssigned,
        tasks: updatedTasks
      };
    });
  };

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) {
      toast.error('Project name is required');
      return;
    }

    const taskMissingAssignee = newProject.tasks.find(
      (task) => task.title.trim() && !task.assignedTo
    );

    if (taskMissingAssignee) {
      toast.error('Assign a team member to each task with a title');
      return;
    }

    setSavingProject(true);
    startLoading();

    try {
      const payload = {
        title: newProject.title.trim(),
        description: newProject.description?.trim() || undefined,
        priority: newProject.priority || undefined,
        deadline: newProject.deadline || undefined,
        projectManagerId: newProject.projectManagerId || undefined
      };

      const projectResponse = await projectsAPI.create(payload);

      if (!projectResponse.success) {
        throw new Error(projectResponse.message || 'Failed to create project');
      }

      const createdProject = projectResponse.data;
      const tasksToCreate = newProject.tasks.filter(
        (task) => task.title.trim() && task.assignedTo
      );

      if (tasksToCreate.length) {
        await Promise.all(
          tasksToCreate.map((task) =>
            tasksAPI.create({
              projectId: createdProject.id,
              userId: task.assignedTo,
              title: task.title.trim(),
              description: task.description?.trim() || undefined,
              deadline: task.deadline || undefined,
              priority: task.priority || undefined
            })
          )
        );

        // Create notifications for each task assignment
        await Promise.all(
          tasksToCreate.map((task) =>
            notificationsAPI.create({
              title: 'Task Assigned',
              message: `You have been assigned to the task "${task.title}" in project "${newProject.title}"`,
              type: 'info',
              userId: task.assignedTo
            })
          )
        );
      }

      // Create notifications for assigned employees (excluding project manager)
      const assignedUserIds = [...new Set(tasksToCreate.map(t => t.assignedTo))];
      if (newProject.projectManagerId) {
        assignedUserIds.push(newProject.projectManagerId);
      }

      // Create notifications for each assigned user
      await Promise.all(
        assignedUserIds.map(userId =>
          notificationsAPI.create({
            title: 'Added to Project',
            message: `You have been added to the project "${newProject.title}"`,
            type: 'info',
            userId
          })
        )
      );

      toast.success('Project created successfully');
      setShowNewProjectModal(false);
      setEmployeeSearchTerm('');
      setNewProject(INITIAL_NEW_PROJECT);
      setCurrentPage(1);
      fetchProjects(1);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to create project');
    } finally {
      setSavingProject(false);
      stopLoading();
    }
  };

  const handleAddEmployeeToEditingProject = (employee) => {
    setEditingProject((prev) => {
      if (!prev) return prev;
      if (prev.assignedEmployees.some((e) => e.id === employee.id)) {
        return prev;
      }

      return {
        ...prev,
        assignedEmployees: [...prev.assignedEmployees, employee]
      };
    });
  };

  const handleRemoveEmployeeFromEditingProject = (employeeId) => {
    setEditingProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        assignedEmployees: prev.assignedEmployees.filter((e) => e.id !== employeeId),
        tasks: unassignTasksForEmployee(prev.tasks, employeeId)
      };
    });
  };

  const handleAddTaskToEditingProject = () => {
    setEditingProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: [...prev.tasks, createEmptyTaskRow()]
      };
    });
  };

  const handleUpdateEditingProjectTask = (taskId, field, value) => {
    setEditingProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? { ...task, [field]: value } : task
        )
      };
    });
  };

  const handleRemoveEditingProjectTask = (taskId) => {
    setEditingProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter((task) => task.id !== taskId)
      };
    });
  };

  const handleEditingProjectManagerChange = (managerId) => {
    setEditingProject((prev) => {
      if (!prev) return prev;
      const previousManagerId = prev.projectManagerId;
      let updatedTasks = prev.tasks;
      let updatedAssignedEmployees = prev.assignedEmployees.filter((emp) => emp.id !== previousManagerId);

      if (previousManagerId && previousManagerId !== managerId) {
        updatedTasks = unassignTasksForEmployee(updatedTasks, previousManagerId);
      }

      if (!managerId) {
        return {
          ...prev,
          projectManagerId: '',
          assignedEmployees: updatedAssignedEmployees,
          tasks: updatedTasks
        };
      }

      const selectedManager = users.find((user) => user.id === managerId);
      if (!selectedManager) {
        return {
          ...prev,
          projectManagerId: '',
          assignedEmployees: updatedAssignedEmployees,
          tasks: updatedTasks
        };
      }

      const nextAssigned = uniqueById([...updatedAssignedEmployees, selectedManager]);
      return {
        ...prev,
        projectManagerId: managerId,
        assignedEmployees: nextAssigned,
        tasks: updatedTasks
      };
    });
  };

  const handleEditProject = async (projectId) => {
    try {
      setProjectDetailLoading(true);
      startLoading();
      const project = await fetchProjectById(projectId);
      const assignedEmployees = normalizeAssignedEmployees(project);
      const tasksForState = (project.tasks || []).map(mapTaskResponseToState);

      setEditingProject({
        id: project.id,
        title: project.title || '',
        description: project.description || '',
        priority: project.priority || 'medium',
        deadline: formatDateForInput(project.deadline),
        status: project.status || 'pending',
        projectManagerId: project.projectManager?.id || '',
        assignedEmployees,
        tasks: tasksForState
      });
      setEditingProjectOriginalTasks(tasksForState.map((task) => ({ ...task })));
      setEditEmployeeSearchTerm('');
      setShowEditProjectModal(true);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load project');
    } finally {
      setProjectDetailLoading(false);
      stopLoading();
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;

    if (!editingProject.title.trim()) {
      toast.error('Project name is required');
      return;
    }

    const taskMissingAssignee = editingProject.tasks.find(
      (task) => task.title.trim() && !task.assignedTo
    );

    if (taskMissingAssignee) {
      toast.error('Assign a team member to each task with a title');
      return;
    }

    setUpdatingProject(true);
    startLoading();

    try {
      const payload = {
        title: editingProject.title.trim(),
        description: editingProject.description?.trim() || undefined,
        priority: editingProject.priority || undefined,
        deadline: editingProject.deadline || undefined,
        projectManagerId: editingProject.projectManagerId || undefined
      };

      await projectsAPI.update(editingProject.id, payload);

      const originalTaskMap = new Map(
        editingProjectOriginalTasks.map((task) => [task.id, task])
      );

      const currentTaskIds = new Set(editingProject.tasks.map((task) => task.id));
      const tasksToDelete = editingProjectOriginalTasks.filter(
        (task) => !currentTaskIds.has(task.id)
      );

      const createPromises = editingProject.tasks
        .filter((task) => task.id.toString().startsWith('temp'))
        .filter((task) => task.title.trim() && task.assignedTo)
        .map((task) =>
          tasksAPI.create({
            projectId: editingProject.id,
            userId: task.assignedTo,
            title: task.title.trim(),
            description: task.description || '',
            deadline: task.deadline || undefined,
            priority: task.priority || undefined,
            status: task.status || undefined
          })
        );

      const newTaskNotifications = editingProject.tasks
        .filter((task) => task.id.toString().startsWith('temp'))
        .filter((task) => task.title.trim() && task.assignedTo)
        .map((task) =>
          notificationsAPI.create({
            title: 'Task Assigned',
            message: `You have been assigned to the task "${task.title}" in project "${editingProject.title}"`,
            type: 'info',
            userId: task.assignedTo
          })
        );

      const updatePromises = editingProject.tasks
        .filter((task) => !task.id.toString().startsWith('temp'))
        .filter((task) => hasTaskChanged(originalTaskMap.get(task.id), task))
        .map((task) =>
          tasksAPI.update(task.id, {
            userId: task.assignedTo,
            title: task.title.trim(),
            description: task.description || '',
            deadline: task.deadline || undefined,
            priority: task.priority || undefined,
            status: task.status || undefined
          })
        );

      const taskUpdateNotifications = editingProject.tasks
        .filter((task) => !task.id.toString().startsWith('temp'))
        .filter((task) => hasTaskChanged(originalTaskMap.get(task.id), task))
        .filter((task) => {
          const originalTask = originalTaskMap.get(task.id);
          return originalTask && originalTask.assignedTo !== task.assignedTo;
        })
        .map((task) =>
          notificationsAPI.create({
            title: 'Task Reassigned',
            message: `You have been assigned to the task "${task.title}" in project "${editingProject.title}"`,
            type: 'info',
            userId: task.assignedTo
          })
        );

      const deletePromises = tasksToDelete.map((task) =>
        tasksAPI.delete(task.id)
      );

      await Promise.all([...createPromises, ...updatePromises, ...deletePromises, ...newTaskNotifications, ...taskUpdateNotifications]);

      toast.success('Project updated successfully');
      setShowEditProjectModal(false);
      setEditingProject(null);
      setEditingProjectOriginalTasks([]);
      setEditEmployeeSearchTerm('');
      fetchProjects(currentPage);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update project');
    } finally {
      setUpdatingProject(false);
      stopLoading();
    }
  };

  const handleViewProject = async (projectId) => {
    try {
      setProjectDetailLoading(true);
      startLoading();
      const project = await fetchProjectById(projectId);
      const assignedEmployees = normalizeAssignedEmployees(project);
      const tasksRaw = project.tasks || [];
      const viewTasks = tasksRaw.map(mapTaskResponseToView);
      const taskSummary = summarizeTasks(tasksRaw);

      // Fetch full user details for all team members to get avatar data
      const viewerAssignedEmployees = deriveAssignedEmployeesFromTasks(project.tasks);
      const viewerManager = project.projectManager ? mapUserToOption(project.projectManager) : null;
      
      // Get all unique user IDs from team members
      const userIds = new Set();
      viewerAssignedEmployees.forEach(emp => userIds.add(emp.id));
      if (viewerManager) userIds.add(viewerManager.id);
      
      // Fetch full user details for all team members
      let viewerTeam = [];
      if (userIds.size > 0) {
        try {
          const usersResponse = await usersAPI.getAll({ limit: 100 });
          if (usersResponse.success) {
            const allUsers = usersResponse.data.users || [];
            // Filter out suspended users
            const activeUsers = allUsers.filter(user => user.status !== 'suspended');
            const usersMap = new Map(activeUsers.map(u => [u.id, u]));
            
            // Create viewer team with full user details including avatars
            viewerTeam = viewerAssignedEmployees.map(emp => {
              const fullUser = usersMap.get(emp.id);
              return fullUser ? mapUserToOption(fullUser) : emp;
            });
            
            // Add manager if exists and not already in team
            if (viewerManager && !viewerTeam.find(t => t.id === viewerManager.id)) {
              const managerUser = usersMap.get(viewerManager.id);
              viewerTeam.push(managerUser ? mapUserToOption(managerUser) : viewerManager);
            }
          }
        } catch (error) {
          // Fallback to original data if fetch fails
          viewerTeam = viewerAssignedEmployees.length
            ? viewerAssignedEmployees
            : viewerManager
              ? [viewerManager]
              : [];
        }
      } else {
        viewerTeam = viewerAssignedEmployees.length
          ? viewerAssignedEmployees
          : viewerManager
            ? [viewerManager]
            : [];
      }

      setViewingProject({
        id: project.id,
        title: project.title || '',
        name: project.title || project.name || '',
        description: project.description || '',
        priority: project.priority || 'medium',
        status: project.status || 'pending',
        deadline: project.deadline || null,
        taskSummary,
        progress: taskSummary.progress,
        projectManagerId: project.projectManager?.id || '',
        projectManager: project.projectManager || null,
        assignedEmployees: viewerTeam,
        tasks: viewTasks
      });
      setShowViewProjectModal(true);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to load project');
    } finally {
      setProjectDetailLoading(false);
      stopLoading();
    }
  };

  const handleCloseEditModal = () => {
    setShowEditProjectModal(false);
    setEditingProject(null);
    setEditingProjectOriginalTasks([]);
    setEditEmployeeSearchTerm('');
  };

  const handleCloseViewModal = () => {
    setShowViewProjectModal(false);
    setViewingProject(null);
  };

  const handlePageChange = (page) => {
    if (page < 1 || (projectPagination.pages && page > projectPagination.pages)) {
      return;
    }
    setCurrentPage(page);
  };

  const filterEmployees = (employees, searchTerm, assignedEmployees = []) => {
    return employees.filter(emp => {
      const isAssigned = assignedEmployees.find(ae => ae.id === emp.id);
      if (isAssigned) return false;

      if (!searchTerm) return true;

      const searchLower = searchTerm.toLowerCase();
      return (
        emp.name.toLowerCase().includes(searchLower) ||
        emp.id.toString().includes(searchLower) ||
        emp.role.toLowerCase().includes(searchLower)
      );
    });
  };

  const totalPages = projectPagination.pages || Math.ceil((projectPagination.total || projects.length) / (projectPagination.limit || ITEMS_PER_PAGE)) || 1;
  const currentPaginationPage = projectPagination.page || currentPage;
  const pageSize = projectPagination.limit || ITEMS_PER_PAGE;
  const startIndex = (currentPaginationPage - 1) * pageSize;
  const totalCount = projectPagination.total || projects.length;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const displayedProjects = projects;
  const showingFrom = displayedProjects.length ? startIndex + 1 : 0;
  const showingTo = displayedProjects.length ? endIndex : 0;
  const viewTeamMembers = viewingProject?.assignedEmployees || [];
  const viewTasks = viewingProject?.tasks || [];
  const viewTaskSummary = summarizeTasks(viewTasks);

  return (
    <div className="space-y-6">
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <span className="text-sm text-slate-500">
            Showing {showingFrom} to {showingTo} of {totalCount} Projects
          </span>
        </div>
        {userRole !== 'employee' && (
          <Button icon={Plus} onClick={() => setShowNewProjectModal(true)}>New Project</Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {displayedProjects.map((project) => {
          const projectTitle = project.title || project.name || 'Untitled Project';
          const deadline = project.deadline ? new Date(project.deadline) : null;
          const assignedEmployees = Array.isArray(project.assignedEmployees)
            ? project.assignedEmployees
            : [];
          const displayEmployees = assignedEmployees.slice(0, 5);
          const progressValue = Math.round(project.progress || 0);

          return (
            <div
              key={project.id}
              className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-lg bg-fuchsia-50 text-[#C4009A] flex items-center justify-center">
                  <FolderKanban size={20} />
                </div>
                <Badge color={project.priority === 'high' ? 'brand' : 'default'}>
                  {project.priority === 'high' ? 'High Priority' : 'Ongoing'}
                </Badge>
              </div>
              <h3 className="font-bold text-slate-800 text-lg group-hover:text-[#7E006C] transition-colors">
                {projectTitle}
              </h3>
              <p className="text-slate-500 text-sm mt-2 mb-6 line-clamp-2">{project.description}</p>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <span>Progress</span>
                  <span>{progressValue}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${THEME.gradient}`} style={{ width: `${progressValue}%` }}></div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {displayEmployees.map((employee) => (
                    <Avatar
                      key={employee.id}
                      size="sm"
                      src={employee.avatar}
                      fallback={`${employee.firstName?.[0]?.toUpperCase() || ''}${employee.lastName?.[0]?.toUpperCase() || ''}`}
                      title={employee.name}
                    />
                  ))}
                  {assignedEmployees.length > 5 && (
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-xs text-slate-500">
                      +{assignedEmployees.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {deadline
                    ? `Due ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'No deadline'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Eye}
                  onClick={() => handleViewProject(project.id)}
                  className="flex-1"
                >
                  View
                </Button>
                {userRole !== 'employee' && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Edit}
                    onClick={() => handleEditProject(project.id)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Showing {showingFrom} to {showingTo} of {totalCount} projects
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPaginationPage - 1)}
              disabled={currentPaginationPage === 1}
            >
              Previous
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPaginationPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page)}
                className={currentPaginationPage === page ? "bg-[#C4009A] hover:bg-[#C4009A]/90 text-white" : ""}
              >
                {page}
              </Button>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPaginationPage + 1)}
              disabled={currentPaginationPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Create New Project</h2>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Basic Project Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
                  <input
                    type="text"
                    value={newProject.title}
                    onChange={(e) => setNewProject(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter project name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                  <SearchableDropdown
                    options={[
                      { id: 'low', name: 'Low' },
                      { id: 'medium', name: 'Medium' },
                      { id: 'high', name: 'High' }
                    ]}
                    value={newProject.priority}
                    onChange={(value) => setNewProject(prev => ({ ...prev, priority: value }))}
                    placeholder="Select Priority"
                    showAllOption={false}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Manager</label>
                  <SearchableDropdown
                    options={managerOptionsForNewProject}
                    value={newProject.projectManagerId || 'all'}
                    onChange={(value) => handleNewProjectManagerChange(value === 'all' ? '' : value)}
                    placeholder="Select project manager"
                    allOptionLabel="Select project manager"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  rows={3}
                  placeholder="Describe the project goals and objectives"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Deadline</label>
                <DatePicker
                  selectedDate={newProject.deadline}
                  onDateSelect={(date) => setNewProject(prev => ({ ...prev, deadline: date }))}
                  placeholder="Select project deadline"
                />
              </div>

              {/* Employee Assignment */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-slate-700">Assign Employees</label>
                  <Badge color="brand">{newProject.assignedEmployees.length} assigned</Badge>
                </div>

                {/* Available Employees */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Available Employees</p>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={employeeSearchTerm}
                      onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                      placeholder="Search by name, ID, or role..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filterEmployees(availableEmployees, employeeSearchTerm, newProject.assignedEmployees).map(employee => (
                      <div key={employee.id} className="flex items-center justify-between p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Avatar
                            size="sm"
                            src={employee.avatar}
                            fallback={`${employee.firstName?.[0]?.toUpperCase() || ''}${employee.lastName?.[0]?.toUpperCase() || ''}`}
                            title={employee.name}
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-700">{employee.name}</p>
                            <p className="text-xs text-slate-500">{employee.role}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddEmployeeToNewProject(employee)}
                          className="p-1 hover:bg-[#C4009A]/10 rounded text-[#C4009A]"
                        >
                          <UserPlus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assigned Employees */}
                {newProject.assignedEmployees.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Assigned Employees</p>
                    <div className="space-y-2">
                      {newProject.assignedEmployees.map((employee) => (
                        <div
                          key={employee.id}
                          className="flex items-center justify-between p-2 bg-[#C4009A]/5 border border-[#C4009A]/20 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar
                              size="sm"
                              src={employee.avatar}
                              fallback={`${employee.firstName?.[0]?.toUpperCase() || ''}${employee.lastName?.[0]?.toUpperCase() || ''}`}
                              title={employee.name}
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-700">{employee.name}</p>
                              <p className="text-xs text-slate-500">{employee.role}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveEmployeeFromNewProject(employee.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Task Division */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-slate-700">Project Tasks</label>
                  <Button variant="outline" size="sm" onClick={handleAddTaskToNewProject}>
                    <Plus size={16} /> Add Task
                  </Button>
                </div>

                <div className="space-y-3">
                  {newProject.tasks.map((task, index) => (
                    <div key={task.id} className="border border-slate-200 rounded-lg p-3 sm:p-4">
                      <div className="space-y-3">
                        {/* Title Field - Full Width on Mobile, 2 cols on Desktop */}
                        <div className="lg:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Task Title</label>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => handleUpdateNewProjectTask(task.id, 'title', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] text-sm"
                            placeholder="Task title"
                          />
                        </div>

                        {/* Priority, Assign, Deadline Row - Stacked on Mobile, Side by side on Desktop */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                            <SearchableDropdown
                              options={[
                                { id: 'low', name: 'Low' },
                                { id: 'medium', name: 'Medium' },
                                { id: 'high', name: 'High' }
                              ]}
                              value={task.priority}
                              onChange={(value) => handleUpdateNewProjectTask(task.id, 'priority', value)}
                              placeholder="Select Priority"
                              showAllOption={false}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Assign To</label>
                            <SearchableDropdown
                              options={newProject.assignedEmployees}
                              value={task.assignedTo || 'all'}
                              onChange={(value) => handleUpdateNewProjectTask(task.id, 'assignedTo', value === 'all' ? '' : value)}
                              placeholder="Unassigned"
                              allOptionLabel="Unassigned"
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Deadline</label>
                              <DatePicker
                                selectedDate={task.deadline}
                                onDateSelect={(date) => handleUpdateNewProjectTask(task.id, 'deadline', date)}
                                placeholder="Select deadline"
                              />
                            </div>
                            <button
                              onClick={() => handleRemoveNewProjectTask(task.id)}
                              className="p-2 hover:bg-red-100 rounded text-red-600"
                              style={{ marginTop: 'auto' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                        <textarea
                          value={task.description}
                          onChange={(e) => handleUpdateNewProjectTask(task.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] text-sm"
                          rows={2}
                          placeholder="Task description (optional)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowNewProjectModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={savingProject}
                className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
              >
                {savingProject ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditProjectModal && editingProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Edit Project</h2>
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Basic Project Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
                  <input
                    type="text"
                    value={editingProject.title}
                    onChange={(e) => setEditingProject(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter project name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Priority</label>
                  <SearchableDropdown
                    options={[
                      { id: 'low', name: 'Low' },
                      { id: 'medium', name: 'Medium' },
                      { id: 'high', name: 'High' }
                    ]}
                    value={editingProject.priority}
                    onChange={(value) => setEditingProject(prev => ({ ...prev, priority: value }))}
                    placeholder="Select Priority"
                    showAllOption={false}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Project Manager</label>
                  <SearchableDropdown
                    options={managerOptionsForEditProject}
                    value={editingProject.projectManagerId || 'all'}
                    onChange={(value) => handleEditingProjectManagerChange(value === 'all' ? '' : value)}
                    placeholder="Select project manager"
                    allOptionLabel="Select project manager"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={editingProject.description}
                  onChange={(e) => setEditingProject(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  rows={3}
                  placeholder="Describe the project goals and objectives"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Deadline</label>
                <DatePicker
                  selectedDate={editingProject.deadline}
                  onDateSelect={(date) => setEditingProject(prev => ({ ...prev, deadline: date }))}
                  placeholder="Select project deadline"
                />
              </div>

              {/* Employee Assignment */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-slate-700">Assign Employees</label>
                  <Badge color="brand">{editingProject.assignedEmployees.length} assigned</Badge>
                </div>

                {/* Available Employees */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-2">Available Employees</p>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={editEmployeeSearchTerm}
                      onChange={(e) => setEditEmployeeSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                      placeholder="Search by name, ID, or role..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {filterEmployees(availableEmployees, editEmployeeSearchTerm, editingProject.assignedEmployees).map(employee => (
                      <div key={employee.id} className="flex items-center justify-between p-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Avatar
                            size="sm"
                            src={employee.avatar}
                            fallback={`${employee.firstName?.[0]?.toUpperCase() || ''}${employee.lastName?.[0]?.toUpperCase() || ''}`}
                            title={employee.name}
                          />
                          <div>
                            <p className="text-sm font-medium text-slate-700">{employee.name}</p>
                            <p className="text-xs text-slate-500">{employee.role}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddEmployeeToEditingProject(employee)}
                          className="p-1 hover:bg-[#C4009A]/10 rounded text-[#C4009A]"
                        >
                          <UserPlus size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assigned Employees */}
                {editingProject.assignedEmployees.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Assigned Employees</p>
                    <div className="space-y-2">
                      {editingProject.assignedEmployees.map(employee => (
                        <div key={employee.id} className="flex items-center justify-between p-2 bg-[#C4009A]/5 border border-[#C4009A]/20 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Avatar
                              size="sm"
                              src={employee.avatar}
                              fallback={`${employee.firstName?.[0]?.toUpperCase() || ''}${employee.lastName?.[0]?.toUpperCase() || ''}`}
                              title={employee.name}
                            />
                            <div>
                              <p className="text-sm font-medium text-slate-700">{employee.name}</p>
                              <p className="text-xs text-slate-500">{employee.role}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveEmployeeFromEditingProject(employee.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Task Division */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-medium text-slate-700">Project Tasks</label>
                  <Button variant="outline" size="sm" onClick={handleAddTaskToEditingProject}>
                    <Plus size={16} /> Add Task
                  </Button>
                </div>

                <div className="space-y-3">
                  {editingProject.tasks.map((task) => (
                    <div key={task.id} className="border border-slate-200 rounded-lg p-3 sm:p-4">
                      <div className="space-y-3">
                        {/* Title Field - Full Width on Mobile, 2 cols on Desktop */}
                        <div className="lg:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Task Title</label>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => handleUpdateEditingProjectTask(task.id, 'title', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] text-sm"
                            placeholder="Task title"
                          />
                        </div>

                        {/* Priority, Assign, Deadline Row - Stacked on Mobile, Side by side on Desktop */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                            <SearchableDropdown
                              options={[
                                { id: 'low', name: 'Low' },
                                { id: 'medium', name: 'Medium' },
                                { id: 'high', name: 'High' }
                              ]}
                              value={task.priority || 'medium'}
                              onChange={(value) => handleUpdateEditingProjectTask(task.id, 'priority', value)}
                              placeholder="Select Priority"
                              showAllOption={false}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Assign To</label>
                            <SearchableDropdown
                              options={editingProject.assignedEmployees}
                              value={task.assignedTo || 'all'}
                              onChange={(value) => handleUpdateEditingProjectTask(task.id, 'assignedTo', value === 'all' ? '' : value)}
                              placeholder="Unassigned"
                              allOptionLabel="Unassigned"
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Deadline</label>
                              <DatePicker
                                selectedDate={task.deadline}
                                onDateSelect={(date) => handleUpdateEditingProjectTask(task.id, 'deadline', date)}
                                placeholder="Select deadline"
                              />
                            </div>
                            <button
                              onClick={() => handleRemoveEditingProjectTask(task.id)}
                              className="p-2 hover:bg-red-100 rounded text-red-600"
                              style={{ marginTop: 'auto' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                        <textarea
                          value={task.description}
                          onChange={(e) => handleUpdateEditingProjectTask(task.id, 'description', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A] text-sm"
                          rows={2}
                          placeholder="Task description (optional)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEditProjectModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateProject}
                disabled={!editingProject.title.trim() || editingProject.assignedEmployees.length === 0 || updatingProject}
              >
                {updatingProject ? 'Updating...' : 'Update Project'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Project Modal */}
      {showViewProjectModal && viewingProject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-xl w-full max-w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto mx-auto">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Project Details</h2>
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
                  <div className="space-y-3">
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
                      <Badge color={viewingProject.priority === 'high' ? 'brand' : 'default'}>
                        {viewingProject.priority === 'high' ? 'High Priority' : viewingProject.priority}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Deadline</p>
                      <p className="font-medium text-slate-800">
                        {new Date(viewingProject.deadline).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
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
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Team Members</h3>
                  <div className="space-y-2">
                    {viewTeamMembers.map((employee) => (
                      <div key={employee.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                        <Avatar
                          size="sm"
                          src={employee.avatar}
                          fallback={`${employee.firstName?.[0]?.toUpperCase() || ''}${employee.lastName?.[0]?.toUpperCase() || ''}`}
                          title={employee.name}
                        />
                        <div>
                          <p className="font-medium text-slate-800">{employee.name}</p>
                          <p className="text-sm text-slate-500">{employee.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tasks Section */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Tasks</h3>
                <div className="space-y-3">
                  {viewTasks.map(task => (
                    <div key={task.id} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-slate-800">{task.title}</h4>
                            <Badge color={
                              task.priority === 'high' ? 'brand' :
                                task.priority === 'medium' ? 'warning' : 'default'
                            }>
                              {task.priority === 'high' ? 'High' :
                                task.priority === 'medium' ? 'Medium' : 'Low'}
                            </Badge>
                            <Badge color={
                              task.status === 'completed' ? 'success' :
                                task.status === 'in_progress' ? 'warning' :
                                  task.status === 'on_hold' ? 'default' : 'default'
                            }>
                              {task.status === 'completed'
                                ? 'Completed'
                                : task.status === 'in_progress'
                                  ? 'In Progress'
                                  : task.status === 'on_hold'
                                    ? 'On Hold'
                                    : 'Pending'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mb-2">{task.description}</p>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                            <span>Assigned to: {
                              viewTeamMembers.find(emp => emp.id === task.assignedTo)?.name || 'Unassigned'
                            }</span>
                            <span>Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No deadline'}</span>
                            {task.completedDate && (
                              <span className="text-green-600 font-medium">
                                Completed: {new Date(task.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                    {viewTaskSummary.completed}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={20} className="text-amber-600" />
                    <span className="font-medium text-amber-800">In Progress</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">
                    {viewTaskSummary.inProgress}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={20} className="text-slate-600" />
                    <span className="font-medium text-slate-800">Total Tasks</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {viewTaskSummary.total}
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
