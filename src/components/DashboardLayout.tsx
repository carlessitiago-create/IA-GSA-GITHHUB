import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './GSA/Sidebar';
import { Header } from './GSA/Header';
import { useAuth } from './AuthContext';
import { LoadingScreen } from './LoadingScreen';

export const DashboardLayout: React.FC = () => {
  const { profile, logout, loading } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  if (loading) return <LoadingScreen />;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  // Get current view from path
  const currentView = location.pathname.substring(1) || 'dashboard';

  // Props for Header
  const headerProps = {
    view: currentView,
    currentProfile: profile,
    onMenuToggle: toggleSidebar,
    onLogout: logout,
    managerPhone: null,
    walletBalance: 0, // Should be fetched from a financial context or global state
    pointsBalance: profile?.saldo_pontos || 0,
    isNotificationOpen,
    setIsNotificationOpen,
    notifications: [], // Should be fetched from a notification context
    markAsRead: () => {},
    setView: () => {}, // Handled by real routing now
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar currentProfile={profile} logout={logout} onClose={closeSidebar} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Header {...headerProps} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50/50">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
