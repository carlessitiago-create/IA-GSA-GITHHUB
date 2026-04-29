import React from 'react';
import { IntelligenceDashboardView } from '../views/IntelligenceDashboardView';
import { ClientDashboardView } from '../views/ClientDashboardView';
import { FinanceiroView } from '../views/FinanceiroView';

export const DashboardContent = ({ view, props }: any) => {
    switch (view) {
        case 'intelligence':
            return <IntelligenceDashboardView {...props} />;
        case 'my_processes':
            return <ClientDashboardView {...props} />;
        case 'financeiro':
            return <FinanceiroView {...props} />;
        default:
            return <IntelligenceDashboardView {...props} />;
    }
};
