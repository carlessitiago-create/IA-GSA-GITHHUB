// Service Worker robusto para a aplicação GSA utilizando o Google Workbox CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

const UI_CACHE_NAME = 'gsa-ui-assets-v5';
const API_CACHE_NAME = 'gsa-api-cache-v5';

// Recursos de fallback / casca estática primária para precaching inicial de UI
const ESSENTIAL_UNDERLAY = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-maskable.svg'
];

if (self.workbox) {
  console.log('🎉 Workbox carregado com sucesso!');

  // Configuração global do Workbox
  workbox.setConfig({
    debug: false
  });

  // Limpeza de cache antigo e reivindicação de clientes de ativação rápida
  workbox.core.clientsClaim();

  // Instalação tradicional para garantir precache manual da casca do aplicativo
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(UI_CACHE_NAME).then((cache) => {
        console.log('[GSA SW] Preparando ambiente offline com assets essenciais...');
        return cache.addAll(ESSENTIAL_UNDERLAY);
      }).then(() => self.skipWaiting())
    );
  });

  // Ativação para limpar caches obsoletos antigos
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        const allowedCaches = [
          UI_CACHE_NAME,
          'gsa-static-assets-v5',
          'gsa-images-v5',
          'gsa-fonts-v5',
          API_CACHE_NAME,
          'gsa-navigation-cache-v5'
        ];
        return Promise.all(
          cacheNames.map((cache) => {
            if (!allowedCaches.includes(cache)) {
              console.log('[GSA SW] Removendo cache legado expirado:', cache);
              return caches.delete(cache);
            }
          })
        );
      }).then(() => self.clients.claim())
    );
  });

  // 1. REGRA: Ignorar/Seguir direto para conexões do ambiente de desenvolvimento ou SDKs de terceiros
  workbox.routing.registerRoute(
    ({ url }) => {
      const isExternalOrDev = 
        url.hostname.includes('googleapis.com') || 
        url.hostname.includes('firebase') ||
        url.hostname.includes('mercadopago') ||
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
      return isExternalOrDev;
    },
    new workbox.strategies.NetworkOnly()
  );

  // 2. REGRA: Navegação SPA (Recarrega index.html quando offline para evitar telas brancas do roteamento)
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    async ({ event }) => {
      try {
        const networkResponse = await fetch(event.request);
        const cache = await caches.open(UI_CACHE_NAME);
        cache.put('/', networkResponse.clone());
        cache.put('/index.html', networkResponse.clone());
        return networkResponse;
      } catch (e) {
        console.log('[GSA SW] Rede indisponível para navegação. Servindo Shell SPA.');
        const cachedResponse = await caches.match('/index.html') || await caches.match('/');
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response(
          '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>GSA - Sem Conexão</title><style>body { font-family: sans-serif; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; background: #07071e; color: #fff; margin: 0; padding: 20px; text-align: center; } h1 { margin-bottom: 10px; font-size: 24px; color: #ef4444; } p { color: #94a3b8; font-size: 16px; }</style></head><body><h1>Falha de Conexão</h1><p>Você está offline. O aplicativo GSA necessita de internet para esta primeira navegação.</p></body></html>',
          {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          }
        );
      }
    }
  );

  // 3. REGRA: Chunks Estáticos de Script & CSS de Construção (Vite Assets)
  // Estratégia: Stale-While-Revalidate (Carrega rápido do cache, revalida em background)
  workbox.routing.registerRoute(
    ({ request, url }) => {
      return request.destination === 'script' ||
             request.destination === 'style' ||
             url.pathname.includes('/assets/') ||
             url.pathname.endsWith('.js') ||
             url.pathname.endsWith('.css');
    },
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'gsa-static-assets-v5',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Dias
        }),
      ]
    })
  );

  // 4. REGRA: Imagens/Logos da aplicação e mídias
  // Estratégia: Cache-First (Performance máxima para assets gráficos estáticos)
  workbox.routing.registerRoute(
    ({ request, url }) => {
      return request.destination === 'image' ||
             url.pathname.endsWith('.png') ||
             url.pathname.endsWith('.jpg') ||
             url.pathname.endsWith('.jpeg') ||
             url.pathname.endsWith('.svg') ||
             url.pathname.endsWith('.ico');
    },
    new workbox.strategies.CacheFirst({
      cacheName: 'gsa-images-v5',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 45 * 24 * 60 * 60, // 45 Dias
          purgeOnQuotaError: true
        }),
      ]
    })
  );

  // 5. REGRA: Fontes (Inter, Space Grotesk, JetBrains Mono do Google Fonts)
  // Estratégia: Cache-First com expiração longa
  workbox.routing.registerRoute(
    ({ request, url }) => {
      return request.destination === 'font' ||
             url.pathname.includes('fonts.gstatic.com') ||
             url.pathname.endsWith('.woff2');
    },
    new workbox.strategies.CacheFirst({
      cacheName: 'gsa-fonts-v5',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 90 * 24 * 60 * 60 // 90 Dias
        }),
      ]
    })
  );

  // 6. REGRA: Chamadas locais de API da aplicação (/api/*)
  // Estratégia: Network-First estruturado com timeout de 5 segundos
  workbox.routing.registerRoute(
    ({ url }) => url.pathname.startsWith('/api') || url.pathname.includes('/api/'),
    new workbox.strategies.NetworkFirst({
      cacheName: API_CACHE_NAME,
      networkTimeoutSeconds: 5,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200]
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 120,
          maxAgeSeconds: 15 * 24 * 60 * 60 // 15 Dias
        })
      ]
    })
  );

} else {
  console.warn('[GSA SW] Workbox falhou no carregamento. Ativando fallback nativo legado.');

  // Fallback nativo simples em caso de falha de conexão CDN ao carregar o Workbox
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(UI_CACHE_NAME).then((cache) => cache.addAll(ESSENTIAL_UNDERLAY)).then(() => self.skipWaiting())
    );
  });

  self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  });
}

// ============================================
// Eventos de Push Notification (GSA Engine)
// ============================================

self.addEventListener('push', (event) => {
  console.log('[GSA SW] Notificação Push de Servidor recebida');
  
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
    body: data.body || 'Seu processo corporativo recebeu uma nova atualização de triagem.',
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
