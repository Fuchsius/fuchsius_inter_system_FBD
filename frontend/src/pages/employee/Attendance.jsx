import React, { useState, useEffect } from 'react';
import {
  Clock
} from 'lucide-react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import { toast } from 'react-toastify';
import { attendanceAPI } from '../../api/attendance';
import Loading from '../../components/Loading';

const Attendance = ({ userRole }) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [attendanceData, setAttendanceData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [weeklyTotal, setWeeklyTotal] = useState({ hours: 0, minutes: 0 });
  const itemsPerPage = 10;

  const THEME = {
    gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchTodayAttendance();
    fetchAttendanceHistory();
    fetchWeeklyAttendance();
  }, []);

  const getSriLankaTime = () => {
    const options = {
      timeZone: 'Asia/Colombo',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    return currentTime.toLocaleTimeString('en-US', options);
  };

  const getSriLankaDate = () => {
    const options = {
      timeZone: 'Asia/Colombo',
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return currentTime.toLocaleDateString('en-US', options);
  };

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getTodayAttendance();

      if (response && response.success && response.data && response.data.attendance && response.data.attendance.length > 0) {
        const today = response.data.attendance[0];
        setTodayAttendance(today);
        // Update isCheckedIn based on check-in and check-out times
        const hasCheckedIn = today.checkInTime !== null;
        const hasCheckedOut = today.checkOutTime !== null;
        const shouldBeCheckedIn = hasCheckedIn && !hasCheckedOut;
        setIsCheckedIn(shouldBeCheckedIn);
      } else {
        // If we have local todayAttendance, use that instead of clearing state
        if (todayAttendance) {
          const hasCheckedIn = todayAttendance.checkInTime !== null;
          const hasCheckedOut = todayAttendance.checkOutTime !== null;
          const shouldBeCheckedIn = hasCheckedIn && !hasCheckedOut;
          setIsCheckedIn(shouldBeCheckedIn);
        } else {
          setTodayAttendance(null);
          setIsCheckedIn(false);
        }
      }
    } catch (error) {
      toast.error('Failed to fetch today\'s attendance');
      // Don't clear state on error, preserve existing state
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceHistory = async (page = 1) => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getMyAttendance(page, itemsPerPage);

      if (response && response.success && response.data) {
        setAttendanceData(response.data.attendance || []);
        setTotalRecords(response.data.pagination?.total || 0);
        setCurrentPage(response.data.pagination?.page || page);
      } else {
        setAttendanceData([]);
        setTotalRecords(0);
      }
    } catch (error) {
      toast.error('Failed to load attendance history');
      setAttendanceData([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInOut = async () => {
    try {
      setLoading(true);

      if (isCheckedIn) {
        const response = await attendanceAPI.checkOut();

        if (response && response.success) {
          const attendanceRecord = response?.data;
          // Dispatch event after successful checkout
          window.dispatchEvent(new CustomEvent('attendance-status-updated', {
            detail: {
              hasCheckedOut: true,
              checkInTime: attendanceRecord?.checkInTime || todayAttendance?.checkInTime
            }
          }));
          toast.success('Checked out successfully! Have a great day.');
          // Update todayAttendance immediately
          setTodayAttendance(attendanceRecord);
          // Update state immediately
          setIsCheckedIn(false);

          // Refresh data after check-out
          await fetchTodayAttendance();
          await fetchAttendanceHistory(currentPage);
          await fetchWeeklyAttendance();
        } else {
          toast.error(response?.message || 'Failed to check out');
        }
      } else {
        try {
          const response = await attendanceAPI.checkIn();

          if (response && response.success) {
            const attendanceRecord = response?.data;
            // Dispatch event after successful check-in
            window.dispatchEvent(new CustomEvent('attendance-status-updated', {
              detail: {
                hasCheckedOut: false,
                checkInTime: attendanceRecord?.checkInTime || new Date().toISOString()
              }
            }));

            // Update state immediately
            setTodayAttendance(attendanceRecord);
            setIsCheckedIn(true);

            // Show success message
            toast.success('Checked in successfully! Welcome to work.');

            // Refresh data
            await fetchTodayAttendance();
            await fetchAttendanceHistory(currentPage);
            await fetchWeeklyAttendance();
          } else {
            toast.error(response?.message || 'Failed to check in');
          }
        } catch (error) {
          if (error.response?.status === 409) {
            // If already checked in, sync the state with server
            await fetchTodayAttendance(); // This will update the state
            toast.info('You are already checked in for today');
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to check in/out';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(totalRecords / itemsPerPage);

  const handlePageChange = (page) => {
    fetchAttendanceHistory(page);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const calculateTotalHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '-';
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end - start;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${diffHours}h ${diffMins}m`;
  };

  const getTotalMinutes = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end - start;
    return Math.floor(diffMs / (1000 * 60));
  };

  const getSriLankaDateString = () => {
    const now = new Date();
    // Use proper timezone conversion to avoid date issues
    const sriLankaDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
    const year = sriLankaDate.getFullYear();
    const month = String(sriLankaDate.getMonth() + 1).padStart(2, '0');
    const day = String(sriLankaDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchWeeklyAttendance = async () => {
    try {
      setLoading(true);
      const todayString = getSriLankaDateString();
      const today = new Date(todayString + 'T12:00:00.000Z'); // Use midday to avoid timezone shifts
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);


      // Fetch more records to get weekly data
      const response = await attendanceAPI.getMyAttendance(1, 50, null, null);

      if (response && response.success && response.data) {
        const weekDays = [
          { name: 'Sun', dayIndex: 0 },
          { name: 'Mon', dayIndex: 1 },
          { name: 'Tue', dayIndex: 2 },
          { name: 'Wed', dayIndex: 3 },
          { name: 'Thu', dayIndex: 4 },
          { name: 'Fri', dayIndex: 5 },
          { name: 'Sat', dayIndex: 6 }
        ];

        // First, get all records for the current week (Sunday to Saturday)
        const weeklyRecords = response.data.attendance.filter(record => {
          const recordDate = new Date(record.date);
          // Include all days Sunday to Saturday
          return recordDate >= startOfWeek &&
            recordDate <= endOfWeek &&
            recordDate.getDay() >= 0 &&
            recordDate.getDay() <= 6;
        });


        // Create a map of dates to records for easier lookup
        const dateToRecordMap = {};
        weeklyRecords.forEach(record => {
          const recordDate = new Date(record.date);
          dateToRecordMap[recordDate.toDateString()] = record;
        });

        // Generate weekly summary
        const weeklySummary = [];
        let totalMinutes = 0;

        // For each day of the work week (Sunday to Saturday)
        for (let i = 0; i <= 6; i++) {
          const currentDay = new Date(startOfWeek);
          currentDay.setDate(startOfWeek.getDate() + i);

          const dayName = weekDays[i].name;
          const record = dateToRecordMap[currentDay.toDateString()];

          if (record) {
            if (record.checkInTime && record.checkOutTime) {
              const dayMinutes = getTotalMinutes(record.checkInTime, record.checkOutTime);
              totalMinutes += dayMinutes;

              weeklySummary.push({
                day: dayName,
                hours: calculateTotalHours(record.checkInTime, record.checkOutTime),
                complete: true,
                totalMinutes: dayMinutes
              });
            } else if (record.checkInTime) {
              weeklySummary.push({
                day: dayName,
                hours: 'In progress',
                complete: false,
                totalMinutes: 0
              });
            } else {
              weeklySummary.push({
                day: dayName,
                hours: 'Absent',
                complete: false,
                totalMinutes: 0
              });
            }
          } else {
            weeklySummary.push({
              day: dayName,
              hours: 'Absent',
              complete: false,
              totalMinutes: 0
            });
          }
        }

        const totalHours = Math.floor(totalMinutes / 60);
        const totalMins = totalMinutes % 60;
        setWeeklyTotal({ hours: totalHours, minutes: totalMins });

        setWeeklyData(weeklySummary);
      } else {
        setWeeklyData([]);
        setWeeklyTotal({ hours: 0, minutes: 0 });
      }
    } catch (error) {
      setWeeklyData([]);
      setWeeklyTotal({ hours: 0, minutes: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {loading && <Loading size={80} bg="bg-black/20" />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 col-span-1 md:col-span-1 flex flex-col items-center justify-center text-center bg-slate-900 text-white border-none shadow-xl">
          <div className="mb-4" style={{ color: '#C4009A' }}><Clock size={48} /></div>
          <h3 className="text-3xl font-mono font-bold tracking-widest mb-2" style={{ color: '#C4009A' }}>
            {getSriLankaTime()}
          </h3>
          <p className="text-slate-400 text-sm mb-6">{getSriLankaDate()}</p>
          <Button
            className="w-full bg-white text-slate-900 hover:bg-slate-100 shadow-none border-none"
            onClick={handleCheckInOut}
          >
            {isCheckedIn ? 'Check Out' : 'Check In'}
          </Button>
        </Card>

        <Card className="p-6 col-span-1 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">My Weekly Summary</h3>
            <div className="flex items-center gap-2">
              {/* <Badge color="success">On Time</Badge> */}
              <div className="text-sm font-medium text-slate-600">
                Total: <span className="text-[#C4009A] font-bold">{weeklyTotal.hours}h {weeklyTotal.minutes}m</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-3 md:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 text-center">
            {weeklyData.length > 0 ? weeklyData.map((dayData, i) => (
              <div key={dayData.day} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">{dayData.day}</p>
                <p className={`font-bold ${dayData.complete ? 'text-slate-800' : 'text-slate-400'}`}>
                  {dayData.hours}
                </p>
                <div className="w-full bg-slate-200 h-1 mt-2 rounded-full">
                  <div
                    className={`h-full rounded-full ${dayData.totalMinutes >= 480 ? 'bg-emerald-500' :
                      dayData.totalMinutes > 0 ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                    style={{
                      width: `${Math.min(100, (dayData.totalMinutes / 480) * 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            )) : (
              ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">{day}</p>
                  <p className="font-bold text-slate-400">-</p>
                  <div className="w-full bg-slate-200 h-1 mt-2 rounded-full">
                    <div className="h-full bg-slate-300 w-0 rounded-full"></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-800">My Attendance History</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500 border-b border-slate-100">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Check In</th>
              <th className="px-6 py-3 font-medium">Check Out</th>
              <th className="px-6 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                  Loading attendance history...
                </td>
              </tr>
            ) : attendanceData.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                  No attendance records found
                </td>
              </tr>
            ) : (
              attendanceData.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 text-slate-700">{formatDate(record.date)}</td>
                  <td className="px-6 py-4 text-slate-600">{formatTime(record.checkInTime)}</td>
                  <td className="px-6 py-4 text-slate-600">{formatTime(record.checkOutTime)}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {calculateTotalHours(record.checkInTime, record.checkOutTime)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} entries
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
      </Card>
    </div>
  );
};

export default Attendance;
