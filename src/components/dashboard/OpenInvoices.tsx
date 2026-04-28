import React from 'react';
import Swal from 'sweetalert2';
import { ActionPanel } from '../Analyst/ActionPanel';

export const OpenInvoices = ({ sales, marcarFaturaVencida, atualizarInfosFatura, currentProfile, sendNotification, allUsers }: any) => {
  const isAnalyst = currentProfile?.role === 'ADM_ANALISTA' || currentProfile?.role === 'ADM_MASTER';

  const handleUpdateStatus = async (sale: any) => {
    const { value: formValues } = await Swal.fire({
      title: 'Atualizar Fatura',
      html: `
        <select id="status-select" class="swal2-input border p-2 rounded w-full">
          <option value="Pendente" ${sale.status_pagamento === 'Pendente' ? 'selected' : ''}>Pendente / Aguardando Pagamento</option>
          <option value="Vencida" ${sale.status_pagamento === 'Vencida' ? 'selected' : ''}>Em Atraso (Vencida)</option>
          <option value="Pago" ${sale.status_pagamento === 'Pago' ? 'selected' : ''}>Pago</option>
          <option value="Cancelado" ${sale.status_pagamento === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
        <input id="motivo-input" class="swal2-input border p-2 rounded w-full mt-3" placeholder="Motivo / Observação" value="${sale.fatura_motivo || ''}">
        <input id="atraso-input" type="number" class="swal2-input border p-2 rounded w-full mt-3" placeholder="Dias de Atraso" value="${sale.dias_atraso || 1}">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'ATUALIZAR STATUS',
      cancelButtonText: 'CANCELAR',
      preConfirm: () => {
        const selectElement = document.getElementById('status-select') as HTMLSelectElement;
        const motivoElement = document.getElementById('motivo-input') as HTMLInputElement;
        const atrasoElement = document.getElementById('atraso-input') as HTMLInputElement;
        
        return {
          status: selectElement?.value,
          motivo: motivoElement?.value,
          diasAtraso: atrasoElement?.value ? parseInt(atrasoElement.value) : 0
        }
      },
      customClass: {
        popup: 'rounded-[1.5rem]',
        confirmButton: 'bg-blue-600 rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest',
        cancelButton: 'bg-slate-100 text-slate-400 rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest'
      }
    });

    if (formValues) {
      if(atualizarInfosFatura) {
        await atualizarInfosFatura(sale.id, formValues.status, formValues.motivo, formValues.diasAtraso);
      } else {
        // Fallback backward compat
        if (formValues.status === 'Vencida') {
           await marcarFaturaVencida(sale.id, formValues.diasAtraso, currentProfile!.uid);
        }
      }
    }
  };

  const getDaysWaiting = (createdAt: any) => {
    if (!createdAt) return 0;
    const dataVenda = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dataVenda.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="bg-white rounded-3xl sm:rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm transition-all hover:shadow-md">
      <div className="p-6 sm:p-8 md:p-10 border-b border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg sm:text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">Faturas em Aberto</h3>
          <p className="text-slate-400 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-1 sm:mt-2">Gestão de Recebíveis</p>
        </div>
        <div className="bg-rose-50 px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border border-rose-100 shrink-0">
          <span className="text-[8px] sm:text-[10px] font-black text-rose-600 uppercase tracking-widest">
            {sales.filter((s: any) => s.status_pagamento === 'Vencida').length} VENCIDAS
          </span>
        </div>
      </div>
      <div className="md:hidden divide-y divide-slate-100">
        {sales.filter((s: any) => s.status_pagamento === 'Pendente' || s.status_pagamento === 'Vencida').map((sale: any) => (
          <div key={sale.id} className="p-5 space-y-4 bg-white hover:bg-slate-50/50 transition-colors">
            {/* Header: Status & Price */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-[0.1em] shadow-sm border ${
                    sale.status_pagamento === 'Vencida' 
                      ? 'bg-rose-500 text-white border-rose-400' 
                      : getDaysWaiting(sale.data_criacao) > 1
                        ? 'bg-orange-500 text-white border-orange-400 animate-pulse'
                        : 'bg-amber-500 text-white border-amber-400'
                  }`}>
                    {sale.status_pagamento}
                  </span>
                  {sale.status === 'PENDENCIA' && (
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[7px] font-black uppercase tracking-tight">
                      PENDÊNCIA
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight truncate leading-tight mt-1">
                  {sale.cliente_nome}
                </h4>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate bg-slate-50 w-fit px-2 py-0.5 rounded border border-slate-100">
                  {sale.servico_nome || 'Consultoria GSA'}
                </p>
                <div className="flex flex-col mt-2">
                   <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter"><span className="text-slate-400">Data Obj:</span> {sale.data_criacao?.toDate ? sale.data_criacao.toDate().toLocaleDateString('pt-BR') : 'N/A'}</p>
                   <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter"><span className="text-slate-400">Vendedor:</span> {sale.vendedor_nome || 'N/A'}</p>
                   
                   {getDaysWaiting(sale.data_criacao) > 1 && sale.status_pagamento !== 'Vencida' && sale.status_pagamento !== 'Pago' && (
                     <div className="mt-2 bg-orange-50 p-1.5 rounded border border-orange-200">
                        <p className="text-[9px] font-black italic text-orange-600">⚠️ {getDaysWaiting(sale.data_criacao)} DIAS AGUARDANDO PAGAMENTO</p>
                     </div>
                   )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-black text-[#0a0a2e] italic tracking-tighter">
                  R$ {sale.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">#{sale.protocolo}</p>
              </div>
            </div>

            {/* Atraso Alert */}
            {sale.dias_atraso && (
              <div className="bg-rose-50 p-2 rounded-xl flex items-center gap-2 border border-rose-100/50">
                <div className="size-1.5 bg-rose-500 rounded-full animate-pulse" />
                <p className="text-[10px] font-black text-rose-600 uppercase italic tracking-wider">
                  ⚠️ {sale.dias_atraso} dias de atraso detectados
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
                <button 
                  onClick={() => handleUpdateStatus(sale)}
                  className="flex-1 h-12 bg-[#0a0a2e] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-[0.98] transition-all"
                >
                  Gerenciar Fatura
                </button>
              {isAnalyst && (
                <div className="shrink-0 h-12">
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
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Protocolo</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Cliente</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Valor Total</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Status Pagamento</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Atraso</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em] text-right">Ações Rápidas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sales.filter((s: any) => s.status_pagamento === 'Pendente' || s.status_pagamento === 'Vencida').map((sale: any) => (
              <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-10 py-6">
                  <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 uppercase tracking-widest">
                    #{sale.protocolo}
                  </span>
                  <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">
                     {sale.data_criacao?.toDate ? sale.data_criacao.toDate().toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </td>
                <td className="px-10 py-6">
                  <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight group-hover:text-blue-600 transition-colors">{sale.cliente_nome}</p>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight truncate bg-slate-50 w-fit px-2 py-0.5 rounded border border-slate-100 mt-1">
                    {sale.servico_nome || 'Serviço GSA'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Vendedor: <span className="text-slate-600">{sale.vendedor_nome || 'N/A'}</span></p>
                </td>
                <td className="px-10 py-6">
                  <p className="text-base font-black text-[#0a0a2e] italic tracking-tighter">R$ {sale.valor_total.toLocaleString('pt-BR')}</p>
                </td>
                <td className="px-10 py-6">
                  <div className="flex flex-col gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit shadow-sm border ${
                      sale.status_pagamento === 'Vencida' 
                        ? 'bg-rose-500 text-white border-rose-400' 
                        : getDaysWaiting(sale.data_criacao) > 1
                          ? 'bg-orange-500 text-white border-orange-400 animate-pulse'
                          : 'bg-amber-500 text-white border-amber-400'
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
                <td className="px-10 py-6">
                  {getDaysWaiting(sale.data_criacao) > 1 && sale.status_pagamento !== 'Vencida' && sale.status_pagamento !== 'Pago' ? (
                     <div className="bg-orange-50 p-2 rounded-xl text-orange-600 flex items-center gap-2 border border-orange-200">
                        <p className="text-[9px] font-black uppercase tracking-widest italic flex items-center gap-1">
                           <span className="size-1.5 bg-orange-500 rounded-full animate-pulse block"></span>
                           {getDaysWaiting(sale.data_criacao)} Dias Aguardando
                        </p>
                     </div>
                  ) : sale.dias_atraso ? (
                    <div className="flex items-center gap-2 text-rose-600">
                      <div className="size-2 bg-rose-500 rounded-full animate-pulse" />
                      <p className="text-xs font-black uppercase italic tracking-tight">{sale.dias_atraso} dias</p>
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs font-black italic">No Prazo</span>
                  )}
                </td>
                <td className="px-10 py-6 text-right">
                  <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={() => handleUpdateStatus(sale)}
                        className="px-6 py-3 bg-white border border-blue-100 text-blue-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      >
                        Gerenciar
                      </button>
                    {isAnalyst && <ActionPanel venda={sale} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
