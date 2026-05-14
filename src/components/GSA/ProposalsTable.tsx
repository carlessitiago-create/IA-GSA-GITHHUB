import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { ProposalData } from '../../services/proposalService';
import Swal from 'sweetalert2';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export const ProposalsTable = () => {
  const { profile } = useAuth();
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProposals();
  }, [profile]);

  const fetchProposals = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let q;
      if (['ADM_MASTER', 'ADM_GERENTE'].includes(profile.nivel)) {
        q = query(collection(db, 'proposals'));
      } else if (profile.nivel === 'VENDEDOR') {
        q = query(collection(db, 'proposals'), where('vendedor_id', '==', profile.uid));
      } else {
        q = query(collection(db, 'proposals'), where('vendedor_id', '==', profile.uid)); // Default/Client
      }
      
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ProposalData));
      setProposals(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (proposalId: string, newStatus: ProposalData['status']) => {
    try {
      await updateDoc(doc(db, 'proposals', proposalId), { status: newStatus });
      Swal.fire('Sucesso', 'Status atualizado', 'success');
      fetchProposals();
    } catch (e) {
      Swal.fire('Erro', 'Não foi possível atualizar', 'error');
    }
  };

  if (loading) return <Loader2 className="animate-spin" />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
          <tr>
            <th className="p-4 text-left">Lead</th>
            <th className="p-4 text-left">Status</th>
            <th className="p-4 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {proposals.map(p => (
            <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="p-4 font-bold text-slate-800">{p.lead_nome}</td>
              <td className="p-4">
                <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${
                  p.status === 'ACEITA' ? 'bg-emerald-100 text-emerald-700' : 
                  p.status === 'RECUSADA' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {p.status || 'ABERTA'}
                </span>
              </td>
              <td className="p-4 flex justify-center gap-3">
                <button title="Aceitar" onClick={() => updateStatus(p.id!, 'ACEITA')} className="text-emerald-500 hover:text-emerald-700 bg-emerald-50 p-2 rounded-xl"><CheckCircle size={18} /></button>
                <button title="Recusar" onClick={() => updateStatus(p.id!, 'RECUSADA')} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-xl"><XCircle size={18} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
