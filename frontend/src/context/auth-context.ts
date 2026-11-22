import { createContext, useContext } from 'react'
import type { Account, AuthResponse } from '../api/types'

type AuthContextValue = {
  user: Account | null
  loading: boolean
  error: string | null
  authenticated: boolean
  acceptSession: (response: AuthResponse) => void
  logout: () => Promise<void>
  retry: () => void
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider is missing')
  return context
}
