import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  Calendar, Plus, X, Edit, Trash2, MapPin, Clock, Users,
  Search, Filter, ChevronDown, Eye, AlertCircle, CheckCircle, Loader2
} from 'lucide-react';
import { eventsAPI } from '../../api/events';
import { usersAPI } from '../../api/users';
import { notificationsAPI } from '../../api/notifications';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import SearchableDropdown from '../../components/SearchableDropdown';
import DatePicker from '../../components/DatePicker';
import Loading from '../../components/Loading';

const THEME = {
  gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
};


const Events = ({ userRole }) => {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 5, total: 0, pages: 0 });
  const [stats, setStats] = useState({ totalEvents: 0, upcomingEvents: 0, completedEvents: 0, thisMonthEvents: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [showViewEventModal, setShowViewEventModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [viewingEvent, setViewingEvent] = useState(null);

  // Individual loading states for different operations
  const [eventsLoading, setEventsLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [addingLoading, setAddingLoading] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const [newEvent, setNewEvent] = useState({
    title: '', description: '', date: '', time: '', location: '',
    category: 'meeting', maxAttendees: '', organizer: '', status: 'upcoming', imageUrl: ''
  });
  const [imagePreview, setImagePreview] = useState('');
  const [editImagePreview, setEditImagePreview] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setEventsLoading(true);
    try {
      const data = await eventsAPI.getAll({
        page: currentPage,
        limit: itemsPerPage,
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(debouncedSearch && { search: debouncedSearch })
      });

      if (data.success) {
        setEvents(data.data.events);
        setPagination(data.data.pagination);
        setEventsLoading(false);
      } else {
        toast.error(data.message || 'Failed to fetch events');
        setEventsLoading(false);
      }
    } catch (error) {
      toast.error('Failed to connect to server');
      setEventsLoading(false);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterStatus, debouncedSearch]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setStatsLoading(true);
    try {
      const response = await eventsAPI.getStats();
      if (response.success) {
        setStats({
          totalEvents: response.data.totalEvents,
          upcomingEvents: response.data.upcomingEvents,
          completedEvents: response.data.completedEvents,
          thisMonthEvents: response.data.thisMonthEvents
        });
        setStatsLoading(false);
      } else {
        setStatsLoading(false);
      }
    } catch (error) {
      setStatsLoading(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, [fetchEvents, fetchStats]);

  // Image handling functions
  const handleImageUpload = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (isEdit) {
          setEditImagePreview(result);
          setEditingEvent(prev => ({ ...prev, imageUrl: result }));
        } else {
          setImagePreview(result);
          setNewEvent(prev => ({ ...prev, imageUrl: result }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (isEdit = false) => {
    if (isEdit) {
      setEditImagePreview('');
      setEditingEvent(prev => ({ ...prev, imageUrl: '' }));
    } else {
      setImagePreview('');
      setNewEvent(prev => ({ ...prev, imageUrl: '' }));
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.date) {
      toast.error('Title and date are required');
      return;
    }

    // Validate date is not in the past
    const selectedDate = new Date(newEvent.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    if (selectedDate < today) {
      toast.error('Event date cannot be in the past');
      return;
    }

    try {
      setAddingLoading(true);
      setLoading(true);
      const formData = new FormData();
      formData.append('title', newEvent.title);
      formData.append('description', newEvent.description);
      formData.append('category', newEvent.category);
      formData.append('date', newEvent.date);
      formData.append('time', newEvent.time);
      formData.append('maxAttendees', newEvent.maxAttendees);
      formData.append('location', newEvent.location);
      formData.append('organizer', newEvent.organizer);
      formData.append('status', newEvent.status);

      // Only append image if it exists
      if (newEvent.imageUrl && newEvent.imageUrl.startsWith('data:')) {
        const blob = await fetch(newEvent.imageUrl).then(r => r.blob());
        formData.append('image', blob, 'event-image.jpg');
      }

      const data = await eventsAPI.create(formData);
      if (data.success) {
        try {
          const usersData = await usersAPI.getAll({ limit: 1000 });
          
          if (usersData.success && usersData.data.users) {
            await Promise.all(
              usersData.data.users.map(user =>
                notificationsAPI.create({
                  title: 'New Event Added',
                  message: `New event "${newEvent.title}" has been added`,
                  type: 'info',
                  userId: user.id
                })
              )
            );
          }
        } catch (notificationError) {
        }

        toast.success('Event added successfully!');
        setShowAddEventModal(false);
        setNewEvent({ title: '', description: '', date: '', time: '', location: '', category: 'meeting', maxAttendees: '', organizer: '', status: 'upcoming', imageUrl: '' });
        setImagePreview('');

        // Optimistic update - add new event to local state immediately
        const newEventData = {
          ...newEvent,
          id: data.data.id,
          imageUrl: data.data.imageUrl,
          createdAt: new Date().toISOString()
        };
        setEvents(prev => [newEventData, ...prev]);
        setStats(prev => ({
          ...prev,
          totalEvents: prev.totalEvents + 1
        }));

        // Then fetch to sync with server
        fetchEvents();
        fetchStats();
      } else {
        toast.error(data.message || 'Failed to add event');
      }
    } catch (error) {
      toast.error('Failed to add event');
    } finally {
      setAddingLoading(false);
      setLoading(false);
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent({ ...event });
    setEditImagePreview('');
    setShowEditEventModal(true);
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent.title.trim() || !editingEvent.date) {
      toast.error('Title and date are required');
      return;
    }

    // Validate date is not in the past
    const selectedDate = new Date(editingEvent.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    if (selectedDate < today) {
      toast.error('Event date cannot be in the past');
      return;
    }

    try {
      setEditingLoading(true);
      setLoading(true);
      const formData = new FormData();
      formData.append('title', editingEvent.title);
      formData.append('description', editingEvent.description);
      formData.append('category', editingEvent.category);
      formData.append('date', editingEvent.date);
      // Only append time if it's valid
      if (editingEvent.time && editingEvent.time !== 'Invalid Date') {
        formData.append('time', editingEvent.time);
      }
      formData.append('maxAttendees', editingEvent.maxAttendees);
      formData.append('location', editingEvent.location);
      formData.append('organizer', editingEvent.organizer);
      formData.append('status', editingEvent.status);

      // Only append image if it's a new image (data URL)
      if (editingEvent.imageUrl && editingEvent.imageUrl.startsWith('data:')) {
        const blob = await fetch(editingEvent.imageUrl).then(r => r.blob());
        formData.append('image', blob, 'event-image.jpg');
      }

      const data = await eventsAPI.update(editingEvent.id, formData);
      if (data.success) {
        try {
          const usersData = await usersAPI.getAll({ limit: 1000 });
          
          if (usersData.success && usersData.data.users) {
            await Promise.all(
              usersData.data.users.map(user =>
                notificationsAPI.create({
                  title: 'Event Updated',
                  message: `Event "${editingEvent.title}" has been updated`,
                  type: 'info',
                  userId: user.id
                })
              )
            );
          }
        } catch (notificationError) {
        }

        toast.success('Event updated successfully!');
        setShowEditEventModal(false);
        setEditingEvent(null);
        setEditImagePreview('');

        // Optimistic update - update event in local state immediately
        setEvents(prev => prev.map(event =>
          event.id === editingEvent.id ? { ...event, ...data.data } : event
        ));

        // Then fetch to sync with server
        fetchEvents();
        fetchStats();
      } else {
        toast.error(data.message || 'Failed to update event');
      }
    } catch (error) {
      toast.error('Failed to update event');
    } finally {
      setEditingLoading(false);
      setLoading(false);
    }
  };

  const handleDeleteEvent = (event) => {
    setDeletingEvent(event);
    setShowDeleteModal(true);
  };

  const confirmDeleteEvent = async () => {
    if (!deletingEvent) return;

    try {
      setDeletingLoading(true);
      setLoading(true);
      
      const data = await eventsAPI.delete(deletingEvent.id);
      
      if (data.success) {
        try {
          const usersData = await usersAPI.getAll({ limit: 1000 });
          
          if (usersData.success && usersData.data.users) {
            await Promise.all(
              usersData.data.users.map(user =>
                notificationsAPI.create({
                  title: 'Event Cancelled',
                  message: `Event "${deletingEvent.title}" has been cancelled`,
                  type: 'warning',
                  userId: user.id
                })
              )
            );
          }
        } catch (notificationError) {
        }

        toast.success('Event deleted successfully!');
        setShowDeleteModal(false);
        setDeletingEvent(null);

        // Optimistic update - remove event from local state immediately
        setEvents(prev => prev.filter(event => event.id !== deletingEvent.id));

        // Then fetch to sync with server
        fetchEvents();
        fetchStats();
      } else {
        toast.error(data.message || 'Failed to delete event');
      }
    } catch (error) {
      toast.error('Failed to delete event');
    } finally {
      setDeletingLoading(false);
      setLoading(false);
    }
  };

  const handleViewEvent = (event) => {
    setViewingEvent(event);
    setShowViewEventModal(true);
  };

  const getCategoryColor = (category) => {
    const colors = { meeting: 'brand', workshop: 'warning', conference: 'success', corporate: 'info', social: 'rose', training: 'indigo', business: 'emerald', wellness: 'sky' };
    return colors[category] || 'default';
  };

  const getStatusColor = (status) => {
    const colors = { upcoming: 'success', ongoing: 'warning', completed: 'default', cancelled: 'danger' };
    return colors[status] || 'default';
  };

  const handlePageChange = (page) => setCurrentPage(page);

  return (
    <div className="space-y-6">
      {loading && <Loading size={80} bg="bg-black/20" />}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events Management</h1>
          <p className="text-slate-600 mt-1">Create and manage company events and activities</p>
        </div>
        <div className="flex gap-2">
          <Button icon={Plus} onClick={() => setShowAddEventModal(true)}>Add Event</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Events</p>
                <p className="text-2xl font-bold text-slate-900">{loading ? '...' : stats.totalEvents}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-lg"><Calendar size={20} className="text-slate-600" /></div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Upcoming</p>
                <p className="text-2xl font-bold text-blue-600">{loading ? '...' : stats.upcomingEvents}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg"><Clock size={20} className="text-blue-600" /></div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{loading ? '...' : stats.completedEvents}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg"><CheckCircle size={20} className="text-green-600" /></div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Capacity</p>
                <p className="text-2xl font-bold text-slate-900">{loading ? '...' : events.reduce((sum, e) => sum + (e.maxAttendees || 0), 0)}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-lg"><Users size={20} className="text-slate-600" /></div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">This Month</p>
                <p className="text-2xl font-bold text-amber-600">{loading ? '...' : stats.thisMonthEvents}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg"><Calendar size={20} className="text-amber-600" /></div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <SearchableDropdown
              options={[
                { id: 'upcoming', name: 'Upcoming' },
                { id: 'ongoing', name: 'Ongoing' },
                { id: 'completed', name: 'Completed' },
                { id: 'cancelled', name: 'Cancelled' }
              ]}
              value={filterStatus}
              onChange={(value) => { setFilterStatus(value); setCurrentPage(1); }}
              placeholder="All Status"
              allOptionLabel="All Status"
              className="w-48"
            />
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {eventsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin text-[#C4009A]" size={24} />
              <span className="text-slate-600">Loading events...</span>
            </div>
          </div>
        ) : events.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600">No events found</p>
          </Card>
        ) : (
          events.map((event) => (
            <Card key={event.id} className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-slate-800">{event.title}</h3>
                    <Badge color={getCategoryColor(event.category)}>{event.category}</Badge>
                    <Badge color={getStatusColor(event.status)}>{event.status}</Badge>
                  </div>
                  <p className="text-slate-600 mb-4">{event.description}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-600 truncate">{new Date(event.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-600 truncate">{event.time || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-600 truncate">{event.location || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-600">{event.maxAttendees || '-'}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-slate-500">Organized by: {event.organizer || '-'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-col sm:gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="sm" icon={Eye} onClick={() => handleViewEvent(event)} className="flex-1 sm:flex-none">View</Button>
                  <Button variant="outline" size="sm" icon={Edit} onClick={() => handleEditEvent(event)} className="flex-1 sm:flex-none">Edit</Button>
                  <Button variant="outline" size="sm" icon={Trash2} onClick={() => handleDeleteEvent(event)} className="flex-1 sm:flex-none">Delete</Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            Showing {((pagination.page - 1) * itemsPerPage) + 1} to {Math.min(pagination.page * itemsPerPage, pagination.total)} of {pagination.total} events
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</Button>
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
              <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => handlePageChange(page)} className={currentPage === page ? "bg-[#C4009A] hover:bg-[#C4009A]/90 text-white" : ""}>{page}</Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === pagination.pages}>Next</Button>
          </div>
        </div>
      )}

      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add New Event</h2>
              <button onClick={() => setShowAddEventModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Event Title *</label>
                  <input type="text" value={newEvent.title} onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Enter event title" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                  <SearchableDropdown
                    options={[
                      { id: 'meeting', name: 'Meeting' },
                      { id: 'workshop', name: 'Workshop' },
                      { id: 'conference', name: 'Conference' },
                      { id: 'corporate', name: 'Corporate' },
                      { id: 'social', name: 'Social' },
                      { id: 'training', name: 'Training' },
                      { id: 'business', name: 'Business' },
                      { id: 'wellness', name: 'Wellness' }
                    ]}
                    value={newEvent.category}
                    onChange={(value) => setNewEvent(prev => ({ ...prev, category: value }))}
                    placeholder="Select Category"
                    showAllOption={false}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea value={newEvent.description} onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" rows={3} placeholder="Enter event description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Event Image</label>
                <div className="space-y-3">
                  {(imagePreview || newEvent.imageUrl) ? (
                    <div className="relative">
                      <img
                        src={imagePreview || newEvent.imageUrl}
                        alt="Event preview"
                        className="w-full h-48 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(false)}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[#C4009A] transition-colors">
                      <div className="space-y-2">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                          <Calendar size={24} className="text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Click to upload event image</p>
                          <p className="text-xs text-slate-400">PNG, JPG, GIF up to 5MB</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, false)}
                          className="hidden"
                          id="event-image-upload"
                        />
                        <label
                          htmlFor="event-image-upload"
                          className="inline-flex items-center px-4 py-2 bg-[#C4009A] text-white text-sm font-medium rounded-lg hover:bg-[#C4009A]/90 transition-colors cursor-pointer"
                        >
                          Choose Image
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                  <DatePicker
                    selectedDate={newEvent.date}
                    onDateSelect={(date) => setNewEvent(prev => ({ ...prev, date }))}
                    placeholder="Select event date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
                  <input type="time" value={newEvent.time} onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Max Attendees</label>
                  <input type="number" value={newEvent.maxAttendees} onChange={(e) => setNewEvent(prev => ({ ...prev, maxAttendees: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Maximum attendees" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                  <input type="text" value={newEvent.location} onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Event location" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Organizer</label>
                  <input type="text" value={newEvent.organizer} onChange={(e) => setNewEvent(prev => ({ ...prev, organizer: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Event organizer" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <SearchableDropdown
                  options={[
                    { id: 'upcoming', name: 'Upcoming' },
                    { id: 'ongoing', name: 'Ongoing' },
                    { id: 'completed', name: 'Completed' },
                    { id: 'cancelled', name: 'Cancelled' }
                  ]}
                  value={newEvent.status}
                  onChange={(value) => setNewEvent(prev => ({ ...prev, status: value }))}
                  placeholder="Select Status"
                  showAllOption={false}
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddEventModal(false)}>Cancel</Button>
              <Button onClick={handleAddEvent}>Add Event</Button>
            </div>
          </div>
        </div>
      )}

      {showEditEventModal && editingEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Edit Event</h2>
              <button onClick={() => setShowEditEventModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Event Title *</label>
                  <input type="text" value={editingEvent.title} onChange={(e) => setEditingEvent(prev => ({ ...prev, title: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Enter event title" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                  <SearchableDropdown
                    options={[
                      { id: 'meeting', name: 'Meeting' },
                      { id: 'workshop', name: 'Workshop' },
                      { id: 'conference', name: 'Conference' },
                      { id: 'corporate', name: 'Corporate' },
                      { id: 'social', name: 'Social' },
                      { id: 'training', name: 'Training' },
                      { id: 'business', name: 'Business' },
                      { id: 'wellness', name: 'Wellness' }
                    ]}
                    value={editingEvent.category}
                    onChange={(value) => setEditingEvent(prev => ({ ...prev, category: value }))}
                    placeholder="Select Category"
                    showAllOption={false}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea value={editingEvent.description || ''} onChange={(e) => setEditingEvent(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" rows={3} placeholder="Enter event description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Event Image</label>
                <div className="space-y-3">
                  {(editImagePreview || editingEvent.imageUrl) ? (
                    <div className="relative">
                      <img
                        src={editImagePreview || (editingEvent.imageUrl && editingEvent.imageUrl.startsWith('http') ? editingEvent.imageUrl : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${editingEvent.imageUrl}`)}
                        alt="Event preview"
                        className="w-full h-48 object-cover rounded-lg border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(true)}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[#C4009A] transition-colors">
                      <div className="space-y-2">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                          <Calendar size={24} className="text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Click to upload event image</p>
                          <p className="text-xs text-slate-400">PNG, JPG, GIF up to 5MB</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, true)}
                          className="hidden"
                          id="edit-event-image-upload"
                        />
                        <label
                          htmlFor="edit-event-image-upload"
                          className="inline-flex items-center px-4 py-2 bg-[#C4009A] text-white text-sm font-medium rounded-lg hover:bg-[#C4009A]/90 transition-colors cursor-pointer"
                        >
                          Choose Image
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                  <DatePicker
                    selectedDate={editingEvent.date ? editingEvent.date.split('T')[0] : ''}
                    onDateSelect={(date) => setEditingEvent(prev => ({ ...prev, date }))}
                    placeholder="Select event date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
                  <input type="time" value={editingEvent.time || ''} onChange={(e) => setEditingEvent(prev => ({ ...prev, time: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Max Attendees</label>
                  <input type="number" value={editingEvent.maxAttendees || ''} onChange={(e) => setEditingEvent(prev => ({ ...prev, maxAttendees: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Maximum attendees" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                  <input type="text" value={editingEvent.location || ''} onChange={(e) => setEditingEvent(prev => ({ ...prev, location: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Event location" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Organizer</label>
                  <input type="text" value={editingEvent.organizer || ''} onChange={(e) => setEditingEvent(prev => ({ ...prev, organizer: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Event organizer" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <SearchableDropdown
                  options={[
                    { id: 'upcoming', name: 'Upcoming' },
                    { id: 'ongoing', name: 'Ongoing' },
                    { id: 'completed', name: 'Completed' },
                    { id: 'cancelled', name: 'Cancelled' }
                  ]}
                  value={editingEvent.status}
                  onChange={(value) => setEditingEvent(prev => ({ ...prev, status: value }))}
                  placeholder="Select Status"
                  showAllOption={false}
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEditEventModal(false)}>Cancel</Button>
              <Button onClick={handleUpdateEvent}>Update Event</Button>
            </div>
          </div>
        </div>
      )}

      {showViewEventModal && viewingEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Event Details</h2>
              <button onClick={() => setShowViewEventModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              {viewingEvent.imageUrl && (
                <div className="w-full">
                  <img src={viewingEvent.imageUrl.startsWith('http') ? viewingEvent.imageUrl : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${viewingEvent.imageUrl}`} alt={viewingEvent.title} className="w-full h-80 object-cover rounded-lg border border-slate-200" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-2xl font-bold text-slate-800">{viewingEvent.title}</h3>
                  <Badge color={getCategoryColor(viewingEvent.category)}>{viewingEvent.category}</Badge>
                  <Badge color={getStatusColor(viewingEvent.status)}>{viewingEvent.status}</Badge>
                </div>
                <p className="text-slate-600">{viewingEvent.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-fuchsia-50 text-[#C4009A] flex items-center justify-center"><Calendar size={20} /></div>
                    <div><p className="text-sm text-slate-500">Date</p><p className="font-medium text-slate-800">{new Date(viewingEvent.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
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
              <Button onClick={() => setShowViewEventModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingEvent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Delete Event</h2>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-4">
                Are you sure you want to delete the event <strong>"{deletingEvent.title}"</strong>?
              </p>

              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="mb-3">
                  <h4 className="font-medium text-slate-800 mb-2">{deletingEvent.title}</h4>
                  <p className="text-sm text-slate-600 mb-2">{deletingEvent.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>
                    <strong>Date:</strong> {new Date(deletingEvent.date).toLocaleDateString()}
                  </div>
                  <div>
                    <strong>Time:</strong> {deletingEvent.time || '-'}
                  </div>
                  <div>
                    <strong>Location:</strong> {deletingEvent.location || '-'}
                  </div>
                  <div>
                    <strong>Organizer:</strong> {deletingEvent.organizer || '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteEvent}
                disabled={isDeleting}
                className="bg-red-600 text-white hover:bg-red-700 border-none"
              >
                {isDeleting ? 'Deleting...' : 'Delete Event'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">Add Event</h2>
              <button onClick={() => setShowAddEventModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={20} className="text-slate-500" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Title</label>
                <input type="text" value={newEvent.title || ''} onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Enter event title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                <SearchableDropdown
                  options={[
                    { id: 'meeting', name: 'Meeting' },
                    { id: 'workshop', name: 'Workshop' },
                    { id: 'conference', name: 'Conference' },
                    { id: 'corporate', name: 'Corporate' },
                    { id: 'social', name: 'Social' },
                    { id: 'training', name: 'Training' },
                    { id: 'business', name: 'Business' },
                    { id: 'wellness', name: 'Wellness' }
                  ]}
                  value={newEvent.category}
                  onChange={(value) => setNewEvent(prev => ({ ...prev, category: value }))}
                  placeholder="Select Category"
                  showAllOption={false}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea value={newEvent.description || ''} onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" rows={3} placeholder="Enter event description" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Event Image</label>
                <div className="space-y-3">
                  {(imagePreview || (newEvent.imageUrl && !newEvent.imageUrl.startsWith('data:'))) ? (
                    <div className="relative">
                      <img src={imagePreview || `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'}${newEvent.imageUrl}`} alt="Event preview" className="w-full h-48 object-cover rounded-lg border border-slate-200" />
                      <button type="button" onClick={() => {
                        setImagePreview('');
                        setNewEvent(prev => ({ ...prev, imageUrl: '' }));
                      }} className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-[#C4009A]">
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast.error('Image size should be less than 5MB');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setImagePreview(reader.result);
                            setNewEvent(prev => ({ ...prev, imageUrl: reader.result }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }} className="hidden" id="new-event-image-upload" />
                      <label htmlFor="new-event-image-upload" className="inline-flex items-center px-4 py-2 bg-[#C4009A] text-white text-sm font-medium rounded-lg hover:bg-[#C4009A]/90 cursor-pointer">Choose Image</label>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Date *</label>
                  <DatePicker
                    selectedDate={newEvent.date ? newEvent.date.split('T')[0] : ''}
                    onDateSelect={(date) => setNewEvent(prev => ({ ...prev, date }))}
                    placeholder="Select event date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
                  <input type="time" value={newEvent.time || ''} onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Max Attendees</label>
                  <input type="number" value={newEvent.maxAttendees || ''} onChange={(e) => setNewEvent(prev => ({ ...prev, maxAttendees: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Maximum attendees" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
                  <input type="text" value={newEvent.location || ''} onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Event location" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Organizer</label>
                  <input type="text" value={newEvent.organizer || ''} onChange={(e) => setNewEvent(prev => ({ ...prev, organizer: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-[#C4009A]" placeholder="Event organizer" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <SearchableDropdown
                  options={[
                    { id: 'upcoming', name: 'Upcoming' },
                    { id: 'ongoing', name: 'Ongoing' },
                    { id: 'completed', name: 'Completed' },
                    { id: 'cancelled', name: 'Cancelled' }
                  ]}
                  value={newEvent.status}
                  onChange={(value) => setNewEvent(prev => ({ ...prev, status: value }))}
                  placeholder="Select Status"
                  showAllOption={false}
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowAddEventModal(false)}>Cancel</Button>
              <Button
                onClick={handleAddEvent}
                disabled={addingLoading}
                className="bg-[#C4009A] text-white hover:bg-[#7E006C] border-none"
              >
                {addingLoading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Adding...
                  </>
                ) : (
                  'Add Event'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
