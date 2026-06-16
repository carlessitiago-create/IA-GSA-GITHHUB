import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Search, Filter, Download, Trash2, CheckCircle, Clock, CreditCard, RefreshCw } from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

interface LeadDiagnostico {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  cnpj: string;
  pacote_escolhido?: string;
  valor_venda: number;
  status_pagamento: 'pendente' | 'pago';
  data_solicitacao: string;
  gateway_usado?: string;
  identificador_pagamento?: string;
}

export function LeadsDiagnosticoView() {
  const [leads, setLeads] = useState<LeadDiagnostico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Escuta o Firestore em tempo real para trazer atualizações instantâneas do Webhook
  useEffect(() => {
    const q = query(collection(db, 'leads_diagnostico'), orderBy('data_solicitacao', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const listaLeads: LeadDiagnostico[] = [];
      snapshot.forEach((doc) => {
        listaLeads.push({ id: doc.id, ...doc.data() } as LeadDiagnostico);
      });
      setLeads(listaLeads);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao carregar leads_diagnostico:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Forçar aprovação manual caso o cliente pague e dê algum problema de rede no gateway
  const handleAprovarManual = async (leadId: string) => {
    const result = await Swal.fire({
      title: 'Aprovação Manual',
      text: "Deseja forçar o status deste diagnóstico para PAGO manualmente?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#334155',
      confirmButtonText: 'Sim, aprovar!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await updateDoc(doc(db, 'leads_diagnostico', leadId), {
          status_pagamento: 'pago'
        });
        Swal.fire('Sucesso!', 'O lead foi marcado como PAGO.', 'success');
      } catch (err) {
        Swal.fire('Erro', 'Não foi possível atualizar o status.', 'error');
      }
    }
  };

  const handleDeletarLead = async (leadId: string) => {
    const result = await Swal.fire({
      title: 'Excluir registro?',
      text: "Essa ação não poderá ser desfeita!",
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#334155',
      confirmButtonText: 'Sim, excluir',
      cancelButtonText: 'Manter'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'leads_diagnostico', leadId));
        Swal.fire('Deletado!', 'O registro foi removido.', 'success');
      } catch (err) {
        Swal.fire('Erro', 'Falha ao deletar do Firestore.', 'error');
      }
    }
  };

  // Exportação limpa dos dados para Excel estruturado
  const exportarParaExcel = () => {
    if (leads.length === 0) {
      Swal.fire('Aviso', 'Não há dados para exportar.', 'info');
      return;
    }

    const dadosFormatados = leads.map(l => ({
      Data: new Date(l.data_solicitacao).toLocaleString('pt-BR'),
      Cliente: l.nome,
      CNPJ: l.cnpj,
      Email: l.email,
      WhatsApp: l.whatsapp,
      Valor: `R$ ${l.valor_venda.toFixed(2)}`,
      Status: l.status_pagamento.toUpperCase(),
      Gateway: l.gateway_usado || 'Não informado',
      ID_Transacao: l.identificador_pagamento || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(dadosFormatados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads Diagnóstico");
    XLSX.writeFile(wb, `GSA_Leads_Diagnostico_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Filtros aplicados na tabela
  const leadsFiltrados = leads.filter(l => {
    const bateBusca = l.nome.toLowerCase().includes(filtroBusca.toLowerCase()) || 
                     l.cnpj.includes(filtroBusca) || 
                     l.email.toLowerCase().includes(filtroBusca.toLowerCase());
    
    const bateStatus = filtroStatus === 'todos' || l.status_pagamento === filtroStatus;
    
    return bateBusca && bateStatus;
  });

  return (
    <div className="p-6 bg-slate-950 text-slate-100 min-h-screen space-y-6">
      
      {/* Topo com Ações */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="text-blue-500" />
            Esteira de Leads - Diagnóstico de Crédito
          </h2>
          <p className="text-xs text-slate-400">Controle de faturamento, triagens fiscais e ativações por PIX.</p>
        </div>
        <button onClick={exportarParaExcel} className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
          <Download size={16} /> Exportar Excel
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-slate-900/40 border border-slate-900 p-4 rounded-xl">
        <div className="sm:col-span-8 relative">
          <Search className="absolute left-3 top-3 text-slate-500" size={18} />
          <input type="text" placeholder="Buscar por cliente, CNPJ ou e-mail..." value={filtroBusca} onChange={(e) => setFiltroBusca(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg pl-10 pr-4 py-2 text-sm outline-none text-white transition-colors" />
        </div>
        <div className="sm:col-span-4 relative">
          <Filter className="absolute left-3 top-3 text-slate-500" size={16} />
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg pl-9 pr-4 py-2 text-sm outline-none text-white transition-colors appearance-none cursor-pointer">
            <option value="todos">Todos os Status</option>
            <option value="pago">Aprovados (Pago)</option>
            <option value="pendente">Aguardando PIX</option>
          </select>
        </div>
      </div>

      {/* Tabela de Dados */}
      <div className="bg-slate-900 border border-slate-900 rounded-xl overflow-hidden shadow-2xl">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin text-blue-500" size={18} /> Carregando registros da nuvem...
          </div>
        ) : leadsFiltrados.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">Nenhum lead encontrado com os filtros atuais.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-950/60 text-slate-400 font-medium text-xs tracking-wider uppercase">
                  <th className="p-4">Data</th>
                  <th className="p-4">Razão Social / CNPJ</th>
                  <th className="p-4">Contato</th>
                  <th className="p-4">Valor</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4">Gateway / ID</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-950/40">
                {leadsFiltrados.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-950/30 transition-colors group">
                    <td className="p-4 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {new Date(lead.data_solicitacao).toLocaleString('pt-BR').split(' ')[0]}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-200">{lead.nome}</div>
                      <div className="text-xs text-slate-400 font-mono tracking-tight">{lead.cnpj}</div>
                    </td>
                    <td className="p-4 space-y-0.5">
                      <div className="text-slate-300">{lead.email}</div>
                      <div className="text-xs text-slate-400 font-mono">{lead.whatsapp}</div>
                    </td>
                    <td className="p-4 font-bold text-slate-200 whitespace-nowrap">
                      R$ {lead.valor_venda.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      {lead.status_pagamento === 'pago' ? (
                        <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-500/20 inline-flex items-center gap-1">
                          <CheckCircle size={12} /> Pago
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-500/20 inline-flex items-center gap-1 animate-pulse">
                          <Clock size={12} /> Pendente
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs">
                      <div className="text-slate-400 uppercase font-semibold">{lead.gateway_usado || '—'}</div>
                      <div className="text-slate-500 font-mono max-w-[120px] truncate" title={lead.identificador_pagamento}>
                        {lead.identificador_pagamento || '—'}
                      </div>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        {lead.status_pagamento === 'pendente' && (
                          <button onClick={() => handleAprovarManual(lead.id)} className="p-2 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 rounded-lg transition-all" title="Aprovação Manual">
                            <CheckCircle size={16} />
                          </button>
                        )}
                        <button onClick={() => handleDeletarLead(lead.id)} className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-all" title="Excluir Lead">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
