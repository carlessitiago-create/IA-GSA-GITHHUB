import React from 'react';
import { formatDate } from '../../lib/dateUtils';
import { 
  Menu, 
  Bell, 
  MessageCircle, 
  AlertTriangle,
  Trophy,
  Search,
  LogOut
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
  selectedClientName
}) => {
  return (
    <header className="h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
      
      {/* LADO ESQUERDO: Botão Menu + Título */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuToggle}
          className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-xl lg:hidden transition-colors"
        >
          <Menu size={24} />
        </button>
        
        <h2 className="text-xl font-black text-slate-800 hidden sm:block italic tracking-tight uppercase">
          {selectedClientName ? selectedClientName :
           view === 'clients' ? 'Meus Clientes' : 
           view === 'new_sale' ? 'Nova Venda' : 
           view === 'profile' ? 'Meu Perfil' :
           view === 'audit_center' ? 'Auditoria/Pendências' :
           view === 'users' ? 'Gestão de Usuários' :
           view === 'service_factory' ? 'Fábrica de Serviços' :
           view === 'showcase_leads' ? 'Leads da Vitrine' :
           view === 'my_processes' ? 'Portal do Cliente' :
           view === 'intelligence' ? 'Inteligência' :
           view === 'referrals' ? 'Minhas Indicações' :
           view === 'financeiro' ? 'Financeiro' : 
           view === 'settings' ? 'Configurações Globais' : 'Painel de Controle'}
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-6">
        {(currentProfile?.role === 'CLIENTE' || currentProfile?.role === 'ADM_MASTER') && (
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="text-right pr-2 sm:pr-4 border-r border-slate-200">
              <p className="hidden sm:block text-[10px] font-black text-slate-400 uppercase tracking-widest">Clube GSA</p>
              <div className="flex items-center justify-end gap-1">
                <Trophy size={14} className="text-yellow-500" />
                <p className="text-sm sm:text-lg font-black text-yellow-600">
                  {pointsBalance} <span className="text-[10px] hidden sm:inline">PTS</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase">Saldo em Carteira</p>
              <div className="flex items-center justify-end gap-1 sm:gap-2">
                {walletBalance < 0 && (
                  <div className="flex items-center justify-center size-4 sm:size-5 bg-red-100 dark:bg-red-900/30 rounded-full" title="Você possui pendências financeiras.">
                    <AlertTriangle size={10} className="text-red-600 dark:text-red-400 sm:w-3 sm:h-3" />
                  </div>
                )}
                <p className={`text-sm sm:text-lg md:text-xl font-black ${walletBalance < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
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
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                    <h4 className="font-bold text-sm">Notificações</h4>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => {
                          notifications.forEach(n => n.id && markAsRead(n.id));
                        }}
                        className="text-[10px] text-indigo-600 font-bold uppercase hover:underline"
                      >
                        Marcar todas
                      </button>
                      <button 
                        onClick={() => {
                          setView('notifications_center');
                          setIsNotificationOpen(false);
                        }}
                        className="text-[10px] text-slate-400 font-bold uppercase hover:underline"
                      >
                        Ver todas
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
                          className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-all ${!n.lida ? 'bg-indigo-50/30' : ''}`}
                        >
                          <p className="text-xs font-bold text-slate-800 mb-1">{n.titulo}</p>
                          <p className="text-[10px] text-slate-500 line-clamp-2">{n.mensagem}</p>
                          <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">
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
