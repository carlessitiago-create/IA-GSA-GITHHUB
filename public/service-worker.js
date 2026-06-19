const CACHE_NAME = 'gsa-diagnostico-cache-v4';
const API_CACHE_NAME = 'gsa-diagnostico-api-cache-v4';

const STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg'
];

// Instalação do Service Worker - Pré-cache de recursos básicos de UI
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pré-carregando assets estáticos essenciais');
      return cache.addAll(STATIC_RESOURCES);
    }).then(() => self.skipWaiting())
  );
});

// Ativação - Limpeza de caches obsoletos de UI e de API
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== API_CACHE_NAME) {
            console.log('[Service Worker] Removendo cache obsoleto:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Timeout Helper para conexões extremamente lentas ou instáveis (evita hangs infinitos)
const networkWithTimeout = (request, timeoutMs = 3000) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Network request timed out'));
    }, timeoutMs);

    fetch(request).then((response) => {
      clearTimeout(timeoutId);
      resolve(response);
    }, (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
};

// Intercepção de requisições - Caching Strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Apenas otimizar requisições GET e HTTP/HTTPS para evitar conflitos de segurança
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Ignorar SDKs e integrações externas críticas de autenticação/pagamento
  if (url.hostname.includes('googleapis.com') || 
      url.hostname.includes('firebase') ||
      url.hostname.includes('mercadopago')) {
    return;
  }

  // Ignorar assets do ambiente de desenvolvimento do Vite (HMR, etc.)
  const isDevEnvironment = 
    url.hostname === 'localhost' || 
    url.hostname.includes('127.0.0.1') ||
    url.hostname.includes('ais-dev') ||
    url.pathname.includes('@vite') || 
    url.pathname.includes('@id') || 
    url.pathname.includes('__vite_ping') || 
    url.pathname.includes('node_modules') || 
    url.pathname.includes('/src/') ||
    url.search.includes('import') || 
    url.pathname.endsWith('.tsx') || 
    url.pathname.endsWith('.ts');

  if (isDevEnvironment) {
    return;
  }

  // 1. Estratégia dos Endpoints de API (/api/*)
  // Estratégia: Network-First com cache-fallback para visualização offline instantânea
  const isApiRoute = url.pathname.startsWith('/api') || url.pathname.includes('/api/');
  if (isApiRoute) {
    event.respondWith(
      networkWithTimeout(request, 5000)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          console.log('[Service Worker] API offline ou lenta. Servindo do cache local:', request.url);
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Retorna um JSON indicando falha offline graciosa
            return new Response(JSON.stringify({ 
              error: 'offline', 
              message: 'Você está offline. Exibindo dados pré-carregados estruturados.',
              retrievedFromCache: false
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // 2. Estratégia de Navegação Geral (SPA - index.html)
  // Network-First com Fallback de Cache para recarga offline da casca da aplicação
  if (request.mode === 'navigate') {
    event.respondWith(
      networkWithTimeout(request, 4000)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/', responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          console.log('[Service Worker] Falha de rede na navegação. Servindo Shell SPA do cache:', request.url);
          return caches.match('/').then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 3. Recursos Estáticos de Carregamento em Lote (Assets, Imagens, Fontes, Chunks JS/CSS)
  // Estratégia: Stale-While-Revalidate (Entrega imediata via Cache + atualização silenciosa em background)
  const isAsset = 
    url.pathname.includes('/assets/') || 
    url.pathname.endsWith('.js') || 
    url.pathname.endsWith('.css') || 
    url.pathname.endsWith('.png') || 
    url.pathname.endsWith('.jpg') || 
    url.pathname.endsWith('.jpeg') || 
    url.pathname.endsWith('.svg') || 
    url.pathname.endsWith('.woff2') || 
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.json'); // manifest, etc.

  if (isAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve do cache imediatamente e atualiza em background
          fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          }).catch(() => {
            // Falha silenciosa de revalidação (offline/sem cobertura)
          });
          return cachedResponse;
        }

        // Se falhar o cache, faz fetch tradicional com timeout curto
        return networkWithTimeout(request, 5000)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch((err) => {
            console.warn('[Service Worker] Falha ao carregar asset essencial:', request.url, err.message);
            if (url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.svg')) {
              return caches.match('/icon.svg');
            }
            throw err;
          });
      })
    );
    return;
  }

  // 4. Estratégia Fallback genérica (Network-First com retorno do Cache)
  event.respondWith(
    networkWithTimeout(request, 4000)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Evento de Push de Notificações
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Evento de Push recebido');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'GSA Diagnóstico';
  const options = {
    body: data.body || 'Seu processo financeiro recebeu uma nova atualização.',
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Clique na Notificação Push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
          });
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
