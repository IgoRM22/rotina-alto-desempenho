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
      // injectManifest (em vez de generateSW): precisamos de um service worker
      // próprio pra lidar com eventos `push`/`notificationclick` — o modo
      // generateSW só sabe gerar cache, não dá pra estender com listeners.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
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
    })
  ]
})
