import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { AlertCircle, CheckCircle2, Clock, User, Shield, ArrowRight, Upload } from 'lucide-react';
import { PendingIssue } from '../../services/orderService';
import Swal from 'sweetalert2';
import { FileUploader } from './FileUploader';
import { motion } from 'motion/react';

export const PendencyList: React.FC = () => {
  const { profile } = useAuth();
  const [pendencies, setPendencies] = useState<PendingIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const nivel = profile.nivel;
    const uid = profile.uid;

    let q;
    const pendenciesRef = collection(db, 'pendencies');

    if (nivel === 'ADM_MASTER' || nivel === 'ADM_ANALISTA' || nivel === 'ADM_GERENTE') {
      q = query(pendenciesRef, orderBy('criadaEm', 'desc'));
    } else if (nivel === 'GESTOR' && uid) {
      q = query(pendenciesRef, where('managerId', '==', uid), orderBy('criadaEm', 'desc'));
    } else if (nivel === 'VENDEDOR' && uid) {
      q = query(pendenciesRef, where('vendedorId', '==', uid), orderBy('criadaEm', 'desc'));
    } else if (nivel === 'CLIENTE' && uid) {
      q = query(
        pendenciesRef, 
        where('status_pendencia', '==', 'ENVIADO_CLIENTE'),
        where('cliente_id', '==', uid),
        orderBy('criadaEm', 'desc')
      );
    } else if (uid) {
      q = query(pendenciesRef, where('criado_por_id', '==', uid), orderBy('criadaEm', 'desc'));
    } else {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendencies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingIssue)));
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar pendências:", error);
      setLoading(false);
    });

    return () => unsubscribe();
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

  const activePendencies = pendencies.filter(p => p.status_pendencia !== 'RESOLVIDO');
  const resolvedPendencies = pendencies.filter(p => p.status_pendencia === 'RESOLVIDO');

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
            <h3 className="text-5xl font-black text-[#0a0a2e] italic tracking-tighter leading-none">{activePendencies.length}</h3>
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
          <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest border border-slate-200">{activePendencies.length} AGUARDANDO</span>
        </div>
        
        {activePendencies.length === 0 && (
          <div className="p-32 bg-white rounded-[4rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center shadow-inner">
            <div className="size-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-8 shadow-sm">
              <Shield size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-300 uppercase italic tracking-tighter">Tudo em Ordem</h3>
            <p className="text-sm text-slate-400 mt-2 font-medium">Nenhuma pendência ativa no momento conforme os padrões GSA IA.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          {activePendencies.map((p, idx) => (
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
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Venda: {p.vendaId.slice(-6).toUpperCase()}</span>
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
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendedor: <span className="text-slate-600">{p.vendedorId.slice(-6).toUpperCase()}</span></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="size-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500">
                          <Shield size={16} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestor: <span className="text-slate-600">{p.managerId.slice(-6).toUpperCase()}</span></span>
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
                      onClick={() => handleResolve(p.id!, p.vendaId, p.processo_id)}
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
    </div>
  );
};
