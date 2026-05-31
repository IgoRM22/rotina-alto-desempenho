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

      for (const item of toNotify) {
        new Notification('Prazo amanhã — Rotina', {
          body: `"${item.title}" vence amanhã.`,
          icon: '/rotina-alto-desempenho/icons/icon-192.png',
          tag: `deadline-${item.id}`,
        })
      }
      saveNotified(toNotify.map(i => i.id))
    }

    fire()
  }, [items])
}
