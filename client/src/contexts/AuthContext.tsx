import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authService } from '../services/api'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (emailOrPhone: string, password: string) => Promise<void>
  loginAsGuest: (firstName: string, phone?: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  loading: boolean
}

interface RegisterData {
  password: string
  firstName: string
  lastName: string
  phone: string
  role: 'vessel_owner' | 'club_owner' | 'agent' | 'captain' | 'mechanic'
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const userData = await authService.getProfile()
          console.log('Profile loaded:', userData)
          console.log('User role from API:', userData.role)
          setUser(userData)
        } catch (error: any) {
          console.error('Error loading profile:', error)
          // Если токен невалидный или истек, очищаем его
          if (error?.error === 'Недействительный токен' || 
              error?.error === 'Требуется аутентификация' ||
              error?.response?.status === 401) {
            console.log('Token invalid, clearing...')
            localStorage.removeItem('token')
            setToken(null)
            setUser(null)
          }
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [token])

  const login = async (emailOrPhone: string, password: string) => {
    const data = await authService.login(emailOrPhone, password)
    console.log('Login response:', data)
    console.log('User role from login:', data.user?.role)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
  }

  const loginAsGuest = async (firstName: string, phone?: string) => {
    const data = await authService.loginAsGuest(firstName, phone)
    console.log('Guest login response:', data)
    console.log('User role from guest login:', data.user?.role)
    setToken(data.token)
    setUser(data.user)
    localStorage.setItem('token', data.token)
  }

  const register = async (data: RegisterData) => {
    const responseData = await authService.register(data)
    setToken(responseData.token)
    setUser(responseData.user)
    localStorage.setItem('token', responseData.token)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, loginAsGuest, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

