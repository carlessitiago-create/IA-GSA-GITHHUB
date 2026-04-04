import React from 'react';
import { ClientDashboardView } from '../../views/ClientDashboardView';

export const ClientDashboard = ({ processes, pendencies, showcaseLeads }: { processes: any[], pendencies: any[], showcaseLeads: any[] }) => {
  return <ClientDashboardView processes={processes} pendencies={pendencies} showcaseLeads={showcaseLeads} />;
};
