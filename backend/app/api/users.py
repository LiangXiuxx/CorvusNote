import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
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


@router.get("/profile", response_model=User)
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    return User(
        id=str(current_user["_id"]),
        username=current_user["username"],
        is_admin=current_user["is_admin"],
        is_guest=current_user.get("is_guest", False),
        avatar=current_user["avatar"],
        created_at=current_user["created_at"],
        updated_at=current_user["updated_at"]
    )

@router.put("/profile", response_model=User)
async def update_user_profile(user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if user_data.username:
        existing_user = user_model.get_by_username(user_data.username)
        if existing_user and str(existing_user["_id"]) != str(current_user["_id"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        update_data["username"] = user_data.username

    if user_data.password:
        update_data["password_hash"] = get_password_hash(user_data.password)

    if user_data.avatar:
        update_data["avatar"] = user_data.avatar

    update_data["updated_at"] = datetime.utcnow()

    updated_user = user_model.update(str(current_user["_id"]), update_data)

    return User(
        id=str(updated_user["_id"]),
        username=updated_user["username"],
        is_admin=updated_user["is_admin"],
        is_guest=updated_user.get("is_guest", False),
        avatar=updated_user["avatar"],
        created_at=updated_user["created_at"],
        updated_at=updated_user["updated_at"]
    )

@router.get("/admin", response_model=List[User])
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    users = user_model.get_all()
    return [
        User(
            id=str(user["_id"]),
            username=user["username"],
            is_admin=user["is_admin"],
            is_guest=user.get("is_guest", False),
            avatar=user["avatar"],
            created_at=user["created_at"],
            updated_at=user["updated_at"]
        )
        for user in users
    ]

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
            detail="Cannot delete your own account"
        )

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
        f"admin={current_user['username']} 删除用户 user_id={user_id} username={target_username}"
    )
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

    if user_data.username:
        update_data["username"] = user_data.username
        changes.append(f"username→{user_data.username}")

    if user_data.password:
        update_data["password_hash"] = get_password_hash(user_data.password)
        changes.append("password_reset")

    if user_data.avatar:
        update_data["avatar"] = user_data.avatar

    if hasattr(user_data, "is_admin") and user_data.is_admin is not None:
        update_data["is_admin"] = user_data.is_admin
        changes.append(f"is_admin→{user_data.is_admin}")

    updated = user_model.update(user_id, update_data)

    if changes:
        audit_logger.info(
            f"admin={current_user['username']} 修改用户 user_id={user_id} "
            f"username={target['username']} 变更=[{', '.join(changes)}]"
        )

    return User(
        id=str(updated["_id"]),
        username=updated["username"],
        is_admin=updated["is_admin"],
        is_guest=updated.get("is_guest", False),
        avatar=updated["avatar"],
        created_at=updated["created_at"],
        updated_at=updated["updated_at"]
    )
