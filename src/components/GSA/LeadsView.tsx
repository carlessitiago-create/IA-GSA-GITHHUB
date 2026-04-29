import React, { useState, useEffect } from 'react';
import { formatDate } from '../../lib/dateUtils';
import { Users, UserPlus, Plus, PhoneOff, CheckCircle, Clock, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { db, auth } from '../../firebase';
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { ProposalGenerator } from './ProposalGenerator';

export const LeadsView: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showProposalModal, setShowProposalModal] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('data_indicacao', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAtender = (lead: any) => {
    setSelectedLead(lead);
    setShowProposalModal(true);
  };

  const marcarNumeroInvalido = async (leadId: string, telefone: string) => {
    const confirm = await Swal.fire({
      title: 'Número Inválido?',
      text: 'Deseja marcar este número como inexistente e bloqueá-lo para futuras indicações?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, Bloquear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444'
    });

    if (confirm.isConfirmed) {
      try {
        // 1. Atualizar o status do Lead
        await updateDoc(doc(db, 'leads', leadId), {
          status: 'NUMERO_NAO_EXISTE'
        });

        // 2. Adicionar à Blacklist
        await addDoc(collection(db, 'blocked_numbers'), {
          telefone: telefone,
          bloqueado_em: serverTimestamp(),
          motivo: 'Número marcado como inexistente pelo comercial'
        });

        Swal.fire('Bloqueado!', 'O número foi adicionado à blacklist.', 'success');
      } catch (error) {
        console.error("Erro ao bloquear número:", error);
        Swal.fire('Erro', 'Não foi possível processar a solicitação.', 'error');
      }
    }
  };

  const handleCadastrarClienteBase = async () => {
    const { value: formValues } = await Swal.fire({
      title: 'Cadastrar Novo Cliente',
      html:
        '<div class="space-y-4">' +
        '<input id="swal-input1" class="swal2-input w-full" placeholder="Nome Completo">' +
        '<input id="swal-input2" class="swal2-input w-full" placeholder="E-mail">' +
        '<input id="swal-input3" class="swal2-input w-full" placeholder="CPF (Apenas números)">' +
        '</div>',
      focusConfirm: false,
      preConfirm: () => {
        return [
          (document.getElementById('swal-input1') as HTMLInputElement).value,
          (document.getElementById('swal-input2') as HTMLInputElement).value,
          (document.getElementById('swal-input3') as HTMLInputElement).value
        ]
      }
    });

    if (formValues) {
      const [nome, email, cpf] = formValues;
      if (!nome || !email || !cpf) {
        Swal.fire('Erro', 'Todos os campos são obrigatórios.', 'error');
        return;
      }

      try {
        await addDoc(collection(db, 'usuarios'), {
          nome_completo: nome,
          email,
          cpf: cpf,
          nivel: 'CLIENTE',
          saldo_pontos: 0,
          cadastrado_por: auth.currentUser?.uid,
          data_cadastro: serverTimestamp(),
          status_conta: 'APROVADO'
        });
        Swal.fire('Sucesso!', 'Cliente cadastrado com sucesso.', 'success');
      } catch (error) {
        console.error("Erro ao cadastrar cliente:", error);
        Swal.fire('Erro', 'Não foi possível cadastrar o cliente.', 'error');
      }
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Gestão de Leads
          </h2>
          <p className="text-slate-500 text-sm">Acompanhe e converta novas oportunidades de negócio.</p>
        </div>
        
        <button 
          onClick={handleCadastrarClienteBase}
          className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
        >
          <UserPlus size={18} /> Cadastrar Cliente
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          <table className="w-full min-w-[800px] text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead / Indicado</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Indicado Por</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Carregando leads...</td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum lead encontrado.</td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center font-bold text-blue-600">
                          {(lead.nome || '').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-200">{lead.nome}</p>
                          <p className="text-[10px] text-slate-400">{lead.telefone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{lead.indicado_por_nome}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                        lead.status === 'NOVO' ? 'bg-blue-50 text-blue-600' :
                        lead.status === 'NUMERO_NAO_EXISTE' ? 'bg-red-50 text-red-600' :
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[10px] text-slate-400 font-bold">
                      {lead.data_indicacao?.toDate ? formatDate(lead.data_indicacao.toDate()) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {lead.status === 'NOVO' && (
                          <button 
                            onClick={() => marcarNumeroInvalido(lead.id, lead.telefone)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Número Inválido"
                          >
                            <PhoneOff size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => handleAtender(lead)}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
                        >
                          Atender
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showProposalModal && (
        <ProposalGenerator 
          onClose={() => {
            setShowProposalModal(false);
            setSelectedLead(null);
          }}
          initialData={{
            lead_nome: selectedLead?.nome,
            lead_telefone: selectedLead?.telefone
          }}
        />
      )}
    </div>
  );
};
