// Ad-hoc script (not part of the app) to open a real headed Chromium window,
// let the user log in with their own Google account, then walk every route
// at desktop + mobile viewports and save screenshots for a UX review.
import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'

const BASE = 'http://localhost:5173/rotina-alto-desempenho'
const PROFILE_DIR = path.resolve('.playwright-profile-edge')
const OUT_DIR = process.argv[2] || path.resolve('..', 'screenshots')
fs.mkdirSync(OUT_DIR, { recursive: true })

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/planejar/agenda', name: 'planejar-agenda' },
  { path: '/planejar/tarefas', name: 'planejar-tarefas' },
  { path: '/planejar/metas', name: 'planejar-metas' },
  { path: '/planejar/habitos', name: 'planejar-habitos' },
  { path: '/planejar/foco', name: 'planejar-foco' },
  { path: '/planejar/acompanhamento', name: 'planejar-acompanhamento' },
  { path: '/planejar/alimentacao', name: 'planejar-alimentacao' },
  { path: '/notes', name: 'notes' },
  { path: '/financas', name: 'financas' },
  { path: '/config', name: 'config' },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

async function main() {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: 'msedge',
    viewport: VIEWPORTS[0],
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  })
  // Um profile persistente pode restaurar abas antigas (de tentativas
  // anteriores) apontando pra URL errada — abre uma aba nova e limpa
  // primeiro, só then fecha as antigas (fechar tudo antes de abrir uma
  // nova pode derrubar o processo do navegador de vez).
  const staleTabs = context.pages()
  const page = await context.newPage()
  for (const p of staleTabs) await p.close().catch(() => {})

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  console.log('URL atual:', page.url())

  console.log('Aguardando login (até 5 minutos)... faça login com Google na janela aberta.')
  try {
    await page.waitForSelector('.app-layout', { timeout: 5 * 60 * 1000 })
    console.log('Login detectado, prosseguindo com a captura.')
  } catch {
    console.log('TIMEOUT: login não detectado em 5 minutos. Encerrando sem capturar.')
    await context.close()
    process.exit(1)
  }

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    for (const route of ROUTES) {
      try {
        await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 15000 })
      } catch {
        // networkidle pode não ocorrer em página com listeners em tempo real (Firestore) — segue mesmo assim
      }
      await page.waitForTimeout(700)
      const file = path.join(OUT_DIR, `${route.name}--${vp.name}.png`)
      await page.screenshot({ path: file, fullPage: vp.name === 'desktop' })
      console.log('OK', file)
    }
  }

  await context.close()
  console.log('Concluído.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
