import React, { useState } from 'react';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, FileText, Clock, CheckCircle, AlertCircle, User, Calendar, ExternalLink, Info, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../components/AuthContext';
import { getPublicOrigin } from '../lib/urlUtils';
import { SmartFicha } from '../components/GSA/SmartFicha';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';

export function ConsultaPublicaView() {
  const { profile, simulateUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showSmartFicha, setShowSmartFicha] = useState<string | null>(null);

  const isAdminView = profile?.nivel === 'ADM_MASTER' || 
                    profile?.nivel === 'ADM_GERENTE' || 
                    profile?.nivel === 'ADM_ANALISTA' || 
                    profile?.nivel === 'GESTOR' || 
                    profile?.nivel === 'VENDEDOR';

  const handleSimulateClient = async (clienteUid: string) => {
    if (!clienteUid) return;
    try {
      const userSnap = await getDoc(doc(db, 'usuarios', clienteUid));
      if (userSnap.exists()) {
        const userData = { uid: userSnap.id, ...userSnap.data() } as any;
        Swal.fire({
          title: 'Simulando Cliente',
          text: `Entrando no ambiente de ${userData.nome_completo}`,
          icon: 'info',
          timer: 1500,
          showConfirmButton: false,
          background: '#0a0a2e',
          color: '#fff'
        }).then(() => {
          simulateUser(userData);
        });
      }
    } catch (error) {
      console.error('Erro ao simular cliente:', error);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm || !dataNascimento) return;

    setLoading(true);
    setSearched(true);
    try {
      // Search by Protocol or CPF
      const qProtocol = query(
        collection(db, 'order_processes'), 
        where('protocolo', '==', searchTerm.toUpperCase()),
        where('cliente_data_nascimento', '==', dataNascimento)
      );
      const qCpf = query(
        collection(db, 'order_processes'), 
        where('cliente_cpf', '==', searchTerm),
        where('cliente_data_nascimento', '==', dataNascimento)
      );
      
      const [snapProtocol, snapCpf] = await Promise.all([
        getDocs(qProtocol),
        getDocs(qCpf)
      ]);

      const allResults = [
        ...snapProtocol.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...snapCpf.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      ];

      // Remove duplicates if any
      const uniqueResults = Array.from(new Map(allResults.map(item => [item.id, item])).values());
      setResults(uniqueResults);
    } catch (error) {
      console.error('Erro na consulta pública:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4 sm:px-6 lg:px-8">
      {isAdminView && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Search className="text-blue-600 size-6 sm:size-7" />
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">Consulta Administrativa</h2>
            </div>
            
            <button 
              onClick={() => window.open('/consulta', '_blank')}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              <ExternalLink size={14} /> Abrir Portal Externo (Link Público)
            </button>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-start gap-3">
            <Info className="text-blue-600 mt-0.5" size={18} />
            <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
              Este painel é para consulta administrativa rápida. O cliente final acessa através do link público: 
              <span className="font-black underline ml-1">{getPublicOrigin()}/consulta</span>
            </p>
          </div>
        </>
      )}

      <div className="text-center space-y-4">
        <div className="size-16 sm:size-20 bg-blue-600 rounded-2xl sm:rounded-[2rem] flex items-center justify-center mx-auto text-white shadow-xl shadow-blue-500/20">
          <Search className="size-6 sm:size-10" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Buscar Processo</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto text-xs sm:text-base px-4">
          Insira o CPF ou número de protocolo para acompanhar o status em tempo real.
        </p>
      </div>

      <form onSubmit={handleSearch} className="space-y-4 px-4 sm:px-0">
        <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-slate-800 p-2 sm:p-3 rounded-3xl sm:rounded-[2.5rem] border-2 border-slate-200 dark:border-slate-700 shadow-2xl focus-within:border-blue-500 transition-all">
          <div className="flex-1 flex items-center px-4 sm:px-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700">
            <input 
              type="text" 
              placeholder="CPF ou Protocolo" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent outline-none py-3 sm:py-4 text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400"
            />
          </div>
          <div className="flex-1 flex items-center px-4 sm:px-6">
            <input 
              type="date" 
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="w-full bg-transparent outline-none py-3 sm:py-4 text-sm font-bold text-slate-800 dark:text-white"
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full md:w-auto bg-[#0a0a2e] text-white px-8 sm:px-10 py-3 sm:py-4 rounded-2xl sm:rounded-[2rem] font-black uppercase text-xs sm:text-sm tracking-widest hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20"
          >
            {loading ? 'Buscando...' : 'Consultar'}
          </button>
        </div>
      </form>

      {searched && !loading && results.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 p-8 rounded-[2rem] border border-amber-100 dark:border-amber-900/30 text-center space-y-3">
          <AlertCircle className="text-amber-500 mx-auto size-8 sm:size-10" />
          <h3 className="text-xl font-black text-amber-800 dark:text-amber-400 uppercase italic">Nenhum Processo Encontrado</h3>
          <p className="text-amber-600 dark:text-amber-500/70 text-sm">
            Verifique se o CPF ou Protocolo digitado está correto. Caso o erro persista, entre em contato com seu consultor.
          </p>
        </div>
      )}

      <div className="space-y-4 px-4 sm:px-0">
        {results.map((processo) => (
          <div key={processo.id} className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-700 pb-6">
              <div>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full uppercase tracking-widest mb-2 inline-block">
                  Protocolo: {processo.protocolo}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white uppercase italic">{processo.cliente_nome}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">{processo.servico_nome}</p>
                
                {profile?.nivel?.startsWith('ADM') && processo.cliente_uid && (
                  <button 
                    onClick={() => handleSimulateClient(processo.cliente_uid)}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-all"
                  >
                    <Eye size={14} /> Simular Visão do Cliente
                  </button>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Status Atual</p>
                <span className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                  processo.status_atual === 'Concluído' ? 'bg-emerald-100 text-emerald-700' : 
                  processo.status_atual === 'Pendente' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {processo.status_atual}
                </span>

                {(processo.status_atual === 'Pendente' || processo.status_atual === 'Aguardando Documentação') && 
                 ((processo.dados_faltantes && processo.dados_faltantes.length > 0) || 
                  (processo.pendencias_iniciais && processo.pendencias_iniciais.length > 0)) && (
                  <button 
                    onClick={() => setShowSmartFicha(processo.id)}
                    className="mt-4 w-full bg-blue-600 text-white font-black py-3 rounded-xl text-[10px] flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                  >
                    <FileText size={14} /> RESOLVER PENDÊNCIAS AGORA
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl">
                <Calendar className="text-slate-400" size={20} />
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Data de Início</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    {processo.data_venda ? format(processo.data_venda.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl">
                <Clock className="text-slate-400" size={20} />
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Prazo Estimado</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{processo.prazo_estimado_dias || 7} Dias Úteis</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl">
                <User className="text-slate-400" size={20} />
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase">Consultor Responsável</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{processo.vendedor_nome || 'Equipe GSA'}</p>
                </div>
              </div>
            </div>

            {processo.historico_status && processo.historico_status.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Últimas Atualizações</p>
                <div className="space-y-2">
                  {processo.historico_status.slice(-3).reverse().map((hist: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border-l-4 border-blue-500">
                      <div className="size-2 bg-blue-500 rounded-full mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{hist.status}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{hist.observacao}</p>
                        <p className="text-[8px] text-slate-300 font-bold mt-1">{format(new Date(hist.data), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal SmartFicha */}
            <AnimatePresence>
              {showSmartFicha === processo.id && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative border border-slate-100 dark:border-slate-800"
                  >
                    <button 
                      onClick={() => setShowSmartFicha(null)}
                      className="absolute top-6 right-6 z-50 size-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-500 transition-all"
                    >
                      <Search size={20} className="rotate-45" />
                    </button>

                    <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center gap-4">
                      <div className="size-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tight">Resolver Pendências</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Complete as informações para o processo {processo.servico_nome}</p>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                      <SmartFicha 
                        processos={[processo]} 
                        clienteDados={profile || { id: processo.cliente_id, nome_completo: processo.cliente_nome }} 
                        onUpdate={() => {
                          setShowSmartFicha(null);
                          handleSearch({ preventDefault: () => {} } as any);
                        }} 
                      />
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
