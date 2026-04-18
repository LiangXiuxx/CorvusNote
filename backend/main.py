from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from datetime import datetime, timedelta
from pymongo import ASCENDING, DESCENDING
from bson.objectid import ObjectId
from app.core.config import settings
from app.core.database import get_db, close_db
from app.api import auth, users, conversations, messages, notes, knowledge_bases, chat

# 确保上传目录和向量存储目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.VECTOR_STORE_DIR, exist_ok=True)


def _ensure_indexes(db) -> None:
    """创建必要的 MongoDB 索引，幂等操作（已存在时静默跳过）。"""
    # users：用户名唯一索引，加速登录/注册查重
    db["users"].create_index("username", unique=True, background=True)

    # conversations：按用户 + 更新时间查询（侧边栏排序）
    db["conversations"].create_index(
        [("user_id", ASCENDING), ("updated_at", DESCENDING)], background=True
    )

    # messages：按对话 + 时间升序（保证消息顺序正确）
    db["messages"].create_index(
        [("conversation_id", ASCENDING), ("created_at", ASCENDING)], background=True
    )

    # notes：按用户 + 更新时间
    db["notes"].create_index(
        [("user_id", ASCENDING), ("updated_at", DESCENDING)], background=True
    )

    # knowledge_bases：按用户查询
    db["knowledge_bases"].create_index(
        [("user_id", ASCENDING), ("created_at", DESCENDING)], background=True
    )

    print("[DB] 索引检查完成")


def _cleanup_guest_data(db) -> None:
    """
    清理游客用户超过 7 天未更新的数据（对话、消息、笔记）。
    每次服务启动时运行一次，避免游客数据无限膨胀。
    """
    cutoff = datetime.utcnow() - timedelta(days=7)

    guest_users = list(db["users"].find({"is_guest": True}))
    total_convs = 0
    total_notes = 0

    for guest in guest_users:
        gid = guest["_id"]

        # 找出该游客超过 7 天的旧对话
        old_convs = list(db["conversations"].find({
            "user_id": gid,
            "updated_at": {"$lt": cutoff}
        }))
        for conv in old_convs:
            db["messages"].delete_many({"conversation_id": conv["_id"]})
            db["conversations"].delete_one({"_id": conv["_id"]})
        total_convs += len(old_convs)

        # 清理旧笔记
        result = db["notes"].delete_many({
            "user_id": gid,
            "updated_at": {"$lt": cutoff}
        })
        total_notes += result.deleted_count

    if total_convs or total_notes:
        print(f"[Cleanup] 已清理游客数据：{total_convs} 个对话，{total_notes} 条笔记")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── 启动时初始化 ──────────────────────────────────────────────
    from app.models.user import UserModel
    from app.core.security import get_password_hash

    db = get_db()

    # 1. 建立数据库索引
    _ensure_indexes(db)

    # 2. 清理游客历史数据
    _cleanup_guest_data(db)

    # 3. 初始化 admin 账号（首次启动）
    user_model = UserModel()
    if not user_model.get_by_username("admin"):
        user_model.create({
            "username": "admin",
            "password_hash": get_password_hash("admin123"),
            "is_admin": True,
            "is_guest": False,
            "avatar": "https://ui-avatars.com/api/?name=Admin&background=random&color=fff",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        print("[Init] Admin 账号已创建：admin / admin123（请尽快修改密码）")

    yield
    # ── 关闭时清理 ────────────────────────────────────────────────
    close_db()

app = FastAPI(lifespan=lifespan)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应设置具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(conversations.router)
app.include_router(messages.router)
app.include_router(notes.router)
app.include_router(knowledge_bases.router)
app.include_router(chat.router)

@app.get("/")
async def root():
    return {"message": "CorvusNote API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
