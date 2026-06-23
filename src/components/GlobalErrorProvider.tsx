import React, { useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useLocation } from 'react-router-dom';
import { logErrorToFirestore } from '../utils/errorLogger';
import ErrorBoundary from './ErrorBoundary';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import * as Sentry from '@sentry/react';

export const GlobalErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isSimulating } = useAuth();
  const location = useLocation();

  const [errorNotification, setErrorNotification] = React.useState<string | null>(null);

  // Manter dados de rastreamento do usuário atualizados no nível global/window para os interceptadores assíncronos
  useEffect(() => {
    const currentUserId = user?.uid || null;
    const currentRoute = location.pathname;
    
    (window as any).__gsa_current_user_id__ = currentUserId;
    (window as any).__gsa_current_route__ = currentRoute;
    (window as any).__gsa_current_user_profile__ = profile || null;
    (window as any).__gsa_is_simulating__ = !!isSimulating;

    // Sentry: Envia metadados específicos sobre o estado da sessão do usuário
    if (currentUserId) {
      Sentry.setUser({
        id: currentUserId,
        email: user?.email || profile?.email || undefined,
        username: profile?.nome_completo || undefined,
      });

      Sentry.setContext("session_state", {
        nivel: profile?.nivel || "CLIENTE",
        status_conta: profile?.status_conta || "PENDENTE",
        isSimulating: !!isSimulating,
        hasCompany: !!profile?.tem_empresa,
        companyName: profile?.nome_empresa || null,
        saldo_carteira: profile?.saldo_carteira || 0,
        online_status: navigator.onLine ? "online" : "offline",
        current_route: currentRoute,
        last_active: new Date().toISOString()
      });

      Sentry.setTags({
        user_role: profile?.nivel || "unknown",
        account_status: profile?.status_conta || "unknown",
        is_simulating: String(!!isSimulating),
        route: currentRoute
      });
    } else {
      Sentry.setUser(null);
      Sentry.setContext("session_state", {
        isSimulating: false,
        online_status: navigator.onLine ? "online" : "offline",
        current_route: currentRoute,
        last_active: new Date().toISOString()
      });
      Sentry.setTags({
        user_role: "anonymous",
        route: currentRoute
      });
    }
  }, [user, profile, isSimulating, location]);

  useEffect(() => {
    // 1. Instalar interceptadores de API globalmente (uma única vez)
    if (!(window as any).__gsa_error_interceptors_installed__) {
      (window as any).__gsa_error_interceptors_installed__ = true;

      // --- PATCH FETCH ---
      try {
        const originalFetch = window.fetch;
        if (originalFetch) {
          // Usar try-catch e checagem de descritor para evitar erros em navegadores restritivos
          let isConfigurable = true;
          try {
            const desc = Object.getOwnPropertyDescriptor(window, 'fetch') || 
                         Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), 'fetch');
            if (desc) {
              // Se tiver getter e sem setter, ou se for explicitamente não configurável, não tentamos redefinir
              if ((desc.get && !desc.set) || desc.configurable === false || desc.writable === false) {
                isConfigurable = false;
              }
            }
          } catch (e) {
            console.warn("[GlobalErrorProvider] Não foi possível verificar descritor do fetch:", e);
          }

          if (!isConfigurable) {
            console.warn("[GlobalErrorProvider] window.fetch não é configurável ou possui apenas getter. Pulando interceptação para evitar crashes.");
          } else {
            Object.defineProperty(window, 'fetch', {
              value: async function(...args: any[]) {
                const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url || '';
                const options = args[1];
                const method = options?.method || (typeof args[0] === 'object' && 'method' in args[0] ? (args[0] as any).method : 'GET');
                
                // Evita loops gerados por requisições do próprio Firestore / Firebase Auth
                const isFirestoreOrAuth = url.includes('firestore') || 
                                          url.includes('googleapis') || 
                                          url.includes('securetoken') ||
                                          url.includes('firebase');
                                          
                if (isFirestoreOrAuth) {
                  return originalFetch.apply(this, args as any);
                }
                
                try {
                  const response = await originalFetch.apply(this, args as any);
                  if (!response.ok) {
                    logErrorToFirestore({
                      type: 'api_http_error',
                      message: `Falha na requisição API (${response.status}): ${response.statusText}`,
                      url: url,
                      method: method,
                      status: response.status
                    }, { 
                      uid: (window as any).__gsa_current_user_id__ || undefined, 
                      route: (window as any).__gsa_current_route__ || undefined 
                    });
                  }
                  return response;
                } catch (error: any) {
                  logErrorToFirestore({
                    type: 'api_network_error',
                    message: `Erro de rede API: ${error?.message || String(error)}`,
                    url: url,
                    method: method,
                    stack: error?.stack || null
                  }, { 
                    uid: (window as any).__gsa_current_user_id__ || undefined, 
                    route: (window as any).__gsa_current_route__ || undefined 
                  });
                  throw error;
                }
              },
              writable: true,
              configurable: true,
              enumerable: true
            });
          }
        }
      } catch (e) {
        console.warn("[GlobalErrorProvider] Não foi possível interceptar o fetch global devido a restrições do navegador:", e);
      }

      // --- PATCH XMLHTTPREQUEST ---
      try {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
          (this as any)._url = typeof url === 'string' ? url : (url as URL).toString();
          (this as any)._method = method;
          return originalOpen.apply(this, [method, url, ...rest] as any);
        };

        XMLHttpRequest.prototype.send = function(...args: any[]) {
          const xhr = this;
          const url = (xhr as any)._url || '';
          const method = (xhr as any)._method || 'GET';
          
          const isFirestoreOrAuth = url.includes('firestore') || 
                                    url.includes('googleapis') || 
                                    url.includes('securetoken') ||
                                    url.includes('firebase');

          if (!isFirestoreOrAuth) {
            xhr.addEventListener('load', function() {
              if (xhr.status >= 400) {
                logErrorToFirestore({
                  type: 'xhr_http_error',
                  message: `Falha na requisição XHR (${xhr.status})`,
                  url: url,
                  method: method,
                  status: xhr.status
                }, { 
                  uid: (window as any).__gsa_current_user_id__ || undefined, 
                  route: (window as any).__gsa_current_route__ || undefined 
                });
              }
            });
            
            xhr.addEventListener('error', function() {
              logErrorToFirestore({
                type: 'xhr_network_error',
                message: 'Falha ou bloqueio de rede no XHR (possível CORS ou sem conexão)',
                url: url,
                method: method
              }, { 
                uid: (window as any).__gsa_current_user_id__ || undefined, 
                route: (window as any).__gsa_current_route__ || undefined 
              });
            });
            
            xhr.addEventListener('timeout', function() {
              logErrorToFirestore({
                type: 'xhr_timeout_error',
                message: 'Tempo esgotado na requisição XHR',
                url: url,
                method: method
              }, { 
                uid: (window as any).__gsa_current_user_id__ || undefined, 
                route: (window as any).__gsa_current_route__ || undefined 
              });
            });
          }
          
          return originalSend.apply(this, args);
        };
      } catch (e) {
        console.warn("[GlobalErrorProvider] Não foi possível interceptar o XMLHttpRequest global devido a restrições do navegador:", e);
      }
    }

    // 2. Erros de JavaScript tradicional de execução
    const handleError = (event: ErrorEvent) => {
      const isNetworkError = event.message.includes('Failed to fetch') || event.message.includes('navigator.onLine');
      if (isNetworkError) {
        setErrorNotification('Parece que você está offline. Verifique sua conexão.');
      }
      logErrorToFirestore({
        type: 'window_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || null
      }, { uid: user?.uid, route: location.pathname });
    };

    // 3. Promessas rejeitadas não tratadas
    const handleRejection = (event: PromiseRejectionEvent) => {
      let message = event.reason?.message || String(event.reason);
      
      const isNetworkError = message.includes('Failed to fetch') || message.includes('offline');
      if (isNetworkError || (typeof event.reason === 'string' && event.reason.includes('Failed to fetch'))) {
        setErrorNotification('Parece que você está offline. Verifique sua conexão.');
        message = 'Rede: Não foi possível conectar ao servidor.';
      }

      logErrorToFirestore({
        type: 'unhandled_rejection',
        message: message,
        stack: event.reason?.stack || null
      }, { uid: user?.uid, route: location.pathname });
    };

    // 4. Capturar falhas de carregamento de recursos externos na fase de captura (capturing phase)
    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (
        target && 
        target !== window && 
        (target instanceof HTMLElement || (target as any).tagName !== undefined)
      ) {
        const element = target as any;
        const tagName = (element.tagName || "").toLowerCase();
        const url = element.src || element.href || '';
        
        if (!url) return;
        
        // Evita capturar requisições de serviço do próprio firebase/firestore
        if (url.includes('firestore') || url.includes('googleapis') || url.includes('securetoken') || url.includes('firebase')) {
          return;
        }

        logErrorToFirestore({
          type: 'resource_loading_error',
          message: `Falha ao carregar recurso externo: <${tagName}>`,
          tagName: tagName,
          url: url
        }, { 
          uid: (window as any).__gsa_current_user_id__ || undefined, 
          route: (window as any).__gsa_current_route__ || undefined 
        });
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleResourceError, true); // Terceiro argumento 'true' ativa interceptação na fase de captura
    window.addEventListener('online', syncLogs);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleResourceError, true);
      window.removeEventListener('online', syncLogs);
    };
  }, [user, location]);

  // Sincronizar logs locais pendentes quando de volta online
  const syncLogs = async () => {
    const pendingLogs = localStorage.getItem('pending_error_logs');
    if (pendingLogs) {
      const logs = JSON.parse(pendingLogs);
      console.log(`Syncing ${logs.length} pending error logs to Firestore...`);
      for (const log of logs) {
        try {
          await addDoc(collection(db, "logs_erro"), log);
        } catch (err) {
          console.error("Erro ao sincronizar log pendente:", err);
          return;
        }
      }
      localStorage.removeItem('pending_error_logs');
    }
  };

  return (
    <>
      {errorNotification && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white p-4 rounded-lg shadow-lg">
          {errorNotification}
          <button 
            className="ml-4 underline" 
            onClick={() => setErrorNotification(null)}
          >
            Fechar
          </button>
        </div>
      )}
      <ErrorBoundary>{children}</ErrorBoundary>
    </>
  );
};
