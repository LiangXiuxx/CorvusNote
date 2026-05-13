import React, { useState } from 'react'
import '../styles/LoginPage.css'
import { useAuth } from '../context/useAuth'

// 将后端返回的英文 detail 映射成中文
const mapLoginError = (detail = '') => {
  if (detail.includes('Incorrect username or password')) return '用户名或密码错误，请重新输入'
  if (detail.includes('Could not validate credentials')) return '登录凭证已失效，请重新登录'
  if (detail.includes('401') || detail.includes('Unauthorized')) return '用户名或密码错误'
  if (detail.includes('Network') || detail.includes('fetch')) return '网络错误，请检查网络连接后重试'
  if (detail) return detail
  return '登录失败，请稍后再试'
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()

  const validate = () => {
    const errs = {}
    if (!username.trim()) {
      errs.username = '请输入用户名'
    } else if (username.trim().length < 2) {
      errs.username = '用户名至少 2 个字符'
    }
    if (!password) {
      errs.password = '请输入密码'
    } else if (password.length < 6) {
      errs.password = '密码至少 6 位'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsLoading(true)
    try {
      await login(username.trim(), password)
      onLogin(null, 'login')
    } catch (err) {
      setError(mapLoginError(err.message))
    } finally {
      setIsLoading(false)
    }
  }

  const handleFieldChange = (field, value) => {
    if (field === 'username') setUsername(value)
    if (field === 'password') setPassword(value)
    // 用户开始输入时清除该字段的错误
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }))
    }
    setError('')
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Corvus Note</h2>
        <h3>登录</h3>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => handleFieldChange('username', e.target.value)}
              placeholder="请输入用户名"
              className={fieldErrors.username ? 'input-error' : ''}
              autoComplete="username"
            />
            {fieldErrors.username && (
              <div className="field-error">⚠ {fieldErrors.username}</div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              placeholder="请输入密码"
              className={fieldErrors.password ? 'input-error' : ''}
              autoComplete="current-password"
            />
            {fieldErrors.password && (
              <div className="field-error">⚠ {fieldErrors.password}</div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={isLoading}>
              {isLoading ? '登录中…' : '登录'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onLogin(null, 'register')}
            >
              注册新账户
            </button>
            <div className="divider">或</div>
            <button
              type="button"
              className="guest-btn"
              onClick={() => onLogin(null, 'guest')}
            >
              游客体验（功能受限）
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
