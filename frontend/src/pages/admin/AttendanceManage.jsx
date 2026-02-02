import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Users, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Download, Filter, Search, ChevronDown, X, UserPlus, Trash2, Edit, UserX, Loader2
} from 'lucide-react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import Badge from '../../components/Badge';
import SearchableDropdown from '../../components/SearchableDropdown';
import DatePicker from '../../components/DatePicker';
import Loading from '../../components/Loading';
import { toast } from 'react-toastify';
import { attendanceAPI } from '../../api/attendance';
import { usersAPI } from '../../api/users';
import { departmentsAPI } from '../../api/departments';
import { positionsAPI } from '../../api/positions';
import socketService from '../../services/socketService';

const ITEMS_PER_PAGE = 100;
const TIMEZONE = 'Asia/Colombo';

const getRecordTimestamp = (record) => {
    const sources = [record.createdAt, record.checkInTime, record.checkOutTime];
    for (const source of sources) {
        if (!source) continue;
        const dateObj = new Date(source);
        if (!Number.isNaN(dateObj.getTime())) {
            return dateObj.getTime();
        }
    }
    return 0;
};

const sortAttendanceRecords = (records) => {
    return [...records].sort((a, b) => {
        const dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        return getRecordTimestamp(b) - getRecordTimestamp(a);
    });
};

// Sri Lankan date functions for consistent date handling
const getSriLankaDate = () => {
    const now = new Date();
    // Use proper timezone conversion to avoid date issues
    const sriLankaDate = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));
    const year = sriLankaDate.getFullYear();
    const month = String(sriLankaDate.getMonth() + 1).padStart(2, '0');
    const day = String(sriLankaDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeToSriLankaDate = (dateValue) => {
    if (!dateValue) return '';
    try {
        const dateObj = new Date(dateValue);
        if (Number.isNaN(dateObj.getTime())) return '';
        const sriLankaDate = new Date(dateObj.toLocaleString('en-US', { timeZone: TIMEZONE }));
        const year = sriLankaDate.getFullYear();
        const month = String(sriLankaDate.getMonth() + 1).padStart(2, '0');
        const day = String(sriLankaDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
};

const formatSriLankaDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            timeZone: 'Asia/Colombo',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return '-';
    }
};

const formatDateTimeForDisplay = (dateTime) => {
    if (!dateTime) return '-';
    const date = new Date(dateTime);
    return date.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Colombo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const calculateWorkingHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '-';
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '-';
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
};

const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
};

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

// Memoized components
const StatusBadge = React.memo(({ status }) => {
    const badgeConfig = {
        present: { color: 'green', label: 'Present' },
        absent: { color: 'red', label: 'Absent' },
        complete: { color: 'green', label: 'Present' },
        incomplete: { color: 'amber', label: 'Incomplete' },
        leave: { color: 'blue', label: 'On Leave' }
    };
    const config = badgeConfig[status] || { color: 'slate', label: 'Unknown' };

    const iconConfig = {
        present: <CheckCircle size={16} className="text-green-500" />,
        absent: <XCircle size={16} className="text-red-500" />,
        complete: <CheckCircle size={16} className="text-green-500" />,
        incomplete: <AlertCircle size={16} className="text-amber-500" />,
        leave: <Calendar size={16} className="text-blue-500" />
    };
    const icon = iconConfig[status] || <AlertCircle size={16} className="text-slate-500" />;

    return (
        <div className="flex items-center gap-2">
            {icon}
            <Badge color={config.color}>
                {config.label}
            </Badge>
        </div>
    );
});

StatusBadge.displayName = 'StatusBadge';

