import React from 'react';
import { IncluirVendaDireta } from '../components/Admin/IncluirVendaDireta';

export function NovaVendaAdminView() {
  return (
    <div className="responsive-container pb-10 sm:pb-20 mt-10">
      <div className="mx-auto max-w-2xl">
        <IncluirVendaDireta />
      </div>
    </div>
  );
}
