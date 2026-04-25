import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SettingsPage from './pages/SettingsPage'
import KnowledgeBasePage from './pages/KnowledgeBasePage'
import SharedKnowledgeBasePage from './pages/SharedKnowledgeBasePage'
import NotesPage from './pages/NotesPage'
import AdminPage from './pages/AdminPage'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import {
  fetchConversations, createConversation, updateConversation, deleteConversationApi,
  fetchMessages, saveMessage,
  fetchNotes, createNoteApi, updateNoteApi, deleteNoteApi,
} from './utils/apiService'

// 主应用内容组件
const AppContent = () => {
  const { user, isLoading, login, logout, updateUser, deleteUser, loginAsGuest } = useAuth()
  const [isChatting, setIsChatting] = useState(false)
  const [isKnowledgeBase, setIsKnowledgeBase] = useState(false)
  const [isSharedKnowledgeBase, setIsSharedKnowledgeBase] = useState(false)
  const [isNotesPage, setIsNotesPage] = useState(false)
  const [isAdminPage, setIsAdminPage] = useState(false)
  const [messages, setMessages] = useState([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [conversations, setConversations] = useState([])
  const [currentConversationId, setCurrentConversationId] = useState(null)

  // 添加事件监听器来处理跳转到注册页面
  useEffect(() => {
    const handleShowRegister = () => {
      setShowRegister(true)
    }
    
    window.addEventListener('showRegister', handleShowRegister)
    
    // 直接检查URL哈希来处理注册跳转
    const checkHash = () => {
      if (window.location.hash === '#register') {
        setShowRegister(true)
        window.location.hash = ''
      }
    }
    
    checkHash()
    window.addEventListener('hashchange', checkHash)
    
    return () => {
      window.removeEventListener('showRegister', handleShowRegister)
      window.removeEventListener('hashchange', checkHash)
    }
  }, [])
  // 笔记相关状态
  const [notes, setNotes] = useState([])
  const [currentNoteId, setCurrentNoteId] = useState(null)
  // 笔记防抖同步：accumulate pending updates, debounce backend write
  const notePendingUpdates = useRef({})
  const noteDebounceRef = useRef({})

  // 模型选择：从 localStorage 恢复上次选择
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('corvusNoteSelectedModel') || 'qwen3.5-flash'
  )
  const handleModelChange = (model) => {
    setSelectedModel(model)
    localStorage.setItem('corvusNoteSelectedModel', model)
  }

  // 流式生成中断控制
  const abortControllerRef = useRef(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const handleStopGeneration = () => {
    abortControllerRef.current?.abort()
    setIsGenerating(false)
  }
  // 模型列表（API Key 仅存于后端，前端不持有）
  const models = [
    { id: 'qwen3.5-flash', name: 'Qwen3.5 Flash' },
    { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus' },
    { id: 'glm-5', name: 'GLM-5' },
    { id: 'MiniMax-M2.5', name: 'MiniMax M2.5' },
  ]

  // 登录后从后端加载对话列表、消息、笔记
  useEffect(() => {
    if (!user) return

    // 重置状态，确保登录后显示首页
    setShowSettings(false)
    setIsChatting(false)
    setIsKnowledgeBase(false)
    setIsSharedKnowledgeBase(false)
    setIsNotesPage(false)
    setIsAdminPage(false)
    setConversations([])
    setMessages([])
    setCurrentConversationId(null)
    setNotes([])
    setCurrentNoteId(null)

    const loadData = async () => {
      // 游客用户不加载后端数据
      if (user.isGuest) {
        return
      }

      // ── 加载对话列表 ──────────────────────────────────────────
      try {
        const convs = await fetchConversations()
        const sorted = convs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        const mapped = sorted.map(c => ({
          id: c.id,
          title: c.title,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }))
        setConversations(mapped)

        // 尝试恢复上次打开的对话
        const savedId = localStorage.getItem(`corvusNoteCurrentConversationId_${user.id}`)
        const targetId = savedId && sorted.find(c => c.id === savedId) ? savedId : (sorted[0]?.id || null)
        if (targetId) {
          setCurrentConversationId(targetId)
          const msgs = await fetchMessages(targetId)
          setMessages(msgs.map(m => ({
            role: m.role,
            content: m.content,
            file: m.file || null,
            mountedKnowledgeBases: m.mounted_knowledge_bases || [],
          })))
        }
      } catch (err) {
        console.error('加载对话失败:', err)
      }

      // ── 加载笔记列表 ──────────────────────────────────────────
      try {
        const notesList = await fetchNotes()
        const mappedNotes = notesList.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          images: n.images || {},
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        }))
        setNotes(mappedNotes)

        const savedNoteId = localStorage.getItem(`corvusNoteCurrentNoteId_${user.id}`)
        if (savedNoteId && mappedNotes.find(n => n.id === savedNoteId)) {
          setCurrentNoteId(savedNoteId)
        }
      } catch (err) {
        console.error('加载笔记失败:', err)
      }
    }

    loadData()
  }, [user])
  
  // 创建新会话，在后端持久化后返回新会话 ID
  const createNewConversation = async (initialQuestion = '') => {
    // 检查游客会话限制
    if (user.isGuest && conversations.length >= 2) {
      if (window.confirm('游客用户最多只能创建2个会话窗口。\n\n建议您注册账户以获得更多功能。\n\n是否跳转到注册页面？')) {
        window.location.href = '/#register'
      }
      return null
    }

    let title = '新对话'
    if (initialQuestion?.trim()) {
      title = initialQuestion.trim().substring(0, 20) + (initialQuestion.length > 20 ? '...' : '')
    }

    try {
      // 游客用户使用本地会话管理
      if (user.isGuest) {
        const newConversation = {
          id: 'guest_conv_' + Date.now(),
          title: title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setConversations(prev => [newConversation, ...prev])
        setCurrentConversationId(newConversation.id)
        localStorage.setItem(`corvusNoteCurrentConversationId_${user.id}`, newConversation.id)
        setMessages([])
        setIsChatting(true)
        return newConversation.id
      } else {
        // 普通用户调用后端API
        const conv = await createConversation(title)
        const newConversation = {
          id: conv.id,
          title: conv.title,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        }
        setConversations(prev => [newConversation, ...prev])
        setCurrentConversationId(conv.id)
        localStorage.setItem(`corvusNoteCurrentConversationId_${user.id}`, conv.id)
        setMessages([])
        setIsChatting(true)
        return conv.id
      }
    } catch (err) {
      // 对于游客用户，即使API调用失败也继续使用本地会话
      if (user.isGuest) {
        const newConversation = {
          id: 'guest_conv_' + Date.now(),
          title: title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        setConversations(prev => [newConversation, ...prev])
        setCurrentConversationId(newConversation.id)
        localStorage.setItem(`corvusNoteCurrentConversationId_${user.id}`, newConversation.id)
        setMessages([])
        setIsChatting(true)
        return newConversation.id
      }
      return null
    }
  }
  
  // 切换会话：从后端加载消息
  const switchConversation = async (conversationId) => {
    setCurrentConversationId(conversationId)
    localStorage.setItem(`corvusNoteCurrentConversationId_${user.id}`, conversationId)
    setMessages([])
    setIsChatting(true)

    // 游客用户不需要从后端加载消息
    if (!user.isGuest) {
      try {
        const msgs = await fetchMessages(conversationId)
        setMessages(msgs.map(m => ({
          role: m.role,
          content: m.content,
          file: m.file || null,
          mountedKnowledgeBases: m.mounted_knowledge_bases || [],
        })))
      } catch (err) {
            }
    }
  }
  
  // 编辑会话标题：同步到后端
  const editConversation = async (conversationId, newTitle) => {
    setConversations(prev => prev.map(conv =>
      conv.id === conversationId
        ? { ...conv, title: newTitle, updatedAt: new Date().toISOString() }
        : conv
    ))
    // 游客用户不需要同步到后端
    if (!user.isGuest) {
      try {
        await updateConversation(conversationId, newTitle)
      } catch (err) {
            }
    }
  }

  // 删除会话：同步到后端（后端自动级联删除消息）
  const deleteConversation = async (conversationId) => {
    // 如果删除的是当前会话，切换到其他会话或返回首页
    if (conversationId === currentConversationId) {
      const remaining = conversations.filter(conv => conv.id !== conversationId)
      if (remaining.length > 0) {
        await switchConversation(remaining[0].id)
      } else {
        setCurrentConversationId(null)
        setMessages([])
        setIsChatting(false)
      }
    }

    setConversations(prev => prev.filter(conv => conv.id !== conversationId))

    // 游客用户不需要同步到后端
    if (!user.isGuest) {
      try {
        await deleteConversationApi(conversationId)
      } catch (err) {
            }
    }
  }
  
  // 笔记相关函数

  // 创建新笔记：在后端持久化
  const createNewNote = async () => {
    try {
      const note = await createNoteApi({ title: '新笔记', content: '' })
      const newNote = {
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      }
      setNotes(prev => [newNote, ...prev])
      setCurrentNoteId(note.id)
      localStorage.setItem(`corvusNoteCurrentNoteId_${user.id}`, note.id)
      setIsNotesPage(true)
    } catch (err) {
          }
  }

  // 切换笔记
  const switchNote = (noteId) => {
    setCurrentNoteId(noteId)
    localStorage.setItem(`corvusNoteCurrentNoteId_${user.id}`, noteId)
  }

  // 编辑笔记：本地立即更新，1 秒防抖后写入后端
  const editNote = (noteId, updates) => {
    setNotes(prev => prev.map(note =>
      note.id === noteId ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note
    ))

    // 累积本次更新
    notePendingUpdates.current[noteId] = {
      ...(notePendingUpdates.current[noteId] || {}),
      ...updates,
    }

    // 防抖：上次定时器未到期则重置
    clearTimeout(noteDebounceRef.current[noteId])
    noteDebounceRef.current[noteId] = setTimeout(async () => {
      const pending = notePendingUpdates.current[noteId]
      if (!pending) return
      delete notePendingUpdates.current[noteId]
      try {
        await updateNoteApi(noteId, pending)
      } catch (err) {
              }
    }, 1000)
  }

  // 删除笔记：同步到后端
  const deleteNote = async (noteId) => {
    if (noteId === currentNoteId) {
      const remaining = notes.filter(note => note.id !== noteId)
      if (remaining.length > 0) {
        setCurrentNoteId(remaining[0].id)
      } else {
        setCurrentNoteId(null)
        setIsNotesPage(false)
      }
    }

    // 取消该笔记未完成的防抖写入
    clearTimeout(noteDebounceRef.current[noteId])
    delete noteDebounceRef.current[noteId]
    delete notePendingUpdates.current[noteId]

    setNotes(prev => prev.filter(note => note.id !== noteId))

    try {
      await deleteNoteApi(noteId)
    } catch (err) {
          }
  }

  // 进入会话界面
  const goToConversations = async () => {
    if (conversations.length > 0) {
      await switchConversation(conversations[0].id)
    } else {
      await createNewConversation()
    }
  }



  const handleSendQuestion = async (question, file = null, mountedKnowledgeBases = []) => {
    if (!user) return

    let userDisplayContent = question
    if (file) userDisplayContent = `${question}\n\n[附件: ${file.name}]`

    // 先在后端创建对话，拿到持久化 ID
    const newConvId = await createNewConversation(question || file?.name || '')
    if (!newConvId) return

    const userMessage = { role: 'user', content: userDisplayContent, file, mountedKnowledgeBases }
    setMessages([userMessage])
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    setIsChatting(true)

    try {
      const { generateAIResponseWithHistory, generateConversationTitle } = await import('./utils/langchainService')

      abortControllerRef.current = new AbortController()
      setIsGenerating(true)

      const finalResult = await generateAIResponseWithHistory(
        [userMessage],
        (streamedContent) => {
          setMessages(prev => {
            const updated = [...prev]
            updated[1] = { ...updated[1], role: 'assistant', content: streamedContent }
            return updated
          })
        },
        selectedModel, file, mountedKnowledgeBases, abortControllerRef.current
      )
      const finalContent = typeof finalResult === 'object' ? (finalResult?.content || '') : (finalResult || '')

      setIsGenerating(false)

      // 递归获取文件夹内的所有文件
      const getAllFilesFromFolder = (items) => {
        const files = []
        for (const item of items) {
          if (item.type === 'folder' && item.items) {
            files.push(...getAllFilesFromFolder(item.items))
          } else if (item.type !== 'folder') {
            files.push(item)
          }
        }
        return files
      }

      // 非游客用户才持久化消息到后端
      if (!user.isGuest) {
        // 流式完成后，持久化消息
        let allMountedItems = []
        for (const item of (mountedKnowledgeBases || [])) {
          if (item.type === 'folder') {
            allMountedItems.push(...getAllFilesFromFolder([item]))
          } else {
            allMountedItems.push(item)
          }
        }
        const kbIds = allMountedItems.filter(kb => kb.backendId).map(kb => kb.backendId)
        const fileMeta = file ? { name: file.name, type: file.type, size: file.size } : null
        await saveMessage(newConvId, { role: 'user', content: userDisplayContent, file: fileMeta, mounted_knowledge_bases: kbIds })
        await saveMessage(newConvId, { role: 'assistant', content: finalContent || '' })

        // 用 AI 生成对话标题（异步，不阻塞 UI）
        if (finalContent) {
          generateConversationTitle(question, finalContent).then(async (title) => {
            if (title) {
              await updateConversation(newConvId, title)
              setConversations(prev => prev.map(c => c.id === newConvId ? { ...c, title } : c))
            }
          }).catch(() => {})
        }
      }
    } catch (error) {
      setIsGenerating(false)
            setMessages(prev => {
        const updated = [...prev]
        updated[1] = { role: 'assistant', content: '抱歉，生成回复时遇到错误，请稍后再试。' }
        return updated
      })
    }
  }

  const handleNewChat = () => {
    createNewConversation()
  }

  const handleLogin = (userData, action) => {
    if (action === 'register') {
      setShowRegister(true)
    } else if (action === 'guest') {
      // 游客登录：先设置用户，后关闭登录页面
      loginAsGuest()
      setIsChatting(true)
    } else {
      setIsChatting(true)
    }
    // 无论哪种登录，都关闭登录页面
    setShowRegister(false)
  }

  const handleRegister = (userData) => {
    // 注册成功后会自动登录并设置用户状态
    setShowRegister(false)
  }

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return <div className="loading">加载中...</div>
  }

  // 如果未登录，显示登录或注册页面
  if (!user) {
    return showRegister ? (
      <RegisterPage 
        onRegister={handleRegister} 
        onSwitchToLogin={() => setShowRegister(false)} 
      />
    ) : (
      <LoginPage onLogin={handleLogin} />
    )
  }

  return (
    <div className="app">
      {showSettings ? (
        <SettingsPage 
          user={user}
          onUpdateUser={updateUser}
          onDeleteUser={deleteUser}
          onBack={() => setShowSettings(false)}
        />
      ) : isAdminPage ? (
        <AdminPage 
          user={user}
          onLogout={logout}
          onShowSettings={() => setShowSettings(true)}
          onBackToHome={() => setIsAdminPage(false)}
        />
      ) : isChatting ? (
        <ChatPage 
          messages={messages} 
          setMessages={setMessages} 
          onNewChat={handleNewChat} 
          user={user}
          onLogout={logout}
          onShowSettings={() => setShowSettings(true)}
          conversations={conversations}
          onSwitchConversation={switchConversation}
          currentConversationId={currentConversationId}
          onEditConversation={editConversation}
          onDeleteConversation={deleteConversation}
          onBackToHome={() => {
            setIsChatting(false);
            setIsKnowledgeBase(false);
            setIsSharedKnowledgeBase(false);
            setIsNotesPage(false);
            setIsAdminPage(false);
          }}
          models={models}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
          isGenerating={isGenerating}
          onStopGeneration={handleStopGeneration}
          onCreateNewNote={createNewNote}
          onEditNote={editNote}
          notes={notes}
          setNotes={setNotes}
        />
      ) : isKnowledgeBase ? (
        <KnowledgeBasePage 
          user={user}
          onLogout={logout}
          onShowSettings={() => setShowSettings(true)}
          onBackToHome={() => setIsKnowledgeBase(false)}
          onNavigateToSharedKnowledge={() => {
            setIsKnowledgeBase(false);
            setIsSharedKnowledgeBase(true);
          }}
        />
      ) : isSharedKnowledgeBase ? (
        <SharedKnowledgeBasePage 
          user={user}
          onLogout={logout}
          onShowSettings={() => setShowSettings(true)}
          onBackToHome={() => setIsSharedKnowledgeBase(false)}
          onNavigateToPersonalKnowledge={() => {
            setIsSharedKnowledgeBase(false);
            setIsKnowledgeBase(true);
          }}
        />
      ) : isNotesPage ? (
        <NotesPage 
          user={user}
          onLogout={logout}
          onShowSettings={() => setShowSettings(true)}
          onBackToHome={() => setIsNotesPage(false)}
          notes={notes}
          currentNoteId={currentNoteId}
          onSwitchNote={switchNote}
          onEditNote={editNote}
          onDeleteNote={deleteNote}
          onCreateNewNote={createNewNote}
        />
      ) : (
        <HomePage 
          onSendQuestion={handleSendQuestion} 
          user={user}
          onLogout={logout}
          onShowSettings={() => setShowSettings(true)}
          onGoToKnowledgeBase={() => setIsKnowledgeBase(true)}
          onGoToSharedKnowledgeBase={() => setIsSharedKnowledgeBase(true)}
          onGoToConversations={goToConversations}
          onGoToNotes={() => setIsNotesPage(true)}
          onGoToAdminPage={() => setIsAdminPage(true)}
          onCreateNewNote={createNewNote}
          models={models}
          selectedModel={selectedModel}
          onModelChange={handleModelChange}
        />
      )}
    </div>
  )
}

// 包装AuthProvider的主App组件
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App