const AttendanceRow = React.memo(({ record, onEdit, onDelete, showDate = true }) => (
    <tr className="hover:bg-slate-50/50 transition-colors">
        <td className="px-6 py-4">
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">
                        {formatLastActive(record.lastActiveAt)}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${record.isOnline ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                    {record.isOnline ? (
                        <span className="flex items-center text-xs text-green-600">
                            Online
                        </span>
                    ) : (
                        <span className="text-xs text-slate-400">
                            Offline
                        </span>
                    )}
                </div>
                {record.lastActiveAt && (
                    <span className="text-xs text-slate-400">
                        {new Date(record.lastActiveAt).toLocaleString()}
                    </span>
                )}
                {!record.lastActiveAt && (
                    <span className="text-xs text-slate-400">Never</span>
                )}
            </div>
        </td>
        <td className="px-6 py-4">
            <div className="flex items-center gap-3">
                <Avatar src={record.avatar} fallback={record.avatarFallback} size="sm" />
                <div>
                    <p className="font-medium text-slate-800">{record.userName}</p>
                    <p className="text-xs text-slate-500">{record.userEmail}</p>
                </div>
            </div>
        </td>
        <td className="px-6 py-4 text-slate-600">{record.role}</td>
        <td className="px-6 py-4 text-slate-600">{record.department}</td>
        {showDate && <td className="px-6 py-4 text-slate-600">{formatSriLankaDate(record.date)}</td>}
        <td className="px-6 py-4 text-slate-600">
            {formatDateTimeForDisplay(record.checkIn)}
        </td>
        <td className="px-6 py-4 text-slate-600">
            {formatDateTimeForDisplay(record.checkOut)}
        </td>
        <td className="px-6 py-4 text-slate-600">{calculateWorkingHours(record.checkIn, record.checkOut)}</td>
        <td className="px-6 py-4">
            <StatusBadge status={record.status} />
        </td>
        <td className="px-6 py-4">
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(record)}
                    className="px-3 py-1 text-xs"
                >
                    <Edit size={12} className="mr-1" />
                    Edit
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(record)}
                    className="px-3 py-1 text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                    <Trash2 size={12} className="mr-1" />
                    Delete
                </Button>
            </div>
        </td>
    </tr>
));

AttendanceRow.displayName = 'AttendanceRow';

const StatsCard = React.memo(({ title, value, color, icon: Icon }) => (
    <Card>
        <div className="p-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-600">{title}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
                <div className="p-3 bg-slate-100 rounded-lg">
                    <Icon size={20} className="text-slate-600" />
                </div>
            </div>
        </div>
    </Card>
));

StatsCard.displayName = 'StatsCard';

