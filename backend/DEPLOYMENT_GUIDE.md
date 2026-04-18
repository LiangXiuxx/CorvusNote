# MongoDB + FastAPI 后端部署指南

## 问题分析

当您运行 `uvicorn main:app --host 0.0.0.0 --port 8000 --reload` 时遇到以下错误：

```
uvicorn : 无法将"uvicorn"项识别为 cmdlet、函数、脚本文件或可运行程序的名称。
```

这是因为 uvicorn 包没有正确安装或者不在系统路径中。

## 解决方案

### 步骤 1: 检查 Python 环境

1. **确认 Python 已安装**
   ```bash
   python --version
   ```
   应该显示 Python 3.8 或更高版本

2. **确认 pip 已安装**
   ```bash
   python -m pip --version
   ```

### 步骤 2: 安装依赖

在 backend 目录下运行：

```bash
# 升级 pip
python -m pip install --upgrade pip

# 安装所有依赖
python -m pip install -r requirements.txt

# 验证 uvicorn 已安装
python -m pip list | findstr uvicorn
```

### 步骤 3: 运行服务

#### 方法 1: 使用 Python 直接运行

```bash
python main.py
```

#### 方法 2: 使用模块方式运行 uvicorn

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 方法 3: 添加脚本到 package.json

在 backend 目录下创建 package.json 文件：

```json
{
  "name": "corvusnote-backend",
  "version": "1.0.0",
  "description": "CorvusNote FastAPI Backend",
  "scripts": {
    "start": "python main.py",
    "dev": "python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
  }
}
```

然后运行：

```bash
npm run dev
```

## 环境配置

### MongoDB 配置

1. **确保 MongoDB 服务已启动**
   - Windows: 运行 `net start MongoDB`
   - Linux/Mac: 运行 `sudo systemctl start mongodb`

2. **创建数据库**
   - 打开 MongoDB Shell: `mongo`
   - 创建数据库: `use CorvusNote`

### 环境变量配置

编辑 `.env` 文件：

```
# MongoDB连接配置
MONGODB_URL="mongodb://localhost:27017"
MONGODB_DB_NAME="CorvusNote"

# JWT配置
SECRET_KEY="your-secret-key-here"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30

# 上传文件配置
UPLOAD_DIR="./uploads"
```

## 验证服务

服务启动后，访问以下地址：

1. **API 文档**: http://localhost:8000/docs
2. **健康检查**: http://localhost:8000/

## 常见问题排查

### 1. 依赖安装失败

- **问题**: 安装依赖时出现权限错误
- **解决方案**: 使用管理员权限运行命令提示符，或添加 `--user` 参数
  ```bash
  python -m pip install -r requirements.txt --user
  ```

### 2. MongoDB 连接失败

- **问题**: 服务无法连接到 MongoDB
- **解决方案**:
  - 确认 MongoDB 服务已启动
  - 检查 MongoDB 端口是否正确（默认 27017）
  - 检查 `.env` 文件中的连接字符串

### 3. 端口被占用

- **问题**: 端口 8000 已被占用
- **解决方案**: 修改端口号，例如使用 8001
  ```bash
  python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
  ```

### 4. 文件上传失败

- **问题**: 知识库文件上传失败
- **解决方案**:
  - 确认 `uploads` 目录存在且有写入权限
  - 检查文件大小是否超过限制

## 前端集成

前端可以通过以下方式集成后端 API：

1. **认证**:
   - 注册: POST /api/auth/register
   - 登录: POST /api/auth/login

2. **API 请求**:
   - 在请求头中添加 `Authorization: Bearer <token>`

3. **数据操作**:
   - 笔记: GET/POST/PUT/DELETE /api/notes
   - 对话: GET/POST/PUT/DELETE /api/conversations
   - 消息: GET/POST /api/messages/conversation/{id}
   - 知识库: GET/POST/PUT/DELETE /api/knowledge-bases

## 部署到生产环境

### 1. 使用 Gunicorn + Uvicorn

```bash
# 安装 gunicorn
python -m pip install gunicorn

# 运行生产服务
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
```

### 2. 使用 Docker

创建 `Dockerfile`:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 3. 使用云服务

- **AWS**: EC2 + RDS
- **Azure**: App Service + Cosmos DB
- **Google Cloud**: Cloud Run + Cloud SQL

## 技术支持

如果您在部署过程中遇到任何问题，请参考以下资源：

1. **FastAPI 文档**: https://fastapi.tiangolo.com/
2. **MongoDB 文档**: https://docs.mongodb.com/
3. **Uvicorn 文档**: https://www.uvicorn.org/

或者联系您的技术支持团队获取帮助。
