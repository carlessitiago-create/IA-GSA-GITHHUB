import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { useAuth } from "../AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { AlertCircle } from "lucide-react";

interface AlertCenterProps {
  onResolveClick?: () => void;
}

const AlertCenter: React.FC<AlertCenterProps> = ({ onResolveClick }) => {
  const { user, profile } = useAuth();
  const [avisos, setAvisos] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !profile) return;

    const nivel = profile.nivel;
    const uid = profile.uid;

    // Only show for Sellers, Managers, and Admins
    if (nivel !== 'VENDEDOR' && nivel !== 'GESTOR' && nivel !== 'ADM_MASTER' && nivel !== 'ADM_ANALISTA') return;

    let q;
    if (nivel === 'VENDEDOR' && uid) {
      q = query(
        collection(db, "pendencias"),
        where("status_pendencia", "in", ["AGUARDANDO_GESTOR", "ENVIADO_CLIENTE"]),
        where("vendedorId", "==", uid)
      );
    } else if (nivel === 'GESTOR' && uid) {
      q = query(
        collection(db, "pendencias"),
        where("status_pendencia", "in", ["AGUARDANDO_GESTOR", "ENVIADO_CLIENTE"]),
        where("managerId", "==", uid)
      );
    } else if (nivel === 'ADM_MASTER' || nivel === 'ADM_ANALISTA') {
      // ADM roles see all active pendencies
      q = query(
        collection(db, "pendencias"),
        where("status_pendencia", "in", ["AGUARDANDO_GESTOR", "ENVIADO_CLIENTE"])
      );
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvisos(lista);
    });

    return () => unsubscribe();
  }, [user, profile]);

  if (avisos.length === 0) return null;

  return (
    <div className="space-y-6 mb-12">
      {avisos.map(aviso => (
        <div 
          key={aviso.id} 
          className="bg-rose-50/50 border border-rose-100 p-8 md:p-10 rounded-[3rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
            <AlertCircle size={120} className="text-rose-600" />
          </div>

          <div className="flex items-center gap-8 relative z-10">
            <div className="size-20 bg-rose-500 rounded-[1.8rem] flex items-center justify-center text-white shadow-2xl shadow-rose-500/30 animate-pulse">
                <AlertCircle size={36} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h4 className="font-black text-rose-600 uppercase text-[10px] tracking-[0.3em]">Alerta Crítico GSA IA</h4>
                <div className="size-2 bg-rose-500 rounded-full animate-ping" />
              </div>
              <p className="text-[#0a0a2e] font-black text-2xl md:text-3xl italic tracking-tighter leading-none">Aguardando: {aviso.clienteNome}</p>
              <p className="text-xs text-slate-400 font-black uppercase tracking-widest mt-2">{aviso.descricao}</p>
            </div>
          </div>
          <button 
            onClick={() => {
                if (onResolveClick) {
                    onResolveClick();
                } else {
                    window.location.hash = '#pendencias';
                }
            }}
            className="w-full md:w-auto bg-[#0a0a2e] text-white px-12 py-5 rounded-[1.8rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-600 hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-blue-900/20 relative z-10"
          >
            Resolver Agora
          </button>
        </div>
      ))}
    </div>
  );
};

export default AlertCenter;
