import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { IntelligenceDashboardView } from '../views/IntelligenceDashboardView';
import { ClientDashboardView } from '../views/ClientDashboardView';
import { FinanceiroView } from '../views/FinanceiroView';

export const DashboardLayout = ({ props }: any) => {
    return (
        <Routes>
            <Route path="/intelligence" element={<IntelligenceDashboardView {...props} />} />
            <Route path="/my_processes" element={<ClientDashboardView {...props} />} />
            <Route path="/financeiro" element={<FinanceiroView {...props} />} />
            <Route path="*" element={<Navigate to="/intelligence" />} />
        </Routes>
    );
};
