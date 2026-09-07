import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

// Sem isso, o service worker do build nunca era registrado de verdade — o
// app ficava preso pra sempre na versão instalada na primeira vez, sem
// nenhum jeito de atualizar sozinho (só desinstalando e reinstalando).
// registerType 'autoUpdate' (vite.config.js) + isto: verifica por uma versão
// nova a cada hora e, quando encontra, ativa e recarrega sozinho, sem avisar.
const updateSW = registerSW({
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60 * 60 * 1000)
  },
})
void updateSW

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/rotina-alto-desempenho" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
