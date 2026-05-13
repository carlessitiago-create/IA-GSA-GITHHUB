import React from 'react';
import { ProposalsTable } from '../components/GSA/ProposalsTable';

export const ProposalsManagerView: React.FC = () => {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-black uppercase tracking-tighter">Gerenciador de Propostas</h1>
      <div className="bg-white p-6 rounded-3xl shadow-sm">
        <ProposalsTable />
      </div>
    </div>
  );
};
