import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Shield, Users, PlusCircle, LayoutDashboard, History, Settings, 
  Package, DollarSign, TrendingUp, Bell, ClipboardList, Gift, 
  ShoppingBag, LogOut, ChevronRight, Activity, AlertTriangle, X,
  Factory, Trophy, Search, User, Mail, UserPlus, Layers
} from 'lucide-react';


export function Sidebar({ currentProfile, logout, onClose }: any) {
  const location = useLocation();
  const role = currentProfile?.nivel || 'CLIENTE';

  const isActive = (path: string) => location.pathname === `/${path}`;

  const MenuItem = ({ to, icon: Icon, label, color = "text-slate-400", blank = false }: any) => (
    <Link
      to={`/${to}`}
      onClick={onClose}
      target={blank ? "_blank" : undefined}
      rel={blank ? "noopener noreferrer" : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
        isActive(to) 
          ? 'bg-blue-600/10 text-blue-400' 
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
      }`}
    >
      <Icon size={18} className={isActive(to) ? 'text-blue-400' : color} />
      <span className="text-sm font-medium">{label}</span>
      {isActive(to) && <ChevronRight size={16} className="ml-auto text-blue-400" />}
    </Link>
  );

  return (
    <aside className="w-full bg-[#050517] h-screen flex flex-col border-r border-white/5 z-50">
      <div className="p-6 md:p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
            <Shield className="text-white" size={20} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">GSA Diagnóstico</h1>
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
          <div className="space-y-1 mt-4">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Comercial</p>
            {/* Varejo - Individual */}
            {(role.startsWith('ADM') || currentProfile?.permissoes_venda === 'VAREJO' || currentProfile?.permissoes_venda === 'AMBOS' || !currentProfile?.permissoes_venda) && (
              <MenuItem to="vendas-internas" icon={PlusCircle} label="Nova Venda" />
            )}
            {role.startsWith('ADM') && (
              <MenuItem to="nova-venda-admin" icon={UserPlus} label="Venda Administrativa" color="text-indigo-400" />
            )}
            {/* Atacado - Em Massa */}
            {(role.startsWith('ADM') || currentProfile?.permissoes_venda === 'ATACADO' || currentProfile?.permissoes_venda === 'AMBOS') && (
              <MenuItem to="venda-massa" icon={Package} label="Venda em Massa" color="text-indigo-400" />
            )}
            <MenuItem to="leads" icon={TrendingUp} label="Leads e Indicações" />
            <MenuItem to="vitrine" icon={ShoppingBag} label="Vitrine GSA" />
            {role !== 'ADM_ANALISTA' && <MenuItem to="clube" icon={Gift} label={role.startsWith('ADM') ? "Clube de Pontos" : "Clube de Vantagens"} />}
          </div>
        )}

        {/* CATEGORIA: OPERAÇÕES */}
        {(role.startsWith('ADM') || role === 'GESTOR' || role === 'VENDEDOR') && (
          <div className="space-y-1 mt-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Operações</p>
            <MenuItem 
              to="operacional" 
              icon={ClipboardList} 
              label={(role === 'GESTOR' || role === 'VENDEDOR') ? "Meus Processos" : "Fila de Produção"} 
            />
            {role.startsWith('ADM') && (
              <>
                <MenuItem to="pendencias" icon={AlertTriangle} label="Pendências" color="text-amber-500" />
                <MenuItem to="auditoria" icon={Shield} label="Auditoria SLA" />
                <MenuItem to="gestao-lotes" icon={Layers} label="Gestão de Lotes" color="text-sky-500" />
              </>
            )}
          </div>
        )}

        {/* CATEGORIA: CONSULTAS */}
        {(role !== 'CLIENTE') && (
          <div className="space-y-1 mt-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Consultas</p>
            <MenuItem to="consultas-cpf-cnpj" icon={Search} label="Consultas CPF/CNPJ" color="text-emerald-400" />
            {(role.startsWith('ADM')) && (
              <>
                <MenuItem to="admin-consultas" icon={Settings} label="Gestão e API" color="text-orange-400" />
                <MenuItem to="historico-consultas" icon={Search} label="Histórico de Pedidos" color="text-blue-400" />
              </>
            )}
          </div>
        )}

        {/* CATEGORIA: ENGENHARIA */}
        {(role.startsWith('ADM')) && (
          <div className="space-y-1 mt-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Engenharia</p>
            {role !== 'ADM_ANALISTA' && <MenuItem to="saas-settings" icon={Settings} label="Configurações SaaS" color="text-blue-500" />}
            {role !== 'ADM_ANALISTA' && <MenuItem to="admin_clube_settings" icon={Gift} label="Configurações do Clube" color="text-purple-500" />}
            {role !== 'ADM_ANALISTA' && <MenuItem to="config_consulta" icon={LayoutDashboard} label="Configurações de Consulta" color="text-orange-500" />}
            <MenuItem to="diagnostico" icon={LayoutDashboard} label="Landing Page SaaS" color="text-green-500" />
            {role !== 'ADM_ANALISTA' && <MenuItem to="fabrica" icon={Factory} label="Fábrica de Serviços" />}
            <MenuItem to="equipe" icon={Users} label="Gestão de Equipe" />
            <MenuItem to="inteligencia" icon={LayoutDashboard} label="Inteligência" />
            <MenuItem to="conversao" icon={TrendingUp} label="Conversão" />
            <MenuItem to="gerenciador-notificacoes" icon={Mail} label="Monitoramento GSA" color="text-green-500" />
            {role !== 'ADM_ANALISTA' && <MenuItem to="configuracoes-notificacoes" icon={Mail} label="E-MAIS E PERMISSÕES" color="text-yellow-500" />}
          </div>
        )}

        {/* CATEGORIA: GESTÃO (Para Gestores e Vendedores) */}
        {(role === 'GESTOR' || role === 'VENDEDOR') && (
          <div className="space-y-1 mt-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Minha Gestão</p>
            <MenuItem to="equipe" icon={Users} label={role === 'VENDEDOR' ? 'Meus Clientes' : 'Minha Equipe'} />
          </div>
        )}

        {/* CATEGORIA: FINANCEIRO */}
        {(role.startsWith('ADM') || role === 'GESTOR' || role === 'VENDEDOR') && (
          <div className="space-y-1 mt-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Financeiro</p>
            <MenuItem to="financeiro" icon={DollarSign} label="Conciliação" color="text-emerald-500" />
            {(role === 'ADM_MASTER' || role === 'ADM_GERENTE' || role === 'GESTOR') && (
              <MenuItem to="custas" icon={DollarSign} label="Tabela de Custas" color="text-amber-500" />
            )}
          </div>
        )}

        {/* CATEGORIA: ÁREA DO CLIENTE */}
        {role === 'CLIENTE' && (
          <div className="space-y-1 mt-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Minha Conta</p>
            <MenuItem to="consultas-cpf-cnpj" icon={Search} label="Consultas CPF/CNPJ" color="text-emerald-400" />
            <MenuItem to="clube_pontos" icon={Trophy} label="Clube de Pontos" />
            <MenuItem to="clube-cliente" icon={Gift} label="Indique e Ganhe" />
            <MenuItem to="vitrine-cliente" icon={ShoppingBag} label="Vitrine de Serviços" />
            <MenuItem to="processos-cliente" icon={ClipboardList} label="Meus Processos" />
            <MenuItem to="carteira" icon={DollarSign} label="Minha Carteira" color="text-emerald-500" />
          </div>
        )}

        {/* CATEGORIA: SISTEMA */}
        <div className="space-y-1 mt-6 mb-6">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Sistema</p>
          {role !== 'ADM_ANALISTA' && <MenuItem to="consulta-interna" icon={Search} label="Consulta Pública" />}
          <MenuItem to="suporte" icon={Bell} label="Suporte" />
          <MenuItem to="perfil" icon={User} label="Meu Perfil" />
        </div>
      </nav>

      <div className="p-6 border-t border-white/5 bg-white/5">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
            {currentProfile?.nome?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{currentProfile?.nome}</p>
            <p className="text-[11px] font-semibold text-blue-400 mt-0.5">{role.replace('_', ' ')}</p>
          </div>
        </div>
        <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-500 hover:text-white transition-all">
          <LogOut size={16} /> Sair do Sistema
        </button>
      </div>
    </aside>
  );
}