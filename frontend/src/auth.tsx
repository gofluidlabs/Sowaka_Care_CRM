import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import type { Role, User } from './types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => void
  setUser: (u: User) => void
}

const AuthContext = createContext<AuthState | null>(null)

export const HOME_BY_ROLE: Record<Role, string> = {
  owner: '/owner',
  doctor: '/doctor',
  front_desk: '/desk',
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    if (!getToken()) {
      setLoading(false)
      return
    }
    api
      .get<User>('/api/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/api/auth/login', { username, password })
    setToken(res.token)
    setUser(res.user)
    return res.user
  }

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
