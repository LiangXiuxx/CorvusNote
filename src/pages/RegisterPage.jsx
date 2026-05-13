import React, { useState } from 'react'
import '../styles/LoginPage.css'
import { useAuth } from '../context/useAuth'

// 后端错误 → 中文
const mapRegisterError = (detail = '') => {
  if (detail.includes('Username already registered')) return '该用户名已被注册，请换一个'
  if (detail.includes('Username already taken'))      return '该用户名已被占用，请换一个'
  if (detail.includes('Network') || detail.includes('fetch')) return '网络错误，请检查网络连接后重试'
  if (detail.includes('422') || detail.includes('Unprocessable')) return '注册信息格式有误，请检查后重试'
  if (detail) return detail
  return '注册失败，请稍后再试'
}

// 用户名规则：2–20位，仅允许中英文、数字、下划线、连字符
const USERNAME_RE = /^[一-龥a-zA-Z0-9_-]{2,20}$/

// 简单密码强度评分
const calcStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: '#f0f0f0' }
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^A-Za-z0-9]/.test(pwd)) score++
  const map = [
    { score: 0, label: '',   color: '#f0f0f0', width: '0%'   },
    { score: 1, label: '弱', color: '#ff4d4f', width: '25%'  },
    { score: 2, label: '中', color: '#faad14', width: '50%'  },
    { score: 3, label: '强', color: '#52c41a', width: '75%'  },
    { score: 4, label: '很强', color: '#1677ff', width: '100%' },
  ]
  return map[score]
}

function RegisterPage({ onRegister, onSwitchToLogin }) {
  const [username, setUsername]             = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError]                   = useState('')
  const [fieldErrors, setFieldErrors]       = useState({})
  const [isLoading, setIsLoading]           = useState(false)
  const { register } = useAuth()

  const strength = calcStrength(password)

  // 字段级校验，返回错误对象
  const validate = () => {
    const errs = {}

    // 用户名
    if (!username.trim()) {
      errs.username = '请输入用户名'
    } else if (!USERNAME_RE.test(username.trim())) {
      if (username.trim().length < 2) {
        errs.username = '用户名至少 2 个字符'
      } else if (username.trim().length > 20) {
        errs.username = '用户名最多 20 个字符'
      } else {
        errs.username = '用户名只能包含中英文、数字、下划线和连字符'
      }
    }

    // 密码
    if (!password) {
      errs.password = '请输入密码'
    } else if (password.length < 6) {
      errs.password = '密码至少 6 位'
    } else if (password.length > 72) {
      errs.password = '密码最多 72 个字符'
    }

    // 确认密码
    if (!confirmPassword) {
      errs.confirmPassword = '请再次输入密码'
    } else if (password && confirmPassword !== password) {
      errs.confirmPassword = '两次密码不一致，请重新输入'
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
      await register({
        username: username.trim(),
        password,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username.trim())}&background=random&color=fff`,
      })
      onRegister()
    } catch (err) {
      setError(mapRegisterError(err.message))
    } finally {
      setIsLoading(false)
    }
  }

  const clearFieldError = (field) => {
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }))
    }
    setError('')
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Corvus Note</h2>
        <h3>注册新账户</h3>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* 用户名 */}
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); clearFieldError('username') }}
              placeholder="2–20 位，可含中英文、数字、下划线"
              className={fieldErrors.username ? 'input-error' : username.trim().length >= 2 ? 'input-ok' : ''}
              autoComplete="username"
            />
            {fieldErrors.username
              ? <div className="field-error">⚠ {fieldErrors.username}</div>
              : <div className="field-hint">2–20 个字符，支持中英文、数字、下划线、连字符</div>
            }
          </div>

          {/* 密码 */}
          <div className="form-group">
            <label htmlFor="password">密码</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearFieldError('password') }}
              placeholder="至少 6 位"
              className={fieldErrors.password ? 'input-error' : password.length >= 6 ? 'input-ok' : ''}
              autoComplete="new-password"
            />
            {fieldErrors.password
              ? <div className="field-error">⚠ {fieldErrors.password}</div>
              : password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div
                      className="strength-fill"
                      style={{ width: strength.width, backgroundColor: strength.color }}
                    />
                  </div>
                  {strength.label && (
                    <div className="strength-text" style={{ color: strength.color }}>
                      密码强度：{strength.label}
                    </div>
                  )}
                </div>
              )
            }
          </div>

          {/* 确认密码 */}
          <div className="form-group">
            <label htmlFor="confirmPassword">确认密码</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword') }}
              placeholder="再次输入密码"
              className={
                fieldErrors.confirmPassword
                  ? 'input-error'
                  : confirmPassword && confirmPassword === password
                  ? 'input-ok'
                  : ''
              }
              autoComplete="new-password"
            />
            {fieldErrors.confirmPassword && (
              <div className="field-error">⚠ {fieldErrors.confirmPassword}</div>
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-btn" disabled={isLoading}>
              {isLoading ? '注册中…' : '注册'}
            </button>
            <button type="button" className="secondary-btn" onClick={onSwitchToLogin}>
              已有账户？返回登录
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterPage
