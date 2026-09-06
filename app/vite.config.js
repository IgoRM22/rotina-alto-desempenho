import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/rotina-alto-desempenho/',
  server: {
    // Sem isso o Vite só escuta em IPv6 (::1) no Windows — se o navegador
    // resolver "localhost" para 127.0.0.1 (IPv4) primeiro, a conexão falha.
    host: '127.0.0.1',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Raio',
        short_name: 'Raio',
        description: 'Organizador pessoal de alto desempenho',
        theme_color: '#0D0C0B',
        background_color: '#0D0C0B',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/rotina-alto-desempenho/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // Comandos do assistente nunca são cacheados — diferente dos assets
            // estáticos (cache-first/stale-while-revalidate) logo abaixo.
            urlPattern: /^https:\/\/southamerica-east1-vidapessoal-ebf84\.cloudfunctions\.net\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ]
})
