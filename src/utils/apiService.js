/**
 * 后端 REST API 封装
 * 所有对话、消息、笔记的 CRUD 操作都通过此模块调用，
 * API Key 仅存在于后端，前端不持有任何密钥。
 */

const API_BASE = 'http://localhost:8000'

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('corvusNoteToken') || ''}`,
})

/**
 * 统一请求包装：遇到 401 自动清除 token 并跳回登录页，
 * 避免用户卡在"已登录但 token 失效"的状态。
 */
const request = async (url, options) => {
  const res = await fetch(url, options)
  if (res.status === 401) {
    localStorage.removeItem('corvusNoteToken')
    localStorage.removeItem('corvusNoteUser')
    window.location.reload()
    // reload 后代码不再执行，抛出异常仅作保险
    throw new Error('登录已过期，请重新登录')
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

export const updateNoteApi = async (id, { title, content }) => {
  const res = await request(`${API_BASE}/api/notes/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
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
