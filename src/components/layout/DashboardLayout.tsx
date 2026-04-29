import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../GSA/Sidebar';
import { Header } from '../GSA/Header';

export const DashboardLayout = ({ 
    view, 
    setView, 
    currentProfile, 
    isAdm, 
    isAdmMasterOrGerente, 
    isGestor, 
    notifications, 
    isMobileMenuOpen, 
    setIsMobileMenuOpen, 
    realIsAdm, 
    simulatedRole, 
    setSimulatedRole, 
    profile, 
    logout, 
    managerPhone, 
    walletBalance, 
    isNotificationOpen, 
    setIsNotificationOpen, 
    markAsRead 
}: any) => {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
            <Sidebar 
                view={view}
                setView={setView}
                currentProfile={currentProfile}
                isAdm={isAdm}
                isAdmMasterOrGerente={isAdmMasterOrGerente}
                isGestor={isGestor}
                notifications={notifications}
                isOpen={isMobileMenuOpen}
                setIsOpen={setIsMobileMenuOpen}
                realIsAdm={realIsAdm}
                simulatedRole={simulatedRole}
                setSimulatedRole={setSimulatedRole}
                profile={profile}
                logout={logout}
            />

            <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
                <Header 
                    view={view}
                    currentProfile={currentProfile}
                    onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    onLogout={logout}
                    managerPhone={managerPhone}
                    walletBalance={walletBalance}
                    pointsBalance={currentProfile?.saldo_pontos || 0}
                    isNotificationOpen={isNotificationOpen}
                    setIsNotificationOpen={setIsNotificationOpen}
                    notifications={notifications}
                    markAsRead={markAsRead}
                    setView={setView}
                />

                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
