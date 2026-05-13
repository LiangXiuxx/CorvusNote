import React, { useState, useMemo } from 'react'
import '../styles/SettingsPage.css'

// 返回图标（左箭头）
const BackIcon = () => (
  <svg t="1777184566781" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
    <path d="M296.476444 468.622222c10.723556 0.028444 20.963556 4.664889 28.558223 12.885334l431.047111 468.622222a46.734222 46.734222 0 0 1-0.995556 61.013333 38.115556 38.115556 0 0 1-56.120889 1.052445L267.918222 543.601778A45.624889 45.624889 0 0 1 256 512.540444c0-11.662222 4.295111-22.840889 11.946667-31.032888a39.111111 39.111111 0 0 1 28.529777-12.885334zM727.523556 0c10.695111 0.028444 20.963556 4.664889 28.558222 12.885333 7.623111 8.192 11.918222 19.370667 11.918222 31.061334 0 11.662222-4.295111 22.840889-11.946667 31.032889L325.063111 543.601778a38.115556 38.115556 0 0 1-56.120889-1.080889 46.734222 46.734222 0 0 1-0.995555-61.013333L698.965333 12.885333A39.111111 39.111111 0 0 1 727.523556 0z" fill="currentColor" />
  </svg>
)

// 头像色板
const PRESET_COLORS = [
  '#1677ff', '#0050b3', '#52c41a', '#389e0d',
  '#faad14', '#fa8c16', '#f5222d', '#cf1322',
  '#722ed1', '#531dab', '#13c2c2', '#006d75',
  '#eb2f96', '#9e1068', '#262626', '#595959',
]

