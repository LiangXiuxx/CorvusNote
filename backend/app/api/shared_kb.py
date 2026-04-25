from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from typing import Optional
from datetime import datetime
import os
import uuid
from bson.objectid import ObjectId
from app.api.auth import get_current_user
from app.models.shared_kb import SharedKnowledgeBaseModel, SharedKBMemberModel, SharedKBFileModel
from app.schemas.shared_kb import SharedKB, SharedKBListItem, SharedKBCreate, SharedKBUpdate, SharedKBFile, SharedKBFileContent
from app.core.config import settings
from app.services.rag_service import build_and_save_index, delete_index, auto_detect_strategy
from app.utils.file_utils import validate_file_mime, decode_file_content, MAX_FILE_SIZE_BYTES, INDEXABLE_EXTENSIONS

router = APIRouter(prefix="/api/shared-kb", tags=["shared-kb"])

shared_kb_model = SharedKnowledgeBaseModel()
member_model = SharedKBMemberModel()
file_model = SharedKBFileModel()

# 预设分类
CATEGORIES = ["推荐", "科技", "教育", "职场", "财经", "产业", "健康", "法律", "人文", "生活"]

# 公开数量限制
MAX_PUBLIC_KB = 10

# 确保上传目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@router.post("", response_model=SharedKB)
async def create_shared_kb(
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form("推荐"),
    is_public: bool = Form(False),
    cover: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    # 验证分类
    if category not in CATEGORIES:
        category = "推荐"

    # 检查公开数量限制
    if is_public:
        public_count = shared_kb_model.count_by_owner_public(str(current_user["_id"]))
        if public_count >= MAX_PUBLIC_KB:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"您最多只能公开 {MAX_PUBLIC_KB} 个知识库"
            )

    new_kb = shared_kb_model.create({
        "name": name,
        "description": description,
        "cover": cover,
        "owner_id": ObjectId(current_user["_id"]),
        "owner_name": current_user.get("username", "未知用户"),
        "is_public": is_public,
        "category": category,
        "member_count": 1,  # 创建者自己
        "file_count": 0,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })

    # 创建者自动加入
    member_model.add_member(str(new_kb["_id"]), str(current_user["_id"]), "owner")

    return SharedKB(
        id=str(new_kb["_id"]),
        name=new_kb["name"],
        description=new_kb["description"],
        cover=new_kb["cover"],
        owner_id=str(new_kb["owner_id"]),
        owner_name=new_kb["owner_name"],
        is_public=new_kb["is_public"],
        category=new_kb["category"],
        member_count=new_kb["member_count"],
        file_count=new_kb["file_count"],
        created_at=new_kb["created_at"],
        updated_at=new_kb["updated_at"]
    )


