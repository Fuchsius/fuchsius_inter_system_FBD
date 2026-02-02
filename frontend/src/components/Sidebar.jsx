import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderKanban, CheckSquare,
  Clock, Share2, Settings, LogOut, UserCog, Calendar, Building2, Briefcase, Activity
} from 'lucide-react';
import Button from './Button';
import logo from "../assets/logo.png"

const THEME = {
  gradient: "bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  gradientText: "bg-clip-text text-transparent bg-gradient-to-r from-[#7E006C] to-[#C4009A]",
  activeNav: "bg-gradient-to-r from-[#7E006C]/10 to-[#C4009A]/5 text-[#7E006C] border-l-4 border-[#C4009A]",
  inactiveNav: "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
};

const Sidebar = ({ activePage, isMobileOpen, setIsMobileOpen, userRole, onLogout }) => {
  const navigate = useNavigate();

  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'pm', 'employee', 'interners', 'hr'] },
    { id: 'projects', label: 'Projects', icon: FolderKanban, roles: ['admin', 'pm', 'employee', 'interners', 'hr'] },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, roles: ['admin', 'pm', 'employee', 'interners', 'hr'] },
    { id: 'events', label: 'Events', icon: Calendar, roles: ['admin', 'hr'] },
    { id: 'departments', label: 'Departments', icon: Building2, roles: ['admin'] },
    { id: 'positions', label: 'Positions', icon: Briefcase, roles: ['admin'] },
    { id: 'activities', label: 'Activities', icon: Activity, roles: ['admin'] },
    { id: 'attendance', label: 'Attendance', icon: Clock, roles: ['pm', 'employee', 'interners', 'hr'] },
    { id: 'attendance-manage', label: 'Manage Attendance', icon: UserCog, roles: ['admin', 'hr', 'pm'] },
    { id: 'users', label: 'Users', icon: Users, roles: ['admin', 'pm', 'hr'] },
    { id: 'referrals', label: 'Referrals', icon: Share2, roles: ['employee', 'admin', 'pm', 'interners', 'hr'] },
  ];

  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  const handleNavigation = (pageId) => {
    const basePath = userRole === 'admin' ? '/admin' :
      userRole === 'pm' ? '/pm' :
        userRole === 'interners' ? '/interners' :
          userRole === 'hr' ? '/hr' : '/employee';
    navigate(`${basePath}/${pageId}`);
    setIsMobileOpen(false);
  };

  return (
    <>
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-center h-16 border-b border-slate-200">
            <h1 className="text-xl font-bold text-[#7E006C]">Fuchsius</h1>
          </div>
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-2">
              {menuItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigation(item.id)}
                    className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${activePage === item.id ? THEME.activeNav : THEME.inactiveNav
                      }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="p-4 border-t border-slate-200">
            <button
              onClick={onLogout}
              className="w-full flex items-center px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-200 
        transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="h-16 flex items-center px-6 ">
          <div className="flex items-center gap-2">
            <img
              src={logo}
              alt="Fuchsius Logo"
              className="h-12 w-auto"
            />
          </div>
        </div>

        <div className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
          <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-2">Menu</p>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${activePage === item.id ? THEME.activeNav : THEME.inactiveNav
                }`}
            >
              <item.icon size={18} className={activePage === item.id ? "text-[#C4009A]" : "text-slate-400"} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={() => handleNavigation('profile')}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg mb-1 cursor-pointer ${activePage === 'profile' ? 'text-[#C4009A]' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Settings size={18} /> Settings
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
