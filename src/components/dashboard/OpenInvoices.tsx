import React from 'react';
import Swal from 'sweetalert2';
import { ActionPanel } from '../Analyst/ActionPanel';

export const OpenInvoices = ({ sales, marcarFaturaVencida, currentProfile, sendNotification, allUsers }: any) => {
  const isAnalyst = currentProfile?.role === 'ADM_ANALISTA' || currentProfile?.role === 'ADM_MASTER';

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm transition-all hover:shadow-md">
      <div className="p-10 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">Faturas em Aberto</h3>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Gestão de Recebíveis e Inadimplência</p>
        </div>
        <div className="bg-rose-50 px-6 py-2 rounded-full border border-rose-100">
          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
            {sales.filter((s: any) => s.status_pagamento === 'Vencida').length} FATURAS VENCIDAS
          </span>
        </div>
      </div>
      <div className="md:hidden divide-y divide-slate-50">
        {sales.filter((s: any) => s.status_pagamento === 'Pendente' || s.status_pagamento === 'Vencida').map((sale: any) => (
          <div key={sale.id} className="p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest">
                  #{sale.protocolo}
                </span>
                <p className="text-sm font-black text-[#0a0a2e] uppercase italic tracking-tight">{sale.cliente_nome}</p>
              </div>
              <p className="text-base font-black text-[#0a0a2e] italic tracking-tighter">R$ {sale.valor_total.toLocaleString('pt-BR')}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest w-fit shadow-sm border ${
                  sale.status_pagamento === 'Vencida' 
                    ? 'bg-rose-500 text-white border-rose-400' 
                    : 'bg-amber-500 text-white border-amber-400'
                }`}>
                  {sale.status_pagamento}
                </span>
                {sale.dias_atraso && (
                  <div className="flex items-center gap-1 text-rose-600">
                    <div className="size-1.5 bg-rose-500 rounded-full animate-pulse" />
                    <p className="text-[9px] font-black uppercase italic">{sale.dias_atraso} dias</p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {sale.status_pagamento !== 'Vencida' && (
                  <button 
                    onClick={async () => {
                      const result = await Swal.fire({
                        title: 'Marcar como Vencida?',
                        text: "O cliente e o vendedor serão notificados.",
                        icon: 'warning',
                        input: 'number',
                        inputLabel: 'Dias de Atraso',
                        inputValue: 1,
                        showCancelButton: true,
                        confirmButtonText: 'Sim!',
                        cancelButtonText: 'Não',
                        customClass: {
                          popup: 'rounded-[2rem]',
                          confirmButton: 'bg-rose-600 rounded-xl px-6 py-2 font-black uppercase text-[10px]',
                          cancelButton: 'bg-slate-100 text-slate-400 rounded-xl px-6 py-2 font-black uppercase text-[10px]'
                        }
                      });
                      if (result.isConfirmed) {
                        await marcarFaturaVencida(sale.id, parseInt(result.value), currentProfile!.uid);
                      }
                    }}
                    className="px-4 py-2 bg-white border border-rose-100 text-rose-600 rounded-xl font-black text-[8px] uppercase tracking-widest"
                  >
                    Vencida
                  </button>
                )}
                {isAnalyst && <ActionPanel venda={sale} />}
              </div>
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
