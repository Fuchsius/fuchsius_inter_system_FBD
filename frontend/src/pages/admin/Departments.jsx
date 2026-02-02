import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Edit, Trash2, Search, X, Loader2
} from 'lucide-react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import { toast } from 'react-toastify';
import { departmentsAPI } from '../../api/departments';

const Departments = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [deletingDepartment, setDeletingDepartment] = useState(null);
  const [showActionMenu, setShowActionMenu] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);

  // Individual loading states for different operations
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [addingLoading, setAddingLoading] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const [newDepartment, setNewDepartment] = useState({
    name: '',
    description: ''
  });

  const [editDepartment, setEditDepartment] = useState({
    name: '',
    description: ''
  });


  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setDepartmentsLoading(true);
      const data = await departmentsAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        ...(searchTerm && { search: searchTerm })
      });

      if (data.success) {
        setDepartments(data.data.departments);
        setPagination(data.data.pagination);
        setDepartmentsLoading(false);
      } else {
        toast.error(data.message || 'Failed to fetch departments');
        setDepartmentsLoading(false);
      }
    } catch (error) {
      toast.error('Failed to connect to server');
      setDepartmentsLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [currentPage]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (currentPage === 1) {
        fetchDepartments();
      } else {
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  const handleAddDepartment = async () => {
    if (!newDepartment.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    try {
      setAddingLoading(true);
      setLoading(true);
      const data = await departmentsAPI.create(newDepartment);

      if (data.success) {
        toast.success('Department added successfully!');
        setNewDepartment({ name: '', description: '' });
        setShowAddModal(false);
        fetchDepartments();
      } else {
        toast.error(data.message || 'Failed to add department');
      }
    } catch (error) {
      toast.error('Failed to connect to server');
    } finally {
      setAddingLoading(false);
      setLoading(false);
    }
  };

  const handleEditDepartment = async () => {
    if (!editDepartment.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    try {
      setEditingLoading(true);
      setLoading(true);
      const data = await departmentsAPI.update(editingDepartment.id, editDepartment);

      if (data.success) {
        toast.success('Department updated successfully!');
        setEditDepartment({ name: '', description: '' });
        setEditingDepartment(null);
        setShowEditModal(false);
        fetchDepartments();
      } else {
        toast.error(data.message || 'Failed to update department');
      }
    } catch (error) {
      toast.error('Failed to connect to server');
    } finally {
      setEditingLoading(false);
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async () => {
    try {
      setDeletingLoading(true);
      setLoading(true);
      const data = await departmentsAPI.delete(deletingDepartment.id);

      if (data.success) {
        toast.success('Department deleted successfully!');
        setDeletingDepartment(null);
        setShowDeleteModal(false);
        fetchDepartments();
      } else {
        toast.error(data.message || 'Failed to delete department');
      }
    } catch (error) {
      toast.error('Failed to connect to server');
    } finally {
      setDeletingLoading(false);
      setLoading(false);
    }
  };

  const openEditModal = (department) => {
    setEditingDepartment(department);
    setEditDepartment({
      name: department.name,
      description: department.description || ''
    });
    setShowEditModal(true);
    setShowActionMenu(null);
  };

  const openDeleteModal = (department) => {
    setDeletingDepartment(department);
    setShowDeleteModal(true);
    setShowActionMenu(null);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getEmployeeCount = (department) => {
    return department._count?.users || department.employeeCount || 0;
  };

  return (
    <div className="space-y-6">
      {loading && <Loading size={80} bg="bg-black/20" />}
      {/* Header */}
      <div className="bg-white rounded-2xl p-8 text-slate-800 shadow-lg relative overflow-hidden border border-slate-200">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2 text-slate-900">Department Management</h2>
          <p className="text-slate-600 mb-6 text-lg">Manage organizational departments and their structures</p>
          
          <div className="flex gap-4">
            <Button 
              icon={Plus} 
              onClick={() => setShowAddModal(true)}
              className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
            >
              Add Department
            </Button>
          </div>
        </div>
        <Building2 className="absolute -right-8 -bottom-8 text-slate-200 w-64 h-64 rotate-12" />
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-1">
          <h3 className="font-semibold text-slate-800 mb-4">Total Departments</h3>
          <div className="text-3xl font-bold text-[#C4009A] mb-2">
            {pagination.total}
          </div>
          <p className="text-sm text-slate-500">Active departments</p>
        </Card>

        <Card className="p-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search departments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Departments Table */}
      <Card className="p-6 overflow-hidden">
        {departmentsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin text-[#C4009A]" size={24} />
              <span className="text-slate-600">Loading departments...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-6 py-3">Department Name</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Employees</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Last Updated</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                        No departments found
                      </td>
                    </tr>
                  ) : (
                    departments.map((department) => (
                      <tr key={department.id} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium">{department.name}</td>
                        <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{department.description || '-'}</td>
                        <td className="px-6 py-4">
                          <Badge color="info">{getEmployeeCount(department)}</Badge>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{formatDate(department.createdAt)}</td>
                        <td className="px-6 py-4 text-slate-600">{formatDate(department.updatedAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(department)}
                              className="px-3 py-1 text-xs"
                            >
                              <Edit size={12} className="mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteModal(department)}
                              className="px-3 py-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 size={12} className="mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} departments
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={pagination.page === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className={pagination.page === page ? "bg-[#C4009A] hover:bg-[#C4009A]/90 text-white" : ""}
                    >
                      {page}
                    </Button>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add Department Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add New Department</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewDepartment({ name: '', description: '' });
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department Name *</label>
                <input
                  type="text"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter department name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newDepartment.description}
                  onChange={(e) => setNewDepartment({ ...newDepartment, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter department description"
                  rows="3"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setNewDepartment({ name: '', description: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddDepartment}
                disabled={!newDepartment.name.trim() || addingLoading}
                className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
              >
                {addingLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Adding...
                  </>
                ) : (
                  'Add Department'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Edit Department</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditDepartment({ name: '', description: '' });
                  setEditingDepartment(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Department Name *</label>
                <input
                  type="text"
                  value={editDepartment.name}
                  onChange={(e) => setEditDepartment({ ...editDepartment, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter department name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editDepartment.description}
                  onChange={(e) => setEditDepartment({ ...editDepartment, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter department description"
                  rows="3"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setEditDepartment({ name: '', description: '' });
                  setEditingDepartment(null);
                }}
                disabled={editingLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditDepartment}
                disabled={!editDepartment.name.trim() || editingLoading}
                className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
              >
                {editingLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Updating...
                  </>
                ) : (
                  'Update Department'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Delete Department</h2>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-4">
                Are you sure you want to delete the department "<strong>{deletingDepartment?.name}</strong>"?
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
                  setDeletingDepartment(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteDepartment}
                className="bg-red-600 text-white hover:bg-red-700 border-none"
              >
                Delete Department
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
