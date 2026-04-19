import React, { useState, useEffect } from 'react'
import '../styles/SharedKnowledgeBasePage.css'

function SharedKnowledgeBasePage({ user, onLogout, onShowSettings, onBackToHome, onNavigateToPersonalKnowledge }) {
  // 状态管理
  const [activeTab, setActiveTab] = useState('discover') // discover 或 detail
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('推荐')
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(null)
  const [knowledgeBaseContent, setKnowledgeBaseContent] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAddContentModal, setShowAddContentModal] = useState(false)
  const [newKnowledgeBase, setNewKnowledgeBase] = useState({
    title: '',
    description: '',
    cover: ''
  })
  const [contentType, setContentType] = useState('file') // file 或 knowledgeBase
  // 共享知识库数据
  const [knowledgeBases, setKnowledgeBases] = useState([])
  // 文档查看状态
  const [viewingDocument, setViewingDocument] = useState(null)
  const [loadingFile, setLoadingFile] = useState(false)

  // 文档内容数据
  const fileContents = {
    'file1': `# 会话功能使用说明\n\n## 功能介绍\n会话功能允许您与AI进行实时对话，获取基于知识库内容的智能回答。\n\n## 使用步骤\n1. **选择知识库**：在共享知识库页面选择一个知识库\n2. **进入详情页**：点击知识库卡片进入详情页\n3. **开始对话**：在右侧输入框中输入您的问题\n4. **获取回答**：AI会基于知识库内容生成回答\n\n## 注意事项\n- 对话内容会基于当前选择的知识库内容\n- 您可以随时清空对话历史重新开始\n- 复杂问题可能需要更长的处理时间`,
    'file2': `# 知识库使用说明\n\n## 知识库介绍\n知识库是存储和管理文档的集合，您可以创建个人知识库或访问共享知识库。\n\n## 个人知识库\n1. **创建知识库**：点击"创建知识库"按钮\n2. **添加内容**：支持上传文件或添加文本内容\n3. **管理内容**：可以编辑、删除或重新组织内容\n4. **分享设置**：可以设置知识库的访问权限\n\n## 共享知识库\n1. **浏览发现**：在共享知识库页面浏览推荐的知识库\n2. **搜索查找**：使用搜索功能查找特定知识库\n3. **按分类筛选**：通过分类标签筛选感兴趣的知识库\n4. **加入知识库**：点击知识库卡片进入并使用\n\n## 最佳实践\n- 为知识库添加清晰的标题和描述\n- 合理组织文件结构，使用文件夹分类\n- 定期更新知识库内容以保持时效性`,
    'file3': `# 笔记功能使用说明\n\n## 功能介绍\n笔记功能允许您创建、编辑和管理个人笔记，支持Markdown格式。\n\n## 创建笔记\n1. **进入笔记页面**：点击左侧导航栏的笔记图标\n2. **新建笔记**：点击"新建笔记"按钮\n3. **编辑内容**：在编辑器中输入笔记内容\n4. **保存笔记**：系统会自动保存您的修改\n\n## 笔记管理\n1. **查看笔记**：在笔记列表中查看所有笔记\n2. **编辑笔记**：点击笔记卡片进入编辑模式\n3. **删除笔记**：点击删除按钮移除不需要的笔记\n4. **搜索笔记**：使用搜索功能查找特定笔记\n\n## Markdown支持\n- **标题**：使用 # 标记不同级别的标题\n- **列表**：使用 - 或数字创建列表\n- **链接**：使用 [文本](URL) 创建链接\n- **图片**：使用 ![描述](图片URL) 插入图片\n- **代码**：使用 \`\`\` 包围代码块\n\n## 快捷操作\n- **Ctrl+S**：手动保存笔记\n- **Ctrl+B**：加粗选中文本\n- **Ctrl+I**：斜体选中文本`
  }

  // 分类列表
  const categories = ['推荐', '科技', '教育', '职场', '财经', '产业', '健康', '法律', '人文', '生活']

  // 从本地存储中加载共享知识库数据
  const loadKnowledgeBases = () => {
    const savedData = localStorage.getItem('corvusNoteSharedKnowledgeBases')
    if (savedData) {
      setKnowledgeBases(JSON.parse(savedData))
    } else {
      // 默认数据
      const defaultKnowledgeBases = [
        {
          id: '1',
          title: 'CurvusNote使用指南',
          description: '官方使用指南，包含会话功能、知识库和笔记功能的详细说明',
          avatar: '/curvus.svg',
          author: '官方',
          memberCount: 10000,
          contentCount: 3,
          cover: '/curvus.svg',
          categories: ['推荐', '教育']
        }
      ]
      setKnowledgeBases(defaultKnowledgeBases)
    }
  }

  // 初始加载知识库数据
  React.useEffect(() => {
    loadKnowledgeBases()
  }, [])

  // 当返回发现页时重新加载数据
  React.useEffect(() => {
    if (activeTab === 'discover') {
      loadKnowledgeBases()
    }
  }, [activeTab])

  // 从本地存储加载特定共享知识库的内容
  const loadSharedKnowledgeBaseContent = (kbId) => {
    if (user) {
      const savedData = localStorage.getItem(`corvusNoteSharedKnowledgeBaseContent_${user.id}_${kbId}`)
      if (savedData) {
        const content = JSON.parse(savedData)
        // 转换为前端显示格式
        const folders = content.filter(item => item.type === 'folder')
        const files = content.filter(item => item.type !== 'folder')
        return { folders, files }
      }
    }
    // 默认数据
    return { folders: [], files: [] }
  }

  // 处理知识库点击
  const handleKnowledgeBaseClick = (kb) => {
    setSelectedKnowledgeBase(kb)
    // 加载实际的知识库内容
    const content = loadSharedKnowledgeBaseContent(kb.id)
    setKnowledgeBaseContent(content)
    setActiveTab('detail')
    setSelectedFile(null)
  }

  // 当选中的知识库变化时，重新加载内容
  React.useEffect(() => {
    if (selectedKnowledgeBase) {
      const content = loadSharedKnowledgeBaseContent(selectedKnowledgeBase.id)
      setKnowledgeBaseContent(content)
    }
  }, [selectedKnowledgeBase])

  // 处理返回发现页
  const handleBackToDiscover = () => {
    setActiveTab('discover')
    setSelectedKnowledgeBase(null)
    setKnowledgeBaseContent([])
    setSelectedFile(null)
  }

  // 处理文件点击
  const handleFileClick = (file) => {
    // 从本地存储加载文件内容
    if (selectedKnowledgeBase) {
      const content = loadSharedKnowledgeBaseContent(selectedKnowledgeBase.id)
      const allItems = [...(content.folders || []), ...(content.files || [])]
      const foundFile = allItems.find(item => item.id === file.id)
      
      if (foundFile) {
        // 创建文档对象
        const document = {
          id: foundFile.id,
          name: foundFile.name,
          size: foundFile.size,
          content: foundFile.content || `# ${foundFile.name}\n\n这是一个${foundFile.simpleType || '文件'}。`,
          fileType: foundFile.fileType,
          htmlContent: foundFile.htmlContent
        }
        setViewingDocument(document)
        setLoadingFile(false)
      }
    }
  }

  // 处理关闭文档
  const handleCloseDocument = () => {
    setViewingDocument(null)
    setLoadingFile(false)
  }

  // 过滤知识库
  const filteredKnowledgeBases = knowledgeBases.filter(kb => {
    const matchesSearch = kb.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         kb.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === '推荐' || kb.categories.includes(selectedCategory)
    return matchesSearch && matchesCategory
  })

  // 处理创建共享知识库
  const handleCreateKnowledgeBase = () => {
    if (!newKnowledgeBase.title.trim()) return

    // 生成基于标题的彩色封面
    const generateColorfulCover = (title) => {
      // 基于标题生成哈希值
      let hash = 0;
      for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
      }
      
      // 生成颜色
      const c = (hash & 0x00FFFFFF)
        .toString(16)
        .toUpperCase()
        .padStart(6, '0');
      const color = `#${c}`;
      
      // 生成SVG封面
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" style="background-color: ${color};"><text x="50%" y="50%" font-size="24" text-anchor="middle" fill="white" dominant-baseline="middle">${encodeURIComponent(title)}</text></svg>`;
    };
    
    // 创建新的知识库对象
    const kb = {
      id: Date.now().toString(),
      title: newKnowledgeBase.title,
      description: newKnowledgeBase.description,
      avatar: user.avatar,
      author: user.username,
      memberCount: 1,
      contentCount: 0,
      cover: newKnowledgeBase.cover || generateColorfulCover(newKnowledgeBase.title),
      categories: ['推荐'],
      createdAt: new Date().toISOString()
    }
    
    // 确保封面URL格式正确
    console.log('Generated cover URL:', kb.cover)

    // 从本地存储中获取现有的共享知识库数据
    const existingKnowledgeBases = JSON.parse(localStorage.getItem('corvusNoteSharedKnowledgeBases') || '[]')
    
    // 将新创建的知识库添加到数据中
    const updatedKnowledgeBases = [kb, ...existingKnowledgeBases]
    
    // 将更新后的数据保存回本地存储
    localStorage.setItem('corvusNoteSharedKnowledgeBases', JSON.stringify(updatedKnowledgeBases))
    
    // 更新状态
    setKnowledgeBases(updatedKnowledgeBases)

    // 关闭模态框
    setShowCreateModal(false)

    // 重置表单
    setNewKnowledgeBase({
      title: '',
      description: '',
      cover: ''
    })

    // 进入新创建的知识库
    handleKnowledgeBaseClick(kb)
  }

  // 处理表单输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewKnowledgeBase(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // 保存特定共享知识库的内容到本地存储
  const saveSharedKnowledgeBaseContent = (kbId, data) => {
    if (user) {
      localStorage.setItem(`corvusNoteSharedKnowledgeBaseContent_${user.id}_${kbId}`, JSON.stringify(data))
    }
  }

  // 处理添加内容
  const handleAddContent = () => {
    // 从本地存储加载当前知识库内容
    const currentContent = loadSharedKnowledgeBaseContent(selectedKnowledgeBase.id)
    
    // 合并文件夹和文件为单一数组
    const allItems = [...(currentContent.folders || []), ...(currentContent.files || [])]
    
    if (contentType === 'file') {
      // 添加文件
      const newFile = {
        id: Date.now().toString(),
        name: '新文件.md',
        type: 'file',
        size: '1.2 KB',
        createdAt: new Date().toISOString().split('T')[0],
        content: '# 新文件\n\n这是一个新创建的文件。'
      }
      
      // 添加到知识库内容
      const updatedItems = [...allItems, newFile]
      saveSharedKnowledgeBaseContent(selectedKnowledgeBase.id, updatedItems)
      
      // 更新状态
      setKnowledgeBaseContent({
        folders: updatedItems.filter(item => item.type === 'folder'),
        files: updatedItems.filter(item => item.type !== 'folder')
      })
    } else if (contentType === 'knowledgeBase') {
      // 添加个人知识库
      const newKnowledgeBaseItem = {
        id: Date.now().toString(),
        name: '个人知识库',
        type: 'folder',
        items: [],
        createdAt: new Date().toISOString().split('T')[0],
        isExpanded: false
      }
      
      // 添加到知识库内容
      const updatedItems = [...allItems, newKnowledgeBaseItem]
      saveSharedKnowledgeBaseContent(selectedKnowledgeBase.id, updatedItems)
      
      // 更新状态
      setKnowledgeBaseContent({
        folders: updatedItems.filter(item => item.type === 'folder'),
        files: updatedItems.filter(item => item.type !== 'folder')
      })
    }

    // 更新知识库的内容计数
    const updatedKnowledgeBases = knowledgeBases.map(kb => {
      if (kb.id === selectedKnowledgeBase.id) {
        return {
          ...kb,
          contentCount: kb.contentCount + 1
        }
      }
      return kb
    })
    
    // 更新本地存储
    localStorage.setItem('corvusNoteSharedKnowledgeBases', JSON.stringify(updatedKnowledgeBases))
    
    // 更新状态
    setKnowledgeBases(updatedKnowledgeBases)

    // 关闭模态框
    setShowAddContentModal(false)
  }

  return (
    <div className="shared-knowledge-base-page">
      {/* 主内容区 */}
      <div className="main-content">
        {/* 页面头部 */}
        <div className="page-header">
          <div className="header-left">
            <div className="logo" onClick={onBackToHome} style={{ cursor: 'pointer' }}>
              <div className="raven-icon"></div>
            </div>
            <h1 className="page-title">
              {activeTab === 'discover' ? '共享知识库' : selectedKnowledgeBase?.title}
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

        {/* 发现页内容 */}
        {activeTab === 'discover' && (
          <div className="discover-content">
            {/* 搜索栏 */}
            <div className="search-bar">
              <input
                type="text"
                placeholder="搜索共享知识库"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button className="search-btn">
                <svg t="1770436559967" class="icon" viewBox="0 0 24 24" width="20" height="20"><path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z" fill="currentColor"></path></svg>
              </button>
            </div>

            {/* 分类标签 */}
            <div className="category-tabs">
              {categories.map(category => (
                <button
                  key={category}
                  className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* 知识库列表 */}
            <div className="knowledge-bases-grid">
              {filteredKnowledgeBases.map(kb => (
                <div 
                  key={kb.id} 
                  className="knowledge-base-card"
                  onClick={() => handleKnowledgeBaseClick(kb)}
                >
                  <div className="kb-card-header">
                    <img src={kb.cover} alt={kb.title} className="kb-cover" />
                  </div>
                  <div className="kb-card-body">
                    <h3 className="kb-title">{kb.title}</h3>
                    <p className="kb-description">{kb.description}</p>
                    <div className="kb-meta">
                      <div className="kb-author">
                        <img src={kb.avatar} alt={kb.author} className="author-avatar" />
                        <span className="author-name">{kb.author}</span>
                      </div>
                      <div className="kb-stats">
                        <span className="stat-item">{kb.memberCount}人已加入</span>
                        <span className="stat-item">{kb.contentCount}个内容</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 知识库详情页内容 */}
        {activeTab === 'detail' && selectedKnowledgeBase && (
          <div className="detail-content">
            {/* 两栏布局 */}
            <div className="detail-layout">
              {/* 左侧：知识库简介和文件结构 */}
              <div className="left-panel">
                {/* 知识库简介 */}
                <div className="kb-info">
                  <button className="back-btn" onClick={handleBackToDiscover}>
                    <svg t="1770436559967" class="icon" viewBox="0 0 24 24" width="20" height="20"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" fill="currentColor"></path></svg>
                    返回
                  </button>
                  <div className="kb-header-info">
                    <img src={selectedKnowledgeBase.cover} alt={selectedKnowledgeBase.title} className="kb-header-cover" />
                    <div className="kb-header-details">
                      <h2 className="kb-header-title">{selectedKnowledgeBase.title}</h2>
                      <p className="kb-header-description">{selectedKnowledgeBase.description}</p>
                      <div className="kb-header-meta">
                        <div className="kb-header-author">
                          <img src={selectedKnowledgeBase.avatar} alt={selectedKnowledgeBase.author} className="author-avatar" />
                          <span className="author-name">{selectedKnowledgeBase.author}</span>
                        </div>
                        <div className="kb-header-stats">
                          <span className="stat-item">{selectedKnowledgeBase.memberCount}人已加入</span>
                          <span className="stat-item">{selectedKnowledgeBase.contentCount}个内容</span>
                        </div>
                      </div>
                      {/* 添加内容按钮 */}
                      {selectedKnowledgeBase.author === user.username && (
                        <div className="kb-actions">
                          <button className="add-content-btn" onClick={() => setShowAddContentModal(true)}>
                            添加内容
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* 文件结构 */}
                <div className="file-structure">
                  <h3 className="section-title">知识库内容</h3>
                  
                  {/* 文件夹 */}
                  <div className="folders-section">
                    {knowledgeBaseContent.folders.map(folder => (
                      <div key={folder.id} className="folder-item">
                        <div className="folder-header">
                          <svg t="1770436559967" class="icon" viewBox="0 0 24 24" width="16" height="16"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h5.17L12 10.83V18h8z" fill="currentColor"></path></svg>
                          <span className="folder-name">{folder.name}</span>
                        </div>
                        <div className="folder-content">
                          {folder.items && folder.items.map(item => (
                            <div key={item.id} className={`file-item ${selectedFile?.id === item.id ? 'active' : ''}`} onClick={() => item.type === 'file' && handleFileClick(item)}>
                              {item.type === 'folder' ? (
                                <>
                                  <svg t="1770436559967" class="icon" viewBox="0 0 24 24" width="14" height="14"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h5.17L12 10.83V18h8z" fill="currentColor"></path></svg>
                                  <span className="file-name">{item.name}</span>
                                </>
                              ) : (
                                <>
                                  <svg t="1770436559967" class="icon" viewBox="0 0 24 24" width="14" height="14"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"></path></svg>
                                  <span className="file-name">{item.name}</span>
                                  <span className="file-size">{item.size}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 单独文件 */}
                  <div className="files-section">
                    {knowledgeBaseContent.files.map(file => (
                      <div key={file.id} className={`file-item ${selectedFile?.id === file.id ? 'active' : ''}`} onClick={() => handleFileClick(file)}>
                        <svg t="1770436559967" class="icon" viewBox="0 0 24 24" width="14" height="14"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" fill="currentColor"></path></svg>
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">{file.size}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>


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
                            <svg t="1770436559967" class="icon" viewBox="0 0 24 24" width="24" height="24"><path d="M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-2v-4H8v-2h4V9h2v4h4v2h-4v4z" fill="currentColor"></path></svg>
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
                      rows={4}
                    ></textarea>
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

        {/* 添加内容模态框 */}
        {showAddContentModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>添加内容</h2>
                <button className="close-btn" onClick={() => setShowAddContentModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="content-type-selector">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="contentType"
                      value="file"
                      checked={contentType === 'file'}
                      onChange={() => setContentType('file')}
                    />
                    <span>添加文件</span>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="contentType"
                      value="knowledgeBase"
                      checked={contentType === 'knowledgeBase'}
                      onChange={() => setContentType('knowledgeBase')}
                    />
                    <span>添加个人知识库</span>
                  </label>
                </div>
                <div className="modal-footer">
                  <button type="button" className="cancel-btn" onClick={() => setShowAddContentModal(false)}>
                    取消
                  </button>
                  <button type="button" className="submit-btn" onClick={handleAddContent}>
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
                    <div className="file-error">
                      <p>PDF文件预览功能开发中，请尝试下载后查看。</p>
                    </div>
                  </div>
                ) : (
                  // 其他非文本文件预览
                  <div className="document-content-container">
                    <div className="document-content">
                    <h1 className="document-h1">{viewingDocument.name}</h1>
                    <p className="document-paragraph">这是一个{viewingDocument.simpleType || '文件'}。</p>
                    <div className="file-info">
                      <p className="file-type">文件类型: {viewingDocument.simpleType || viewingDocument.fileType}</p>
                      <p className="file-size">文件大小: {viewingDocument.size}</p>
                      <p className="file-created">创建时间: {viewingDocument.createdAt}</p>
                    </div>
                    <div className="file-actions" style={{ marginTop: '20px', justifyContent: 'flex-start' }}>
                      <button 
                        className="action-btn primary" 
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
      </div>
    </div>
  )
}

export default SharedKnowledgeBasePage