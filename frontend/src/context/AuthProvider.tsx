import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getAccessToken, setAccessToken } from '../api/client'
import type { Account, AuthResponse } from '../api/types'
import { useResource } from '../hooks/useResource'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(getAccessToken)
  const account = useResource<Account>(token ? '/auth/me' : null, token ?? '')
  useEffect(() => {
    const expired = () => setToken(null)
    window.addEventListener('netxinh:unauthorized', expired)
    return () => window.removeEventListener('netxinh:unauthorized', expired)
  }, [])
  function acceptSession(response: AuthResponse) {
    setAccessToken(response.accessToken)
    setToken(response.accessToken)
  }
  async function logout() {
    try {
      if (getAccessToken()) await api.post('/auth/logout')
    } finally {
      setAccessToken(null)
      setToken(null)
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user: account.data,
        loading: account.loading,
        error: account.error,
        authenticated: !!token,
        acceptSession,
        logout,
        retry: account.reload,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