const getAvatarUrl = (name, colorHex) => {
  const hex = (colorHex || '#333333').replace('#', '')
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=${hex}&color=fff&bold=true`
}

function SettingsPage({ user, onUpdateUser, onBack, onDeleteUser }) {
  const initColor = user.avatar_color || '#1677ff'

  const [avatarColor, setAvatarColor] = useState(initColor)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [nickname, setNickname]     = useState(user.nickname || user.username)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPwd, setConfirmPwd]   = useState('')

  const [avatarLoading, setAvatarLoading]   = useState(false)
  const [nicknameLoading, setNicknameLoading] = useState(false)
  const [pwdLoading, setPwdLoading]         = useState(false)

  const [toast, setToast] = useState(null)
  const [fieldErr, setFieldErr] = useState({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── 保存头像颜色 ──────────────────────────────────────────
  const handleSaveAvatar = async () => {
    setAvatarLoading(true)
    try {
      const newAvatar = getAvatarUrl(user.nickname || user.username, avatarColor)
      await onUpdateUser({ avatar: newAvatar, avatar_color: avatarColor })
      showToast('头像已更新')
    } catch {
      showToast('头像更新失败', 'error')
    } finally {
      setAvatarLoading(false)
    }
  }

  // ── 保存昵称 ──────────────────────────────────────────────
  const handleSaveNickname = async () => {
    const errs = {}
    const trimmed = nickname.trim()
    if (!trimmed) errs.nickname = '昵称不能为空'
    else if (trimmed.length > 20) errs.nickname = '昵称最多 20 个字符'
    if (Object.keys(errs).length) { setFieldErr(prev => ({ ...prev, ...errs })); return }

    setNicknameLoading(true)
    try {
      await onUpdateUser({ nickname: trimmed })
      showToast('昵称已更新')
    } catch {
      showToast('保存失败，请稍后重试', 'error')
    } finally {
      setNicknameLoading(false)
    }
  }

  // ── 修改密码 ───────────────────────────────────────────────
  const handleSavePassword = async () => {
    const errs = {}
    if (!newPassword) errs.password = '请输入新密码'
    else if (newPassword.length < 6) errs.password = '密码至少 6 位'
    else if (newPassword.length > 72) errs.password = '密码最多 72 个字符'
    if (newPassword && confirmPwd !== newPassword) errs.confirm = '两次密码不一致'
    if (Object.keys(errs).length) { setFieldErr(prev => ({ ...prev, ...errs })); return }

    setPwdLoading(true)
    try {
      await onUpdateUser({ password: newPassword })
      setNewPassword('')
      setConfirmPwd('')
      showToast('密码已修改，请重新登录', 'success')
      // 3秒后跳回登录页（后端已使旧 token 失效）
      setTimeout(() => {
        localStorage.clear()
        window.location.reload()
      }, 3000)
    } catch (e) {
      if (e.message === 'PASSWORD_CHANGED') {
        showToast('密码已修改，请重新登录', 'success')
        setTimeout(() => {
          localStorage.clear()
          window.location.reload()
        }, 3000)
      } else {
        showToast('密码修改失败，请稍后重试', 'error')
      }
    } finally {
      setPwdLoading(false)
    }
  }

  const previewAvatar = getAvatarUrl(nickname || user.username, avatarColor)

  return (
    <div className="settings-container">
      {/* Toast */}
      {toast && (
        <div className={`settings-toast settings-toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* 删除确认弹窗 */}
      {showDeleteModal && (
        <div className="settings-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-modal-icon">⚠</div>
            <h3>确认注销账户</h3>
            <p>此操作将永久删除您的账户及全部数据（对话历史、知识库、笔记），且<strong>无法恢复</strong>。</p>
            <div className="settings-modal-actions">
              <button className="settings-modal-cancel" onClick={() => setShowDeleteModal(false)}>
                取消
              </button>
              <button
                className="settings-modal-confirm"
                onClick={async () => {
                  setShowDeleteModal(false)
                  try {
                    await onDeleteUser()
                  } catch {
                    showToast('注销失败，请稍后重试', 'error')
                  }
                }}
              >
                确认注销
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部导航栏 */}
      <div className="settings-header">
        <button className="settings-back-btn" onClick={onBack} title="返回">
          <BackIcon />
        </button>
        <h2 className="settings-title">设置</h2>
        <div style={{ width: 36 }} />
      </div>

      <div className="settings-content">
        <div className="settings-body">

          {/* ── Section 1: 头像 ─────────────────────────────── */}
          <section className="settings-section">
            <div className="settings-section-title">头像</div>
            <div className="avatar-row">
              <img src={previewAvatar} alt="预览" className="avatar-preview" />
              <div className="avatar-right">
                <div className="avatar-current-row">
                  <span
                    className="avatar-current-color"
                    style={{ background: avatarColor }}
                  />
                  <button
                    className="settings-toggle-btn"
                    onClick={() => setShowColorPicker(prev => !prev)}
                  >
                    {showColorPicker ? '收起色板' : '修改颜色'}
                  </button>
                </div>
                {showColorPicker && (
                  <>
                    <div className="color-palette">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          className={`color-swatch ${avatarColor === c ? 'selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => setAvatarColor(c)}
                          title={c}
                        />
                      ))}
                    </div>
                    <button
                      className="settings-save-btn"
                      onClick={handleSaveAvatar}
                      disabled={avatarLoading}
                    >
                      {avatarLoading ? '保存中…' : '应用头像'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ── Section 2: 账号信息 ──────────────────────────── */}
          <section className="settings-section">
            <div className="settings-section-title">账号信息</div>
            <div className="settings-field">
              <label>用户名（登录用，不可修改）</label>
              <input
                type="text"
                value={user.username}
                disabled
                className="settings-input-readonly"
              />
            </div>
            <div className="settings-field" style={{ marginTop: 12 }}>
              <label>昵称（显示用）</label>
              <div className="settings-field-row">
                <input
                  type="text"
                  value={nickname}
                  onChange={e => { setNickname(e.target.value); setFieldErr(p => ({ ...p, nickname: '' })) }}
                  placeholder="输入昵称"
                  className={fieldErr.nickname ? 'input-err' : ''}
                />
                <button
                  className="settings-save-btn"
                  onClick={handleSaveNickname}
                  disabled={nicknameLoading}
                >
                  {nicknameLoading ? '保存中…' : '保存'}
                </button>
              </div>
              {fieldErr.nickname && <div className="settings-field-err">{fieldErr.nickname}</div>}
            </div>
          </section>

          {/* ── Section 3: 修改密码 ──────────────────────────── */}
          <section className="settings-section">
            <div className="settings-section-title">修改密码</div>
            <div className="settings-field">
              <label>新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setFieldErr(p => ({ ...p, password: '', confirm: '' })) }}
                placeholder="至少 6 位"
                className={fieldErr.password ? 'input-err' : ''}
              />
              {fieldErr.password && <div className="settings-field-err">{fieldErr.password}</div>}
            </div>
            <div className="settings-field" style={{ marginTop: 10 }}>
              <label>确认新密码</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={e => { setConfirmPwd(e.target.value); setFieldErr(p => ({ ...p, confirm: '' })) }}
                placeholder="再次输入新密码"
                className={fieldErr.confirm ? 'input-err' : ''}
              />
              {fieldErr.confirm && <div className="settings-field-err">{fieldErr.confirm}</div>}
            </div>
            <button
              className="settings-save-btn"
              style={{ marginTop: 12 }}
              onClick={handleSavePassword}
              disabled={pwdLoading}
            >
              {pwdLoading ? '修改中…' : '修改密码'}
            </button>
            {newPassword && <p className="settings-pwd-hint">修改密码后需要重新登录</p>}
          </section>

          {/* ── Section 4: 危险区 ────────────────────────────── */}
          <section className="settings-section settings-danger-zone">
            <div className="settings-section-title">危险区域</div>
            <div className="danger-zone-row">
              <div className="danger-zone-desc">
                <div className="danger-zone-label">注销账户</div>
                <div className="danger-zone-sub">永久删除账户及全部数据，操作不可恢复</div>
              </div>
              <button className="danger-btn-outline" onClick={() => setShowDeleteModal(true)}>
                注销账户
              </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}

export default SettingsPage
