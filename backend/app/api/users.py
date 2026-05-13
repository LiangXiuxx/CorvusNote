import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import datetime
from app.api.auth import get_current_user
from app.models.user import UserModel
from app.models.conversation import ConversationModel
from app.models.note import NoteModel
from app.models.knowledge_base import KnowledgeBaseModel
from app.models.message import MessageModel
from app.schemas.user import User, UserUpdate
from app.core.security import get_password_hash
from app.services.rag_service import delete_index
import os

router = APIRouter(prefix="/api/users", tags=["users"])
user_model = UserModel()

# 复用 main.py 中配置好的审计日志器
audit_logger = logging.getLogger("audit")


def _user_to_response(user: dict) -> User:
    """将 MongoDB user document 转换为 User response model"""
    return User(
        id=str(user["_id"]),
        username=user["username"],
        nickname=user.get("nickname", user["username"]),
        is_admin=user.get("is_admin", False),
        is_guest=user.get("is_guest", False),
        avatar=user.get("avatar", ""),
        avatar_color=user.get("avatar_color", ""),
        status=user.get("status", "active"),
        token_version=user.get("token_version", 0),
        last_login_at=user.get("last_login_at"),
        created_at=user["created_at"],
        updated_at=user["updated_at"]
    )


@router.get("/profile", response_model=User)
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    return _user_to_response(current_user)


@router.put("/profile", response_model=User)
async def update_user_profile(user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}

    # 修改昵称
    if user_data.nickname is not None:
        nickname = user_data.nickname.strip()
        if len(nickname) < 1 or len(nickname) > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nickname must be 1-20 characters"
            )
        update_data["nickname"] = nickname

    # 修改密码 → 同时使旧 token 失效
    if user_data.password:
        update_data["password_hash"] = get_password_hash(user_data.password)
        user_model.increment_token_version(str(current_user["_id"]))
        audit_logger.info(f"user={current_user['username']} 修改了密码")

    # 修改头像
    if user_data.avatar is not None:
        update_data["avatar"] = user_data.avatar
    if user_data.avatar_color is not None:
        update_data["avatar_color"] = user_data.avatar_color

    update_data["updated_at"] = datetime.utcnow()
    updated_user = user_model.update(str(current_user["_id"]), update_data)
    return _user_to_response(updated_user)


@router.get("/admin", response_model=List[User])
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    users = user_model.get_all()
    return [_user_to_response(user) for user in users]


def _cascade_delete_user(user_id: str, deleted_by_username: str) -> str:
    """级联删除用户的所有数据（对话、消息、笔记、知识库、文件）。返回被删除用户的 username。"""
    target_user = user_model.get_by_id(user_id)
    target_username = target_user["username"] if target_user else user_id

    conv_model = ConversationModel()
    note_model = NoteModel()
    kb_model = KnowledgeBaseModel()

    conversations = conv_model.get_by_user_id(user_id)
    msg_model = MessageModel()
    for conv in conversations:
        msg_model.delete_by_conversation_id(str(conv["_id"]))
        conv_model.delete(str(conv["_id"]))

    notes = note_model.get_by_user_id(user_id)
    for note in notes:
        note_model.delete(str(note["_id"]))

    knowledge_bases = kb_model.get_by_user_id(user_id)
    for kb in knowledge_bases:
        kb_id = str(kb["_id"])
        if kb.get("file_path") and os.path.exists(kb["file_path"]):
            try:
                os.remove(kb["file_path"])
            except Exception as e:
                audit_logger.warning(f"删除文件失败 kb={kb_id}: {e}")
        delete_index(kb_id)
        kb_model.delete(kb_id)

    user_model.delete(user_id)

    audit_logger.info(
        f"操作者={deleted_by_username} 级联删除用户 user_id={user_id} username={target_username}"
    )
    return target_username


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_own_account(current_user: dict = Depends(get_current_user)):
    """用户自助注销：删除自己的账户及全部数据。"""
    user_id = str(current_user["_id"])
    _cascade_delete_user(user_id, current_user["username"])
    return None


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    if str(current_user["_id"]) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account, use DELETE /api/users/me instead"
        )

    _cascade_delete_user(user_id, current_user["username"])
    return None


@router.put("/{user_id}", response_model=User)
async def update_user_by_admin(
    user_id: str,
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
):
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    target = user_model.get_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data: dict = {"updated_at": datetime.utcnow()}
    changes = []

    if user_data.nickname is not None:
        update_data["nickname"] = user_data.nickname
        changes.append(f"nickname→{user_data.nickname}")

    if user_data.password:
        update_data["password_hash"] = get_password_hash(user_data.password)
        user_model.increment_token_version(user_id)
        changes.append("password_reset")

    if user_data.avatar is not None:
        update_data["avatar"] = user_data.avatar
    if user_data.avatar_color is not None:
        update_data["avatar_color"] = user_data.avatar_color

    updated = user_model.update(user_id, update_data)

    if changes:
        audit_logger.info(
            f"admin={current_user['username']} 修改用户 user_id={user_id} "
            f"username={target['username']} 变更=[{', '.join(changes)}]"
        )

    return _user_to_response(updated)


@router.put("/{user_id}/status", response_model=User)
async def update_user_status(
    user_id: str,
    status_body: dict,
    current_user: dict = Depends(get_current_user),
):
    """管理员启用/禁用用户。请求体: {"status": "active" | "disabled"}"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own status")

    target = user_model.get_by_id(user_id)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_status = status_body.get("status")
    if new_status not in ("active", "disabled"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    updated = user_model.update(user_id, {
        "status": new_status,
        "updated_at": datetime.utcnow()
    })

    audit_logger.info(
        f"admin={current_user['username']} 设置用户 user_id={user_id} "
        f"username={target['username']} status→{new_status}"
    )

    return _user_to_response(updated)
