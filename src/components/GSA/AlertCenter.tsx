import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { useAuth } from "../AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { AlertCircle, ClipboardList } from "lucide-react";

interface AlertCenterProps {
  onResolveClick?: () => void;
}

const AlertCenter: React.FC<AlertCenterProps> = ({ onResolveClick }) => {
  const { user, profile } = useAuth();
  const [avisos, setAvisos] = useState<any[]>([]);
  const [processAvisos, setProcessAvisos] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !profile) return;

    const nivel = profile.nivel;
    const uid = profile.uid;

    // Only show for Sellers, Managers, and Admins
    if (nivel !== 'VENDEDOR' && nivel !== 'GESTOR' && nivel !== 'ADM_MASTER' && nivel !== 'ADM_ANALISTA') return;

    // 1. Pendências Manuais
    let qManual;
    if (nivel === 'VENDEDOR' && uid) {
      qManual = query(
        collection(db, "pendencies"),
        where("status_pendencia", "in", ["AGUARDANDO_GESTOR", "ENVIADO_CLIENTE"]),
        where("vendedor_id", "==", uid)
      );
    } else if (nivel === 'GESTOR' && uid) {
      qManual = query(
        collection(db, "pendencies"),
        where("status_pendencia", "in", ["AGUARDANDO_GESTOR", "ENVIADO_CLIENTE"]),
        where("id_superior", "==", uid)
      );
    } else if (nivel === 'ADM_MASTER' || nivel === 'ADM_ANALISTA') {
      qManual = query(
        collection(db, "pendencies"),
        where("status_pendencia", "in", ["AGUARDANDO_GESTOR", "ENVIADO_CLIENTE"])
      );
    }

    const unsubManual = qManual ? onSnapshot(qManual, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, type: 'manual', ...doc.data() }));
      setAvisos(lista);
    }) : () => {};

    // 2. Pendências de Processos (Dados/Docs Faltantes)
    let qProc;
    const processesRef = collection(db, 'order_processes');
    const pendingStatuses = ['Aguardando Documentação', 'Pendente'];

    if (nivel === 'ADM_MASTER' || nivel === 'ADM_ANALISTA') {
      qProc = query(processesRef, where('status_atual', 'in', pendingStatuses));
    } else if (nivel === 'GESTOR' && uid) {
      qProc = query(processesRef, where('id_superior', '==', uid), where('status_atual', 'in', pendingStatuses));
    } else if (nivel === 'VENDEDOR' && uid) {
      qProc = query(processesRef, where('vendedor_id', '==', uid), where('status_atual', 'in', pendingStatuses));
    }

    const unsubProc = qProc ? onSnapshot(qProc, (snapshot) => {
      const procs = snapshot.docs.map(doc => ({ id: doc.id, type: 'process', ...doc.data() }));
      const filtered = procs.filter((p: any) => 
        (p.dados_faltantes && p.dados_faltantes.length > 0) || 
        (p.pendencias_iniciais && p.pendencias_iniciais.length > 0) ||
        !p.cliente_cpf_cnpj || !p.data_nascimento
      );
      setProcessAvisos(filtered);
    }) : () => {};

    return () => {
      unsubManual();
      unsubProc();
    };
  }, [user, profile]);

  const allAvisos = [...avisos, ...processAvisos];

  if (allAvisos.length === 0) return null;

  return (
    <div className="space-y-6 mb-12">
      {allAvisos.map(aviso => (
        <div 
          key={aviso.id} 
          className={`p-8 md:p-10 rounded-[3rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group border ${
            aviso.type === 'process' ? 'bg-amber-50/50 border-amber-100' : 'bg-rose-50/50 border-rose-100'
          }`}
        >
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
            {aviso.type === 'process' ? <ClipboardList size={120} className="text-amber-600" /> : <AlertCircle size={120} className="text-rose-600" />}
          </div>

          <div className="flex items-center gap-8 relative z-10">
            <div className={`size-20 rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl animate-pulse ${
              aviso.type === 'process' ? 'bg-amber-500 shadow-amber-500/30' : 'bg-rose-500 shadow-rose-500/30'
            }`}>
                {aviso.type === 'process' ? <ClipboardList size={36} /> : <AlertCircle size={36} />}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h4 className={`font-black uppercase text-[10px] tracking-[0.3em] ${
                  aviso.type === 'process' ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {aviso.type === 'process' ? 'Pendência Operacional' : 'Alerta Crítico GSA IA'}
                </h4>
                <div className={`size-2 rounded-full animate-ping ${
                  aviso.type === 'process' ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
              </div>
              <p className="text-[#0a0a2e] font-black text-2xl md:text-3xl italic tracking-tighter leading-none">
                {aviso.type === 'process' ? aviso.cliente_nome : `Aguardando: ${aviso.clienteNome}`}
              </p>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-2">
                {aviso.type === 'process' ? `${aviso.servico_nome} - Dados/Docs Faltantes` : aviso.descricao}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
                if (onResolveClick) {
                    onResolveClick();
                } else {
                    window.location.href = '/pendencias';
                }
            }}
            className={`w-full md:w-auto text-white px-12 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-2xl relative z-10 ${
              aviso.type === 'process' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-900/20' : 'bg-[#0a0a2e] hover:bg-rose-600 shadow-blue-900/20'
            } hover:scale-105 active:scale-95`}
          >
            Resolver Agora
          </button>
        </div>
      ))}
    </div>
  );
};

export default AlertCenter;
