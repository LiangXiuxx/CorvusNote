from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
from datetime import datetime, timedelta
from pymongo import ASCENDING, DESCENDING
from bson.objectid import ObjectId
from app.core.config import settings
from app.core.database import get_db, close_db
from app.api import auth, users, conversations, messages, notes, knowledge_bases, chat, shared_kb, admin

# ── 审计日志配置 ───────────────────────────────────────────────
# 管理员高权限操作写入独立审计日志文件，便于事后追溯
_audit_handler = logging.FileHandler("audit.log", encoding="utf-8")
_audit_handler.setFormatter(logging.Formatter("%(asctime)s [AUDIT] %(message)s"))
audit_logger = logging.getLogger("audit")
audit_logger.setLevel(logging.INFO)
audit_logger.addHandler(_audit_handler)
audit_logger.addHandler(logging.StreamHandler())  # 同时输出到控制台

# 确保上传目录和向量存储目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.VECTOR_STORE_DIR, exist_ok=True)


def _ensure_indexes(db) -> None:
    """创建必要的 MongoDB 索引，幂等操作（已存在时静默跳过）。"""
    from pymongo.errors import DuplicateKeyError, OperationFailure

    try:
        # users：用户名唯一索引，加速登录/注册查重
        # dropDups=False 是默认行为，有重复数据时索引创建会失败
        db["users"].create_index("username", unique=True, background=True)
        print("[DB] 用户表 username 唯一索引已就绪")
    except DuplicateKeyError:
        # 如果已存在重复 username 数据，索引创建会失败
        # 打印严重警告，管理员需要手动清理重复数据
        print("[DB] ⚠️  严重错误：users 表中存在重复 username！")
        print("[DB] ⚠️  请手动清理重复数据后重启服务")
        # 不阻止服务启动，但后续业务层需做应用级查重
    except OperationFailure as e:
        print(f"[DB] ⚠️  索引创建失败（可忽略，后续可能重试）: {e}")

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

    # shared_knowledge_bases：按创建者查询
    db["shared_knowledge_bases"].create_index(
        [("owner_id", ASCENDING), ("created_at", DESCENDING)], background=True
    )

    # shared_kb_members：按知识库和用户查询（成员检查）
    db["shared_kb_members"].create_index(
        [("kb_id", ASCENDING), ("user_id", ASCENDING)], unique=True, background=True
    )

    # shared_kb_files：按知识库查询文件列表，并按上传时间升序排列
    db["shared_kb_files"].create_index(
        [("kb_id", ASCENDING), ("uploaded_at", ASCENDING)], background=True
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
            "nickname": "Admin",
            "password_hash": get_password_hash("admin123"),
            "is_admin": True,
            "is_guest": False,
            "avatar": "https://ui-avatars.com/api/?name=Admin&background=random&color=fff",
            "avatar_color": "#1677ff",
            "status": "active",
            "token_version": 1,
            "last_login_at": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        print("[Init] Admin 账号已创建：admin / admin123（请尽快修改密码）")

    # 4. 迁移旧用户：补充新字段（token_version、nickname、status、avatar_color）
    import re as _re
    migration_count = 0
    for old_user in user_model.collection.find({"token_version": {"$exists": False}}):
        avatar_url = old_user.get("avatar", "")
        color_match = _re.search(r'background=([0-9a-fA-F]{6})', avatar_url)
        avatar_color = f"#{color_match.group(1)}" if color_match else "#1677ff"
        user_model.collection.update_one(
            {"_id": old_user["_id"]},
            {"$set": {
                "token_version": 1,
                "nickname": old_user.get("username", ""),
                "status": "active",
                "avatar_color": avatar_color,
                "last_login_at": None,
            }}
        )
        migration_count += 1
    if migration_count:
        print(f"[Migration] 已迁移 {migration_count} 个旧用户，补充 token_version 等字段")

    yield
    # ── 关闭时清理 ────────────────────────────────────────────────
    close_db()

app = FastAPI(lifespan=lifespan)

# 配置 CORS — 精确匹配来源，不允许通配符 *（否则 credentials 会被浏览器拒绝）
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
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
app.include_router(shared_kb.router)
app.include_router(admin.router)

@app.get("/")
async def root():
    return {"message": "CorvusNote API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)