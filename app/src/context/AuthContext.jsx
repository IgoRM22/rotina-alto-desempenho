import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { OWNER_UID } from '../config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading
  const [error, setError] = useState(null)

  useEffect(() => {
    // Handle redirect result first
    getRedirectResult(auth).catch(() => {})

    return onAuthStateChanged(auth, (u) => {
      if (!u) {
        setUser(null)
        return
      }
      if (u.uid !== OWNER_UID) {
        signOut(auth)
        setUser(null)
        setError('Acesso negado. Esta página é privada e só pode ser acessada pelo administrador.')
        return
      }
      setError(null)
      setUser(u)
    })
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
