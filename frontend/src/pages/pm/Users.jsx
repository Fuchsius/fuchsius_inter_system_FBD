import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, X } from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import SearchableDropdown from '../../components/SearchableDropdown';
import { toast } from 'react-toastify';
import { usersAPI } from '../../api/users';
import { positionsAPI } from '../../api/positions';
import { departmentsAPI } from '../../api/departments';
import { tasksAPI } from '../../api/tasks';
import socketService from '../../services/socketService';
import Loading from '../../components/Loading';

const Users = ({ userRole }) => {
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ role: '', position: '', status: '' });
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
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


  const fetchUsers = async () => {
    startLoading();
    try {
      const response = await usersAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        includeTaskCounts: true,
        ...(searchTerm && { search: searchTerm }),
        ...(filters.role && { role: filters.role }),
        ...(filters.position && { department: filters.position }),
        ...(filters.status && { status: filters.status })
      });

      if (response.success) {
        const users = response.data?.users || [];
        
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
        setPagination(response.data?.pagination || pagination);
      }
    } catch (error) {
      toast.error('Failed to fetch users');
    } finally {
      stopLoading();
    }
  };

  useEffect(() => {
    const fetchFilterData = async () => {
      startLoading();
      try {
        const [positionsRes, departmentsRes] = await Promise.all([
          positionsAPI.getAll(),
          departmentsAPI.getAll()
        ]);
        if (positionsRes.success) {
          setPositions(positionsRes.data?.positions || []);
        }
        if (departmentsRes.success) {
          setDepartments(departmentsRes.data?.departments || []);
        }
      } catch (error) {
        toast.error('Failed to fetch filter options');
      } finally {
        stopLoading();
      }
    };
    fetchFilterData();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);

  // Handle user status updates
  const handleUserStatus = (data) => {
    setUsers(prevUsers => {
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
  };

  // Handle real-time activity updates
  const handleActivityUpdate = (data) => {
    setUsers(prevUsers => {
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
  };

  // Socket event listeners
  useEffect(() => {
    const unsubscribeUserStatus = socketService.on('user_status', handleUserStatus);
    const unsubscribeActivityListener = socketService.onUserStatusUpdate(handleActivityUpdate);

    return () => {
      if (unsubscribeUserStatus) unsubscribeUserStatus();
      if (unsubscribeActivityListener) unsubscribeActivityListener();
    };
  }, [handleUserStatus, handleActivityUpdate]);

  // Format last active time with relative time
  const formatLastActive = (lastActiveAt) => {
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
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  // Use users directly from API (no client-side filtering needed)
  const displayUsers = users;

  // Pagination is handled by the API
  const paginatedUsers = displayUsers;

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <>
      {isLoading && <Loading size={80} bg="bg-black/20" />}
      <Card className="overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-600 font-medium">Filters:</span>
              <SearchableDropdown
                options={[
                  { id: 'admin', name: 'Admin' },
                  { id: 'pm', name: 'Project Manager' },
                  { id: 'employee', name: 'Employee' },
                  { id: 'intern', name: 'Intern' },
                  { id: 'hr', name: 'HR' }
                ]}
                value={filters.role || 'all'}
                onChange={(value) => setFilters(prev => ({ ...prev, role: value === 'all' ? '' : value }))}
                placeholder="All Roles"
                allOptionLabel="All Roles"
                className="min-w-[140px]"
              />
              <SearchableDropdown
                options={positions}
                value={filters.position || 'all'}
                onChange={(value) => setFilters(prev => ({ ...prev, position: value === 'all' ? '' : value }))}
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
                onChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}
                placeholder="All Statuses"
                allOptionLabel="All Statuses"
                className="min-w-[140px]"
              />
              <Button variant="outline" onClick={() => { setSearchTerm(''); setFilters({ role: '', position: '', status: '' }); }} className="whitespace-nowrap">Clear Filters</Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1400px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th className="px-6 py-4">Last Active</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Position</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Pending Tasks</th>
                  <th className="px-6 py-4">Incomplete Tasks</th>
                  <th className="px-6 py-4">Complete Tasks</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                        <p className="text-xs text-slate-500 truncate">{user.employeeId || ''}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 truncate">{user.email}</td>
                    <td className="px-6 py-4 text-slate-600 truncate">{user.role}</td>
                    <td className="px-6 py-4 text-slate-600 truncate">{user.position?.name || '-'}</td>
                    <td className="px-6 py-4 text-slate-600 truncate">{user.department?.name || '-'}</td>
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
                      <button
                        onClick={() => handleViewUser(user)}
                        className="text-[#C4009A] hover:text-[#C4009A]/80"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} users
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
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
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.pages}
                className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* View User Modal */}
      {showViewModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">User Details</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* User Profile Header */}
              <div className="flex items-center gap-4">
                <Avatar
                  size="lg"
                  src={selectedUser.avatar}
                  fallback={`${selectedUser.firstName?.[0]?.toUpperCase() || ''}${selectedUser.lastName?.[0]?.toUpperCase() || ''}`}
                />
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <p className="text-sm text-slate-500">{selectedUser.email}</p>
                  <Badge
                    color={
                      selectedUser.status === 'active' ? "success" :
                      selectedUser.status === 'inactive' ? "error" :
                      selectedUser.status === 'pending' ? "warning" :
                      selectedUser.status === 'suspended' ? "brand" :
                      "default"
                    }
                    className="mt-2 inline-block"
                  >
                    {selectedUser.status === 'active' ? 'Active' :
                      selectedUser.status === 'inactive' ? 'Inactive' :
                      selectedUser.status === 'pending' ? 'Pending' :
                      selectedUser.status === 'suspended' ? 'Suspended' :
                      selectedUser.status}
                  </Badge>
                </div>
              </div>

              {/* User Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Employee ID</p>
                  <p className="font-medium text-slate-800">{selectedUser.employeeId || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Role</p>
                  <p className="font-medium text-slate-800">{selectedUser.role}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Position</p>
                  <p className="font-medium text-slate-800">{selectedUser.position?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Department</p>
                  <p className="font-medium text-slate-800">{selectedUser.department?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Phone</p>
                  <p className="font-medium text-slate-800">{selectedUser.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Address</p>
                  <p className="font-medium text-slate-800">{selectedUser.address || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">University</p>
                  <p className="font-medium text-slate-800">{selectedUser.university || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Date of Birth</p>
                  <p className="font-medium text-slate-800">
                    {selectedUser.dateOfBirth
                      ? new Date(selectedUser.dateOfBirth).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Activity Information */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-semibold text-slate-800 mb-3">Activity</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Last Active</p>
                    <p className="font-medium text-slate-800">
                      {formatLastActive(selectedUser.lastActiveAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Online Status</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${selectedUser.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                      <span className="font-medium text-slate-800">
                        {selectedUser.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Users;