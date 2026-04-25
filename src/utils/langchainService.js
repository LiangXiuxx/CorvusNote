import { HumanMessage, AIMessage } from '@langchain/core/messages'

const API_BASE = ''

// 获取存储在 localStorage 中的 JWT Token
const getToken = () => localStorage.getItem('corvusNoteToken') || ''

/**
 * 将后端/DashScope 的技术错误信息转换为对用户友好的提示。
 */
const parseApiError = (err) => {
  const msg = err?.message || String(err)
  if (msg.includes('FreeTierOnly') || msg.includes('free tier'))
    return '当前模型免费额度已用完，请在 DashScope 控制台开启付费或切换其他模型。'
  if (msg.includes('model not found') || msg.includes('does not exist') || msg.includes('invalid model'))
    return '所选模型不可用，请切换其他模型后重试。'
  if (msg.includes('401') || msg.includes('Unauthorized'))
    return '登录已过期，请重新登录。'
  if (msg.includes('429') || msg.includes('rate limit') || msg.includes('RateLimit'))
    return '请求过于频繁，请稍等片刻再试。'
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT'))
    return '请求超时，请检查网络连接后重试。'
  if (msg.includes('403'))
    return '请求被拒绝，请检查模型是否已开通或切换其他模型。'
  return '生成回复时遇到错误，请稍后重试。'
}

/**
 * 调用后端 /api/chat/stream SSE 接口，解析流式响应。
 * @param {Function} [onChunk] - 每收到一段 content 时回调
 * @param {AbortSignal} [signal] - 可选，用于中断请求
 * @returns {string} content
 */
const callBackendStream = async (payload, onChunk, signal = null) => {
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(`后端请求失败: ${response.statusText} — ${JSON.stringify(errData)}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let answerContent = ''

  try {
    while (true) {
      if (signal?.aborted) break
      const { done, value } = await reader.read()
      if (done) break

      const raw = decoder.decode(value)
      const lines = raw.split('\n').filter(l => l.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') {
          return answerContent
        }

        let parsed = null
        try {
          parsed = JSON.parse(data)
        } catch (e) {
          continue
        }

        if (parsed.type === 'reasoning') {
          // 完全跳过 reasoning 处理，避免系统提示词泄露
          // 只有在用户明确开启深度思考时才处理
          if (onReasoning) {
            reasoningContent += parsed.text
            onReasoning(reasoningContent)
          }
        } else if (parsed.type === 'content') {
          answerContent += parsed.text
          if (onChunk) onChunk(answerContent)
        } else if (parsed.type === 'error') {
          throw new Error(parsed.text)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { content: answerContent, reasoning: reasoningContent }
}

/**
 * 调用后端 /api/chat/invoke 非流式接口（用于思维导图等场景）
 */
const callBackendInvoke = async (messages, model = 'deepseek-v3.2') => {
  const response = await fetch(`${API_BASE}/api/chat/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ messages, model }),
  })

  if (!response.ok) {
    throw new Error(`后端请求失败: ${response.statusText}`)
  }

  const data = await response.json()
  return { content: data.content }
}

// 处理单轮对话 - 支持流式输出
export const generateAIResponse = async (question, onChunk = null) => {
  try {
    return await callBackendStream(
      { history: [], message: question, kb_ids: [], model: 'qwen-plus', enable_thinking: false },
      onChunk
    )
  } catch (error) {
    console.error('生成AI回复失败:', error)
    return '抱歉，生成回复时遇到错误，请稍后再试。'
  }
}

