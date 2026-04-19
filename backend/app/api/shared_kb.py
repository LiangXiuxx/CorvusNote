from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from typing import Optional
from datetime import datetime
import os
import uuid
from bson.objectid import ObjectId
from app.api.auth import get_current_user
from app.models.shared_kb import SharedKnowledgeBaseModel, SharedKBMemberModel
from app.schemas.shared_kb import SharedKB, SharedKBListItem, SharedKBCreate, SharedKBUpdate
from app.core.config import settings

router = APIRouter(prefix="/api/shared-kb", tags=["shared-kb"])

shared_kb_model = SharedKnowledgeBaseModel()
member_model = SharedKBMemberModel()

# 预设分类
CATEGORIES = ["推荐", "科技", "教育", "职场", "财经", "产业", "健康", "法律", "人文", "生活"]

# 公开数量限制
MAX_PUBLIC_KB = 10

# 确保上传目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# 支持建立向量索引的文件类型
INDEXABLE_EXTENSIONS = {".txt", ".md", ".markdown", ".pdf", ".docx"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024


def _extract_pdf(raw: bytes) -> str:
    """从 PDF 字节提取纯文本"""
    import io
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(raw))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages.append(text)
    return "\n\n".join(pages)


def _extract_docx(raw: bytes) -> str:
    """从 DOCX 字节提取纯文本"""
    import io
    from docx import Document
    doc = Document(io.BytesIO(raw))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def _decode_content(raw: bytes, filename: str) -> str | None:
    """将文件字节解码为字符串"""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in INDEXABLE_EXTENSIONS:
        return None

    if ext == ".pdf":
        try:
            text = _extract_pdf(raw)
            if not text.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF [{filename}] 未能提取到文本内容",
                )
            return text
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"PDF [{filename}] 解析失败: {e}",
            )

    if ext == ".docx":
        try:
            return _extract_docx(raw)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"DOCX [{filename}] 解析失败: {e}",
            )

    for encoding in ("utf-8", "gbk"):
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"文件 [{filename}] 编码无法识别",
    )


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
    kb_map = {str(kb["_id"]: kb for kb in kbs}
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

    # 删除成员记录
    members = member_model.get_members(kb_id)
    for m in members:
        member_model.remove_member(kb_id, str(m["user_id"]))

    # 删除知识库
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

@router.post("/{kb_id}/upload", response_model=dict)
async def upload_file_to_shared_kb(
    kb_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """上传文件到共享知识库"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    # 检查权限
    if not member_model.is_member(kb_id, str(current_user["_id"])):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="您不是成员，无权上传")

    # 读取文件
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

    # 保存文件
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

    # 更新文件计数
    shared_kb_model.increment_file_count(kb_id, 1)

    return {
        "id": str(uuid.uuid4()),
        "name": safe_name,
        "file_path": file_path,
        "file_size": file_size,
        "file_type": file.content_type,
        "uploaded_at": datetime.utcnow()
    }


@router.get("/{kb_id}/files", response_model=list)
async def get_shared_kb_files(
    kb_id: str,
    current_user: dict = Depends(get_current_user),
):
    """获取共享知识库文件列表"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    # 检查权限
    is_member = member_model.is_member(kb_id, str(current_user["_id"]))
    if not kb.get("is_public", False) and not is_member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")

    # TODO: 实现文件列表查询
    return []


@router.delete("/{kb_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shared_kb_file(
    kb_id: str,
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """删除共享知识库文件"""
    kb = shared_kb_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识库不存在")

    # 只有创建者可以删除文件
    if str(kb["owner_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="只有创建者可以删除文件")

    # TODO: 实现文件删除
    shared_kb_model.increment_file_count(kb_id, -1)

    return None
