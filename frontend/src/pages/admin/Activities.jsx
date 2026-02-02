import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity, Eye, Search, Filter, Download, Calendar, User, MapPin,
    Clock, Smartphone, Globe, AlertCircle, CheckCircle, XCircle, X, Loader2,
    Monitor, Tablet, Info
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import SearchableDropdown from '../../components/SearchableDropdown';
import DatePicker from '../../components/DatePicker';
import Loading from '../../components/Loading';
import { toast } from 'react-toastify';
import { activitiesAPI } from '../../api/activities';
import { usersAPI } from '../../api/users';

const ITEMS_PER_PAGE = 20;

const formatDateTime = (dateTime) => {
    if (!dateTime) return '-';
    const date = new Date(dateTime);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

const formatActionText = (action) => {
    const actionTextMap = {
        'USER_REGISTERED': 'User Registered',
        'USER_LOGIN': 'User Login',
        'USER_UPDATED': 'User Updated',
        'USER_DELETED': 'User Deleted',
        'USER_CREATED': 'User Created',
        'PASSWORD_CHANGED': 'Password Changed',
        'PROJECT_CREATED': 'Project Created',
        'PROJECT_UPDATED': 'Project Updated',
        'PROJECT_DELETED': 'Project Deleted',
        'TASK_CREATED': 'Task Created',
        'TASK_UPDATED': 'Task Updated',
        'TASK_DELETED': 'Task Deleted',
        'DEPARTMENT_CREATED': 'Department Created',
        'DEPARTMENT_UPDATED': 'Department Updated',
        'DEPARTMENT_DELETED': 'Department Deleted',
        'EVENT_CREATED': 'Event Created',
        'EVENT_UPDATED': 'Event Updated',
        'EVENT_DELETED': 'Event Deleted',
        'REFERRAL_CREATED': 'Referral Created',
        'REFERRAL_UPDATED': 'Referral Updated',
        'REFERRAL_DELETED': 'Referral Deleted',
        'ATTENDANCE_CREATED': 'Attendance Created',
        'ATTENDANCE_UPDATED': 'Attendance Updated',
        'CHECK_IN': 'Check In',
        'CHECK_OUT': 'Check Out',
        'NOTIFICATION_CREATED': 'Notification Created',
        'NOTIFICATION_UPDATED': 'Notification Updated',
        'NOTIFICATION_DELETED': 'Notification Deleted',
        'POSITION_CREATED': 'Position Created',
        'POSITION_UPDATED': 'Position Updated',
        'POSITION_DELETED': 'Position Deleted'
    };
    return actionTextMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const getActionIcon = (action) => {
    const actionIcons = {
        'USER_REGISTERED': <User size={16} className="text-green-500" />,
        'USER_LOGIN': <CheckCircle size={16} className="text-blue-500" />,
        'USER_UPDATED': <User size={16} className="text-orange-500" />,
        'USER_DELETED': <XCircle size={16} className="text-red-500" />,
        'USER_CREATED': <User size={16} className="text-green-500" />,
        'PASSWORD_CHANGED': <AlertCircle size={16} className="text-yellow-500" />,
        'PROJECT_CREATED': <CheckCircle size={16} className="text-green-500" />,
        'PROJECT_UPDATED': <CheckCircle size={16} className="text-orange-500" />,
        'PROJECT_DELETED': <XCircle size={16} className="text-red-500" />,
        'TASK_CREATED': <CheckCircle size={16} className="text-green-500" />,
        'TASK_UPDATED': <CheckCircle size={16} className="text-orange-500" />,
        'TASK_DELETED': <XCircle size={16} className="text-red-500" />,
        'DEPARTMENT_CREATED': <CheckCircle size={16} className="text-green-500" />,
        'DEPARTMENT_UPDATED': <CheckCircle size={16} className="text-orange-500" />,
        'DEPARTMENT_DELETED': <XCircle size={16} className="text-red-500" />,
        'EVENT_CREATED': <Calendar size={16} className="text-green-500" />,
        'EVENT_UPDATED': <Calendar size={16} className="text-orange-500" />,
        'EVENT_DELETED': <Calendar size={16} className="text-red-500" />,
        'REFERRAL_CREATED': <User size={16} className="text-green-500" />,
        'REFERRAL_UPDATED': <User size={16} className="text-orange-500" />,
        'REFERRAL_DELETED': <User size={16} className="text-red-500" />,
        'ATTENDANCE_CREATED': <Clock size={16} className="text-green-500" />,
        'ATTENDANCE_UPDATED': <Clock size={16} className="text-orange-500" />,
        'CHECK_IN': <CheckCircle size={16} className="text-green-500" />,
        'CHECK_OUT': <XCircle size={16} className="text-blue-500" />,
        'NOTIFICATION_CREATED': <AlertCircle size={16} className="text-green-500" />,
        'NOTIFICATION_UPDATED': <AlertCircle size={16} className="text-orange-500" />,
        'NOTIFICATION_DELETED': <AlertCircle size={16} className="text-red-500" />,
        'POSITION_CREATED': <CheckCircle size={16} className="text-green-500" />,
        'POSITION_UPDATED': <CheckCircle size={16} className="text-orange-500" />,
        'POSITION_DELETED': <XCircle size={16} className="text-red-500" />
    };
    return actionIcons[action] || <Activity size={16} className="text-slate-500" />;
};

const getDeviceIcon = (deviceType) => {
    const deviceIcons = {
        'desktop': <Monitor size={14} className="text-slate-400" />,
        'mobile': <Smartphone size={14} className="text-slate-400" />,
        'tablet': <Tablet size={14} className="text-slate-400" />,
        'unknown': <Smartphone size={14} className="text-slate-400" />
    };
    return deviceIcons[deviceType] || deviceIcons.unknown;
};

const getDeviceTypeColor = (deviceType) => {
    const colors = {
        'desktop': 'text-blue-600',
        'mobile': 'text-green-600',
        'tablet': 'text-purple-600',
        'unknown': 'text-slate-600'
    };
    return colors[deviceType] || colors.unknown;
};

const formatDeviceInfo = (activity) => {
    if (!activity.deviceName) {
        return activity.userAgent ? activity.userAgent.split(' ')[0] : '-';
    }
    
    const deviceName = activity.deviceName;
    const deviceType = activity.deviceType || 'unknown';
    
    // For desktop, show OS + Browser
    if (deviceType === 'desktop') {
        const os = activity.os || 'Unknown OS';
        const browser = activity.browser || 'Unknown Browser';
        return os + ' ' + browser;
    }
    
    // For mobile/tablet, show device name with OS if available
    if (activity.os && activity.os !== 'unknown') {
        return deviceName + ' (' + activity.os + ')';
    }
    
    return deviceName;
};

const getEntityTypeColor = (entityType) => {
    const colors = {
        'User': 'blue',
        'Project': 'green',
        'Task': 'purple',
        'Department': 'orange',
        'Event': 'pink',
        'Referral': 'indigo',
        'Attendance': 'cyan',
        'Auth': 'gray'
    };
    return colors[entityType] || 'slate';
};

const ActivityRow = React.memo(({ activity }) => (
    <tr className="hover:bg-slate-50/50 transition-colors">
        <td className="px-6 py-4">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                    {getActionIcon(activity.action)}
                </div>
                <div>
                    <p className="font-medium text-slate-800">{formatActionText(activity.action)}</p>
                    <p className="text-xs text-slate-500 leading-relaxed break-words max-w-[400px] whitespace-pre-line">{activity.description || '-'}</p>
                </div>
            </div>
        </td>
        <td className="px-6 py-4 text-slate-600">
            <Badge color={getEntityTypeColor(activity.entityType)}>
                {activity.entityType || 'N/A'}
            </Badge>
        </td>
        <td className="px-6 py-4 text-slate-600">{activity.entityId || '-'}</td>
        <td className="px-6 py-4">
            <div className="flex items-center gap-2">
                <User size={14} className="text-slate-400" />
                <span className="text-slate-600">{activity.user?.firstName} {activity.user?.lastName}</span>
            </div>
        </td>
        <td className="px-6 py-4">
            <div className="flex items-start gap-2">
                <div className={getDeviceTypeColor(activity.deviceType)} style={{marginTop: '2px'}}>
                    {getDeviceIcon(activity.deviceType)}
                </div>
                <div className="flex flex-col text-xs">
                    <div className="font-medium text-slate-700">{formatDeviceInfo(activity)}</div>
                    {activity.deviceType && (
                        <div className="text-slate-500">Type: {activity.deviceType}</div>
                    )}
                    {activity.os && (
                        <div className="text-slate-500">
                            OS: {activity.os}
                            {activity.osVersion && activity.osVersion !== 'unknown' && ' v' + activity.osVersion}
                        </div>
                    )}
                    {activity.browser && (
                        <div className="text-slate-500">
                            Browser: {activity.browser}
                            {activity.browserVersion && activity.browserVersion !== 'unknown' && ' v' + activity.browserVersion}
                        </div>
                    )}
                    {activity.deviceName && (
                        <div className="text-slate-500">Device: {activity.deviceName}</div>
                    )}
                </div>
            </div>
        </td>
        <td className="px-6 py-4 text-slate-600">
            <div className="flex items-center gap-2">
                <Globe size={14} className="text-slate-400" />
                <span className="text-xs">{activity.ipAddress || '-'}</span>
            </div>
        </td>
        <td className="px-6 py-4 text-slate-600">{formatDateTime(activity.createdAt)}</td>
    </tr>
));

ActivityRow.displayName = 'ActivityRow';

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

const Activities = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAction, setSelectedAction] = useState('all');
    const [selectedEntityType, setSelectedEntityType] = useState('all');
    const [selectedDateRange, setSelectedDateRange] = useState('all');
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedUser, setSelectedUser] = useState('all');
    const [userSearch, setUserSearch] = useState('');
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [activities, setActivities] = useState([]);
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({
        totalActivities: 0,
        todayActivities: 0,
        thisWeekActivities: 0,
        thisMonthActivities: 0
    });
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);

    // Individual loading states for different data sections
    const [activitiesLoading, setActivitiesLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    const fetchActivities = useCallback(async () => {
        try {
            setLoading(true);
            setActivitiesLoading(true);
            const params = {
                limit: ITEMS_PER_PAGE,
                page: currentPage,
                ...(searchTerm && { search: searchTerm }),
                ...(selectedAction !== 'all' && { action: selectedAction }),
                ...(selectedEntityType !== 'all' && { entityType: selectedEntityType }),
                ...(selectedDateRange !== 'all' && { dateRange: selectedDateRange }),
                ...(selectedDate && { date: selectedDate }),
                ...(selectedUser !== 'all' && { userId: selectedUser })
            };

            const response = await activitiesAPI.getAll(params);

            if (response.success) {
                setActivities(response.data.activities);
                setPagination(response.data.pagination);
                setActivitiesLoading(false);
            } else {
                toast.error(response.message || 'Failed to fetch activities');
                setActivitiesLoading(false);
            }
        } catch (error) {
            toast.error('Failed to load activities data');
            setActivitiesLoading(false);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchTerm, selectedAction, selectedEntityType, selectedDateRange, selectedUser, selectedDate]);

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            setUsersLoading(true);
            const response = await usersAPI.getAll({ limit: 1000 });
            if (response.success) {
                setUsers(response.data.users);
                setUsersLoading(false);
            } else {
                setUsersLoading(false);
            }
        } catch (error) {
            setUsersLoading(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            setStatsLoading(true);
            const response = await activitiesAPI.getStats();
            if (response.success) {
                setStats(response.data);
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
        fetchActivities();
        fetchStats();
        fetchUsers();
    }, [fetchActivities, fetchStats, fetchUsers]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedAction, selectedEntityType, selectedDateRange, searchTerm, selectedUser, selectedDate]);

    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
    }, []);

    const exportToCSV = () => {
        const headers = ['Action', 'Entity Type', 'Entity ID', 'User', 'User Agent', 'IP Address', 'Date & Time', 'Description'];

        const csvContent = [
            headers.join(','),
            ...activities.map(activity => [
                `"${activity.action}"`,
                `"${activity.entityType || ''}"`,
                `"${activity.entityId || ''}"`,
                `"${activity.user?.firstName} ${activity.user?.lastName}"`,
                `"${activity.userAgent || ''}"`,
                `"${activity.ipAddress || ''}"`,
                `"${formatDateTime(activity.createdAt)}"`,
                `"${activity.description || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `activities-report-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('CSV report downloaded successfully!');
    };

    const actionOptions = [
        { id: 'all', name: 'All Actions' },
        { id: 'USER_REGISTERED', name: 'User Registered' },
        { id: 'USER_LOGIN', name: 'User Login' },
        { id: 'USER_UPDATED', name: 'User Updated' },
        { id: 'USER_CREATED', name: 'User Created' },
        { id: 'USER_DELETED', name: 'User Deleted' },
        { id: 'PROJECT_CREATED', name: 'Project Created' },
        { id: 'PROJECT_UPDATED', name: 'Project Updated' },
        { id: 'PROJECT_DELETED', name: 'Project Deleted' },
        { id: 'TASK_CREATED', name: 'Task Created' },
        { id: 'TASK_UPDATED', name: 'Task Updated' },
        { id: 'TASK_DELETED', name: 'Task Deleted' },
        { id: 'DEPARTMENT_CREATED', name: 'Department Created' },
        { id: 'DEPARTMENT_UPDATED', name: 'Department Updated' },
        { id: 'DEPARTMENT_DELETED', name: 'Department Deleted' },
        { id: 'EVENT_CREATED', name: 'Event Created' },
        { id: 'EVENT_UPDATED', name: 'Event Updated' },
        { id: 'EVENT_DELETED', name: 'Event Deleted' },
        { id: 'REFERRAL_CREATED', name: 'Referral Created' },
        { id: 'REFERRAL_UPDATED', name: 'Referral Updated' },
        { id: 'REFERRAL_DELETED', name: 'Referral Deleted' },
        { id: 'CHECK_IN', name: 'Check In' },
        { id: 'CHECK_OUT', name: 'Check Out' }
    ];

    const entityTypeOptions = [
        { id: 'all', name: 'All Entity Types' },
        { id: 'User', name: 'User' },
        { id: 'Project', name: 'Project' },
        { id: 'Task', name: 'Task' },
        { id: 'Department', name: 'Department' },
        { id: 'Event', name: 'Event' },
        { id: 'Referral', name: 'Referral' },
        { id: 'Attendance', name: 'Attendance' },
        { id: 'Auth', name: 'Auth' }
    ];

    const dateRangeOptions = [
        { id: 'all', name: 'All Time' },
        { id: 'today', name: 'Today' },
        { id: 'week', name: 'This Week' },
        { id: 'month', name: 'This Month' }
    ];

    return (
        <>
            {loading && <Loading size={80} bg="bg-black/20" />}
            {/* Main Content */}
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-4">
                {/* Page Header */}
                <div className="mb-6 lg:mb-0">
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Activity Logs</h1>
                    <p className="text-slate-600">Monitor and track all user activities and system events</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end mb-6">
                    <Button variant="outline" icon={Download} onClick={exportToCSV}>
                        Export Report
                    </Button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatsCard
                    title="Total Activities"
                    value={stats.totalActivities}
                    color="text-slate-900"
                    icon={Activity}
                />
                <StatsCard
                    title="Today"
                    value={stats.todayActivities}
                    color="text-blue-600"
                    icon={Calendar}
                />
                <StatsCard
                    title="This Week"
                    value={stats.thisWeekActivities}
                    color="text-green-600"
                    icon={Calendar}
                />
                <StatsCard
                    title="This Month"
                    value={stats.thisMonthActivities}
                    color="text-purple-600"
                    icon={Calendar}
                />
            </div>

            <Card>
                <div className="p-4 sm:p-6 border-b border-slate-100">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative w-full lg:w-64">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            <input
                                className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#C4009A]"
                                placeholder="Search activities..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <SearchableDropdown
                            options={entityTypeOptions}
                            value={selectedEntityType}
                            onChange={(value) => setSelectedEntityType(value)}
                            placeholder="All Entity Types"
                            allOptionLabel="All Entity Types"
                            className="min-w-[160px]"
                        />
                        <DatePicker
                            selectedDate={selectedDate}
                            onDateSelect={setSelectedDate}
                            placeholder="Select date"
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
                                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    <div
                                        className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        onMouseDown={() => { setSelectedUser('all'); setUserSearch(''); }}
                                    >
                                        All Users
                                    </div>
                                    {users
                                        .filter(user => `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase().includes(userSearch.toLowerCase()) ||
                                                       user.email.toLowerCase().includes(userSearch.toLowerCase()))
                                        .map(user => (
                                            <div
                                                key={user.id}
                                                className="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                                onMouseDown={() => { setSelectedUser(user.id); setUserSearch(`${user.firstName || ''} ${user.lastName || ''}`); }}
                                            >
                                                {`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                        <SearchableDropdown
                            options={dateRangeOptions}
                            value={selectedDateRange}
                            onChange={(value) => setSelectedDateRange(value)}
                            placeholder="All Time"
                            allOptionLabel="All Time"
                            className="min-w-[140px]"
                        />
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedAction('all');
                                setSelectedEntityType('all');
                                setSelectedDateRange('all');
                                setSelectedDate(null);
                                setSelectedUser('all');
                                setUserSearch('');
                            }}
                        >
                            Clear
                        </Button>
                    </div>
                </div>
                <div className="p-4 sm:p-6">
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                        <div className="min-w-[1000px] md:min-w-full">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-slate-50 text-slate-600 font-medium">
                                    <tr>
                                        <th className="px-6 py-4">Action</th>
                                        <th className="px-6 py-4">Entity Type</th>
                                        <th className="px-6 py-4">Entity ID</th>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Device Info</th>
                                        <th className="px-6 py-4">IP Address</th>
                                        <th className="px-6 py-4">Date & Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {activitiesLoading ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="animate-spin text-[#C4009A]" size={20} />
                                                    Loading activities...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : activities.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-6 py-8 text-center text-slate-500">
                                                No activities found
                                            </td>
                                        </tr>
                                    ) : (
                                        activities.map((activity) => (
                                            <ActivityRow
                                                key={activity.id}
                                                activity={activity}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                                Showing {(pagination.page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(pagination.page * ITEMS_PER_PAGE, pagination.total)} of {pagination.total} activities
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
                </div>
            </Card>

        </>
    );
};

export default Activities;
