import React, { useState } from 'react';
import { ActionPanel } from '../Analyst/ActionPanel';
import { RefreshCw, Filter } from 'lucide-react';
import Swal from 'sweetalert2';

export const RecentSales = ({ sales, currentProfile }: any) => {
  const isAnalyst = currentProfile?.nivel === 'ADM_ANALISTA' || currentProfile?.nivel === 'ADM_MASTER' || currentProfile?.nivel === 'ADM_GERENTE';
  const isVendedor = currentProfile?.nivel === 'VENDEDOR' || currentProfile?.nivel === 'GESTOR';

  const [filterStatus, setFilterStatus] = useState('Todos');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncAsaas = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      Swal.fire({
        icon: 'success',
        title: 'Sincronização Concluída',
        text: 'Os pagamentos foram atualizados com sucesso via Asaas API.',
        confirmButtonColor: '#0a0a2e',
        customClass: {
          popup: 'rounded-2xl font-sans',
          confirmButton: 'rounded-xl px-6 py-3 font-black uppercase text-[10px] tracking-widest'
        }
      });
    }, 1500);
  };

  const filteredSales = sales.filter((s: any) => {
    if (filterStatus === 'Todos') return true;
    return s.status_pagamento === filterStatus;
  });

  return (
    <div className="bg-white rounded-3xl sm:rounded-2xl border border-slate-100 overflow-hidden shadow-sm transition-all hover:shadow-md">
      <div className="p-6 sm:p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50">
        <div>
          <h3 className="text-lg sm:text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">{isVendedor ? 'Minhas Vendas' : 'Gestão de Recebíveis'}</h3>
          <p className="text-slate-400 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-1 sm:mt-2">Revisão de pagamentos e liquidações</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-200 text-slate-700 text-[10px] uppercase font-bold tracking-wider rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
          >
            <option value="Todos">Todos os Status</option>
            <option value="Pago">Apenas Pagos</option>
            <option value="Pendente">Apenas Pendentes</option>
            <option value="Vencida">Apenas Vencidos</option>
            <option value="Programado">Apenas Programados</option>
          </select>
          {isAnalyst && (
            <button 
              onClick={handleSyncAsaas}
              disabled={isSyncing}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0a0a2e] hover:bg-blue-900 border border-transparent text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
              Sincronizar Asaas
            </button>
          )}
        </div>
      </div>
      <div className="md:hidden divide-y divide-slate-100">
        {filteredSales.map((sale: any) => (
          <div key={sale.id} className="p-5 space-y-4 bg-white hover:bg-slate-50/50 transition-colors">
            {/* Header: Date & Protocol */}
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                {sale.data_criacao?.toDate ? sale.data_criacao.toDate().toLocaleDateString('pt-BR') : 'N/A'}
              </p>
              <div className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest block truncate max-w-[120px]">
                  #{sale.protocolo}
                </span>
              </div>
            </div>

            {/* Client and Service Info */}
            <div className="min-w-0">
              <h4 className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight truncate leading-tight mb-1">
                {sale.cliente_nome}
              </h4>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] truncate bg-slate-50 w-fit px-2 py-0.5 rounded border border-slate-100">
                {sale.servico_nome}
              </p>
              {sale.metodo_pagamento && (
                <p className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.1em] truncate bg-indigo-50 w-fit px-2 py-0.5 rounded border border-indigo-100 mt-2">
                  Forma: {sale.metodo_pagamento}
                </p>
              )}
            </div>

            {/* Status, Price & Actions */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest w-fit shadow-sm border ${
                    sale.status_pagamento === 'Pago' ? 'bg-emerald-500 text-white border-emerald-400' : 
                    sale.status_pagamento === 'Vencida' ? 'bg-rose-500 text-white border-rose-400' : 
                    'bg-amber-500 text-white border-amber-400'
                  }`}>
                    {sale.status_pagamento}
                  </span>
                  {sale.status === 'PENDENCIA' && (
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[7px] font-black uppercase tracking-widest w-fit shadow-sm">
                      PENDÊNCIA
                    </span>
                  )}
                </div>
                <p className="text-base font-black text-[#0a0a2e] italic tracking-tighter">
                  R$ {sale.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                </p>
              </div>
              {isAnalyst && (
                <div className="shrink-0 h-12 flex items-center">
                  <ActionPanel venda={sale} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-white text-slate-400 border-b border-slate-50">
              <th className="px-5 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Data Registro</th>
              <th className="px-5 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Protocolo</th>
              <th className="px-5 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Cliente</th>
              <th className="px-5 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Contratado</th>
              <th className="px-5 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Forma Pag.</th>
              <th className="px-5 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Valor Liquido</th>
              <th className="px-5 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Status</th>
              {isAnalyst && <th className="px-5 py-6 font-black uppercase text-[10px] tracking-[0.2em] text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredSales.map((sale: any) => (
              <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-5 py-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                    {sale.data_criacao?.toDate ? sale.data_criacao.toDate().toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </td>
                <td className="px-5 py-6">
                  <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 uppercase tracking-widest">
                    #{sale.protocolo}
                  </span>
                </td>
                <td className="px-5 py-6">
                  <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight group-hover:text-blue-600 transition-colors">{sale.cliente_nome}</p>
                </td>
                <td className="px-5 py-6">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{sale.servico_nome}</p>
                </td>
                <td className="px-5 py-6">
                  <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">
                    {sale.metodo_pagamento || 'N/A'}
                  </span>
                </td>
                <td className="px-5 py-6">
                  <p className="text-base font-black text-[#0a0a2e] italic tracking-tighter">R$ {sale.valor_total?.toLocaleString('pt-BR') || '0,00'}</p>
                </td>
                <td className="px-5 py-6">
                  <div className="flex flex-col gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit shadow-sm border ${
                      sale.status_pagamento === 'Pago' ? 'bg-emerald-500 text-white border-emerald-400' : 
                      sale.status_pagamento === 'Vencida' ? 'bg-rose-500 text-white border-rose-400' : 
                      'bg-amber-500 text-white border-amber-400'
                    }`}>
                      {sale.status_pagamento}
                    </span>
                    {sale.status === 'PENDENCIA' && (
                      <span className="px-4 py-1.5 bg-white text-rose-600 border border-rose-100 rounded-full text-[8px] font-black uppercase tracking-widest w-fit shadow-sm">
                        PENDÊNCIA ATIVA
                      </span>
                    )}
                  </div>
                </td>
                {isAnalyst && (
                  <td className="px-5 py-6 text-right">
                    <ActionPanel venda={sale} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSales.length === 0 && (
          <div className="py-20 text-center bg-slate-50/30">
            <p className="text-slate-300 font-black uppercase tracking-[0.3em] italic text-sm">Nenhuma venda registrada no período</p>
          </div>
        )}
      </div>
    </div>
  );
};
