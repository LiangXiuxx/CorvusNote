import React, { useState } from 'react'
import mammoth from 'mammoth'
import '../styles/KnowledgeBasePage.css'
import {
  fetchKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, uploadToKnowledgeBase,
  fetchMyCreatedKBs, fetchMyJoinedKBs,
  fetchSharedKBDetail, fetchSharedKBFiles, fetchSharedKBFileContent,
  uploadToSharedKB, createSharedKB, deleteSharedKB, quitSharedKB, deleteSharedKBFile,
} from '../utils/apiService'

function KnowledgeBasePage({ user, onLogout, onShowSettings, onBackToHome, onNavigateToSharedKnowledge }) {
  // IndexedDB操作封装
  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('CorvusNoteDB', 1)

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        // 创建存储库
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' })
        }
      }

      request.onsuccess = (event) => {
        resolve(event.target.result)
      }

      request.onerror = (event) => {
        reject(event.target.error)
      }
    })
  }

  // 保存文件到IndexedDB
  const saveFileToDB = async (fileId, file) => {
    try {
      const db = await initDB()
      const transaction = db.transaction(['files'], 'readwrite')
      const store = transaction.objectStore('files')
      store.put({ id: fileId, file: file })

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    } catch (error) {
      console.error('保存文件到IndexedDB失败:', error)
    }
  }

  // 从IndexedDB获取文件
  const getFileFromDB = async (fileId) => {
    try {
      const db = await initDB()
      const transaction = db.transaction(['files'], 'readonly')
      const store = transaction.objectStore('files')
      const request = store.get(fileId)

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.file)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('从IndexedDB获取文件失败:', error)
      return null
    }
  }

  // 从IndexedDB删除文件
  const deleteFileFromDB = async (fileId) => {
    try {
      const db = await initDB()
      const transaction = db.transaction(['files'], 'readwrite')
      const store = transaction.objectStore('files')
      store.delete(fileId)

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
    } catch (error) {
      console.error('从IndexedDB删除文件失败:', error)
    }
  }

  // 从localStorage加载用户的个人知识库数据
  const loadPersonalKnowledgeBaseData = () => {
    if (user) {
      const savedData = localStorage.getItem(`corvusNotePersonalKnowledgeBase_${user.id}`)
      if (savedData) {
        return JSON.parse(savedData)
      }
    }
    // 默认数据
    return [
      {
        id: '3',
        name: 'Corvus Note使用指南',
        fileType: 'text/markdown',
        simpleType: 'Markdown文件',
        type: 'markdown',
        size: '30.5 KB',
        createdAt: '2026-01-17',
        content: `# Corvus Note 使用指南

## 1. 欢迎使用 Corvus Note

Corvus Note 是一款基于AI的智能笔记与对话系统，专为提高个人和团队的知识管理效率而设计。通过集成阿里云 qwen-plus 模型，Corvus Note 提供了强大的智能对话、知识库管理和内容生成功能。

## 2. 系统功能介绍

### 2.1 智能对话

- **高质量AI对话**：基于阿里云 qwen-plus 大语言模型，提供准确、流畅的对话体验
- **多轮对话支持**：系统能够记忆上下文，支持连续的多轮对话
- **实时流式输出**：AI回复实时显示，无需等待完整回复生成
- **对话历史管理**：自动保存所有对话历史，方便随时查看和继续

### 2.2 知识库管理

- **文件夹管理**：支持创建、重命名、删除文件夹，实现知识的分类存储
- **文件上传**：支持多种文件格式上传，包括 PDF、Word、Markdown 和文本文件
- **在线预览**：支持直接在浏览器中预览多种文件格式，无需下载
- **文件管理**：支持文件的重命名、删除和下载操作

### 2.3 用户系统

- **注册登录**：支持邮箱注册和登录，保护用户数据安全
- **个人设置**：支持修改个人信息和头像
- **会话管理**：每个用户拥有独立的会话存储空间

## 3. 快速上手

### 3.1 登录与注册

1. 打开 Corvus Note 应用
2. 点击右上角的"注册"按钮，填写邮箱、密码和用户名
3. 注册成功后，使用注册信息登录系统
4. 登录后自动进入聊天界面

### 3.2 智能对话

1. 在聊天界面的输入框中输入你的问题或需求
2. 点击发送按钮（或按下回车键）提交请求
3. 等待AI回复，回复将实时流式显示
4. 可以继续输入新问题，系统会保持上下文
5. 点击左侧会话列表可以切换不同的对话

### 3.3 管理知识库

1. 点击左侧导航栏的知识库图标（📚）进入知识库页面
2. 点击"新建文件夹"按钮创建文件夹，输入文件夹名称
3. 点击文件夹进入，点击"上传文件"按钮选择要上传的文件
4. 上传完成后，文件将显示在当前文件夹中
5. 点击文件可以在线预览，点击文件右上角的菜单按钮可以进行重命名或删除操作

### 3.4 查看和编辑文件

1. 在知识库中点击要查看的文件
2. 文件将在模态框中打开，支持在线预览
3. 点击模态框右上角的下载按钮可以下载文件
4. 关闭模态框返回知识库页面

## 4. 高级功能

### 4.1 会话管理

- **创建新对话**：点击左侧会话列表顶部的"新对话"按钮
- **重命名对话**：点击会话右侧的菜单按钮，选择"重命名"
- **删除对话**：点击会话右侧的菜单按钮，选择"删除"
- **继续历史对话**：点击左侧会话列表中的任意对话，即可继续该对话

### 4.2 知识库高级操作

- **文件夹导航**：通过面包屑导航可以快速返回上级文件夹
- **文件搜索**：支持根据文件名搜索文件（即将上线）
- **文件分类**：系统自动根据文件类型显示不同图标
- **批量操作**：支持批量上传文件

## 5. 界面导航

### 5.1 左侧导航栏

- **返回首页**：点击返回箭头图标返回聊天界面
- **知识库**：点击知识库图标进入知识库管理页面

### 5.2 顶部菜单栏

- **用户信息**：显示当前登录用户的头像和用户名
- **设置**：点击用户头像进入设置页面
- **注销**：点击注销按钮退出登录

## 6. 最佳实践

### 6.1 智能对话技巧

- **明确提问**：尽量清晰、具体地描述你的问题或需求
- **提供上下文**：如果问题涉及之前的对话，确保提供足够的上下文
- **使用关键词**：在提问中使用相关关键词，有助于AI更准确地理解
- **分段提问**：对于复杂问题，可以分成多个简单问题逐步提问

### 6.2 知识库管理建议

- **合理分类**：根据知识类型创建不同的文件夹，便于管理和查找
- **命名规范**：为文件夹和文件使用清晰、描述性的名称
- **定期整理**：定期清理无用文件，保持知识库的整洁
- **备份重要文件**：对于重要文件，建议定期下载备份

## 7. 系统要求

- **浏览器**：推荐使用 Chrome、Firefox、Safari 或 Edge 最新版本
- **网络**：需要稳定的网络连接，用于AI模型调用和文件上传下载
- **设备**：支持桌面端和移动端访问，推荐使用桌面端获得最佳体验

## 8. 常见问题解答

### 8.1 忘记密码怎么办？
目前系统支持通过邮箱重置密码功能（即将上线），当前版本建议联系管理员重置。

### 8.2 支持哪些文件格式？
支持 PDF、Word（.docx/.doc）、Markdown（.md）和纯文本文件（.txt）。

### 8.3 如何查看历史对话？
在聊天界面左侧的会话列表中，可以查看所有历史对话，点击即可切换。

### 8.4 上传的文件会被保存多久？
上传的文件将保存在浏览器的 IndexedDB 中，只要不清除浏览器数据，文件将一直保存。

### 8.5 可以在多台设备上使用吗？
当前版本数据保存在浏览器本地，暂不支持多设备同步。后续版本将支持云端同步功能。

## 9. 技术支持

如果您在使用过程中遇到任何问题或有任何建议，欢迎通过以下方式联系我们：

- 邮箱：support@corvusnote.com
- 在线反馈：在设置页面提交反馈
- 更新日志：系统会定期更新，修复bug并添加新功能

---

© 2026 Corvus Note. All rights reserved.`
      }
    ]
  }

  // 从localStorage加载用户的共享知识库数据
  const loadSharedKnowledgeBaseData = () => {
    if (user) {
      const savedData = localStorage.getItem(`corvusNoteSharedKnowledgeBase_${user.id}`)
      if (savedData) {
        return JSON.parse(savedData)
      }
    }
    // 默认数据
    return []
  }

  // 保存个人知识库数据到localStorage
  const savePersonalKnowledgeBaseData = (data) => {
    if (user) {
      try {
        localStorage.setItem(`corvusNotePersonalKnowledgeBase_${user.id}`, JSON.stringify(data))
      } catch (e) {
        console.error('保存知识库数据失败：存储空间已满', e)
      }
    }
  }

  // 保存共享知识库数据到localStorage
  const saveSharedKnowledgeBaseData = (data) => {
    if (user) {
      try {
        localStorage.setItem(`corvusNoteSharedKnowledgeBase_${user.id}`, JSON.stringify(data))
      } catch (e) {
        console.error('保存共享知识库数据失败：存储空间已满', e)
      }
    }
  }

  // 个人知识库数据状态 - 从后端加载
  const [personalKnowledgeBaseItems, setPersonalKnowledgeBaseItems] = useState([])
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false)

  // 从后端加载知识库列表
  const loadKnowledgeBasesFromBackend = async () => {
    if (!user || user.isGuest) return
    setLoadingKnowledgeBases(true)
    try {
      const kbs = await fetchKnowledgeBases()
      setPersonalKnowledgeBaseItems(kbs || [])
      setCurrentFolderContent(kbs || [])
    } catch (e) {
      console.error('加载知识库失败:', e)
    } finally {
      setLoadingKnowledgeBases(false)
    }
  }

  // 页面加载时从后端获取知识库
  React.useEffect(() => {
    if (user && !user.isGuest) {
      loadKnowledgeBasesFromBackend()
    }
  }, [user])
  // 共享知识库数据状态 - 使用嵌套结构
  const [sharedKnowledgeBaseItems, setSharedKnowledgeBaseItems] = useState(loadSharedKnowledgeBaseData())

  // 当前选中的文件夹
  const [selectedFolder, setSelectedFolder] = useState(null)
  // 当前路径
  const [currentPath, setCurrentPath] = useState([])
  // 当前文件夹内容
  const [currentFolderContent, setCurrentFolderContent] = useState([])
  // 当前查看的文档
  const [viewingDocument, setViewingDocument] = useState(null)
  // 正在加载的文件
  const [loadingFile, setLoadingFile] = useState(false)
  // 从IndexedDB获取的文件
  const [currentFile, setCurrentFile] = useState(null)
  // 菜单状态管理
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [activeMenuPosition, setActiveMenuPosition] = useState({ x: 0, y: 0 })
  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // 个人知识库折叠状态
  const [personalKnowledgeBaseExpanded, setPersonalKnowledgeBaseExpanded] = useState(true)
  // 共享知识库折叠状态
  const [sharedKnowledgeBaseExpanded, setSharedKnowledgeBaseExpanded] = useState(true)
  // 我创建的折叠状态
  const [myCreatedExpanded, setMyCreatedExpanded] = useState(true)
  // 我加入的折叠状态
  const [myJoinedExpanded, setMyJoinedExpanded] = useState(true)
  // 共享知识库详情状态
  const [activeView, setActiveView] = useState('personal') // personal 或 shared
  const [selectedSharedKnowledgeBase, setSelectedSharedKnowledgeBase] = useState(null)// 共享知识库内容
  const [sharedKnowledgeBaseContent, setSharedKnowledgeBaseContent] = useState([])
  
  // 分块设置状态
  const [showChunkSettings, setShowChunkSettings] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [strategyMode, setStrategyMode] = useState('auto')
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(50)
  const [topK, setTopK] = useState(3)
  const [scoreThreshold, setScoreThreshold] = useState(0.3)
  
  // 共享知识库内容
  const [selectedSharedFile, setSelectedSharedFile] = useState(null)
  // 激活的导航栏项
  const [activeNavItem, setActiveNavItem] = useState('personal') // personal 或 shared
  // 显示创建共享知识库模态框
  const [showCreateModal, setShowCreateModal] = useState(false)
  // 新知识库信息
  const [newKnowledgeBase, setNewKnowledgeBase] = useState({
    title: '', description: '', cover: '', category: '推荐', is_public: true
  })

  // ── 共享知识库 API 状态 ────────────────────────────────────
  const [selectedSharedKB, setSelectedSharedKB] = useState(null)
  const [sharedKBFiles, setSharedKBFiles] = useState([])
  const [sharedKBLoading, setSharedKBLoading] = useState(false)
  const [viewingSharedDoc, setViewingSharedDoc] = useState(null)
  const [sharedDocLoading, setSharedDocLoading] = useState(false)
  const [sharedUploading, setSharedUploading] = useState(false)
  // 共享知识库数据
  const [sharedKnowledgeBases, setSharedKnowledgeBases] = useState([])
  // 文档内容数据
  const fileContents = {
    'file1': `# 会话功能使用说明\n\n## 功能介绍\n会话功能允许您与AI进行实时对话，获取基于知识库内容的智能回答。\n\n## 使用步骤\n1. **选择知识库**：在共享知识库页面选择一个知识库\n2. **进入详情页**：点击知识库卡片进入详情页\n3. **开始对话**：在右侧输入框中输入您的问题\n4. **获取回答**：AI会基于知识库内容生成回答\n\n## 注意事项\n- 对话内容会基于当前选择的知识库内容\n- 您可以随时清空对话历史重新开始\n- 复杂问题可能需要更长的处理时间`,
    'file2': `# 知识库使用说明\n\n## 知识库介绍\n知识库是存储和管理文档的集合，您可以创建个人知识库或访问共享知识库。\n\n## 个人知识库\n1. **创建知识库**：点击"创建知识库"按钮\n2. **添加内容**：支持上传文件或添加文本内容\n3. **管理内容**：可以编辑、删除或重新组织内容\n4. **分享设置**：可以设置知识库的访问权限\n\n## 共享知识库\n1. **浏览发现**：在共享知识库页面浏览推荐的知识库\n2. **搜索查找**：使用搜索功能查找特定知识库\n3. **按分类筛选**：通过分类标签筛选感兴趣的知识库\n4. **加入知识库**：点击知识库卡片进入并使用\n\n## 最佳实践\n- 为知识库添加清晰的标题和描述\n- 合理组织文件结构，使用文件夹分类\n- 定期更新知识库内容以保持时效性`,
    'file3': `# 笔记功能使用说明\n\n## 功能介绍\n笔记功能允许您创建、编辑和管理个人笔记，支持Markdown格式。\n\n## 创建笔记\n1. **进入笔记页面**：点击左侧导航栏的笔记图标\n2. **新建笔记**：点击"新建笔记"按钮\n3. **编辑内容**：在编辑器中输入笔记内容\n4. **保存笔记**：系统会自动保存您的修改\n\n## 笔记管理\n1. **查看笔记**：在笔记列表中查看所有笔记\n2. **编辑笔记**：点击笔记卡片进入编辑模式\n3. **删除笔记**：点击删除按钮移除不需要的笔记\n4. **搜索笔记**：使用搜索功能查找特定笔记\n\n## Markdown支持\n- **标题**：使用 # 标记不同级别的标题\n- **列表**：使用 - 或数字创建列表\n- **链接**：使用 [文本](URL) 创建链接\n- **图片**：使用 ![描述](图片URL) 插入图片\n- **代码**：使用 \`\`\` 包围代码块\n\n## 快捷操作\n- **Ctrl+S**：手动保存笔记\n- **Ctrl+B**：加粗选中文本\n- **Ctrl+I**：斜体选中文本`
  }

  // 初始化当前文件夹内容
  React.useEffect(() => {
    setCurrentFolderContent(personalKnowledgeBaseItems)
  }, [])

  // 个人知识库和共享知识库数据均由后端管理，不再写入 localStorage

  // 从后端加载已创建和已加入的共享知识库（合并到同一状态，用 _role 字段区分）
  React.useEffect(() => {
    if (!user || user.isGuest) return
    Promise.all([fetchMyCreatedKBs(), fetchMyJoinedKBs()])
      .then(([created, joined]) => {
        const createdWithRole = (created || []).map(kb => ({ ...kb, _role: 'owner' }))
        const joinedWithRole  = (joined  || []).map(kb => ({ ...kb, _role: 'member' }))
        setSharedKnowledgeBases([...createdWithRole, ...joinedWithRole])
      })
      .catch(() => {})
  }, [user])

  // 处理返回首页
  const handleBackToHome = () => {
    onBackToHome()
  }

  // 处理导航到共享知识库
  const handleNavigateToSharedKnowledge = () => {
    onNavigateToSharedKnowledge()
  }

  // 处理创建共享知识库（调用 API）
  const handleCreateKnowledgeBase = async () => {
    if (!newKnowledgeBase.title.trim()) return
    try {
      const kb = await createSharedKB({
        name: newKnowledgeBase.title,
        description: newKnowledgeBase.description,
        category: newKnowledgeBase.category || '推荐',
        is_public: newKnowledgeBase.is_public !== false,
        cover: newKnowledgeBase.cover || '',
      })
      setShowCreateModal(false)
      setNewKnowledgeBase({ title: '', description: '', cover: '', category: '推荐', is_public: true })
      await refreshSharedSidebar()
      await loadSharedKBFromAPI(kb)
    } catch (e) {
      alert('创建失败: ' + e.message)
    }
  }

  // 处理表单输入变化（支持 checkbox）
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setNewKnowledgeBase(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  // ── 共享知识库 API 操作 ────────────────────────────────────

  // 刷新侧边栏共享KB列表
  const refreshSharedSidebar = async () => {
    try {
      const [created, joined] = await Promise.all([fetchMyCreatedKBs(), fetchMyJoinedKBs()])
      setSharedKnowledgeBases([
        ...(created || []).map(kb => ({ ...kb, _role: 'owner' })),
        ...(joined  || []).map(kb => ({ ...kb, _role: 'member' })),
      ])
    } catch (_) {}
  }

  // 点击侧边栏共享KB条目 → 在主内容区展开
  const loadSharedKBFromAPI = async (kb) => {
    setActiveView('shared')
    setActiveNavItem('shared')
    setSharedKBLoading(true)
    setSelectedSharedKB(null)
    setSharedKBFiles([])
    setViewingSharedDoc(null)
    try {
      const [detail, files] = await Promise.all([
        fetchSharedKBDetail(kb.id),
        fetchSharedKBFiles(kb.id),
      ])
      setSelectedSharedKB(detail)
      setSharedKBFiles(files || [])
    } catch (e) {
      alert('加载知识库失败: ' + e.message)
      setActiveView('personal')
    } finally {
      setSharedKBLoading(false)
    }
  }

  // 点击共享KB文件 → 拉取内容预览
  const handleSharedFileClick = async (file) => {
    setSharedDocLoading(true)
    setViewingSharedDoc({ name: file.name, file_type: file.file_type, content: null })
    try {
      const data = await fetchSharedKBFileContent(selectedSharedKB.id, file.id)
      setViewingSharedDoc(data)
    } catch (e) {
      alert('无法预览该文件: ' + e.message)
      setViewingSharedDoc(null)
    } finally {
      setSharedDocLoading(false)
    }
  }

  // 上传文件到共享KB
  const handleSharedUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !selectedSharedKB) return
    setSharedUploading(true)
    try {
      const result = await uploadToSharedKB(selectedSharedKB.id, file)
      setSharedKBFiles(prev => [...prev, result])
      setSelectedSharedKB(prev => ({ ...prev, file_count: (prev.file_count || 0) + 1 }))
    } catch (e) {
      alert('上传失败: ' + e.message)
    } finally {
      setSharedUploading(false)
      e.target.value = ''
    }
  }

  // 删除共享KB中的文件
  const handleSharedDeleteFile = async (file, e) => {
    e.stopPropagation()
    if (!window.confirm(`确定删除文件「${file.name}」？`)) return
    try {
      await deleteSharedKBFile(selectedSharedKB.id, file.id)
      setSharedKBFiles(prev => prev.filter(f => f.id !== file.id))
      setSelectedSharedKB(prev => ({ ...prev, file_count: Math.max(0, (prev.file_count || 1) - 1) }))
    } catch (e) {
      alert('删除失败: ' + e.message)
    }
  }

  // 删除整个共享知识库（仅创建者）
  const handleSharedDeleteKB = async () => {
    if (!selectedSharedKB || !window.confirm(`确定删除知识库「${selectedSharedKB.name}」？此操作不可恢复。`)) return
    try {
      await deleteSharedKB(selectedSharedKB.id)
      setSelectedSharedKB(null)
      setSharedKBFiles([])
      setActiveView('personal')
      setCurrentFolderContent(personalKnowledgeBaseItems)
      await refreshSharedSidebar()
    } catch (e) {
      alert('删除失败: ' + e.message)
    }
  }

  // 退出共享知识库（非创建者）
  const handleSharedQuitKB = async () => {
    if (!selectedSharedKB || !window.confirm(`确定退出知识库「${selectedSharedKB.name}」？`)) return
    try {
      await quitSharedKB(selectedSharedKB.id)
      setSelectedSharedKB(null)
      setSharedKBFiles([])
      setActiveView('personal')
      setCurrentFolderContent(personalKnowledgeBaseItems)
      await refreshSharedSidebar()
    } catch (e) {
      alert('退出失败: ' + e.message)
    }
  }

  // 处理返回上一级文件夹
  const handleBackToParent = () => {
    if (currentPath.length > 0) {
      const newPath = [...currentPath]
      newPath.pop()
      setCurrentPath(newPath)

      if (newPath.length === 0) {
        // 返回根目录
        setSelectedFolder(null)
        setCurrentFolderContent(activeView === 'personal' ? personalKnowledgeBaseItems : sharedKnowledgeBaseContent)
      } else {
        // 返回上一级文件夹
        const parentFolderId = newPath[newPath.length - 1]
        setSelectedFolder(parentFolderId)
        const parentFolder = findFolderById(activeView === 'personal' ? personalKnowledgeBaseItems : sharedKnowledgeBaseContent, parentFolderId)
        if (parentFolder) {
          setCurrentFolderContent(parentFolder.items || [])
        }
      }
    }
  }

  // 递归查找文件夹
  const findFolderById = (items, folderId) => {
    for (const item of items) {
      if (item.id === folderId && item.type === 'folder') {
        return item
      }
      if (item.type === 'folder' && item.items) {
        const found = findFolderById(item.items, folderId)
        if (found) {
          return found
        }
      }
    }
    return null
  }

  // 处理文件夹点击
  const handleFolderClick = (folderId) => {
    // 找到被点击的文件夹
    const folder = findFolderById(activeView === 'personal' ? personalKnowledgeBaseItems : sharedKnowledgeBaseContent, folderId)
    if (folder) {
      // 更新当前路径
      const newPath = [...currentPath, folderId]
      setCurrentPath(newPath)

      // 更新当前选中的文件夹
      setSelectedFolder(folderId)

      // 更新当前文件夹内容
      setCurrentFolderContent(folder.items || [])
    }
  }

  // 递归更新文件夹内容
  const updateFolderContent = (items, folderId, newContent) => {
    return items.map(item => {
      if (item.id === folderId && item.type === 'folder') {
        return {
          ...item,
          items: [...(item.items || []), ...newContent]
        }
      }
      if (item.type === 'folder' && item.items) {
        return {
          ...item,
          items: updateFolderContent(item.items, folderId, newContent)
        }
      }
      return item
    })
  }

  // 处理创建文件夹
  const handleCreateFolder = () => {
    // 检查是否在共享知识库模式下且未选择知识库
    if (activeView === 'shared' && !selectedSharedKnowledgeBase) {
      alert('请先选择一个共享知识库')
      return
    }

    const folderName = prompt('请输入文件夹名称:')
    if (folderName && folderName.trim()) {
      const newFolder = {
        id: Date.now().toString(),
        name: folderName.trim(),
        type: 'folder',
        items: [],
        createdAt: new Date().toISOString().split('T')[0],
        isExpanded: false
      }

      if (activeView === 'personal') {
        if (selectedFolder) {
          // 在当前��件夹中创建子文件夹
          const updatedItems = updateFolderContent(personalKnowledgeBaseItems, selectedFolder, [newFolder])
          setPersonalKnowledgeBaseItems(updatedItems)

          // 更新当前文件夹内容
          const updatedFolder = findFolderById(updatedItems, selectedFolder)
          setCurrentFolderContent(updatedFolder ? updatedFolder.items || [] : [])
        } else {
          // 在根目录创建文件夹
          const updatedContent = [newFolder, ...personalKnowledgeBaseItems]
          setPersonalKnowledgeBaseItems(updatedContent)
          setCurrentFolderContent(updatedContent)
        }
      } else {
        if (selectedFolder) {
          // 在当前文件夹中创建子文件夹
          const updatedItems = updateFolderContent(sharedKnowledgeBaseContent, selectedFolder, [newFolder])
          setSharedKnowledgeBaseContent(updatedItems)
          saveSharedKnowledgeBaseContent(selectedSharedKnowledgeBase.id, updatedItems)

          // 更新当前文件夹内容
          const updatedFolder = findFolderById(updatedItems, selectedFolder)
          setCurrentFolderContent(updatedFolder ? updatedFolder.items || [] : [])
        } else {
          // 在根目录创建文件夹
          const updatedContent = [newFolder, ...sharedKnowledgeBaseContent]
          setSharedKnowledgeBaseContent(updatedContent)
          saveSharedKnowledgeBaseContent(selectedSharedKnowledgeBase.id, updatedContent)
          setCurrentFolderContent(updatedContent)
        }
      }
    }
  }

  // 计算知识库中文件的总数
  const countTotalFiles = (items) => {
    let count = 0
    for (const item of items) {
      if (item.type === 'folder' && item.items) {
        count += countTotalFiles(item.items)
      } else if (item.type !== 'folder') {
        count += 1
      }
    }
    return count
  }

  // 处理文件选择
  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      setSelectedFiles(files)
      setShowChunkSettings(true)
    }
  }

  // 处理分块设置提交
  const handleChunkSettingsSubmit = async () => {
    if (selectedFiles.length === 0) {
      alert('请选择文件')
      return
    }

    try {
      // 处理所有文件
      const uploadedFiles = await Promise.all(selectedFiles.map(async (file) => {
        // 简化文件类型显示
        let simpleType = ''
        if (file.type === 'application/pdf') {
          simpleType = 'PDF文件'
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
          simpleType = 'Word文档'
        } else if (file.type === 'application/msword' || file.name.endsWith('.doc')) {
          simpleType = 'Word文档'
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          simpleType = '文本文件'
        } else if (file.type === 'text/markdown' || file.name.endsWith('.md')) {
          simpleType = 'Markdown文件'
        } else {
          simpleType = '文件'
        }

        // 根据文件类型读取内容用于预览
        let content = ''
        let htmlContent = ''

        // 文本文件直接读取
        if (file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          content = await file.text()
        }
        // Word文档处理
        else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                 file.name.endsWith('.docx') ||
                 file.type === 'application/msword' ||
                 file.name.endsWith('.doc')) {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const isDocFormat = file.type === 'application/msword' || file.name.endsWith('.doc')

            if (isDocFormat) {
              content = `${file.name} (DOC格式)`
              htmlContent = `# ${file.name}\n\n这是一个DOC格式的Word文档。\n\n由于DOC格式的限制，无法直接在线预览完整内容。建议您下载后使用Word软件查看。`
            } else {
              // 对于docx格式，使用mammoth转换为HTML
              const result = await mammoth.convertToHtml({ arrayBuffer })
              htmlContent = result.value
              content = file.name
            }
          } catch (error) {
            console.error('处理Word文档失败:', error)
            content = `${file.name} (转换失败)`
            htmlContent = `# ${file.name}\n\nWord文档转换失败，建议您下载后查看。`
          }
        }

        // 保存文件到IndexedDB
        const fileInfo = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          fileType: file.type,
          simpleType: simpleType,
          type: file.type.split('/')[1] || 'file',
          size: formatFileSize(file.size),
          createdAt: new Date().toISOString().split('T')[0],
          content: content || `# ${file.name}\n\n这是一个${simpleType}。`,
          htmlContent: htmlContent
        }

        await saveFileToDB(fileInfo.id, file)

        // 如果是个人知识库且非游客用户，上传到后端进行分块处理
        if (activeView === 'personal' && user && !user.isGuest && personalKnowledgeBaseItems.length > 0) {
          try {
            // 获取第一个知识库的ID（假设用户至少有一个知识库）
            const kbId = personalKnowledgeBaseItems[0].id || personalKnowledgeBaseItems[0]._id
            if (kbId) {
              const result = await uploadToKnowledgeBase(
                kbId, 
                file,
                strategyMode,
                strategyMode === 'manual' ? chunkSize : null,
                strategyMode === 'manual' ? chunkOverlap : null,
                strategyMode === 'manual' ? topK : null,
                strategyMode === 'manual' ? scoreThreshold : null
              )
              // 如果后端返回了文件信息，更新本地记录
              if (result && result.id) {
                fileInfo.id = result.id
                fileInfo.backendId = result.id
              }
            }
          } catch (error) {
            console.error('上传文件到后端失败:', error)
            // 继续使用本地记录，不阻塞上传流程
          }
        }

        return fileInfo
      }))
      
      if (activeView === 'personal') {
        if (selectedFolder) {
          // 在当前文件夹中上传文件
          const updatedItems = updateFolderContent(personalKnowledgeBaseItems, selectedFolder, uploadedFiles)
          setPersonalKnowledgeBaseItems(updatedItems)

          // 更新当前文件夹内容
          const updatedFolder = findFolderById(updatedItems, selectedFolder)
          setCurrentFolderContent(updatedFolder ? updatedFolder.items || [] : [])
        } else {
          // 在根目录上传文件
          const updatedContent = [...personalKnowledgeBaseItems, ...uploadedFiles]
          setPersonalKnowledgeBaseItems(updatedContent)
          setCurrentFolderContent(updatedContent)
        }
      } else {
        if (selectedFolder) {
          // 在当前文件夹中上传文件
          const updatedItems = updateFolderContent(sharedKnowledgeBaseContent, selectedFolder, uploadedFiles)
          setSharedKnowledgeBaseContent(updatedItems)
          saveSharedKnowledgeBaseContent(selectedSharedKnowledgeBase.id, updatedItems)

          // 更新当前文件夹内容
          const updatedFolder = findFolderById(updatedItems, selectedFolder)
          setCurrentFolderContent(updatedFolder ? updatedFolder.items || [] : [])
        } else {
          // 在根目录上传文件
          const updatedContent = [...sharedKnowledgeBaseContent, ...uploadedFiles]
          setSharedKnowledgeBaseContent(updatedContent)
          saveSharedKnowledgeBaseContent(selectedSharedKnowledgeBase.id, updatedContent)
          setCurrentFolderContent(updatedContent)
        }
      }

      // 关闭模态框
      setShowChunkSettings(false)
      setSelectedFiles([])
    } catch (error) {
      console.error('处理文件失败:', error)
      alert('文件处理失败，请重试')
    }
  }

  // 处理文件上传
  const handleFileUpload = (e) => {
    // 检查是否在共享知识库模式下且未选择知识库
    if (activeView === 'shared' && !selectedSharedKnowledgeBase) {
      alert('请先选择一个共享知识库')
      return
    }

    // 检查游客文件限制
    if (user.isGuest) {
      const currentFileCount = countTotalFiles(activeView === 'personal' ? personalKnowledgeBaseItems : sharedKnowledgeBaseContent)
      const totalAfterUpload = currentFileCount + e.target.files.length
      if (totalAfterUpload > 5) {
        if (window.confirm('游客用户最多只能上传5个文件。\n\n建议您注册账户以获得更多功能。\n\n是否跳转到注册页面？')) {
          // 跳转到注册页面的逻辑
          window.location.href = '/#register'
        }
        return
      }
    }

    // 触发文件选择处理
    handleFileInputChange(e)
  }

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 处理基于知识库提问
  const handleAskQuestion = () => {
    // 这里只是模拟提问功能，实际项目中需要实现基于知识库的提问逻辑
    alert('基于知识库提问功能开发中...')
  }

  // 处理查看文档
  const handleViewDocument = async (documentId) => {
    // 查找文档
    const findDocument = (items) => {
      for (const item of items) {
        if (item.id === documentId && item.type !== 'folder') {
          return item
        }
        if (item.type === 'folder' && item.items) {
          const found = findDocument(item.items)
          if (found) {
            return found
          }
        }
      }
      return null
    }

    const document = findDocument(activeView === 'personal' ? personalKnowledgeBaseItems : sharedKnowledgeBaseContent)
    if (document) {
      setViewingDocument(document)
      setLoadingFile(true)

      // 从IndexedDB获取文件
      const file = await getFileFromDB(document.id)
      setCurrentFile(file)
      setLoadingFile(false)
    }
  }

  // 处理关闭文档
  const handleCloseDocument = () => {
    setViewingDocument(null)
    setCurrentFile(null)
    setLoadingFile(false)
  }

  // 处理下载文档
  const handleDownloadDocument = async () => {
    if (currentFile && viewingDocument) {
      try {
        // 创建下载链接
        const url = URL.createObjectURL(currentFile)
        const a = window.document.createElement('a')
        a.href = url
        a.download = viewingDocument.name
        window.document.body.appendChild(a)
        a.click()
        window.document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('下载文件失败:', error)
        alert('下载文件失败，请重试。')
      }
    }
  }

  // 处理打开菜单
  const handleOpenMenu = (e, itemId) => {
    e.stopPropagation()
    setActiveMenuId(itemId)
    setActiveMenuPosition({ x: e.clientX, y: e.clientY })
  }

  // 处理关闭菜单
  const handleCloseMenu = () => {
    setActiveMenuId(null)
  }

  // 处理重命名
  const handleRenameItem = (itemId) => {
    const newName = prompt('请输入新名称:')
    if (newName && newName.trim()) {
      // 检查是否是共享知识库
      const knowledgeBaseIndex = sharedKnowledgeBases.findIndex(kb => kb.id === itemId)
      if (knowledgeBaseIndex !== -1) {
        // 重命名共享知识库
        const updatedKnowledgeBases = [...sharedKnowledgeBases]
        updatedKnowledgeBases[knowledgeBaseIndex] = {
          ...updatedKnowledgeBases[knowledgeBaseIndex],
          title: newName.trim()
        }
        setSharedKnowledgeBases(updatedKnowledgeBases)
        localStorage.setItem('corvusNoteSharedKnowledgeBases', JSON.stringify(updatedKnowledgeBases))
      } else {
        // 处��文��夹和文件的重命名
        const renameItem = (items) => {
          return items.map(item => {
            if (item.id === itemId) {
              return {
                ...item,
                name: newName.trim()
              }
            }
            if (item.type === 'folder' && item.items) {
              return {
                ...item,
                items: renameItem(item.items)
              }
            }
            return item
          })
        }

        if (activeView === 'personal') {
          const updatedItems = renameItem(personalKnowledgeBaseItems)
          setPersonalKnowledgeBaseItems(updatedItems)

          // 更新当前文件夹内容
          if (selectedFolder) {
            const parentFolder = findFolderById(updatedItems, selectedFolder)
            setCurrentFolderContent(parentFolder ? parentFolder.items || [] : [])
          } else {
            setCurrentFolderContent(updatedItems)
          }
        } else {
          const updatedItems = renameItem(sharedKnowledgeBaseContent)
          setSharedKnowledgeBaseContent(updatedItems)
          saveSharedKnowledgeBaseContent(selectedSharedKnowledgeBase.id, updatedItems)

          // 更新当前文件夹内容
          if (selectedFolder) {
            const parentFolder = findFolderById(updatedItems, selectedFolder)
            setCurrentFolderContent(parentFolder ? parentFolder.items || [] : [])
          } else {
            setCurrentFolderContent(updatedItems)
          }
        }
      }
    }
    setActiveMenuId(null)
  }

  // 处理删除
  const handleDeleteItem = (itemId) => {
    if (window.confirm('确定要删除这个项目吗？')) {
      // 检查是否是共享知识库
      const knowledgeBaseIndex = sharedKnowledgeBases.findIndex(kb => kb.id === itemId)
      if (knowledgeBaseIndex !== -1) {
        // 删除共享知识库
        const updatedKnowledgeBases = sharedKnowledgeBases.filter(kb => kb.id !== itemId)
        setSharedKnowledgeBases(updatedKnowledgeBases)
        localStorage.setItem('corvusNoteSharedKnowledgeBases', JSON.stringify(updatedKnowledgeBases))

        // 如果当前正在查看被删除的知识库，返回共享知识库列表
        if (selectedSharedKnowledgeBase && selectedSharedKnowledgeBase.id === itemId) {
          setSelectedSharedKnowledgeBase(null)
          setSharedKnowledgeBaseContent([])
          setCurrentFolderContent(sharedKnowledgeBaseItems)
        }
      } else {
        // 处理文件夹和文件的删除
        const deleteItem = (items) => {
          return items.filter(item => {
            if (item.id === itemId) {
              return false
            }
            if (item.type === 'folder' && item.items) {
              item.items = deleteItem(item.items)
            }
            return true
          })
        }

        if (activeView === 'personal') {
          const updatedItems = deleteItem(personalKnowledgeBaseItems)
          setPersonalKnowledgeBaseItems(updatedItems)

          // 更新当前文件夹内容
          if (selectedFolder) {
            const parentFolder = findFolderById(updatedItems, selectedFolder)
            setCurrentFolderContent(parentFolder ? parentFolder.items || [] : [])
          } else {
            setCurrentFolderContent(updatedItems)
          }
        } else {
          const updatedItems = deleteItem(sharedKnowledgeBaseContent)
          setSharedKnowledgeBaseContent(updatedItems)
          saveSharedKnowledgeBaseContent(selectedSharedKnowledgeBase.id, updatedItems)

          // 更新当前文件夹内容
          if (selectedFolder) {
            const parentFolder = findFolderById(updatedItems, selectedFolder)
            setCurrentFolderContent(parentFolder ? parentFolder.items || [] : [])
          } else {
            setCurrentFolderContent(updatedItems)
          }
        }
      }
    }
    setActiveMenuId(null)
  }

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null)
    }

    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [])

  return (
    <div className="knowledge-base-page">
      {/* 左侧折叠导航栏 */}
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {sidebarCollapsed ? (
          <div className="sidebar-collapsed">
            <div
              className="sidebar-logo-collapsed"
              onClick={handleBackToHome}
            >
              <div className="raven-icon-small"></div>
            </div>
            <button
              className="collapse-btn expand"
              onClick={() => setSidebarCollapsed(false)}
              title="展开侧边栏"
            >
              <svg t="1770616512859" className="icon rotate-180" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3452" width="24" height="24"><path d="M296.476444 468.622222c10.723556 0.028444 20.963556 4.664889 28.558223 12.885334l431.047111 468.622222a46.734222 46.734222 0 0 1-0.995556 61.013333 38.115556 38.115556 0 0 1-56.120889 1.052445L267.918222 543.601778A45.624889 45.624889 0 0 1 256 512.540444c0-11.662222 4.295111-22.840889 11.946667-31.032888a39.111111 39.111111 0 0 1 28.529777-12.885334zM727.523556 0c10.695111 0.028444 20.963556 4.664889 28.558222 12.885333 7.623111 8.192 11.918222 19.370667 11.918222 31.061334 0 11.662222-4.295111 22.840889-11.946667 31.032889L325.063111 543.601778a38.115556 38.115556 0 0 1-56.120889-1.080889 46.734222 46.734222 0 0 1-0.995555-61.013333L698.965333 12.885333A39.111111 39.111111 0 0 1 727.523556 0z" fill="#000000" p-id="3453"></path></svg>
            </button>
          </div>
        ) : (
          <>
            <div className="sidebar-header">
              <div
                className="sidebar-logo"
                onClick={handleBackToHome}
              >
                <div className="raven-icon-large"></div>
                <h2>Corvus Note</h2>
              </div>
              <button
                className="collapse-btn"
                onClick={() => setSidebarCollapsed(true)}
                title="折叠侧边栏"
              >
                <svg t="1770616512859" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3452" width="24" height="24"><path d="M296.476444 468.622222c10.723556 0.028444 20.963556 4.664889 28.558223 12.885334l431.047111 468.622222a46.734222 46.734222 0 0 1-0.995556 61.013333 38.115556 38.115556 0 0 1-56.120889 1.052445L267.918222 543.601778A45.624889 45.624889 0 0 1 256 512.540444c0-11.662222 4.295111-22.840889 11.946667-31.032888a39.111111 39.111111 0 0 1 28.529777-12.885334zM727.523556 0c10.695111 0.028444 20.963556 4.664889 28.558222 12.885333 7.623111 8.192 11.918222 19.370667 11.918222 31.061334 0 11.662222-4.295111 22.840889-11.946667 31.032889L325.063111 543.601778a38.115556 38.115556 0 0 1-56.120889-1.080889 46.734222 46.734222 0 0 1-0.995555-61.013333L698.965333 12.885333A39.111111 39.111111 0 0 1 727.523556 0z" fill="#000000" p-id="3453"></path></svg>
              </button>
            </div>

            <div className="conversations-list">
              {/* 个人知识库 */}
              <div className="knowledge-base-section">
                <div
                  className={`section-header ${activeNavItem === 'personal' ? 'active' : ''}`}
                  onClick={() => {
                    if (activeNavItem !== 'personal') {
                      // 第一次点击：切换到个人知识库
                      setActiveNavItem('personal')
                      setActiveView('personal')
                      setPersonalKnowledgeBaseExpanded(true)
                      setCurrentPath([])
                      setSelectedFolder(null)
                      setCurrentFolderContent(personalKnowledgeBaseItems)
                    } else {
                      // 再次点击：展开/折叠
                      setPersonalKnowledgeBaseExpanded(!personalKnowledgeBaseExpanded)
                    }
                  }}
                >
                  <div className="section-title">
                    <svg t="1770436337616" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6633" width="20" height="20"><path d="M139.661795 93.098382c-25.742144 0-46.563413 20.82127-46.563413 46.534969v651.631787c0 25.713699 20.82127 46.534969 46.534969 46.534969h176.355017c45.937637 0 90.851278 13.624847 129.080494 39.110991L511.998436 921.511851l66.929573-44.600753a232.731733 232.731733 0 0 1 129.023606-39.110991h176.411905c25.713699 0 46.534969-20.82127 46.534969-46.534969V139.633351c0-25.713699-20.82127-46.534969-46.534969-46.534969h-176.355017c-19.342163 0-48.753629 8.362641-73.557108 22.812375-12.003519 6.968868-20.650604 14.079957-25.770588 19.996383a26.168809 26.168809 0 0 0-3.726211 5.262206v556.99741a46.534969 46.534969 0 0 1-93.098382 0V139.661795c0-26.993695 12.942183-49.066517 26.396364-64.597135a194.929182 194.929182 0 0 1 49.493182-39.651435C623.016763 14.904843 668.442402 0 707.980059 0h176.355017A139.661795 139.661795 0 0 1 1023.996871 139.661795v651.603343a139.661795 139.661795 0 0 1-139.661795 139.661795h-176.355017a139.661795 139.661795 0 0 0-77.425541 23.438151l-92.728606 61.809589a46.534969 46.534969 0 0 1-51.654953 0l-92.728606-61.809589a139.661795 139.661795 0 0 0-77.453985-23.466595h-176.355017A139.661795 139.661795 0 0 1 0 791.265138V139.633351A139.661795 139.661795 0 0 1 139.661795 0h176.355017c45.909193 0 90.822834 13.624847 129.05205 39.110992a46.534969 46.534969 0 0 1-51.626509 77.425541 139.661795 139.661795 0 0 0-77.453985-23.438151h-176.355017z" fill="currentColor" p-id="6634"></path><path d="M170.666145 360.304677C170.666145 334.135868 191.032305 312.887933 216.177117 312.887933h136.532916c25.144812 0 45.510972 21.219491 45.510972 47.416744 0 26.168809-20.36616 47.388299-45.510972 47.388299H216.177117c-25.144812 0-45.510972-21.219491-45.510972-47.388299z m45.510972 189.610087c0-12.572406 4.807096-24.632814 13.340404-33.507453 8.533307-8.903084 20.110161-13.880846 32.170568-13.880846h91.021944c25.144812 0 45.510972 21.219491 45.510972 47.416744 0 26.168809-20.36616 47.388299-45.510972 47.388299h-91.021944c-12.060407 0-23.63726-4.977762-32.170568-13.880846a45.543422 45.543422 0 0 1-13.340404-33.507453z" fill="currentColor" p-id="6635"></path></svg>
                    个人知识库
                  </div>
                  <div className="section-toggle">
                    {personalKnowledgeBaseExpanded ? '▼' : '▶'}
                  </div>
                </div>
                {personalKnowledgeBaseExpanded && (
                  <div className="section-content">
                    {/* 递归显示所有文件夹 */}
                    {(() => {
                      const renderFolders = (items, depth = 0) => {
                        return items
                          .filter(item => item.type === 'folder')
                          .map(item => (
                            <div key={item.id} style={{ marginLeft: `${depth * 20}px` }}>
                              <div
                                className={`knowledge-base-item ${selectedFolder === item.id ? 'active' : ''}`}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <span
                                  className="knowledge-base-name"
                                  onClick={() => handleFolderClick(item.id)}
                                >
                                  {item.name}
                                </span>
                                <button
                                  className="menu-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(item.id);
                                    setActiveMenuPosition({ x: e.clientX, y: e.clientY });
                                  }}
                                  title="更多操作"
                                >
                                  ...
                                </button>
                              </div>
                              {item.items && renderFolders(item.items, depth + 1)}
                            </div>
                          ))
                      }
                      return renderFolders(personalKnowledgeBaseItems)
                    })()}
                  </div>
                )}
              </div>

              {/* 共享知识库 */}
              <div className="knowledge-base-section">
                <div
                  className={`section-header ${activeNavItem === 'shared' ? 'active' : ''}`}
                  onClick={() => {
                    if (activeNavItem !== 'shared') {
                      // 第一次点击：切换到共享知识库
                      setActiveNavItem('shared')
                      setActiveView('shared')
                      setSharedKnowledgeBaseExpanded(true)
                      setCurrentPath([])
                      setSelectedFolder(null)
                      setCurrentFolderContent(sharedKnowledgeBaseItems)
                    } else {
                      // 再次点击：展开/折叠
                      setSharedKnowledgeBaseExpanded(!sharedKnowledgeBaseExpanded)
                    }
                  }}
                >
                  <div className="section-title">
                    <svg t="1771390575485" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4850" width="20" height="20"><path d="M424.760889 122.737778c-83.143111 0-164.977778 87.125333-164.977778 212.167111 0 23.381333 10.097778 50.432 27.733333 80.128 14.449778 24.376889 31.374222 46.506667 47.075556 66.958222l9.898667 13.084445c14.620444 19.2 25.827556 42.325333 25.116444 68.551111-0.682667 27.306667-13.994667 48.583111-29.354667 63.914666-10.666667 10.638222-24.234667 19.143111-36.778666 26.168889-12.714667 7.196444-28.330667 14.990222-45.340445 23.466667l-0.853333 0.483555c-35.157333 17.578667-80.924444 40.448-138.24 74.865778-18.005333 10.837333-24.234667 27.192889-24.234667 77.397334 0 11.605333 4.266667 20.650667 17.692445 30.321777 15.303111 11.093333 40.334222 20.707556 75.178666 27.676445 69.290667 13.937778 158.606222 14.193778 236.202667 12.743111l21.959111-0.398222c68.920889-1.166222 142.08-2.389333 200.561778-14.421334 32.341333-6.599111 54.954667-15.616 68.579556-25.884444 11.52-8.618667 16.128-17.351111 16.184888-30.264889a148.195556 148.195556 0 0 0-9.244444-48.184889c-6.599111-18.090667-14.392889-28.245333-19.057778-31.715555-43.178667-32.426667-86.812444-54.357333-124.046222-71.537778-6.456889-3.015111-13.084444-5.973333-19.655111-8.96-10.382222-4.608-20.679111-9.386667-30.919111-14.279111-13.112889-6.4-30.321778-15.274667-42.524445-27.477334-15.36-15.36-28.672-36.579556-29.354666-63.886222-0.711111-26.254222 10.524444-49.379556 25.059555-68.608l9.955556-12.999111c15.701333-20.508444 32.625778-42.638222 47.075555-66.958222 17.635556-29.752889 27.733333-56.803556 27.733334-80.213334 0-63.544889-15.985778-118.414222-41.813334-155.932444-25.031111-36.494222-58.595556-56.206222-99.612444-56.206222zM165.518222 334.904889C165.518222 177.038222 272.184889 28.444444 424.760889 28.444444c76.828444 0 137.557333 39.224889 177.294222 97.024C641.109333 182.243556 660.451556 257.024 660.451556 334.904889c0 48.327111-19.996444 92.956444-40.903112 128.284444-17.607111 29.696-38.684444 57.031111-54.357333 77.539556l-8.533333 11.178667c-1.991111 2.503111-3.697778 5.176889-5.176889 8.021333l1.080889 1.024c1.024 0.711111 5.404444 3.697778 16.952889 9.244444 7.879111 3.868444 16.469333 7.736889 26.510222 12.259556l22.328889 10.183111c39.367111 18.204444 90.026667 43.377778 141.084444 81.720889 25.685333 19.285333 41.614222 49.123556 51.000889 74.723555 9.699556 26.595556 15.075556 55.921778 14.990222 81.066667-0.227556 46.023111-21.788444 81.152-53.816889 105.244445-29.980444 22.471111-68.465778 35.072-106.268444 42.808888-67.726222 13.937778-150.215111 15.274667-217.372444 16.355556l-22.272 0.398222c-76.686222 1.422222-175.786667 1.706667-256.597334-14.592-40.163556-8.049778-80.469333-21.105778-111.701333-43.633778C24.120889 912.782222 0.540444 877.283556 0.540444 829.923556c0-48.924444 3.072-118.101333 70.058667-158.264889 60.416-36.295111 108.885333-60.529778 144.355556-78.250667l0.199111-0.113778a1089.706667 1089.706667 0 0 0 42.126222-21.76c11.093333-6.257778 15.189333-9.528889 16.327111-10.666666l0.881778-0.938667a50.460444 50.460444 0 0 0-5.176889-8.021333l-8.533333-11.178667c-15.729778-20.48-36.750222-47.843556-54.328889-77.539556-20.935111-35.328-40.931556-79.957333-40.931556-128.284444z" fill="currentColor" p-id="4851"></path><path d="M655.957333 123.733333c2.816-12.231111 10.24-22.897778 20.679111-29.525333a45.226667 45.226667 0 0 1 34.929778-5.888c48.526222 11.633778 93.013333 35.726222 125.240889 75.804444 32.483556 40.391111 49.265778 92.956444 49.265778 155.192889 0 74.069333-18.403556 123.562667-56.433778 172.259556a19.399111 19.399111 0 0 0-2.446222 6.087111a52.906667 52.906667 0 0 0 0.170667 26.595556c6.656 6.087111 17.863111 15.018667 32.853333 26.936888l22.016 17.692445c26.368 21.219556 57.543111 47.217778 82.801778 73.159111 32.682667 33.564444 59.790222 92.216889 59.505777 155.818667-0.426667 79.559111-69.404444 139.093333-138.467555 139.093333a46.051556 46.051556 0 0 1-40.078222-23.779556a48.64 48.64 0 0 1 0-47.502222c8.277333-14.705778 23.552-23.751111 40.106666-23.751111 23.381333 0 45.795556-22.471111 45.909334-44.487111 0.199111-37.888-16.924444-72.334222-32.369778-88.206222-21.020444-21.589333-48.412444-44.515556-74.496-65.564445l-17.436445-13.966222c-18.488889-14.734222-36.124444-28.842667-45.880888-38.257778a91.278222 91.278222 0 0 1-22.670223-38.570666c-3.896889-12.8-5.973333-26.168889-6.115555-39.594667-0.369778-24.888889 5.262222-56.661333 24.433778-81.180444 24.519111-31.345778 36.067556-59.761778 36.067555-112.782223 0-44.202667-11.662222-74.24-28.074667-94.663111-16.64-20.707556-41.642667-35.811556-74.951111-43.832889-11.946667-2.844444-22.300444-10.496-28.785777-21.191111-6.456889-10.695111-8.533333-23.608889-5.774223-35.868444z m172.999111 402.915556l-0.256-0.398222 0.284445 0.398222z" fill="currentColor" p-id="4852"></path></svg>
                    共享知识库
                  </div>
                  <div className="section-toggle">
                    {sharedKnowledgeBaseExpanded ? '▼' : '▶'}
                  </div>
                </div>
                {sharedKnowledgeBaseExpanded && (
                  <div className="section-content">
                    {/* 我创建的 */}
                    <div className="sub-section">
                      <div
                        className="sub-section-header"
                      >
                        <span
                          className="sub-section-title"
                          onClick={() => setMyCreatedExpanded(!myCreatedExpanded)}
                        >
                          我创建的
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            className="create-kb-btn-small"
                            onClick={() => setShowCreateModal(true)}
                            title="创建共享知识库"
                          >
                            <svg t="1776586373568" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3174" width="14" height="14"><path d="M512 76.8c240.355556 0 435.2 194.844444 435.2 435.2 0 240.355556-194.844444 435.2-435.2 435.2-240.355556 0-435.2-194.844444-435.2-435.2C76.8 271.644444 271.644444 76.8 512 76.8zM512 0C229.233778 0 0 229.233778 0 512s229.233778 512 512 512 512-229.233778 512-512S794.766222 0 512 0z m0 307.2a38.4 38.4 0 0 0-38.4 38.4v332.8a38.4 38.4 0 0 0 76.8 0v-332.8A38.4 38.4 0 0 0 512 307.2z m166.4 166.4h-332.8a38.4 38.4 0 0 0 0 76.8h332.8a38.4 38.4 0 0 0 0-76.8z" fill="#666666" p-id="3175"></path></svg>
                          </button>
                          <span
                            className="sub-section-toggle"
                            onClick={() => setMyCreatedExpanded(!myCreatedExpanded)}
                          >
                            {myCreatedExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                      {myCreatedExpanded && (
                        <div className="sub-section-content">
                          {sharedKnowledgeBases.filter(kb => kb._role === 'owner').length > 0 ? (
                            sharedKnowledgeBases.filter(kb => kb._role === 'owner').map(kb => (
                              <div
                                key={kb.id}
                                className={`knowledge-base-item ${selectedSharedKB?.id === kb.id ? 'active' : ''}`}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <span
                                  className="knowledge-base-name"
                                  onClick={() => loadSharedKBFromAPI(kb)}
                                  title={kb.name}
                                >
                                  {kb.name}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="knowledge-base-item">
                              <span className="knowledge-base-name" style={{ color: '#999', fontSize: 12 }}>暂无创建的知识库</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 我加入的 */}
                    <div className="sub-section">
                      <div
                        className="sub-section-header"
                        onClick={() => setMyJoinedExpanded(!myJoinedExpanded)}
                      >
                        <span className="sub-section-title">我加入的</span>
                        <span className="sub-section-toggle">
                          {myJoinedExpanded ? '▼' : '▶'}
                        </span>
                      </div>
                      {myJoinedExpanded && (
                        <div className="sub-section-content">
                          {sharedKnowledgeBases.filter(kb => kb._role === 'member').length > 0 ? (
                            sharedKnowledgeBases.filter(kb => kb._role === 'member').map(kb => (
                              <div
                                key={kb.id}
                                className={`knowledge-base-item ${selectedSharedKB?.id === kb.id ? 'active' : ''}`}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <span
                                  className="knowledge-base-name"
                                  onClick={() => loadSharedKBFromAPI(kb)}
                                  title={kb.name}
                                >
                                  {kb.name}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="knowledge-base-item">
                              <span className="knowledge-base-name" style={{ color: '#999', fontSize: 12 }}>
                                暂无加入的知识库，去<span style={{ color: '#1890ff', cursor: 'pointer' }} onClick={() => onNavigateToSharedKnowledge()}>广场</span>逛逛
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 主内容区 */}
      <div className="main-content">
        {/* 页面头部 */}
        <div className="page-header">
          <div className="header-left">
            <h1 className="page-title">
              {activeView === 'personal' ? '个人知识库' : '发现'}
            </h1>
          </div>
          <div className="page-actions">
            {/* 用户信息 */}
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

        {/* 根据activeView显示不同内容 */}
        {activeView === 'personal' ? (
          /* 个人知识库内容 */
          <div className="folder-structure">
            {/* 面包屑导航 */}
            <div className="breadcrumb">
              {activeView === 'personal' ? (
                <>
                  <span
                    className="breadcrumb-item"
                    onClick={() => {
                      setCurrentPath([])
                      setSelectedFolder(null)
                      setCurrentFolderContent(personalKnowledgeBaseItems)
                    }}
                  >
                    个人知识库
                  </span>
                  {currentPath.map((folderId, index) => {
                    const folder = findFolderById(personalKnowledgeBaseItems, folderId)
                    return (
                      <>
                        <span className="breadcrumb-separator">/</span>
                        <span
                          key={folderId}
                          className="breadcrumb-item"
                          onClick={() => {
                            const newPath = currentPath.slice(0, index + 1)
                            setCurrentPath(newPath)
                            setSelectedFolder(folderId)
                            const folder = findFolderById(personalKnowledgeBaseItems, folderId)
                            setCurrentFolderContent(folder.items || [])
                          }}
                        >
                          {folder?.name || '未知文件夹'}
                        </span>
                      </>
                    )
                  })}
                </>
              ) : (
                <span className="breadcrumb-item">共享知识库</span>
              )}
            </div>

            <div className="folder-section">
              <div className="section-header">
                <div className="section-title-wrapper">
                  {currentPath.length > 0 && (
                    <div className="section-title">
                      {selectedFolder ?
                        findFolderById(activeView === 'personal' ? personalKnowledgeBaseItems : sharedKnowledgeBaseItems, selectedFolder)?.name || (activeView === 'personal' ? '个人知识库' : '共享知识库') :
                        (activeView === 'personal' ? '个人知识库' : '共享知识库')}
                    </div>
                  )}
                </div>
                {activeView === 'personal' && (
                  <div className="section-actions">
                    {/* 新建文件夹按钮 */}
                    <div className="action-btn" onClick={handleCreateFolder}>
                      <span className="action-icon">
                        <svg t="1770884310333" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6319" width="16" height="16"><path d="M896 967.111111h-768C57.315556 967.111111 0 908.885333 0 837.091556V186.88C0 115.114667 57.315556 56.888889 128 56.888889h183.466667A127.857778 127.857778 0 0 1 426.666667 130.56l26.453333 56.348444H896c70.684444 0 128 58.225778 128 130.048v520.135112C1024 908.885333 966.684444 967.111111 896 967.111111zM85.333333 437.447111v399.644445c0 23.921778 19.114667 43.320889 42.666667 43.320888h768c23.552 0 42.666667-19.399111 42.666667-43.320888v-399.644445H85.333333z m0-86.698667h853.333334v-33.792c0-23.950222-19.114667-43.349333-42.666667-43.349333H426.666667a42.609778 42.609778 0 0 1-38.4-24.718222l-37.973334-80.611556a42.609778 42.609778 0 0 0-38.826666-24.689777H128c-23.552 0-42.666667 19.399111-42.666667 43.320888v163.84z" fill="#000000" p-id="6320"></path></svg>
                      </span> 新建文件夹
                    </div>
                    {/* 上传文件按钮 */}
                    <label className="action-btn upload-btn">
                      <span className="action-icon">
                        <svg t="1770884351475" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6472" width="16" height="16"><path d="M924.444444 1024h-796.444444C73.016889 1024 28.444444 978.147556 28.444444 921.6v-117.020444c0-24.234667 19.114667-43.889778 42.666667-43.889778s42.666667 19.626667 42.666667 43.889778V921.6c0 8.078222 6.371556 14.620444 14.222222 14.620444h796.444444c7.850667 0 14.222222-6.542222 14.222223-14.620444v-117.020444c0-24.234667 19.114667-43.889778 42.666666-43.889778s42.666667 19.626667 42.666667 43.889778V921.6c0 56.547556-44.572444 102.4-99.555556 102.4z m-398.222222-948.821333c11.406222 0 22.357333 4.721778 30.378667 13.084444 8.021333 8.334222 12.430222 19.655111 12.288 31.402667v585.130666c0 24.234667-19.114667 43.889778-42.666667 43.889778s-42.666667-19.626667-42.666666-43.889778V119.665778c-0.142222-11.747556 4.266667-23.04 12.288-31.402667a42.097778 42.097778 0 0 1 30.378666-13.084444zM526.222222 0a42.382222 42.382222 0 0 1 30.151111 12.885333l284.444445 292.551111c8.049778 8.192 12.600889 19.342222 12.600889 31.004445 0 11.662222-4.551111 22.840889-12.600889 31.004444a42.097778 42.097778 0 0 1-60.302222 0l-284.444445-292.551111a44.231111 44.231111 0 0 1-12.600889-31.004445c0-11.662222 4.551111-22.812444 12.600889-31.004445A42.382222 42.382222 0 0 1 526.222222 0z m0 0a42.382222 42.382222 0 0 1 30.151111 12.885333c8.049778 8.192 12.600889 19.342222 12.600889 31.004445 0 11.662222-4.551111 22.812444-12.600889 31.004444l-284.444444 292.579556a42.097778 42.097778 0 0 1-60.302222 0 44.231111 44.231111 0 0 1-12.600889-31.004445c0-11.662222 4.551111-22.840889 12.600889-31.004444l284.444444-292.579556A42.382222 42.382222 0 0 1 526.222222 0z" fill="#000000" p-id="6473"></path></svg>
                      </span> 上传文件
                      <input
                        type="file"
                        className="file-input"
                        multiple
                        onChange={handleFileUpload}
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="folder-items">
                {/* 现有文件夹和文件 */}
                {currentFolderContent.length > 0 ? (
                  currentFolderContent.map(item => (
                    <div
                    key={item.id}
                    className={`folder-item ${item.type === 'folder' ? 'folder' : 'file'} ${selectedFolder === item.id ? 'selected' : ''}`}
                    onClick={() => {
                      if (item.type === 'folder') {
                        handleFolderClick(item.id)
                      } else {
                        handleViewDocument(item.id)
                      }
                    }}
                  >
                    <span className={`folder-icon ${item.type}`}>
                      {item.type === 'folder' ? (
                        <svg t="1772755763302" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3586" width="20" height="20">
                          <path d="M896 967.111111h-768C57.315556 967.111111 0 908.885333 0 837.091556V186.88C0 115.114667 57.315556 56.888889 128 56.888889h183.466667A127.857778 127.857778 0 0 1 426.666667 130.56l26.453333 56.348444H896c70.684444 0 128 58.225778 128 130.048v520.135112C1024 908.885333 966.684444 967.111111 896 967.111111zM85.333333 437.447111v399.644445c0 23.921778 19.114667 43.320889 42.666667 43.320888h768c23.552 0 42.666667-19.399111 42.666667-43.320888v-399.644445H85.333333z m0-86.698667h853.333334v-33.792c0-23.950222-19.114667-43.349333-42.666667-43.349333H426.666667a42.609778 42.609778 0 0 1-38.4-24.718222l-37.973334-80.611556a42.609778 42.609778 0 0 0-38.826666-24.689777H128c-23.552 0-42.666667 19.399111-42.666667 43.320888v163.84z" fill="#000000" p-id="3587"></path>
                        </svg>
                      ) : item.type === 'pdf' ? '📄' : item.type === 'word' ? '📝' : '📄'}
                    </span>
                    <span className="folder-name">{item.name}</span>
                    {item.type === 'folder' && (
                      <span className="folder-count">{item.items?.length || 0} 个项目</span>
                    )}
                    {item.type !== 'folder' && (
                      <span className="file-size">{item.size}</span>
                    )}
                    {/* 菜单按钮 */}
                    <div className="item-menu">
                      <button
                        className="menu-btn"
                        onClick={(e) => handleOpenMenu(e, item.id)}
                      >
                        ⋮
                      </button>
                    </div>
                  </div>
                  ))
                ) : (
                  <div className="empty-folder">
                    <div className="empty-icon">
                      <svg t="1772755763302" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3586" width="48" height="48">
                        <path d="M896 967.111111h-768C57.315556 967.111111 0 908.885333 0 837.091556V186.88C0 115.114667 57.315556 56.888889 128 56.888889h183.466667A127.857778 127.857778 0 0 1 426.666667 130.56l26.453333 56.348444H896c70.684444 0 128 58.225778 128 130.048v520.135112C1024 908.885333 966.684444 967.111111 896 967.111111zM85.333333 437.447111v399.644445c0 23.921778 19.114667 43.320889 42.666667 43.320888h768c23.552 0 42.666667-19.399111 42.666667-43.320888v-399.644445H85.333333z m0-86.698667h853.333334v-33.792c0-23.950222-19.114667-43.349333-42.666667-43.349333H426.666667a42.609778 42.609778 0 0 1-38.4-24.718222l-37.973334-80.611556a42.609778 42.609778 0 0 0-38.826666-24.689777H128c-23.552 0-42.666667 19.399111-42.666667 43.320888v163.84z" fill="#000000" p-id="3587"></path>
                      </svg>
                    </div>
                    <div className="empty-text">当前文件夹内容为空</div>
                    <div className="empty-hint">点击上方按钮新建文件夹或上传文件</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* 共享知识库详情 - API 驱动 */
          <div className="folder-structure">
            <div className="breadcrumb">
              <span className="breadcrumb-item">
                共享知识库{selectedSharedKB ? ` / ${selectedSharedKB.name}` : ''}
              </span>
            </div>

            {sharedKBLoading ? (
              <div className="loading-container" style={{ margin: '80px auto' }}>
                <div className="loading-spinner"></div>
                <p className="loading-text">加载中...</p>
              </div>
            ) : selectedSharedKB ? (
              <>
                {/* KB 信息头部 */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    {selectedSharedKB.cover ? (
                      <img src={selectedSharedKB.cover} alt="" style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 52, height: 52, borderRadius: 8, flexShrink: 0, background: `hsl(${(selectedSharedKB.name?.charCodeAt(0)||0)*137%360},55%,55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
                        {selectedSharedKB.name?.[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>{selectedSharedKB.name}</span>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: selectedSharedKB.is_public ? '#e6f4ff' : '#f5f5f5', color: selectedSharedKB.is_public ? '#1890ff' : '#999' }}>
                          {selectedSharedKB.is_public ? '公开' : '私有'}
                        </span>
                        <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 4, background: '#f0f5ff', color: '#597ef7' }}>{selectedSharedKB.category}</span>
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedSharedKB.description || '暂无简介'}
                      </p>
                      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#999' }}>
                        <span>@{selectedSharedKB.owner_name}</span>
                        <span>{selectedSharedKB.member_count ?? 0} 成员</span>
                        <span>{selectedSharedKB.file_count ?? 0} 个文件</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <label className="action-btn upload-btn" style={{ cursor: sharedUploading ? 'wait' : 'pointer', opacity: sharedUploading ? 0.6 : 1 }}>
                        <span className="action-icon">
                          <svg t="1770884351475" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6472" width="16" height="16"><path d="M924.444444 1024h-796.444444C73.016889 1024 28.444444 978.147556 28.444444 921.6v-117.020444c0-24.234667 19.114667-43.889778 42.666667-43.889778s42.666667 19.626667 42.666667 43.889778V921.6c0 8.078222 6.371556 14.620444 14.222222 14.620444h796.444444c7.850667 0 14.222222-6.542222 14.222223-14.620444v-117.020444c0-24.234667 19.114667-43.889778 42.666666-43.889778s42.666667 19.626667 42.666667 43.889778V921.6c0 56.547556-44.572444 102.4-99.555556 102.4z m-398.222222-948.821333c11.406222 0 22.357333 4.721778 30.378667 13.084444 8.021333 8.334222 12.430222 19.655111 12.288 31.402667v585.130666c0 24.234667-19.114667 43.889778-42.666667 43.889778s-42.666667-19.626667-42.666666-43.889778V119.665778c-0.142222-11.747556 4.266667-23.04 12.288-31.402667a42.097778 42.097778 0 0 1 30.378666-13.084444zM526.222222 0a42.382222 42.382222 0 0 1 30.151111 12.885333l284.444445 292.551111c8.049778 8.192 12.600889 19.342222 12.600889 31.004445 0 11.662222-4.551111 22.840889-12.600889 31.004444a42.097778 42.097778 0 0 1-60.302222 0l-284.444445-292.551111a44.231111 44.231111 0 0 1-12.600889-31.004445c0-11.662222 4.551111-22.812444 12.600889-31.004445A42.382222 42.382222 0 0 1 526.222222 0z m0 0a42.382222 42.382222 0 0 1 30.151111 12.885333c8.049778 8.192 12.600889 19.342222 12.600889 31.004445 0 11.662222-4.551111 22.812444-12.600889 31.004444l-284.444444 292.579556a42.097778 42.097778 0 0 1-60.302222 0 44.231111 44.231111 0 0 1-12.600889-31.004445c0-11.662222 4.551111-22.840889 12.600889-31.004444l284.444444-292.579556A42.382222 42.382222 0 0 1 526.222222 0z" fill="#000000" p-id="6473"></path></svg>
                        </span>
                        {sharedUploading ? '上传中...' : '上传文件'}
                        <input type="file" className="file-input" accept=".txt,.md,.markdown,.pdf,.docx" onChange={handleSharedUpload} disabled={sharedUploading} />
                      </label>
                      {selectedSharedKB.owner_id === user?.id ? (
                        <button className="action-btn" style={{ color: '#ff4d4f' }} onClick={handleSharedDeleteKB}>删除知识库</button>
                      ) : (
                        <button className="action-btn" style={{ color: '#ff7875' }} onClick={handleSharedQuitKB}>退出知识库</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 文件列表 */}
                <div className="folder-section">
                  <div className="section-header">
                    <div className="section-title-wrapper">
                      <div className="section-title">文件列表（{sharedKBFiles.length}）</div>
                    </div>
                  </div>
                  <div className="folder-items">
                    {sharedKBFiles.length === 0 ? (
                      <div className="empty-folder">
                        <div className="empty-icon">📂</div>
                        <div className="empty-text">暂无文件</div>
                        <div className="empty-hint">点击上方「上传文件」添加内容到知识库</div>
                      </div>
                    ) : (
                      sharedKBFiles.map(file => (
                        <div key={file.id} className="folder-item file" onClick={() => handleSharedFileClick(file)} style={{ cursor: 'pointer' }}>
                          <span className="folder-icon file">📄</span>
                          <span className="folder-name">{file.name}</span>
                          <span className="file-size" style={{ marginLeft: 'auto', flexShrink: 0 }}>{formatFileSize(file.file_size)}</span>
                          <span style={{ fontSize: 11, color: '#bbb', marginLeft: 10, flexShrink: 0 }}>@{file.uploader_name}</span>
                          {(selectedSharedKB.owner_id === user?.id || file.uploader_id === user?.id) && (
                            <button
                              style={{ marginLeft: 8, background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: 12, flexShrink: 0, padding: '2px 6px' }}
                              onClick={(e) => handleSharedDeleteFile(file, e)}
                            >删除</button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-folder" style={{ margin: '80px auto', textAlign: 'center' }}>
                <div className="empty-icon" style={{ fontSize: 48 }}>🗂️</div>
                <div className="empty-text">请从左侧选择一个共享知识库</div>
                <div className="empty-hint">或点击「我创建的」旁的 + 号新建共享知识库</div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 文档查看模态框 */}
      {viewingDocument && (
        <div className="document-modal-overlay">
          <div className="document-modal">
            <div className="document-modal-header">
              <h2 className="document-title">{viewingDocument.name}</h2>
              <div className="document-actions">
                {/* 下载按钮 */}
                <button
                  className="download-btn"
                  onClick={handleDownloadDocument}
                >
                  📥 下载
                </button>
                <button className="close-btn" onClick={handleCloseDocument}>
                  ×
                </button>
              </div>
            </div>
            <div className="document-modal-content">
              {loadingFile ? (
                // 加载状态
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p className="loading-text">正在加载文件...</p>
                </div>
              ) : viewingDocument.htmlContent ? (
                // Word文档转换后的HTML预览
                <div className="word-preview-container">
                  <div className="document-content" dangerouslySetInnerHTML={{ __html: viewingDocument.htmlContent }}></div>
                </div>
              ) : viewingDocument.fileType === 'text/plain' || viewingDocument.fileType === 'text/markdown' || viewingDocument.name.endsWith('.md') ? (
                // 文本文件预览
                <div className="document-content-container">
                  <div className="document-content">
                  {viewingDocument.content.split('\n').map((line, index) => {
                    // 处理标题
                    if (line.startsWith('# ')) {
                      return <h1 key={index} className="document-h1">{line.substring(2)}</h1>
                    } else if (line.startsWith('## ')) {
                      return <h2 key={index} className="document-h2">{line.substring(3)}</h2>
                    } else if (line.startsWith('### ')) {
                      return <h3 key={index} className="document-h3">{line.substring(4)}</h3>
                    } else if (line.startsWith('- ')) {
                      return <li key={index} className="document-list-item">{line.substring(2)}</li>
                    } else if (line.trim() === '') {
                      return <br key={index} />
                    } else {
                      return <p key={index} className="document-paragraph">{line}</p>
                    }
                  })}
                  </div>
                </div>
              ) : viewingDocument.fileType === 'application/pdf' ? (
                // PDF文件预览
                <div className="pdf-preview-container">
                  {currentFile ? (
                    <iframe
                      src={URL.createObjectURL(currentFile)}
                      title={viewingDocument.name}
                      className="pdf-iframe"
                    ></iframe>
                  ) : (
                    <div className="file-error">
                      <p>无法加载PDF文件，请尝试下载后查看。</p>
                    </div>
                  )}
                </div>
              ) : (
                // 其他非文本文件预览
                <div className="document-content-container">
                  <div className="document-content">
                  <h1 className="document-h1">{viewingDocument.name}</h1>
                  <p className="document-paragraph">这是一个{viewingDocument.simpleType}。</p>
                  <div className="file-info">
                    <p className="file-type">文件类型: {viewingDocument.simpleType}</p>
                    <p className="file-size">文件大小: {viewingDocument.size}</p>
                    <p className="file-created">创建时间: {viewingDocument.createdAt}</p>
                  </div>
                  <div className="file-actions" style={{ marginTop: '20px', justifyContent: 'flex-start' }}>
                    <button
                      className="action-btn primary"
                      onClick={() => {
                        if (currentFile) {
                          // 尝试使用浏览器默认方式打开文件
                          const url = URL.createObjectURL(currentFile)
                          window.open(url, '_blank')
                        } else {
                          alert('无法加载文件，请尝试下载后查看。')
                        }
                      }}
                      style={{ padding: '8px 16px', fontSize: '14px', minWidth: '120px' }}
                    >
                      📖 在线查看
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 上下文菜单 */}
      {activeMenuId && (
        <div
          className="context-menu"
          style={{
            position: 'fixed',
            left: activeMenuPosition.x,
            top: activeMenuPosition.y,
            zIndex: 1001
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="context-menu-item"
            onClick={() => handleRenameItem(activeMenuId)}
          >
            <span className="menu-icon">
              <svg t="1770619563078" className="icon" viewBox="0 0 1025 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3605" width="16" height="16"><path d="M982.492729 997.546667H44.224284a42.666667 42.666667 0 1 1 0-85.276445h938.268445a42.666667 42.666667 0 0 1 0 85.304889zM154.674062 846.620444a85.304889 85.304889 0 0 1-81.891555-62.264888 81.464889 81.464889 0 0 1 0-47.331556l56.746666-178.716444a42.666667 42.666667 0 0 1 10.24-16.611556l192.341334-200.874667L634.048284 38.4a127.943111 127.943111 0 0 1 180.849778 0l60.558222 60.586667a127.943111 127.943111 0 0 1 0 180.792889L573.490062 581.319111l-192.768 200.448a42.666667 42.666667 0 0 1-19.626666 11.52l-183.808 49.891556a80.611556 80.611556 0 0 1-22.613334 3.413333z m52.053334-253.326222l-52.053334 168.021334 172.743111-47.331556L513.358507 521.614222l170.609777-172.743111-119.011555-118.983111-170.581333 170.609778-187.676445 192.768zM625.486507 167.623111l120.718222 120.689778L814.869618 219.648a42.666667 42.666667 0 0 0 0-60.558222L754.738062 98.986667a42.666667 42.666667 0 0 0-60.558222 0l-68.664889 68.664889z" fill="#000000" p-id="3606"></path></svg>
            </span>
            <span className="menu-text">重命名</span>
          </div>
          <div
            className="context-menu-item delete"
            onClick={() => handleDeleteItem(activeMenuId)}
          >
            <span className="menu-icon">
              <svg t="1770619629957" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3758" width="16" height="16"><path d="M874.011741 138.270167v746.665215c0 29.35461-12.003532 57.457666-33.336825 78.22207A115.455776 115.455776 0 0 1 760.234184 995.555611h-511.999004c-30.179497 0-59.135885-11.6622-80.469177-32.398159a109.084232 109.084232 0 0 1-33.30838-78.22207V138.270167h739.554118z m-85.333168 82.972283h-568.887783V884.906937c0 7.338652 2.986661 14.364417 8.305762 19.56974 5.347545 5.176879 12.57242 8.078207 20.138628 8.078206h511.999004c7.537763 0 14.791082-2.901328 20.110183-8.078206a27.278169 27.278169 0 0 0 8.334206-19.56974V221.24245z m-383.999253 580.720648c-23.580399 0-42.666584-18.545742-42.666584-41.471919V428.658935c0-22.897733 19.086185-41.471919 42.666584-41.471919 23.551954 0 42.666584 18.574186 42.666583 41.471919v331.860688c0 22.926178-19.114629 41.471919-42.666583 41.47192z m199.110724 0c-23.580399 0-42.666584-18.545742-42.666584-41.471919V428.658935c0-22.897733 19.086185-41.471919 42.666584-41.471919 23.551954 0 42.666584 18.574186 42.666583 41.471919v331.860688c0 22.926178-19.114629 41.471919-42.666583 41.47192z m355.554864-580.720648h-910.220452c-23.580399 0-42.666584-18.574186-42.666584-41.500364 0-22.897733 19.086185-41.471919 42.666584-41.471919h910.220452c23.551954 0 42.666584 18.574186 42.666584 41.471919 0 22.926178-19.114629 41.500364-42.666584 41.500364z m-331.377133-138.268176l7.111097 55.295893h-261.68838l7.111097-55.295893h247.466186zM652.998837 0.001991h-297.52831c-28.842611-0.227555-53.304785 20.565293-56.888779 48.383906l-21.902179 172.856553h455.110226l-22.186624-172.856553c-3.612437-27.818613-28.074612-48.611461-56.888778-48.355462h0.284444z" fill="#000000" p-id="3759"></path></svg>
            </span>
            <span className="menu-text">删除</span>
          </div>
        </div>
      )}

      {/* 创建共享知识库模态框 */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>创建共享知识库</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleCreateKnowledgeBase();
              }}>
                <div className="form-group">
                  <label htmlFor="title">名称 *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={newKnowledgeBase.title}
                    onChange={handleInputChange}
                    placeholder="请输入知识库名称"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="cover">封面</label>
                  <div className="cover-upload">
                    <div className="cover-preview">
                      {newKnowledgeBase.cover ? (
                        <img src={newKnowledgeBase.cover} alt="封面预览" />
                      ) : (
                        <div className="cover-placeholder">
                          <svg t="1770436559967" className="icon" viewBox="0 0 24 24" width="24" height="24"><path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2v-4H8v-2h4V9h2v4h4v2h-4v4z" fill="currentColor"></path></svg>
                          <span>上传封面</span>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      id="cover"
                      name="cover"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (e) => {
                            setNewKnowledgeBase(prev => ({
                              ...prev,
                              cover: e.target.result
                            }))
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                    />

                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="description">简介</label>
                  <textarea
                    id="description"
                    name="description"
                    value={newKnowledgeBase.description}
                    onChange={handleInputChange}
                    placeholder="为你的共享知识库填写简介"
                    rows={3}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label htmlFor="category">分类</label>
                  <select
                    id="category"
                    name="category"
                    value={newKnowledgeBase.category}
                    onChange={handleInputChange}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e0e0e0', fontSize: 14 }}
                  >
                    {['推荐','科技','教育','职场','财经','产业','健康','法律','人文','生活'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="is_public"
                      checked={newKnowledgeBase.is_public}
                      onChange={handleInputChange}
                    />
                    <span>公开发布（在发现广场展示，所有人可搜索加入）</span>
                  </label>
                </div>
                <div className="modal-footer">
                  <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                    取消
                  </button>
                  <button type="submit" className="submit-btn">
                    创建
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 共享知识库文件预览弹窗 */}
      {viewingSharedDoc && (
        <div className="document-modal-overlay">
          <div className="document-modal">
            <div className="document-modal-header">
              <h2 className="document-title">{viewingSharedDoc.name}</h2>
              <div className="document-actions">
                <button className="close-btn" onClick={() => setViewingSharedDoc(null)}>×</button>
              </div>
            </div>
            <div className="document-modal-content">
              {sharedDocLoading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p className="loading-text">加载文件内容...</p>
                </div>
              ) : viewingSharedDoc.content ? (
                <div className="document-content-container">
                  <div className="document-content">
                    {viewingSharedDoc.content.split('\n').map((line, i) => {
                      if (line.startsWith('### ')) return <h3 key={i} className="document-h3">{line.slice(4)}</h3>
                      if (line.startsWith('## '))  return <h2 key={i} className="document-h2">{line.slice(3)}</h2>
                      if (line.startsWith('# '))   return <h1 key={i} className="document-h1">{line.slice(2)}</h1>
                      if (line.startsWith('- '))   return <li key={i} className="document-list-item">{line.slice(2)}</li>
                      if (line.trim() === '')      return <br key={i} />
                      return <p key={i} className="document-paragraph">{line}</p>
                    })}
                  </div>
                </div>
              ) : (
                <div className="empty-folder">
                  <div className="empty-text">无法预览此文件类型</div>
                  <div className="empty-hint">请下载后在本地查看</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 分块设置模态框 */}
      {showChunkSettings && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>文件分块设置</h2>
              <button className="close-btn" onClick={() => setShowChunkSettings(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>分块策略</label>
                <div className="strategy-mode">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="strategyMode"
                      value="auto"
                      checked={strategyMode === 'auto'}
                      onChange={() => setStrategyMode('auto')}
                    />
                    <span>自动分块（推荐）</span>
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name="strategyMode"
                      value="manual"
                      checked={strategyMode === 'manual'}
                      onChange={() => setStrategyMode('manual')}
                    />
                    <span>手动调整</span>
                  </label>
                </div>
              </div>

              {strategyMode === 'manual' && (
                <div className="chunk-settings">
                  <div className="form-group">
                    <label htmlFor="chunkSize">分块大小（{chunkSize}）</label>
                    <input
                      type="range"
                      id="chunkSize"
                      min="100"
                      max="2000"
                      step="50"
                      value={chunkSize}
                      onChange={(e) => setChunkSize(Number(e.target.value))}
                    />
                    <div className="range-labels">
                      <span>100</span>
                      <span>2000</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="chunkOverlap">重叠大小（{chunkOverlap}）</label>
                    <input
                      type="range"
                      id="chunkOverlap"
                      min="0"
                      max="200"
                      step="10"
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(Number(e.target.value))}
                    />
                    <div className="range-labels">
                      <span>0</span>
                      <span>200</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="topK">返回结果数（{topK}）</label>
                    <input
                      type="range"
                      id="topK"
                      min="1"
                      max="10"
                      step="1"
                      value={topK}
                      onChange={(e) => setTopK(Number(e.target.value))}
                    />
                    <div className="range-labels">
                      <span>1</span>
                      <span>10</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="scoreThreshold">相似度阈值（{scoreThreshold.toFixed(2)}）</label>
                    <input
                      type="range"
                      id="scoreThreshold"
                      min="0"
                      max="1"
                      step="0.05"
                      value={scoreThreshold}
                      onChange={(e) => setScoreThreshold(Number(e.target.value))}
                    />
                    <div className="range-labels">
                      <span>0</span>
                      <span>1.0</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="file-list">
                <h3>待上传文件</h3>
                <ul>
                  {selectedFiles.map((file, index) => (
                    <li key={index}>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="cancel-btn" onClick={() => setShowChunkSettings(false)}>
                取消
              </button>
              <button type="button" className="submit-btn" onClick={handleChunkSettingsSubmit}>
                上传
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default KnowledgeBasePage