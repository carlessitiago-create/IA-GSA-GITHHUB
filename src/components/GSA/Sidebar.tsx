import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Shield, Users, PlusCircle, LayoutDashboard, History, Settings, 
  Package, DollarSign, TrendingUp, Bell, ClipboardList, Gift, 
  ShoppingBag, LogOut, ChevronRight, Activity, AlertTriangle, X,
  Factory, Trophy, Search, User
} from 'lucide-react';


export function Sidebar({ currentProfile, logout, onClose }: any) {
  const location = useLocation();
  const role = currentProfile?.nivel || 'CLIENTE';

  const isActive = (path: string) => location.pathname === `/${path}`;

  const MenuItem = ({ to, icon: Icon, label, color = "text-slate-400" }: any) => (
    <Link
      to={`/${to}`}
      onClick={onClose}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${
        isActive(to) 
          ? 'bg-[#0a0a2e] text-white shadow-lg shadow-blue-900/20' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
      }`}
    >
      <Icon size={18} className={isActive(to) ? 'text-blue-400' : color} />
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      {isActive(to) && <ChevronRight size={14} className="ml-auto text-blue-400" />}
    </Link>
  );

  return (
    <aside className="w-72 bg-[#050517] h-screen flex flex-col border-r border-white/5 z-50">
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-600/20">
            <Shield className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter italic">GSA Diagnóstico</h1>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-slate-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 space-y-8 custom-scrollbar">
        {/* CATEGORIA: COMERCIAL */}
        {(role !== 'CLIENTE') && (
          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Comercial</p>
            {/* Varejo - Individual */}
            {(role.startsWith('ADM') || currentProfile?.permissoes_venda === 'VAREJO' || currentProfile?.permissoes_venda === 'AMBOS' || !currentProfile?.permissoes_venda) && (
              <MenuItem to="vendas-internas" icon={PlusCircle} label="Nova Venda" />
            )}
            {/* Atacado - Em Massa */}
            {(role.startsWith('ADM') || currentProfile?.permissoes_venda === 'ATACADO' || currentProfile?.permissoes_venda === 'AMBOS') && (
              <MenuItem to="venda-massa" icon={Package} label="Venda em Massa" color="text-indigo-400" />
            )}
            <MenuItem to="leads" icon={TrendingUp} label="Leads e Indicações" />
            <MenuItem to="vitrine" icon={ShoppingBag} label="Vitrine GSA" />
            <MenuItem to="clube" icon={Gift} label={role.startsWith('ADM') ? "Clube de Pontos" : "Clube de Vantagens"} />
          </div>
        )}

        {/* CATEGORIA: OPERAÇÕES */}
        {(role.startsWith('ADM')) && (
          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Operações</p>
            <MenuItem to="operacional" icon={Activity} label="Fila de Produção" />
            <MenuItem to="pendencias" icon={AlertTriangle} label="Pendências" color="text-amber-500" />
            <MenuItem to="auditoria" icon={Shield} label="Auditoria SLA" />
          </div>
        )}

        {/* CATEGORIA: ENGENHARIA */}
        {(role.startsWith('ADM')) && (
          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Engenharia</p>
            <MenuItem to="saas-settings" icon={Settings} label="Configurações SaaS" color="text-blue-500" />
            <MenuItem to="diagnostico" icon={LayoutDashboard} label="Landing Page SaaS" color="text-green-500" />
            <MenuItem to="fabrica" icon={Factory} label="Fábrica de Serviços" />
            <MenuItem to="processos" icon={ClipboardList} label="Modelos de Processos" />
            <MenuItem to="equipe" icon={Users} label="Gestão de Equipe" />
            <MenuItem to="inteligencia" icon={LayoutDashboard} label="Inteligência" />
            <MenuItem to="conversao" icon={TrendingUp} label="Conversão" />
          </div>
        )}

        {/* CATEGORIA: GESTÃO (Para Gestores e Vendedores) */}
        {(role === 'GESTOR' || role === 'VENDEDOR') && (
          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Minha Gestão</p>
            <MenuItem to="equipe" icon={Users} label={role === 'VENDEDOR' ? 'Meus Clientes' : 'Minha Equipe'} />
          </div>
        )}

        {/* CATEGORIA: FINANCEIRO */}
        {(role.startsWith('ADM') || role === 'GESTOR' || role === 'VENDEDOR') && (
          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Financeiro</p>
            <MenuItem to="financeiro" icon={DollarSign} label="Conciliação" color="text-emerald-500" />
            {(role.startsWith('ADM') || role === 'GESTOR') && (
              <MenuItem to="custas" icon={DollarSign} label="Tabela de Custas" color="text-amber-500" />
            )}
          </div>
        )}

        {/* CATEGORIA: ÁREA DO CLIENTE */}
        {role === 'CLIENTE' && (
          <div className="space-y-2">
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Minha Conta</p>
            <MenuItem to="clube_pontos" icon={Trophy} label="Clube de Pontos" />
            <MenuItem to="clube-cliente" icon={Gift} label="Indique e Ganhe" />
            <MenuItem to="vitrine-cliente" icon={ShoppingBag} label="Vitrine de Serviços" />
            <MenuItem to="processos-cliente" icon={ClipboardList} label="Meus Processos" />
            <MenuItem to="carteira" icon={DollarSign} label="Minha Carteira" color="text-emerald-500" />
          </div>
        )}

        {/* CATEGORIA: SISTEMA */}
        <div className="space-y-2">
          <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sistema</p>
          <MenuItem to="consulta-interna" icon={Search} label="Consulta Pública" />
          <MenuItem to="suporte" icon={Bell} label="Suporte" />
          <MenuItem to="perfil" icon={User} label="Meu Perfil" />
        </div>
      </nav>

      <div className="p-6 border-t border-white/5 bg-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-full bg-blue-600 flex items-center justify-center font-black text-white">
            {currentProfile?.nome?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">{currentProfile?.nome}</p>
            <p className="text-[10px] font-black text-blue-400 uppercase">{role.replace('_', ' ')}</p>
          </div>
        </div>
        <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
          <LogOut size={14} /> Sair do Sistema
        </button>
      </div>
    </aside>
  );
}