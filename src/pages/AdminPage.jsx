import React, { useState, useEffect } from 'react'
import '../styles/AdminPage.css'
import { useAuth } from '../context/useAuth'

function AdminPage({ user, onLogout, onShowSettings, onBackToHome }) {
  const { getAllUsers, adminDeleteUser, updateUserPermission } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 加载所有用户
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const allUsers = await getAllUsers()
        setUsers(allUsers)
        setLoading(false)
      } catch (err) {
        setError('加载用户失败')
        setLoading(false)
      }
    }
    loadUsers()
  }, [getAllUsers])

  // 处理删除用户
  const handleDeleteUser = (userId, username) => {
    if (window.confirm(`确定要删除用户 ${username} 吗？此操作不可恢复。`)) {
      try {
        adminDeleteUser(userId)
        setUsers(prev => prev.filter(u => u.id !== userId))
        setSuccess(`用户 ${username} 删除成功`)
        setTimeout(() => setSuccess(''), 3000)
      } catch (err) {
        setError('删除用户失败')
      }
    }
  }

  // 处理更新用户权限
  const handleUpdatePermission = (userId, currentIsAdmin) => {
    // 获取用户信息用于确认提示
    const userItem = users.find(u => u.id === userId)
    if (!userItem) return
    
    // 添加确认提示
    const newPermission = !currentIsAdmin
    const permissionText = newPermission ? '授予管理员权限' : '撤销管理员权限'
    
    if (window.confirm(`确定要对用户 ${userItem.username} ${permissionText} 吗？`)) {
      try {
        updateUserPermission(userId, newPermission)
        setUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, is_admin: newPermission } : u
        ))
        setSuccess('用户权限更新成功')
        setTimeout(() => setSuccess(''), 3000)
      } catch (err) {
        setError('更新用户权限失败')
      }
    }
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="admin-page">
      {/* 页面头部 */}
      <div className="admin-header">
        <div className="header-left">
          <div className="logo-container" onClick={onBackToHome}>
            <div className="raven-icon"></div>
            <h1>管理员控制台</h1>
          </div>
        </div>
        <div className="header-right">
          <div className="user-info">
            <img 
              src={user.avatar} 
              alt={user.username} 
              className="user-avatar"
            />
            <span className="username">{user.username}</span>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="admin-content">
        <div className="admin-section">
          <h2>用户管理</h2>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>用户ID</th>
                  <th>用户名</th>
                  <th>头像</th>
                  <th>注册时间</th>
                  <th>管理员权限</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(userItem => (
                  <tr key={userItem.id}>
                    <td>{userItem.id}</td>
                    <td>{userItem.username}</td>
                    <td>
                      <img 
                        src={userItem.avatar} 
                        alt={userItem.username} 
                        className="avatar-small"
                      />
                    </td>
                    <td>{userItem.createdAt ? new Date(userItem.createdAt).toLocaleString() : '-'}</td>
                    <td>
                      <label className="permission-toggle">
                        <input 
                          type="checkbox" 
                          checked={userItem.is_admin || false}
                          onChange={() => handleUpdatePermission(userItem.id, userItem.is_admin || false)}
                          disabled={userItem.username === 'admin'}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                      {userItem.username === 'admin' && <span className="admin-protected">系统管理员</span>}
                    </td>
                    <td>
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                        disabled={userItem.is_admin && user.id === userItem.id} // 禁止删除自己
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-section">
          <h2>系统信息</h2>
          <div className="system-info">
            <div className="info-item">
              <span className="info-label">当前用户:</span>
              <span className="info-value">{user.username} ({user.is_admin ? '管理员' : '普通用户'})</span>
            </div>
            <div className="info-item">
              <span className="info-label">用户总数:</span>
              <span className="info-value">{users.length}</span>
            </div>
            <div className="info-item">
              <span className="info-label">管理员数量:</span>
              <span className="info-value">{users.filter(u => u.is_admin).length}</span>
            </div>
            <div className="info-item">
              <span className="info-label">普通用户数量:</span>
              <span className="info-value">{users.filter(u => !u.is_admin).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminPage