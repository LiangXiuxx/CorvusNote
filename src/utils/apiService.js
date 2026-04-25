/**
 * 后端 REST API 封装
 * 所有对话、消息、笔记的 CRUD 操作都通过此模块调用，
 * API Key 仅存在于后端，前端不持有任何密钥。
 */

// 使用相对路径，通过 Vite 代理转发到后端，彻底避免跨域问题
const API_BASE = ''

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('corvusNoteToken') || ''}`,
})

/**
 * 统一请求包装：遇到 401 自动清除 token 并跳回登录页，
 * 避免用户卡在"已登录但 token 失效"的状态。
 * 注意：游客用户不需要 token，所以遇到 401 时不应该清除游客用户信息
 */
const request = async (url, options) => {
  const res = await fetch(url, options)
  if (res.status === 401) {
    // 检查是否是游客用户
    const userData = localStorage.getItem('corvusNoteUser')
    const user = userData ? JSON.parse(userData) : null
    
    // 只有非游客用户才清除信息并跳回登录页
    if (!user || !user.isGuest) {
      localStorage.removeItem('corvusNoteToken')
      localStorage.removeItem('corvusNoteUser')
      window.location.reload()
      // reload 后代码不再执行，抛出异常仅作保险
      throw new Error('登录已过期，请重新登录')
    }
  }
  return res
}

// ── Conversations ──────────────────────────────────────────────

export const fetchConversations = async ({ skip = 0, limit = 100 } = {}) => {
  const res = await request(
    `${API_BASE}/api/conversations?skip=${skip}&limit=${limit}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error('获取对话列表失败')
  return res.json()
}

export const createConversation = async (title) => {
  const res = await request(`${API_BASE}/api/conversations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('创建对话失败')
  return res.json()
}

export const updateConversation = async (id, title) => {
  const res = await request(`${API_BASE}/api/conversations/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('更新对话失败')
  return res.json()
}

export const deleteConversationApi = async (id) => {
  const res = await request(`${API_BASE}/api/conversations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('删除对话失败')
}

// ── Messages ───────────────────────────────────────────────────

export const fetchMessages = async (conversationId, { skip = 0, limit = 200 } = {}) => {
  const res = await request(
    `${API_BASE}/api/messages/conversation/${conversationId}?skip=${skip}&limit=${limit}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error('获取消息失败')
  return res.json()
}

/**
 * 保存单条消息到后端
 * @param {string} conversationId
 * @param {{ role: string, content: string, file?: object|null, mounted_knowledge_bases?: string[] }} msg
 */
export const saveMessage = async (conversationId, { role, content, file = null, mounted_knowledge_bases = [] }) => {
  const res = await request(`${API_BASE}/api/messages/conversation/${conversationId}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ role, content, file, mounted_knowledge_bases }),
  })
  if (!res.ok) throw new Error('保存消息失败')
  return res.json()
}

// ── Notes ──────────────────────────────────────────────────────

export const fetchNotes = async ({ skip = 0, limit = 100 } = {}) => {
  const res = await request(
    `${API_BASE}/api/notes?skip=${skip}&limit=${limit}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error('获取笔记列表失败')
  return res.json()
}

export const createNoteApi = async ({ title, content }) => {
  const res = await request(`${API_BASE}/api/notes`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
  })
  if (!res.ok) throw new Error('创建笔记失败')
  return res.json()
}

export const updateNoteApi = async (id, { title, content, images }) => {
  const res = await request(`${API_BASE}/api/notes/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ title, content, images }),
  })
  if (!res.ok) throw new Error('更新笔记失败')
  return res.json()
}

export const deleteNoteApi = async (id) => {
  const res = await request(`${API_BASE}/api/notes/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('删除笔记失败')
}

// ── Shared Knowledge Bases ────────────────────────────────────────

export const fetchPublicKBs = async ({ category, search, skip = 0, limit = 20 } = {}) => {
  let url = `${API_BASE}/api/shared-kb/public?skip=${skip}&limit=${limit}`
  if (category) url += `&category=${encodeURIComponent(category)}`
  if (search) url += `&search=${encodeURIComponent(search)}`
  const res = await request(url, { headers: authHeaders() })
  if (!res.ok) throw new Error('获取公开知识库失败')
  return res.json()
}

export const fetchMyCreatedKBs = async ({ skip = 0, limit = 100 } = {}) => {
  const res = await request(
    `${API_BASE}/api/shared-kb/my-created?skip=${skip}&limit=${limit}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error('获取我创建的知识库失败')
  return res.json()
}

export const fetchMyJoinedKBs = async () => {
  const res = await request(`${API_BASE}/api/shared-kb/my-joined`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('获取我加入的知识库失败')
  return res.json()
}

export const fetchSharedKBDetail = async (id) => {
  const res = await request(`${API_BASE}/api/shared-kb/${id}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('获取知识库详情失败')
  return res.json()
}

export const createSharedKB = async ({ name, description, category, is_public, cover }) => {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('description', description || '')
  formData.append('category', category || '推荐')
  formData.append('is_public', is_public || false)
  if (cover) formData.append('cover', cover)

  const res = await request(`${API_BASE}/api/shared-kb`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('corvusNoteToken') || ''}`,
    },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '创建失败' }))
    throw new Error(err.detail || '创建知识库失败')
  }
  return res.json()
}

export const updateSharedKB = async (id, { name, description, category, is_public, cover }) => {
  const res = await request(`${API_BASE}/api/shared-kb/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ name, description, category, is_public, cover }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '更新失败' }))
    throw new Error(err.detail || '更新知识库失败')
  }
  return res.json()
}

