import React, { useState, useEffect, useRef } from 'react'
import '../styles/NotesPage.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function NotesPage({ user, onLogout, onShowSettings, onBackToHome, notes, currentNoteId, onSwitchNote, onEditNote, onDeleteNote, onCreateNewNote }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [markdownContent, setMarkdownContent] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState(null)
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isUndoingOrRedoing, setIsUndoingOrRedoing] = useState(false)
  const [showHeadingMenu, setShowHeadingMenu] = useState(false)
  const [viewMode, setViewMode] = useState('both') // 'both', 'edit', 'preview'
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isPastingImage, setIsPastingImage] = useState(false)
  // 图片存储：{ [imgId]: base64DataUrl }，与笔记内容分离，编辑区只存短 token
  const [imageMap, setImageMap] = useState({})
  const [noteSearch, setNoteSearch] = useState('')
  const titleInputRef = useRef(null)
  const textareaRef = useRef(null)
  
  // 监听文档点击，点击空白处关闭笔记菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      // 关闭所有打开的菜单
      const openMenus = document.querySelectorAll('.menu-dropdown.show');
      openMenus.forEach(menu => {
        const menuBtn = menu.previousElementSibling;
        if (menuBtn && !menuBtn.contains(event.target) && !menu.contains(event.target)) {
          menu.classList.remove('show');
        }
      });
      
      // 关闭标题菜单
      const headingMenu = document.querySelector('.heading-menu');
      const headingBtn = document.querySelector('.heading-menu-btn');
      if (headingMenu && headingBtn && !headingBtn.contains(event.target) && !headingMenu.contains(event.target)) {
        setShowHeadingMenu(false);
      }

      // 关闭导出菜单
      const exportContainer = document.querySelector('.export-menu-container');
      if (exportContainer && !exportContainer.contains(event.target)) {
        setShowExportMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [])

  // 当前选中的笔记
  const currentNote = notes.find(note => note.id === currentNoteId)

  // 当切换笔记时，更新编辑内容 & 加载该笔记的图片存储
  useEffect(() => {
    if (currentNote) {
      setMarkdownContent(currentNote.content || '')
      setNoteTitle(currentNote.title || '新笔记')
      // 从后端获取图片数据（存储在 currentNote.images 中）
      setImageMap(currentNote.images || {})
    } else {
      setImageMap({})
    }
  }, [currentNoteId, currentNote])

  // 当 imageMap 变化时，同步到后端
  useEffect(() => {
    if (!currentNoteId || !onEditNote) return
    if (Object.keys(imageMap).length > 0 || (currentNote && currentNote.images && Object.keys(currentNote.images).length > 0)) {
      const timer = setTimeout(() => {
        onEditNote(currentNoteId, { images: imageMap })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [imageMap, currentNoteId, onEditNote])

  // 当内容变化时，更新历史记录
  useEffect(() => {
    if (!isUndoingOrRedoing && currentNoteId) {
      // 只记录内容变化，标题变化不记录到撤销栈
      setHistoryIndex(prevIndex => {
        setHistory(prevHistory => {
          // 移除当前索引之后的历史记录
          const newHistory = prevHistory.slice(0, prevIndex + 1)
          // 添加新的历史记录
          newHistory.push(markdownContent)
          // 限制历史记录长度
          if (newHistory.length > 50) {
            newHistory.shift()
          }
          return newHistory
        })
        return prevIndex + 1
      })
    }
  }, [markdownContent, isUndoingOrRedoing, currentNoteId])

  // 当标题或内容变化时，更新笔记
  useEffect(() => {
    if (currentNoteId && onEditNote) {
      // 防抖处理，避免频繁更新
      const timer = setTimeout(() => {
        onEditNote(currentNoteId, {
          title: noteTitle,
          content: markdownContent
        })
      }, 300)
      
      return () => clearTimeout(timer)
    }
  }, [currentNoteId, noteTitle, markdownContent, onEditNote])

  // 处理标题编辑
  const handleTitleEdit = () => {
    setIsEditingTitle(true)
    setTimeout(() => {
      titleInputRef.current?.focus()
      titleInputRef.current?.select()
    }, 100)
  }

  // 处理标题保存
  const handleTitleSave = () => {
    setIsEditingTitle(false)
  }

  // 处理标题输入框回车
  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setNoteTitle(currentNote?.title || '新笔记')
      setIsEditingTitle(false)
    }
  }

  // 处理删除笔记确认
  const handleDeleteConfirm = () => {
    if (noteToDelete) {
      onDeleteNote(noteToDelete)
      setShowConfirmDelete(false)
      setNoteToDelete(null)
    }
  }

  // 处理删除笔记
  const handleDeleteNote = (noteId) => {
    setNoteToDelete(noteId)
    setShowConfirmDelete(true)
  }

  // 处理撤销操作
  const handleUndo = () => {
    if (historyIndex > 0) {
      setIsUndoingOrRedoing(true)
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setMarkdownContent(history[newIndex])
      // 延迟设置，确保内容更新完成后再设回false
      setTimeout(() => setIsUndoingOrRedoing(false), 100)
    }
  }

  // 处理重做操作
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setIsUndoingOrRedoing(true)
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setMarkdownContent(history[newIndex])
      // 延迟设置，确保内容更新完成后再设回false
      setTimeout(() => setIsUndoingOrRedoing(false), 100)
    }
  }

  // 公共：将一个 File/Blob 对象读成 base64，插入到编辑区光标处
  const insertImageFile = (file) => {
    setIsPastingImage(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target.result
      const imgId = `img_${Date.now()}`
      setImageMap(prev => ({ ...prev, [imgId]: base64 }))

      const textarea = textareaRef.current
      if (!textarea) { setIsPastingImage(false); return }

      const start = textarea.selectionStart
      const end   = textarea.selectionEnd
      const token = `![图片](img://${imgId})`
      const newContent =
        markdownContent.substring(0, start) + token + markdownContent.substring(end)

      setMarkdownContent(newContent)
      setIsPastingImage(false)

      setTimeout(() => {
        textarea.selectionStart = start + token.length
        textarea.selectionEnd   = start + token.length
        textarea.focus()
      }, 0)
    }
    reader.readAsDataURL(file)
  }

  // Ctrl+V 粘贴图片
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) insertImageFile(file)
        return
      }
    }
  }

  // 拖拽图片到编辑区
  const handleDrop = (e) => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length === 0) return
    e.preventDefault()
    files.forEach(insertImageFile)
  }

  const handleDragOver = (e) => {
    if (Array.from(e.dataTransfer.items).some(i => i.type.startsWith('image/'))) {
      e.preventDefault()
    }
  }

  // 点击上传图片（隐藏 input）
  const imageInputRef = useRef(null)
  const handleImageInputChange = (e) => {
    Array.from(e.target.files).forEach(insertImageFile)
    e.target.value = '' // 允许重复选同一文件
  }

  // ── 导出功能 ─────────────────────────────────────────────────

  // 把 img://imgId 还原为真实 base64，用于 Markdown 导出
  const resolveImageTokens = (content) =>
    content.replace(/\(img:\/\/([^)]+)\)/g, (_, imgId) => {
      const b64 = imageMap[imgId]
      return b64 ? `(${b64})` : `(img://${imgId})`
    })

  const triggerDownload = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // 导出为 Markdown（图片内嵌 base64）
  const exportAsMarkdown = () => {
    if (!currentNote) return
    const resolved = resolveImageTokens(markdownContent)
    triggerDownload(resolved, `${noteTitle || '笔记'}.md`, 'text/markdown')
    setShowExportMenu(false)
  }

  // 导出为 HTML（直接使用已渲染的预览 DOM）
  const exportAsHTML = () => {
    if (!currentNote) return
    const previewEl = document.querySelector('.preview-content')
    const bodyHTML  = previewEl ? previewEl.innerHTML : '<p>（无内容）</p>'

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${noteTitle || '笔记'}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:860px;margin:40px auto;padding:0 24px;color:#333;line-height:1.75}
    h1{font-size:2em;border-bottom:1px solid #eee;padding-bottom:.3em}
    h2{font-size:1.5em;border-bottom:1px solid #eee;padding-bottom:.2em}
    h3{font-size:1.25em}
    img{max-width:100%;border-radius:4px;display:block;margin:8px 0}
    code{background:#f5f5f5;padding:2px 6px;border-radius:3px;font-family:monospace;font-size:.9em}
    pre{background:#f5f5f5;padding:16px;border-radius:6px;overflow-x:auto}
    pre code{background:none;padding:0}
    blockquote{border-left:4px solid #ddd;margin:0;padding-left:16px;color:#666}
    table{border-collapse:collapse;width:100%;margin:12px 0}
    th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
    th{background:#f5f5f5;font-weight:600}
    a{color:#0066cc}
    hr{border:none;border-top:1px solid #eee;margin:24px 0}
  </style>
</head>
<body>
  <h1>${noteTitle || '笔记'}</h1>
  ${bodyHTML}
</body>
</html>`

    triggerDownload(html, `${noteTitle || '笔记'}.html`, 'text/html')
    setShowExportMenu(false)
  }

  // 处理格式化操作
  const handleFormat = (formatType) => {
    const textarea = document.querySelector('.note-editor')
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = textarea.value.substring(start, end)
    let formattedText = ''

    switch (formatType) {
      case 'bold':
        formattedText = `**${selectedText}**`
        break
      case 'italic':
        formattedText = `*${selectedText}*`
        break
      case 'underline':
        formattedText = `<u>${selectedText}</u>`
        break
      case 'h1':
        formattedText = `# ${selectedText || '一级标题'}`
        break
      case 'h2':
        formattedText = `## ${selectedText || '二级标题'}`
        break
      case 'h3':
        formattedText = `### ${selectedText || '三级标题'}`
        break
      case 'h4':
        formattedText = `#### ${selectedText || '四级标题'}`
        break
      case 'h5':
        formattedText = `##### ${selectedText || '五级标题'}`
        break
      case 'h6':
        formattedText = `###### ${selectedText || '六级标题'}`
        break
      case 'bullet':
        formattedText = `- ${selectedText || '列表项'}`
        break
      case 'numbered':
        formattedText = `1. ${selectedText || '列表项'}`
        break
      case 'quote':
        formattedText = `> ${selectedText || '引用内容'}`
        break
      case 'code':
        formattedText = `\`${selectedText || '代码'}\``
        break
      case 'codeblock':
        formattedText = `\`\`\`\n${selectedText || '代码块'}\n\`\`\``
        break
      case 'link':
        formattedText = `[${selectedText || '链接文本'}](http://example.com)`
        break
      case 'image':
        formattedText = `![${selectedText || '图片描述'}](http://example.com/image.jpg)`
        break
      case 'table':
        formattedText = `| 标题1 | 标题2 | 标题3 |\n|-------|-------|-------|\n| 内容1 | 内容2 | 内容3 |\n| 内容4 | 内容5 | 内容6 |`
        break

      default:
        formattedText = selectedText
    }

    // 替换选中的文本
    const newContent = markdownContent.substring(0, start) + formattedText + markdownContent.substring(end)
    setMarkdownContent(newContent)

    // 设置光标位置
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = start + formattedText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 100)
  }

  // 渲染笔记列表项
  const renderNoteItem = (note) => {
    const isActive = note.id === currentNoteId
    return (
      <div 
        key={note.id} 
        className={`note-item ${isActive ? 'active' : ''}`}
      >
        <div 
          className="note-item-content"
          onClick={() => onSwitchNote(note.id)}
        >
          <div className="note-item-title">{note.title}</div>
          <div className="note-item-date">
            {new Date(note.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <div className="note-item-menu">
          <button 
            className="menu-btn"
            onClick={(e) => {
              e.stopPropagation()
              const menu = e.currentTarget.nextElementSibling
              menu.classList.toggle('show')
            }}
          >
            ⋮
          </button>
          <div className="menu-dropdown">
            <div 
              className="menu-item edit"
              onClick={(e) => {
                e.stopPropagation()
                const menu = e.currentTarget.parentElement
                menu.classList.remove('show')
                const newTitle = prompt('请输入新的笔记标题:', note.title)
                if (newTitle && newTitle.trim()) {
                  onEditNote(note.id, { title: newTitle.trim() })
                }
              }}
            >
              <span className="menu-icon">
                <svg t="1770619563078" className="icon" viewBox="0 0 1025 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3605" width="16" height="16"><path d="M982.492729 997.546667H44.224284a42.666667 42.666667 0 1 1 0-85.276445h938.268445a42.666667 42.666667 0 0 1 0 85.304889zM154.674062 846.620444a85.304889 85.304889 0 0 1-81.891555-62.264888 81.464889 81.464889 0 0 1 0-47.331556l56.746666-178.716444a42.666667 42.666667 0 0 1 10.24-16.611556l192.341334-200.874667L634.048284 38.4a127.943111 127.943111 0 0 1 180.849778 0l60.558222 60.586667a127.943111 127.943111 0 0 1 0 180.792889L573.490062 581.319111l-192.768 200.448a42.666667 42.666667 0 0 1-19.626666 11.52l-183.808 49.891556a80.611556 80.611556 0 0 1-22.613334 3.413333z m52.053334-253.326222l-52.053334 168.021334 172.743111-47.331556L513.358507 521.614222l170.609777-172.743111-119.011555-118.983111-170.581333 170.609778-187.676445 192.768zM625.486507 167.623111l120.718222 120.689778L814.869618 219.648a42.666667 42.666667 0 0 0 0-60.558222L754.738062 98.986667a42.666667 42.666667 0 0 0-60.558222 0l-68.664889 68.664889z" fill="#000000" p-id="3606" data-spm-anchor-id="a313x.collections_detail.0.i8.1bd73a819pnOeb" class="selected"></path></svg>
              </span>
              <span className="menu-text">重命名</span>
            </div>
            <div 
              className="menu-item delete"
              onClick={(e) => {
                e.stopPropagation()
                const menu = e.currentTarget.parentElement
                menu.classList.remove('show')
                setNoteToDelete(note.id)
                setShowConfirmDelete(true)
              }}
            >
              <span className="menu-icon">
                <svg t="1770619629957" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3758" width="16" height="16"><path d="M874.011741 138.270167v746.665215c0 29.35461-12.003532 57.457666-33.336825 78.22207A115.455776 115.455776 0 0 1 760.234184 995.555611h-511.999004c-30.179497 0-59.135885-11.6622-80.469177-32.398159a109.084232 109.084232 0 0 1-33.30838-78.22207V138.270167h739.554118z m-85.333168 82.972283h-568.887783V884.906937c0 7.338652 2.986661 14.364417 8.305762 19.56974 5.347545 5.176879 12.57242 8.078207 20.138628 8.078206h511.999004c7.537763 0 14.791082-2.901328 20.110183-8.078206a27.278169 27.278169 0 0 0 8.334206-19.56974V221.24245z m-383.999253 580.720648c-23.580399 0-42.666584-18.545742-42.666584-41.471919V428.658935c0-22.897733 19.086185-41.471919 42.666584-41.471919 23.551954 0 42.666584 18.574186 42.666583 41.471919v331.860688c0 22.926178-19.114629 41.471919-42.666583 41.47192z m199.110724 0c-23.580399 0-42.666584-18.545742-42.666584-41.471919V428.658935c0-22.897733 19.086185-41.471919 42.666584-41.471919 23.551954 0 42.666584 18.574186 42.666583 41.471919v331.860688c0 22.926178-19.114629 41.471919-42.666583 41.47192z m355.554864-580.720648h-910.220452c-23.580399 0-42.666584-18.574186-42.666584-41.500364 0-22.897733 19.086185-41.471919 42.666584-41.471919h910.220452c23.551954 0 42.666584 18.574186 42.666584 41.471919 0 22.926178-19.114629 41.500364-42.666584 41.500364z m-331.377133-138.268176l7.111097 55.295893h-261.68838l7.111097-55.295893h247.466186zM652.998837 0.001991h-297.52831c-28.842611-0.227555-53.304785 20.565293-56.888779 48.383906l-21.902179 172.856553h455.110226l-22.186624-172.856553c-3.612437-27.818613-28.074612-48.611461-56.888778-48.355462h0.284444z" fill="#000000" p-id="3759"></path></svg>
              </span>
              <span className="menu-text">删除</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="notes-page">
      {/* 侧边栏 */}
      <div className={`notes-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {isSidebarCollapsed ? (
          <div className="sidebar-collapsed">
            <div 
              className="sidebar-logo-collapsed" 
              onClick={onBackToHome}
            >
              <div className="raven-icon-small"></div>
            </div>
            <button 
              className="collapse-btn expand"
              onClick={() => setIsSidebarCollapsed(false)}
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
                onClick={onBackToHome}
              >
                <div className="raven-icon-large"></div>
                <h2>Corvus Note</h2>
              </div>
              <button 
                className="collapse-btn"
                onClick={() => setIsSidebarCollapsed(true)}
                title="折叠侧边栏"
              >
                <svg t="1770616512859" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3452" width="24" height="24"><path d="M296.476444 468.622222c10.723556 0.028444 20.963556 4.664889 28.558223 12.885334l431.047111 468.622222a46.734222 46.734222 0 0 1-0.995556 61.013333 38.115556 38.115556 0 0 1-56.120889 1.052445L267.918222 543.601778A45.624889 45.624889 0 0 1 256 512.540444c0-11.662222 4.295111-22.840889 11.946667-31.032888a39.111111 39.111111 0 0 1 28.529777-12.885334zM727.523556 0c10.695111 0.028444 20.963556 4.664889 28.558222 12.885333 7.623111 8.192 11.918222 19.370667 11.918222 31.061334 0 11.662222-4.295111 22.840889-11.946667 31.032889L325.063111 543.601778a38.115556 38.115556 0 0 1-56.120889-1.080889 46.734222 46.734222 0 0 1-0.995555-61.013333L698.965333 12.885333A39.111111 39.111111 0 0 1 727.523556 0z" fill="#000000" p-id="3453"></path></svg>
              </button>
            </div>
            
            <button className="new-chat-btn" onClick={onCreateNewNote}>
              <svg t="1770615999507" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3299" width="20" height="20"><path d="M153.6 102.4a51.2 51.2 0 0 0-51.2 51.2v544a51.2 51.2 0 0 0 51.2 51.2h99.214222a51.2 51.2 0 0 1 51.2 51.2v89.969778l271.473778-135.736889c7.111111-3.555556 14.933333-5.404444 22.897778-5.432889H870.4a51.2 51.2 0 0 0 51.2-51.2V512a51.2 51.2 0 1 1 102.4 0v185.6a153.6 153.6 0 0 1-153.6 153.6h-259.896889L275.655111 1018.624a51.2 51.2 0 0 1-74.040889-45.795556v-121.628444H153.6a153.6 153.6 0 0 1-153.6-153.6V153.6A153.6 153.6 0 0 1 153.6 0h300.8a51.2 51.2 0 0 1 0 102.4H153.6zM771.214222 0a51.2 51.2 0 0 1 51.2 51.2v121.6h121.6a51.2 51.2 0 0 1 0 102.4h-121.6v121.6a51.2 51.2 0 1 1-102.4 0V275.2h-121.6a51.2 51.2 0 0 1 0-102.4h121.571556V51.2a51.2 51.2 0 0 1 51.2-51.2h0.028444z" fill="#000000" p-id="3300"></path></svg>
              新建笔记
            </button>
          </>
        )}
        
        {/* 笔记搜索 */}
        {!isSidebarCollapsed && (
          <div style={{ padding: '0 12px 8px' }}>
            <div style={{ position: 'relative' }}>
              <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="13" height="13" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <path d="M839.566222 774.826667l170.894222 170.922666a45.539556 45.539556 0 0 1 0 64.796445 46.136889 46.136889 0 0 1-32.398222 13.454222 46.136889 46.136889 0 0 1-32.398222-13.454222L774.826667 839.68a473.713778 473.713778 0 0 1-636.017778-30.833778A473.827556 473.827556 0 0 1 473.770667 0C735.402667 0 947.484444 212.110222 947.484444 473.799111c0 112.213333-39.594667 217.941333-107.946666 301.056zM473.770667 91.733333c-210.887111 0.341333-381.724444 171.207111-382.065778 382.094223 0 211.000889 171.064889 382.094222 382.065778 382.094222s382.037333-171.093333 382.037333-382.094222c0-211.029333-171.036444-382.094222-382.037333-382.094223z" fill="#aaa"/>
              </svg>
              <input
                type="text"
                placeholder="搜索笔记..."
                value={noteSearch}
                onChange={e => setNoteSearch(e.target.value)}
                style={{ width: '100%', padding: '6px 10px 6px 28px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* 笔记列表 */}
        <div className="notes-list">
          {notes.length > 0 ? (
            notes
              .filter(n =>
                n.title?.toLowerCase().includes(noteSearch.toLowerCase()) ||
                n.content?.toLowerCase().includes(noteSearch.toLowerCase())
              )
              .map(note => renderNoteItem(note))
          ) : (
            <div className="empty-notes">
              <div className="empty-notes-text">暂无笔记</div>
              <div className="empty-notes-hint">点击上方按钮新建笔记</div>
            </div>
          )}
        </div>
      </div>
      
      {/* 主内容区 */}
      <div className={`notes-main-content ${isSidebarCollapsed ? 'expanded' : ''} ${viewMode === 'edit' ? 'view-mode-edit' : viewMode === 'preview' ? 'view-mode-preview' : ''}`}>
        {/* 页面头部 */}
        <div className="notes-header">
          <div className="header-left">
            {isEditingTitle ? (
              <input 
                ref={titleInputRef}
                type="text" 
                className="note-title-input"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={handleTitleKeyDown}
              />
            ) : (
              <div 
                className="note-title"
                onClick={handleTitleEdit}
              >
                {noteTitle}
              </div>
            )}
          </div>
          <div className="header-right">
            {/* 导出按钮 */}
            {currentNote && (
              <div className="export-menu-container">
                <button
                  className="export-btn"
                  onClick={() => setShowExportMenu(v => !v)}
                  title="导出笔记"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  导出
                </button>
                {showExportMenu && (
                  <div className="export-dropdown">
                    <button className="export-option" onClick={exportAsMarkdown}>
                      <span className="export-option-icon">📝</span>
                      导出为 Markdown (.md)
                    </button>
                    <button className="export-option" onClick={exportAsHTML}>
                      <span className="export-option-icon">🌐</span>
                      导出为 HTML (.html)
                    </button>
                  </div>
                )}
              </div>
            )}
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
        
        {/* 编辑工具栏 */}
        <div className="editor-toolbar">
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={handleUndo} title="撤销">
              <svg t="1770875877260" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1398" width="16" height="16"><path d="M223.300267 221.320533h410.555733c214.493867 0 388.437333 173.192533 388.437333 386.798934 0 213.674667-173.943467 386.8672-388.437333 386.8672H116.053333a64.580267 64.580267 0 0 1-64.7168-64.512c0-35.566933 29.013333-64.443733 64.7168-64.443734h517.802667a258.389333 258.389333 0 0 0 258.935467-257.911466 258.389333 258.389333 0 0 0-258.935467-257.8432h-415.061333L293.546667 424.823467a64.3072 64.3072 0 0 1-28.672 108.7488 64.853333 64.853333 0 0 1-62.941867-17.6128L19.114667 333.687467a64.375467 64.375467 0 0 1 0-91.204267L201.9328 60.074667a64.9216 64.9216 0 0 1 91.613867 0 64.3072 64.3072 0 0 1 0 91.136l-70.314667 70.0416z" fill="#333333" p-id="1399"></path></svg>
            </button>
            <button className="toolbar-btn" onClick={handleRedo} title="重做">
              <svg t="1770875849512" className="icon" viewBox="0 0 1092 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1245" width="16" height="16"><path d="M828.893867 220.091733H418.338133C203.844267 220.091733 29.969067 393.216 29.969067 606.890667c0 213.674667 173.8752 386.798933 388.369066 386.798933h517.802667a64.580267 64.580267 0 0 0 64.7168-64.443733 64.580267 64.580267 0 0 0-64.7168-64.443734H418.338133A258.389333 258.389333 0 0 1 159.402667 606.890667a258.389333 258.389333 0 0 1 258.935466-257.911467h415.1296l-74.888533 74.615467a64.3072 64.3072 0 0 0 28.672 108.7488 64.853333 64.853333 0 0 0 62.941867-17.6128l183.022933-182.272a64.375467 64.375467 0 0 0 0-91.272534L850.193067 58.914133a64.9216 64.9216 0 0 0-91.5456 0 64.3072 64.3072 0 0 0 0 91.136l70.314666 70.0416z" fill="#333333" p-id="1246"></path></svg>
            </button>
          </div>
          
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => handleFormat('bold')} title="加粗">
              <svg t="1770875917152" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1551" width="16" height="16"><path d="M318.621538 499.003077v383.842461h156.278154c76.721231 0 131.387077-13.390769 164.076308-40.172307 32.689231-26.860308 49.073231-70.971077 49.073231-132.489846 0-81.053538-17.250462-136.507077-51.672616-166.360616-34.422154-29.932308-88.221538-44.819692-161.476923-44.819692H318.621538z m0-375.256615v268.051692h153.6c63.645538 0 109.804308-12.209231 138.31877-36.627692 28.593231-24.418462 42.850462-55.138462 42.850461-92.16 0-49.309538-14.099692-84.834462-42.220307-106.57477-28.120615-21.819077-74.436923-32.689231-138.948924-32.68923h-153.6zM185.895385 15.202462h289.004307c99.800615 0 176.758154 21.582769 230.793846 64.669538 54.035692 43.165538 81.132308 104.211692 81.132308 183.138462 0 42.299077-14.336 80.580923-42.929231 115.003076-28.514462 34.500923-71.364923 56.083692-128.393846 64.748308 64.039385 9.609846 114.215385 37.021538 150.685539 82.077539 36.391385 45.134769 54.587077 111.300923 54.587077 198.498461 0 88.457846-28.987077 155.175385-86.961231 200.388923-57.974154 45.056-144.305231 67.662769-258.914462 67.662769H185.816615V15.202462z" fill="#333333" p-id="1552"></path></svg>
            </button>
            <button className="toolbar-btn" onClick={() => handleFormat('italic')} title="斜体">
              <svg t="1770875827336" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2464" width="16" height="16"><path d="M329.649231 72.625231h510.739692L820.066462 177.230769H626.845538l-137.216 709.553231H682.929231l-20.322462 104.605538H151.788308l20.322461-104.605538H364.701538L502.547692 177.230769H309.326769z" fill="#333333" p-id="2465"></path></svg>
            </button>
            <button className="toolbar-btn" onClick={() => handleFormat('underline')} title="下划线">
              <svg t="1770875946609" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1857" width="16" height="16"><path d="M236.780308 1023.369846v-118.153846H864.098462v118.153846H236.780308zM313.659077 6.774154h-118.153846v472.615384a354.461538 354.461538 0 0 0 708.923077 0v-472.615384h-118.153846v472.615384a236.307692 236.307692 0 1 1-472.615385 0v-472.615384z m0 0h-118.153846v472.615384a354.461538 354.461538 0 0 0 708.923077 0v-472.615384h-118.153846v472.615384a236.307692 236.307692 0 1 1-472.615385 0v-472.615384z" fill="#333333" p-id="1858"></path></svg>
            </button>
          </div>
          
          <div className="toolbar-group">
            <div className="heading-menu-container">
              <button 
                className="toolbar-btn heading-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowHeadingMenu(!showHeadingMenu);
                }}
                title="标题"
              >
                H1
                <span className="dropdown-arrow">▼</span>
              </button>
              {showHeadingMenu && (
                <div className="heading-menu">
                  <button className="heading-menu-item" onClick={() => { handleFormat('h1'); setShowHeadingMenu(false); }}>H1 一级标题</button>
                  <button className="heading-menu-item" onClick={() => { handleFormat('h2'); setShowHeadingMenu(false); }}>H2 二级标题</button>
                  <button className="heading-menu-item" onClick={() => { handleFormat('h3'); setShowHeadingMenu(false); }}>H3 三级标题</button>
                  <button className="heading-menu-item" onClick={() => { handleFormat('h4'); setShowHeadingMenu(false); }}>H4 四级标题</button>
                  <button className="heading-menu-item" onClick={() => { handleFormat('h5'); setShowHeadingMenu(false); }}>H5 五级标题</button>
                  <button className="heading-menu-item" onClick={() => { handleFormat('h6'); setShowHeadingMenu(false); }}>H6 六级标题</button>
                </div>
              )}
            </div>
          </div>
          
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => handleFormat('bullet')} title="无序列表">
              <svg t="1770876703519" className="icon" viewBox="0 0 1102 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2316" width="16" height="16"><path d="M93.105231 187.943385a78.769231 78.769231 0 1 1 0-157.538462 78.769231 78.769231 0 0 1 0 157.538462z m0 393.846153a78.769231 78.769231 0 1 1 0-157.538461 78.769231 78.769231 0 0 1 0 157.538461z m0 393.846154a78.769231 78.769231 0 1 1 0-157.538461 78.769231 78.769231 0 0 1 0 157.538461zM276.243692 161.792v-118.153846h787.692308v118.153846H276.243692z m0.472616 397.233231v-118.153846h788.007384v118.153846H276.716308z m-3.308308 397.154461v-118.153846h789.267692v118.153846H273.329231z" fill="#333333" p-id="2317"></path></svg>
            </button>
            <button className="toolbar-btn" onClick={() => handleFormat('numbered')} title="有序列表">
              <svg t="1770876725467" className="icon" viewBox="0 0 1097 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2469" width="16" height="16"><path d="M330.313143 225.499429v-109.714286h728.356571v109.714286H330.313143z m1.974857 369.005714v-109.714286h728.722286v109.714286H332.288z m-0.438857 365.129143v-109.714286h727.259428v109.714286H331.849143zM179.126857 49.298286v212.992h-58.88V122.733714c-9.508571 7.241143-18.724571 13.092571-27.648 17.554286s-20.041143 8.777143-33.499428 12.873143V105.325714c19.748571-6.363429 35.181714-14.043429 46.08-22.966857 10.971429-8.996571 19.602286-20.041143 25.746285-33.133714h48.201143z m38.4 578.706285H42.934857c2.048-17.261714 8.045714-33.499429 18.285714-48.64 10.093714-15.213714 29.110857-33.133714 57.051429-53.833142 17.042286-12.653714 27.940571-22.235429 32.694857-28.818286a32.329143 32.329143 0 0 0 7.094857-18.724572 21.869714 21.869714 0 0 0-7.021714-16.384 24.649143 24.649143 0 0 0-17.773714-6.729142 24.795429 24.795429 0 0 0-18.285715 6.948571c-4.681143 4.681143-7.826286 12.946286-9.508571 24.722286l-58.221714-4.681143c2.267429-16.384 6.436571-29.184 12.580571-38.4a58.368 58.368 0 0 1 25.746286-21.138286c11.117714-4.900571 26.477714-7.314286 46.08-7.314286 20.48 0 36.425143 2.340571 47.762286 6.948572a58.148571 58.148571 0 0 1 26.916571 21.504c6.509714 9.654857 9.728 20.48 9.728 32.548571a66.56 66.56 0 0 1-11.190857 36.571429c-7.460571 11.629714-21.065143 24.356571-40.740572 38.253714-11.702857 8.045714-19.602286 13.750857-23.552 17.042286a215.259429 215.259429 0 0 0-13.897142 12.653714h90.843428v47.469714zM103.643429 844.8l-55.003429-9.874286a69.046857 69.046857 0 0 1 26.331429-40.228571c13.019429-9.435429 31.451429-14.043429 55.296-14.043429 27.282286 0 47.030857 5.12 59.245714 15.286857 12.214857 10.166857 18.285714 22.966857 18.285714 38.4a42.934857 42.934857 0 0 1-7.387428 24.576 63.122286 63.122286 0 0 1-22.454858 19.309715c8.045714 1.974857 14.262857 4.315429 18.578286 6.948571a45.348571 45.348571 0 0 1 16.237714 16.969143 51.2 51.2 0 0 1 5.778286 25.088 69.851429 69.851429 0 0 1-9.581714 35.108571 64.146286 64.146286 0 0 1-27.574857 25.819429c-11.995429 5.997714-27.794286 9.069714-47.323429 9.069714-19.017143 0-34.011429-2.267429-45.056-6.729143a67.291429 67.291429 0 0 1-27.136-19.675428 90.258286 90.258286 0 0 1-16.384-32.475429l58.148572-7.753143c2.340571 11.702857 5.851429 19.894857 10.678857 24.356572 4.827429 4.534857 10.971429 6.802286 18.285714 6.802286 7.899429 0 14.336-2.852571 19.529143-8.557715a32.694857 32.694857 0 0 0 7.826286-22.820571 31.744 31.744 0 0 0-7.533715-22.601143 26.550857 26.550857 0 0 0-20.333714-8.045714c-4.534857 0-10.825143 1.170286-18.870857 3.437714l2.998857-41.545143a55.588571 55.588571 0 0 0 7.606857 0.731429 26.550857 26.550857 0 0 0 19.017143-7.314286 23.113143 23.113143 0 0 0 7.68-17.261714 20.626286 20.626286 0 0 0-5.705143-15.36 21.211429 21.211429 0 0 0-15.725714-5.632 23.04 23.04 0 0 0-16.749714 6.217143c-4.242286 4.096-7.168 11.410286-8.704 21.796571z" fill="#333333" p-id="2470"></path></svg>
            </button>
            <button className="toolbar-btn" onClick={() => handleFormat('quote')} title="引用">
              <svg t="1770876794334" className="icon" viewBox="0 0 1211 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2775" width="16" height="16"><path d="M1206.243142 309.434182c0.279273 268.567273-142.429091 517.585455-376.180364 656.011636a87.412364 87.412364 0 0 1-92.625454 8.936727 84.712727 84.712727 0 0 1-47.010909-79.127272 84.992 84.992 0 0 1 53.34109-75.124364c102.4-60.229818 184.32-148.945455 235.52-254.882909h-28.392727c-142.987636 0-258.885818-114.129455-258.885818-254.976 0-140.753455 115.898182-254.882909 258.792727-254.882909 143.080727 0 258.978909 114.129455 258.978909 254.882909l-3.444363-0.837818z m-690.362182 0c0 268.288-142.801455 516.840727-376.180364 655.173818a87.412364 87.412364 0 0 1-92.718545 8.936727 84.712727 84.712727 0 0 1-46.917818-79.127272 84.992 84.992 0 0 1 53.341091-75.124364c102.4-60.229818 184.32-148.945455 235.52-254.882909H260.439505C117.451869 564.410182 1.646778 450.280727 1.646778 309.434182 1.646778 168.680727 117.358778 54.551273 260.439505 54.551273c142.987636 0 258.978909 114.129455 258.97891 254.882909h-3.537455z" fill="#333333" p-id="2776"></path></svg>
            </button>
          </div>
          
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => handleFormat('code')} title="行内代码">
              <svg t="1770878503468" className="icon" viewBox="0 0 1339 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3081" width="16" height="16"><path d="M351.940923 876.622769a59.076923 59.076923 0 1 1-102.715077 58.446769L25.993846 542.72a59.076923 59.076923 0 0 1 0.078769-58.683077l223.31077-388.647385a59.076923 59.076923 0 0 1 102.4 58.840616l-206.375385 359.424 206.532923 362.889846z m619.283692 0l206.532923-362.889846-206.375384-359.424a59.076923 59.076923 0 0 1 102.4-58.840615l223.310769 388.647384a59.076923 59.076923 0 0 1 0.078769 58.683077l-223.232 392.270769a59.076923 59.076923 0 0 1-102.715077-58.446769zM733.892923 109.804308a59.076923 59.076923 0 1 1 112.482462 36.233846L593.92 930.343385a59.076923 59.076923 0 1 1-112.403692-36.155077l252.376615-784.541539z" fill="#333333" p-id="3082"></path></svg>
            </button>
            <button className="toolbar-btn" onClick={() => handleFormat('codeblock')} title="代码块">
              <svg t="1770877228565" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4321" width="16" height="16"><path d="M338.986667 59.413333h52.586666a21.333333 21.333333 0 0 1 21.333334 21.333334V115.84a21.333333 21.333333 0 0 1-21.333334 21.333333H356.266667c-36.48 0-53.76 20.16-53.76 62.4v188.16c0 59.52-27.84 99.84-82.56 120 54.72 23.04 82.56 62.4 82.56 120v189.12c0 40.32 17.28 61.44 53.76 61.44h35.306666a21.333333 21.333333 0 0 1 21.333334 21.333334v35.093333a21.333333 21.333333 0 0 1-21.333334 21.333333H338.986667c-42.24 0-74.88-14.4-97.92-41.28-21.12-24.96-31.68-59.52-31.68-101.76v-180.48c0-27.84-5.76-48-17.28-60.48-11.178667-12.778667-29.653333-20.245333-55.466667-23.488a18.901333 18.901333 0 0 1-16.533333-18.773333v-43.221333c0-10.005333 7.381333-18.474667 17.28-19.84 25.408-3.498667 43.648-11.456 54.72-23.317334 11.52-13.44 17.28-33.6 17.28-60.48V203.413333c0-43.2 10.56-77.76 31.68-102.72 23.04-27.84 55.68-41.28 97.92-41.28z m292.48 0h52.586666c42.24 0 74.88 13.44 97.92 41.28 21.12 24.96 31.68 59.52 31.68 102.72v179.52c0 26.88 5.76 48 18.24 61.44 10.24 11.029333 28.224 18.816 53.418667 22.314667 10.112 1.408 17.621333 10.026667 17.621333 20.245333v40.746667a21.333333 21.333333 0 0 1-18.88 21.184c-24.576 3.413333-42.282667 10.794667-53.12 23.189333-11.52 12.48-17.28 32.64-17.28 60.48v180.48c0 42.24-10.56 76.8-31.68 101.76-23.04 26.88-55.68 41.28-97.92 41.28H631.466667a21.333333 21.333333 0 0 1-21.333334-21.333333V899.626667a21.333333 21.333333 0 0 1 21.333334-21.333334h35.306666c35.52 0 53.76-21.12 53.76-61.44v-189.12c0-57.6 26.88-96.96 82.56-120-55.68-20.16-82.56-60.48-82.56-120v-188.16c0-42.24-18.24-62.4-53.76-62.4H631.466667a21.333333 21.333333 0 0 1-21.333334-21.333333V80.746667a21.333333 21.333333 0 0 1 21.333334-21.333334z" fill="#000000" p-id="4322"></path></svg>
            </button>
          </div>
          
          <div className="toolbar-group">
            <button className="toolbar-btn" onClick={() => handleFormat('link')} title="链接">
              <svg t="1770644624749" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4326" width="16" height="16"><path d="M473.04201 163.539656A218.858722 218.858722 0 0 0 163.539656 473.04201l102.276279 102.276278a50.512422 50.512422 0 1 1-71.388615 71.473941l-102.304721-102.333163c-123.436888-125.143389-122.754288-326.482036 1.564293-450.800616 124.290138-124.290138 325.628786-124.972739 450.800616-1.535851l-34.983265 34.954824 34.983265-34.954824 102.276279 102.276279a50.512422 50.512422 0 0 1-71.388615 71.47394L473.098893 163.539656h-0.056883z m281.686391 210.269335a50.512422 50.512422 0 0 1 71.417057 0l104.039663 104.039663c124.944297 124.887414 124.944297 327.420612 0.028442 452.364909-124.887414 124.915855-327.449054 124.915855-452.364909 0l-104.039663-104.039663a50.512422 50.512422 0 1 1 71.417056-71.445499l104.039663 104.039663a218.858722 218.858722 0 1 0 309.502354-309.44547l-104.039663-104.068105a50.512422 50.512422 0 0 1 0-71.445498z" fill="#000000" p-id="4327"></path><path d="M385.157221 385.100337c20.534892-20.478009 53.754774-20.478009 74.289666 0l236.179705 236.151264a52.588665 52.588665 0 1 1-74.34655 74.403433l-236.122821-236.151264a52.560223 52.560223 0 0 1 0-74.403433z" fill="#000000" p-id="4328"></path></svg>
            </button>
            <button className="toolbar-btn" onClick={() => imageInputRef.current?.click()} title="上传图片（也可直接粘贴或拖拽）">
              <svg t="1770876745062" className="icon" viewBox="0 0 1297 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2622" width="16" height="16"><path d="M1158.690133 747.1104V146.432H138.103467v520.260267L470.4256 384.341333l330.205867 327.543467 176.605866-163.84 181.384534 199.0656z m102.4-703.0784v918.596267H35.703467V44.032h1225.386666z" fill="#333333" p-id="2623"></path></svg>
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleImageInputChange}
            />
            <button className="toolbar-btn" onClick={() => handleFormat('table')} title="表格">
              <svg t="1770879190564" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="16413" width="16" height="16"><path d="M819.525818 46.545455H204.474182A158.068364 158.068364 0 0 0 46.545455 204.427636v615.051637A158.114909 158.114909 0 0 0 204.474182 977.454545h615.051636A158.068364 158.068364 0 0 0 977.454545 819.479273V204.427636A158.021818 158.021818 0 0 0 819.525818 46.545455zM405.317818 618.682182V405.317818h213.317818v213.364364H405.317818z m213.317818 69.818182V907.636364H405.317818v-219.136h213.317818zM116.363636 405.317818h219.136v213.364364H116.363636V405.317818z m288.954182-69.818182V116.363636h213.317818v219.136H405.317818z m283.136 69.818182H907.636364v213.364364h-219.182546V405.317818zM907.636364 204.427636v131.025455h-219.182546V116.363636h131.072c48.593455 0 88.110545 39.470545 88.110546 88.064zM204.474182 116.363636h130.978909v219.136H116.363636V204.427636c0-48.593455 39.563636-88.064 88.110546-88.064zM116.363636 819.479273v-130.978909h219.136V907.636364H204.474182A88.250182 88.250182 0 0 1 116.363636 819.479273zM819.525818 907.636364h-131.072v-219.136H907.636364v130.978909a88.250182 88.250182 0 0 1-88.110546 88.157091z" fill="#231815" p-id="16414"></path></svg>
            </button>
          </div>
          
          <div className="toolbar-group">
            <button 
              className="toolbar-btn"
              onClick={() => setViewMode(viewMode === 'edit' ? 'both' : 'edit')}
              title={viewMode === 'edit' ? '恢复默认视图' : '只显示编辑区'}
            >
              <svg t="1770879107941" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15323" width="16" height="16"><path d="M810.666667 85.333333a128 128 0 0 1 128 128v597.333334a128 128 0 0 1-128 128H213.333333a128 128 0 0 1-128-128V213.333333a128 128 0 0 1 128-128h597.333334zM341.333333 170.666667H213.333333l-5.802666 0.426666a42.538667 42.538667 0 0 0-36.48 36.437334L170.666667 213.333333v597.333334l0.426666 5.802666a42.538667 42.538667 0 0 0 36.437334 36.48L213.333333 853.333333h128V170.666667z m469.333334 0h-384v682.666666h384l5.802666-0.426666a42.538667 42.538667 0 0 0 36.48-36.437334L853.333333 810.666667V213.333333l-0.426666-5.802666A42.538667 42.538667 0 0 0 810.666667 170.666667z" fill="#2c2c2c" p-id="15324" transform="rotate(180 512 512)"></path></svg>
            </button>
            <button 
              className="toolbar-btn"
              onClick={() => setViewMode(viewMode === 'preview' ? 'both' : 'preview')}
              title={viewMode === 'preview' ? '恢复默认视图' : '只显示预览区'}
            >
              <svg t="1770879107941" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15323" width="16" height="16"><path d="M810.666667 85.333333a128 128 0 0 1 128 128v597.333334a128 128 0 0 1-128 128H213.333333a128 128 0 0 1-128-128V213.333333a128 128 0 0 1 128-128h597.333334zM341.333333 170.666667H213.333333l-5.802666 0.426666a42.538667 42.538667 0 0 0-36.48 36.437334L170.666667 213.333333v597.333334l0.426666 5.802666a42.538667 42.538667 0 0 0 36.437334 36.48L213.333333 853.333333h128V170.666667z m469.333334 0h-384v682.666666h384l5.802666-0.426666a42.538667 42.538667 0 0 0 36.48-36.437334L853.333333 810.666667V213.333333l-0.426666-5.802666A42.538667 42.538667 0 0 0 810.666667 170.666667z" fill="#2c2c2c" p-id="15324"></path></svg>
            </button>
          </div>
        </div>
        
        {/* 编辑区域 */}
        <div className="editor-container">
          {/* 左侧：Markdown编辑 */}
          <div className="editor-panel markdown-editor">
            <div className="panel-header">
              <div className="panel-title">编辑</div>
            </div>
            {isPastingImage && (
              <div className="paste-image-indicator">正在处理图片...</div>
            )}
            <textarea
              ref={textareaRef}
              className="note-editor"
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              placeholder="开始编写你的笔记...\n\n支持Markdown格式，例如：\n- **粗体**\n- *斜体*\n- # 标题\n- - 列表项\n\n图片：粘贴（Ctrl+V）/ 拖拽 / 点击工具栏图片按钮"
              spellCheck={false}
            />
          </div>
          
          {/* 右侧：预览 */}
          <div className="editor-panel preview-panel">
            <div className="panel-header">
              <div className="panel-title">预览</div>
            </div>
            <div className="preview-content">
              {markdownContent ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  urlTransform={(url) => {
                    // 解析短 token → 真实 base64（数据在 imageMap 中）
                    if (url.startsWith('img://')) return imageMap[url.slice(6)] || ''
                    // 普通网络图片
                    if (/^(https?|mailto|ircs?|xmpp):/.test(url)) return url
                    return ''
                  }}
                  components={{
                    u: ({ node, inline, className, children, ...props }) => (
                      <u {...props}>{children}</u>
                    ),
                    img: ({ node, src, alt, ...props }) => (
                      <img
                        src={src}
                        alt={alt || ''}
                        style={{ maxWidth: '100%', borderRadius: 4 }}
                        {...props}
                      />
                    ),
                  }}
                >
                  {markdownContent}
                </ReactMarkdown>
              ) : (
                <div className="empty-preview">
                  <div className="empty-preview-text">实时预览将显示在这里</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 删除确认模态框 */}
      {showConfirmDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">确认删除</div>
              <button 
                className="modal-close-btn"
                onClick={() => setShowConfirmDelete(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>您确定要删除这条笔记吗？此操作不可恢复。</p>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn cancel-btn"
                onClick={() => setShowConfirmDelete(false)}
              >
                取消
              </button>
              <button 
                className="modal-btn delete-btn"
                onClick={handleDeleteConfirm}
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotesPage
