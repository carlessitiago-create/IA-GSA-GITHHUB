import React from 'react';
import { IntelligenceDashboardView } from './IntelligenceDashboardView';
import { ClientDashboardView } from './ClientDashboardView';
import { FinanceiroView } from './FinanceiroView';
import { AdminSaasSettings } from '../components/GSA/AdminSaasSettings';
import { PointsSettingsView } from '../components/GSA/PointsSettingsView';

export const DashboardView = ({ view, props }: any) => {
    switch (view) {
        case 'intelligence':
            return <IntelligenceDashboardView {...props} />;
        case 'my_processes':
            return <ClientDashboardView {...props} />;
        case 'financeiro':
            return <FinanceiroView {...props} />;
        case 'saas_settings':
            return <AdminSaasSettings {...props} />;
        case 'admin_clube_settings':
            return <PointsSettingsView {...props} />;
        default:
            return <IntelligenceDashboardView {...props} />;
    }
};
