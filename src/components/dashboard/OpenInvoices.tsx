import React from 'react';
import Swal from 'sweetalert2';
import { ActionPanel } from '../Analyst/ActionPanel';

export const OpenInvoices = ({ sales, marcarFaturaVencida, currentProfile, sendNotification, allUsers }: any) => {
  const isAnalyst = currentProfile?.role === 'ADM_ANALISTA' || currentProfile?.role === 'ADM_MASTER';

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
                <h4 className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight truncate leading-tight">
                  {sale.cliente_nome}
                </h4>
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
              {sale.status_pagamento !== 'Vencida' ? (
                <button 
                  onClick={async () => {
                    const result = await Swal.fire({
                      title: 'Confirmar Atraso',
                      text: "Deseja marcar esta fatura como vencida?",
                      icon: 'warning',
                      input: 'number',
                      inputLabel: 'Dias de Atraso',
                      inputValue: 1,
                      showCancelButton: true,
                      confirmButtonText: 'MARCAR AGORA',
                      cancelButtonText: 'CANCELAR',
                      customClass: {
                        popup: 'rounded-[1.5rem]',
                        confirmButton: 'bg-rose-600 rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest',
                        cancelButton: 'bg-slate-100 text-slate-400 rounded-xl px-4 py-2 font-black uppercase text-[10px] tracking-widest'
                      }
                    });
                    if (result.isConfirmed) {
                      await marcarFaturaVencida(sale.id, parseInt(result.value), currentProfile!.uid);
                    }
                  }}
                  className="flex-1 h-12 bg-[#0a0a2e] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg active:scale-[0.98] transition-all"
                >
                  Marcar Vencida
                </button>
              ) : (
                <div className="flex-1 h-12 bg-rose-600/5 rounded-xl border border-rose-100 flex items-center justify-center">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">SLA Bloqueado</p>
                </div>
              )}
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
                </td>
                <td className="px-10 py-6">
                  <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight group-hover:text-blue-600 transition-colors">{sale.cliente_nome}</p>
                </td>
                <td className="px-10 py-6">
                  <p className="text-base font-black text-[#0a0a2e] italic tracking-tighter">R$ {sale.valor_total.toLocaleString('pt-BR')}</p>
                </td>
                <td className="px-10 py-6">
                  <div className="flex flex-col gap-2">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest w-fit shadow-sm border ${
                      sale.status_pagamento === 'Vencida' 
                        ? 'bg-rose-500 text-white border-rose-400' 
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
                  {sale.dias_atraso ? (
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
                    {sale.status_pagamento !== 'Vencida' && (
                      <button 
                        onClick={async () => {
                          const result = await Swal.fire({
                            title: 'Marcar como Vencida?',
                            text: "O cliente e o vendedor serão notificados e o processo suspenso.",
                            icon: 'warning',
                            input: 'number',
                            inputLabel: 'Dias de Atraso',
                            inputValue: 1,
                            showCancelButton: true,
                            confirmButtonText: 'Sim, marcar!',
                            cancelButtonText: 'Cancelar',
                            customClass: {
                              popup: 'rounded-[2rem]',
                              confirmButton: 'bg-rose-600 rounded-xl px-8 py-3 font-black uppercase text-xs tracking-widest',
                              cancelButton: 'bg-slate-100 text-slate-400 rounded-xl px-8 py-3 font-black uppercase text-xs tracking-widest'
                            }
                          });
                          if (result.isConfirmed) {
                            await marcarFaturaVencida(sale.id, parseInt(result.value), currentProfile!.uid);
                            await sendNotification({
                              usuario_id: sale.cliente_id,
                              titulo: 'Fatura Vencida',
                              mensagem: `Sua fatura ${sale.protocolo} foi marcada como vencida.`,
                              tipo: 'FINANCIAL'
                            });
                          }
                        }}
                        className="px-6 py-3 bg-white border border-rose-100 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                      >
                        Marcar Vencida
                      </button>
                    )}
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
