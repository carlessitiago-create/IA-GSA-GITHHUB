import React from 'react';
import { useAuth, UserProfile } from './AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  ShoppingCart, 
  Megaphone, 
  Settings, 
  AlertTriangle, 
  Factory, 
  Package,
  User, 
  LogOut,
  X, 
  BarChart3, 
  MessageSquare, 
  ShieldCheck,
  LayoutGrid,
  ClipboardList,
  Wallet,
  Search,
  Activity,
  MousePointerClick,
  Gift,
  Trophy,
  EyeOff
} from 'lucide-react';

interface SidebarProps {
  view: string;
  setView: (v: any) => void;
  currentProfile: any;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: string;
  color?: string;
  roles?: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({ view, setView, currentProfile, isOpen, setIsOpen }) => {
  const { logout, isSimulating, stopSimulation, realProfile } = useAuth();

  const isAdm = currentProfile?.nivel?.startsWith('ADM') || currentProfile?.nivel === 'GESTOR' || currentProfile?.nivel === 'VENDEDOR';

  const admItems: MenuItem[] = [
    { id: 'financeiro', label: 'DASHBOARD', icon: <BarChart3 className="size-5" />, group: 'FINANCEIRO', roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    
    { id: 'vendas-internas', label: 'VENDAS (PDV)', icon: <ShoppingCart className="size-5" />, group: 'COMERCIAL', color: 'text-emerald-500', roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    { id: 'venda-massa', label: 'VENDA EM MASSA', icon: <Package className="size-5" />, group: 'COMERCIAL', color: 'text-blue-500', roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    { id: 'leads', label: 'LEADS E INDICAÇÕES', icon: <MousePointerClick className="size-5" />, group: 'COMERCIAL', roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    { id: 'clube', label: 'CLUBE DE PONTOS', icon: <Gift className="size-5" />, group: 'COMERCIAL', roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    { id: 'vitrine', label: 'VITRINE GSA', icon: <LayoutGrid className="size-5" />, group: 'COMERCIAL' },
    
    { id: 'operacional', label: 'FILA DE PRODUÇÃO', icon: <Settings className="size-5" />, group: 'OPERAÇÕES', roles: ['ADM_MASTER', 'ADM_GERENTE', 'ADM_ANALISTA'] },
    { id: 'pendencias', label: 'PENDÊNCIAS', icon: <AlertTriangle className="size-5" />, group: 'OPERAÇÕES', color: 'text-amber-500' },
    { id: 'auditoria', label: 'AUDITORIA SLA', icon: <Search className="size-5" />, group: 'OPERAÇÕES', roles: ['ADM_MASTER', 'ADM_GERENTE'] },
    
    { id: 'fabrica', label: 'FÁBRICA DE SERVIÇOS', icon: <Factory className="size-5" />, group: 'ENGENHARIA', roles: ['ADM_MASTER', 'ADM_GERENTE'] },
    { id: 'equipe', label: currentProfile?.nivel === 'VENDEDOR' ? 'MEUS CLIENTES' : currentProfile?.nivel === 'GESTOR' ? 'MINHA EQUIPE' : 'GESTÃO DE EQUIPE', icon: <Users className="size-5" />, group: 'ENGENHARIA', roles: ['ADM_MASTER', 'ADM_GERENTE', 'GESTOR', 'VENDEDOR'] },
    { id: 'inteligencia', label: 'INTELIGÊNCIA', icon: <Activity className="size-5" />, group: 'ENGENHARIA', roles: ['ADM_MASTER', 'GESTOR'] },
    { id: 'conversao', label: 'CONVERSÃO', icon: <BarChart3 className="size-5" />, group: 'ENGENHARIA', roles: ['ADM_MASTER', 'GESTOR'] },
    
    { id: 'consulta-interna', label: 'CONSULTA PÚBLICA', icon: <Search className="size-5" />, group: 'SISTEMA' },
    { id: 'suporte', label: 'SUPORTE', icon: <MessageSquare className="size-5" />, group: 'SISTEMA' },
    { id: 'perfil', label: 'MEU PERFIL', icon: <User className="size-5" />, group: 'USUÁRIO' },
  ];

  const clientItems: MenuItem[] = [
    { id: 'clube_pontos', label: 'CLUBE DE PONTOS', icon: <Trophy className="size-5" />, group: 'COMERCIAL' },
    { id: 'clube-cliente', label: 'INDIQUE E GANHE', icon: <Gift className="size-5" />, group: 'COMERCIAL' },
    { id: 'vitrine-cliente', label: 'VITRINE DE SERVIÇOS', icon: <LayoutGrid className="size-5" />, group: 'COMERCIAL' },
    { id: 'processos-cliente', label: 'MEUS PROCESSOS', icon: <ClipboardList className="size-5" />, group: 'OPERAÇÕES' },
    { id: 'carteira', label: 'MINHA CARTEIRA', icon: <Wallet className="size-5" />, group: 'FINANCEIRO' },
    { id: 'perfil-cliente', label: 'MEU PERFIL', icon: <User className="size-5" />, group: 'USUÁRIO' },
  ];

  const menuItems = isAdm 
    ? admItems.filter(item => !item.roles || item.roles.includes(currentProfile?.nivel))
    : clientItems;

  const groups = isAdm 
    ? ['FINANCEIRO', 'COMERCIAL', 'OPERAÇÕES', 'ENGENHARIA', 'SISTEMA', 'USUÁRIO']
    : ['COMERCIAL', 'OPERAÇÕES', 'FINANCEIRO', 'USUÁRIO'];

  return (
    <>
      {/* Overlay para Mobile (fecha ao clicar fora) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Principal */}
      <aside className={`
        fixed md:relative z-[70] h-full bg-[#0a0a2e] text-white flex flex-col transition-all duration-300 ease-in-out
        ${isOpen ? 'left-0 w-72' : '-left-72 md:left-0 w-0 md:w-64'}
      `}>
        
        {/* TOPO FIXO: LOGO */}
        <div className="p-6 shrink-0 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="text-white size-6" />
            </div>
            <h1 className="text-xl font-black italic tracking-tighter uppercase">GSA IA</h1>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="md:hidden p-3 bg-white/10 hover:bg-rose-500/20 hover:text-rose-500 rounded-xl text-white transition-all active:scale-95 border border-white/5"
          >
            <X className="size-6" />
          </button>
        </div>

        {/* ÁREA CENTRAL ROLÁVEL */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 no-scrollbar space-y-8">
          {groups.map((group) => {
            const itemsInGroup = menuItems.filter(item => item.group === group);
            if (itemsInGroup.length === 0) return null;
            
            return (
              <div key={group} className="space-y-2">
                <h3 className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{group}</h3>
                <div className="space-y-1">
                  {itemsInGroup.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setView(item.id); if(window.innerWidth < 768) setIsOpen(false); }}
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group
                        ${view === item.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                      `}
                    >
                      <span className={`${view === item.id ? 'text-white' : item.color || 'text-blue-400'} group-hover:scale-110 transition-transform`}>
                        {item.icon}
                      </span>
                      <span className="tracking-tight">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* RODAPÉ FIXO: PERFIL E LOGOUT */}
        <div className="p-4 shrink-0 bg-black/30 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-full bg-blue-500 border-2 border-blue-400 overflow-hidden shrink-0">
              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(currentProfile?.nome_completo || 'User')}&background=random`} alt="Avatar" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black truncate uppercase italic tracking-tighter">{currentProfile?.nome_completo || 'Usuário'}</p>
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter truncate">
                {currentProfile?.nivel?.replace('_', ' ') || 'Acessando...'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <LogOut className="size-4" /> SAIR DO SISTEMA
          </button>

          {isSimulating && (
            <button 
              onClick={stopSimulation}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <EyeOff className="size-4" /> PARAR SIMULAÇÃO
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
