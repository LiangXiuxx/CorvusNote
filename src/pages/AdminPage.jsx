import React, { useState, useEffect, useCallback } from 'react'
import '../styles/AdminPage.css'
import { useAuth } from '../context/useAuth'

const TABS = [
  { key: 'dashboard', label: '数据概览' },
  { key: 'users',     label: '用户管理' },
  { key: 'sharedKbs', label: '共享知识库' },
]

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value ?? '-'}</span>
      <span className="stat-label">{label}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

function DashboardTab({ stats, loading }) {
  if (loading) return <div className="tab-loading">加载中…</div>
  if (!stats) return <div className="tab-loading">暂无数据</div>

  const { users, shared_kbs, content } = stats
  return (
    <div className="dashboard-grid">
      <div className="stat-group">
        <h3 className="stat-group-title">用户</h3>
        <div className="stat-cards">
          <StatCard label="总用户数"   value={users.total}     />
          <StatCard label="今日新增"   value={users.new_today} />
          <StatCard label="已禁用"     value={users.disabled}  />
          <StatCard label="管理员"     value={users.admins}    />
        </div>
      </div>
      <div className="stat-group">
        <h3 className="stat-group-title">共享知识库</h3>
        <div className="stat-cards">
          <StatCard label="知识库总数" value={shared_kbs.total}  />
          <StatCard label="公开"       value={shared_kbs.public} />
          <StatCard label="文件总数"   value={shared_kbs.files}  />
        </div>
      </div>
      <div className="stat-group">
        <h3 className="stat-group-title">内容</h3>
        <div className="stat-cards">
          <StatCard label="对话数" value={content.conversations} />
          <StatCard label="笔记数" value={content.notes}         />
        </div>
      </div>
    </div>
  )
}

