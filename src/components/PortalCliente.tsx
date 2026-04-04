import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ShoppingBag, 
  FileText, 
  Wallet, 
  LogOut, 
  Bell, 
  MessageSquare,
  User,
  X,
  LayoutGrid,
  ClipboardList,
  Menu,
  ShieldCheck,
  Gift,
  Trophy
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { VitrineView } from './GSA/VitrineView';
import { ClientProcessesView } from './GSA/ClientProcessesView';
import { ClientWalletView } from './GSA/ClientWalletView';
import { ProfileView } from '../views/ProfileView';
import { ClubeMarketingView } from '../views/ClubeMarketingView';
import { ClubePontosView } from '../views/ClubePontosView';
import SupportModule from './Support/SupportModule';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'vitrine' | 'processos' | 'carteira' | 'perfil' | 'clube' | 'clube_pontos';

import { Sidebar } from './Sidebar';

export const PortalCliente: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>('vitrine');

  // Sincroniza a aba com a URL e define o padrão para clientes
  useEffect(() => {
    const path = location.pathname.substring(1); // Remove a barra inicial
    const validTabs: Tab[] = ['vitrine', 'clube', 'clube_pontos', 'processos', 'carteira', 'perfil'];
    
    if (path && (validTabs as string[]).includes(path)) {
      setActiveTab(path as Tab);
    } else if (profile?.nivel === 'CLIENTE') {
      // Se for cliente e não tiver aba na URL, o padrão é clube_pontos
      setActiveTab('clube_pontos');
      navigate('/clube_pontos', { replace: true });
    }
  }, [location.pathname, profile, navigate]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    navigate(`/${tab}`);
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  const tabs = [
    { id: 'clube_pontos', label: 'Clube de Pontos', icon: Trophy },
    { id: 'vitrine', label: 'Vitrine', icon: LayoutGrid },
    { id: 'clube', label: 'Indique e Ganhe', icon: Gift },
    { id: 'processos', label: 'Meus Processos', icon: ClipboardList },
    { id: 'carteira', label: 'Minha Carteira', icon: Wallet },
    { id: 'perfil', label: 'Meu Perfil', icon: User },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'vitrine': return <VitrineView />;
      case 'clube': return <ClubeMarketingView />;
      case 'clube_pontos': return <ClubePontosView />;
      case 'processos': return <ClientProcessesView />;
      case 'carteira': return <ClientWalletView />;
      case 'perfil': return <ProfileView />;
      default: return <ClubePontosView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex overflow-hidden">
      
      <Sidebar 
        view={activeTab}
        setView={handleTabChange}
        currentProfile={profile}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Mobile Header Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-100 z-[60] flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-[#0a0a2e] rounded-xl flex items-center justify-center shadow-lg">
            <ShieldCheck className="text-white" size={20} />
          </div>
          <span className="font-black text-lg uppercase italic tracking-tighter text-[#0a0a2e]">GSA IA</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#0a0a2e]"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        
        {/* HEADER DESKTOP/MOBILE */}
        <header className="h-16 shrink-0 bg-white border-b flex items-center justify-between px-4 md:px-8 mt-16 md:mt-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">
              {profile?.nome_completo || (tabs.find(t => t.id === activeTab)?.label || 'Portal')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
            <p className="font-black text-emerald-600 text-lg uppercase italic tracking-tighter">Ativo</p>
          </div>
        </header>

        {/* ÁREA DINÂMICA DE CONTEÚDO */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-8 no-scrollbar bg-slate-50/50">
          <div className="w-full max-w-7xl mx-auto space-y-8">

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>

      {/* MODAL DE SUPORTE */}
      <AnimatePresence>
        {showSupport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-6xl h-[85vh] relative"
            >
              <button 
                onClick={() => setShowSupport(false)}
                className="absolute -top-4 -right-4 z-[110] size-12 bg-white text-[#0a0a2e] rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-all border border-slate-100"
              >
                <X size={24} />
              </button>
              <div className="size-full rounded-[3rem] overflow-hidden border border-slate-100 shadow-2xl bg-white">
                <SupportModule nivel="CLIENTE" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PortalCliente;
