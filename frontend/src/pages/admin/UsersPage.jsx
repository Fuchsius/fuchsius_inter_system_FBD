import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, Download, Plus, MoreVertical, Search, X, UserPlus, Copy, Award, Edit, UserX, Upload, Trash2, Circle,
  KeyRound, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import SearchableDropdown from '../../components/SearchableDropdown';
import DatePicker from '../../components/DatePicker';
import { toast } from 'react-toastify';
import { usersAPI } from '../../api/users';
import { positionsAPI } from '../../api/positions';
import { departmentsAPI } from '../../api/departments';
import { referralsAPI } from '../../api/referrals';
import { tasksAPI } from '../../api/tasks';
import socketService from '../../services/socketService';
import Loading from '../../components/Loading';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const createInitialUserForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  address: '',
  nicNumber: '',
  dateOfBirth: '',
  positionId: '',
  departmentId: '',
  role: 'employee',
  status: 'active',
  referredBy: '',
  paidAmount: 0,
  avatar: null,
  university: '',
  paymentSlip: null
});

const mapUserToForm = (user) => ({
  id: user.id,
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  email: user.email || '',
  phoneNumber: user.phone || '',
  address: user.address || '',
  nicNumber: user.nic || '',
  dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
  positionId: user.positionId || '',
  departmentId: user.departmentId || '',
  role: user.role || 'employee',
  status: user.status || 'active',
  referredBy: typeof user.referredBy === 'object' ? user.referredBy?.id : (user.referredBy || ''),
  paidAmount: user.paidAmount ?? 0,
  avatar: user.avatar || null,
  university: user.university || '',
  paymentSlip: user.paymentSlip || null
});