@router.get("/public", response_model=dict)
async def get_public_knowledge_bases(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """获取公开知识库列表（发现页）"""
    kbs = shared_kb_model.get_public(category=category, search=search, skip=skip, limit=limit)
    total = shared_kb_model.count_public(category=category)

    return {
        "items": [
            SharedKBListItem(
                id=str(kb["_id"]),
                name=kb["name"],
                description=kb["description"],
                cover=kb.get("cover"),
                owner_name=kb["owner_name"],
                category=kb["category"],
                member_count=kb.get("member_count", 0),
                file_count=kb.get("file_count", 0),
                created_at=kb["created_at"]
            )
            for kb in kbs
        ],
        "total": total,
        "categories": CATEGORIES
    }


@router.get("/my-created", response_model=list)
async def get_my_created_kb(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    """获取我创建的共享知识库"""
    kbs = shared_kb_model.get_by_owner(str(current_user["_id"]), skip=skip, limit=limit)
    return [
        SharedKB(
            id=str(kb["_id"]),
            name=kb["name"],
            description=kb["description"],
            cover=kb.get("cover"),
            owner_id=str(kb["owner_id"]),
            owner_name=kb["owner_name"],
            is_public=kb["is_public"],
            category=kb["category"],
            member_count=kb.get("member_count", 0),
            file_count=kb.get("file_count", 0),
            created_at=kb["created_at"],
            updated_at=kb["updated_at"]
        )
        for kb in kbs
    ]


@router.get("/my-joined", response_model=list)
async def get_my_joined_kb(
    current_user: dict = Depends(get_current_user),
):
    """获取我加入的共享知识库"""
    memberships = member_model.get_user_kbs(str(current_user["_id"]))
    kb_ids = [str(m["kb_id"]) for m in memberships]
    kbs = shared_kb_model.get_by_ids(kb_ids)

    # 按加入时间排序
    kb_map = {str(kb["_id"]): kb for kb in kbs}
    result = []
    for m in memberships:
        kb = kb_map.get(str(m["kb_id"]))
        if kb:
            result.append(SharedKB(
                id=str(kb["_id"]),
                name=kb["name"],
                description=kb["description"],
                cover=kb.get("cover"),
                owner_id=str(kb["owner_id"]),
                owner_name=kb["owner_name"],
                is_public=kb["is_public"],
                category=kb["category"],
                member_count=kb.get("member_count", 0),
                file_count=kb.get("file_count", 0),
                created_at=kb["created_at"],
                updated_at=kb["updated_at"]
            ))

    return result


@router.get("/{kb_id}", response_model=SharedKB)
async def get_shared_kb(kb_id: str, current_user: dict = Depends(get_current_user)):
    """获取共享知识库详情"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    # 检查权限
    is_member = member_model.is_member(kb_id, str(current_user["_id"]))
    if not kb.get("is_public", False) and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")

    return SharedKB(
        id=str(kb["_id"]),
        name=kb["name"],
        description=kb["description"],
        cover=kb.get("cover"),
        owner_id=str(kb["owner_id"]),
        owner_name=kb["owner_name"],
        is_public=kb["is_public"],
        category=kb["category"],
        member_count=kb.get("member_count", 0),
        file_count=kb.get("file_count", 0),
        created_at=kb["created_at"],
        updated_at=kb["updated_at"]
    )


@router.put("/{kb_id}", response_model=SharedKB)
async def update_shared_kb(
    kb_id: str,
    kb_data: SharedKBUpdate,
    current_user: dict = Depends(get_current_user),
):
    """更新共享知识库"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    # 只有创建者可以更新
    if str(kb["owner_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有创建者可以编辑")

    update_dict = {}
    if kb_data.name:
        update_dict["name"] = kb_data.name
    if kb_data.description is not None:
        update_dict["description"] = kb_data.description
    if kb_data.cover is not None:
        update_dict["cover"] = kb_data.cover
    if kb_data.category:
        if kb_data.category not in CATEGORIES:
            kb_data.category = "推荐"
        update_dict["category"] = kb_data.category
    if kb_data.is_public is not None:
        # 检查公开数量限制
        if kb_data.is_public and not kb.get("is_public", False):
            public_count = shared_kb_model.count_by_owner_public(str(current_user["_id"]))
            if public_count >= MAX_PUBLIC_KB:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"您最多只能公开 {MAX_PUBLIC_KB} 个知识库"
                )
        update_dict["is_public"] = kb_data.is_public

    updated_kb = shared_kb_model.update(kb_id, update_dict)

    return SharedKB(
        id=str(updated_kb["_id"]),
        name=updated_kb["name"],
        description=updated_kb["description"],
        cover=updated_kb.get("cover"),
        owner_id=str(updated_kb["owner_id"]),
        owner_name=updated_kb["owner_name"],
        is_public=updated_kb["is_public"],
        category=updated_kb["category"],
        member_count=updated_kb.get("member_count", 0),
        file_count=updated_kb.get("file_count", 0),
        created_at=updated_kb["created_at"],
        updated_at=updated_kb["updated_at"]
    )


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shared_kb(kb_id: str, current_user: dict = Depends(get_current_user)):
    """删除共享知识库（仅创建者）"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    if str(kb["owner_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有创建者可以删除")

    # 删除成员记录（批量删除比逐条删除快）
    member_model.collection.delete_many({"kb_id": ObjectId(kb_id)})

    # 删除所有文件（磁盘 + MongoDB）
    kb_files = file_model.get_by_kb_id(kb_id)
    for f in kb_files:
        if os.path.exists(f["file_path"]):
            try:
                os.remove(f["file_path"])
            except OSError:
                pass
    file_model.delete_by_kb_id(kb_id)

    # 删除向量索引（键名为 shared_{kb_id}）
    delete_index(f"shared_{kb_id}")

    # 删除知识库本身
    shared_kb_model.delete(kb_id)

    return None


@router.post("/{kb_id}/join", response_model=dict)
async def join_kb(kb_id: str, current_user: dict = Depends(get_current_user)):
    """加入共享知识库"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    if not kb.get("is_public", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该知识库未公开")

    # 检查是否已经是成员
    if member_model.is_member(kb_id, str(current_user["_id"])):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="您已经是成员")

    member_model.add_member(kb_id, str(current_user["_id"]), "member")
    shared_kb_model.increment_member_count(kb_id, 1)

    return {"message": "加入成功"}


