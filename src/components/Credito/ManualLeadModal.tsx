import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { db } from '../../firebase';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { X } from 'lucide-react';
import Swal from 'sweetalert2';
import type { CreditoLead } from '../../types/credito';
import type { UserProfile } from '../../services/userService';

export const ManualLeadModal: React.FC<{ onClose: () => void, onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const { profile } = useAuth();
  
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [faturamento, setFaturamento] = useState('');
  const [valorSolicitado, setValorSolicitado] = useState('');
  const [tipoCredito, setTipoCredito] = useState<'FUNGETUR' | 'BNDES' | 'ANTECIPACAO' | 'GARANTIA_REAL'>('FUNGETUR');
  
  const [vendedores, setVendedores] = useState<UserProfile[]>([]);
  const [selectedVendedorId, setSelectedVendedorId] = useState<string>('');

  const isManagerOrAdmin = profile?.nivel === 'GESTOR' || profile?.nivel?.startsWith('ADM');

  useEffect(() => {
    if (isManagerOrAdmin) {
      const fetchVendedores = async () => {
        try {
          const q = query(
            collection(db, 'usuarios'),
            where('nivel', '==', 'VENDEDOR'),
            where('ativo', '==', true)
          );
          const snap = await getDocs(q);
          const vends = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
          // Se for gestor, talvez filtrar por id_superior, ms vamos mostrar todos por padrão 
          // ou os que ele gerencia. Vamos deixar todos vendedores ativos
          setVendedores(vends);
        } catch (error) {
          console.error('Erro ao buscar vendedores:', error);
        }
      };
      fetchVendedores();
    }
  }, [isManagerOrAdmin, profile?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    try {
       const finalVendedorId = selectedVendedorId || profile.uid;
       let gestorId = profile.id_superior || '';
       
       if (isManagerOrAdmin && selectedVendedorId) {
          const vend = vendedores.find(v => v.uid === selectedVendedorId);
          gestorId = vend?.id_superior || profile.uid;
       }

       const novoLead: CreditoLead = {
         vendedorId: finalVendedorId,
         gestorId: gestorId,
         origem: 'cadastro_manual',
         tipoCredito: tipoCredito,
         status: 'analise_tecnica', // Manda direto pra análise técnica se for manual
         dadosEmpresa: {
            cnpj,
            razaoSocial,
            telefone,
            email
         },
         financeiro: {
            faturamentoMensalMedio: Number(faturamento),
            valorSolicitado: Number(valorSolicitado)
         },
         createdAt: new Date()
       };

       await addDoc(collection(db, 'leads_credito'), novoLead);
       
       Swal.fire('Sucesso!', 'Lead cadastrado com sucesso', 'success');
       onSuccess();
       onClose();
    } catch (error) {
       console.error("Erro ao cadastrar", error);
       Swal.fire('Erro!', 'Não foi possível cadastrar o lead. Tente novamente.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
       <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b border-slate-100">
             <h2 className="text-xl font-bold">Novo Lead Manual</h2>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {isManagerOrAdmin && (
                   <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="block text-sm font-semibold mb-1 text-slate-800">Vincular a um Vendedor (Opcional)</label>
                      <select 
                         value={selectedVendedorId} 
                         onChange={e => setSelectedVendedorId(e.target.value)} 
                         className="w-full px-4 py-2 border rounded-xl bg-white"
                      >
                         <option value="">-- Sem vendedor selecionado (Lead da Casa / do Gestor) --</option>
                         {vendedores.map(v => (
                            <option key={v.uid} value={v.uid}>{v.nome_completo || v.email}</option>
                         ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-2">
                        Selecione um vendedor para ser o "dono" do lead para fins de comissionamento.
                      </p>
                   </div>
                 )}
                 <div>
                    <label className="block text-sm font-semibold mb-1">CNPJ</label>
                    <input required value={cnpj} onChange={e=>setCnpj(e.target.value)} className="w-full px-4 py-2 border rounded-xl" placeholder="Apenas números" />
                 </div>
                 <div>
                    <label className="block text-sm font-semibold mb-1">Razão Social</label>
                    <input required value={razaoSocial} onChange={e=>setRazaoSocial(e.target.value)} className="w-full px-4 py-2 border rounded-xl" />
                 </div>
                 <div>
                    <label className="block text-sm font-semibold mb-1">E-mail</label>
                    <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-xl" />
                 </div>
                 <div>
                    <label className="block text-sm font-semibold mb-1">Telefone</label>
                    <input required value={telefone} onChange={e=>setTelefone(e.target.value)} className="w-full px-4 py-2 border rounded-xl" />
                 </div>
                 <div>
                    <label className="block text-sm font-semibold mb-1">Faturamento Médio Mensal</label>
                    <input required type="number" value={faturamento} onChange={e=>setFaturamento(e.target.value)} className="w-full px-4 py-2 border rounded-xl" />
                 </div>
                 <div>
                    <label className="block text-sm font-semibold mb-1">Valor Solicitado</label>
                    <input required type="number" value={valorSolicitado} onChange={e=>setValorSolicitado(e.target.value)} className="w-full px-4 py-2 border rounded-xl" />
                 </div>
                 <div className="md:col-span-2">
                    <label className="block text-sm font-semibold mb-1">Linha de Crédito</label>
                    <select value={tipoCredito} onChange={e=>setTipoCredito(e.target.value as any)} className="w-full px-4 py-2 border rounded-xl">
                       <option value="FUNGETUR">FUNGETUR</option>
                       <option value="BNDES">BNDES</option>
                       <option value="ANTECIPACAO">Antecipação de Recebíveis</option>
                       <option value="GARANTIA_REAL">Garantia Real</option>
                    </select>
                 </div>
             </div>

             <div className="pt-4 flex justify-end">
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-xl transition-colors">
                   Cadastrar Lead
                </button>
             </div>
          </form>
       </div>
    </div>
  );
}

