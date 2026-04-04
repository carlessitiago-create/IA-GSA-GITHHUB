import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout';

export const AppRouter = (props: any) => {
    return (
        <Routes>
            <Route path="/" element={<DashboardLayout {...props} />}>
                {/* Routes will be added here */}
            </Route>
        </Routes>
    );
};
