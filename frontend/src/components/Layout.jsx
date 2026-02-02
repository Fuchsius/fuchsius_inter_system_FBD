import React from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ isMobileOpen, setIsMobileOpen, userRole, onLogout, children }) => {
  const location = useLocation();

  // Extract the current page from the path
  const getCurrentPage = () => {
    const pathSegments = location.pathname.split('/');
    return pathSegments[pathSegments.length - 1] || 'dashboard';
  };

  const currentPage = getCurrentPage();

  return (
    <motion.div 
      className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-[#C4009A] selection:text-white flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Sidebar
        activePage={currentPage}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        userRole={userRole}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden ml-0 lg:ml-64">
        <Header
          title={currentPage.charAt(0).toUpperCase() + currentPage.slice(1)}
          toggleMobileMenu={() => setIsMobileOpen(true)}
          userRole={userRole}
        />
        
        <main className="flex-1 pt-16 overflow-y-auto">
          <div className="p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </motion.div>
  );
};

export default Layout;
