import React, { createContext, useState, useEffect } from 'react'

// 创建AuthContext
export const AuthContext = createContext()

// 提供AuthContext的Provider组件
export const AuthProvider = ({ children }) => {
  // 状态管理
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // 从localStorage加载token和用户信息
  useEffect(() => {
    const token = localStorage.getItem('corvusNoteToken')
    const userData = localStorage.getItem('corvusNoteUser')

    if (token && userData) {
      setUser(JSON.parse(userData))
    }
    setIsLoading(false)
  }, [])

  // 从响应体中提取后端错误信息
  const extractError = async (response) => {
    try {
      const body = await response.json()
      return body.detail || body.message || `HTTP ${response.status}`
    } catch {
      return `HTTP ${response.status}`
    }
  }

  // 登录功能
  const login = async (username, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          username: username,
          password: password
        })
      })

      if (!response.ok) {
        const detail = await extractError(response)
        throw new Error(detail)
      }

      const data = await response.json()
      const { access_token } = data

      // 获取用户信息
      const userResponse = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      })

      if (!userResponse.ok) {
        throw new Error('获取用户信息失败')
      }

      const userData = await userResponse.json()

      // 只持久化必要字段
      const safeUserData = {
        id: userData.id,
        username: userData.username,
        nickname: userData.nickname,
        is_admin: userData.is_admin,
        is_guest: userData.is_guest,
        avatar: userData.avatar,
        avatar_color: userData.avatar_color,
        status: userData.status,
      }

      localStorage.setItem('corvusNoteToken', access_token)
      localStorage.setItem('corvusNoteUser', JSON.stringify(safeUserData))

      setUser(userData)
      return userData
    } catch (error) {
      throw error
    }
  }

  // 游客登录功能
  const loginAsGuest = () => {
    const guestUser = {
      id: 'guest_' + Date.now(),
      username: '游客用户',
      nickname: '游客用户',
      isGuest: true,
      isAdmin: false,
      avatar: 'https://ui-avatars.com/api/?name=%E6%B8%B8%E5%AE%A2%E7%94%A8%E6%88%B7&background=random&color=fff',
      avatar_color: '#1677ff',
      status: 'active',
    }
    setUser(guestUser)
    localStorage.setItem('corvusNoteUser', JSON.stringify(guestUser))
  }

  // 注册功能
  const register = async (userData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: userData.username,
          password: userData.password,
          avatar: userData.avatar
        })
      })

      if (!response.ok) {
        const detail = await extractError(response)
        throw new Error(detail)
      }

      const newUser = await response.json()

      // 自动登录
      await login(userData.username, userData.password)

      return newUser
    } catch (error) {
            throw error
    }
  }

  // 登出功能
  const logout = () => {
    setUser(null)
    localStorage.removeItem('corvusNoteToken')
    localStorage.removeItem('corvusNoteUser')
  }

  // 用户自助注销 — 调用后端 API 执行完整级联删除
  const deleteUser = async () => {
    const token = localStorage.getItem('corvusNoteToken')

    const response = await fetch('/api/users/me', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('删除账户失败')
    }

    // 清除前端状态
    setUser(null)
    localStorage.removeItem('corvusNoteToken')
    localStorage.removeItem('corvusNoteUser')
  }

  // 更新用户信息
  const updateUser = async (updatedUser) => {
    try {
      const token = localStorage.getItem('corvusNoteToken')

      const body = {}
      if (updatedUser.nickname !== undefined) body.nickname = updatedUser.nickname
      if (updatedUser.password !== undefined) body.password = updatedUser.password
      if (updatedUser.avatar !== undefined) body.avatar = updatedUser.avatar
      if (updatedUser.avatar_color !== undefined) body.avatar_color = updatedUser.avatar_color

      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const detail = await extractError(response)
        throw new Error(detail)
      }

      const updatedUserData = await response.json()

      // 如果密码被修改，后端已经使旧 token 失效，需要提示重新登录
      if (updatedUser.password) {
        // 清除状态并抛出特殊错误，前端可据此跳转到登录页
        setUser(null)
        localStorage.removeItem('corvusNoteToken')
        localStorage.removeItem('corvusNoteUser')
        throw new Error('PASSWORD_CHANGED')
      }

      // 只持久化必要字段
      const safeUserData = {
        id: updatedUserData.id,
        username: updatedUserData.username,
        nickname: updatedUserData.nickname,
        is_admin: updatedUserData.is_admin,
        is_guest: updatedUserData.is_guest,
        avatar: updatedUserData.avatar,
        avatar_color: updatedUserData.avatar_color,
        status: updatedUserData.status,
      }

      setUser(updatedUserData)
      localStorage.setItem('corvusNoteUser', JSON.stringify(safeUserData))

      return updatedUserData
    } catch (error) {
      throw error
    }
  }

  // 管理员功能：获取所有用户
  const getAllUsers = async () => {
    try {
      const token = localStorage.getItem('corvusNoteToken')

      const response = await fetch('/api/users/admin', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('获取用户列表失败')
      }

      return await response.json()
    } catch (error) {
            return []
    }
  }

  // 管理员功能：删除指定用户
  const adminDeleteUser = async (userId) => {
    const token = localStorage.getItem('corvusNoteToken')

    const response = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      throw new Error('删除用户失败')
    }
  }

  // 管理员功能：更新用户权限
  const updateUserPermission = async (userId, isAdmin) => {
    const token = localStorage.getItem('corvusNoteToken')

    const response = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ is_admin: isAdmin })
    })

    if (!response.ok) {
      throw new Error('更新用户权限失败')
    }

    const updatedUser = await response.json()

    if (user && user.id === userId) {
      const safeUserData = {
        id: updatedUser.id,
        username: updatedUser.username,
        nickname: updatedUser.nickname,
        is_admin: updatedUser.is_admin,
        is_guest: updatedUser.is_guest,
        avatar: updatedUser.avatar,
        avatar_color: updatedUser.avatar_color,
        status: updatedUser.status,
      }
      setUser(updatedUser)
      localStorage.setItem('corvusNoteUser', JSON.stringify(safeUserData))
    }
  }

  // 管理员功能：启用/禁用用户
  const updateUserStatus = async (userId, status) => {
    const token = localStorage.getItem('corvusNoteToken')

    const response = await fetch(`/api/users/${userId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    })

    if (!response.ok) {
      throw new Error('更新用户状态失败')
    }

    return await response.json()
  }

  // 管理员功能：获取系统统计数据
  const getAdminStats = async () => {
    const token = localStorage.getItem('corvusNoteToken')
    const response = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) throw new Error('获取统计数据失败')
    return await response.json()
  }

  // 管理员功能：获取全部共享知识库
  const getAdminSharedKbs = async () => {
    const token = localStorage.getItem('corvusNoteToken')
    const response = await fetch('/api/admin/shared-kbs?limit=500', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) throw new Error('获取共享知识库列表失败')
    return await response.json()
  }

  // 管理员功能：强制删除共享知识库
  const adminDeleteSharedKb = async (kbId) => {
    const token = localStorage.getItem('corvusNoteToken')
    const response = await fetch(`/api/admin/shared-kbs/${kbId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) throw new Error('删除共享知识库失败')
  }

  // 管理员功能：切换共享知识库可见性
  const adminToggleKbVisibility = async (kbId) => {
    const token = localStorage.getItem('corvusNoteToken')
    const response = await fetch(`/api/admin/shared-kbs/${kbId}/visibility`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!response.ok) throw new Error('修改可见性失败')
    return await response.json()
  }

  // 提供给Context的值
  const contextValue = {
    user,
    isLoading,
    login,
    register,
    logout,
    deleteUser,
    updateUser,
    loginAsGuest,
    getAllUsers,
    adminDeleteUser,
    updateUserPermission,
    updateUserStatus,
    getAdminStats,
    getAdminSharedKbs,
    adminDeleteSharedKb,
    adminToggleKbVisibility,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}