import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { ClientDashboardView } from '../views/ClientDashboardView';

export const PortalCliente: React.FC = () => {
  const props = useOutletContext<any>();
  
  return (
    <div className="w-full space-y-8">
      <ClientDashboardView {...props} />
    </div>
  );
};

export default PortalCliente;
