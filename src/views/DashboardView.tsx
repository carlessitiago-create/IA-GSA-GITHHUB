import React from 'react';
import { IntelligenceDashboardView } from './IntelligenceDashboardView';
import { ClientDashboardView } from './ClientDashboardView';
import { FinanceiroView } from './FinanceiroView';
import { AdminSaasSettings } from '../components/GSA/AdminSaasSettings';

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
        default:
            return <IntelligenceDashboardView {...props} />;
    }
};
