import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, Clock } from 'lucide-react';
import { listenToNotifications, markAsRead, AppNotification, playNotificationSound } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationBell: React.FC<{ currentProfile: any }> = ({ currentProfile }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [prevCount, setPrevCount] = useState(0);

  useEffect(() => {
    if (currentProfile?.uid) {
      const unsubscribe = listenToNotifications(
        currentProfile.uid, 
        currentProfile.nivel, 
        (newNotifications) => {
          const unread = newNotifications.filter(n => !n.lida).length;
          if (unread > prevCount) {
            playNotificationSound('DEFAULT');
          }
          setPrevCount(unread);
          setNotifications(newNotifications);
        }
      );
      return () => unsubscribe();
    }
  }, [currentProfile, prevCount]);

  const unreadCount = notifications.filter(n => !n.lida).length;

  const handleToggle = () => setIsOpen(!isOpen);

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Agora';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s atrás`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
  };

  return (
    <div className="relative">
      <button 
        onClick={handleToggle}
        className="relative p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-95 group border border-white/5"
      >
        <Bell className={`size-5 transition-colors ${unreadCount > 0 ? 'text-blue-400 animate-pulse' : 'text-slate-400 group-hover:text-white'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-[#0a0a2e] shadow-lg shadow-red-500/20">
            {unreadCount > 9 ? '+9' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay para fechar ao clicar fora */}
            <div 
              className="fixed inset-0 z-[80]" 
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#0a0a2e] border border-white/10 rounded-3xl shadow-2xl z-[90] overflow-hidden"
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                  <Bell className="size-4 text-blue-400" />
                  <h3 className="text-xs font-black uppercase italic tracking-widest text-white">Notificações</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg text-slate-400">
                  <X className="size-4" />
                </button>
              </div>

              <div className="max-h-[450px] overflow-y-auto no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <div className="size-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                      <Bell className="size-8 text-slate-600" />
                    </div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest italic">Nenhuma notificação por enquanto</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={`p-5 hover:bg-white/5 transition-all group cursor-pointer ${!n.lida ? 'bg-blue-600/5' : ''}`}
                        onClick={() => !n.lida && n.id && handleMarkAsRead(n.id)}
                      >
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {!n.lida && <span className="size-1.5 bg-blue-500 rounded-full" />}
                              <h4 className={`text-[11px] font-black uppercase tracking-tighter italic ${!n.lida ? 'text-blue-400' : 'text-slate-200'}`}>
                                {n.titulo}
                              </h4>
                            </div>
                            <p className="text-xs text-slate-400 italic font-medium leading-relaxed">
                              {n.mensagem}
                            </p>
                          </div>
                          <span className="text-[9px] font-black text-slate-600 uppercase flex items-center gap-1 shrink-0">
                            <Clock size={10} /> {getTimeAgo(n.timestamp)}
                          </span>
                        </div>
                        
                        {!n.lida && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              n.id && handleMarkAsRead(n.id);
                            }}
                            className="text-[9px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Check size={10} /> Marcar como lida
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-4 bg-white/5 text-center border-t border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Exibindo as últimas {notifications.length} notificações
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