@router.post("/{kb_id}/quit", status_code=status.HTTP_204_NO_CONTENT)
async def quit_kb(kb_id: str, current_user: dict = Depends(get_current_user)):
    """退出共享知识库"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    # 创建者不能退出
    if str(kb["owner_id"]) == str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="创建者不能退出，请删除知识库")

    if not member_model.is_member(kb_id, str(current_user["_id"])):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="您不是成员")

    member_model.remove_member(kb_id, str(current_user["_id"]))
    shared_kb_model.increment_member_count(kb_id, -1)

    return None


# ==================== 文件相关 ====================

@router.post("/{kb_id}/upload", response_model=SharedKBFile)
async def upload_file_to_shared_kb(
    kb_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """上传文件到共享知识库，并构建向量索引"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    if not member_model.is_member(kb_id, str(current_user["_id"])):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="您不是成员，无权上传")

    try:
        content = await file.read()
        file_size = len(content)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"文件读取失败: {str(e)}")

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"文件过大，最大支持 {MAX_FILE_SIZE_BYTES // 1024 // 1024} MB"
        )
    if file_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件为空，无法处理。")

    validate_file_mime(content, file.filename)

    # ── 保存原始文件 ───────────────────────────────────────────
    timestamp = datetime.utcnow().timestamp()
    safe_name = os.path.basename(file.filename)
    file_path = os.path.join(
        settings.UPLOAD_DIR,
        f"shared_{kb_id}_{timestamp}_{safe_name}"
    )
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"文件保存失败: {str(e)}")

    # ── 写入 MongoDB 文件记录 ─────────────────────────────────
    new_file = file_model.create({
        "kb_id": ObjectId(kb_id),
        "name": safe_name,
        "file_path": file_path,
        "file_size": file_size,
        "file_type": file.content_type or "application/octet-stream",
        "uploader_id": ObjectId(current_user["_id"]),
        "uploader_name": current_user.get("username", ""),
        "indexed": False,
        "uploaded_at": datetime.utcnow(),
    })
    file_id = str(new_file["_id"])

    # ── 构建向量索引（可索引文件类型）────────────────────────
    indexed = False
    text_content = decode_file_content(content, safe_name)
    if text_content:
        try:
            strategy = auto_detect_strategy(text_content, safe_name)
            build_and_save_index(
                kb_id=f"shared_{kb_id}",
                file_content=text_content,
                file_name=safe_name,
                strategy=strategy,
            )
            file_model.collection.update_one(
                {"_id": new_file["_id"]}, {"$set": {"indexed": True}}
            )
            indexed = True
        except Exception as e:
            print(f"[SharedKB] 向量索引构建失败（文件已保存）: {e}")

    shared_kb_model.increment_file_count(kb_id, 1)

    return SharedKBFile(
        id=file_id,
        kb_id=kb_id,
        name=safe_name,
        file_size=file_size,
        file_type=file.content_type or "application/octet-stream",
        uploader_id=str(current_user["_id"]),
        uploader_name=current_user.get("username", ""),
        indexed=indexed,
        uploaded_at=new_file["uploaded_at"],
    )


@router.get("/{kb_id}/files", response_model=list[SharedKBFile])
async def get_shared_kb_files(
    kb_id: str,
    current_user: dict = Depends(get_current_user),
):
    """获取共享知识库文件列表"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    is_member = member_model.is_member(kb_id, str(current_user["_id"]))
    if not kb.get("is_public", False) and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")

    files = file_model.get_by_kb_id(kb_id)
    return [
        SharedKBFile(
            id=str(f["_id"]),
            kb_id=str(f["kb_id"]),
            name=f["name"],
            file_size=f["file_size"],
            file_type=f["file_type"],
            uploader_id=str(f["uploader_id"]),
            uploader_name=f.get("uploader_name", ""),
            indexed=f.get("indexed", False),
            uploaded_at=f["uploaded_at"],
        )
        for f in files
    ]


@router.get("/{kb_id}/files/{file_id}/content", response_model=SharedKBFileContent)
async def get_shared_kb_file_content(
    kb_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """读取文件纯文本内容用于前端预览"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    is_member = member_model.is_member(kb_id, str(current_user["_id"]))
    if not kb.get("is_public", False) and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")

    f = file_model.get_by_id(file_id)
    if not f or str(f["kb_id"]) != kb_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    if not os.path.exists(f["file_path"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件已被移除")

    with open(f["file_path"], "rb") as fp:
        raw = fp.read()

    text = decode_file_content(raw, f["name"])
    if text is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="该文件类型不支持在线预览"
        )

    return SharedKBFileContent(
        id=file_id,
        name=f["name"],
        file_type=f["file_type"],
        content=text,
    )


@router.delete("/{kb_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shared_kb_file(
    kb_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """删除共享知识库文件（所有者 或 上传者 可删除）"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    f = file_model.get_by_id(file_id)
    if not f or str(f["kb_id"]) != kb_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    is_owner = str(kb["owner_id"]) == str(current_user["_id"])
    is_uploader = str(f["uploader_id"]) == str(current_user["_id"])
    if not is_owner and not is_uploader:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除该文件")

    # 先删除磁盘文件，再删 DB 记录（顺序正确，失败时 DB 记录保留可重试）
    if os.path.exists(f["file_path"]):
        try:
            os.remove(f["file_path"])
        except OSError as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"文件删除失败: {e}"
            )

    file_model.delete(file_id)
    shared_kb_model.increment_file_count(kb_id, -1)
    return None