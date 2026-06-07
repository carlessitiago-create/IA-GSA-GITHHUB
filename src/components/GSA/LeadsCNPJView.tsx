import React, { useState, useEffect } from 'react';
import { Target, Loader2, Download, Search, CheckCircle2, Clock, FileText } from 'lucide-react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Swal from 'sweetalert2';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const LeadsCNPJView: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [selectedLeadLogs, setSelectedLeadLogs] = useState<any[] | null>(null);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const clientsQuery = query(
          collection(db, 'clients'), 
          where('origem', '==', 'Landing Page SaaS')
        );
        const logsQuery = query(collection(db, 'logs_email'));
        
        const [clientsSnapshot, logsSnapshot] = await Promise.all([
          getDocs(clientsQuery),
          getDocs(logsQuery)
        ]);

        setLeads(clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setEmailLogs(logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredLeads = leads.filter(item => 
    (item.nome?.toLowerCase().includes(search.toLowerCase())) ||
    (item.email?.toLowerCase().includes(search.toLowerCase())) ||
    (item.whatsapp?.includes(search))
  );

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const chartData = [
    { name: 'Contratou Reunião', value: leads.filter(l => l.contratou_reuniao).length },
    { name: 'Aguardando', value: leads.filter(l => !l.contratou_reuniao).length }
  ];
  const COLORS = ['#10b981', '#cbd5e1'];

  const STATUS_OPTIONS = ['Pendente', 'Agendado', 'Realizado', 'Cancelado'];

  const exportToCSV = () => {
    const headers = ["Nome", "E-mail", "WhatsApp", "Data", "Status Reunião"];
    const csvRows = leads.map((item: any) => {
      const name = item.nome || '';
      const email = item.email || '';
      const whatsapp = item.whatsapp || '';
      const date = item.data_entrada?.toDate ? format(item.data_entrada.toDate(), "dd/MM/yyyy") : '';
      const status = item.status_reuniao || (item.contratou_reuniao ? 'Agendado' : 'Pendente');
      return [name, email, whatsapp, date, status].map(val => `"${val.replace(/"/g, '""')}"`).join(',');
    });
    
    const csvString = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_cnpj_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generatePDF = (item: any) => {
    const doc = new jsPDF();
    doc.text(`Resumo do Lead: ${item.nome}`, 14, 15);
    autoTable(doc, {
        head: [['Campo', 'Valor']],
        body: [
            ['Nome', item.nome || ''],
            ['E-mail', item.email || ''],
            ['WhatsApp', item.whatsapp || ''],
            ['Data de Cadastro', item.data_entrada?.toDate ? format(item.data_entrada.toDate(), "dd/MM/yyyy") : ''],
            ['Status Reunião', item.status_reuniao || (item.contratou_reuniao ? 'Agendado' : 'Pendente')],
        ],
        startY: 25,
    });
    doc.save(`lead_${(item.nome || 'lead').replace(/\s+/g, '_')}.pdf`);
  };

  const saveStatus = async (item: any, newStatus: string, feedbackText: string) => {
    try {
        const leadRef = doc(db, 'clients', item.id);
        await updateDoc(leadRef, {
            status_reuniao: newStatus,
            feedback: feedbackText,
            status_updated_by: 'admin'
        });
        setLeads(prev => prev.map(l => l.id === item.id ? { ...l, status_reuniao: newStatus, feedback: feedbackText, status_updated_by: 'admin' } : l));
        setEditingLead(null);
        setFeedback('');
        Swal.fire({
          icon: 'success',
          title: 'Status atualizado!',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3000
        });
    } catch (error) {
        console.error("Error updating status:", error);
        Swal.fire('Erro', 'Não foi possível atualizar o status.', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 size-8" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-2xl font-black text-[#0a0a2e] uppercase tracking-tighter italic">Leads CNPJ</h2>
        <div className="flex items-center gap-4">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Buscar leads..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <button onClick={exportToCSV} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200"><Download size={18} /></button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-64">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
              {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-900 font-bold uppercase bg-slate-200">
            <tr>
              <th className="px-6 py-4">Nome</th>
              <th className="px-6 py-4">E-mail</th>
              <th className="px-6 py-4">WhatsApp</th>
              <th className="px-6 py-4">Pagamento</th>
              <th className="px-6 py-4">Status Reunião</th>
              <th className="px-6 py-4">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            <AnimatePresence>
            {paginatedLeads.map((item) => (
              <motion.tr 
                key={item.id} 
                layout 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="hover:bg-slate-50"
              >
                <td className="px-6 py-4 font-bold text-slate-950">{item.nome}</td>
                <td className="px-6 py-4 text-slate-950">{item.email}</td>
                <td className="px-6 py-4 text-slate-950">{item.whatsapp}</td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${item.status_pagamento === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.status_pagamento || 'Pendente'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={item.status_reuniao || (item.contratou_reuniao ? 'Agendado' : 'Pendente')}
                    onChange={(e) => setEditingLead({item, newStatus: e.target.value})}
                    className="text-xs font-bold px-2 py-1 rounded-full border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <div className="text-[9px] text-slate-400 mt-1 uppercase font-bold">
                    {item.status_updated_by === 'system' ? 'Automático' : 'Manual'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedLeadLogs(emailLogs.filter(log => log.email === item.email))} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                      <FileText size={18} />
                    </button>
                    <button onClick={() => generatePDF(item)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                      <Download size={18} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
            </AnimatePresence>
          </tbody>
        </table>
        {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200">
                <button 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg disabled:opacity-50"
                >Anterior</button>
                <span className="text-sm">Página {currentPage} de {totalPages}</span>
                <button 
                    disabled={currentPage === totalPages} 
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg disabled:opacity-50"
                >Próximo</button>
            </div>
        )}
      </div>

      {selectedLeadLogs && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-lg space-y-4">
            <h3 className="font-bold text-lg">Histórico de E-mails</h3>
            {selectedLeadLogs.length > 0 ? (
                <ul className="space-y-2">
                    {selectedLeadLogs.map(log => (
                        <li key={log.id} className="text-sm p-2 bg-slate-50 rounded">
                            {format(log.data_envio?.toDate ? log.data_envio.toDate() : new Date(), "dd/MM/yyyy HH:mm")} - {log.status}
                        </li>
                    ))}
                </ul>
            ) : <p className="text-sm text-slate-500">Nenhum log encontrado.</p>}
            <button onClick={() => setSelectedLeadLogs(null)} className="w-full py-2 bg-blue-600 text-white rounded-xl">Fechar</button>
          </div>
        </div>
      )}

      {editingLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-3xl w-full max-w-lg space-y-4">
            <h3 className="font-bold text-lg">Editar Status do Lead</h3>
            <p className="text-sm text-slate-600">Lead: {editingLead.item.nome}</p>
            <p className="text-sm text-slate-600">Novo Status: <span className="font-bold">{editingLead.newStatus}</span></p>
            <textarea 
                value={feedback} 
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Adicione observações sobre o resultado do diagnóstico..."
                className="w-full h-32 p-3 border border-slate-300 rounded-xl"
            />
            <div className="flex gap-2">
                <button onClick={() => setEditingLead(null)} className="flex-1 py-2 bg-slate-200 text-slate-800 rounded-xl">Cancelar</button>
                <button onClick={() => saveStatus(editingLead.item, editingLead.newStatus, feedback)} className="flex-1 py-2 bg-blue-600 text-white rounded-xl">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
