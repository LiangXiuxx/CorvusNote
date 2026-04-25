import React, { useState } from 'react'
import '../styles/LoginPage.css'
import { useAuth } from '../context/useAuth'

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await login(username, password)
      onLogin(null, 'login')
    } catch (err) {
      setError('用户名或密码错误')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGuestLogin = () => {
    onLogin(null, 'guest')
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Corvus Note</h2>
        <h3>登录</h3>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          
          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </button>
            <button type="button" className="secondary-btn" onClick={() => onLogin(null, 'register')}>
              注册新账户
            </button>
            <button type="button" className="guest-btn" onClick={handleGuestLogin}>
              游客登录
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage