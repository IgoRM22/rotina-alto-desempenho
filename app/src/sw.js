import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { clientsClaim } from 'workbox-core'

self.skipWaiting()
// Sem isso, um service worker novo instala e ativa (skipWaiting cuida disso)
// mas as abas/PWA já abertas continuam sendo servidas pelo antigo até uma
// navegação nova de verdade — que num PWA instalado (que fica "resumido" em
// vez de fechado) quase nunca acontece sozinho. clientsClaim() faz o SW novo
// assumir o controle na hora, pra registerSW() (main.jsx) conseguir recarregar
// com o conteúdo atualizado de fato, em vez de reservar isso pra depois.
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Comandos do assistente nunca são cacheados.
registerRoute(
  ({ url }) => url.origin === 'https://southamerica-east1-vidapessoal-ebf84.cloudfunctions.net',
  new NetworkOnly(),
)

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({ cacheName: 'google-fonts', plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })] }),
)

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({ cacheName: 'google-fonts-files', plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })] }),
)

registerRoute(new NavigationRoute(createHandlerBoundToURL('/rotina-alto-desempenho/index.html')))

// ── Push notifications (avisos proativos do assistente) ──────────────────
self.addEventListener('push', (event) => {
  let payload = { title: 'RaioDesk', body: 'Você tem uma atualização.' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch { /* payload não era JSON — usa o texto puro */ }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/rotina-alto-desempenho/icons/icon-192.png',
      badge: '/rotina-alto-desempenho/icons/icon-192.png',
      data: { url: payload.url || '/rotina-alto-desempenho/' },
      tag: 'raio-signal',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/rotina-alto-desempenho/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes('/rotina-alto-desempenho/'))
      if (existing) return existing.focus()
      return self.clients.openWindow(targetUrl)
    }),
  )
})
