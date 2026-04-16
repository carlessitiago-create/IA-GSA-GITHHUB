import React from 'react';
import { Check, X, ExternalLink, Receipt, ArrowUpRight, Clock } from 'lucide-react';
import { motion } from 'motion/react';

export const FinancialTransactions = ({ pendingTransactions, clients, confirmarTransacao, sendNotification, sales, allUsers, setNotification, setIsConfirmingTransaction, setTransactionReceipt, currentProfile }: any) => {
  return (
    <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md">
      <div className="p-10 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
        <div className="flex items-center gap-6">
          <div className="size-14 bg-blue-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
            <Receipt size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#0a0a2e] uppercase italic tracking-tighter leading-none">Comprovantes Pendentes</h3>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2">Valide os comprovantes de pagamento enviados pelos clientes.</p>
          </div>
        </div>
        <button className="bg-white border border-slate-100 text-slate-400 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#0a0a2e] hover:text-white hover:border-[#0a0a2e] transition-all shadow-sm">
          Ver Histórico Completo
        </button>
      </div>
      <div className="md:hidden divide-y divide-slate-50">
        {pendingTransactions.map((trans: any) => (
          <div key={trans.id} className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-slate-100 rounded-xl flex items-center justify-center text-[#0a0a2e] font-black text-xs">
                  {(clients.find((c: any) => c.id === trans.cliente_id)?.nome_completo || '').substring(0, 2).toUpperCase() || 'CL'}
                </div>
                <div>
                  <p className="font-black text-[#0a0a2e] text-sm uppercase italic tracking-tight">
                    {clients.find((c: any) => c.id === trans.cliente_id)?.nome_completo || 'Cliente'}
                  </p>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">ID: #{trans.id?.slice(-8).toUpperCase()}</p>
                </div>
              </div>
              <p className="font-black text-emerald-600 italic text-base">
                R$ {trans.valor.toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-slate-100 text-slate-400 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest">{trans.origem}</span>
              <p className="text-[10px] text-slate-500 font-medium truncate">{trans.descricao}</p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              {trans.comprovante_url ? (
                <a 
                  href={trans.comprovante_url} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-50 text-blue-600 px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest"
                >
                  Ver Anexo <ExternalLink size={12} />
                </a>
              ) : (
                <span className="flex-1 text-center bg-slate-50 text-slate-400 px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest italic border border-slate-100">Sem anexo</span>
              )}
              
              <div className="flex gap-2">
                {['ADM_MASTER', 'ADM_GERENTE', 'GESTOR'].includes(currentProfile?.nivel) && (
                  trans.origem === 'SAQUE' ? (
                    <button 
                      onClick={() => {
                        setIsConfirmingTransaction(trans.id!);
                        setTransactionReceipt('');
                      }}
                      className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest"
                    >
                      Pagar
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={async () => {
                          try {
                            await confirmarTransacao(trans.id!, currentProfile!.uid);
                            setNotification({ message: 'Transação confirmada com sucesso!', type: 'success' });
                          } catch (err: any) {
                            setNotification({ message: err.message, type: 'error' });
                          }
                        }}
                        className="bg-emerald-500 text-white p-3 rounded-xl"
                      >
                        <Check size={18} />
                      </button>
                      <button className="bg-white border border-slate-100 text-slate-300 p-3 rounded-xl">
                        <X size={18} />
                      </button>
                    </>
                  )
                )}
                {!['ADM_MASTER', 'ADM_GERENTE', 'GESTOR'].includes(currentProfile?.nivel) && (
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    Aguardando Adm
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto no-scrollbar">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-white text-slate-400 border-b border-slate-50">
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Identificação do Cliente</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Valor da Transação</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em] hidden md:table-cell">Descrição / Origem</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em]">Documento Anexo</th>
              <th className="px-10 py-6 font-black uppercase text-[10px] tracking-[0.2em] text-right">Ações de Validação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pendingTransactions.map((trans: any) => (
              <tr key={trans.id} className="hover:bg-slate-50/50 transition-all group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-4">
                    <div className="size-12 bg-slate-100 rounded-[1rem] flex items-center justify-center text-[#0a0a2e] font-black text-sm group-hover:bg-[#0a0a2e] group-hover:text-white transition-all">
                      {(clients.find((c: any) => c.id === trans.cliente_id)?.nome_completo || '').substring(0, 2).toUpperCase() || 'CL'}
                    </div>
                    <div>
                      <p className="font-black text-[#0a0a2e] text-base uppercase italic tracking-tight group-hover:text-blue-600 transition-colors">
                        {clients.find((c: any) => c.id === trans.cliente_id)?.nome_completo || 'Cliente'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">ID: #{trans.id?.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8 font-black text-emerald-600 italic text-lg">
                  R$ {trans.valor.toLocaleString('pt-BR')}
                </td>
                <td className="px-10 py-8 text-slate-500 hidden md:table-cell max-w-xs">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-400 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{trans.origem}</span>
                    <p className="text-[11px] font-medium truncate">{trans.descricao}</p>
                  </div>
                </td>
                <td className="px-10 py-8">
                  {trans.comprovante_url ? (
                    <a 
                      href={trans.comprovante_url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    >
                      Ver Anexo <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="bg-slate-50 text-slate-400 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest italic border border-slate-100">Sem anexo</span>
                  )}
                </td>
                <td className="px-10 py-8 text-right">
                  <div className="flex justify-end gap-3">
                    {['ADM_MASTER', 'ADM_GERENTE', 'GESTOR'].includes(currentProfile?.nivel) && (
                      trans.origem === 'SAQUE' ? (
                        <button 
                          onClick={() => {
                            setIsConfirmingTransaction(trans.id!);
                            setTransactionReceipt('');
                          }}
                          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 transition-all shadow-sm"
                        >
                          Pagar Saque
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={async () => {
                              try {
                                await confirmarTransacao(trans.id!, currentProfile!.uid);
                                await sendNotification({
                                  usuario_id: trans.cliente_id,
                                  titulo: trans.origem === 'BONUS_INDICACAO' ? 'Bônus Disponível!' : 
                                          trans.origem === 'PAGAMENTO_PIX' ? 'Pagamento PIX Validado' : 'Pagamento Confirmado',
                                  mensagem: trans.origem === 'BONUS_INDICACAO' 
                                    ? `Você recebeu um bônus de R$ ${trans.valor.toLocaleString('pt-BR')}!` 
                                    : trans.origem === 'PAGAMENTO_PIX'
                                    ? `Seu pagamento de R$ ${trans.valor.toLocaleString('pt-BR')} foi validado e seu saldo atualizado.`
                                    : `Seu pagamento de R$ ${trans.valor.toLocaleString('pt-BR')} foi confirmado.`,
                                  tipo: 'FINANCIAL'
                                });

                                if (trans.venda_id) {
                                  const sale = sales.find((s: any) => s.id === trans.venda_id);
                                  if (sale) {
                                    await sendNotification({
                                      usuario_id: sale.vendedor_id,
                                      titulo: 'Pagamento Confirmado - Processo Iniciado',
                                      mensagem: `O pagamento da venda ${sale.protocolo} foi confirmado. O processo agora está visível e em andamento.`,
                                      tipo: 'PROCESS'
                                    });

                                    const seller = allUsers.find((u: any) => u.uid === sale.vendedor_id);
                                    if (seller && seller.id_superior) {
                                      await sendNotification({
                                        usuario_id: seller.id_superior,
                                        titulo: 'Novo Processo em Andamento',
                                        mensagem: `O pagamento da venda ${sale.protocolo} (Vendedor: ${seller.nome_completo}) foi confirmado e o processo foi iniciado.`,
                                        tipo: 'PROCESS'
                                      });
                                    }
                                  }
                                }
                                setNotification({ message: 'Transação confirmada com sucesso!', type: 'success' });
                              } catch (err: any) {
                                setNotification({ message: err.message, type: 'error' });
                              }
                            }}
                            className="bg-emerald-500 text-white p-3 rounded-2xl hover:bg-emerald-600 hover:shadow-xl hover:-translate-y-0.5 transition-all shadow-sm"
                            title="Confirmar"
                          >
                            <Check size={20} />
                          </button>
                          <button 
                            className="bg-white border border-slate-100 text-slate-300 p-3 rounded-2xl hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 hover:shadow-xl hover:-translate-y-0.5 transition-all shadow-sm"
                            title="Rejeitar"
                          >
                            <X size={20} />
                          </button>
                        </>
                      )
                    )}
                    {!['ADM_MASTER', 'ADM_GERENTE', 'GESTOR'].includes(currentProfile?.nivel) && (
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                        Aguardando Adm
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pendingTransactions.length === 0 && (
          <div className="p-20 text-center bg-slate-50/30 flex flex-col items-center gap-4">
            <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
              <Clock size={32} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum comprovante pendente</p>
              <p className="text-xs text-slate-400 mt-1">Tudo em dia com as validações financeiras.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
