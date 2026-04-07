import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { AlertCircle, CheckCircle2, Clock, User, Shield, ArrowRight, Upload, ClipboardList, ChevronRight } from 'lucide-react';
import { PendingIssue, OrderProcess } from '../../services/orderService';
import Swal from 'sweetalert2';
import { FileUploader } from './FileUploader';
import { SmartFicha } from './SmartFicha';
import { motion, AnimatePresence } from 'motion/react';

export const PendencyList: React.FC = () => {
  const { profile } = useAuth();
  const [pendencies, setPendencies] = useState<PendingIssue[]>([]);
  const [processPendencies, setProcessPendencies] = useState<OrderProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSmartFicha, setShowSmartFicha] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;

    const nivel = profile.nivel;
    const uid = profile.uid;

    // 1. Buscar Pendências Manuais
    let qManual;
    const pendenciesRef = collection(db, 'pendencies');

    if (nivel === 'ADM_MASTER' || nivel === 'ADM_ANALISTA' || nivel === 'ADM_GERENTE') {
      qManual = query(pendenciesRef, orderBy('criadaEm', 'desc'));
    } else if (nivel === 'GESTOR' && uid) {
      qManual = query(pendenciesRef, where('id_superior', '==', uid), orderBy('criadaEm', 'desc'));
    } else if (nivel === 'VENDEDOR' && uid) {
      qManual = query(pendenciesRef, where('vendedor_id', '==', uid), orderBy('criadaEm', 'desc'));
    } else if (nivel === 'CLIENTE' && uid) {
      qManual = query(
        pendenciesRef, 
        where('status_pendencia', '==', 'ENVIADO_CLIENTE'),
        where('cliente_id', '==', uid),
        orderBy('criadaEm', 'desc')
      );
    } else {
      qManual = query(pendenciesRef, where('criado_por_id', '==', uid), orderBy('criadaEm', 'desc'));
    }

    const unsubManual = onSnapshot(qManual, (snapshot) => {
      setPendencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingIssue)));
    });

    // 2. Buscar Processos com Dados/Docs Faltantes
    let qProc;
    const processesRef = collection(db, 'order_processes');
    const pendingStatuses = ['Aguardando Documentação', 'Pendente'];

    if (nivel === 'ADM_MASTER' || nivel === 'ADM_ANALISTA' || nivel === 'ADM_GERENTE') {
      qProc = query(processesRef, where('status_atual', 'in', pendingStatuses));
    } else if (nivel === 'GESTOR' && uid) {
      qProc = query(processesRef, where('id_superior', '==', uid), where('status_atual', 'in', pendingStatuses));
    } else if (nivel === 'VENDEDOR' && uid) {
      qProc = query(processesRef, where('vendedor_id', '==', uid), where('status_atual', 'in', pendingStatuses));
    } else if (nivel === 'CLIENTE' && uid) {
      qProc = query(processesRef, where('cliente_id', '==', uid), where('status_atual', 'in', pendingStatuses));
    }

    const unsubProc = qProc ? onSnapshot(qProc, (snapshot) => {
      const procs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OrderProcess));
      // Filtrar apenas os que realmente têm pendências de dados ou docs
      const filtered = procs.filter(p => 
        (p.dados_faltantes && p.dados_faltantes.length > 0) || 
        (p.pendencias_iniciais && p.pendencias_iniciais.length > 0) ||
        !p.cliente_cpf_cnpj || !p.data_nascimento
      );
      setProcessPendencies(filtered);
      setLoading(false);
    }) : () => setLoading(false);

    return () => {
      unsubManual();
      unsubProc();
    };
  }, [profile]);

  const handleResolve = async (id: string, vendaId: string, processoId?: string) => {
    try {
      const { value: text } = await Swal.fire({
        title: 'Resolver Pendência',
        input: 'textarea',
        inputLabel: 'Descreva a resolução',
        inputPlaceholder: 'Ex: Documento enviado, dados corrigidos...',
        inputAttributes: {
          'aria-label': 'Descreva a resolução'
        },
        showCancelButton: true,
        confirmButtonText: 'Resolver',
        cancelButtonText: 'Cancelar'
      });

      if (text) {
        const pendency = pendencies.find(p => p.id === id);
        const resolvidaEm = Timestamp.now();
        let tempoResolucaoSegundos = 0;

        if (pendency && pendency.criadaEm) {
          tempoResolucaoSegundos = (resolvidaEm.toMillis() - pendency.criadaEm.toMillis()) / 1000;
        }

        await updateDoc(doc(db, 'pendencies', id), {
          status_pendencia: 'RESOLVIDO',
          resolvidaEm: resolvidaEm,
          resolucao: text,
          tempoResolucaoSegundos: tempoResolucaoSegundos
        });

        // 1. Volta a venda para 'EM ANÁLISE' se houver vendaId
        if (vendaId) {
          await updateDoc(doc(db, 'sales', vendaId), {
            status: 'EM ANÁLISE'
          });
        }

        // 2. Se houver um processo vinculado, atualiza o status dele também
        if (processoId) {
          await updateDoc(doc(db, 'order_processes', processoId), {
            status_atual: 'Em Análise',
            status_info_extra: 'PENDÊNCIA RESOLVIDA: Aguardando nova conferência.'
          });
        }

        Swal.fire('Sucesso', 'Pendência resolvida! A venda voltou para análise.', 'success');
      }
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDoc(doc(db, 'pendencies', id), {
        status_pendencia: 'ENVIADO_CLIENTE',
        aprovadoEm: Timestamp.now(),
        aprovadoPor: profile?.uid
      });
      Swal.fire('Sucesso', 'Pendência aprovada e enviada ao cliente.', 'success');
    } catch (error: any) {
      Swal.fire('Erro', error.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const activeManualPendencies = pendencies.filter(p => p.status_pendencia !== 'RESOLVIDO');
  const resolvedPendencies = pendencies.filter(p => p.status_pendencia === 'RESOLVIDO');
  const totalActive = activeManualPendencies.length + processPendencies.length;

  return (
    <div className="space-y-12 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-8 group hover:shadow-2xl transition-all duration-500 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
            <AlertCircle size={100} className="text-rose-600" />
          </div>
          <div className="size-20 bg-rose-50 rounded-[1.8rem] flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform shadow-inner relative z-10">
            <AlertCircle size={36} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-2">Pendências Ativas</p>
            <h3 className="text-5xl font-black text-[#0a0a2e] italic tracking-tighter leading-none">{totalActive}</h3>
            <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-3">Ações imediatas requeridas</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-10 bg-white rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-8 group hover:shadow-2xl transition-all duration-500 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
            <CheckCircle2 size={100} className="text-emerald-600" />
          </div>
          <div className="size-20 bg-emerald-50 rounded-[1.8rem] flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-inner relative z-10">
            <CheckCircle2 size={36} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-2">Resolvidas</p>
            <h3 className="text-5xl font-black text-[#0a0a2e] italic tracking-tighter leading-none">{resolvedPendencies.length}</h3>
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-3">Histórico de correções GSA</p>
          </div>
        </motion.div>
      </div>

      <div className="space-y-8">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="size-2 bg-rose-500 rounded-full animate-pulse" />
            <h4 className="text-sm font-black text-[#0a0a2e] uppercase tracking-widest italic">Fila de Resolução Operacional</h4>
          </div>
          <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-slate-200">{totalActive} AGUARDANDO</span>
        </div>
        
        {totalActive === 0 && (
          <div className="p-32 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center shadow-inner">
            <div className="size-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-8 shadow-sm">
              <Shield size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-300 uppercase italic tracking-tighter">Tudo em Ordem</h3>
            <p className="text-sm text-slate-400 mt-2 font-medium">Nenhuma pendência ativa no momento conforme os padrões GSA IA.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {/* 1. Pendências de Processos (Dados/Docs Faltantes) */}
          {processPendencies.map((proc, idx) => (
            <motion.div 
              key={`proc-${proc.id}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2.5 h-full bg-amber-500"></div>
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
                <div className="flex items-start gap-8">
                  <div className="size-20 rounded-[1.8rem] bg-amber-50 flex items-center justify-center shrink-0 text-amber-600 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                    <ClipboardList size={36} />
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="bg-slate-100 px-4 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Protocolo: {proc.protocolo}</span>
                      </div>
                      <div className="bg-amber-50 text-amber-600 border border-amber-100 px-4 py-1.5 rounded-xl">
                        <span className="text-[9px] font-black uppercase tracking-widest">Dados/Docs Faltantes</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {proc.data_venda?.toDate ? proc.data_venda.toDate().toLocaleDateString('pt-BR') : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-3xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none group-hover:text-amber-600 transition-colors duration-500">
                      {proc.servico_nome} - {proc.cliente_nome}
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {(!proc.cliente_cpf_cnpj || !proc.data_nascimento) && (
                        <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 uppercase tracking-widest">Falta Dados de Rastreio</span>
                      )}
                      {proc.dados_faltantes?.map(f => (
                        <span key={f} className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100 uppercase tracking-widest">Falta {f}</span>
                      ))}
                      {proc.pendencias_iniciais?.map(d => (
                        <span key={d} className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 uppercase tracking-widest">Falta Doc: {d}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row xl:flex-col gap-4 min-w-[280px]">
                  <button 
                    onClick={() => setShowSmartFicha(proc.id!)}
                    className="flex-1 flex items-center justify-center gap-4 bg-amber-500 hover:bg-amber-600 text-white px-10 py-5 rounded-[1.8rem] font-black uppercase text-[11px] tracking-[0.2em] transition-all shadow-2xl shadow-amber-600/20 hover:scale-105 active:scale-95"
                  >
                    Resolver via SmartFicha <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {/* 2. Pendências Manuais */}
          {activeManualPendencies.map((p, idx) => (
            <motion.div 
              key={p.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-2.5 h-full bg-rose-500"></div>
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10">
                <div className="flex items-start gap-8">
                  <div className="size-20 rounded-[1.8rem] bg-rose-50 flex items-center justify-center shrink-0 text-rose-600 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                    <AlertCircle size={36} />
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="bg-slate-100 px-4 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Venda: {p.venda_id.slice(-6).toUpperCase()}</span>
                      </div>
                      <div className={`px-4 py-1.5 rounded-xl border ${
                        p.status_pendencia === 'AGUARDANDO_GESTOR' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        p.status_pendencia === 'ENVIADO_CLIENTE' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        <span className="text-[9px] font-black uppercase tracking-widest">{p.status_pendencia.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          {p.criadaEm?.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <h3 className="text-3xl font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none group-hover:text-rose-600 transition-colors duration-500">{p.descricao}</h3>
                    <div className="flex flex-wrap gap-8 pt-2">
                      <div className="flex items-center gap-3">
                        <div className="size-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                          <User size={16} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor: <span className="text-slate-600">{p.vendedor_id.slice(-6).toUpperCase()}</span></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="size-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
                          <Shield size={16} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestor: <span className="text-slate-600">{p.id_superior.slice(-6).toUpperCase()}</span></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row xl:flex-col gap-4 min-w-[280px]">
                  {p.status_pendencia === 'AGUARDANDO_GESTOR' && (profile?.nivel === 'GESTOR' || profile?.nivel.startsWith('ADM')) && (
                    <button 
                      onClick={() => handleApprove(p.id!)}
                      className="flex-1 flex items-center justify-center gap-4 bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-5 rounded-[1.8rem] font-black uppercase text-[11px] tracking-[0.2em] transition-all shadow-2xl shadow-emerald-600/20 hover:scale-105 active:scale-95"
                    >
                      Aprovar e Enviar <ArrowRight size={18} />
                    </button>
                  )}
                  
                  {p.status_pendencia === 'ENVIADO_CLIENTE' && (
                    <button 
                      onClick={() => handleResolve(p.id!, p.venda_id, p.processo_id)}
                      className="flex-1 flex items-center justify-center gap-4 bg-[#0a0a2e] hover:bg-slate-800 text-white px-10 py-5 rounded-[1.8rem] font-black uppercase text-[11px] tracking-[0.2em] transition-all shadow-2xl shadow-blue-900/20 hover:scale-105 active:scale-95"
                    >
                      Resolver Agora <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {resolvedPendencies.length > 0 && (
        <div className="space-y-8 pt-12 border-t border-slate-100">
          <div className="flex items-center gap-4 px-6">
            <div className="size-2 bg-emerald-500 rounded-full" />
            <h4 className="text-sm font-black text-[#0a0a2e] uppercase tracking-widest italic">Histórico de Resoluções GSA</h4>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {resolvedPendencies.map((p, idx) => (
              <motion.div 
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-slate-50/50 rounded-[2.5rem] p-8 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:bg-white hover:shadow-xl transition-all duration-500"
              >
                <div className="flex items-center gap-6">
                  <div className="size-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resolvido em {p.resolvidaEm?.toDate().toLocaleDateString('pt-BR')}</p>
                    <h5 className="text-lg font-black text-[#0a0a2e] uppercase tracking-tighter italic leading-none">{p.descricao}</h5>
                    <p className="text-xs text-slate-500 mt-2 font-medium italic">"{p.resolucao}"</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm self-start md:self-center">
                  <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Status: Resolvido</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Modal SmartFicha */}
      <AnimatePresence>
        {showSmartFicha && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative border border-slate-100 dark:border-slate-800"
            >
              <button 
                onClick={() => setShowSmartFicha(null)}
                className="absolute top-6 right-6 z-50 size-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 transition-all"
              >
                <ChevronRight size={20} className="rotate-45" />
              </button>

              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center gap-4">
                <div className="size-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Resolver Pendências</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complete as informações para o processo</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {processPendencies.find(p => p.id === showSmartFicha) && (
                  <SmartFicha 
                    processos={[processPendencies.find(p => p.id === showSmartFicha)!]} 
                    clienteDados={{ 
                      id: processPendencies.find(p => p.id === showSmartFicha)!.cliente_id, 
                      uid: processPendencies.find(p => p.id === showSmartFicha)!.cliente_id,
                      nome_completo: processPendencies.find(p => p.id === showSmartFicha)!.cliente_nome,
                      cpf: processPendencies.find(p => p.id === showSmartFicha)!.cliente_cpf_cnpj,
                      data_nascimento: processPendencies.find(p => p.id === showSmartFicha)!.data_nascimento,
                      ...processPendencies.find(p => p.id === showSmartFicha)!
                    }} 
                    onUpdate={() => {
                      setShowSmartFicha(null);
                    }} 
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
