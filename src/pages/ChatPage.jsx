import React, { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { generateMindMap } from '../utils/langchainService'
import '../styles/ChatPage.css'

// Markmap渲染组件 - 树状结构
const MarkmapRenderer = ({ data, markdown }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current || !markdown) return;
    
    try {
            
      // 清除之前的渲染
      containerRef.current.innerHTML = '';
      
      // 修正Markdown格式
      let correctedMarkdown = markdown;
      correctedMarkdown = correctedMarkdown.replace(/^\s*#\s*#\s*(.*)$/gm, '## $1');
      correctedMarkdown = correctedMarkdown.replace(/^\s*#\s*#\s*#\s*(.*)$/gm, '### $1');
      
      // 解析Markdown为树状结构
      const tree = parseMarkdownToTree(correctedMarkdown);
            
      // 计算布局
      calculateLayout(tree);
      
      // 计算SVG尺寸
      const svgDimensions = calculateSvgDimensions(tree);
      
      
      // 创建SVG容器
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', `${svgDimensions.minX - 50} ${svgDimensions.minY - 50} ${svgDimensions.width + 100} ${svgDimensions.height + 100}`);
      svg.style.backgroundColor = '#fff';
      
      containerRef.current.appendChild(svg);
      
      // 渲染连接线
      renderConnections(svg, tree);
      
      // 渲染节点
      renderNodes(svg, tree);
      
      
      
    } catch (error) {
            containerRef.current.innerHTML = `
        <div style="padding: 20px; color: red; background: #fee; border: 1px solid #fcc; border-radius: 4px;">
          <h4 style="margin: 0 0 10px 0;">渲染思维导图失败</h4>
          <p>错误: ${error.message}</p>
        </div>
      `;
    }
  }, [markdown]);
  
  // 解析Markdown为树状结构
  const parseMarkdownToTree = (markdown) => {
    const lines = markdown.split('\n');
    let root = null;
    
    const stack = [];
    
    lines.forEach((line, index) => {
      line = line.trim();
      if (!line) return;
      
      if (line.startsWith('#')) {
        const level = line.match(/^#+/)?.[0].length || 0;
        const text = line.replace(/^#+\s*/, '').trim();
        
        // 清理栈
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }
        
        const newNode = {
          id: `node_${index}`,
          text: text,
          children: [],
          level: level
        };
        
        if (stack.length === 0) {
          // 根节点
          root = newNode;
        } else {
          // 子节点
          const parent = stack[stack.length - 1].node;
          parent.children.push(newNode);
        }
        
        stack.push({ node: newNode, level: level });
        
      } else if (line.startsWith('-') || line.startsWith('*')) {
        const text = line.substring(1).trim();
        if (stack.length > 0) {
          const parent = stack[stack.length - 1].node;
          
          parent.children.push({
            id: `node_${index}`,
            text: text,
            children: [],
            level: parent.level + 1
          });
        }
      }
    });
    
    // 如果没有根节点，创建默认节点
    if (!root) {
      root = {
        id: 'root',
        text: 'AI 回答',
        children: [],
        level: 0
      };
    }
    
    return root;
  };
  
  // 计算SVG尺寸
  const calculateSvgDimensions = (node) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    const traverse = (n) => {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
      
      if (n.children) {
        n.children.forEach(child => traverse(child));
      }
    };
    
    traverse(node);
    
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  };
  
  // 计算节点位置（从左到右的层次布局，上下对称）
  const calculateLayout = (node, depth = 0, x = 150, y = 200) => {
    // 设置当前节点位置
    node.x = x;
    node.y = y;
    
    if (!node.children || node.children.length === 0) return { minY: y, maxY: y };
    
    const horizontalSpacing = 200; // 水平间距
    const verticalSpacing = 70; // 垂直间距
    
    // 计算所有子节点的总高度
    let totalHeight = 0;
    const childHeights = [];
    
    for (const child of node.children) {
      const childLayout = calculateLayout(child, depth + 1, x + horizontalSpacing, 0);
      const childHeight = childLayout.maxY - childLayout.minY + verticalSpacing;
      childHeights.push(childHeight);
      totalHeight += childHeight;
    }
    
    // 从中间开始布局，实现上下对称
    let currentY = y - totalHeight / 2 + verticalSpacing / 2;
    
    node.children.forEach((child, index) => {
      // 递归计算子节点位置
      const childLayout = calculateLayout(child, depth + 1, x + horizontalSpacing, currentY);
      
      // 移动到下一个子节点位置
      currentY += childHeights[index];
    });
    
    // 计算当前节点及其子节点的最小和最大Y坐标
    let minY = y;
    let maxY = y;
    
    node.children.forEach(child => {
      minY = Math.min(minY, child.y);
      maxY = Math.max(maxY, child.y);
      // 递归查找子节点的最小和最大Y坐标
      const findMinMaxY = (n) => {
        if (n.children) {
          n.children.forEach(c => {
            minY = Math.min(minY, c.y);
            maxY = Math.max(maxY, c.y);
            findMinMaxY(c);
          });
        }
      };
      findMinMaxY(child);
    });
    
    return { minY, maxY };
  };
  
  // 渲染连接线（平滑曲线）
  const renderConnections = (svg, node) => {
    if (!node.children || node.children.length === 0) return;
    
    node.children.forEach(child => {
      // 创建平滑曲线连接
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      
      // 计算控制点，创建平滑曲线
      const controlPoint1X = node.x + 80; // 第一个控制点
      const controlPoint1Y = node.y;
      const controlPoint2X = child.x - 80; // 第二个控制点
      const controlPoint2Y = child.y;
      
      const pathData = `M ${node.x} ${node.y} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${child.x} ${child.y}`;
      
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', '#ccc');
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'mindmap-connection');
      
      svg.appendChild(path);
      
      // 递归渲染子节点的连接线
      renderConnections(svg, child);
    });
  };
  
  // 渲染节点（方形，根据文字长度动态调整大小）
  const renderNodes = (svg, node) => {
    // 根据层级设置不同的颜色
    const colors = ['#0078d7', '#0099bc', '#00b294', '#ff6b6b', '#ffa94d', '#7c3aed'];
    const color = colors[node.level] || colors[colors.length - 1];
    const fontSize = node.level === 0 ? 16 : 14 - node.level * 1;
    
    // 估算节点大小（根据文字长度）
    const textLength = node.text.length;
    const baseWidth = Math.max(80, textLength * 8); // 基础宽度，根据文字长度调整
    const baseHeight = 40; // 基础高度
    const nodeWidth = baseWidth;
    const nodeHeight = baseHeight;
    
    // 计算方形的位置
    const rectX = node.x - nodeWidth / 2;
    const rectY = node.y - nodeHeight / 2;
    
    // 创建节点方形
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', rectX);
    rect.setAttribute('y', rectY);
    rect.setAttribute('width', nodeWidth);
    rect.setAttribute('height', nodeHeight);
    rect.setAttribute('rx', 4); // 圆角
    rect.setAttribute('ry', 4);
    rect.setAttribute('fill', node.level === 0 ? color : '#fff');
    rect.setAttribute('stroke', color);
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('class', 'mindmap-node');
    rect.setAttribute('data-id', node.id);
    
    svg.appendChild(rect);
    
    // 创建节点文本
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', node.x);
    text.setAttribute('y', node.y + 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('fill', node.level === 0 ? '#fff' : '#333');
    text.setAttribute('font-size', Math.max(fontSize, 10));
    text.setAttribute('font-weight', node.level === 0 ? 'bold' : 'normal');
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.textContent = node.text;
    
    svg.appendChild(text);
    
    // 递归渲染子节点
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        renderNodes(svg, child);
      });
    }
  };
  
  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '800px', // 增加高度
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        background: '#fff',
        overflow: 'auto'
      }}
    />
  );
};

