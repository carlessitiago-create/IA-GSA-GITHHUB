import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../lib/dateUtils';
import { 
  Menu, 
  Bell, 
  MessageCircle, 
  AlertTriangle,
  Trophy,
  Search,
  LogOut,
  X,
  User,
  FileText,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeaderProps {
  view: string;
  currentProfile: any;
  onMenuToggle: () => void;
  onLogout?: () => void;
  managerPhone: string | null;
  walletBalance: number;
  pointsBalance: number;
  isNotificationOpen: boolean;
  setIsNotificationOpen: (v: boolean) => void;
  notifications: any[];
  markAsRead: (id: string) => void;
  setView: (v: string) => void;
  selectedClientName?: string;
  allUsers?: any[];
  processes?: any[];
  showcaseLeads?: any[];
}

export const Header: React.FC<HeaderProps> = ({ 
  view = '',
  currentProfile = null,
  onMenuToggle = () => {},
  onLogout,
  managerPhone = null,
  walletBalance = 0,
  pointsBalance = 0,
  isNotificationOpen = false,
  setIsNotificationOpen = () => {},
  notifications = [],
  markAsRead = () => {},
  setView = () => {},
  selectedClientName,
  allUsers = [],
  processes = [],
  showcaseLeads = []
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [dbResults, setDbResults] = useState<{ clients: any[], referrals: any[] }>({ clients: [], referrals: [] });
  const [isSearchingDb, setIsSearchingDb] = useState(false);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.global-search-container')) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced search on Firestore for other records
  useEffect(() => {
    if (searchQuery.trim().length < 3) {
      setDbResults({ clients: [], referrals: [] });
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setIsSearchingDb(true);
      try {
        const queryText = searchQuery.toLowerCase();
        const uid = currentProfile?.uid;
        const level = currentProfile?.nivel;

        const { collection, getDocs, query, where, limit } = await import('firebase/firestore');
        const { db } = await import('../../firebase');

        let clientsRef = collection(db, 'clients');
        let clientsQuery;
        
        if (level === 'ADM_MASTER' || level === 'ADM_GERENTE' || level === 'ADM_ANALISTA') {
          clientsQuery = query(clientsRef, limit(20));
        } else if (uid) {
          clientsQuery = query(clientsRef, where('visibilidade_uids', 'array-contains', uid), limit(20));
        }

        let referralsRef = collection(db, 'referrals');
        let referralsQuery;

        if (level === 'ADM_MASTER' || level === 'ADM_GERENTE' || level === 'ADM_ANALISTA') {
          referralsQuery = query(referralsRef, limit(20));
        } else if (uid) {
          referralsQuery = query(referralsRef, where('vendedor_id', '==', uid), limit(20));
        }

        const promises = [];
        if (clientsQuery) promises.push(getDocs(clientsQuery));
        else promises.push(Promise.resolve(null));

        if (referralsQuery) promises.push(getDocs(referralsQuery));
        else promises.push(Promise.resolve(null));

        const [clientsSnap, referralsSnap] = await Promise.all(promises);

        let extraClients: any[] = [];
        if (clientsSnap) {
          extraClients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((item: any) => {
            return (item.nome || '').toLowerCase().includes(queryText) ||
                   (item.email || '').toLowerCase().includes(queryText) ||
                   (item.whatsapp || '').includes(queryText);
          });
        }

        let extraReferrals: any[] = [];
        if (referralsSnap) {
          extraReferrals = referralsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((item: any) => {
            return (item.nome_indicado || '').toLowerCase().includes(queryText) ||
                   (item.email_indicado || '').toLowerCase().includes(queryText) ||
                   (item.telefone_indicado || '').includes(queryText);
          });
        }

        setDbResults({
          clients: extraClients,
          referrals: extraReferrals
        });
      } catch (error) {
        console.error("Erro na busca complementar do Firestore:", error);
      } finally {
        setIsSearchingDb(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, currentProfile]);

  const queryLower = searchQuery.toLowerCase().trim();

  // 1. Clientes (Profiles/Acessos)
  const matchedClients = searchQuery ? (allUsers || []).filter((u: any) => {
    if (u.nivel !== 'CLIENTE') return false;
    return (u.nome_completo || '').toLowerCase().includes(queryLower) ||
           (u.email || '').toLowerCase().includes(queryLower) ||
           (u.cpf || '').includes(queryLower) ||
           (u.cnpj || '').includes(queryLower);
  }) : [];

  const allMatchedClients = [...matchedClients];
  const seenClientIds = new Set(allMatchedClients.map(c => c.uid || c.id));

  (dbResults.clients || []).forEach((c: any) => {
    const id = c.id || c.uid;
    if (!seenClientIds.has(id)) {
      seenClientIds.add(id);
      allMatchedClients.push({
        uid: id,
        nome_completo: c.nome,
        email: c.email,
        telefone: c.whatsapp,
        cpf: c.cpf || c.documento,
        nivel: 'CLIENTE',
        fromClientsCollection: true
      });
    }
  });

  // 2. Processos
  const matchedProcesses = searchQuery ? (processes || []).filter((p: any) => {
    return (p.protocolo || '').toLowerCase().includes(queryLower) ||
           (p.cliente_nome || '').toLowerCase().includes(queryLower) ||
           (p.cliente_cpf_cnpj || '').includes(queryLower) ||
           (p.servico_nome || '').toLowerCase().includes(queryLower) ||
           (p.vendedor_nome || '').toLowerCase().includes(queryLower);
  }) : [];

  // 3. Leads (ShowcaseLeads and Referrals)
  const matchedLeads = searchQuery ? (showcaseLeads || []).filter((l: any) => {
    return (l.cliente_nome || '').toLowerCase().includes(queryLower) ||
           (l.cliente_email || '').toLowerCase().includes(queryLower) ||
           (l.cliente_telefone || '').toLowerCase().includes(queryLower) ||
           (l.servico_nome || '').toLowerCase().includes(queryLower) ||
           (l.status || '').toLowerCase().includes(queryLower);
  }) : [];

  const allMatchedLeads = [...matchedLeads.map(l => ({ ...l, type: 'vitrine' }))];
  const seenLeadIds = new Set(allMatchedLeads.map(l => l.id));

  (dbResults.referrals || []).forEach((r: any) => {
    if (!seenLeadIds.has(r.id)) {
      seenLeadIds.add(r.id);
      allMatchedLeads.push({
        id: r.id,
        cliente_nome: r.nome_indicado,
        cliente_email: r.email_indicado,
        cliente_telefone: r.telefone_indicado,
        servico_nome: 'Indicação Manual',
        status: r.status_indicacao,
        type: 'referral'
      } as any);
    }
  });

  const hasAnyResults = allMatchedClients.length > 0 || matchedProcesses.length > 0 || allMatchedLeads.length > 0;

  const handleSelectResult = (type: 'client' | 'process' | 'lead', item: any) => {
    setSearchQuery('');
    setIsFocused(false);
    setShowMobileSearch(false);
    
    if (type === 'client') {
      const searchVal = item.cpf || item.cnpj || item.nome_completo || item.email || '';
      navigate(`/clientes?search=${encodeURIComponent(searchVal)}`);
    } else if (type === 'process') {
      const isCliente = currentProfile?.nivel === 'CLIENTE';
      const path = isCliente ? '/processos-cliente' : '/operacional';
      navigate(`${path}?search=${encodeURIComponent(item.protocolo || '')}`);
    } else if (type === 'lead') {
      const searchVal = item.cliente_nome || item.cliente_email || '';
      navigate(`/leads?search=${encodeURIComponent(searchVal)}`);
    }
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200 px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-30">
      
      {/* LADO ESQUERDO: Botão Menu + Título */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuToggle}
          className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <Menu size={24} />
        </button>
        
        <h2 className="text-lg md:text-xl font-bold text-slate-800 hidden sm:block tracking-tight ml-4">
          {selectedClientName ? selectedClientName :
           view === 'equipe' ? (currentProfile?.nivel === 'VENDEDOR' ? 'Meu Perfil' : currentProfile?.nivel === 'GESTOR' ? 'Minha Equipe' : 'Gestão de Equipe') : 
           view === 'clientes' ? 'Gestão de Clientes' : 
           view === 'vendas-internas' ? 'Nova Venda' : 
           view === 'perfil' ? 'Meu Perfil' :
           view === 'operacional' ? 'Fila de Produção' :
           view === 'pendencias' ? 'Pendências' :
           view === 'auditoria' ? 'Auditoria SLA' :
           view === 'fabrica' ? 'Fábrica de Serviços' :
           view === 'leads' ? 'Leads e Indicações' :
           view === 'processos-cliente' ? 'Meus Processos' :
           view === 'inteligencia' ? 'Inteligência' :
           view === 'conversao' ? 'Conversão' :
           view === 'clube' ? 'Clube de Pontos' :
           view === 'clube_pontos' ? 'Clube de Pontos' :
           view === 'vitrine' ? 'Vitrine GSA' :
           view === 'vitrine-cliente' ? 'Vitrine de Serviços' :
           view === 'carteira' ? 'Minha Carteira' :
           view === 'processos' ? 'Modelos de Processos' :
           view === 'financeiro' ? 'Financeiro' : 
           view === 'suporte' ? 'Suporte' :
           view === 'consulta-interna' ? 'Consulta Pública' : 'Painel de Controle'}
        </h2>
      </div>

      {/* BARRA DE BUSCA GLOBAL (Desktop e Tablet) */}
      <div className="flex-1 max-w-sm md:max-w-md lg:max-w-lg mx-4 relative global-search-container hidden md:block z-[40]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
          <input
            type="text"
            placeholder="Buscar por cliente, processo ou lead..."
            className="w-full pl-10 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none transition-all duration-200 text-slate-800"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsFocused(true);
            }}
            onFocus={() => setIsFocused(true)}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDbResults({ clients: [], referrals: [] });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* PAINEL DE RESULTADOS FLUTUANTE (Desktop) */}
        <AnimatePresence>
          {isFocused && searchQuery && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute left-0 mt-2 w-full bg-white rounded-2xl shadow-xl border border-slate-100 z-[150] overflow-hidden max-h-[450px] overflow-y-auto"
            >
              {isSearchingDb && (
                <div className="flex items-center justify-center p-3 border-b border-slate-50 bg-slate-50/50 text-xs text-blue-600 font-medium gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  Buscando mais registros no banco...
                </div>
              )}

              {!hasAnyResults && !isSearchingDb && (
                <div className="p-8 text-center text-slate-400">
                  <Search className="mx-auto size-8 mb-2 opacity-40" />
                  <p className="text-sm font-medium">Nenhum resultado encontrado...</p>
                  <p className="text-xs opacity-75 mt-0.5">Tente utilizar outros termos de busca.</p>
                </div>
              )}

              {/* CATEGORIA: CLIENTES */}
              {allMatchedClients.length > 0 && (
                <div className="p-2 border-b border-slate-50">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="size-3" />
                    Clientes ({allMatchedClients.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {allMatchedClients.slice(0, 5).map((item) => (
                      <button
                        key={item.uid || item.id}
                        type="button"
                        onClick={() => handleSelectResult('client', item)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-800 leading-tight">
                            {item.nome_completo}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] lg:max-w-[300px]">
                            {item.email || 'Nenhum e-mail'}
                          </p>
                        </div>
                        {item.cpf && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md self-center hidden sm:inline">
                            CPF/CNPJ: {item.cpf}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CATEGORIA: PROCESSOS */}
              {matchedProcesses.length > 0 && (
                <div className="p-2 border-b border-slate-50">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="size-3" />
                    Processos ({matchedProcesses.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {matchedProcesses.slice(0, 5).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectResult('process', p)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800 leading-tight">
                            Prot: {p.protocolo}
                          </p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            {p.status_atual}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex justify-between whitespace-nowrap overflow-hidden text-ellipsis">
                          <span>Cliente: {p.cliente_nome || 'Não informado'}</span>
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">{p.servico_nome}</span>
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* CATEGORIA: LEADS */}
              {allMatchedLeads.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="size-3" />
                    Leads e Indicações ({allMatchedLeads.length})
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {allMatchedLeads.slice(0, 5).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => handleSelectResult('lead', l)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-50 active:bg-slate-100 rounded-lg transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-800 leading-tight">
                            {l.cliente_nome}
                          </p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                            {l.status || 'Novo'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex justify-between whitespace-nowrap overflow-hidden text-ellipsis">
                          <span>{l.cliente_email || 'Sem e-mail'}</span>
                          <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">{l.servico_nome}</span>
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Botão de Busca Mobile (exibido apenas em mobile) */}
      <button
        onClick={() => setShowMobileSearch(true)}
        className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl md:hidden transition-colors"
        type="button"
      >
        <Search size={22} />
      </button>

      {/* BUSCA MOBILE OVERLAY */}
      <AnimatePresence>
        {showMobileSearch && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-0 h-20 bg-white border-b border-slate-200 z-50 flex items-center px-4 gap-3 md:hidden global-search-container"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
              <input
                type="text"
                placeholder="Buscar cliente, processo ou lead..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl focus:outline-none transition-all duration-200 text-slate-800"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setDbResults({ clients: [], referrals: [] });
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            
            <button
              onClick={() => setShowMobileSearch(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              type="button"
            >
              FECHAR
            </button>

            {/* PAINEL DE RESULTADOS FLUTUANTE (Mobile) */}
            <div className="absolute left-0 right-0 top-20 bg-white shadow-2xl border-b border-slate-200 max-h-[80vh] overflow-y-auto overflow-x-hidden z-[150]">
              {isSearchingDb && (
                <div className="flex items-center justify-center p-3 bg-slate-50 text-xs text-blue-600 font-medium gap-1.5">
                  <Loader2 className="size-3 animate-spin md:hidden" />
                  Buscando mais registros...
                </div>
              )}

              {searchQuery && !hasAnyResults && !isSearchingDb && (
                <div className="p-8 text-center text-slate-400">
                  <p className="text-sm font-medium">Nenhum resultado...</p>
                </div>
              )}

              {searchQuery && (
                <>
                  {/* CATEGORIA MOBILE: CLIENTES */}
                  {allMatchedClients.length > 0 && (
                    <div className="p-2 border-b border-slate-100">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <User className="size-3" />
                        Clientes ({allMatchedClients.length})
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {allMatchedClients.map((item) => (
                          <button
                            key={item.uid || item.id}
                            type="button"
                            onClick={() => handleSelectResult('client', item)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex justify-between items-center"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{item.nome_completo}</p>
                              <p className="text-xs text-slate-500">{item.email}</p>
                            </div>
                            {item.cpf && <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded">{item.cpf}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CATEGORIA MOBILE: PROCESSOS */}
                  {matchedProcesses.length > 0 && (
                    <div className="p-2 border-b border-slate-100">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="size-3" />
                        Processos ({matchedProcesses.length})
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {matchedProcesses.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectResult('process', p)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg"
                          >
                            <div className="flex justify-between">
                              <p className="text-sm font-semibold text-slate-800">Prot: {p.protocolo}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{p.status_atual}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Cliente: {p.cliente_nome}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CATEGORIA MOBILE: LEADS */}
                  {allMatchedLeads.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="size-3" />
                        Leads ({allMatchedLeads.length})
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {allMatchedLeads.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleSelectResult('lead', l)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg"
                          >
                            <div className="flex justify-between">
                              <p className="text-sm font-semibold text-slate-800">{l.cliente_nome}</p>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">{l.status || 'Novo'}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 sm:gap-6">
        {(currentProfile?.nivel === 'CLIENTE' || currentProfile?.nivel === 'ADM_MASTER') && (
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="text-right pr-2 sm:pr-4 border-r border-slate-200">
              <p className="hidden sm:block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Clube GSA</p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <Trophy size={14} className="text-yellow-500" />
                <p className="text-sm md:text-base font-bold text-yellow-600">
                  {pointsBalance} <span className="text-[10px] hidden sm:inline">PTS</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saldo em Carteira</p>
              <div className="flex items-center justify-end gap-2 mt-0.5">
                {walletBalance < 0 && (
                  <div className="flex items-center justify-center size-4 sm:size-5 bg-red-100 dark:bg-red-900/30 rounded-full" title="Você possui pendências financeiras.">
                    <AlertTriangle size={10} className="text-red-600 dark:text-red-400 sm:w-3 sm:h-3" />
                  </div>
                )}
                <p className={`text-base md:text-lg font-bold tracking-tight ${walletBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  R$ {walletBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="relative">
            <button 
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="size-10 rounded-full border flex items-center justify-center text-slate-400 hover:bg-slate-50 transition-all relative"
            >
              <Bell size={20} />
              {notifications.filter(n => !n.lida).length > 0 && (
                <span className="absolute top-0 right-0 size-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notifications.filter(n => !n.lida).length}
                </span>
              )}
            </button>

            <AnimatePresence>
              {isNotificationOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] overflow-hidden"
                >
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h4 className="font-bold text-slate-800 text-sm">Notificações</h4>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => {
                          notifications.forEach(n => n.id && markAsRead(n.id));
                        }}
                        className="text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors"
                      >
                        MARCAR TODAS
                      </button>
                      <button 
                        onClick={() => {
                          setView('notifications_center');
                          setIsNotificationOpen(false);
                        }}
                        className="text-xs text-slate-500 font-semibold hover:text-slate-700 transition-colors"
                      >
                        VER TODAS
                      </button>
                    </div>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-xs text-slate-400">Nenhuma notificação</p>
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div 
                          key={n.id}
                          onClick={() => {
                            if (n.id) markAsRead(n.id);
                            if (n.link) setView(n.link);
                            setIsNotificationOpen(false);
                          }}
                          className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-all ${!n.lida ? 'bg-blue-50/50' : ''}`}
                        >
                          <p className={`text-sm font-semibold mb-1 leading-tight ${!n.lida ? 'text-blue-700' : 'text-slate-800'}`}>
                            {n.titulo || (n as any).title || 'Aviso do Sistema'}
                          </p>
                          <p className={`text-xs font-medium line-clamp-2 leading-relaxed ${!n.lida ? 'text-blue-600/90' : 'text-slate-600'}`}>
                            {n.mensagem || (n as any).message}
                          </p>
                          <p className={`text-[10px] mt-2 font-medium ${!n.lida ? 'text-blue-500/80' : 'text-slate-400'}`}>
                            {formatDate(n.timestamp)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {onLogout && (
            <button 
              onClick={onLogout}
              className="size-10 rounded-full border flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all sm:hidden"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
