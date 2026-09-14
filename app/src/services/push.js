import { VAPID_PUBLIC_KEY } from '../config'
import { savePushSubscription, removePushSubscription } from './firestore'

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export const isPushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

// No iPhone o Safari só expõe a Push API quando o site já foi adicionado à
// Tela de Início (modo standalone) — fora disso `PushManager` nem existe, e
// isso é fácil de confundir com "navegador não suporta" quando na verdade só
// falta instalar. Detecta esse caso pra dar a dica certa em vez da genérica.
export const isIosNotInstalled = () => {
  if (typeof navigator === 'undefined') return false
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true
  return isIos && !isStandalone
}

export const getPushPermission = () => (isPushSupported() ? Notification.permission : 'unsupported')

// Pede permissão (precisa ser chamado a partir de um clique do usuário —
// navegadores bloqueiam pedir permissão sem gesto do usuário) e registra a
// inscrição no Firestore, associada ao usuário logado.
export const enablePushNotifications = async () => {
  if (!isPushSupported()) throw new Error('not-supported')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('permission-denied')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  await savePushSubscription(subscription)
  return subscription
}

export const disablePushNotifications = async () => {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await removePushSubscription(subscription.endpoint)
  await subscription.unsubscribe()
}

export const isPushEnabled = async () => {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  return !!subscription
}
