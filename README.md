# CorvusNote

基于 LangChain 框架的智能知识库系统设计与实现

## 项目简介

CorvusNote 是一款 AI 驱动的智能笔记与知识库管理应用，集成 RAG（检索增强生成）技术，支持智能对话、知识库管理和内容检索。

## 技术架构

### 前端
- **框架**: React 18 + Vite
- **UI**: Ant Design
- **状态管理**: React Context
- **特性**: Markdown 渲染、思维导图支持

### 后端
- **框架**: FastAPI
- **数据库**: MongoDB
- **认证**: JWT

### AI 与 RAG
- **LLM**: 阿里云 DashScope (Qwen 系列)
- **向量存储**: FAISS
- **框架**: LangChain (LCEL)
- **Embedding**: 通义万相 Embedding

## 功能特性

- 🤖 **智能对话**: 基于知识库的 AI 问答，支持多轮对话
- 📚 **知识库管理**: 文件上传、文件夹管理、在线预览
- 📝 **笔记功能**: Markdown 编辑器，支持富文本
- 🔐 **用户系统**: 注册登录、会话管理
- 🌐 **共享知识库**: 创建和加入共享知识库

## 项目结构

```
CorvusNote/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/           # API 路由
│   │   ├── core/          # 核心配置
│   │   ├── models/        # 数据模型
│   │   ├── schemas/       # Pydantic 模型
│   │   └── services/      # 业务服务
│   │       ├── ai_service.py    # AI 对话服务
│   │       └── rag_service.py   # RAG 检索服务
│   ├── main.py            # 应用入口
│   └── requirements.txt   # Python 依赖
│
├── src/                   # React 前端
│   ├── pages/            # 页面组件
│   ├── components/        # 可复用组件
│   ├── utils/            # 工具函数
│   └── styles/           # 样式文件
│
└── package.json          # Node 依赖
```

## 快速开始

### 前置要求

- Node.js 18+
- Python 3.9+
- MongoDB (本地或云端)

### 安装部署

#### 1. 克隆项目

```bash
git clone https://github.com/LiangXiuxx/CorvusNote.git
cd CorvusNote
```

#### 2. 后端配置

```bash
cd backend

# 创建虚拟环境 (可选)
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# 或 .venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
# 在 backend 目录下创建 .env 文件，内容如下:
# MONGO_URI=your_mongodb_uri
# DASHSCOPE_API_KEY=your_dashscope_api_key
# JWT_SECRET_KEY=your_secret_key
# JWT_ALGORITHM=HS256

# 启动后端
uvicorn main:app --reload --port 8000
```

#### 3. 前端配置

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

#### 4. 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- API 文档: http://localhost:8000/docs

## RAG 架构说明

本项目实现了完整的 RAG 检索增强生成流程：

```
用户查询 → Query Rewrite (LCEL) → 向量检索 (FAISS) → Rerank → LLM 生成
```

### 核心组件

1. **TongyiEmbeddings**: 自定义 Embedding 类，调用通义万相 API
2. **RecursiveCharacterTextSplitter**: 文档分块，支持 Markdown 标题分割
3. **FAISS**: 向量存储与相似度检索
4. **LCEL Chain**: Query Rewrite 改写查询语句
5. **Rerank**: Qwen3-VL-Rerank 重排序精选结果

## API 接口

### 认证
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

### 对话
- `POST /api/chat/stream` - 流式 AI 对话
- `POST /api/chat/with-knowledge` - 基于知识库的对话

### 知识库
- `GET /api/knowledge-bases` - 获取知识库列表
- `POST /api/knowledge-bases` - 创建知识库
- `POST /api/knowledge-bases/{id}/upload` - 上传文件
- `DELETE /api/knowledge-bases/{id}` - 删除知识库

### 笔记
- `GET /api/notes` - 获取笔记列表
- `POST /api/notes` - 创建笔记
- `PUT /api/notes/{id}` - 更新笔记
- `DELETE /api/notes/{id}` - 删除笔记

## 环境变量

| 变量名 | 说明 | 必需 |
|--------|------|------|
| MONGO_URI | MongoDB 连接串 | 是 |
| DASHSCOPE_API_KEY | 阿里云 DashScope API Key | 是 |
| JWT_SECRET_KEY | JWT 密钥 | 是 |
| JWT_ALGORITHM | JWT 算法，默认 HS256 | 否 |
| JWT_EXPIRE_MINUTES | Token 过期时间(分钟)，默认 60 | 否 |

## 依赖版本

### Python
- fastapi >= 0.104.1
- langchain >= 0.2.0
- langchain-community >= 0.2.0
- langchain-openai >= 0.1.0
- faiss-cpu >= 1.7.4
- dashscope >= 1.20.0
- pymongo >= 4.6.2

### Node
- react >= 18.2.0
- @langchain/core >= 0.1.0
- antd >= 5.x

## 许可证

MIT License

## 作者

LiangXiuxx

## 致谢

- [LangChain](https://github.com/langchain-ai/langchain)
- [阿里云 DashScope](https://dashscope.aliyuncs.com/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
