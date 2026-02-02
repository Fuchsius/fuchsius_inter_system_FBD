import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, Plus, Edit, Trash2, Search, X, Loader2
} from 'lucide-react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Loading from '../../components/Loading';
import { toast } from 'react-toastify';
import { positionsAPI } from '../../api/positions';


const Positions = () => {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [deletingPosition, setDeletingPosition] = useState(null);

  const [newPosition, setNewPosition] = useState({ name: '', description: '' });
  const [editPosition, setEditPosition] = useState({ name: '', description: '' });

  const itemsPerPage = 10;

  // Individual loading states for different operations
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [addingLoading, setAddingLoading] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setPositionsLoading(true);
    try {
      const data = await positionsAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        ...(debouncedSearch && { search: debouncedSearch })
      });

      if (data.success) {
        setPositions(data.data.positions);
        setPagination(data.data.pagination);
        setPositionsLoading(false);
      } else {
        toast.error(data.message || 'Failed to fetch positions');
        setPositionsLoading(false);
      }
    } catch (error) {
      toast.error('Failed to connect to server');
      setPositionsLoading(false);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const getEmployeeCount = (position) => position._count?.users ?? 0;

  const handleAddPosition = async () => {
    if (!newPosition.name.trim()) {
      toast.error('Position name is required');
      return;
    }

    try {
      setAddingLoading(true);
      setLoading(true);
      const data = await positionsAPI.create(newPosition);

      if (data.success) {
        toast.success('Position added successfully!');
        setNewPosition({ name: '', description: '' });
        setShowAddModal(false);
        fetchPositions();
      } else {
        toast.error(data.message || 'Failed to add position');
      }
    } catch (error) {
      toast.error('Failed to add position');
    } finally {
      setAddingLoading(false);
      setLoading(false);
    }
  };

  const handleEditPosition = async () => {
    if (!editPosition.name.trim()) {
      toast.error('Position name is required');
      return;
    }

    try {
      setEditingLoading(true);
      setLoading(true);
      const data = await positionsAPI.update(editingPosition.id, editPosition);

      if (data.success) {
        toast.success('Position updated successfully!');
        setEditPosition({ name: '', description: '' });
        setEditingPosition(null);
        setShowEditModal(false);
        fetchPositions();
      } else {
        toast.error(data.message || 'Failed to update position');
      }
    } catch (error) {
      toast.error('Failed to update position');
    } finally {
      setEditingLoading(false);
      setLoading(false);
    }
  };

  const handleDeletePosition = async () => {
    try {
      setDeletingLoading(true);
      setLoading(true);
      const data = await positionsAPI.delete(deletingPosition.id);

      if (data.success) {
        toast.success('Position deleted successfully!');
        setDeletingPosition(null);
        setShowDeleteModal(false);
        fetchPositions();
      } else {
        toast.error(data.message || 'Failed to delete position');
      }
    } catch (error) {
      toast.error('Failed to delete position');
    } finally {
      setDeletingLoading(false);
      setLoading(false);
    }
  };

  const openEditModal = (position) => {
    setEditingPosition(position);
    setEditPosition({ name: position.name, description: position.description || '' });
    setShowEditModal(true);
  };

  const openDeleteModal = (position) => {
    setDeletingPosition(position);
    setShowDeleteModal(true);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const filteredPositions = positions;
  const totalPages = pagination.pages || Math.ceil(pagination.total / itemsPerPage);
  const startIndex = (pagination.page - 1) * itemsPerPage;

  return (
    <div className="space-y-6">
      {loading && <Loading size={80} bg="bg-black/20" />}
      <div className="bg-white rounded-2xl p-8 text-slate-800 shadow-lg relative overflow-hidden border border-slate-200">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-2 text-slate-900">Position Management</h2>
          <p className="text-slate-600 mb-6 text-lg">Manage job positions and their descriptions</p>
          
          <div className="flex gap-4">
            <Button 
              icon={Plus} 
              onClick={() => setShowAddModal(true)}
              className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
            >
              Add Position
            </Button>
          </div>
        </div>
        <Briefcase className="absolute -right-8 -bottom-8 text-slate-200 w-64 h-64 rotate-12" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-1">
          <h3 className="font-semibold text-slate-800 mb-4">Total Positions</h3>
          <div className="text-3xl font-bold text-[#C4009A] mb-2">
            {loading ? '...' : pagination.total}
          </div>
          <p className="text-sm text-slate-500">Active positions</p>
        </Card>

        <Card className="p-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search positions..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
              />
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 overflow-hidden">
        {positionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin text-[#C4009A]" size={24} />
              <span className="text-slate-600">Loading positions...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-6 py-3">Position Name</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Employees</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Last Updated</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPositions.map((position) => (
                    <tr key={position.id} className="border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium">{position.name}</td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{position.description}</td>
                      <td className="px-6 py-4">
                        <Badge color="info">{getEmployeeCount(position)}</Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {position.createdAt ? new Date(position.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {position.updatedAt ? new Date(position.updatedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(position)}
                            className="px-3 py-1 text-xs"
                          >
                            <Edit size={12} className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteModal(position)}
                            className="px-3 py-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 size={12} className="mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, pagination.total)} of {pagination.total} positions
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
          </>
        )}
      </Card>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add New Position</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewPosition({ name: '', description: '' });
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Position Name *</label>
                <input
                  type="text"
                  value={newPosition.name}
                  onChange={(e) => setNewPosition({ ...newPosition, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter position name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newPosition.description}
                  onChange={(e) => setNewPosition({ ...newPosition, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter position description"
                  rows="3"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setNewPosition({ name: '', description: '' });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddPosition}
                disabled={!newPosition.name.trim() || addingLoading}
                className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
              >
                {addingLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Adding...
                  </>
                ) : (
                  'Add Position'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Edit Position</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditPosition({ name: '', description: '' });
                  setEditingPosition(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Position Name *</label>
                <input
                  type="text"
                  value={editPosition.name}
                  onChange={(e) => setEditPosition({ ...editPosition, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter position name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={editPosition.description}
                  onChange={(e) => setEditPosition({ ...editPosition, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#C4009A]"
                  placeholder="Enter position description"
                  rows="3"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditModal(false);
                  setEditPosition({ name: '', description: '' });
                  setEditingPosition(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditPosition}
                disabled={!editPosition.name.trim() || editingLoading}
                className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
              >
                {editingLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Updating...
                  </>
                ) : (
                  'Update Position'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Delete Position</h2>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-4">
                Are you sure you want to delete the position "<strong>{deletingPosition?.name}</strong>"?
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
                  setDeletingPosition(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeletePosition}
                className="bg-red-600 text-white hover:bg-red-700 border-none"
                disabled={deletingLoading}
              >
                {deletingLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Deleting...
                  </>
                ) : (
                  'Delete Position'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Positions;