export const deleteSharedKB = async (id) => {
  const res = await request(`${API_BASE}/api/shared-kb/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('删除知识库失败')
}

export const joinSharedKB = async (id) => {
  const res = await request(`${API_BASE}/api/shared-kb/${id}/join`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '加入失败' }))
    throw new Error(err.detail || '加入知识库失败')
  }
  return res.json()
}

export const quitSharedKB = async (id) => {
  const res = await request(`${API_BASE}/api/shared-kb/${id}/quit`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '退出失败' }))
    throw new Error(err.detail || '退出知识库失败')
  }
}

export const uploadToSharedKB = async (kbId, file) => {
  const formData = new FormData()
  formData.append('file', file)

  const res = await request(`${API_BASE}/api/shared-kb/${kbId}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('corvusNoteToken') || ''}`,
    },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '上传失败' }))
    throw new Error(err.detail || '上传文件失败')
  }
  return res.json()
}

export const fetchSharedKBFiles = async (kbId) => {
  const res = await request(`${API_BASE}/api/shared-kb/${kbId}/files`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('获取文件列表失败')
  return res.json()
}

export const fetchSharedKBFileContent = async (kbId, fileId) => {
  const res = await request(`${API_BASE}/api/shared-kb/${kbId}/files/${fileId}/content`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '获取文件内容失败' }))
    throw new Error(err.detail || '获取文件内容失败')
  }
  return res.json()
}

export const deleteSharedKBFile = async (kbId, fileId) => {
  const res = await request(`${API_BASE}/api/shared-kb/${kbId}/files/${fileId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('删除文件失败')
}

// ── 个人知识库 ──────────────────────────────────────────────

export const fetchKnowledgeBases = async ({ skip = 0, limit = 100 } = {}) => {
  const res = await request(
    `${API_BASE}/api/knowledge-bases?skip=${skip}&limit=${limit}`,
    { headers: authHeaders() }
  )
  if (!res.ok) throw new Error('获取知识库列表失败')
  return res.json()
}

export const createKnowledgeBase = async (data) => {
  const res = await request(`${API_BASE}/api/knowledge-bases`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '创建失败' }))
    throw new Error(err.detail || '创建知识库失败')
  }
  return res.json()
}

export const getKnowledgeBase = async (kbId) => {
  const res = await request(`${API_BASE}/api/knowledge-bases/${kbId}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('获取知识库详情失败')
  return res.json()
}

export const updateKnowledgeBase = async (kbId, data) => {
  const res = await request(`${API_BASE}/api/knowledge-bases/${kbId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '更新失败' }))
    throw new Error(err.detail || '更新知识库失败')
  }
  return res.json()
}

export const deleteKnowledgeBase = async (kbId) => {
  const res = await request(`${API_BASE}/api/knowledge-bases/${kbId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error('删除知识库失败')
}

export const uploadToKnowledgeBase = async (kbId, file, strategyMode = 'auto', chunkSize = null, chunkOverlap = null, topK = null, scoreThreshold = null) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('strategy_mode', strategyMode)
  
  if (strategyMode === 'manual') {
    if (chunkSize) formData.append('chunk_size', chunkSize)
    if (chunkOverlap) formData.append('chunk_overlap', chunkOverlap)
    if (topK) formData.append('top_k', topK)
    if (scoreThreshold) formData.append('score_threshold', scoreThreshold)
  }

  const res = await request(`${API_BASE}/api/knowledge-bases/${kbId}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('corvusNoteToken') || ''}`,
    },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: '上传失败' }))
    throw new Error(err.detail || '上传文件失败')
  }
  return res.json()
}
