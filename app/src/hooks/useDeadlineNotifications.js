import { useEffect } from 'react'
import { daysUntil } from '../utils/deadline'

const STORAGE_KEY = 'rtn_notified'

function getTodayNotified() {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return data?.date === today ? (data.ids ?? []) : []
  } catch { return [] }
}

function saveNotified(ids) {
  const today = new Date().toISOString().slice(0, 10)
  const existing = getTodayNotified()
  const merged = [...new Set([...existing, ...ids])]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, ids: merged }))
  } catch {}
}

export function useDeadlineNotifications(items) {
  useEffect(() => {
    if (!('Notification' in window) || !items?.length) return

    const dueTomorrow = items.filter(item => {
      const date = item.dueDate || item.targetDate
      return daysUntil(date) === 1
    })
    if (!dueTomorrow.length) return

    const alreadyNotified = getTodayNotified()
    const toNotify = dueTomorrow.filter(item => !alreadyNotified.includes(item.id))
    if (!toNotify.length) return

    const fire = async () => {
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (permission !== 'granted') return

      // Navegadores mobile (Chrome/Android incluso) não suportam o construtor
      // `new Notification(...)` — só o desktop aceita. Em qualquer lugar com
      // service worker (PWA instalado ou não) é preciso passar pelo registro
      // do worker (`showNotification`), senão a notificação simplesmente
      // nunca aparece no celular, sem nem lançar erro visível pro usuário.
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null

      for (const item of toNotify) {
        const options = {
          body: `"${item.title}" vence amanhã.`,
          icon: '/rotina-alto-desempenho/icons/icon-192.png',
          tag: `deadline-${item.id}`,
        }
        if (registration) {
          registration.showNotification('Prazo amanhã — Rotina', options)
        } else {
          new Notification('Prazo amanhã — Rotina', options)
        }
      }
      saveNotified(toNotify.map(i => i.id))
    }

    fire()
  }, [items])
}