// 读取文件内容的辅助函数，根据文件扩展名使用不同的解析方法
const readFileContent = async (file) => {
  try {
    console.log('开始读取文件:', file.name);
    const fileExtension = file.name.split('.').pop().toLowerCase();
    console.log('文件扩展名:', fileExtension);
    
    // 支持的文本文件类型
    const supportedTextTypes = ['txt', 'md', 'markdown'];
    
    // 根据文件扩展名选择不同的解析方法
    if (supportedTextTypes.includes(fileExtension)) {
      console.log('使用文本文件解析方法');
      return await readTextFile(file);
    } else {
      // 对于非文本文件，给出友好的提示
      console.log('不支持的文件类型，返回文件信息');
      return `[${file.name}] 文件类型: ${file.type || '未知'}，大小: ${Math.round(file.size / 1024)}KB\n\n当前版本暂不支持直接解析此类型文件内容。建议将文件转换为文本格式（如.txt或.md）后再上传，或详细描述您的问题，我会尽力为您提供帮助。`;
    }
  } catch (error) {
    console.error('文件解析失败:', error);
    return `文件解析失败: ${error.message}`;
  }
};

// 读取文本文件
const readTextFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    // 尝试不同编码读取文件
    const tryReadWithEncoding = (encoding) => {
      return new Promise((resolveTry, rejectTry) => {
        const encodingReader = new FileReader();
        
        encodingReader.onload = (e) => {
          resolveTry(e.target.result);
        };
        
        encodingReader.onerror = (e) => {
          rejectTry(new Error(`使用${encoding}编码读取文件失败`));
        };
        
        encodingReader.readAsText(file, encoding);
      });
    };
    
    // 依次尝试不同编码
    const readWithFallbackEncodings = async () => {
      // 常用编码列表，优先尝试UTF-8，然后是GBK（中文常用），最后是ISO-8859-1（默认）
      const encodings = ['utf-8', 'gbk', 'iso-8859-1'];
      
      for (const encoding of encodings) {
        try {
          const content = await tryReadWithEncoding(encoding);
          // 验证内容是否有效（简单检查是否包含大量乱码特征）
          if (content && !/\ufffd{3,}/.test(content)) {
            return resolve(content);
          }
        } catch (error) {
          console.log(`编码${encoding}读取失败，尝试下一种编码`);
        }
      }
      
      // 如果所有编码都失败，返回错误信息
      return resolve('无法解析文本文件内容，尝试了多种编码均失败。建议检查文件编码或重新上传文件。');
    };
    
    readWithFallbackEncodings();
  });
};

// 从IndexedDB获取文件内容
const getFileFromIndexedDB = async (fileId) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CorvusNoteDB', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const getRequest = store.get(fileId);
      
      getRequest.onsuccess = () => {
        resolve(getRequest.result?.file || null);
      };
      
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

