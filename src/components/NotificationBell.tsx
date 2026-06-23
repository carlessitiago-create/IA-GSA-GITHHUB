import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, Clock, Smartphone, Sparkles, ShieldAlert } from 'lucide-react';
import { listenToNotifications, markAsRead, AppNotification, playNotificationSound } from '../services/notificationService';
import { useAuth } from './AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationBell: React.FC<{ currentProfile: any }> = ({ currentProfile }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [prevCount, setPrevCount] = useState(0);
  const [pushPermission, setPushPermission] = useState<'default' | 'granted' | 'denied'>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const registerPushSubscription = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      
      // Busca a chave pública VAPID dinamicamente do servidor de produção
      const pkRes = await fetch('/api/v1/push/public-key');
      const { publicKey } = await pkRes.json();
      
      if (!publicKey) {
        console.warn('[GSA Push] Chave pública VAPID não disponibilizada pelo servidor.');
        return;
      }
      
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }
      
      // Envia a assinatura Web-Push para vincular ao UID do usuário no Firestore
      await fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub,
          userId: currentProfile?.uid || 'GUEST'
        })
      });
      
      console.log('[GSA Push] Assinatura push registrada com sucesso no backend!');
    } catch (err) {
      console.warn('[GSA Push] Falha ao registrar assinatura push:', err);
    }
  };

  useEffect(() => {
    if (pushPermission === 'granted' && currentProfile?.uid) {
      registerPushSubscription();
    }
  }, [pushPermission, currentProfile?.uid]);

  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }
    const res = await Notification.requestPermission();
    setPushPermission(res);
    if (res === 'granted') {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('GSA Diagnóstico', {
            body: 'Notificações Push ativadas com sucesso para processos financeiros!',
            icon: '/icon.svg',
            badge: '/icon.svg',
            vibrate: [100, 50, 100],
          } as any);
        } catch (e) {
          console.warn('SW notification error:', e);
        }
      }
    }
  };

  const handleSimulateFinancePush = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('GSA Inteligência: Crédito Atualizado', {
        body: 'Seu processo #9823 GSA Diagnóstico foi classificado como APROVADO. Desbloqueio de limite liberado!',
        icon: '/icon.svg',
        badge: '/icon.svg',
        vibrate: [200, 100, 200],
        data: {
          url: '/'
        }
      } as any);
    } catch (e) {
      console.warn('SW simulation error:', e);
    }
  };

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
                  <h3 className="text-sm font-semibold text-white tracking-wide">Notificações</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg text-slate-400">
                  <X className="size-4" />
                </button>
              </div>

              {/* Painel PWA de Notificações Push */}
              <div className="p-4 bg-gradient-to-r from-blue-950/40 via-[#0d1540] to-blue-950/40 border-b border-white/5 flex flex-col gap-3">
                <div className="flex gap-2.5">
                  <div className="size-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 text-[#00FF66]">
                    <Smartphone className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-100 flex items-center gap-1.5 leading-tight">
                      Alertas no Dispositivo
                      <Sparkles className="size-3.5 text-amber-400 fill-amber-400" />
                    </p>
                    <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                      Receba atualizações de processos financeiros mesmo offline.
                    </p>
                  </div>
                </div>

                {pushPermission === 'default' && (
                  <button 
                    onClick={handleRequestPushPermission}
                    className="w-full py-2 px-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:scale-[1.01] transition-all hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-1.5"
                  >
                    Ativar Alertas Push
                  </button>
                )}

                {pushPermission === 'granted' && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 py-1.5 px-3 bg-[#022c22]/50 border border-[#0d9488]/30 rounded-xl flex items-center gap-2">
                      <span className="size-2 bg-[#00FF66] rounded-full animate-ping" />
                      <span className="text-[10px] text-teal-300 font-semibold tracking-wide uppercase">Configuração Ativa</span>
                    </div>
                    <button 
                      onClick={handleSimulateFinancePush}
                      className="py-1.5 px-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-[10px] rounded-xl transition-all"
                    >
                      Testar Envio
                    </button>
                  </div>
                )}

                {pushPermission === 'denied' && (
                  <div className="py-1.5 px-3 bg-red-950/30 border border-red-500/20 rounded-xl flex items-center gap-2">
                    <ShieldAlert className="size-3.5 text-red-400 shrink-0" />
                    <span className="text-[10px] text-red-300 leading-normal">
                      Notificações bloqueadas no navegador. Ative as permissões nas configurações do site para receber alertas.
                    </span>
                  </div>
                )}
              </div>

              <div className="max-h-[450px] overflow-y-auto no-scrollbar">
                {notifications.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <div className="size-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                      <Bell className="size-8 text-slate-600" />
                    </div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Nenhuma notificação por enquanto</p>
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
                              <h4 className={`text-xs font-semibold ${!n.lida ? 'text-blue-300' : 'text-slate-200'}`}>
                                {n.titulo || (n as any).title || 'Aviso do Sistema'}
                              </h4>
                            </div>
                            <p className={`text-[11px] leading-relaxed ${!n.lida ? 'text-blue-100/90' : 'text-slate-400'}`}>
                              {n.mensagem || (n as any).message}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1 shrink-0">
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