const AttendancePage = () => {
    // State management
    const [selectedDate, setSelectedDate] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedPosition, setSelectedPosition] = useState('all');
    const [positions, setPositions] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [attendanceData, setAttendanceData] = useState([]);
    const [availableEmployees, setAvailableEmployees] = useState([]);
    const [userStatusMap, setUserStatusMap] = useState({});
    const [departments, setDepartments] = useState(['all']);
    const [attendanceStats, setAttendanceStats] = useState({
        totalRecords: 0,
        presentRecords: 0,
        absentRecords: 0,
        completeRecords: 0,
        incompleteRecords: 0,
        attendanceRate: 0
    });
    const [isLoading, setIsLoading] = useState(false);

    // Individual loading states for different data sections
    const [attendanceLoading, setAttendanceLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [departmentsLoading, setDepartmentsLoading] = useState(true);
    const [positionsLoading, setPositionsLoading] = useState(true);

    // Modal states
    const [showMarkAttendanceModal, setShowMarkAttendanceModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Form states
    const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [editingRecord, setEditingRecord] = useState(null);
    const [deletingRecord, setDeletingRecord] = useState(null);
    const [editCheckIn, setEditCheckIn] = useState('');
    const [editCheckOut, setEditCheckOut] = useState('');
    const [editStatus, setEditStatus] = useState('');

    // Loading states
    const [isSavingAttendance, setIsSavingAttendance] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isMarkingAllAbsent, setIsMarkingAllAbsent] = useState(false);

    // Optimized data fetching with useCallback
    const fetchAttendance = useCallback(async () => {
        try {
            setIsLoading(true);
            setAttendanceLoading(true);
            setStatsLoading(true);
            setUsersLoading(true);
            setDepartmentsLoading(true);
            setPositionsLoading(true);
            const params = {
                limit: 10000, // Fetch all records for client-side filtering
                // Only send date parameter if a specific date is selected
                ...(selectedStatus !== 'all' && { status: selectedStatus })
            };

            const [attendanceRes, statsRes, usersRes, departmentsRes, positionsRes] = await Promise.all([
                attendanceAPI.getAll(params),
                attendanceAPI.getStats({ startDate: selectedDate, endDate: selectedDate }),
                usersAPI.getAll({ limit: 1000 }),
                departmentsAPI.getAll(),
                positionsAPI.getAll()
            ]);

            const latestUserStatusMap = usersRes.success
                ? usersRes.data.users.reduce((acc, user) => {
                    acc[user.id] = {
                        lastActiveAt: user.lastActiveAt,
                        isOnline: user.isOnline,
                        avatar: user.avatar
                    };
                    return acc;
                }, {})
                : {};
            setUserStatusMap(latestUserStatusMap);

            if (attendanceRes.success) {
                const formatted = attendanceRes.data.attendance.map(record => {
                    const normalizedDate = normalizeToSriLankaDate(record.date);
                    const statusInfo = latestUserStatusMap[record.user?.id || record.userId];
                    const userName = `${record.user?.firstName || ''} ${record.user?.lastName || ''}`.trim();
                    const avatarFallback = `${record.user?.firstName?.[0] || ''}${record.user?.lastName?.[0] || ''}`.trim() || 'U';

                    return {
                        id: record.id,
                        userId: record.user?.id,
                        userName,
                        userEmail: record.user?.email,
                        avatar: statusInfo?.avatar || record.user?.avatar,
                        avatarFallback,
                        role: record.user?.position?.name || record.user?.role || 'N/A',
                        department: record.user?.department?.name || 'N/A',
                        lastActiveAt: statusInfo?.lastActiveAt || record.user?.lastActiveAt,
                        isOnline: typeof statusInfo?.isOnline === 'boolean' ? statusInfo.isOnline : (record.user?.isOnline || false),
                        date: normalizedDate,
                        checkIn: record.checkInTime ? new Date(record.checkInTime) : null,
                        checkOut: record.checkOutTime ? new Date(record.checkOutTime) : null,
                        checkInTime: record.checkInTime,
                        checkOutTime: record.checkOutTime,
                        createdAt: record.createdAt || null,
                        status: record.checkInTime ? (record.checkOutTime ? 'complete' : 'incomplete') : 'absent'
                    };
                });
                setAttendanceData(formatted);
                setAttendanceLoading(false);
            }

            if (statsRes.success) {
                setAttendanceStats(statsRes.data);
                setStatsLoading(false);
            }

            if (usersRes.success) {
                const employees = usersRes.data.users.map(user => ({
                    id: user.id,
                    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
                    email: user.email,
                    role: user.position?.name || user.role || 'Employee',
                    department: user.department?.name || 'General',
                    avatar: `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.trim() || 'U'
                }));
                setAvailableEmployees(employees);
                setUsersLoading(false);
            }

            if (departmentsRes.success) {
                const deptList = departmentsRes.data.departments?.map((dept) => dept.name) || [];
                setDepartments(['all', ...deptList]);
                setDepartmentsLoading(false);
            }

            if (positionsRes.success) {
                const uniquePositions = [...new Set(positionsRes.data.positions.map(p => p.name))];
                setPositions(['all', ...uniquePositions]);
                setPositionsLoading(false);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load attendance data');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate, selectedStatus]);

    // Effects
    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDate, selectedStatus, selectedDepartment, searchTerm, selectedPosition]);

    // Handle user status updates - optimized with useCallback
    const handleUserStatus = useCallback((data) => {
        setAttendanceData(prevData => {
            return prevData.map(record => {
                if (record.userId === data.userId) {
                    return {
                        ...record,
                        lastActiveAt: data.lastActiveAt,
                        isOnline: data.type === 'online'
                    };
                }
                return record;
            });
        });
        setUserStatusMap(prev => ({
            ...prev,
            [data.userId]: {
                ...(prev[data.userId] || {}),
                lastActiveAt: data.lastActiveAt,
                isOnline: data.type === 'online'
            }
        }));
    }, []);

    // Handle real-time activity updates - optimized with useCallback
    const handleActivityUpdate = useCallback((data) => {
        setAttendanceData(prevData => {
            return prevData.map(record => {
                if (record.userId === data.userId) {
                    return {
                        ...record,
                        lastActiveAt: data.lastActiveAt,
                        isOnline: data.isOnline
                    };
                }
                return record;
            });
        });
        setUserStatusMap(prev => ({
            ...prev,
            [data.userId]: {
                ...(prev[data.userId] || {}),
                lastActiveAt: data.lastActiveAt,
                isOnline: data.isOnline
            }
        }));
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

    // Optimized employee filtering with useCallback
    const filterEmployees = useCallback((employees, searchTerm, selectedEmployeesList = []) => {
        return employees.filter(emp => {
            const isSelected = selectedEmployeesList.find(se => se.id === emp.id);
            if (isSelected) return false;

            if (!searchTerm) return true;

            const searchLower = searchTerm.toLowerCase();
            return (
                emp.name.toLowerCase().includes(searchLower) ||
                emp.id.toString().includes(searchLower) ||
                emp.role.toLowerCase().includes(searchLower) ||
                emp.email.toLowerCase().includes(searchLower) ||
                emp.department.toLowerCase().includes(searchLower)
            );
        });
    }, []);


    // Create combined view of all users with their attendance status
    const displayAttendance = useMemo(() => {
        const records = selectedDate
            ? attendanceData.filter(record => record.date === selectedDate)
            : attendanceData;
        const enrichedRecords = records.map(record => {
            const statusInfo = userStatusMap[record.userId];
            if (!statusInfo) return record;
            return {
                ...record,
                lastActiveAt: statusInfo.lastActiveAt ?? record.lastActiveAt,
                isOnline: typeof statusInfo.isOnline === 'boolean' ? statusInfo.isOnline : record.isOnline,
                avatar: statusInfo.avatar || record.avatar
            };
        });
        return sortAttendanceRecords(enrichedRecords);
    }, [attendanceData, selectedDate, userStatusMap]);

    // Client-side filtering for search and department (since backend doesn't support these)
    const filteredAttendance = useMemo(() => {
        return displayAttendance.filter(record => {
            const matchesSearch = !searchTerm ||
                record.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                record.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                record.role?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesDepartment = selectedDepartment === 'all' || record.department === selectedDepartment;
            const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
            const matchesDate = !selectedDate || record.date === selectedDate;
            const matchesPosition = selectedPosition === 'all' || record.role === selectedPosition;

            return matchesSearch && matchesDepartment && matchesStatus && matchesDate && matchesPosition;
        });
    }, [displayAttendance, searchTerm, selectedDepartment, selectedStatus, selectedDate, selectedPosition]);

    // Pagination is handled by the API
    const paginatedData = filteredAttendance;

    // Memoized stats
    const stats = useMemo(() => ({
        total: attendanceStats.totalRecords,
        present: attendanceStats.presentRecords,
        absent: attendanceStats.absentRecords,
        complete: attendanceStats.completeRecords,
        incomplete: attendanceStats.incompleteRecords,
        attendanceRate: attendanceStats.attendanceRate
    }), [attendanceStats]);

    // Optimized event handlers with useCallback
    const handleAddEmployee = useCallback((employee) => {
        if (!selectedEmployees.find(e => e.id === employee.id)) {
            const existingAttendance = attendanceData.find(
                record => record.userId === employee.id && record.date === selectedDate
            );

            if (existingAttendance) {
                toast.error(`${employee.name} already has attendance marked for ${selectedDate}`);
                return;
            }

            setSelectedEmployees(prev => [...prev, { ...employee, status: 'complete', checkIn: '', checkOut: '' }]);
        }
    }, [selectedEmployees, attendanceData, selectedDate]);

    const handleRemoveEmployee = useCallback((employeeId) => {
        setSelectedEmployees(prev => prev.filter(e => e.id !== employeeId));
    }, []);

    const handleEmployeeStatusChange = useCallback((employeeId, status) => {
        setSelectedEmployees(prev => prev.map(emp =>
            emp.id === employeeId ? { ...emp, status } : emp
        ));
    }, []);

    const handleEmployeeTimeChange = useCallback((employeeId, field, value) => {
        setSelectedEmployees(prev => prev.map(emp =>
            emp.id === employeeId ? { ...emp, [field]: value } : emp
        ));
    }, []);

    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
    }, []);

    const handleEditAttendance = useCallback((record) => {
        setEditingRecord(record);
        setEditCheckIn(record.checkIn ? new Date(record.checkIn).toTimeString().slice(0, 5) : '');
        setEditCheckOut(record.checkOut ? new Date(record.checkOut).toTimeString().slice(0, 5) : '');
        setEditStatus(record.status);
        setShowEditModal(true);
    }, []);

    const handleDeleteAttendance = useCallback((record) => {
        setDeletingRecord(record);
        setShowDeleteModal(true);
    }, []);

    const handleMarkAllAbsent = useCallback(async () => {
        try {
            setIsMarkingAllAbsent(true);
            setIsLoading(true);

            // Get current date in Sri Lanka timezone using the correct function
            const today = getSriLankaDate();

            // Fetch all attendance records for the selected date (not just current page)
            const allAttendanceRes = await attendanceAPI.getAll({ date: today, limit: 10000 });

            const allAttendanceData = allAttendanceRes.success ?
                allAttendanceRes.data.attendance : [];

            // Get users who don't have attendance for the selected date
            const usersWithoutAttendance = availableEmployees.filter(emp => {
                // Check if user already has attendance for today using all attendance data
                const hasAttendance = allAttendanceData.some(
                    record => record.user?.id === emp.id && record.date === today
                );

                // Only exclude users who already have attendance
                return !hasAttendance;
            });

            if (usersWithoutAttendance.length === 0) {
                toast.info('All users already have attendance marked for today');
                return;
            }

            // Create payloads for all users as absent
            const payloads = usersWithoutAttendance.map(emp => ({
                userId: emp.id,
                date: today,
                checkInTime: null,
                checkOutTime: null
            }));

            // Save all as absent with individual error handling
            let successCount = 0;
            let errorCount = 0;

            for (const payload of payloads) {
                try {
                    await attendanceAPI.create(payload);
                    successCount++;
                } catch (error) {
                    // If it's a 409 conflict, it means the record already exists - skip it
                    if (error.response?.status === 409) {
                    } else {
                        errorCount++;
                    }
                }
            }

            if (successCount > 0) {
                toast.success(`Marked ${successCount} users as absent for ${today}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
            } else if (errorCount > 0) {
                toast.info(`All selected users already have attendance records for ${today}`);
            } else {
                toast.info('All users already have attendance marked for today');
            }

            fetchAttendance(); // Refresh data
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to mark users as absent');
        } finally {
            setIsMarkingAllAbsent(false);
            setIsLoading(false);
        }
    }, [availableEmployees, fetchAttendance]);

    const handleSaveAttendance = async () => {
        if (selectedEmployees.length === 0) return;

        // Validate that a date is selected
        if (!selectedDate) {
            toast.error('Please select a date before saving attendance');
            return;
        }

        const payloads = selectedEmployees.map((emp) => {
            const checkInDateTime = emp.checkIn ? `${selectedDate}T${emp.checkIn}:00` : null;
            const checkOutDateTime = emp.checkOut ? `${selectedDate}T${emp.checkOut}:00` : null;

            return {
                userId: emp.id,
                date: selectedDate,
                checkInTime: checkInDateTime,
                checkOutTime: checkOutDateTime
            };
        });

        try {
            setIsSavingAttendance(true);
            setIsLoading(true);
            await Promise.all(
                payloads.map(payload => attendanceAPI.create(payload))
            );

            toast.success('Attendance saved successfully');
            setShowMarkAttendanceModal(false);
            setSelectedEmployees([]);
            setEmployeeSearchTerm('');
            fetchAttendance();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save attendance');
        } finally {
            setIsSavingAttendance(false);
            setIsLoading(false);
        }
    };

    const handleUpdateAttendance = async () => {
        if (!editingRecord) return;

        try {
            setIsUpdating(true);
            setIsLoading(true);

            const updateData = {};

            // Handle absent status - clear both times
            if (editStatus === 'absent') {
                updateData.checkInTime = null;
                updateData.checkOutTime = null;
            } else {
                // Only include check-in and check-out times if they have values
                if (editCheckIn) {
                    // Create proper ISO format datetime string
                    const [hours, minutes] = editCheckIn.split(':');
                    // Extract just the date part from editingRecord.date
                    const datePart = editingRecord.date.split('T')[0];
                    const dateTimeString = `${datePart}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
                    const checkInDateTime = new Date(dateTimeString);

                    // Validate the date before converting to ISO string
                    if (Number.isNaN(checkInDateTime.getTime())) {
                        toast.error('Invalid check-in time format');
                        return;
                    }

                    updateData.checkInTime = checkInDateTime.toISOString();
                } else {
                    updateData.checkInTime = null;
                }
                if (editCheckOut) {
                    // Create proper ISO format datetime string
                    const [hours, minutes] = editCheckOut.split(':');
                    // Extract just the date part from editingRecord.date
                    const datePart = editingRecord.date.split('T')[0];
                    const dateTimeString = `${datePart}T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
                    const checkOutDateTime = new Date(dateTimeString);

                    // Validate the date before converting to ISO string
                    if (Number.isNaN(checkOutDateTime.getTime())) {
                        toast.error('Invalid check-out time format');
                        return;
                    }

                    updateData.checkOutTime = checkOutDateTime.toISOString();
                } else {
                    updateData.checkOutTime = null;
                }
            }

            // Map frontend status to backend logic
            // Backend determines status based on check-in/check-out times, so we don't send status
            // If both times are null, it means absent
            // If only check-in is present, it means incomplete  
            // If both are present, it means complete

            await attendanceAPI.update(editingRecord.id, updateData);

            toast.success('Attendance updated successfully');
            setShowEditModal(false);
            setEditingRecord(null);
            setEditCheckIn('');
            setEditCheckOut('');
            setEditStatus('');
            fetchAttendance();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update attendance');
        } finally {
            setIsUpdating(false);
            setIsLoading(false);
        }
    };

    const confirmDeleteAttendance = async () => {
        if (!deletingRecord) return;

        try {
            setIsDeleting(true);
            setIsLoading(true);
            await attendanceAPI.delete(deletingRecord.id);

            toast.success('Attendance deleted successfully');
            setShowDeleteModal(false);
            setDeletingRecord(null);
            fetchAttendance();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete attendance');
        } finally {
            setIsDeleting(false);
            setIsLoading(false);
        }
    };

    const exportToCSV = () => {
        // Create CSV content
        const headers = ['Employee Name', 'Email', 'Role', 'Department', 'Status', 'Date', 'Check In', 'Check Out'];

        // Status badge configuration (same as StatusBadge component)
        const getStatusLabel = (status) => {
            const badgeConfig = {
                present: 'Present',
                absent: 'Absent',
                complete: 'Present',
                incomplete: 'Incomplete',
                leave: 'On Leave'
            };
            return badgeConfig[status] || 'Unknown';
        };

        const csvContent = [
            headers.join(','),
            ...attendanceData.map(record => [
                `"${record.userName}"`,
                `"${record.userEmail}"`,
                `"${record.role}"`,
                `"${record.department}"`,
                `"${getStatusLabel(record.status)}"`,
                `"${record.date}"`,
                `"${formatDateTimeForDisplay(record.checkIn)}"`,
                `"${formatDateTimeForDisplay(record.checkOut)}"`
            ].join(','))
        ].join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `attendance-report-${getSriLankaDate()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('CSV report downloaded successfully!');
    };

    return (
        <>
            {isLoading && <Loading size={80} bg="bg-black/20" />}
            {/* Main Content */}
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
                {/* Page Header */}
                <div className="mb-6 lg:mb-0">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Attendance Management</h1>
                    <p className="text-slate-600">Manage employee attendance records, check-ins, and check-outs</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end mb-6">
                    <Button variant="outline" icon={Download} onClick={exportToCSV}>
                        Export Report
                    </Button>
                    <Button
                        variant="outline"
                        icon={UserX}
                        onClick={handleMarkAllAbsent}
                        disabled={isMarkingAllAbsent}
                        className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                        {isMarkingAllAbsent ? 'Marking...' : 'Mark All Absent'}
                    </Button>
                    <Button icon={Calendar} onClick={() => setShowMarkAttendanceModal(true)}>
                        Mark Attendance
                    </Button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6 ">
                <StatsCard
                    title="Total Records"
                    value={stats.total}
                    color="text-slate-900"
                    icon={Users}
                />
                <StatsCard
                    title="Checked Out"
                    value={stats.complete}
                    color="text-emerald-600"
                    icon={CheckCircle}
                />
                <StatsCard
                    title="Checked In"
                    value={stats.incomplete}
                    color="text-amber-600"
                    icon={AlertCircle}
                />
                <StatsCard
                    title="Absent"
                    value={stats.absent}
                    color="text-red-600"
                    icon={XCircle}
                />
                <StatsCard
                    title="Attendance Rate"
                    value={`${stats.attendanceRate}%`}
                    color="text-blue-600"
                    icon={Calendar}
                />
            </div>

            <Card>
                <div className="p-4 sm:p-6 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                                placeholder="Search by name, email, role..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <DatePicker
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                            placeholder="Select date"
                        />
                        <SearchableDropdown
                            options={positions.slice(1).map(pos => ({ id: pos, name: pos }))}
                            value={selectedPosition}
                            onChange={(value) => setSelectedPosition(value)}
                            placeholder="All Positions"
                            allOptionLabel="All Positions"
                            className="min-w-[140px]"
                        />
                        <SearchableDropdown
                            options={[
                                { id: 'present', name: 'Present' },
                                { id: 'absent', name: 'Absent' },
                                { id: 'complete', name: 'Complete' },
                                { id: 'incomplete', name: 'Incomplete' }
                            ]}
                            value={selectedStatus}
                            onChange={(value) => setSelectedStatus(value)}
                            placeholder="All Statuses"
                            allOptionLabel="All Statuses"
                            className="min-w-[140px]"
                        />
                        <Button variant="outline" onClick={() => { setSearchTerm(''); setSelectedDate(null); setSelectedPosition('all'); setSelectedStatus('all'); setSelectedDepartment('all'); }}>Clear</Button>
                    </div>
                </div>
                <div className="p-4 sm:p-6">
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <div className="min-w-[800px] md:min-w-[700px] lg:min-w-full">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 text-slate-600 font-medium">
                                    <tr>
                                        <th className="px-6 py-4">Last Active</th>
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Department</th>
                                        {!selectedDate && <th className="px-6 py-4">Date</th>}
                                        <th className="px-6 py-4">Check In</th>
                                        <th className="px-6 py-4">Check Out</th>
                                        <th className="px-6 py-4">Working Hours</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {attendanceLoading ? (
                                        <tr>
                                            <td colSpan={selectedDate ? 9 : 10} className="px-6 py-4 text-center text-slate-500">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    Loading attendance data...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginatedData.length === 0 ? (
                                        <tr>
                                            <td colSpan={selectedDate ? 9 : 10} className="px-6 py-8 text-center text-slate-500">
                                                No attendance records found
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedData
                                            .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                            .map((record) => (
                                                <AttendanceRow
                                                    key={record.id}
                                                    record={record}
                                                    onEdit={handleEditAttendance}
                                                    onDelete={handleDeleteAttendance}
                                                    showDate={!selectedDate}
                                                />
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {filteredAttendance.length > 0 && (
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAttendance.length)} of {filteredAttendance.length} entries
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>

                                {Array.from({ length: Math.ceil(filteredAttendance.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => handlePageChange(page)}
                                        className={`px-4 py-2 text-sm border rounded ${currentPage === page
                                            ? "bg-[#C4009A] text-white border-[#C4009A]"
                                            : "border-slate-300 hover:bg-slate-50"
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === Math.ceil(filteredAttendance.length / ITEMS_PER_PAGE)}
                                    className="px-4 py-2 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Mark Attendance Modal */}
            {showMarkAttendanceModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-4xl md:max-w-5xl lg:max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Mark Attendance</h2>
                            <button
                                onClick={() => setShowMarkAttendanceModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Date Selection */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Attendance Date</label>
                                <DatePicker
                                    selectedDate={selectedDate}
                                    onDateSelect={setSelectedDate}
                                    placeholder="Select date"
                                />
                            </div>

                            {/* Employee Assignment */}
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="block text-sm font-medium text-slate-700">Select Employees</label>
                                    <Badge color="brand">{selectedEmployees.length} selected</Badge>
                                </div>

                                {/* Available Employees */}
                                <div className="mb-6">
                                    <p className="text-xs text-slate-500 mb-2">Search Employees</p>
                                    <div className="relative mb-3">
                                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                                        <input
                                            type="text"
                                            value={employeeSearchTerm}
                                            onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                                            placeholder="Search by name, ID, email, role, or department..."
                                        />
                                    </div>
                                    {employeeSearchTerm && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {filterEmployees(availableEmployees, employeeSearchTerm, selectedEmployees).map(employee => (
                                                <div key={employee.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                                                    <div className="flex items-center gap-2">
                                                        <Avatar size="sm" fallback={employee.avatar} />
                                                        <div>
                                                            <p className="text-sm font-medium text-slate-700">{employee.name}</p>
                                                            <p className="text-xs text-slate-500">{employee.role} • {employee.department}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddEmployee(employee)}
                                                        className="p-1 hover:bg-[#C4009A]/10 rounded text-[#C4009A]"
                                                    >
                                                        <UserPlus size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            {filterEmployees(availableEmployees, employeeSearchTerm, selectedEmployees).length === 0 && (
                                                <div className="col-span-full text-center py-8 text-slate-500">
                                                    <p>No employees found matching "{employeeSearchTerm}"</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {!employeeSearchTerm && (
                                        <div className="text-center py-8 text-slate-500">
                                            <Search size={48} className="mx-auto mb-3 text-slate-300" />
                                            <p>Start typing to search for employees</p>
                                        </div>
                                    )}
                                </div>

                                {/* Selected Employees */}
                                {selectedEmployees.length > 0 && (
                                    <div>
                                        <p className="text-xs text-slate-500 mb-3">Selected Employees - Mark Attendance</p>
                                        <div className="space-y-3">
                                            {selectedEmployees.map(employee => (
                                                <div key={employee.id} className="border border-slate-200 rounded-lg p-4 ">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <Avatar fallback={employee.avatar} />
                                                            <div>
                                                                <p className="font-medium text-slate-800">{employee.name}</p>
                                                                <p className="text-sm text-slate-500">{employee.email} • {employee.role}</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveEmployee(employee.id)}
                                                            className="p-1 hover:bg-red-100 rounded text-red-600"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                                                            <select
                                                                value={employee.status}
                                                                onChange={(e) => handleEmployeeStatusChange(employee.id, e.target.value)}
                                                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-[#C4009A]"
                                                            >
                                                                <option value="present">Present</option>
                                                                <option value="absent">Absent</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-1">Check In</label>
                                                            <input
                                                                type="time"
                                                                value={employee.checkIn}
                                                                onChange={(e) => handleEmployeeTimeChange(employee.id, 'checkIn', e.target.value)}
                                                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-[#C4009A]"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-slate-600 mb-1">Check Out</label>
                                                            <input
                                                                type="time"
                                                                value={employee.checkOut}
                                                                onChange={(e) => handleEmployeeTimeChange(employee.id, 'checkOut', e.target.value)}
                                                                className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-[#C4009A]"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowMarkAttendanceModal(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveAttendance}
                                disabled={selectedEmployees.length === 0}
                            >
                                Save Attendance ({selectedEmployees.length})
                            </Button>
                        </div>

                    </div>
                </div>
            )}

            {/* Edit Attendance Modal */}
            {showEditModal && editingRecord && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Edit Attendance</h2>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg"
                                disabled={isUpdating}
                            >
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Employee</label>
                                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                                    <Avatar src={editingRecord.avatar} fallback={editingRecord.avatarFallback} size="sm" />
                                    <div>
                                        <p className="font-medium text-slate-800">{editingRecord.userName}</p>
                                        <p className="text-xs text-slate-500">{editingRecord.userEmail}</p>
                                    </div>
                                </div>
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select
                                    value={editStatus}
                                    onChange={(e) => {
                                        const newStatus = e.target.value;
                                        setEditStatus(newStatus);
                                        // Clear times if status is changed to absent
                                        if (newStatus === 'absent') {
                                            setEditCheckIn('');
                                            setEditCheckOut('');
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                                    disabled={isUpdating}
                                >
                                    <option value="present">Present</option>
                                    <option value="absent">Absent</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Check In Time</label>
                                <input
                                    type="time"
                                    value={editCheckIn}
                                    onChange={(e) => setEditCheckIn(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                                    disabled={isUpdating || editStatus === 'absent'}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Check Out Time</label>
                                <input
                                    type="time"
                                    value={editCheckOut}
                                    onChange={(e) => setEditCheckOut(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                                    disabled={isUpdating || editStatus === 'absent'}
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowEditModal(false)}
                                disabled={isUpdating}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUpdateAttendance}
                                disabled={isUpdating}
                            >
                                {isUpdating ? 'Updating...' : 'Update'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && deletingRecord && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl max-w-md w-full">
                        <div className="p-6 border-b border-slate-200">
                            <h2 className="text-xl font-bold text-slate-800">Delete Attendance</h2>
                        </div>

                        <div className="p-6">
                            <p className="text-slate-600 mb-4">
                                Are you sure you want to delete the attendance record for <strong>{deletingRecord.userName}</strong> on <strong>{deletingRecord.date}</strong>?
                            </p>

                            <div className="bg-slate-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Avatar src={deletingRecord.avatar} fallback={deletingRecord.avatarFallback} size="sm" />
                                    <div>
                                        <p className="font-medium text-slate-800">{deletingRecord.userName}</p>
                                        <p className="text-xs text-slate-500">{deletingRecord.userEmail}</p>
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600">
                                    <p><strong>Date:</strong> {deletingRecord.date}</p>
                                    <p><strong>Check In:</strong> {formatDateTimeForDisplay(deletingRecord.checkIn)}</p>
                                    <p><strong>Check Out:</strong> {formatDateTimeForDisplay(deletingRecord.checkOut)}</p>
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
                                onClick={confirmDeleteAttendance}
                                disabled={isDeleting}
                                className="bg-red-600 text-white hover:bg-red-700 border-none"
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AttendancePage;