// 处理多轮对话 - 支持流式输出
// 优先使用后端持久化 RAG 索引（传 kb_ids）；
// 若知识库没有 backendId（旧数据或后端上传失败），降级为从 IndexedDB 读取文件内容传给后端
export const generateAIResponseWithHistory = async (
  messages,
  onChunk = null,
  selectedModel = 'qwen3.5-flash',
  file = null,
  mountedKnowledgeBases = [],
  abortController = null,
  enableThinking = false,
  onReasoning = null,
) => {
  try {
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

    // ── 1. 区分已建索引的知识库（有 backendId）与本地模式知识库 ─
    const kb_ids = []
    const localKbContents = []   // 降级：没有 backendId 的知识库走旧路径

    for (const kbFile of mountedKnowledgeBases) {
      if (kbFile.type === 'folder') {
        // 如果是文件夹，递归获取所有文件
        const files = getAllFilesFromFolder([kbFile])
        for (const file of files) {
          if (file.backendId) {
            // 已在后端建立向量索引，直接传 ID
            kb_ids.push(file.backendId)
          } else {
            // 旧数据或后端上传失败：从 IndexedDB 读取文件内容（降级）
            try {
              const actualFile = await getFileFromIndexedDB(file.id)
              if (actualFile) {
                const content = await readFileContent(actualFile)
                localKbContents.push({ name: file.name, content })
              } else if (file.content) {
                localKbContents.push({ name: file.name, content: file.content })
              }
            } catch (e) {
              console.error('读取本地知识库文件失败:', e)
            }
          }
        }
      } else if (kbFile.backendId) {
        // 已在后端建立向量索引，直接传 ID
        kb_ids.push(kbFile.backendId)
      } else {
        // 旧数据或后端上传失败：从 IndexedDB 读取文件内容（降级）
        try {
          const actualFile = await getFileFromIndexedDB(kbFile.id)
          if (actualFile) {
            const content = await readFileContent(actualFile)
            localKbContents.push({ name: kbFile.name, content })
          } else if (kbFile.content) {
            localKbContents.push({ name: kbFile.name, content: kbFile.content })
          }
        } catch (e) {
          console.error('读取本地知识库文件失败:', e)
        }
      }
    }

    // ── 2. 处理直接上传的文件（注入到当前消息，不走 RAG）────────
    const currentMsg = messages[messages.length - 1]?.content || ''
    let finalMessage = currentMsg

    if (file) {
      try {
        const fileContent = await readFileContent(file)
        finalMessage = `用户问题: ${currentMsg}\n\n文件名称: ${file.name}\n文件内容:\n${fileContent}`
      } catch (e) {
        finalMessage = `用户问题: ${currentMsg}\n\n文件名称: ${file.name}\n(文件内容读取失败)`
      }
    }

    // ── 3. 本地模式知识库内容直接拼接到消息末尾（向后兼容） ──────
    if (localKbContents.length > 0) {
      const localContext = localKbContents
        .map(kb => `--- 知识库文件: ${kb.name} ---\n${kb.content}`)
        .join('\n\n')
      finalMessage = `${finalMessage}\n\n${localContext}`
    }

    // ── 4. 构建历史消息（不含最后一条，由 message 字段单独传）────
    const history = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))

    // ── 5. 模型名和 enable_thinking（由调用方直接传入）────────────
    const enable_thinking = enableThinking
    const modelName = selectedModel

    // ── 6. 调用后端 SSE 接口 ──────────────────────────────────────
    // 无论什么模型，都显式传递 enable_thinking，由后端决定是否显示思考过程
    const payload = {
      history,
      message: finalMessage,
      kb_ids,
      model: modelName,
      enable_thinking: enableThinking,
    };

    return await callBackendStream(
      payload,
      onChunk,
      abortController?.signal,
      onReasoning,
    )
  } catch (error) {
    // 用户主动中断，不显示错误
    if (error?.name === 'AbortError') return { content: '', reasoning: '' }
    console.error('生成AI回复失败:', error)
    const errorMessage = parseApiError(error)
    if (onChunk) onChunk(errorMessage)
    return { content: errorMessage, reasoning: '' }
  }
};

// 移除Markmap相关库的导入，在客户端使用动态导入