function UsersTab({ user: currentUser }) {
  const { getAllUsers, adminDeleteUser, updateUserPermission, updateUserStatus } = useAuth()
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const flash = (setter, msg) => {
    setter(msg)
    setTimeout(() => setter(''), 3000)
  }

  useEffect(() => {
    getAllUsers()
      .then(data => { setUsers(data); setLoading(false) })
      .catch(() => { setError('加载用户失败'); setLoading(false) })
  }, [getAllUsers])

  const handleDelete = (userId, name) => {
    if (!window.confirm(`确定要删除用户 ${name} 吗？此操作不可恢复。`)) return
    adminDeleteUser(userId)
      .then(() => {
        setUsers(prev => prev.filter(u => u.id !== userId))
        flash(setSuccess, `用户 ${name} 删除成功`)
      })
      .catch(() => flash(setError, '删除用户失败'))
  }

  const handlePermission = (userId, isAdmin) => {
    const u = users.find(x => x.id === userId)
    if (!u) return
    const name = u.nickname || u.username
    if (!window.confirm(`确定要${!isAdmin ? '授予' : '撤销'} ${name} 的管理员权限吗？`)) return
    updateUserPermission(userId, !isAdmin)
      .then(() => {
        setUsers(prev => prev.map(x => x.id === userId ? { ...x, is_admin: !isAdmin } : x))
        flash(setSuccess, '用户权限更新成功')
      })
      .catch(() => flash(setError, '更新用户权限失败'))
  }

  const handleStatus = (userId, currentStatus, name) => {
    const next = currentStatus === 'active' ? 'disabled' : 'active'
    const action = next === 'disabled' ? '禁用' : '启用'
    if (!window.confirm(`确定要${action}用户 ${name} 吗？`)) return
    updateUserStatus(userId, next)
      .then(() => {
        setUsers(prev => prev.map(x => x.id === userId ? { ...x, status: next } : x))
        flash(setSuccess, `用户 ${name} 已${action}`)
      })
      .catch(() => flash(setError, '更新用户状态失败'))
  }

  if (loading) return <div className="tab-loading">加载中…</div>

  return (
    <>
      {error   && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>昵称</th>
              <th>头像</th>
              <th>状态</th>
              <th>注册时间</th>
              <th>最后登录</th>
              <th>管理员</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const name = u.nickname || u.username
              return (
                <tr key={u.id} className={u.status === 'disabled' ? 'row-disabled' : ''}>
                  <td>{u.username}</td>
                  <td>{u.nickname || '-'}</td>
                  <td><img src={u.avatar} alt={name} className="avatar-small" /></td>
                  <td>
                    <span className={`status-badge status-${u.status || 'active'}`}>
                      {u.status === 'disabled' ? '已禁用' : '正常'}
                    </span>
                  </td>
                  <td>{u.created_at  ? new Date(u.created_at).toLocaleString()  : '-'}</td>
                  <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '从未登录'}</td>
                  <td>
                    <label className="permission-toggle">
                      <input
                        type="checkbox"
                        checked={u.is_admin || false}
                        onChange={() => handlePermission(u.id, u.is_admin || false)}
                        disabled={u.username === 'admin'}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                    {u.username === 'admin' && <span className="admin-protected">系统管理员</span>}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button
                        className={`status-btn ${u.status === 'disabled' ? 'btn-enable' : 'btn-disable'}`}
                        onClick={() => handleStatus(u.id, u.status || 'active', name)}
                        disabled={u.username === 'admin' || (u.is_admin && currentUser.id === u.id)}
                      >
                        {u.status === 'disabled' ? '启用' : '禁用'}
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(u.id, name)}
                        disabled={u.is_admin && currentUser.id === u.id}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function SharedKbsTab() {
  const { getAdminSharedKbs, adminDeleteSharedKb, adminToggleKbVisibility } = useAuth()
  const [kbs, setKbs]         = useState([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  const flash = (setter, msg) => {
    setter(msg)
    setTimeout(() => setter(''), 3000)
  }

  const load = useCallback(() => {
    setLoading(true)
    getAdminSharedKbs()
      .then(data => { setKbs(data.items); setTotal(data.total); setLoading(false) })
      .catch(() => { setError('加载共享知识库失败'); setLoading(false) })
  }, [getAdminSharedKbs])

  useEffect(() => { load() }, [load])

  const handleDelete = (kbId, name) => {
    if (!window.confirm(`确定要强制删除「${name}」吗？将级联删除全部文件和成员，此操作不可恢复。`)) return
    adminDeleteSharedKb(kbId)
      .then(() => {
        setKbs(prev => prev.filter(k => k.id !== kbId))
        setTotal(prev => prev - 1)
        flash(setSuccess, `「${name}」已删除`)
      })
      .catch(() => flash(setError, '删除失败'))
  }

  const handleToggle = (kbId, name) => {
    adminToggleKbVisibility(kbId)
      .then(data => {
        setKbs(prev => prev.map(k => k.id === kbId ? { ...k, is_public: data.is_public } : k))
        flash(setSuccess, `「${name}」已设为${data.is_public ? '公开' : '私有'}`)
      })
      .catch(() => flash(setError, '修改可见性失败'))
  }

  if (loading) return <div className="tab-loading">加载中…</div>

  return (
    <>
      {error   && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      <div className="table-meta">共 {total} 个知识库</div>
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>描述</th>
              <th>创建者</th>
              <th>分类</th>
              <th>可见性</th>
              <th>成员</th>
              <th>文件</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {kbs.map(kb => (
              <tr key={kb.id}>
                <td className="kb-name">{kb.name}</td>
                <td className="kb-desc">{kb.description || '-'}</td>
                <td>{kb.owner_name || '-'}</td>
                <td>{kb.category}</td>
                <td>
                  <span className={`visibility-badge ${kb.is_public ? 'vis-public' : 'vis-private'}`}>
                    {kb.is_public ? '公开' : '私有'}
                  </span>
                </td>
                <td>{kb.member_count}</td>
                <td>{kb.file_count}</td>
                <td>{kb.created_at ? new Date(kb.created_at).toLocaleDateString() : '-'}</td>
                <td>
                  <div className="admin-actions">
                    <button
                      className={`status-btn ${kb.is_public ? 'btn-disable' : 'btn-enable'}`}
                      onClick={() => handleToggle(kb.id, kb.name)}
                    >
                      {kb.is_public ? '设为私有' : '设为公开'}
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(kb.id, kb.name)}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function AdminPage({ user, onBackToHome }) {
  const { getAdminStats } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [stats, setStats]         = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    getAdminStats()
      .then(data => { setStats(data); setStatsLoading(false) })
      .catch(() => setStatsLoading(false))
  }, [getAdminStats])

  const displayName = user.nickname || user.username

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="header-left">
          <div className="logo-container" onClick={onBackToHome}>
            <div className="raven-icon"></div>
            <h1>管理员控制台</h1>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <img src={user.avatar} alt={displayName} className="user-avatar" />
            <span className="username">{displayName}</span>
          </div>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`admin-tab-btn${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="admin-content">
        <div className="admin-section">
          {activeTab === 'dashboard' && (
            <DashboardTab stats={stats} loading={statsLoading} />
          )}
          {activeTab === 'users' && (
            <UsersTab user={user} />
          )}
          {activeTab === 'sharedKbs' && (
            <SharedKbsTab />
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminPage
