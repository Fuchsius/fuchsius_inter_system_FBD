import React, { useState, useEffect, useMemo, useRef, Suspense, lazy, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Loading from './components/Loading';
import socketService from './services/socketService';
import { isMobile as staticIsMobile } from 'react-device-detect';

// Disable React DevTools and console logs
window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = undefined;

// Disable all console methods
const noop = () => { };

// Lazy load all page components
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const AdminUsersPage = React.lazy(() => import('./pages/admin/UsersPage'));
const AdminProfile = React.lazy(() => import('./pages/admin/Profile'));
const AdminProjects = React.lazy(() => import('./pages/admin/Projects'));
const AdminTasks = React.lazy(() => import('./pages/admin/Tasks'));
const AdminReferrals = React.lazy(() => import('./pages/admin/Referrals'));
const AdminAttendance = React.lazy(() => import('./pages/admin/AttendanceManage'));
const AdminAttendanceManage = React.lazy(() => import('./pages/admin/AttendanceManage'));
const AdminEvents = React.lazy(() => import('./pages/admin/Events'));
const AdminDepartments = React.lazy(() => import('./pages/admin/Departments'));
const AdminPositions = React.lazy(() => import('./pages/admin/Positions'));
const AdminActivities = React.lazy(() => import('./pages/admin/Activities'));

const EmployeeDashboard = React.lazy(() => import('./pages/employee/Dashboard'));
const EmployeeAttendance = React.lazy(() => import('./pages/employee/Attendance'));
const EmployeeReferrals = React.lazy(() => import('./pages/employee/Referrals'));
const EmployeeProfile = React.lazy(() => import('./pages/employee/Profile'));
const EmployeeProjects = React.lazy(() => import('./pages/employee/Projects'));
const EmployeeTasks = React.lazy(() => import('./pages/employee/Tasks'));

const PmDashboard = React.lazy(() => import('./pages/pm/Dashboard'));
const PmAttendance = React.lazy(() => import('./pages/pm/Attendance'));
const PmAttendanceManage = React.lazy(() => import('./pages/pm/AttendanceManage'));
const PmProfile = React.lazy(() => import('./pages/pm/Profile'));
const PmProjects = React.lazy(() => import('./pages/pm/Projects'));
const PmTasks = React.lazy(() => import('./pages/pm/Tasks'));
const PmReferrals = React.lazy(() => import('./pages/pm/Referrals'));
const PmUsers = React.lazy(() => import('./pages/pm/Users'));

const InternerDashboard = React.lazy(() => import('./pages/Interners/Dashboard'));
const InternerAttendance = React.lazy(() => import('./pages/Interners/Attendance'));
const InternerReferrals = React.lazy(() => import('./pages/Interners/Referrals'));
const InternerProfile = React.lazy(() => import('./pages/Interners/Profile'));
const InternerProjects = React.lazy(() => import('./pages/Interners/Projects'));
const InternerTasks = React.lazy(() => import('./pages/Interners/Tasks'));

const HrDashboard = React.lazy(() => import('./pages/hr/Dashboard'));
const HrProfile = React.lazy(() => import('./pages/hr/Profile'));
const HrAttendance = React.lazy(() => import('./pages/hr/Attendance'));
const HrAttendanceManage = React.lazy(() => import('./pages/hr/AttendanceManage'));
const HrTasks = React.lazy(() => import('./pages/hr/Tasks'));
const HrProjects = React.lazy(() => import('./pages/hr/Projects'));
const HrReferrals = React.lazy(() => import('./pages/hr/Referrals'));
const HrUsers = React.lazy(() => import('./pages/hr/Users'));
const HrEvents = React.lazy(() => import('./pages/hr/Events'));

// Custom hook for reactive mobile detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    // Check physical screen width to prevent user agent spoofing
    return screen.width < 768;
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(screen.width < 768);
    };

    // Check on mount
    checkMobile();

    // No resize listener needed for screen width
  }, []);

  return isMobile;
};

// Mobile Access Disabled Component
const MobileDisabled = () => {
  const THEME = {
    gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
    gradientText: "bg-clip-text text-transparent bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-[#7E006C]/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-[#C4009A]/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md p-8 shadow-xl border-t-4 border-[#C4009A] relative z-10 bg-white rounded-lg">
        <div className="text-center mb-8">
          <h1 className={`text-3xl font-bold ${THEME.gradientText} mb-2`}>Fuchsius</h1>
          <p className="text-slate-500 text-sm">Internal Management System</p>
        </div>

        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>

          <h2 className="text-xl font-semibold text-slate-800">Mobile Access Disabled</h2>

          <p className="text-slate-600 text-sm leading-relaxed">
            This website is optimized for desktop use only. For the best experience, please access Fuchsius from a desktop computer or laptop.
          </p>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-slate-500 text-xs">
              Contact your administrator if you need assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Role to route mapping
const ROLE_ROUTES = {
  admin: '/admin/dashboard',
  manager: '/pm/dashboard',
  pm: '/pm/dashboard',
  employee: '/employee/dashboard',
  interners: '/interners/dashboard',
  intern: '/interners/dashboard',
  hr: '/hr/dashboard',
};

const normalizeRole = (role) => (role || '').toLowerCase();
const AUTH_MESSAGE_SOURCE = 'fuchsio-app';
const OVERLAY_MESSAGE_SOURCE = 'activity-overlay';

const isEmbeddedApp = () => {
  try {
    return window.parent && window.parent !== window;
  } catch (error) {
    return false;
  }
};

export const LoadingContext = React.createContext();

// Main App Component with Router
const FuchsiusApp = () => {
  // HTTP to HTTPS redirect
  useEffect(() => {
    if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
      window.location.href = window.location.href.replace('http:', 'https:');
    }
  }, []);

  // Use reactive mobile detection hook - must be called first
  const currentIsMobile = useIsMobile();

  const [userRole, setUserRole] = useState(null);
  const [sessionUser, setSessionUser] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [globalLoading, setGlobalLoading] = useState(false);
  const socketInitializedRef = useRef(false);
  const initializedRoleRef = useRef(null);
  const sessionUserRef = useRef(null);

  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);

  const broadcastAuthState = useCallback((type, userPayload) => {
    if (!isEmbeddedApp()) return;
    const sanitizedUser = userPayload ? {
      id: userPayload.id,
      firstName: userPayload.firstName,
      lastName: userPayload.lastName,
      email: userPayload.email,
      employeeId: userPayload.employeeId,
      role: userPayload.role
    } : null;

    window.parent.postMessage({
      source: AUTH_MESSAGE_SOURCE,
      type,
      payload: { user: sanitizedUser }
    }, '*');
  }, []);

  // Disable right-click context menu to prevent inspect element
  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Loading Provider Component
  const LoadingProvider = ({ children }) => {
    return (
      <LoadingContext.Provider value={{ setGlobalLoading }}>
        {children}
        {globalLoading && (
          <Loading size={80} bg="bg-black/50" />
        )}
      </LoadingContext.Provider>
    );
  };

  // Global Socket.IO connection and user status validation
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        
        // Check if user is suspended
        if (user.status === 'suspended') {
          handleLogout();
          return;
        }

        const normalizedRole = normalizeRole(user.role);
        let normalizedUser = user;
        if (normalizedRole && normalizedRole !== user.role) {
          normalizedUser = { ...user, role: normalizedRole };
          localStorage.setItem('user', JSON.stringify(normalizedUser));
        }
        setUserRole(normalizedRole || null);
        setSessionUser(normalizedUser);
      } catch (e) {
        console.error('Error parsing user data:', e);
        handleLogout();
      }
    } else {
      setSessionUser(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isEmbeddedApp()) return;
    const handleMessage = (event) => {
      if (!event?.data || event.data.source !== OVERLAY_MESSAGE_SOURCE) return;
      if (event.data.type === 'auth:status-request') {
        broadcastAuthState('auth:status', sessionUserRef.current);
      } else if (event.data.type === 'idle:threshold') {
        socketService.emitIdleThreshold({
          idleSeconds: event.data.payload?.idleSeconds || 0,
          lastActivityTs: event.data.payload?.lastActivityTs || null,
          status: event.data.payload?.status || 'idle',
          source: 'preview-overlay'
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [broadcastAuthState]);

  useEffect(() => {
    broadcastAuthState('auth:status', sessionUser);
  }, [sessionUser, broadcastAuthState]);

  // Initialize Socket.IO when user is logged in - with automatic reconnection
  useEffect(() => {
    const token = localStorage.getItem('accessToken');

    // Only initialize if we have a token and userRole, and we haven't initialized for this role yet
    if (token && userRole && (!socketInitializedRef.current || initializedRoleRef.current !== userRole)) {
      socketInitializedRef.current = true;
      initializedRoleRef.current = userRole;

      // Connect immediately
      socketService.connect(token)
        .then(() => {
          socketService.startActivityTracker(1000);
        })
        .catch(error => {
        });

      // Set up periodic connection check
      const connectionCheckInterval = setInterval(() => {
        if (!socketService.connected) {
          socketService.connect(token)
            .then(() => {
              socketService.startActivityTracker(1000);
              socketService.clearReconnectFlag();
            })
            .catch(error => {
            });
        }
      }, 5000); // Check every 5 seconds

      // Handle browser visibility changes (including minimize/restore)
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          // Page is visible (browser restored from minimize)
          if (socketService.shouldReconnectOnResume()) {
            socketService.connect(token)
              .then(() => {
                socketService.startActivityTracker(1000);
                socketService.clearReconnectFlag();
              })
              .catch(error => {
              });
          } else if (socketService.connected) {
            // Socket is connected, restart activity tracking
            socketService.startActivityTracker(1000);
          }
        } else if (document.visibilityState === 'hidden') {
          // Page is hidden (browser minimized)
        }
      };

      // Handle window focus/blur (minimize/restore)
      const handleFocus = () => {
        if (socketService.shouldReconnectOnResume()) {
          socketService.connect(token)
            .then(() => {
              socketService.startActivityTracker(1000);
              socketService.clearReconnectFlag();
            })
            .catch(error => {
            });
        }
      };

      const handleBlur = () => {
      };

      // Handle network online/offline events
      const handleOnline = () => {
        if (!socketService.connected) {
          socketService.connect(token)
            .then(() => {
              socketService.startActivityTracker(1000);
              socketService.clearReconnectFlag();
            })
            .catch(error => {
            });
        }
      };

      const handleOffline = () => {
      };

      // Add event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Cleanup on logout/unmount
      return () => {
        clearInterval(connectionCheckInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        socketService.stopActivityTracker();
        socketService.disconnect();
        socketInitializedRef.current = false;
        initializedRoleRef.current = null;
      };
    }
  }, [userRole]);

  // Optimize re-renders by memoizing the ProtectedRoute
  const ProtectedRoute = useMemo(() => {
    return ({ children, requiredRole }) => {
      if (!userRole) {
        return <Navigate to="/login" replace />;
      }

      if (requiredRole && !requiredRole.includes(userRole)) {
        return <Navigate to="/unauthorized" replace />;
      }

      return children;
    };
  }, [userRole]);

  const handleLogin = (user, accessToken, refreshToken) => {
    // Check if user is suspended before proceeding with login
    if (user?.status === 'suspended') {
      handleLogout();
      return;
    }
    
    const normalizedRole = normalizeRole(user?.role);
    const normalizedUser = { ...user, role: normalizedRole };
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setUserRole(normalizedRole);
    setSessionUser(normalizedUser);
    broadcastAuthState('auth:login', normalizedUser);
  };

  const handleLogout = (isSuspended = false) => {
    // Disconnect Socket.IO before clearing tokens
    socketService.disconnect();

    if (isSuspended) {
      // Show a message to the user if they were logged out due to suspension
      toast.error('Your account has been suspended. Please contact an administrator.');
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUserRole(null);
    setSessionUser(null);
    broadcastAuthState('auth:logout', null);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // If mobile device, show disabled page - after all hooks are called
  if (currentIsMobile) {
    return <MobileDisabled />;
  }

  return (
    <LoadingProvider>
      <Suspense fallback={<Loading size={80} bg="bg-black/20" />}>
        <Router>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
            style={{ marginTop: '30px' }}
            toastStyle={{ marginTop: '30px' }}
          />
          <Routes>
            <Route
              path="/login"
              element={!userRole ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />}
            />
            <Route
              path="/register"
              element={!userRole ? <Register /> : <Navigate to="/" replace />}
            />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
              <ProtectedRoute userRole={userRole} requiredRole={['admin']}>
                <Layout
                  activePage="dashboard"
                  isMobileOpen={isMobileOpen}
                  setIsMobileOpen={setIsMobileOpen}
                  userRole={userRole}
                  onLogout={handleLogout}
                >
                  <Routes>
                    <Route path="dashboard" element={<AdminDashboard userRole={userRole} />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="projects" element={<AdminProjects userRole={userRole} />} />
                    <Route path="tasks" element={<AdminTasks userRole={userRole} />} />
                    <Route path="events" element={<AdminEvents />} />
                    <Route path="departments" element={<AdminDepartments />} />
                    <Route path="positions" element={<AdminPositions />} />
                    <Route path="activities" element={<AdminActivities />} />
                    <Route path="attendance" element={<AdminAttendance />} />
                    <Route path="attendance-manage" element={<AdminAttendanceManage />} />
                    <Route path="referrals" element={<AdminReferrals />} />
                    <Route path="profile" element={<AdminProfile userRole={userRole} />} />
                    <Route path="" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />

            {/* Employee Routes */}
            <Route path="/employee/*" element={
              <ProtectedRoute userRole={userRole} requiredRole={['employee']}>
                <Layout
                  activePage="dashboard"
                  isMobileOpen={isMobileOpen}
                  setIsMobileOpen={setIsMobileOpen}
                  userRole={userRole}
                  onLogout={handleLogout}
                >
                  <Routes>
                    <Route path="dashboard" element={<EmployeeDashboard userRole={userRole} />} />
                    <Route path="attendance" element={<EmployeeAttendance userRole={userRole} />} />
                    <Route path="referrals" element={<EmployeeReferrals userRole={userRole} />} />
                    <Route path="projects" element={<EmployeeProjects userRole={userRole} />} />
                    <Route path="tasks" element={<EmployeeTasks userRole={userRole} />} />
                    <Route path="profile" element={<EmployeeProfile userRole={userRole} />} />
                    <Route path="" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />

            {/* Project Manager Routes */}
            <Route path="/pm/*" element={
              <ProtectedRoute userRole={userRole} requiredRole={['pm']}>
                <Layout
                  activePage="dashboard"
                  isMobileOpen={isMobileOpen}
                  setIsMobileOpen={setIsMobileOpen}
                  userRole={userRole}
                  onLogout={handleLogout}
                >
                  <Routes>
                    <Route path="dashboard" element={<PmDashboard userRole={userRole} />} />
                    <Route path="attendance" element={<PmAttendance userRole={userRole} />} />
                    <Route path="attendance-manage" element={<PmAttendanceManage />} />
                    <Route path="projects" element={<PmProjects userRole={userRole} />} />
                    <Route path="tasks" element={<PmTasks userRole={userRole} />} />
                    <Route path="users" element={<PmUsers userRole={userRole} />} />
                    <Route path="referrals" element={<PmReferrals userRole={userRole} />} />
                    <Route path="profile" element={<PmProfile userRole={userRole} />} />
                    <Route path="" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />

            {/* Interner Routes */}
            <Route path="/interners/*" element={
              <ProtectedRoute userRole={userRole} requiredRole={['interners']}>
                <Layout
                  activePage="dashboard"
                  isMobileOpen={isMobileOpen}
                  setIsMobileOpen={setIsMobileOpen}
                  userRole={userRole}
                  onLogout={handleLogout}
                >
                  <Routes>
                    <Route path="dashboard" element={<InternerDashboard userRole={userRole} />} />
                    <Route path="attendance" element={<InternerAttendance userRole={userRole} />} />
                    <Route path="referrals" element={<InternerReferrals userRole={userRole} />} />
                    <Route path="projects" element={<InternerProjects userRole={userRole} />} />
                    <Route path="tasks" element={<InternerTasks userRole={userRole} />} />
                    <Route path="profile" element={<InternerProfile userRole={userRole} />} />
                    <Route path="" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />

            {/* HR Routes */}
            <Route path="/hr/*" element={
              <ProtectedRoute userRole={userRole} requiredRole={['hr']}>
                <Layout
                  activePage="dashboard"
                  isMobileOpen={isMobileOpen}
                  setIsMobileOpen={setIsMobileOpen}
                  userRole={userRole}
                  onLogout={handleLogout}
                >
                  <Routes>
                    <Route path="dashboard" element={<HrDashboard userRole={userRole} />} />
                    <Route path="attendance" element={<HrAttendance userRole={userRole} />} />
                    <Route path="attendance-manage" element={<HrAttendanceManage />} />
                    <Route path="tasks" element={<HrTasks userRole={userRole} />} />
                    <Route path="projects" element={<HrProjects userRole={userRole} />} />
                    <Route path="referrals" element={<HrReferrals userRole={userRole} />} />
                    <Route path="users" element={<HrUsers userRole={userRole} />} />
                    <Route path="events" element={<HrEvents userRole={userRole} />} />
                    <Route path="profile" element={<HrProfile userRole={userRole} />} />
                    <Route path="" element={<Navigate to="dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />

            {/* Default redirect based on role */}
            <Route
              path="/"
              element={
                userRole === 'admin' ? <Navigate to="/admin/dashboard" replace /> :
                  userRole === 'pm' ? <Navigate to="/pm/dashboard" replace /> :
                    userRole === 'employee' ? <Navigate to="/employee/dashboard" replace /> :
                      userRole === 'interners' ? <Navigate to="/interners/dashboard" replace /> :
                        userRole === 'hr' ? <Navigate to="/hr/dashboard" replace /> :
                          <Navigate to="/login" replace />
              }
            />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </Suspense>
    </LoadingProvider>
  );
};

export default FuchsiusApp;