// 内容复杂度分析函数
const analyzeContentComplexity = (content) => {
  // 清理内容，移除格式标记
  const cleanedContent = content.replace(/[*#`]/g, '').trim();
  
  // 计算内容长度
  const length = cleanedContent.length;
  
  // 计算句子数量
  const sentences = cleanedContent.split(/[。！？.!?]/).filter(s => s.trim());
  const sentenceCount = sentences.length;
  
  // 计算词汇多样性（简单计算不同词汇数量）
  const words = cleanedContent.split(/\s+/).filter(w => w);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const lexicalDiversity = uniqueWords.size / words.length || 0;
  
  // 复杂度评分
  let complexityScore = 0;
  
  // 基于长度的评分
  if (length < 50) {
    complexityScore += 0; // 非常简单
  } else if (length < 200) {
    complexityScore += 1; // 简单
  } else if (length < 500) {
    complexityScore += 2; // 中等
  } else {
    complexityScore += 3; // 复杂
  }
  
  // 基于句子数量的评分
  if (sentenceCount < 2) {
    complexityScore += 0;
  } else if (sentenceCount < 5) {
    complexityScore += 1;
  } else if (sentenceCount < 10) {
    complexityScore += 2;
  } else {
    complexityScore += 3;
  }
  
  // 基于词汇多样性的评分
  if (lexicalDiversity < 0.5) {
    complexityScore += 0;
  } else if (lexicalDiversity < 0.7) {
    complexityScore += 1;
  } else {
    complexityScore += 2;
  }
  
  // 确定复杂度级别
  if (complexityScore < 2) {
    return 'very_simple'; // 非常简单
  } else if (complexityScore < 5) {
    return 'simple'; // 简单
  } else if (complexityScore < 8) {
    return 'medium'; // 中等
  } else {
    return 'complex'; // 复杂
  }
};

// 生成思维导图函数 - 使用Markmap生成思维导图
export const generateMindMap = async (markdownContent) => {
  try {
    console.log('开始生成思维导图');
    console.log('Markdown内容长度:', markdownContent.length);
    
    // 分析内容复杂度
    const complexity = analyzeContentComplexity(markdownContent);
    console.log('内容复杂度分析结果:', complexity);
    
    // 根据复杂度选择不同的提示模板
    let prompt;
    if (complexity === 'very_simple' || complexity === 'simple') {
      // 简单内容使用简化模板
      prompt = "I would like to create a mind map using the Markmap tool.\n" +
               "Write a concise summary of the following:\n" +
               "{text} " +
               "Summarize the whole documents in Chinese language\n" +
               "Provide me with Markdown format that is compatible with Markmap\n" +
               "For simple content, use a minimal structure with only essential topics.\n" +
               "Do NOT create unnecessary levels or categories.\n" +
               "Markdown format for Markmap:\n" +
               "\n" +
               "```markdown\n" +
               "# Central Topic\n" +
               "## Main Topic 1\n" +
               "## Main Topic 2\n" +
               "```\n" +
               "结果使用中文返回\n" +
               "只返回核心内容，不要添加任何无关信息。";
    } else {
      // 复杂内容使用优化后的提示模板 - 添加结构约束
      prompt = `基于以下内容生成思维导图，要求：

1. **层级控制**：最多3级（中心主题→主主题→子主题→项目）
2. **信息聚合**：相似信息合并，避免碎片化
3. **关键提取**：只保留核心信息，去掉细节描述
4. **结构化**：使用清晰的分类，不要简单列举

内容原文：
{text}

请按照以下模板生成：
# 中心主题
## 主分类1
### 子分类1
- 关键点1
- 关键点2
### 子分类2
- 关键点1
## 主分类2
...

**重要**：不要生成过于细碎的叶节点，保持简洁性和可读性。
结果使用中文返回
不要使用任何先验知识，直接使用知识库回答问题。`;
    }
    
    const apiMessages = [
      { role: 'user', content: prompt.replace('{text}', markdownContent) }
    ];

    // 通过后端 /api/chat/invoke 调用（API Key 安全存于后端）
    const response = await callBackendInvoke(apiMessages, 'deepseek-v3.2');
    console.log('AI生成的思维导图Markdown:', response.content);
    
    // 移除对Transformer的使用，在客户端使用动态导入处理转换
    const mindmapData = null;
    
    // 解析AI生成的Markdown内容，构建用于前端显示的结构
    const parseMarkdownToMindMap = (markdown) => {
      const lines = markdown.split('\n');
      const mindMap = {
        title: 'AI 回答',
        children: []
      };
      
      let currentLevel1 = null;
      let currentLevel2 = null;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // 处理中心主题 (#)
        if (trimmedLine.startsWith('# ') && !trimmedLine.startsWith('##')) {
          mindMap.title = trimmedLine.substring(2).trim();
        }
        // 处理主要主题 (##)
        else if (trimmedLine.startsWith('## ') && !trimmedLine.startsWith('###')) {
          const title = trimmedLine.substring(3).trim();
          // 过滤掉空标题和明显无效的内容
          if (title && title !== '无' && title !== '空') {
            currentLevel1 = {
              title: title,
              children: []
            };
            mindMap.children.push(currentLevel1);
            currentLevel2 = null;
          }
        }
        // 处理子主题 (###)
        else if (trimmedLine.startsWith('### ')) {
          const title = trimmedLine.substring(4).trim();
          // 过滤掉空标题和明显无效的内容
          if (title && title !== '无' && title !== '空') {
            currentLevel2 = {
              title: title,
              children: []
            };
            if (currentLevel1) {
              currentLevel1.children.push(currentLevel2);
            }
          }
        }
        // 处理列表项 (-)
        else if (trimmedLine.startsWith('- ')) {
          const title = trimmedLine.substring(2).trim();
          // 过滤掉空标题和明显无效的内容
          if (title && title !== '无' && title !== '空') {
            const listItem = {
              title: title,
              children: []
            };
            if (currentLevel2) {
              currentLevel2.children.push(listItem);
            } else if (currentLevel1) {
              currentLevel1.children.push(listItem);
            } else {
              mindMap.children.push(listItem);
            }
          }
        }
      }
      
      // 清理无效的子节点（如果所有子节点都为空，移除该节点）
      const cleanMindMap = (node) => {
        if (node.children) {
          node.children = node.children.filter(child => {
            cleanMindMap(child);
            return child.title && (child.children.length > 0 || child.title.trim());
          });
        }
      };
      
      cleanMindMap(mindMap);
      
      return mindMap;
    };
    
    // 解析AI生成的Markdown内容
    const displayData = parseMarkdownToMindMap(response.content);
    console.log('解析后的思维导图结构:', displayData);
    
    // 生成符合标准的Xmind XML格式（保留此功能以便用户下载）
    function generateXMLElement(topic) {
      let xml = '<topic id="' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '" title="' + (topic.title || '无标题') + '">';
      if (topic.children && topic.children.length > 0) {
        xml += '<children>';
        for (let i = 0; i < topic.children.length; i++) {
          xml += generateXMLElement(topic.children[i]);
        }
        xml += '</children>';
      }
      xml += '</topic>';
      return xml;
    }
    
    // 生成符合标准的Xmind XML格式
    let xmindXML = '<?xml version="1.0" encoding="UTF-8"?>' + '\n';
    xmindXML += '<xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:svg="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' + '\n';
    xmindXML += '  <sheet id="' + Date.now() + '" title="' + displayData.title + '">' + '\n';
    xmindXML += generateXMLElement(displayData);
    xmindXML += '  </sheet>' + '\n';
    xmindXML += '</xmap-content>';
    
    console.log('生成的Xmind XML:', xmindXML);
    
    // 返回生成的思维导图数据、Markmap数据和XML，用于在界面中显示和下载
    return {
      ...displayData,
      markmapData: mindmapData,
      markdown: response.content,
      xmindXML: xmindXML,
      complexity: complexity
    };
  } catch (error) {
    console.error('生成思维导图失败:', error);
    console.error('错误堆栈:', error.stack);
    // 返回默认的树状结构
    return {
      title: 'AI 回答',
      children: [
        {
          title: '思考过程',
          children: []
        },
        {
          title: '最终回答',
          children: []
        }
      ],
      markmapData: null,
      markdown: '',
      xmindXML: '',
      complexity: 'simple'
    };
  }
};

/**
 * 根据首条对话内容生成简短标题（5-10 字），用于替换截断式标题。
 */
export const generateConversationTitle = async (question, aiReply) => {
  try {
    const snippet = `用户：${question.slice(0, 100)}\nAI：${aiReply.slice(0, 200)}`
    const result = await callBackendInvoke([
      { role: 'user', content: `根据以下对话内容生成一个5-10字的简短标题，只输出标题本身，不加引号、序号或任何说明：\n${snippet}` }
    ], 'qwen3.5-flash')
    const title = result.content?.trim().replace(/^["'「『]|["'」』]$/g, '') || ''
    return title.slice(0, 20) || null
  } catch {
    return null
  }
}
