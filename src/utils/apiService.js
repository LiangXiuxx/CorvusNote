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
