import React from 'react';
import { formatDate } from '../lib/dateUtils';
import { motion } from 'motion/react';

interface PendingTransactionsProps {
  pendingTransactions: any[];
  onConfirm: (trans: any) => void;
  // Add other necessary props
}

export const PendingTransactions: React.FC<PendingTransactionsProps> = ({ pendingTransactions, onConfirm }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
        <h3 className="text-lg font-black text-[#0a0a2e] dark:text-white uppercase tracking-tight">Comprovantes Pendentes</h3>
      </div>
      <table className="w-full">
        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] uppercase">
          <tr>
            <th className="px-6 py-4 text-left">Data</th>
            <th className="px-6 py-4 text-left">Origem</th>
            <th className="px-6 py-4 text-right">Valor</th>
            <th className="px-6 py-4 text-center">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {pendingTransactions.map((trans) => (
            <tr key={trans.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                {formatDate(trans.data)}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                {trans.origem}
              </td>
              <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                R$ {trans.valor.toLocaleString('pt-BR')}
              </td>
              <td className="px-6 py-4 text-center">
                <button
                  onClick={() => onConfirm(trans)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-emerald-700 transition-all"
                >
                  Confirmar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pendingTransactions.length === 0 && (
        <div className="py-10 text-center text-slate-400 italic text-sm">
          Nenhum comprovante pendente de validação.
        </div>
      )}
    </div>
  );
};
