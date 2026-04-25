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
        throw new Error('登录失败')
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

      // 只持久化必要字段，避免 XSS 时暴露冗余信息
      const safeUserData = {
        id: userData.id,
        username: userData.username,
        is_admin: userData.is_admin,
        is_guest: userData.is_guest,
        avatar: userData.avatar,
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
      isGuest: true,
      isAdmin: false,
      avatar: 'https://ui-avatars.com/api/?name=%E6%B8%B8%E5%AE%A2%E7%94%A8%E6%88%B7&background=random&color=fff'
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
          is_admin: false,
          is_guest: false,
          avatar: userData.avatar
        })
      })
      
      if (!response.ok) {
        throw new Error('注册失败')
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
  
  // 删除用户功能（注销账户）
  const deleteUser = async (userId) => {
    // 由于后端API不允许用户删除自己的账户，我们只在前端清理数据
    // 删除当前用户状态
    setUser(null)
    
    // 删除token和用户信息
    localStorage.removeItem('corvusNoteToken')
    localStorage.removeItem('corvusNoteUser')
    
    // 删除用户相关的所有数据
    // 删除对话历史
    localStorage.removeItem(`corvusNoteConversations_${userId}`)
    // 删除知识库数据
    localStorage.removeItem(`corvusNoteKnowledgeBase_${userId}`)
  }
  
  // 更新用户信息
  const updateUser = async (updatedUser) => {
    try {
      const token = localStorage.getItem('corvusNoteToken')

      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: updatedUser.username,
          password: updatedUser.password,
          avatar: updatedUser.avatar
        })
      })

      if (!response.ok) {
        throw new Error('更新用户信息失败')
      }

      const updatedUserData = await response.json()

      // 只持久化必要字段
      const safeUserData = {
        id: updatedUserData.id,
        username: updatedUserData.username,
        is_admin: updatedUserData.is_admin,
        is_guest: updatedUserData.is_guest,
        avatar: updatedUserData.avatar,
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

    localStorage.removeItem(`corvusNoteConversations_${userId}`)
    localStorage.removeItem(`corvusNoteKnowledgeBase_${userId}`)
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
        is_admin: updatedUser.is_admin,
        is_guest: updatedUser.is_guest,
        avatar: updatedUser.avatar,
      }
      setUser(updatedUser)
      localStorage.setItem('corvusNoteUser', JSON.stringify(safeUserData))
    }
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
    updateUserPermission
  }
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}