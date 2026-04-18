import React, { useState } from 'react'
import '../styles/LoginPage.css'
import { useAuth } from '../context/useAuth'

function RegisterPage({ onRegister, onSwitchToLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { register } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    // 验证密码是否一致
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      setIsLoading(false)
      return
    }
    
    // 验证密码长度
    if (password.length > 72) {
      setError('密码长度不能超过72个字符')
      setIsLoading(false)
      return
    }
    
    try {
      const userData = {
        username,
        password,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff`
      }
      
      await register(userData)
      onRegister()
    } catch (err) {
      if (err.message.includes('Username already registered')) {
        setError('用户名已存在')
      } else {
        setError('注册失败，请稍后再试')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Corvus Note</h2>
        <h3>注册</h3>
        
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
          
          <div className="form-group">
            <label htmlFor="confirmPassword">确认密码</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              required
            />
          </div>
          
          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={isLoading}>
              {isLoading ? '注册中...' : '注册'}
            </button>
            <button type="button" className="secondary-btn" onClick={onSwitchToLogin}>
              已有账户？登录
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage