import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { Download, Settings, Users, DollarSign, CheckCircle2, Clock, Plus, X } from 'lucide-react';
import { ILead, IConfigNotificacoes } from '../../types/lead';
import Swal from 'sweetalert2';

export const GerenciamentoLeads = () => {
  const [leads, setLeads] = useState<ILead[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [config, setConfig] = useState<IConfigNotificacoes>({ emails_admin: [] });
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch leads
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'leads'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ILead[];
      // sort by date descending
      data.sort((a, b) => {
        const dA = a.data_solicitacao?.toDate ? a.data_solicitacao.toDate().getTime() : new Date(a.data_solicitacao).getTime();
        const dB = b.data_solicitacao?.toDate ? b.data_solicitacao.toDate().getTime() : new Date(b.data_solicitacao).getTime();
        return (dB || 0) - (dA || 0);
      });
      setLeads(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch config
  useEffect(() => {
    const fetchConfig = async () => {
      const d = await getDoc(doc(db, 'configs', 'notificacoes'));
      if (d.exists()) {
        setConfig(d.data() as IConfigNotificacoes);
      }
    };
    fetchConfig();
  }, []);

  // Calculate Metrics
  const totalLeads = leads.length;
  const totalPago = leads.filter(l => l.status_pagamento === 'pago').length;
  const totalPendente = leads.filter(l => l.status_pagamento === 'pendente').length;
  const receitaTotal = leads
    .filter(l => l.status_pagamento === 'pago')
    .reduce((acc, curr) => acc + (curr.valor_venda || 0), 0);

  // CSV Export
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

  // Config Modal actions
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

  const formatDate = (val: any) => {
    if (!val) return '-';
    // If it's a firebase timestamp
    if (val.toDate) {
      return val.toDate().toLocaleString('pt-BR');
    }
    // Try to parse string/number
    try {
      return new Date(val).toLocaleString('pt-BR');
    } catch {
      return '-';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gerenciamento de Leads</h1>
          <p className="text-sm text-slate-500">Monitoramento e painel de conversão</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Settings size={16} /> Configurações
          </button>
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm shadow-blue-500/20"
          >
            <Download size={16} /> Exportar Planilha
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Users size={20} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Total de Leads</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white mt-4">{totalLeads}</p>
        </div>
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
              <DollarSign size={20} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Receita Total</span>
          </div>
          <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-4">{formatCurrency(receitaTotal)}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Leads Pagos</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white mt-4">{totalPago}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
              <Clock size={20} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Pendentes</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white mt-4">{totalPendente}</p>
        </div>
      </div>

      {/* Tabela de Leads */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase tracking-widest">
              <tr>
                <th className="p-4 font-semibold">Data</th>
                <th className="p-4 font-semibold">Nome / Contato</th>
                <th className="p-4 font-semibold">Pacote</th>
                <th className="p-4 font-semibold">Valor</th>
                <th className="p-4 font-semibold">Gateway</th>
                <th className="p-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Carregando...</td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">Nenhum lead encontrado.</td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(lead.data_solicitacao)}</td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{lead.nome}</div>
                      <div className="text-xs text-slate-500">{lead.email} • {lead.whatsapp}</div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">{lead.pacote_escolhido || '-'}</td>
                    <td className="p-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatCurrency(lead.valor_venda)}
                    </td>
                    <td className="p-4 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                      {lead.gateway_usado || '-'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        lead.status_pagamento === 'pago' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
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

      {/* Modal Notificações */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Alertas por E-mail</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-full"
              >
                <X size={16} />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-4">Adicione os e-mails da sua equipe que devem receber alertas quando um pagamento for aprovado.</p>
            
            <div className="flex gap-2 mb-6">
              <input 
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && addEmail()}
              />
              <button 
                onClick={addEmail}
                className="p-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg transition-colors"
                title="Adicionar E-mail"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-2">
              {config.emails_admin.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">Nenhum e-mail configurado.</p>
              ) : (
                config.emails_admin.map(email => (
                  <div key={email} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-sm text-slate-600 dark:text-slate-300 truncate pr-4">{email}</span>
                    <button 
                      onClick={() => removeEmail(email)}
                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveConfig}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors shadow-sm shadow-blue-500/20"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
