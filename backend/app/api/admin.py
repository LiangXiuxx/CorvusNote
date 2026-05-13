import logging
import os
from datetime import datetime
from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.auth import get_current_user
from app.core.database import get_db
from app.models.shared_kb import SharedKnowledgeBaseModel, SharedKBMemberModel, SharedKBFileModel
from app.services.rag_service import delete_index

router = APIRouter(prefix="/api/admin", tags=["admin"])
audit_logger = logging.getLogger("audit")

shared_kb_model = SharedKnowledgeBaseModel()
member_model   = SharedKBMemberModel()
file_model     = SharedKBFileModel()


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user


@router.get("/stats")
async def get_stats(admin: dict = Depends(require_admin)):
    """系统数据概览（管理员专用）"""
    db = get_db()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    return {
        "users": {
            "total":     db["users"].count_documents({}),
            "new_today": db["users"].count_documents({"created_at": {"$gte": today_start}}),
            "disabled":  db["users"].count_documents({"status": "disabled"}),
            "admins":    db["users"].count_documents({"is_admin": True}),
        },
        "shared_kbs": {
            "total":  db["shared_knowledge_bases"].count_documents({}),
            "public": db["shared_knowledge_bases"].count_documents({"is_public": True}),
            "files":  db["shared_kb_files"].count_documents({}),
        },
        "content": {
            "conversations": db["conversations"].count_documents({}),
            "notes":         db["notes"].count_documents({}),
        },
    }


@router.get("/shared-kbs")
async def list_all_shared_kbs(
    skip:  int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    admin: dict = Depends(require_admin),
):
    """获取全部共享知识库（不限可见性，管理员专用）"""
    db = get_db()
    kbs   = list(db["shared_knowledge_bases"].find().sort("created_at", -1).skip(skip).limit(limit))
    total = db["shared_knowledge_bases"].count_documents({})

    return {
        "total": total,
        "items": [
            {
                "id":           str(kb["_id"]),
                "name":         kb["name"],
                "description":  kb.get("description", ""),
                "owner_name":   kb.get("owner_name", ""),
                "owner_id":     str(kb.get("owner_id", "")),
                "category":     kb.get("category", "推荐"),
                "is_public":    kb.get("is_public", False),
                "member_count": kb.get("member_count", 0),
                "file_count":   kb.get("file_count", 0),
                "created_at":   kb["created_at"].isoformat() if kb.get("created_at") else None,
            }
            for kb in kbs
        ],
    }


@router.delete("/shared-kbs/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_shared_kb(kb_id: str, admin: dict = Depends(require_admin)):
    """管理员强制删除共享知识库（级联删除文件和成员）"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    member_model.collection.delete_many({"kb_id": ObjectId(kb_id)})

    for f in file_model.get_by_kb_id(kb_id):
        fp = f.get("file_path")
        if fp and os.path.exists(fp):
            try:
                os.remove(fp)
            except OSError:
                pass
    file_model.delete_by_kb_id(kb_id)
    delete_index(f"shared_{kb_id}")
    shared_kb_model.delete(kb_id)

    audit_logger.info(
        f"管理员={admin.get('username')} 强制删除共享知识库 kb_id={kb_id} name={kb.get('name')}"
    )
    return None


@router.put("/shared-kbs/{kb_id}/visibility")
async def toggle_kb_visibility(kb_id: str, admin: dict = Depends(require_admin)):
    """管理员切换共享知识库公开/私有状态"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    new_visibility = not kb.get("is_public", False)
    shared_kb_model.update(kb_id, {"is_public": new_visibility})

    audit_logger.info(
        f"管理员={admin.get('username')} 修改共享知识库 kb_id={kb_id} "
        f"可见性→{'公开' if new_visibility else '私有'}"
    )
    return {"is_public": new_visibility}
