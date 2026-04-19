import React, { useState, useEffect } from 'react'
import '../styles/SharedKnowledgeBasePage.css'
import {
  fetchPublicKBs,
  fetchMyCreatedKBs,
  fetchMyJoinedKBs,
  createSharedKB,
  updateSharedKB,
  deleteSharedKB,
  joinSharedKB,
  quitSharedKB,
} from '../utils/apiService'

// 预设分类
const CATEGORIES = ['推荐', '科技', '教育', '职场', '财经', '产业', '健康', '法律', '人文', '生活']

function SharedKnowledgeBasePage({ user, onLogout, onShowSettings, onBackToHome, onNavigateToPersonalKnowledge }) {
  // 状态
  const [activeTab, setActiveTab] = useState('discover') // discover | my-created | detail
  const [viewTab, setViewTab] = useState('my-created') // my-created | my-joined
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('推荐')
  const [selectedKB, setSelectedKB] = useState(null)
  const [publicKBs, setPublicKBs] = useState([])
  const [myCreatedKBs, setMyCreatedKBs] = useState([])
  const [myJoinedKBs, setMyJoinedKBs] = useState([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)

  // 创建模态框
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newKB, setNewKB] = useState({
    name: '',
    description: '',
    category: '推荐',
    is_public: false,
    cover: ''
  })

  // 编辑模态框
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingKB, setEditingKB] = useState(null)

  // 加载公开知识库
  const loadPublicKBs = async () => {
    setLoading(true)
    try {
      const res = await fetchPublicKBs({
        category: selectedCategory === '推荐' ? null : selectedCategory,
        search: searchTerm || null
      })
      setPublicKBs(res.items || [])
      setTotal(res.total || 0)
    } catch (error) {
      console.error('加载公开知识库失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载我创建的
  const loadMyCreatedKBs = async () => {
    setLoading(true)
    try {
      const res = await fetchMyCreatedKBs()
      setMyCreatedKBs(res || [])
    } catch (error) {
      console.error('加载我创建的知识库失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载我加入的
  const loadMyJoinedKBs = async () => {
    setLoading(true)
    try {
      const res = await fetchMyJoinedKBs()
      setMyJoinedKBs(res || [])
    } catch (error) {
      console.error('加载我加入的知识库失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    if (activeTab === 'discover') {
      loadPublicKBs()
    } else if (activeTab === 'my-created') {
      loadMyCreatedKBs()
    } else if (activeTab === 'my-joined') {
      loadMyJoinedKBs()
    }
  }, [activeTab, selectedCategory])

  // 搜索
  useEffect(() => {
    if (activeTab === 'discover') {
      const timer = setTimeout(() => {
        loadPublicKBs()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [searchTerm])

  // 处理创建知识库
  const handleCreateKB = async (e) => {
    e.preventDefault()
    if (!newKB.name.trim()) return

    try {
      const kb = await createSharedKB(newKB)
      setMyCreatedKBs([kb, ...myCreatedKBs])
      setShowCreateModal(false)
      setNewKB({
        name: '',
        description: '',
        category: '推荐',
        is_public: false,
        cover: ''
      })
      // 如果公开，刷新公开列表
      if (newKB.is_public) {
        loadPublicKBs()
      }
    } catch (error) {
      alert(error.message || '创建失败')
    }
  }

  // 处理更新知识库
  const handleUpdateKB = async (e) => {
    e.preventDefault()
    if (!editingKB) return

    try {
      const updated = await updateSharedKB(editingKB.id, editingKB)
      setMyCreatedKBs(myCreatedKBs.map(kb => kb.id === updated.id ? updated : kb))
      setShowEditModal(false)
      setEditingKB(null)
      // 如果公开状态改变，刷新公开列表
      loadPublicKBs()
    } catch (error) {
      alert(error.message || '更新失败')
    }
  }

  // 处理删除知识库
  const handleDeleteKB = async (kbId) => {
    if (!window.confirm('确定要删除这个知识库吗？')) return

    try {
      await deleteSharedKB(kbId)
      setMyCreatedKBs(myCreatedKBs.filter(kb => kb.id !== kbId))
      // 刷新公开列表
      loadPublicKBs()
    } catch (error) {
      alert(error.message || '删除失败')
    }
  }

  // 处理加入知识库
  const handleJoinKB = async (kbId) => {
    try {
      await joinSharedKB(kbId)
      alert('加入成功')
      loadMyJoinedKBs()
    } catch (error) {
      alert(error.message || '加入失败')
    }
  }

  // 处理退出知识库
  const handleQuitKB = async (kbId) => {
    if (!window.confirm('确定要退出这个知识库吗？')) return

    try {
      await quitSharedKB(kbId)
      setMyJoinedKBs(myJoinedKBs.filter(kb => kb.id !== kbId))
    } catch (error) {
      alert(error.message || '退出失败')
    }
  }

  // 生成封面颜色
  const generateCover = (title) => {
    let hash = 0
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash)
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase().padStart(6, '0')
    return `#${c}`
  }

  // 过滤知识库
  const filteredPublicKBs = publicKBs.filter(kb => {
    if (!searchTerm) return true
    return kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           kb.description?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // 渲染知识库卡片
  const renderKBCard = (kb, showActions = false) => (
    <div key={kb.id} className="knowledge-base-card">
      <div
        className="kb-card-header"
        style={{ backgroundColor: kb.cover || generateCover(kb.name) }}
        onClick={() => {
          setSelectedKB(kb)
          setActiveTab('detail')
        }}
      >
        <div className="kb-card-title">{kb.name}</div>
      </div>
      <div className="kb-card-body">
        <h3 className="kb-title" onClick={() => {
          setSelectedKB(kb)
          setActiveTab('detail')
        }}>{kb.name}</h3>
        <p className="kb-description">{kb.description || '暂无描述'}</p>
        <div className="kb-meta">
          <div className="kb-author">
            <span className="author-name">{kb.owner_name || kb.ownerName}</span>
          </div>
          <div className="kb-stats">
            <span className="stat-item">📚 {kb.file_count || kb.fileCount || 0}</span>
            <span className="stat-item">👥 {kb.member_count || kb.memberCount || 0}</span>
          </div>
        </div>
        {showActions && (
          <div className="kb-card-actions">
            <span className={`public-badge ${kb.is_public ? 'public' : 'private'}`}>
              {kb.is_public ? '🔓 公开' : '🔒 私有'}
            </span>
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation()
                setEditingKB(kb)
                setShowEditModal(true)
              }}
            >
              编辑
            </button>
            <button
              className="action-btn delete"
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteKB(kb.id)
              }}
            >
              删除
            </button>
          </div>
        )}
        {!showActions && activeTab === 'discover' && (
          <button
            className="join-btn"
            onClick={(e) => {
              e.stopPropagation()
              handleJoinKB(kb.id)
            }}
          >
            加入知识库
          </button>
        )}
      </div>
    </div>
  )

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
            <h1 className="page-title">共享知识库</h1>
          </div>
          <div className="page-actions">
            <button className="create-btn" onClick={() => setShowCreateModal(true)}>
              + 创建知识库
            </button>
            <div className="user-info">
              <img src={user.avatar} alt={user.username} className="user-avatar" />
              <span className="username">{user.username}</span>
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'discover' ? 'active' : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            发现
          </button>
          <button
            className={`tab ${activeTab === 'my-created' ? 'active' : ''}`}
            onClick={() => { setActiveTab('my-created'); loadMyCreatedKBs(); }}
          >
            我创建的
          </button>
          <button
            className={`tab ${activeTab === 'my-joined' ? 'active' : ''}`}
            onClick={() => { setActiveTab('my-joined'); loadMyJoinedKBs(); }}
          >
            我加入的
          </button>
        </div>

        {/* 发现页 */}
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
            </div>

            {/* 分类标签 */}
            <div className="category-tabs">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 知识库列表 */}
            {loading ? (
              <div className="loading">加载中...</div>
            ) : (
              <>
                <div className="kb-count">共 {total} 个知识库</div>
                <div className="knowledge-bases-grid">
                  {filteredPublicKBs.length > 0 ? (
                    filteredPublicKBs.map(kb => renderKBCard(kb))
                  ) : (
                    <div className="empty">暂无知识库，快来创建第一个吧！</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* 我创建的 */}
        {activeTab === 'my-created' && (
          <div className="my-kb-content">
            {loading ? (
              <div className="loading">加载中...</div>
            ) : myCreatedKBs.length > 0 ? (
              <div className="knowledge-bases-grid">
                {myCreatedKBs.map(kb => renderKBCard(kb, true))}
              </div>
            ) : (
              <div className="empty">
                <p>您还没有创建任何共享知识库</p>
                <button className="create-btn" onClick={() => setShowCreateModal(true)}>
                  创建知识库
                </button>
              </div>
            )}
          </div>
        )}

        {/* 我加入的 */}
        {activeTab === 'my-joined' && (
          <div className="my-kb-content">
            {loading ? (
              <div className="loading">加载中...</div>
            ) : myJoinedKBs.length > 0 ? (
              <div className="knowledge-bases-grid">
                {myJoinedKBs.map(kb => (
                  <div key={kb.id} className="knowledge-base-card">
                    <div
                      className="kb-card-header"
                      style={{ backgroundColor: kb.cover || generateCover(kb.name) }}
                      onClick={() => {
                        setSelectedKB(kb)
                        setActiveTab('detail')
                      }}
                    >
                      <div className="kb-card-title">{kb.name}</div>
                    </div>
                    <div className="kb-card-body">
                      <h3 className="kb-title">{kb.name}</h3>
                      <p className="kb-description">{kb.description || '暂无描述'}</p>
                      <div className="kb-meta">
                        <div className="kb-author">
                          <span className="author-name">创建者: {kb.owner_name || kb.ownerName}</span>
                        </div>
                        <div className="kb-stats">
                          <span className="stat-item">📚 {kb.file_count || kb.fileCount || 0}</span>
                          <span className="stat-item">👥 {kb.member_count || kb.memberCount || 0}</span>
                        </div>
                      </div>
                      <button
                        className="quit-btn"
                        onClick={() => handleQuitKB(kb.id)}
                      >
                        退出知识库
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                <p>您还没有加入任何共享知识库</p>
                <button className="create-btn" onClick={() => setActiveTab('discover')}>
                  去发现
                </button>
              </div>
            )}
          </div>
        )}

        {/* 详情页 */}
        {activeTab === 'detail' && selectedKB && (
          <div className="detail-content">
            <button className="back-btn" onClick={() => setActiveTab(activeTab === 'detail' ? 'discover' : activeTab)}>
              ← 返回
            </button>
            <div className="detail-header">
              <div className="detail-cover" style={{ backgroundColor: selectedKB.cover || generateCover(selectedKB.name) }}>
                <h2>{selectedKB.name}</h2>
              </div>
              <div className="detail-info">
                <p className="detail-desc">{selectedKB.description || '暂无描述'}</p>
                <div className="detail-meta">
                  <span>创建者: {selectedKB.owner_name || selectedKB.ownerName}</span>
                  <span>分类: {selectedKB.category}</span>
                  <span>文件: {selectedKB.file_count || selectedKB.fileCount || 0}</span>
                  <span>成员: {selectedKB.member_count || selectedKB.memberCount || 0}</span>
                </div>
                {selectedKB.is_public && <span className="public-badge">🔓 公开</span>}
                {!selectedKB.is_public && <span className="public-badge private">🔒 私有</span>}
              </div>
            </div>
            <div className="detail-body">
              <p>知识库内容展示区域（待开发）</p>
            </div>
          </div>
        )}
      </div>

      {/* 创建模态框 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>创建共享知识库</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleCreateKB}>
              <div className="form-group">
                <label>名称 *</label>
                <input
                  type="text"
                  value={newKB.name}
                  onChange={e => setNewKB({ ...newKB, name: e.target.value })}
                  placeholder="请输入知识库名称"
                  required
                />
              </div>
              <div className="form-group">
                <label>简介</label>
                <textarea
                  value={newKB.description}
                  onChange={e => setNewKB({ ...newKB, description: e.target.value })}
                  placeholder="请输入知识库简介"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>分类</label>
                <select
                  value={newKB.category}
                  onChange={e => setNewKB({ ...newKB, category: e.target.value })}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newKB.is_public}
                    onChange={e => setNewKB({ ...newKB, is_public: e.target.checked })}
                  />
                  公开（允许其他人发现并加入）
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
      )}

      {/* 编辑模态框 */}
      {showEditModal && editingKB && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑知识库</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form className="modal-body" onSubmit={handleUpdateKB}>
              <div className="form-group">
                <label>名称 *</label>
                <input
                  type="text"
                  value={editingKB.name}
                  onChange={e => setEditingKB({ ...editingKB, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>简介</label>
                <textarea
                  value={editingKB.description || ''}
                  onChange={e => setEditingKB({ ...editingKB, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>分类</label>
                <select
                  value={editingKB.category || '推荐'}
                  onChange={e => setEditingKB({ ...editingKB, category: e.target.value })}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingKB.is_public || false}
                    onChange={e => setEditingKB({ ...editingKB, is_public: e.target.checked })}
                  />
                  公开（允许其他人发现并加入）
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="cancel-btn" onClick={() => setShowEditModal(false)}>
                  取消
                </button>
                <button type="submit" className="submit-btn">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SharedKnowledgeBasePage