const UsersPage = () => {
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resettingUser, setResettingUser] = useState(null);
  const [newPasswordValue, setNewPasswordValue] = useState('');
  const [confirmPasswordValue, setConfirmPasswordValue] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copySuccess, setCopySuccess] = useState(null);
  const [referralSearch, setReferralSearch] = useState('');
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    name: '',
    role: '',
    position: '',
    status: '',
    onlineStatus: ''
  });
  const [newUser, setNewUser] = useState(createInitialUserForm());
  const [newUserReferrerSearch, setNewUserReferrerSearch] = useState('');
  const [editReferrerSearch, setEditReferrerSearch] = useState('');
  const [showReferrerDropdown, setShowReferrerDropdown] = useState(false);
  const [users, setUsers] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loadingCount, setLoadingCount] = useState(0);
  const itemsPerPage = 100;

  const isLoading = loadingCount > 0;

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);


  const USER_FORM_FIELDS = [
    'firstName',
    'lastName',
    'email',
    'address',
    'phone',
    'phoneNumber',
    'nic',
    'nicNumber',
    'dateOfBirth',
    'position',
    'positionId',
    'departmentId',
    'university',
    'status',
    'referredBy',
    'paidAmount',
    'avatar',
    'paymentSlip',
    'role'
  ];

  const buildUserFormData = (data) => {
    const formData = new FormData();
    let hasData = false;
    
    USER_FORM_FIELDS.forEach((field) => {
      const value = data[field];
      // Skip undefined or null
      if (value === undefined || value === null) {
        return;
      }
      // Special handling for avatar field
      if (field === 'avatar') {
        if (value instanceof File) {
          // New file selected
          formData.append(field, value);
          hasData = true;
        } else if (typeof value === 'string' && value.length > 0) {
          // Existing avatar path - send it to indicate we want to keep it
          formData.append(field, value);
          hasData = true;
        }
        // If value is empty string, don't send it (keeps existing avatar)
      } else if (value === '' && field !== 'email') {
        // Allow empty strings for most fields except email
        formData.append(field, '');
        hasData = true;
      } else if (value instanceof File) {
        formData.append(field, value);
        hasData = true;
      } else {
        formData.append(field, value);
        hasData = true;
      }
    });
    
    // If no data was added, add a placeholder to avoid empty request
    if (!hasData) {
      formData.append('_update', 'true');
      hasData = true;
    }
    
    return formData;
  };

  const getFileLabel = (file) => {
    if (!file) return null;
    if (typeof file === 'string') {
      const segments = file.split('/');
      return segments[segments.length - 1];
    }
    return file.name;
  };

  const fetchUsers = async (page = 1, limit = itemsPerPage, filters = {}) => {
    startLoading();
    try {
      let actualLimit = limit;
      if (filters.onlineStatus) {
        actualLimit = 10000; // Fetch all users for client-side filtering
      }
      const params = {
        page: page.toString(),
        limit: actualLimit.toString(),
        includeTaskCounts: true,
        ...(filters.name && { search: filters.name }),
        ...(filters.role && { role: filters.role }),
        ...(filters.position && { position: filters.position }),
        ...(filters.status && { status: filters.status }),
        ...(filters.onlineStatus && { isOnline: filters.onlineStatus === 'online' })
      };

      const response = await usersAPI.getAll(params);

      if (response.success) {
        const users = response.data.users || [];
        
        // Fetch task counts for each user if not provided by API
        const usersWithTaskCounts = await Promise.all(
          users.map(async (user) => {
            // If API doesn't provide task counts, fetch them
            if (!user.pendingTasksCount && !user.incompleteTasksCount && !user.completeTasksCount) {
              try {
                const tasksResponse = await tasksAPI.getAll({ userId: user.id, limit: 1000 });
                if (tasksResponse.success) {
                  const tasks = tasksResponse.data?.tasks || [];
                  const pendingTasks = tasks.filter(task => task.status === 'pending');
                  const incompleteTasks = tasks.filter(task => task.status === 'in_progress');
                  const completeTasks = tasks.filter(task => task.status === 'completed');
                  
                  return {
                    ...user,
                    pendingTasksCount: pendingTasks.length,
                    incompleteTasksCount: incompleteTasks.length,
                    completeTasksCount: completeTasks.length
                  };
                }
              } catch (error) {
              }
            }
            
            // Return user with existing or default task counts
            return {
              ...user,
              pendingTasksCount: user.pendingTasksCount || 0,
              incompleteTasksCount: user.incompleteTasksCount || 0,
              completeTasksCount: user.completeTasksCount || 0
            };
          })
        );
        
        setUsers(usersWithTaskCounts);
        setPagination(response.data.pagination);
      } else {
        toast.error('Failed to fetch users');
      }
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      stopLoading();
    }
  };

  const fetchReferrals = async (page = 1, limit = itemsPerPage, filters = {}) => {
    startLoading();
    try {
      const params = {
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.referredBy && { referredBy: filters.referredBy })
      };

      const response = await referralsAPI.getAll(params);

      if (response.success) {
        setReferrals(response.data.referrals);
      } else {
        toast.error('Failed to fetch referrals');
      }
    } catch (error) {
      toast.error('Failed to fetch referrals');
    } finally {
      stopLoading();
    }
  };

  const fetchPositions = async () => {
    startLoading();
    try {
      const response = await positionsAPI.getAll();

      if (response.success) {
        setPositions(response.data?.positions || []);
      }
    } catch (error) {
      toast.error('Failed to fetch positions');
    } finally {
      stopLoading();
    }
  };

  const fetchDepartments = async () => {
    startLoading();
    try {
      const response = await departmentsAPI.getAll();

      if (response.success) {
        setDepartments(response.data?.departments || []);
      }
    } catch (error) {
      toast.error('Failed to fetch departments');
    } finally {
      stopLoading();
    }
  };

  const createUser = async (userData) => {
    startLoading();
    try {
      const formData = buildUserFormData(userData);
      const response = await usersAPI.create(formData);

      if (response.success) {
        toast.success('User created successfully');
        if (response.data?.temporaryPassword) {
          toast.info(`Temporary password: ${response.data.temporaryPassword}`);
        }
        fetchUsers(currentPage);
        setShowAddUserModal(false);
        setNewUser(createInitialUserForm());
      } else {
        toast.error(response.data.message || 'Failed to create user');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      stopLoading();
    }
  };

  const updateUser = async (userData) => {
    startLoading();
    try {
      const formData = buildUserFormData(userData);
      const response = await usersAPI.update(userData.id, formData);

      if (response.success) {
        toast.success('User updated successfully');
        fetchUsers(currentPage);
        setShowEditUserModal(false);
        setEditingUser(null);
      } else {
        toast.error(response.data.message || 'Failed to update user');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      stopLoading();
    }
  };

  const deleteUser = async (userId) => {
    startLoading();
    try {
      const response = await usersAPI.delete(userId);

      if (response.success) {
        toast.success(response.message || 'User deleted successfully');
        fetchUsers(currentPage);
        setShowDeleteModal(false);
        setDeletingUser(null);
      } else {
        toast.error(response.data.message || 'Failed to delete user');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      stopLoading();
    }
  };

  // Helper function to format Sri Lanka time
const formatSriLankaTime = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  
  // Format using Sri Lanka timezone
  return date.toLocaleString('en-LK', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

// Handle user status updates - optimized with useCallback
const handleUserStatus = useCallback((data) => {
  
  setUsers(prevUsers => {
    // Early return if user not found
    const userIndex = prevUsers.findIndex(u => u.id === data.userId);
    if (userIndex === -1) return prevUsers;
    
    // Create new array with updated user
    const newUsers = [...prevUsers];
    newUsers[userIndex] = {
      ...newUsers[userIndex],
      lastActiveAt: data.lastActiveAt,
      isOnline: data.type === 'online'
    };
    return newUsers;
  });
}, []);

// Handle real-time activity updates - optimized with useCallback
const handleActivityUpdate = useCallback((data) => {
  setUsers(prevUsers => {
    // Early return if user not found
    const userIndex = prevUsers.findIndex(u => u.id === data.userId);
    if (userIndex === -1) return prevUsers;
    
    // Create new array with updated user
    const newUsers = [...prevUsers];
    newUsers[userIndex] = {
      ...newUsers[userIndex],
      lastActiveAt: data.lastActiveAt,
      isOnline: data.isOnline
    };
    return newUsers;
  });
}, []);

// Load data on component mount - optimized
useEffect(() => {
  fetchUsers();
  fetchReferrals();
  fetchPositions();
  fetchDepartments();
}, []);

// Socket event listeners - optimized with proper dependencies
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

// Memory optimization for users list - cleanup old data
useEffect(() => {
  const cleanupInterval = setInterval(() => {
    setUsers(prevUsers => {
      // Remove users that haven't been updated in 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      return prevUsers.filter(user => {
        // Keep users who are online or have recent activity
        return user.isOnline || (user.lastActiveAt && new Date(user.lastActiveAt) > twoHoursAgo);
      });
    });
  }, 30 * 60 * 1000); // Run every 30 minutes

  return () => clearInterval(cleanupInterval);
}, []);

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

  // Get list of all users for referrer dropdown
  const potentialReferrers = users;

  // Filter referrers based on search for editing
  const filteredReferrers = (searchTerm) => potentialReferrers.filter(user => {
    if (!searchTerm) return true; // Show all users when search is empty
    return `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleEditReferrerSelect = (user) => {
    setEditingUser(prev => ({ ...prev, referredBy: user.id }));
    setEditReferrerSearch(`${user.firstName} ${user.lastName} (${user.employeeId})`);
    setShowReferrerDropdown(false);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showReferrerDropdown && !event.target.closest('.referrer-dropdown')) {
        setShowReferrerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReferrerDropdown]);

  const handleAddUser = () => {
    // Use real API call instead of mock logic
    createUser(newUser);
  };

  const handleEditUser = (user) => {
    setEditingUser(mapUserToForm(user));
    // Pre-fill referrer search if user has a referrer
    if (user.referredBy) {
      if (typeof user.referredBy === 'string') {
        const referrerUser = users.find(u => u.id === user.referredBy);
        if (referrerUser) {
          setEditReferrerSearch(`${referrerUser.firstName} ${referrerUser.lastName} (${referrerUser.employeeId})`);
        }
      } else if (typeof user.referredBy === 'object') {
        setEditReferrerSearch(`${user.referredBy.firstName} ${user.referredBy.lastName} (${user.referredBy.employeeId})`);
      }
    } else {
      setEditReferrerSearch('');
    }
    setShowEditUserModal(true);
    setShowActionMenu(null);
  };

  const handleDeleteUser = () => {
    // Use real API call instead of mock logic
    if (deletingUser) {
      deleteUser(deletingUser.id);
    }
  };

  const openDeleteModal = (user) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
    setShowActionMenu(null);
  };

  const openResetPasswordModal = (user) => {
    setResettingUser(user);
    setNewPasswordValue('');
    setConfirmPasswordValue('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowResetPasswordModal(true);
    setShowActionMenu(null);
  };

  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i += 1) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPasswordValue(password);
    setConfirmPasswordValue(password);
  };

  const handleResetPassword = async () => {
    if (!resettingUser) return;
    if (!newPasswordValue || !confirmPasswordValue) {
      toast.error('Please enter the new password and confirmation');
      return;
    }
    if (newPasswordValue !== confirmPasswordValue) {
      toast.error('Password confirmation does not match');
      return;
    }

    startLoading();
    try {
      setIsResettingPassword(true);
      await axios.patch(
        `${API_BASE_URL}/users/${resettingUser.id}/password`,
        { newPassword: newPasswordValue },
        { headers: getAuthHeaders() }
      );

      toast.success('Password reset successfully');
      setShowResetPasswordModal(false);
      setResettingUser(null);
      setNewPasswordValue('');
      setConfirmPasswordValue('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
      stopLoading();
    }
  };

  const copyReferralCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('Referral code copied to clipboard!');
  };

  // Apply client-side filtering for online status using socket data
  const displayUsers = filters.onlineStatus ? users.filter(user => {
    return filters.onlineStatus === 'online' ? user.isOnline : !user.isOnline;
  }) : users;

  // Handle pagination logic
  let totalPages = pagination.pages || 1;
  let paginatedUsers = displayUsers;
  let totalResults = pagination.total || 0;

  if (filters.onlineStatus) {
    totalResults = displayUsers.length;
    totalPages = Math.ceil(displayUsers.length / itemsPerPage);
    paginatedUsers = displayUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }

  const handlePageChange = (page) => {
    if (filters.onlineStatus) {
      setCurrentPage(page);
    } else {
      setCurrentPage(page);
      fetchUsers(page, itemsPerPage, filters);
    }
  };

  // Reset page when filters change and fetch filtered data
  React.useEffect(() => {
    setCurrentPage(1);
    fetchUsers(1, itemsPerPage, filters);
  }, [filters.name, filters.role, filters.position, filters.status, filters.onlineStatus]);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const clearFilters = () => {
    setFilters({ name: '', role: '', position: '', status: '', onlineStatus: '' });
  };

  // Filter referrers based on search for new user creation
  const filteredNewUserReferrers = filteredReferrers(newUserReferrerSearch);

  const handleNewUserReferrerSelect = (referrer) => {
    setNewUser({ ...newUser, referredBy: referrer.id }); // Store referrer ID instead of name
    setNewUserReferrerSearch(`${referrer.firstName} ${referrer.lastName} (${referrer.employeeId})`);
    setShowReferralDropdown(false);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (showReferralDropdown && !event.target.closest('.referral-dropdown')) {
        setShowReferralDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReferralDropdown]);

  const exportToCSV = () => {
    // Create CSV content
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Role', 'Position', 'Status', 'University', 'Referred By', 'Created Date'];
    const csvContent = [
      headers.join(','),
      ...displayUsers.map(user => [
        `"${user.firstName}"`,
        `"${user.lastName}"`,
        `"${user.email}"`,
        `"${user.phoneNumber}"`,
        `"${user.role}"`,
        `"${user.position}"`,
        `"${user.status}"`,
        `"${user.university || ''}"`,
        `"${user.referredBy || 'N/A'}"`,
        `"${user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}"`
      ].join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('CSV report downloaded successfully!');
  };

  return (
    <>
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="space-y-4">
            {/* First Row - Search and Action Buttons */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                  placeholder="Search by name..."
                  value={filters.name}
                  onChange={(e) => handleFilterChange('name', e.target.value)}
                />
              </div>

              <div className="flex gap-2 w-full lg:w-auto">
                <Button variant="outline" icon={Download} onClick={exportToCSV}>Export</Button>
                <Button icon={Plus} onClick={() => setShowAddUserModal(true)}>Add User</Button>
              </div>
            </div>

            {/* Second Row - Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600 font-medium">Filters:</span>

              <SearchableDropdown
                options={[
                  { id: 'admin', name: 'Admin' },
                  { id: 'pm', name: 'Project Manager' },
                  { id: 'employee', name: 'Employee' },
                  { id: 'interners', name: 'Intern' },
                  { id: 'hr', name: 'HR' }
                ]}
                value={filters.role || 'all'}
                onChange={(value) => handleFilterChange('role', value === 'all' ? '' : value)}
                placeholder="All Roles"
                allOptionLabel="All Roles"
                className="min-w-[140px]"
              />

              <SearchableDropdown
                options={positions}
                value={filters.position || 'all'}
                onChange={(value) => handleFilterChange('position', value === 'all' ? '' : value)}
                placeholder="All Positions"
                allOptionLabel="All Positions"
                className="min-w-[140px]"
              />

              <SearchableDropdown
                options={[
                  { id: 'active', name: 'Active' },
                  { id: 'pending', name: 'Pending' },
                  { id: 'suspended', name: 'Suspended' },
                  { id: 'inactive', name: 'Inactive' }
                ]}
                value={filters.status || 'all'}
                onChange={(value) => handleFilterChange('status', value === 'all' ? '' : value)}
                placeholder="All Statuses"
                allOptionLabel="All Statuses"
                className="min-w-[140px]"
              />

              <SearchableDropdown
                options={[
                  { id: 'online', name: 'Online' },
                  { id: 'offline', name: 'Offline' }
                ]}
                value={filters.onlineStatus || 'all'}
                onChange={(value) => handleFilterChange('onlineStatus', value === 'all' ? '' : value)}
                placeholder="All Online Status"
                allOptionLabel="All Online Status"
                className="min-w-[140px]"
              />

              <Button variant="outline" onClick={clearFilters} className="whitespace-nowrap">Clear Filters</Button>
            </div>

            {/* Active Filters Display */}
            {Object.values(filters).some(value => value) && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                <span className="font-medium">Active filters:</span>
                {filters.name && <span className="bg-white px-2 py-1 rounded border border-slate-200">Name: {filters.name}</span>}
                {filters.role && <span className="bg-white px-2 py-1 rounded border border-slate-200">Role: {filters.role}</span>}
                {filters.position && <span className="bg-white px-2 py-1 rounded border border-slate-200">Position: {positions.find(p => p.id === filters.position)?.name}</span>}
                {filters.status && <span className="bg-white px-2 py-1 rounded border border-slate-200">Status: {filters.status}</span>}
                {filters.onlineStatus && <span className="bg-white px-2 py-1 rounded border border-slate-200">Online Status: {filters.onlineStatus}</span>}
                <span className="text-fuchsia-600 font-medium ml-auto">{totalResults} results found</span>
              </div>
            )}
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <div className="min-w-[1000px] inline-block">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Last Active</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">University</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Pending Tasks</th>
                  <th className="px-6 py-4">Incomplete Tasks</th>
                  <th className="px-6 py-4">Complete Tasks</th>
                  <th className="px-6 py-4">Referral Code</th>
                  <th className="px-6 py-4">Referred By</th>
                  <th className="px-6 py-4">Referrals</th>
                  <th className="px-6 py-4">Paid Amount</th>
                  <th className="px-6 py-4">Created Date</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 ">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">
                            {formatLastActive(user.lastActiveAt)}
                          </span>
                          <div className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                          {user.isOnline ? (
                            <span className="flex items-center text-xs text-green-600">
                              Online
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Offline
                            </span>
                          )}
                        </div>
                        {user.lastActiveAt && (
                          <span className="text-xs text-slate-400">
                            {new Date(user.lastActiveAt).toLocaleString()}
                          </span>
                        )}
                        {!user.lastActiveAt && (
                          <span className="text-xs text-slate-400">Never</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        color={
                          user.status === 'active' ? "success" :
                          user.status === 'inactive' ? "error" :
                          user.status === 'pending' ? "warning" :
                          user.status === 'suspended' ? "brand" :
                          "default"
                        }
                      >
                        {user.status === 'active' ? 'Active' :
                          user.status === 'inactive' ? 'Inactive' :
                          user.status === 'pending' ? 'Pending' :
                          user.status === 'suspended' ? 'Suspended' :
                          user.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <Avatar
                        src={user.avatar}
                        fallback={`${user.firstName?.[0]?.toUpperCase() || ''}${user.lastName?.[0]?.toUpperCase() || ''}`}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 truncate">{user.university || '-'}</td>
                    <td className="px-6 py-4 text-slate-600 truncate">{user.role}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">
                        {user.pendingTasksCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">
                        {user.incompleteTasksCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">
                        {user.completeTasksCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono truncate">{user.referralCode}</code>
                        <button
                          onClick={() => copyReferralCode(user.referralCode)}
                          className="text-slate-400 hover:text-slate-600 shrink-0"
                          title="Copy referral code"
                        >
                          {copySuccess === user.referralCode ? (
                            <CheckCircle size={14} className="text-green-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        // Handle both object and string types for referredBy
                        let referrerDisplay = '-';
                        if (user.referredBy) {
                          if (typeof user.referredBy === 'object' && user.referredBy.firstName) {
                            // If referredBy is an object with user data
                            referrerDisplay = `${user.referredBy.firstName} ${user.referredBy.lastName} (${user.referredBy.employeeId})`;
                          } else if (typeof user.referredBy === 'string') {
                            // If referredBy is a user ID, try to find the user in users list
                            const referrerUser = users.find(u => u.id === user.referredBy);
                            if (referrerUser) {
                              referrerDisplay = `${referrerUser.firstName} ${referrerUser.lastName} (${referrerUser.employeeId})`;
                            } else {
                              referrerDisplay = 'Unknown User';
                            }
                          }
                        }
                        return (
                          <span className="text-xs bg-fuchsia-100 text-fuchsia-700 px-2 py-1 rounded truncate">
                            {referrerDisplay}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">
                        {users.filter(u => 
                          u.referredBy && (
                            (typeof u.referredBy === 'string' && u.referredBy === user.id) ||
                            (typeof u.referredBy === 'object' && u.referredBy.id === user.id)
                          )
                        ).length}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const paidAmount = Number(user.paidAmount ?? 0);
                        return (
                          <span className="text-sm font-medium text-green-600 truncate">LKR {paidAmount.toLocaleString()}</span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        }) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          className="px-3 py-1 text-xs"
                        >
                          <Edit size={12} className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeleteModal(user)}
                          className="px-3 py-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 size={12} className="mr-1" />
                          Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openResetPasswordModal(user)}
                          className="px-3 py-1 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                        >
                          <KeyRound size={12} className="mr-1" />
                          Reset
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalResults)} of {totalResults} users
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

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add New User</h2>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={newUser.phoneNumber}
                    onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIC Number</label>
                  <input
                    type="text"
                    value={newUser.nicNumber}
                    onChange={(e) => setNewUser({ ...newUser, nicNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter NIC number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date of Birth</label>
                  <DatePicker
                    selectedDate={newUser.dateOfBirth}
                    onDateSelect={(date) => setNewUser({ ...newUser, dateOfBirth: date })}
                    placeholder="Select date of birth"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                  <SearchableDropdown
                    options={[
                      { id: 'employee', name: 'Employee' },
                      { id: 'interners', name: 'Intern' },
                      { id: 'hr', name: 'HR' },
                      { id: 'pm', name: 'PM' },
                      { id: 'admin', name: 'Admin' }
                    ]}
                    value={newUser.role}
                    onChange={(value) => setNewUser({ ...newUser, role: value })}
                    placeholder="Select Role"
                    showAllOption={false}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <SearchableDropdown
                    options={departments}
                    value={newUser.departmentId || 'all'}
                    onChange={(value) => setNewUser({ ...newUser, departmentId: value === 'all' ? '' : value })}
                    placeholder="Select Department"
                    allOptionLabel="Select Department"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                  <SearchableDropdown
                    options={positions}
                    value={newUser.positionId || 'all'}
                    onChange={(value) => setNewUser({ ...newUser, positionId: value === 'all' ? '' : value })}
                    placeholder="Select Position"
                    allOptionLabel="Select Position"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">University</label>
                  <input
                    type="text"
                    value={newUser.university}
                    onChange={(e) => setNewUser({ ...newUser, university: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter university name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Avatar</label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setNewUser({ ...newUser, avatar: file });
                      }
                    }}
                    className="hidden"
                    id="avatar"
                  />
                  <label
                    htmlFor="avatar"
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Upload size={16} className="text-slate-400" />
                    <span className="text-sm">
                      {newUser.avatar ? getFileLabel(newUser.avatar) : 'Choose file or drag and drop'}
                    </span>
                  </label>
                  {newUser.avatar && (
                    <span className="text-xs text-green-600 font-medium">
                      ✓ File uploaded
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Slip</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setNewUser({ ...newUser, paymentSlip: file });
                      }
                    }}
                    className="hidden"
                    id="paymentSlip"
                  />
                  <label
                    htmlFor="paymentSlip"
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Upload size={16} className="text-slate-400" />
                    <span className="text-sm">
                      {newUser.paymentSlip ? getFileLabel(newUser.paymentSlip) : 'Choose file or drag and drop'}
                    </span>
                  </label>
                  {newUser.paymentSlip && (
                    <span className="text-xs text-green-600 font-medium">
                      ✓ File uploaded
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <textarea
                    value={newUser.address}
                    onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter full address"
                    rows="2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <SearchableDropdown
                    options={[
                      { id: 'active', name: 'Active' },
                      { id: 'pending', name: 'Pending' },
                      { id: 'suspended', name: 'Suspended' },
                      { id: 'inactive', name: 'Inactive' }
                    ]}
                    value={newUser.status}
                    onChange={(value) => setNewUser({ ...newUser, status: value })}
                    placeholder="Select Status"
                    showAllOption={false}
                  />
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Referred By</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={newUserReferrerSearch || (() => {
                        // Display referrer name if newUser has referredBy
                        if (newUser.referredBy) {
                          if (typeof newUser.referredBy === 'string') {
                            // If referredBy is a user ID, find the user
                            const referrerUser = users.find(u => u.id === newUser.referredBy);
                            if (referrerUser) {
                              return `${referrerUser.firstName} ${referrerUser.lastName} (${referrerUser.employeeId})`;
                            }
                            return 'Unknown User';
                          } else if (typeof newUser.referredBy === 'object') {
                            // If referredBy is already an object with user data
                            return `${newUser.referredBy.firstName} ${newUser.referredBy.lastName} (${newUser.referredBy.employeeId})`;
                          }
                        }
                        return '';
                      })()}
                      onChange={(e) => {
                        setNewUserReferrerSearch(e.target.value);
                        setShowReferralDropdown(true);
                      }}
                      onFocus={() => setShowReferralDropdown(true)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                      placeholder="Search and select referrer"
                    />

                    {showReferralDropdown && (
                      <div className="referral-dropdown absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {filteredNewUserReferrers.length > 0 ? (
                          filteredNewUserReferrers.map((referrer) => (
                            <button
                              key={referrer.id}
                              onClick={() => handleNewUserReferrerSelect(referrer)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"
                            >
                              <Avatar size="sm" fallback={`${referrer.firstName?.[0]?.toUpperCase() || ''}${referrer.lastName?.[0]?.toUpperCase() || ''}`} />
                              <div>
                                <p className="font-medium text-slate-800">{referrer.firstName} {referrer.lastName}</p>
                                <p className="text-xs text-slate-500">{referrer.referralCode} • {referrer.referralCount} referrals</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-slate-500">
                            No referrers found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Paid Amount (LKR)</label>
                <input
                  type="number"
                  value={newUser.paidAmount}
                  onChange={(e) => setNewUser({ ...newUser, paidAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter initial paid amount in LKR"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-slate-500 mt-1">Initial amount paid for referrals (if any)</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowAddUserModal(false)}
              >
                Cancel
              </Button>
              <Button
                icon={UserPlus}
                onClick={handleAddUser}
                disabled={!newUser.firstName || !newUser.lastName || !newUser.email}
              >
                Add User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Edit User</h2>
              <button
                onClick={() => setShowEditUserModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={editingUser.firstName}
                    onChange={(e) => setEditingUser({ ...editingUser, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter first name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={editingUser.lastName}
                    onChange={(e) => setEditingUser({ ...editingUser, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter last name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter email address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={editingUser.phoneNumber}
                    onChange={(e) => setEditingUser({ ...editingUser, phoneNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">NIC Number</label>
                  <input
                    type="text"
                    value={editingUser.nicNumber}
                    onChange={(e) => setEditingUser({ ...editingUser, nicNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter NIC number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                  <DatePicker
                    selectedDate={editingUser.dateOfBirth ? editingUser.dateOfBirth.split('T')[0] : ''}
                    onDateSelect={(date) => setEditingUser({ ...editingUser, dateOfBirth: date })}
                    placeholder="Select date of birth"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                  <SearchableDropdown
                    options={[
                      { id: 'employee', name: 'Employee' },
                      { id: 'interners', name: 'Intern' },
                      { id: 'hr', name: 'HR' },
                      { id: 'pm', name: 'PM' },
                      { id: 'admin', name: 'Admin' }
                    ]}
                    value={editingUser.role || ''}
                    onChange={(value) => setEditingUser({ ...editingUser, role: value })}
                    placeholder="Select Role"
                    showAllOption={false}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <SearchableDropdown
                    options={departments}
                    value={editingUser.departmentId || 'all'}
                    onChange={(value) => setEditingUser({ ...editingUser, departmentId: value === 'all' ? '' : value })}
                    placeholder="Select Department"
                    allOptionLabel="Select Department"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Position</label>
                  <SearchableDropdown
                    options={positions}
                    value={editingUser.positionId || 'all'}
                    onChange={(value) => setEditingUser({ ...editingUser, positionId: value === 'all' ? '' : value })}
                    placeholder="Select Position"
                    allOptionLabel="Select Position"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">University</label>
                  <input
                    type="text"
                    value={editingUser.university || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, university: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                    placeholder="Enter university name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Avatar</label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setEditingUser({ ...editingUser, avatar: file });
                      }
                    }}
                    className="hidden"
                    id="editAvatar"
                  />
                  <label
                    htmlFor="editAvatar"
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Upload size={16} className="text-slate-400" />
                    <span className="text-sm">
                      {editingUser.avatar ? (editingUser.avatar instanceof File ? editingUser.avatar.name : editingUser.avatar) : 'Choose file or drag and drop'}
                    </span>
                  </label>
                  {editingUser.avatar && (
                    <span className="text-xs text-green-600 font-medium">
                      ✓ File uploaded
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Slip</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setEditingUser({ ...editingUser, paymentSlip: file.name });
                      }
                    }}
                    className="hidden"
                    id="editPaymentSlip"
                  />
                  <label
                    htmlFor="editPaymentSlip"
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <Upload size={16} className="text-slate-400" />
                    <span className="text-sm">
                      {editingUser.paymentSlip ? editingUser.paymentSlip : 'Choose file or drag and drop'}
                    </span>
                  </label>
                  {editingUser.paymentSlip && (
                    <span className="text-xs text-green-600 font-medium">
                      ✓ File uploaded
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <SearchableDropdown
                    options={[
                      { id: 'active', name: 'Active' },
                      { id: 'pending', name: 'Pending' },
                      { id: 'suspended', name: 'Suspended' },
                      { id: 'inactive', name: 'Inactive' }
                    ]}
                    value={editingUser.status || ''}
                    onChange={(value) => setEditingUser({ ...editingUser, status: value })}
                    placeholder="Select Status"
                    showAllOption={false}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Referred By</label>
                  <div className="relative referrer-dropdown">
                    <input
                      type="text"
                      value={editReferrerSearch || (() => {
                        // Display referrer name if editingUser has referredBy
                        if (editingUser.referredBy) {
                          if (typeof editingUser.referredBy === 'string') {
                            // If referredBy is a user ID, find the user
                            const referrerUser = users.find(u => u.id === editingUser.referredBy);
                            if (referrerUser) {
                              return `${referrerUser.firstName} ${referrerUser.lastName} (${referrerUser.employeeId})`;
                            }
                            return 'Unknown User';
                          } else if (typeof editingUser.referredBy === 'object') {
                            // If referredBy is already an object with user data
                            return `${editingUser.referredBy.firstName} ${editingUser.referredBy.lastName} (${editingUser.referredBy.employeeId})`;
                          }
                        }
                        return '';
                      })()}
                      onChange={(e) => {
                        setEditReferrerSearch(e.target.value);
                        setShowReferrerDropdown(true);
                      }}
                      onFocus={() => {
                        setShowReferrerDropdown(true);
                        setEditReferrerSearch(''); // Clear search to show all users
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                      placeholder="Search and select referrer"
                    />

                    {showReferrerDropdown && (
                      (() => {
                        const editReferrerOptions = filteredReferrers(editReferrerSearch);
                        return (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                            {editReferrerOptions.length > 0 ? (
                              editReferrerOptions.map((user) => (
                                <button
                                  key={user.id}
                                  onClick={() => handleEditReferrerSelect(user)}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm"
                                >
                                  <Avatar size="sm" fallback={`${user.firstName?.[0]?.toUpperCase() || ''}${user.lastName?.[0]?.toUpperCase() || ''}`} />
                                  <div>
                                    <p className="font-medium text-slate-800">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-slate-500">{user.employeeId}</p>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-slate-500">
                                {editReferrerSearch ? 'No users found' : 'Start typing to search users'}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={editingUser.address || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter full address"
                  rows="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Initial Paid Amount (LKR)</label>
                <input
                  type="number"
                  value={editingUser.paidAmount ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditingUser({
                      ...editingUser,
                      paidAmount: value === '' ? null : parseFloat(value) || 0
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter initial paid amount in LKR"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-slate-500 mt-1">Initial amount paid for referrals (if any)</p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowEditUserModal(false)}
              >
                Cancel
              </Button>
              <Button
                icon={Edit}
                onClick={() => {
                  updateUser(editingUser);
                  setShowEditUserModal(false);
                  setEditingUser(null);
                }}
                disabled={!editingUser.firstName || !editingUser.lastName || !editingUser.email}
              >
                Update User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Delete User</h2>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-4">
                Are you sure you want to delete user "<strong>{deletingUser?.firstName} {deletingUser?.lastName}</strong>"?
              </p>
              <p className="text-sm text-slate-500">
                This action cannot be undone. All associated data will be permanently removed.
              </p>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingUser(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteUser}
                className="bg-red-600 text-white hover:bg-red-700 border-none"
              >
                Delete User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && resettingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Reset Password</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {resettingUser.firstName} {resettingUser.lastName} ({resettingUser.email})
                </p>
              </div>
              <button
                onClick={() => setShowResetPasswordModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
                disabled={isResettingPassword}
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPasswordValue}
                      onChange={(e) => setNewPasswordValue(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A] pr-11"
                      placeholder="Enter new password"
                      disabled={isResettingPassword}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                      disabled={isResettingPassword}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateStrongPassword}
                    icon={RefreshCw}
                    disabled={isResettingPassword}
                    className="shrink-0"
                  >
                    Generate
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPasswordValue}
                    onChange={(e) => setConfirmPasswordValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A] pr-11"
                    placeholder="Confirm new password"
                    disabled={isResettingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                    disabled={isResettingPassword}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                The selected user will need to use this password on their next login. Advise them to update it after logging in.
              </p>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowResetPasswordModal(false)}
                disabled={isResettingPassword}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UsersPage;
