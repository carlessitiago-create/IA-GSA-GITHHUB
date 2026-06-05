import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Download, Settings, Users, DollarSign, CheckCircle2, Clock, Plus, X, MoreVertical, Trash2 } from 'lucide-react';
import { ILead, IConfigNotificacoes } from '../../types/lead';
import Swal from 'sweetalert2';

export const LeadsView: React.FC = () => {
  const [leads, setLeads] = useState<ILead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [config, setConfig] = useState<IConfigNotificacoes>({ emails_admin: [] });
  const [newEmail, setNewEmail] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  const [saasConfig, setSaasConfig] = useState<any>(null);

  // Fetch leads
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'leads'), (snapshot) => {

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ILead[];
      data.sort((a, b) => {
        const dA = a.data_solicitacao?.toDate ? a.data_solicitacao.toDate().getTime() : (new Date(a.data_solicitacao).getTime() || 0);
        const dB = b.data_solicitacao?.toDate ? b.data_solicitacao.toDate().getTime() : (new Date(b.data_solicitacao).getTime() || 0);
        return dB - dA;
      });
      setLeads(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch config and saas config
  useEffect(() => {
    const fetchConfig = async () => {
      const d = await getDoc(doc(db, 'configs', 'notificacoes'));
      if (d.exists()) {
        setConfig(d.data() as IConfigNotificacoes);
      }
      const saasDoc = await getDoc(doc(db, 'configs', 'saas_settings'));
      if (saasDoc.exists()) {
        setSaasConfig(saasDoc.data());
      }
    };
    fetchConfig();
  }, []);

  const totalLeads = leads.length;
  const totalPago = leads.filter(l => l.status_pagamento === 'pago').length;
  const totalPendente = leads.filter(l => l.status_pagamento === 'pendente').length;
  const receitaTotal = leads
    .filter(l => l.status_pagamento === 'pago')
    .reduce((acc, curr) => acc + (Number(curr.valor_venda) || 0), 0);

  const handleExportCSV = () => {
    const headers = ['Data', 'Nome', 'Email', 'Whatsapp', 'Pacote', 'Valor', 'Gateway', 'Status'];
    const rows = leads.map(l => {
      const d = l.data_solicitacao?.toDate ? l.data_solicitacao.toDate() : new Date(l.data_solicitacao || Date.now());
      return [
        d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR'),
        `"${l.nome}"`,
        `${l.email}`,
        `${l.whatsapp}`,
        `"${l.pacote_escolhido || ''}"`,
        `${l.valor_venda || 0}`,
        `${l.gateway_usado || ''}`,
        `${l.status_pagamento}`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addEmail = () => {
    if (!newEmail || !newEmail.includes('@')) {
      Swal.fire('Aviso', 'Digite um e-mail válido', 'warning');
      return;
    }
    if (config.emails_admin.includes(newEmail)) return;
    setConfig(prev => ({ ...prev, emails_admin: [...prev.emails_admin, newEmail] }));
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    setConfig(prev => ({ ...prev, emails_admin: prev.emails_admin.filter(e => e !== email) }));
  };

  const handleMarkAsPaid = async (lead: ILead) => {
    if (!lead.id) return;
    try {
      await updateDoc(doc(db, 'leads', lead.id), { status_pagamento: 'pago' });
      
      if (saasConfig?.meta_conversions_token) {
        const pixelId = saasConfig.facebook_pixel_id || (saasConfig.meta_pixel_code ? saasConfig.meta_pixel_code.match(/fbq\(['"]init['"],\s*['"]?(\d+)['"]?\)/)?.[1] : null);
        if (pixelId) {
          try {
            const { functions } = await import('../../firebase');
            const { httpsCallable } = await import('firebase/functions');
            const metaConversionsFn = httpsCallable(functions, 'metaConversions');
            await metaConversionsFn({
              pixelId,
              token: saasConfig.meta_conversions_token,
              eventName: 'Purchase',
              eventTime: Math.floor(Date.now() / 1000),
              userData: {
                em: [lead.email],
                ph: [lead.whatsapp]
              },
              customData: {
                currency: 'BRL',
                value: lead.valor_venda || 0
              }
            });
          } catch(e) {
            console.error('Meta CAPI:', e);
          }
        }
      }

      Swal.fire('Sucesso', 'Lead marcado como pago manualmente!', 'success');
      setSelectedLead(null);
    } catch (e) {
      console.error(e);
      Swal.fire('Erro', 'Não foi possível alterar o status.', 'error');
    }
  };

  const handleDeleteLead = async (lead: ILead) => {
    if (!lead.id) return;
    
    const result = await Swal.fire({
      title: 'Tem certeza?',
      text: 'Você está prestes a excluir este lead permanentemente.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'leads', lead.id));
        Swal.fire('Sucesso', 'Lead excluído.', 'success');
        setSelectedLead(null);
      } catch (e) {
        console.error(e);
        Swal.fire('Erro', 'Não foi possível excluir o lead.', 'error');
      }
    }
  };

  const saveConfig = async () => {
    try {
      await setDoc(doc(db, 'configs', 'notificacoes'), config);
      Swal.fire('Sucesso', 'Configurações de notificação salvas', 'success');
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      Swal.fire('Erro', 'Falha ao salvar configurações', 'error');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  const formatDateValue = (val: any) => {
    if (!val) return '-';
    if (val.toDate) {
      return val.toDate().toLocaleString('pt-BR');
    }
    try {
      return new Date(val).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          lead.whatsapp?.includes(searchTerm);
    
    if (statusFilter === 'todos') return matchesSearch;
    return matchesSearch && lead.status_pagamento === statusFilter;
  });

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Users className="text-blue-600" size={28} />
            Dashboard de Leads
          </h2>
          <p className="text-slate-500 text-sm">Monitoramento de conversões e pagamentos de diagnóstico.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-colors"
          >
            <Settings size={14} /> Configurar Notificações
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Total de Leads</span>
          </div>
          <p className="text-3xl font-black text-slate-800 dark:text-white mt-4">{totalLeads}</p>
        </div>
        
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <DollarSign size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Receita Total</span>
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-4">{formatCurrency(receitaTotal)}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Total Pagos</span>
          </div>
          <p className="text-3xl font-black text-slate-800 dark:text-white mt-4">{totalPago}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl">
              <Clock size={20} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Pendentes</span>
          </div>
          <p className="text-3xl font-black text-slate-800 dark:text-white mt-4">{totalPendente}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row gap-4 p-4 items-center">
        <input 
          type="text" 
          placeholder="Buscar por nome, e-mail ou whatsapp..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 dark:text-slate-200"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full md:w-auto px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 dark:text-slate-200"
        >
          <option value="todos">Todos os Status</option>
          <option value="pago">Apenas Pagos</option>
          <option value="pendente">Apenas Pendentes</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome / Contato</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pacote</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gateway</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Carregando leads...</td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">Nenhum lead encontrado.</td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-6 py-4 text-[11px] text-slate-500 font-medium whitespace-nowrap">
                      {formatDateValue(lead.data_solicitacao)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700 dark:text-slate-200">{lead.nome}</div>
                      <div className="text-[10px] text-slate-400">{lead.email} &bull; {lead.whatsapp}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                      {lead.pacote_escolhido || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatCurrency(Number(lead.valor_venda))}
                    </td>
                    <td className="px-6 py-4">
                      {lead.gateway_usado ? (
                         <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-black uppercase tracking-widest">
                           {lead.gateway_usado}
                         </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        lead.status_pagamento === 'pago' 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' 
                          : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
                      }`}>
                        {lead.status_pagamento}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Alertas por E-mail</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs font-medium text-slate-500 mb-6 leading-relaxed">Adicione os e-mails da sua equipe que devem receber alertas quando um pagamento for aprovado.</p>
            
            <div className="flex gap-2 mb-6">
              <input 
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                onKeyDown={e => e.key === 'Enter' && addEmail()}
              />
              <button 
                onClick={addEmail}
                className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                title="Adicionar E-mail"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-2 mb-8 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {config.emails_admin.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 text-center py-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/50 border-dashed">Nenhum e-mail configurado.</p>
              ) : (
                config.emails_admin.map(email => (
                  <div key={email} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/30 px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate pr-4">{email}</span>
                    <button 
                      onClick={() => removeEmail(email)}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3">
               <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveConfig}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Lead Detalhes</h2>
              <button 
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 mb-6 relative z-10">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Nome Completo</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedLead.nome}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">WhatsApp</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedLead.whatsapp}</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">E-mail</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={selectedLead.email}>{selectedLead.email}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Pacote</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedLead.pacote_escolhido}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Valor Venda</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedLead.valor_venda)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 relative z-10">
              <button
                onClick={() => handleDeleteLead(selectedLead)}
                className="px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-[10px] uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Excluir
              </button>
              
              {selectedLead.status_pagamento === 'pendente' && (
                <button
                  onClick={() => handleMarkAsPaid(selectedLead)}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 size={14} /> Marcar como Pago
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

