import { useContext } from 'react'
import { AuthContext } from './AuthContext'

// 自定义Hook，方便组件使用AuthContext
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth必须在AuthProvider内部使用')
  }
  return context
}