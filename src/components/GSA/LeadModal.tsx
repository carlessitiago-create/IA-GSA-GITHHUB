import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Clock, User, CheckCircle2, MessageSquare, ArrowRight, DollarSign, Link as LinkIcon, FileText } from 'lucide-react';
import { ShowcaseLead, LeadStatus, atualizarStatusLeadVitrine, reatribuirEspecialistaLeadVitrine } from '../../services/marketingService';
import { UserProfile } from '../../services/userService';
import { processarVenda } from '../../services/vendaService';
import { sendNotification } from '../../services/notificationService';

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: ShowcaseLead | null;
  currentUser: any | null;
  allUsers: any[];
  services: any[];
  onUpdate: () => void;
}

export const LeadModal: React.FC<LeadModalProps> = ({ isOpen, onClose, lead, currentUser, allUsers, services, onUpdate }) => {
  const [newStatus, setNewStatus] = useState<LeadStatus | ''>('');
  const [message, setMessage] = useState('');
  const [propostaDetalhes, setPropostaDetalhes] = useState('');
  const [negociacaoDetalhes, setNegociacaoDetalhes] = useState('');
  const [valorAVistaDe, setValorAVistaDe] = useState('');
  const [valorAVistaPara, setValorAVistaPara] = useState('');
  const [valorEntrada, setValorEntrada] = useState('');
  const [parcelas, setParcelas] = useState('');
  const [valorParcela, setValorParcela] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [metodoPagamento, setMetodoPagamento] = useState<'PIX' | 'CARTEIRA'>('PIX');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVendedorId, setSelectedVendedorId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  if (!lead) return null;

  const client = allUsers.find(u => u.uid === lead.cliente_id);
  const vendedor = allUsers.find(u => u.uid === lead.vendedor_id);
  const service = services.find(s => s.id === lead.servico_id);

  const statuses: LeadStatus[] = [
    'Novo', 
    'Em Atendimento', 
    'Qualificado', 
    'Proposta Enviada', 
    'Negociação', 
    'Venda Concluída', 
    'Perdido'
  ];

  const handleUpdateStatus = async () => {
    if (!newStatus || !currentUser) return;
    setIsSubmitting(true);
    try {
      let finalMessage = message;
      let proposta: any = undefined;

      if (newStatus === 'Proposta Enviada' || newStatus === 'Negociação') {
        proposta = {
          valorAVistaDe,
          valorAVistaPara,
          valorEntrada,
          parcelas,
          valorParcela,
          detalhesExtras: newStatus === 'Proposta Enviada' ? propostaDetalhes : negociacaoDetalhes
        };
      }

      if (newStatus === 'Proposta Enviada' && propostaDetalhes) {
        finalMessage = `Proposta: ${propostaDetalhes}\n${message}`;
      } else if (newStatus === 'Negociação' && negociacaoDetalhes) {
        finalMessage = `Detalhes da Negociação: ${negociacaoDetalhes}\n${message}`;
      } else if (newStatus === 'Venda Concluída') {
        if (!service || !client || !lead.vendedor_id) {
          throw new Error('Dados incompletos para gerar a venda.');
        }
        
        const precoVendaNum = parseFloat(precoVenda.replace(/\./g, '').replace(',', '.'));
        if (isNaN(precoVendaNum) || precoVendaNum <= 0) {
          throw new Error('Preço de venda inválido.');
        }

        const precoBase = currentUser.role === 'GESTOR' ? service.preco_base_gestor : service.preco_base_vendedor;

        // Create the sale and process
        const result = await processarVenda(
          client.uid,
          [{
            servicoId: service.id,
            servicoNome: service.nome,
            precoBase: precoBase,
            precoVenda: precoVendaNum,
            prazoEstimadoDias: service.prazo_estimado_dias
          }],
          metodoPagamento,
          '', // No comprovante yet
          client.nome
        );

        finalMessage = `Venda concluída no valor de R$ ${precoVendaNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Novo processo gerado (ID: ${result.saleId}).\n${message}`;
      }

      await atualizarStatusLeadVitrine(
        lead.id!, 
        newStatus as LeadStatus, 
        currentUser.uid, 
        currentUser.nome, 
        finalMessage,
        proposta
      );
      
      onUpdate();
      setNewStatus('');
      setMessage('');
      setPropostaDetalhes('');
      setNegociacaoDetalhes('');
      setValorAVistaDe('');
      setValorAVistaPara('');
      setValorEntrada('');
      setParcelas('');
      setValorParcela('');
      setPrecoVenda('');
      setMetodoPagamento('PIX');
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Erro ao atualizar status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignVendedor = async () => {
    if (!selectedVendedorId || !currentUser || !lead.id) return;
    setIsAssigning(true);
    try {
      await reatribuirEspecialistaLeadVitrine(lead.id, selectedVendedorId);
      
      const selectedUser = allUsers.find(u => u.uid === selectedVendedorId);
      if (selectedUser) {
        await sendNotification({
          usuario_id: selectedVendedorId,
          titulo: 'Novo Lead Atribuído',
          mensagem: `Você foi atribuído a um novo lead da vitrine: ${client?.nome || 'Cliente'}`,
          tipo: 'STATUS_CHANGE'
        });
      }
      
      onUpdate();
      setSelectedVendedorId('');
    } catch (error: any) {
      console.error(error);
      alert('Erro ao atribuir especialista.');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 mx-4"
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Gerenciar Lead</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Acompanhamento de Intenção de Compra</p>
              </div>
              <button onClick={onClose} className="p-3 hover:bg-white dark:hover:bg-slate-700 rounded-2xl transition-all shadow-sm">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-4 md:p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Informações do Cliente</h3>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="size-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                      <User size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white">{client?.nome || 'Desconhecido'}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase">{client?.email}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Especialista Responsável</h3>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="size-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center shrink-0">
                      <CheckCircle2 size={20} className="text-amber-600" />
                    </div>
                    <div className="flex-1">
                      {(currentUser?.role === 'ADM_MASTER' || currentUser?.role === 'ADM_GERENTE') && (!vendedor || lead.vendedor_id === 'ADM') ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedVendedorId}
                            onChange={(e) => setSelectedVendedorId(e.target.value)}
                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 dark:text-white outline-none"
                          >
                            <option value="">Atribuir Especialista...</option>
                            {allUsers
                              .filter(u => u.role === 'GESTOR' || u.role === 'VENDEDOR')
                              .map(u => (
                                <option key={u.uid} value={u.uid}>{u.nome} ({u.role})</option>
                              ))
                            }
                          </select>
                          <button
                            onClick={handleAssignVendedor}
                            disabled={!selectedVendedorId || isAssigning}
                            className="bg-[#0a0a2e] text-white px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                          >
                            {isAssigning ? 'Atribuindo...' : 'Atribuir'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="font-bold text-slate-800 dark:text-white">{vendedor?.nome || 'Não Atribuído'}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{vendedor?.role}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 mb-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Atualizar Status</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Novo Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as LeadStatus)}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    >
                      <option value="">Selecione um status...</option>
                      {statuses.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Mensagem/Nota</label>
                    <input
                      type="text"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Ex: Proposta enviada via WhatsApp"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {(newStatus === 'Proposta Enviada' || newStatus === 'Negociação') && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4 bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                    <h4 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                      <DollarSign size={14} /> Detalhes da Oferta
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Valor à Vista (De)</label>
                        <input
                          type="text"
                          value={valorAVistaDe}
                          onChange={(e) => setValorAVistaDe(e.target.value)}
                          placeholder="Ex: R$ 1.500,00"
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Valor à Vista (Para)</label>
                        <input
                          type="text"
                          value={valorAVistaPara}
                          onChange={(e) => setValorAVistaPara(e.target.value)}
                          placeholder="Ex: R$ 1.200,00"
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Valor Entrada</label>
                        <input
                          type="text"
                          value={valorEntrada}
                          onChange={(e) => setValorEntrada(e.target.value)}
                          placeholder="Ex: R$ 500,00"
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Qtd Parcelas</label>
                        <input
                          type="text"
                          value={parcelas}
                          onChange={(e) => setParcelas(e.target.value)}
                          placeholder="Ex: 10"
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Valor Parcela</label>
                        <input
                          type="text"
                          value={valorParcela}
                          onChange={(e) => setValorParcela(e.target.value)}
                          placeholder="Ex: R$ 100,00"
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>

                    {newStatus === 'Proposta Enviada' && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1"><LinkIcon size={12} /> Link ou Detalhes da Proposta</label>
                        <input
                          type="text"
                          value={propostaDetalhes}
                          onChange={(e) => setPropostaDetalhes(e.target.value)}
                          placeholder="Ex: https://drive.google.com/... ou 'Proposta PDF enviada'"
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    )}

                    {newStatus === 'Negociação' && (
                      <div className="space-y-2 pt-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1"><FileText size={12} /> Relato da Negociação</label>
                        <textarea
                          value={negociacaoDetalhes}
                          onChange={(e) => setNegociacaoDetalhes(e.target.value)}
                          placeholder="Descreva como está a negociação, objeções do cliente, etc."
                          className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[80px] resize-none"
                        />
                      </div>
                    )}
                  </motion.div>
                )}

                {newStatus === 'Venda Concluída' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase ml-1 flex items-center gap-1"><DollarSign size={12} /> Valor Fechado (R$)</label>
                      <input
                        type="text"
                        value={precoVenda}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val) {
                            val = (parseInt(val) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          }
                          setPrecoVenda(val);
                        }}
                        placeholder="0,00"
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase ml-1">Método de Pagamento</label>
                      <select
                        value={metodoPagamento}
                        onChange={(e) => setMetodoPagamento(e.target.value as 'PIX' | 'CARTEIRA')}
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        <option value="PIX">PIX</option>
                        <option value="CARTEIRA">Saldo da Carteira</option>
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold italic">
                        * Ao salvar, um novo processo será gerado automaticamente para o cliente.
                      </p>
                    </div>
                  </motion.div>
                )}

                <button
                  onClick={handleUpdateStatus}
                  disabled={!newStatus || isSubmitting}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black uppercase italic tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Atualizando...' : (
                    <>
                      Atualizar Status <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Histórico de Inteligência</h3>
                <div className="space-y-4">
                  {lead.historico?.slice().reverse().map((item, idx) => (
                    <div key={idx} className="relative pl-8 pb-4 border-l-2 border-slate-100 dark:border-slate-800 last:pb-0">
                      <div className="absolute -left-[9px] top-0 size-4 bg-white dark:bg-slate-900 border-2 border-blue-500 rounded-full" />
                      <div className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{item.status_anterior}</span>
                            <ArrowRight size={10} className="text-slate-400" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{item.novo_status}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
                            <Clock size={10} />
                            {item.timestamp && (item.timestamp as any).toDate ? (item.timestamp as any).toDate().toLocaleString() : item.timestamp ? new Date(item.timestamp as any).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 italic">"{item.mensagem}"</p>
                        <div className="flex items-center gap-2">
                          <div className="size-5 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                            <User size={10} className="text-slate-500" />
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{item.autor_nome}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!lead.historico || lead.historico.length === 0) && (
                    <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                      <MessageSquare size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-400 uppercase">Nenhum histórico registrado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
