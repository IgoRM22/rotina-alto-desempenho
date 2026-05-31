import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import {
  ACCESS_CONTROL_DOC_PATH,
  getAccessControlConfig,
  isEmailAuthorized,
  ensureUserDefaults,
} from '../services/firestore'

const AuthContext = createContext(null)
const ACCESS_DENIED_MESSAGE = 'Infelizmente voce nao pode usar o app. Apenas pessoas autorizadas pelo administrador.'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    // Handle redirect result first
    getRedirectResult(auth).catch(() => {})

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!active) return

      if (!u) {
        setUser(null)
        return
      }

      setUser(undefined)

      ;(async () => {
        try {
          const accessConfig = await getAccessControlConfig()

          if (!active) return

          const canAccess = accessConfig.exists && isEmailAuthorized(u.email, accessConfig)
          if (!canAccess) {
            await signOut(auth).catch(() => {})
            if (!active) return

            setUser(null)
            if (!accessConfig.exists) {
              setError(`Lista de acesso nao configurada em ${ACCESS_CONTROL_DOC_PATH}. Solicite ao administrador.`)
            } else {
              setError(ACCESS_DENIED_MESSAGE)
            }

            if (typeof window !== 'undefined') {
              window.alert(ACCESS_DENIED_MESSAGE)
            }
            return
          }

          await ensureUserDefaults(u.uid).catch(() => {})
          setError(null)
          setUser(u)
        } catch {
          await signOut(auth).catch(() => {})
          if (!active) return

          setUser(null)
          setError('Nao foi possivel validar seu acesso agora. Tente novamente.')
        }
      })()
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const login = async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err?.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('Login cancelado.')
        return
      }
      setError(`Falha no login: ${err?.code || err?.message}`)
    }
  }

  const logout = () => signOut(auth)

  return (
    <AuthContext.Provider value={{ user, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
