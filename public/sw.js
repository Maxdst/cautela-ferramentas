// Service Worker — Cautela de Ferramentas | Markat Engenharia
// Desenvolvido por MindMax Tecnologia

const CACHE_NAME = 'markat-cautela-v2'

// Assets que serão cacheados no primeiro acesso
const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js',
]

// Instala e faz cache dos assets essenciais
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cacheia assets locais obrigatórios
      return cache.addAll(['/', '/manifest.json', '/icon-192.png', '/icon-512.png'])
        .then(() => {
          // Tenta cachear CDNs (ignora falhas individuais)
          const cdns = [
            'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js',
          ]
          return Promise.allSettled(cdns.map(url =>
            fetch(url, { mode: 'cors' })
              .then(res => res.ok ? cache.put(url, res) : null)
              .catch(() => null)
          ))
        })
    }).then(() => self.skipWaiting())
  )
})

// Limpa caches antigos ao ativar
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Estratégia de fetch:
// - API (/api/...): network-first, sem cache (dados sempre frescos)
// - Navegação/app shell (/, /index.html): network-first, cache só como fallback offline
// - CDNs e assets estáticos: cache-first (mudam raramente)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Requisições de API: sempre da rede
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sem conexão com o servidor' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    )
    return
  }

  // Navegação (o HTML do app em si): network-first.
  // Sem isso, quem já tem o app aberto/instalado nunca vê um deploy novo —
  // o cache-first antigo travava a versão da primeira visita pra sempre.
  // Cache só entra como fallback se a rede falhar (uso offline no canteiro).
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const toCache = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache))
        }
        return response
      }).catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
    )
    return
  }

  // CDNs e assets estáticos (React, Babel, ícones): cache-first, mudam raramente.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached
      return fetch(event.request).then(response => {
        // Cacheia respostas válidas
        if (response && response.status === 200 && response.type !== 'opaque') {
          const toCache = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache))
        }
        return response
      }).catch(() => {
        // Fallback para o index quando offline
        if (event.request.mode === 'navigate') {
          return caches.match('/')
        }
      })
    })
  )
})