function ChatPage({ messages, setMessages, onNewChat, user, onLogout, onShowSettings, conversations, onSwitchConversation, currentConversationId, onEditConversation, onDeleteConversation, onBackToHome, models, selectedModel, onModelChange, isGenerating, onStopGeneration, onCreateNewNote, onEditNote, notes, setNotes }) {
  const [inputText, setInputText] = useState('')
  const [generatingMindMapIndex, setGeneratingMindMapIndex] = useState(-1)
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, node: null, messageIndex: -1 })
  const [expandedDownloadOptions, setExpandedDownloadOptions] = useState({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [convSearch, setConvSearch] = useState('')  // 对话搜索
  const [toast, setToast] = useState({ show: false, message: '' })
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isAIThinking, setIsAIThinking] = useState(false)
  const [collapsedReasoning, setCollapsedReasoning] = useState(new Set())
  const abortControllerRef = useRef(null)
  const [localGenerating, setLocalGenerating] = useState(false) // ChatPage 内的生成状态
  const prevGeneratingRef = useRef(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const messagesEndRef = useRef(null)
  const menusRef = useRef([])
  const inputRef = useRef(null)
  const formRef = useRef(null)
  
  // 知识库相关状态
  const [showKnowledgeBasePicker, setShowKnowledgeBasePicker] = useState(false)
  const [mountedKnowledgeBases, setMountedKnowledgeBases] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 生成结束时自动折叠思考过程面板
  useEffect(() => {
    const nowGenerating = isGenerating || localGenerating
    if (prevGeneratingRef.current && !nowGenerating) {
      setCollapsedReasoning(prev => {
        const newSet = new Set(prev)
        messagesRef.current.forEach((msg, idx) => {
          if (msg.role === 'assistant' && msg.reasoning) {
            newSet.add(idx)
          }
        })
        return newSet
      })
    }
    prevGeneratingRef.current = nowGenerating
  }, [isGenerating, localGenerating])

  // 监听文档点击，点击空白处关闭菜单、知识库选择器和移除输入框焦点
  useEffect(() => {
    const handleClickOutside = (event) => {
      // 检查点击是否在菜单或菜单按钮之外
      const isClickInsideMenu = menusRef.current.some(menu => {
        const menuBtn = menu.querySelector('.menu-btn');
        const menuDropdown = menu.querySelector('.menu-dropdown');
        return (
          menuBtn && menuBtn.contains(event.target) ||
          menuDropdown && menuDropdown.contains(event.target)
        );
      });

      if (!isClickInsideMenu) {
        // 关闭所有打开的菜单
        const openMenus = document.querySelectorAll('.menu-dropdown.show');
        openMenus.forEach(menu => {
          menu.classList.remove('show');
        });
      }
      
      // 点击空白处关闭知识库选择器
      if (showKnowledgeBasePicker) {
        const picker = document.querySelector('.knowledge-base-picker');
        const atBtn = document.querySelector('.at-button');
        if (picker && !picker.contains(event.target) && atBtn && !atBtn.contains(event.target)) {
          setShowKnowledgeBasePicker(false);
        }
      }
      
      // 点击空白处关闭右键菜单
      if (contextMenu.show) {
        const menu = document.querySelector('.mindmap-context-menu');
        if (!menu || !menu.contains(event.target)) {
          setContextMenu({ show: false, x: 0, y: 0, node: null, messageIndex: -1 });
        }
      }
      
      // 点击空白处关闭下载选项展开栏
      const isClickInsideDownloadOptions = event.target.closest('.mindmap-download-container');
      if (!isClickInsideDownloadOptions) {
        // 关闭所有打开的下载选项展开栏
        setExpandedDownloadOptions({});
      }
      
      // 点击其他区域移除输入框焦点
      if (isInputFocused && formRef.current && !formRef.current.contains(event.target)) {
        setIsInputFocused(false);
      }
    };

    // 添加事件监听器
    document.addEventListener('mousedown', handleClickOutside);

    // 清理函数
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showKnowledgeBasePicker, contextMenu.show, isInputFocused])
  
  // 加载知识库数据
  const loadKnowledgeBaseData = () => {
    if (user) {
      
      // 尝试从新的个人知识库存储中加载数据
      const personalSavedData = localStorage.getItem(`corvusNotePersonalKnowledgeBase_${user.id}`)
      
      if (personalSavedData) {
        const parsedData = JSON.parse(personalSavedData);
        
        return parsedData;
      }
      // 尝试从旧的存储中加载数据作为后备
      const oldSavedData = localStorage.getItem(`corvusNoteKnowledgeBase_${user.id}`)
      
      if (oldSavedData) {
        const parsedData = JSON.parse(oldSavedData);
        
        return parsedData;
      }
    }
    
    return []
  }
  
  // 递归获取所有文件（用于文件夹挂载时展开）
  const getAllFiles = (items, result = []) => {
    if (!items || !Array.isArray(items)) return result
    for (const item of items) {
      if (item.type === 'folder' && item.items) {
        getAllFiles(item.items, result)
      } else if (item.type !== 'folder') {
        result.push(item)
      }
    }
    return result
  }
  
  // 处理@符号点击
  const handleAtClick = () => {
    // 重新加载知识库数据
    const knowledgeBaseData = loadKnowledgeBaseData();
    const allFiles = getAllFiles(knowledgeBaseData);
    
    setShowKnowledgeBasePicker(!showKnowledgeBasePicker)
  }
  
  // 处理知识库挂载：文件直接挂载，文件夹直接挂载整个文件夹
  const handleMountKnowledgeBase = (item) => {
    setMountedKnowledgeBases(prev => {
      if (!prev.some(m => m.id === item.id)) return [...prev, item]
      return prev
    })
    setShowKnowledgeBasePicker(false)
  }
  
  // 处理知识库卸载
  const handleUnmountKnowledgeBase = (fileId) => {
    setMountedKnowledgeBases(prev => prev.filter(item => item.id !== fileId))
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (inputText.trim() || selectedFile) {
      const trimmedText = inputText.trim();
      
      // 准备用户显示内容，只包含问题和附件信息，不包含文件内容
      let userDisplayContent = trimmedText;
      if (selectedFile) {
        userDisplayContent = `${trimmedText}\n\n[附件: ${selectedFile.name}]`;
      }
      
      // 添加用户消息到列表（只显示问题和附件，不包含文件内容）
      const newMessages = [...messages, { 
        role: 'user', 
        content: userDisplayContent, 
        file: selectedFile,
        mountedKnowledgeBases: mountedKnowledgeBases // 传递挂载的知识库
      }];
      setMessages(newMessages);
      setInputText('');
      setSelectedFile(null);
      
      // 添加空的AI消息，用于流式输出
      const aiMessageIndex = newMessages.length;
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      // 设置AI正在思考状态
      setIsAIThinking(true);
      
      try {
        const { generateAIResponseWithHistory, generateConversationTitle } = await import('../utils/langchainService');

        abortControllerRef.current = new AbortController();
        setLocalGenerating(true);

        const finalResult = await generateAIResponseWithHistory(
          newMessages,
          (streamedContent) => {
            setMessages(prev => {
              const updated = [...prev];
              updated[aiMessageIndex] = { ...updated[aiMessageIndex], role: 'assistant', content: streamedContent };
              return updated;
            });
          },
          selectedModel, selectedFile, mountedKnowledgeBases, abortControllerRef.current
        );
        const finalContent = typeof finalResult === 'object' ? (finalResult?.content || '') : (finalResult || '')

        setLocalGenerating(false);

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

        // 持久化消息
        if (currentConversationId) {
          const { saveMessage, updateConversation } = await import('../utils/apiService');
          
          // 处理挂载的知识库，包括文件夹
          let allMountedItems = []
          for (const item of (mountedKnowledgeBases || [])) {
            if (item.type === 'folder') {
              allMountedItems.push(...getAllFilesFromFolder([item]))
            } else {
              allMountedItems.push(item)
            }
          }
          
          const kbIds = allMountedItems.filter(kb => kb.backendId).map(kb => kb.backendId);
          const fileMeta = selectedFile ? { name: selectedFile.name, type: selectedFile.type, size: selectedFile.size } : null;
          await saveMessage(currentConversationId, { role: 'user', content: userDisplayContent, file: fileMeta, mounted_knowledge_bases: kbIds });
          await saveMessage(currentConversationId, { role: 'assistant', content: finalContent || '' });

          // 若是第一轮（只有 1 条用户消息），AI 生成对话标题
          if (finalContent && newMessages.filter(m => m.role === 'user').length === 1) {
            generateConversationTitle(trimmedText, finalContent).then(async (title) => {
              if (title) {
                await updateConversation(currentConversationId, title);
              }
            }).catch(() => {});
          }
        }
      } catch (error) {
        setLocalGenerating(false);
                setMessages(prev => {
          const updated = [...prev];
          updated[aiMessageIndex] = { role: 'assistant', content: '抱歉，生成回复时遇到错误，请稍后再试。' };
          return updated;
        });
      } finally {
        setIsAIThinking(false);
      }
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleAttachClick = () => {
    fileInputRef.current?.click()
  }
  
  // 处理生成思维导图的点击事件
  const handleGenerateMindMap = async (content, message, index) => {
    try {
      
      
      
      
      setGeneratingMindMapIndex(index);
      
      const result = await generateMindMap(content);
      
      
      
      
      
      
      if (result.markdown) {
        
        // 确保markdown格式正确
        if (!result.markdown.startsWith('#')) {
          // 如果没有标题，添加一个默认标题
          result.markdown = `# 思维导图\n${result.markdown}`;
          
        }
        
        // 修正标题格式，将 `# # 标题` 转换为 `## 标题`
        result.markdown = result.markdown.replace(/^\s*#\s*#\s*(.*)$/gm, '## $1');
        // 修正三级标题格式，将 `# # # 标题` 转换为 `### 标题`
        result.markdown = result.markdown.replace(/^\s*#\s*#\s*#\s*(.*)$/gm, '### $1');
        
      }
      
      // 将生成的思维导图数据存储在对应的消息中
      const updatedMessages = [...messages];
      updatedMessages[index] = {
        ...updatedMessages[index],
        mindMapData: result
      };
      setMessages(updatedMessages);
      
    } catch (error) {
                } finally {
      setGeneratingMindMapIndex(-1);
      
    }
  }

  // 处理思维导图节点右键点击事件
  const handleNodeContextMenu = (e, node, messageIndex) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      node: node,
      messageIndex: messageIndex
    });
  };

  // 处理修改节点
  const handleEditNode = () => {
    if (contextMenu.node) {
      const newTitle = prompt('请输入新的节点标题:', contextMenu.node.title);
      if (newTitle && newTitle.trim()) {
        // 更新节点标题
        const updatedMessages = [...messages];
        const updateNodeTitle = (node) => {
          if (node === contextMenu.node) {
            node.title = newTitle.trim();
          } else if (node.children) {
            node.children.forEach(child => updateNodeTitle(child));
          }
        };
        updateNodeTitle(updatedMessages[contextMenu.messageIndex].mindMapData);
        setMessages(updatedMessages);
      }
    }
    setContextMenu({ show: false, x: 0, y: 0, node: null, messageIndex: -1 });
  };

  // 处理删除节点
  const handleDeleteNode = () => {
    if (contextMenu.node) {
      if (window.confirm('确定要删除这个节点吗？')) {
        // 删除节点
        const updatedMessages = [...messages];
        const deleteNode = (parentNode) => {
          if (parentNode.children) {
            const nodeIndex = parentNode.children.findIndex(child => child === contextMenu.node);
            if (nodeIndex !== -1) {
              parentNode.children.splice(nodeIndex, 1);
              return true;
            } else {
              for (const child of parentNode.children) {
                if (deleteNode(child)) {
                  return true;
                }
              }
            }
          }
          return false;
        };
        deleteNode(updatedMessages[contextMenu.messageIndex].mindMapData);
        setMessages(updatedMessages);
      }
    }
    setContextMenu({ show: false, x: 0, y: 0, node: null, messageIndex: -1 });
  };

  // 处理点击思维导图下载按钮
  const handleMindMapDownloadClick = (messageIndex) => {
    // 切换下载选项展开状态
    setExpandedDownloadOptions(prev => ({
      ...prev,
      [messageIndex]: !prev[messageIndex]
    }));
  };

  // 显示提示消息
  const showToast = (message) => {
    setToast({ show: true, message });
    // 3秒后自动隐藏
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 3000);
  };

  // 处理下载思维导图为Markdown格式
  const handleDownloadMindMapAsMarkdown = (message) => {
    if (message.mindMapData && message.mindMapData.markdown) {
      const blob = new Blob([message.mindMapData.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mindmap-' + Date.now() + '.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // 处理下载思维导图为图片格式
  const handleDownloadMindMapAsImage = (containerId) => {
    // 获取思维导图SVG元素
    
    const mindmapContainer = document.getElementById(containerId);
    
    
    if (mindmapContainer) {
      // 明确指定获取思维导图内容区域的SVG，而不是下载按钮的SVG
      const mindmapContent = mindmapContainer.querySelector('.mindmap-content');
      
      
      if (mindmapContent) {
        const mindmapElement = mindmapContent.querySelector('svg');
        
        
        if (mindmapElement) {
          // 将SVG转换为图片
          const svgData = new XMLSerializer().serializeToString(mindmapElement);
          
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            
            // 保持SVG的原始宽高比
            const svgWidth = mindmapElement.width.baseVal.value || 1200;
            const svgHeight = mindmapElement.height.baseVal.value || 800;
            
            
            // 计算合适的画布尺寸，保持宽高比
            const maxWidth = 1200;
            const maxHeight = 800;
            let canvasWidth = svgWidth;
            let canvasHeight = svgHeight;
            
            // 如果SVG尺寸超过最大尺寸，按比例缩放
            if (svgWidth > maxWidth || svgHeight > maxHeight) {
              const widthRatio = maxWidth / svgWidth;
              const heightRatio = maxHeight / svgHeight;
              const scale = Math.min(widthRatio, heightRatio);
              canvasWidth = svgWidth * scale;
              canvasHeight = svgHeight * scale;
              
            }
            
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            // 清空画布并设置背景色
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            // 按比例绘制图片
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
            
            // 下载图片
            try {
              const dataUrl = canvas.toDataURL('image/png');
              
              const a = document.createElement('a');
              a.href = dataUrl;
              a.download = 'mindmap-' + Date.now() + '.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              
            } catch (error) {
                          }
          };
          
          img.onerror = (error) => {
                      };
          
          img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgData);
        } else {
                  }
      } else {
              }
    } else {
          }
  };

  // 处理下载思维导图为HTML格式（替代PDF，因为PDF生成需要专门的库）
  const handleDownloadMindMapAsHtml = (message) => {
    if (message.mindMapData && message.mindMapData.markdown) {
      
      // 将Markdown转换为HTML，然后生成HTML文件
      const markdown = message.mindMapData.markdown;
      
      // 简单的Markdown到HTML转换
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>思维导图</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              line-height: 1.6;
            }
            h1 {
              color: #333;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            h2 {
              color: #555;
              margin-top: 20px;
              border-bottom: 1px solid #ddd;
              padding-bottom: 5px;
            }
            h3 {
              color: #777;
              margin-top: 15px;
            }
            ul {
              margin-left: 20px;
            }
            li {
              margin-bottom: 8px;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="container">
      `;
      
      // 转换Markdown标题和列表
      const lines = markdown.split('\n');
      lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('# # # ')) {
          // 三级标题
          const text = line.substring(5).trim();
          html += `<h3>${text}</h3>`;
        } else if (line.startsWith('# # ')) {
          // 二级标题
          const text = line.substring(3).trim();
          html += `<h2>${text}</h2>`;
        } else if (line.startsWith('# ')) {
          // 一级标题
          const text = line.substring(2).trim();
          html += `<h1>${text}</h1>`;
        } else if (line.startsWith('- ')) {
          // 列表项
          const text = line.substring(2).trim();
          html += `<li>${text}</li>`;
        } else if (line) {
          // 普通文本
          html += `<p>${line}</p>`;
        }
      });
      
      html += `
          </div>
        </body>
        </html>
      `;
      
      // 创建HTML文件
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mindmap-' + Date.now() + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    }
  };



  // 递归渲染思维导图节点 - 放射状树状结构（作为后备方案）
  const renderMindMapNode = (node, level = 0, messageIndex = -1) => {
    if (level === 0) {
      // 根节点 - 中心位置
      return (
        <div className="mindmap-radial-container">
          {/* 中心节点 */}
          <div className="mindmap-center-node">
            <div 
              className="mindmap-node-title"
              onContextMenu={(e) => handleNodeContextMenu(e, node, messageIndex)}
            >{node.title}</div>
          </div>
          
          {/* 放射状子节点 */}
          {node.children && node.children.length > 0 && (
            <div className="mindmap-radial-branches">
              {node.children.map((child, index) => (
                <div key={index} className="mindmap-radial-branch">
                  <div className="mindmap-branch-connector"></div>
                  <div className="mindmap-branch-content">
                    {renderMindMapNode(child, level + 1, messageIndex)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      // 子节点
      return (
        <div className="mindmap-branch-node">
          <div 
            className="mindmap-node-title"
            onContextMenu={(e) => handleNodeContextMenu(e, node, messageIndex)}
          >{node.title}</div>
          
          {/* 子节点的子节点 */}
          {node.children && node.children.length > 0 && (
            <div className="mindmap-branch-children">
              {node.children.map((child, index) => (
                <div key={index} className="mindmap-branch-child">
                  <div className="mindmap-child-connector"></div>
                  <div className="mindmap-child-content">
                    {renderMindMapNode(child, level + 1, messageIndex)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="chat-page">
      {/* 右键菜单 */}
      {contextMenu.show && (
        <div 
          className="mindmap-context-menu"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1000
          }}
        >
          <div className="context-menu-item" onClick={handleEditNode}>
            修改节点
          </div>
          <div className="context-menu-item" onClick={handleDeleteNode}>
            删除节点
          </div>
        </div>
      )}
      
      {/* 提示消息 */}
      {toast.show && (
        <div className="toast">
          {toast.message}
        </div>
      )}
      {/* 两栏布局容器 */}
      <div className="chat-container">
        {/* 左侧历史会话栏 */}
        <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {sidebarCollapsed ? (
            <div className="sidebar-collapsed">
              <div 
                className="sidebar-logo-collapsed" 
                onClick={onBackToHome}
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
                  onClick={onBackToHome}
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
              
              <button className="new-chat-btn" onClick={onNewChat}>
                <svg t="1770615999507" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3299" width="20" height="20"><path d="M153.6 102.4a51.2 51.2 0 0 0-51.2 51.2v544a51.2 51.2 0 0 0 51.2 51.2h99.214222a51.2 51.2 0 0 1 51.2 51.2v89.969778l271.473778-135.736889c7.111111-3.555556 14.933333-5.404444 22.897778-5.432889H870.4a51.2 51.2 0 0 0 51.2-51.2V512a51.2 51.2 0 1 1 102.4 0v185.6a153.6 153.6 0 0 1-153.6 153.6h-259.896889L275.655111 1018.624a51.2 51.2 0 0 1-74.040889-45.795556v-121.628444H153.6a153.6 153.6 0 0 1-153.6-153.6V153.6A153.6 153.6 0 0 1 153.6 0h300.8a51.2 51.2 0 0 1 0 102.4H153.6zM771.214222 0a51.2 51.2 0 0 1 51.2 51.2v121.6h121.6a51.2 51.2 0 0 1 0 102.4h-121.6v121.6a51.2 51.2 0 1 1-102.4 0V275.2h-121.6a51.2 51.2 0 0 1 0-102.4h121.571556V51.2a51.2 51.2 0 0 1 51.2-51.2h0.028444z" fill="#000000" p-id="3300"></path></svg>
                新建对话
              </button>

              {/* 对话搜索框 */}
              <div style={{ padding: '0 12px 8px' }}>
                <div className="sidebar-search">
                  <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="13" height="13" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }}>
                    <path d="M839.566222 774.826667l170.894222 170.922666a45.539556 45.539556 0 0 1 0 64.796445 46.136889 46.136889 0 0 1-32.398222 13.454222 46.136889 46.136889 0 0 1-32.398222-13.454222L774.826667 839.68a473.713778 473.713778 0 0 1-636.017778-30.833778A473.827556 473.827556 0 0 1 473.770667 0C735.402667 0 947.484444 212.110222 947.484444 473.799111c0 112.213333-39.594667 217.941333-107.946666 301.056zM473.770667 91.733333c-210.887111 0.341333-381.724444 171.207111-382.065778 382.094223 0 211.000889 171.064889 382.094222 382.065778 382.094222s382.037333-171.093333 382.037333-382.094222c0-211.029333-171.036444-382.094222-382.037333-382.094223z" fill="#aaa"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="搜索对话..."
                    value={convSearch}
                    onChange={e => setConvSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="conversations-list">
            {conversations.filter(c => c.title?.toLowerCase().includes(convSearch.toLowerCase())).length > 0 ? (
              conversations.filter(c => c.title?.toLowerCase().includes(convSearch.toLowerCase())).map(conversation => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${conversation.id === currentConversationId ? 'active' : ''}`}
                >
                  <div 
                    className="conversation-content"
                    onClick={() => onSwitchConversation(conversation.id)}
                  >
                    <div className="conversation-title">
                      {conversation.title}
                    </div>
                    <div className="conversation-date">
                      {new Date(conversation.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div 
                    className="conversation-menu"
                    ref={el => {
                      // 更新ref数组
                      const index = menusRef.current.findIndex(item => item?.id === conversation.id);
                      if (el) {
                        el.id = conversation.id;
                        if (index !== -1) {
                          menusRef.current[index] = el;
                        } else {
                          menusRef.current.push(el);
                        }
                      } else {
                        // 清理ref数组
                        if (index !== -1) {
                          menusRef.current.splice(index, 1);
                        }
                      }
                    }}
                  >
                    <button 
                      className="menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const menu = e.currentTarget.nextElementSibling;
                        menu.classList.toggle('show');
                      }}
                    >
                      ⋮
                    </button>
                    <div className="menu-dropdown">
                      <div 
                        className="menu-item edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.parentElement;
                          menu.classList.remove('show');
                          const newTitle = prompt('请输入新的会话标题:', conversation.title);
                          if (newTitle && newTitle.trim()) {
                            onEditConversation(conversation.id, newTitle.trim());
                          }
                        }}
                      >
                        <span className="menu-icon">
                          <svg t="1770619563078" className="icon" viewBox="0 0 1025 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3605" width="16" height="16"><path d="M982.492729 997.546667H44.224284a42.666667 42.666667 0 1 1 0-85.276445h938.268445a42.666667 42.666667 0 0 1 0 85.304889zM154.674062 846.620444a85.304889 85.304889 0 0 1-81.891555-62.264888 81.464889 81.464889 0 0 1 0-47.331556l56.746666-178.716444a42.666667 42.666667 0 0 1 10.24-16.611556l192.341334-200.874667L634.048284 38.4a127.943111 127.943111 0 0 1 180.849778 0l60.558222 60.586667a127.943111 127.943111 0 0 1 0 180.792889L573.490062 581.319111l-192.768 200.448a42.666667 42.666667 0 0 1-19.626666 11.52l-183.808 49.891556a80.611556 80.611556 0 0 1-22.613334 3.413333z m52.053334-253.326222l-52.053334 168.021334 172.743111-47.331556L513.358507 521.614222l170.609777-172.743111-119.011555-118.983111-170.581333 170.609778-187.676445 192.768zM625.486507 167.623111l120.718222 120.689778L814.869618 219.648a42.666667 42.666667 0 0 0 0-60.558222L754.738062 98.986667a42.666667 42.666667 0 0 0-60.558222 0l-68.664889 68.664889z" fill="#000000" p-id="3606" data-spm-anchor-id="a313x.collections_detail.0.i8.1bd73a819pnOeb" className="selected"></path></svg>
                        </span>
                        <span className="menu-text">重命名</span>
                      </div>
                      <div 
                        className="menu-item delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          const menu = e.currentTarget.parentElement;
                          menu.classList.remove('show');
                          // 使用更可靠的确认方式
                          const userConfirmed = window.confirm('确定要删除此会话吗？');
                          if (userConfirmed) {
                            onDeleteConversation(conversation.id);
                          }
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
              ))
            ) : (
              <div className="no-conversations">
                <p>暂无会话</p>
                <button className="new-chat-btn" onClick={onNewChat}>
                  + 开始新对话
                </button>
              </div>
            )}
              </div>
            </>
          )}
        </div>
        
        {/* 右侧当前会话栏 */}
        <div className="main-chat">
          {/* 聊天头部 */}
          <div className="chat-header">
            <div className="chat-header-left">
              <div className="chat-title">
                {conversations.find(c => c.id === currentConversationId)?.title || 'Corvus Note'}
              </div>
            </div>
            <div className="chat-actions">
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
          
          {/* 消息容器 */}
          <div className="messages-container">
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              >
                <div className="message-content">
                  {message.role === 'assistant' ? (
                    <>
                      <div className="assistant-content-header">
                        <div className="message-title"></div>
                        <div className="response-actions">
                          {/* 生成思维导图按钮 */}
                          <button 
                            className="response-action-btn"
                            onClick={() => {
                              // 生成思维导图的逻辑
                              handleGenerateMindMap(message.content, message, index);
                            }}
                            title="生成思维导图"
                            disabled={generatingMindMapIndex === index || message.content === ''}
                          >
                            {generatingMindMapIndex === index ? (
                              <span className="loading-icon-container">
                                <svg t="1770608261910" className="loading-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7243" width="24" height="24"><path d="M512.022755 1024a511.994311 511.994311 0 0 1-225.078388-971.850535 511.908979 511.908979 0 0 1 622.272197 136.90159l33.677848-64.852613a42.666193 42.666193 0 0 1 81.065766 20.053111 42.666193 42.666193 0 0 1-4.693281 19.626448L948.896123 298.674726a42.666193 42.666193 0 0 1-16.213153 17.066477 42.666193 42.666193 0 0 1-24.291285 6.399929l-151.038322-6.399929a42.666193 42.666193 0 0 1 2.133309-85.332385l73.385852 2.986633A423.191742 423.191742 0 0 0 511.994311 85.343763 426.605038 426.605038 0 0 0 210.372774 813.712559 426.576594 426.576594 0 0 0 938.627793 512.005689a42.666193 42.666193 0 1 1 85.332385 0C1023.960178 794.740325 794.757392 1024 512.022755 1024z" fill="#2c2c2c" p-id="7244"></path></svg>
                              </span>
                            ) : (
                              <svg t="1770452015092" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6274" width="24" height="24"><path d="M620.8 364.8h352c25.6 0 44.8-19.2 44.8-44.8V64c0-25.6-19.2-44.8-44.8-44.8H620.8C595.2 19.2 576 38.4 576 64v89.6H288c-25.6 0-44.8 19.2-44.8 44.8V320L25.6 473.6c-12.8 12.8-19.2 25.6-19.2 38.4s6.4 25.6 19.2 38.4L243.2 704v128c0 25.6 19.2 44.8 44.8 44.8H576V960c0 25.6 19.2 44.8 44.8 44.8h352c25.6 0 44.8-19.2 44.8-44.8v-256c0-25.6-19.2-44.8-44.8-44.8H620.8c-25.6 0-44.8 19.2-44.8 44.8v83.2H332.8v-76.8l224-166.4c12.8-6.4 19.2-19.2 19.2-32s-6.4-25.6-19.2-38.4L332.8 313.6v-64H576V320c0 25.6 19.2 44.8 44.8 44.8z m44.8-256h262.4v166.4h-262.4V108.8z m0 640h262.4v166.4h-262.4v-166.4zM288 627.2L128 512l160-115.2L454.4 512 288 627.2z" fill="#2c2c2c" p-id="6275"></path></svg>
                            )}
                          </button>
                          {/* 记笔记按钮 */}
                          <button 
                            className="response-action-btn"
                            onClick={() => {
                              // 创建新笔记，将AI回答作为内容
                              const noteTitle = message.content.substring(0, 50).trim() || '新笔记';
                              // 调用父组件传递的创建笔记函数
                              if (onCreateNewNote) {
                                onCreateNewNote();
                                // 使用onEditNote更新笔记内容
                                if (notes.length > 0 && onEditNote) {
                                  const newNoteId = notes[0].id;
                                  onEditNote(newNoteId, { title: noteTitle, content: message.content });
                                  // 显示成功提示
                                  showToast('笔记生成成功！');
                                }
                              }
                            }}
                            title="将回答生成笔记"
                            disabled={message.content === ''}
                          >
                            <svg t="1770274140523" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3142" width="24" height="24"><path d="M821.333333 1024H201.955556A202.296889 202.296889 0 0 1 0 821.902222V202.097778A202.296889 202.296889 0 0 1 201.955556 0h309.674666a40.391111 40.391111 0 0 1 0 80.839111H201.955556a121.486222 121.486222 0 0 0-121.173334 121.258667v619.804444a121.486222 121.486222 0 0 0 121.173334 121.258667h619.377777a121.486222 121.486222 0 0 0 121.173334-121.258667V512a40.391111 40.391111 0 1 1 80.782222 0v309.902222a202.296889 202.296889 0 0 1-201.955556 202.097778z m33.905778-932.124444l37.973333 38.286222 38.257778 38.001778-185.827555 185.912888-222.151111 222.065778-83.740445 7.793778 7.793778-83.797333 221.895111-222.321778 185.799111-185.912889z m0-91.875556c-14.336 0-28.103111 5.688889-38.229333 15.900444l-204.657778 204.8-235.349333 237.397334a26.965333 26.965333 0 0 0-7.822223 16.440889l-15.075555 167.879111a26.965333 26.965333 0 0 0 26.936889 29.383111h2.417778l167.765333-15.075556a26.908444 26.908444 0 0 0 16.440889-7.822222l235.889778-236.088889 204.657777-204.8a53.902222 53.902222 0 0 0 0-76.231111l-57.912889-58.766222L893.212444 15.928889A53.845333 53.845333 0 0 0 855.239111 0z" fill="#2c2c2c" p-id="3143"></path></svg>
                          </button>
                          {/* 复制按钮 */}
                          <button 
                            className="response-action-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(message.content).then(() => {
                                // 可以添加复制成功的提示
                                
                              }).catch(err => {
                                                              });
                            }}
                            title="复制Markdown内容"
                          >
                            <svg t="1769396374987" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3302" width="24" height="24"><path d="M661.333333 234.666667A64 64 0 0 1 725.333333 298.666667v597.333333a64 64 0 0 1-64 64h-469.333333A64 64 0 0 1 128 896V298.666667a64 64 0 0 1 64-64z m-21.333333 85.333333H213.333333v554.666667h426.666667v-554.666667z m191.829333-256a64 64 0 0 1 63.744 57.856l0.256 6.144v575.701333a42.666667 42.666667 0 0 1-85.034666 4.992l-0.298667-4.992V149.333333H384a42.666667 42.666667 0 0 1-42.368-37.674666L341.333333 106.666667a42.666667 42.666667 0 0 1 37.674667-42.368L384 64h447.829333z" fill="#2c2c2c" p-id="3303"></path></svg>
                          </button>
                        </div>
                      </div>
                      {message.content === '' && (isAIThinking || isGenerating) ? (
                        <div className="ai-thinking">
                          <div className="thinking-dots">
                            <span className="dot"></span>
                            <span className="dot"></span>
                            <span className="dot"></span>
                          </div>
                          <div className="thinking-text">AI 正在思考中...</div>
                        </div>
                      ) : (
                        <>
                          {/* 深度思考过程面板 */}
                          {message.reasoning && (
                            <div className="reasoning-panel">
                              <div
                                className="reasoning-header"
                                onClick={() => {
                                  setCollapsedReasoning(prev => {
                                    const newSet = new Set(prev)
                                    if (newSet.has(index)) {
                                      newSet.delete(index)
                                    } else {
                                      newSet.add(index)
                                    }
                                    return newSet
                                  })
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{flexShrink: 0}}>
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm1 14h-2v-1h2v1zm0-3h-2V9.41l-1.29-1.3 1.41-1.41L12 7.83l.88-.88 1.42 1.41-1.3 1.3V13z"/>
                                </svg>
                                <span className="reasoning-label">思考过程</span>
                                <span className={`reasoning-chevron${collapsedReasoning.has(index) ? ' collapsed' : ''}`}>▾</span>
                              </div>
                              {!collapsedReasoning.has(index) && (
                                <div className="reasoning-content">
                                  {message.reasoning}
                                </div>
                              )}
                            </div>
                          )}
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h1: ({ node, ...props }) => <h1 {...props} />,
                              h2: ({ node, ...props }) => <h2 {...props} />,
                              h3: ({ node, ...props }) => <h3 {...props} />,
                              p: ({ node, ...props }) => <p {...props} />,
                              ul: ({ node, ...props }) => <ul {...props} />,
                              ol: ({ node, ...props }) => <ol {...props} />,
                              li: ({ node, ...props }) => <li {...props} />,
                              code: ({ node, inline, ...props }) => {
                                if (inline) {
                                  return <code {...props} />;
                                } else {
                                  return <pre><code {...props} /></pre>;
                                }
                              },
                              blockquote: ({ node, ...props }) => <blockquote {...props} />,
                              a: ({ node, ...props }) => <a {...props} />,
                              strong: ({ node, ...props }) => <strong {...props} />,
                              em: ({ node, ...props }) => <em {...props} />
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                          {/* 显示生成的思维导图 */}
                          {message.mindMapData && (
                            <div className="mindmap-container" id={`mindmap-${index}`}>
                              <div className="mindmap-header">
                                <h4 className="mindmap-title">生成的思维导图</h4>
                                <div className="mindmap-download-container">
                                  <button 
                                    className="mindmap-download-btn"
                                    onClick={() => handleMindMapDownloadClick(index)}
                                    title="下载思维导图"
                                  >
                                    <svg t="1770458066654" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7089" width="20" height="20">
                                      <path d="M46.535111 580.949333c12.344889 0 24.177778 4.892444 32.910222 13.568 8.732444 8.647111 13.653333 20.423111 13.653334 32.711111v201.159112c0 25.543111 20.821333 46.250667 46.535111 46.250666h744.732444c25.713778 0 46.535111-20.707556 46.535111-46.250666V627.2c0-16.497778 8.874667-31.772444 23.267556-40.049778 14.421333-8.248889 32.142222-8.248889 46.563555 0 14.392889 8.248889 23.267556 23.523556 23.267556 40.049778v201.187556C1024 905.016889 961.479111 967.111111 884.337778 967.111111H139.662222C62.492444 967.111111 0 905.016889 0 828.387556V627.2c0-25.543111 20.849778-46.250667 46.535111-46.250667z" fill="#666" p-id="7090"></path>
                                      <path d="M327.111111 102.855111A46.08 46.08 0 0 1 373.276444 56.888889h277.333334A46.08 46.08 0 0 1 696.888889 102.855111v266.325333h138.666667c19.2 0 36.408889 11.776 43.235555 29.639112a45.795556 45.795556 0 0 1-12.515555 50.716444L542.634667 734.862222a46.421333 46.421333 0 0 1-61.326223 0L157.781333 449.536a45.795556 45.795556 0 0 1-12.544-50.688 46.222222 46.222222 0 0 1 43.178667-29.667556h138.666667V102.855111z m92.444445 45.966222v266.325334a46.08 46.08 0 0 1-46.250667 45.966222h-63.089778l201.756445 177.92 201.756444-177.92h-63.089778a46.08 46.08 0 0 1-46.222222-45.966222V148.821333h-184.888889z" fill="#666" p-id="7091"></path>
                                    </svg>
                                  </button>
                                  {/* 下载选项展开栏 */}
                                  {expandedDownloadOptions[index] && (
                                    <div className="mindmap-download-options">
                                      <button 
                                        className="download-option-btn"
                                        onClick={() => handleDownloadMindMapAsMarkdown(message)}
                                      >
                                        下载为 Markdown
                                      </button>
                                      <button 
                                        className="download-option-btn"
                                        onClick={() => handleDownloadMindMapAsImage(`mindmap-${index}`)}
                                      >
                                        下载为图片
                                      </button>
                                      <button 
                                        className="download-option-btn"
                                        onClick={() => handleDownloadMindMapAsHtml(message)}
                                      >
                                        下载为 HTML
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="mindmap-content">
                                {/* 优先使用Markmap渲染 */}
                                {message.mindMapData ? (
                                  <MarkmapRenderer 
                                    data={message.mindMapData} 
                                    markdown={message.mindMapData.markdown}
                                  />
                                ) : (
                                  // Markmap渲染失败时，使用原来的放射状树状结构作为后备方案
                                  renderMindMapNode({ title: 'AI 回答', children: [] }, 0, index)
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* 挂载的知识库显示 */}
          {mountedKnowledgeBases.length > 0 && (
            <div className="mounted-knowledge-bases">
              <div className="mounted-title">已挂载知识库:</div>
              <div className="mounted-list">
                {mountedKnowledgeBases.map(file => (
                  <div key={file.id} className="mounted-item">
                    <span className="mounted-file-name">{file.name}</span>
                    <button 
                      className="unmount-btn"
                      onClick={() => handleUnmountKnowledgeBase(file.id)}
                      title="卸载知识库"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 输入区域 */}
          <form className="message-input-form" onSubmit={handleSendMessage} ref={formRef} onClick={() => setIsInputFocused(true)}>
            <div className={`input-container ${isInputFocused ? 'focused' : ''}`}>
              <div className="input-wrapper">
                <div className="input-with-at">
                  <input
                    type="text"
                    className="message-input"
                    ref={inputRef}
                    placeholder="输入消息..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                </div>
                
                {/* 知识库选择器 */}
                {showKnowledgeBasePicker && (
                  <div className="knowledge-base-picker">
                    <div className="picker-header">选择知识库</div>
                    <div className="picker-content">
                      {(() => {
                        // 每次显示时重新加载数据
                        const knowledgeBaseData = loadKnowledgeBaseData();
                        
                        const allFiles = getAllFiles(knowledgeBaseData);
                        
                        // 显示所有顶层项（文件夹 + 文件）
                        const allItems = knowledgeBaseData || []
                        return allItems.length > 0 ? (
                          allItems.map(item => (
                            <div
                              key={item.id}
                              className="knowledge-base-item"
                              onClick={() => handleMountKnowledgeBase(item)}
                            >
                              <span className="knowledge-base-icon">
                                {item.type === 'folder' ? '📁' :
                                 item.type === 'pdf' ? '📄' :
                                 item.type === 'word' ? '📝' : '📄'}
                              </span>
                              <span className="knowledge-base-name">{item.name}</span>
                              <span className="knowledge-base-size">
                                {item.type === 'folder'
                                  ? `${getAllFiles([item]).length} 个文件`
                                  : item.size}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="no-knowledge-base">
                            <div className="no-knowledge-base-icon">📚</div>
                            <div className="no-knowledge-base-text">暂无知识库文件</div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
                
                <div className="input-actions">
                  {/* 左侧：模型选择 */}
                  <div className="left-actions">
                    <select
                      className="model-select"
                      value={selectedModel}
                      onChange={(e) => onModelChange(e.target.value)}
                    >
                      {models.map(model => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 中间：显示已选择的文件名 */}
                  <div className="middle-actions">
                    {selectedFile && (
                      <div className="selected-file-name">
                        {selectedFile.name}
                      </div>
                    )}
                  </div>
                  
                  {/* 右侧：功能按钮 */}
                  <div className="right-actions">
                    {/* @符号按钮 */}
                    <button 
                      type="button" 
                      className="at-button"
                      onClick={handleAtClick}
                      title="选择知识库"
                    >
                      @
                    </button>
                    
                    {/* 附件上传按钮 */}
                    <button 
                      type="button" 
                      className="at-button"
                      onClick={handleAttachClick}
                      title="上传附件"
                    >
                      <svg t="1768785471395" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><path d="M633.553 251.102c15.993-12.795 38.385-12.795 55.978 1.6 15.993 15.993 15.993 38.384 0 54.378L347.264 647.747c-22.39 20.792-22.39 57.577 0 81.568 20.792 22.391 57.578 22.391 81.568 0l401.444-403.042c55.978-55.979 55.978-148.742 0-204.72s-148.742-55.979-204.72 0l-47.982 47.98-12.795 12.796-369.455 369.455c-91.165 91.165-91.165 236.708 0 327.872 91.164 91.165 236.707 91.165 327.872 0L894.25 511.8c6.397-3.199 9.596-7.997 12.795-12.795 15.993-15.994 38.385-15.994 54.378 0s15.994 38.385 0 54.379l-3.198 3.199c-3.2 1.599-6.398 6.397-9.597 9.596L577.574 934.035c-119.953 119.953-316.676 119.953-436.63 0s-119.952-316.676 0-436.63l430.233-431.83c86.366-86.367 227.111-86.367 315.077 0 86.366 86.366 86.366 227.11 0 315.076L483.21 783.694c-52.78 52.78-139.145 52.78-190.325 0-52.78-52.78-52.78-139.146 0-190.326l340.667-342.266z m0 0" fill="#000000" p-id="5381"></path></svg>
                    </button>
                    
                    {/* 隐藏的文件输入控件 */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md"
                    />
                    
                    {/* 停止/发送按钮 */}
                    {(isGenerating || localGenerating) ? (
                      <button
                        type="button"
                        className="send-button stop-button"
                        onClick={() => { abortControllerRef.current?.abort(); setLocalGenerating(false); onStopGeneration?.(); }}
                        title="停止生成"
                      >
                        <span className="stop-icon"></span>
                      </button>
                    ) : (
                      <button type="submit" className="send-button">
                        <svg t="1770622316922" className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="3911" width="20" height="20"><path d="M1014.288782 129.308444a42.666667 42.666667 0 0 1 5.802667 45.141334L715.024782 829.610667a42.666667 42.666667 0 0 1-63.146666 16.952889l-234.666667-163.783112a42.666667 42.666667 0 0 1 48.839111-69.973333l193.024 134.741333 245.902222-528.099555L146.875449 408.462222l156.814222 104.248889a42.666667 42.666667 0 0 0 45.056 1.336889l235.719111-137.073778a42.666667 42.666667 0 1 1 42.922667 73.756445l-235.719111 137.102222a128 128 0 0 1-135.253334-4.039111L19.131449 425.984a42.666667 42.666667 0 0 1 13.312-76.942222l938.666667-233.984a42.666667 42.666667 0 0 1 43.207111 14.250666h-0.056889z" fill="#ffffff" p-id="3912"></path><path d="M481.439004 686.876444a42.666667 42.666667 0 0 1 1.934223 60.302223l-153.514667 163.783111A42.666667 42.666667 0 0 1 256.045227 881.777778v-163.811556a42.666667 42.666667 0 1 1 85.333333 0v55.893334l79.786667-85.048889a42.666667 42.666667 0 0 1 60.302222-1.934223z" fill="#ffffff" p-id="3913"></path></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
