/**
 * 发现广场 — 只负责浏览公开知识库、搜索、加入
 * 管理（上传/删除/创建）全部在 KnowledgeBasePage 完成
 */
import React, { useState, useEffect, useCallback } from 'react'
import '../styles/SharedKnowledgeBasePage.css'
import {
  fetchPublicKBs, fetchSharedKBDetail,
  fetchSharedKBFiles, fetchSharedKBFileContent,
  joinSharedKB, quitSharedKB,
  fetchMyJoinedKBs,
} from '../utils/apiService'

const CATEGORIES = ['推荐', '科技', '教育', '职场', '财经', '产业', '健康', '法律', '人文', '生活']

function SharedKnowledgeBasePage({ user, onBackToHome, onNavigateToPersonalKnowledge }) {
  const [kbList, setKbList]               = useState([])
  const [total, setTotal]                 = useState(0)
  const [loading, setLoading]             = useState(false)
  const [searchTerm, setSearchTerm]       = useState('')
  const [category, setCategory]           = useState('推荐')

  const [detailKB, setDetailKB]           = useState(null)   // 当前预览的KB
  const [detailFiles, setDetailFiles]     = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [joinedIds, setJoinedIds]         = useState(new Set()) // 已加入的KB id集合

  const [viewingDoc, setViewingDoc]       = useState(null)
  const [docLoading, setDocLoading]       = useState(false)

  const [toast, setToast]                 = useState(null)

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // 加载公开知识库列表
  const loadKBs = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPublicKBs({
        category: category !== '推荐' ? category : undefined,
        search:   searchTerm || undefined,
      })
      setKbList(data.items || [])
      setTotal(data.total || 0)
    } catch (e) {
      showToast('加载失败: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [category, searchTerm])

  useEffect(() => { loadKBs() }, [category])

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(loadKBs, 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  // 加载已加入的 KB ids（用于按钮状态）
  useEffect(() => {
    if (!user || user.isGuest) return
    fetchMyJoinedKBs()
      .then(list => setJoinedIds(new Set((list || []).map(k => k.id))))
      .catch(() => {})
  }, [user])

  // 点击 KB 卡片 → 加载详情
  const openDetail = async (kb) => {
    setDetailLoading(true)
    setDetailKB(null)
    setDetailFiles([])
    setViewingDoc(null)
    try {
      const [detail, files] = await Promise.all([
        fetchSharedKBDetail(kb.id),
        fetchSharedKBFiles(kb.id),
      ])
      setDetailKB(detail)
      setDetailFiles(files || [])
    } catch (e) {
      showToast('加载详情失败: ' + e.message, 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailKB(null)
    setDetailFiles([])
    setViewingDoc(null)
  }

  // 加入
  const handleJoin = async () => {
    if (!detailKB) return
    try {
      await joinSharedKB(detailKB.id)
      setJoinedIds(prev => new Set([...prev, detailKB.id]))
      showToast('已成功加入，请在左侧「知识库」页面管理', 'success')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // 退出
  const handleQuit = async () => {
    if (!detailKB || !window.confirm(`确定退出「${detailKB.name}」？`)) return
    try {
      await quitSharedKB(detailKB.id)
      setJoinedIds(prev => { const s = new Set(prev); s.delete(detailKB.id); return s })
      showToast('已退出知识库', 'info')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // 预览文件
  const handleFileClick = async (file) => {
    setDocLoading(true)
    setViewingDoc({ name: file.name, content: null })
    try {
      const data = await fetchSharedKBFileContent(detailKB.id, file.id)
      setViewingDoc(data)
    } catch (e) {
      showToast('无法预览: ' + e.message, 'error')
      setViewingDoc(null)
    } finally {
      setDocLoading(false)
    }
  }

  const isJoined = detailKB ? joinedIds.has(detailKB.id) : false
  const isOwner  = detailKB ? detailKB.owner_id === user?.id : false

  return (
    <div className="shared-knowledge-base-page">
      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:9999, padding:'10px 20px', borderRadius:8,
          background: toast.type==='error'?'#ff4d4f':toast.type==='success'?'#52c41a':'#1890ff',
          color:'#fff', boxShadow:'0 4px 12px rgba(0,0,0,.2)', fontSize:14, maxWidth:320 }}>
          {toast.msg}
        </div>
      )}

      <div className="main-content">
        {/* 页面头部 */}
        <div className="page-header">
          <div className="header-left">
            <div className="logo" onClick={onBackToHome} style={{ cursor:'pointer' }}>
              <div className="raven-icon"></div>
            </div>
            <h1 className="page-title">发现广场</h1>
          </div>
          <div className="page-actions">
            <button
              className="submit-btn"
              style={{ marginRight: 12, fontSize: 13 }}
              onClick={onNavigateToPersonalKnowledge}
            >
              ← 返回知识库
            </button>
            <div className="user-info">
              <img src={user?.avatar} alt={user?.username} className="user-avatar" />
              <span className="username">{user?.username}</span>
            </div>
          </div>
        </div>

        {/* 发现内容 */}
        <div className="discover-content">
          {/* 搜索栏 */}
          <div className="search-bar">
            <input
              type="text"
              placeholder="搜索知识库名称或简介"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button className="search-btn" onClick={loadKBs}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5z" fill="currentColor" />
              </svg>
            </button>
          </div>

          {/* 分类标签 */}
          <div className="category-tabs">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`category-tab ${category === cat ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >{cat}</button>
            ))}
          </div>

          {/* 知识库列表 */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p className="loading-text">加载中...</p>
            </div>
          ) : kbList.length === 0 ? (
            <div style={{ textAlign:'center', color:'#999', padding:60 }}>暂无符合条件的知识库</div>
          ) : (
            <>
              <div className="knowledge-bases-grid">
                {kbList.map(kb => (
                  <div key={kb.id} className="knowledge-base-card" onClick={() => openDetail(kb)}>
                    <div className="kb-card-header">
                      {kb.cover
                        ? <img src={kb.cover} alt={kb.name} className="kb-cover" />
                        : <div className="kb-cover" style={{ background:`hsl(${(kb.name?.charCodeAt(0)||0)*137%360},60%,55%)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:28, fontWeight:700 }}>
                            {kb.name?.[0]}
                          </div>
                      }
                    </div>
                    <div className="kb-card-body">
                      <h3 className="kb-title">{kb.name}</h3>
                      <p className="kb-description">{kb.description || '暂无简介'}</p>
                      <div className="kb-meta">
                        <div className="kb-author">
                          <span className="author-name">@{kb.owner_name}</span>
                        </div>
                        <div className="kb-stats">
                          <span className="stat-item">{kb.member_count ?? 0} 人</span>
                          <span className="stat-item">{kb.file_count ?? 0} 个文件</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign:'center', color:'#bbb', fontSize:13, padding:'8px 0' }}>
                共 {total} 个公开知识库
              </div>
            </>
          )}
        </div>
      </div>

      {/* 知识库详情抽屉（modal）*/}
      {(detailKB || detailLoading) && (
        <div className="document-modal-overlay" onClick={closeDetail}>
          <div className="document-modal" style={{ maxWidth: 680, width: '90vw' }}
            onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div className="loading-container" style={{ padding: 60 }}>
                <div className="loading-spinner" />
                <p className="loading-text">加载中...</p>
              </div>
            ) : detailKB && (
              <>
                <div className="document-modal-header">
                  <div style={{ flex: 1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <h2 className="document-title" style={{ margin:0 }}>{detailKB.name}</h2>
                      <span style={{ fontSize:11, padding:'1px 7px', borderRadius:4, background:'#e6f4ff', color:'#1890ff' }}>{detailKB.category}</span>
                    </div>
                    <div style={{ fontSize:12, color:'#999' }}>
                      @{detailKB.owner_name} · {detailKB.member_count??0} 成员 · {detailKB.file_count??0} 个文件
                    </div>
                  </div>
                  <div className="document-actions" style={{ flexShrink:0, gap:8 }}>
                    {!isOwner && !isJoined && (
                      <button className="submit-btn" onClick={handleJoin}>加入知识库</button>
                    )}
                    {!isOwner && isJoined && (
                      <>
                        <button
                          className="submit-btn"
                          style={{ background:'#f0f5ff', color:'#597ef7', border:'1px solid #adc6ff' }}
                          onClick={onNavigateToPersonalKnowledge}
                        >去管理 →</button>
                        <button className="cancel-btn" onClick={handleQuit}>退出</button>
                      </>
                    )}
                    <button className="close-btn" onClick={closeDetail}>×</button>
                  </div>
                </div>

                {detailKB.description && (
                  <div style={{ padding:'8px 20px', fontSize:13, color:'#555', borderBottom:'1px solid #f0f0f0' }}>
                    {detailKB.description}
                  </div>
                )}

                {/* 文件列表（只读预览） */}
                <div className="document-modal-content" style={{ padding:0 }}>
                  {detailFiles.length === 0 ? (
                    <div style={{ textAlign:'center', color:'#bbb', padding:40, fontSize:14 }}>暂无文件</div>
                  ) : (
                    <div style={{ padding:'8px 0' }}>
                      {detailFiles.map(file => (
                        <div
                          key={file.id}
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', cursor:'pointer', transition:'background .15s' }}
                          onMouseEnter={e => e.currentTarget.style.background='#f5f5f5'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}
                          onClick={() => handleFileClick(file)}
                        >
                          <span>📄</span>
                          <span style={{ flex:1, fontSize:14 }}>{file.name}</span>
                          <span style={{ fontSize:12, color:'#bbb' }}>{formatSize(file.file_size)}</span>
                          <span style={{ fontSize:11, color:'#ccc' }}>@{file.uploader_name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 文件预览弹窗 */}
      {viewingDoc && (
        <div className="document-modal-overlay" style={{ zIndex:1100 }}>
          <div className="document-modal" onClick={e => e.stopPropagation()}>
            <div className="document-modal-header">
              <h2 className="document-title">{viewingDoc.name}</h2>
              <div className="document-actions">
                <button className="close-btn" onClick={() => setViewingDoc(null)}>×</button>
              </div>
            </div>
            <div className="document-modal-content">
              {docLoading ? (
                <div className="loading-container">
                  <div className="loading-spinner" />
                  <p className="loading-text">加载中...</p>
                </div>
              ) : viewingDoc.content ? (
                <div className="document-content-container">
                  <div className="document-content">
                    {viewingDoc.content.split('\n').map((line, i) => {
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
                <div style={{ textAlign:'center', color:'#999', padding:40 }}>无法预览此文件类型</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SharedKnowledgeBasePage
