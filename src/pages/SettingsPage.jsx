import React, { useState } from 'react'
import '../styles/SettingsPage.css'

function SettingsPage({ user, onUpdateUser, onBack, onDeleteUser }) {
  const [username, setUsername] = useState(user.username)
  const [avatar, setAvatar] = useState(user.avatar)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 处理用户名输入变化
  const handleUsernameChange = (e) => {
    setUsername(e.target.value)
  }

  // 处理头像输入变化
  const handleAvatarChange = (e) => {
    setAvatar(e.target.value)
  }

  // 生成随机头像
  const generateRandomAvatar = () => {
    setAvatar(`https://ui-avatars.com/api/?name=${encodeURIComponent(username || 'User')}&background=random&color=fff`)
  }

  // 提交更新
  const handleSubmit = (e) => {
    e.preventDefault()
    
    // 验证输入
    if (!username.trim()) {
      setError('用户名不能为空')
      return
    }
    
    setIsLoading(true)
    setError('')
    setSuccess('')
    
    try {
      // 创建更新后的用户对象
      const updatedUser = {
        ...user,
        username: username.trim(),
        avatar
      }
      
      // 更新用户信息
      onUpdateUser(updatedUser)
      
      setSuccess('用户信息更新成功')
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccess('')
      }, 3000)
    } catch (err) {
      setError('更新失败，请稍后再试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回
        </button>
        <h2>设置</h2>
        <div></div> {/* 占位符，保持居中 */}
      </div>
      
      <div className="settings-content">
        <div className="settings-form">
          <h3>个人信息</h3>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <form onSubmit={handleSubmit}>
            {/* 头像设置 */}
            <div className="form-section">
              <h4>头像</h4>
              <div className="avatar-container">
                <img 
                  src={avatar} 
                  alt="User Avatar" 
                  className="current-avatar"
                />
                <div className="avatar-actions">
                  <div className="form-group">
                    <label htmlFor="avatar">头像URL</label>
                    <input
                      type="text"
                      id="avatar"
                      value={avatar}
                      onChange={handleAvatarChange}
                      placeholder="输入头像URL或使用随机生成"
                    />
                  </div>
                  <button 
                    type="button" 
                    className="secondary-btn"
                    onClick={generateRandomAvatar}
                  >
                    生成随机头像
                  </button>
                </div>
              </div>
            </div>
            
            {/* 用户名设置 */}
            <div className="form-section">
              <h4>用户名</h4>
              <div className="form-group">
                <label htmlFor="username">用户名</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="输入新用户名"
                  required
                />
              </div>
            </div>
            
            {/* 提交按钮 */}
            <div className="form-actions">
              <button 
                type="submit" 
                className="primary-btn"
                disabled={isLoading}
              >
                {isLoading ? '保存中...' : '保存更改'}
              </button>
            </div>
          </form>
          
          {/* 注销账户 */}
          <div className="delete-account-section">
            <h3>注销账户</h3>
            <p className="delete-account-warning">
              警告：此操作将永久删除您的账户和所有数据，包括对话历史、知识库内容等，且无法恢复。请谨慎操作。
            </p>
            <button 
              type="button" 
              className="danger-btn"
              onClick={() => {
                const confirmDelete = window.confirm('确定要永久注销您的账户吗？此操作无法恢复，所有数据将被删除。\n\n请输入 "DELETE" 进行确认：');
                if (confirmDelete) {
                  const deleteConfirm = window.prompt('请输入 "DELETE" 进行确认：');
                  if (deleteConfirm === 'DELETE') {
                    onDeleteUser(user.id);
                  } else {
                    alert('确认失败，账户未被删除。');
                  }
                }
              }}
            >
              注销账户
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage