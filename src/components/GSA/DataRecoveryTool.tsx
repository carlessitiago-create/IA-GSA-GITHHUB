import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Search, Database, Users, FileText, AlertCircle, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export const DataRecoveryTool: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'order_processes'>('usuarios');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      console.log("[DataRecovery] UID Iniciando busca:", currentUser?.uid);
      
      const collRef = collection(db, activeTab);
      // Tentativa de busca pura sem filtros
      const snap = await getDocs(collRef);
      
      if (snap.empty) {
        console.warn(`[DataRecovery] NENHUM documento encontrado na coleção ${activeTab} via web query.`);
      }

      const items = snap.docs.map(doc => ({ 
        id: doc.id, 
        _snapshot_source: snap.metadata.fromCache ? 'Local Cache' : 'Server',
        ...doc.data() 
      }));
      setData(items);
    } catch (error: any) {
      console.error('Error fetching recovery data:', error);
      Swal.fire('Erro de Leitura', `Falha ao acessar ${activeTab}: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const filteredData = data.filter(item => {
    const searchStr = JSON.stringify(item).toLowerCase();
    return searchStr.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col h-[700px]">
      {/* Search & Tabs */}
      <div className="p-6 border-b border-slate-100 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900 uppercase italic flex items-center gap-2">
              <Database className="text-blue-600" size={20} /> Recuperação de Dados
            </h2>
            <p className="text-slate-500 text-xs font-medium">Visualização direta do Firestore sem filtros de interface.</p>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Pesquisar no banco..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('usuarios')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === 'usuarios' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={14} /> Usuários ({activeTab === 'usuarios' ? filteredData.length : '...'})
          </button>
          <button 
            onClick={() => setActiveTab('order_processes')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeTab === 'order_processes' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={14} /> Processos ({activeTab === 'order_processes' ? filteredData.length : '...'})
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Consultando Firestore...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4 text-slate-400">
            <AlertCircle size={48} className="opacity-20" />
            <p className="text-xs font-black uppercase tracking-widest">Nenhum dado encontrado no Firestore.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
              <tr>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Documento ID / Resumo</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Campos Principais</th>
                <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredData.map((item) => (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-mono font-bold text-blue-600">{item.id}</p>
                        <p className="text-sm font-bold text-slate-700">
                          {activeTab === 'usuarios' ? item.nome_completo || item.email : item.cliente_nome || item.protocolo}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(item).slice(0, 4).map(([key, value]: [string, any]) => {
                          if (key === 'id' || typeof value === 'object') return null;
                          return (
                            <span key={key} className="px-2 py-1 bg-slate-100 rounded text-[9px] font-bold text-slate-500 whitespace-nowrap">
                              {key}: <span className="text-slate-900">{String(value).slice(0, 20)}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-all text-slate-400 hover:text-slate-900"
                      >
                        {expandedId === item.id ? <ChevronUp size={18} /> : <Eye size={18} />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded JSON View */}
                  <AnimatePresence>
                    {expandedId === item.id && (
                      <tr>
                        <td colSpan={3} className="p-0">
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-slate-900 overflow-hidden"
                          >
                            <div className="p-6 space-y-4">
                              <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <Database size={12} /> Objeto Completo (JSON)
                                </h4>
                                <button className="text-[9px] font-bold text-blue-400 hover:underline uppercase">Copiar JSON</button>
                              </div>
                              <pre className="text-[11px] text-blue-300 font-mono bg-slate-800/50 p-4 rounded-xl border border-white/5 overflow-x-auto max-h-60 scrollbar-thin">
                                {JSON.stringify(item, null, 2)}
                              </pre>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
