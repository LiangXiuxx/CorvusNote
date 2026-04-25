from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from typing import List, Optional
from datetime import datetime
import os
from bson.objectid import ObjectId
from app.api.auth import get_current_user
from app.models.knowledge_base import KnowledgeBaseModel
from app.schemas.knowledge_base import KnowledgeBase, KnowledgeBaseCreate, KnowledgeBaseUpdate, RAGStrategyConfig
from app.core.config import settings
from app.services.rag_service import build_and_save_index, delete_index, RAGStrategy, auto_detect_strategy
from app.utils.file_utils import decode_file_content, MAX_FILE_SIZE_BYTES, INDEXABLE_EXTENSIONS

router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge-bases"])
knowledge_base_model = KnowledgeBaseModel()

# 确保上传目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


def _build_strategy(
    strategy_mode: str,
    chunk_size: Optional[int],
    chunk_overlap: Optional[int],
    top_k: Optional[int],
    score_threshold: Optional[float],
    file_content: str,
    file_name: str,
) -> RAGStrategy:
    """根据前端传入参数构建 RAGStrategy；mode='auto' 时自动推断。"""
    if strategy_mode == "manual" and all(
        v is not None for v in [chunk_size, chunk_overlap, top_k, score_threshold]
    ):
        return RAGStrategy(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            top_k=top_k,
            retrieve_k=max(top_k * 2, 10),
            score_threshold=score_threshold,
            enable_rewrite=True,
            enable_rerank=True,
        )
    # 自动推断
    return auto_detect_strategy(file_content, file_name)


@router.post("", response_model=KnowledgeBase)
async def create_knowledge_base(
    name: str = Form(...),
    file: UploadFile = File(...),
    # RAG 策略参数（可选，默认自动）
    strategy_mode: str = Form("auto"),          # "auto" | "manual"
    chunk_size: Optional[int] = Form(None),
    chunk_overlap: Optional[int] = Form(None),
    top_k: Optional[int] = Form(None),
    score_threshold: Optional[float] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    # ── 1. 读取文件内容 ──────────────────────────────────────────
    try:
        content = await file.read()
        file_size = len(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件读取失败: {str(e)}"
        )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"文件过大（{file_size / 1024 / 1024:.1f} MB），"
                f"最大支持 {MAX_FILE_SIZE_BYTES // 1024 // 1024} MB。"
                "请拆分文件后分批上传。"
            ),
        )
    
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件为空，无法处理。请上传非空文件。"
        )

    # ── 2. 解码文本内容（非文本文件返回 None）───────────────────
    text_content = decode_file_content(content, file.filename)

    # ── 3. 保存原始文件 ──────────────────────────────────────────
    timestamp = datetime.utcnow().timestamp()
    safe_name = os.path.basename(file.filename)  # 防止路径遍历
    file_path = os.path.join(
        settings.UPLOAD_DIR,
        f"{current_user['_id']}_{timestamp}_{safe_name}"
    )
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件保存失败: {str(e)}"
        )

    # ── 4. 写入 MongoDB 记录 ──────────────────────────────────────
    new_kb = knowledge_base_model.create({
        "user_id": ObjectId(current_user["_id"]),
        "name": name,
        "file_path": file_path,
        "file_size": file_size,
        "file_type": file.content_type,
        "indexed": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    kb_id = str(new_kb["_id"])

    # ── 5. 构建并持久化向量索引 ───────────────────────────────────
    used_strategy: Optional[RAGStrategy] = None
    if text_content is not None:
        try:
            used_strategy = _build_strategy(
                strategy_mode=strategy_mode,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                top_k=top_k,
                score_threshold=score_threshold,
                file_content=text_content,
                file_name=file.filename,
            )
            build_and_save_index(
                kb_id=kb_id,
                file_content=text_content,
                file_name=file.filename,
                strategy=used_strategy,
            )
            knowledge_base_model.update(kb_id, {"indexed": True})
            new_kb["indexed"] = True
        except Exception as e:
            # 回滚
            try:
                os.remove(file_path)
            except OSError:
                pass
            knowledge_base_model.delete(kb_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"向量索引构建失败，请检查 API Key 是否有效: {str(e)}"
            )

    strategy_schema = None
    if used_strategy:
        strategy_schema = RAGStrategyConfig(
            chunk_size=used_strategy.chunk_size,
            chunk_overlap=used_strategy.chunk_overlap,
            top_k=used_strategy.top_k,
            score_threshold=used_strategy.score_threshold,
            enable_rewrite=used_strategy.enable_rewrite,
            enable_rerank=used_strategy.enable_rerank,
        )

    return KnowledgeBase(
        id=kb_id,
        user_id=str(new_kb["user_id"]),
        name=new_kb["name"],
        file_path=new_kb["file_path"],
        file_size=new_kb["file_size"],
        file_type=new_kb["file_type"],
        strategy=strategy_schema,
        created_at=new_kb["created_at"],
        updated_at=new_kb["updated_at"]
    )


@router.get("", response_model=List[KnowledgeBase])
async def get_knowledge_bases(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    kbs = knowledge_base_model.get_by_user_id(str(current_user["_id"]), skip=skip, limit=limit)
    return [
        KnowledgeBase(
            id=str(kb["_id"]),
            user_id=str(kb["user_id"]),
            name=kb["name"],
            file_path=kb["file_path"],
            file_size=kb["file_size"],
            file_type=kb["file_type"],
            indexed=kb.get("indexed", False),   # 补充索引状态字段
            created_at=kb["created_at"],
            updated_at=kb["updated_at"]
        )
        for kb in kbs
    ]


@router.get("/{kb_id}", response_model=KnowledgeBase)
async def get_knowledge_base(kb_id: str, current_user: dict = Depends(get_current_user)):
    kb = knowledge_base_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    if str(kb["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return KnowledgeBase(
        id=str(kb["_id"]),
        user_id=str(kb["user_id"]),
        name=kb["name"],
        file_path=kb["file_path"],
        file_size=kb["file_size"],
        file_type=kb["file_type"],
        created_at=kb["created_at"],
        updated_at=kb["updated_at"]
    )


@router.put("/{kb_id}", response_model=KnowledgeBase)
async def update_knowledge_base(
    kb_id: str,
    kb_data: KnowledgeBaseUpdate,
    current_user: dict = Depends(get_current_user),
):
    kb = knowledge_base_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    if str(kb["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    update_data: dict = {"updated_at": datetime.utcnow()}
    if kb_data.name:
        update_data["name"] = kb_data.name

    updated_kb = knowledge_base_model.update(kb_id, update_data)

    return KnowledgeBase(
        id=str(updated_kb["_id"]),
        user_id=str(updated_kb["user_id"]),
        name=updated_kb["name"],
        file_path=updated_kb["file_path"],
        file_size=updated_kb["file_size"],
        file_type=updated_kb["file_type"],
        created_at=updated_kb["created_at"],
        updated_at=updated_kb["updated_at"]
    )


@router.delete("/{kb_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge_base(kb_id: str, current_user: dict = Depends(get_current_user)):
    kb = knowledge_base_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    if str(kb["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # 删除原始文件
    if os.path.exists(kb["file_path"]):
        try:
            os.remove(kb["file_path"])
        except Exception as e:
            print(f"[KB] 删除原始文件失败: {str(e)}")

    # 删除向量索引目录（含 strategy.json）
    delete_index(kb_id)

    # 删除 MongoDB 记录
    knowledge_base_model.delete(kb_id)

    return None


@router.post("/{kb_id}/upload")
async def upload_to_knowledge_base(
    kb_id: str,
    file: UploadFile = File(...),
    # RAG 策略参数（可选，默认自动）
    strategy_mode: str = Form("auto"),          # "auto" | "manual"
    chunk_size: Optional[int] = Form(None),
    chunk_overlap: Optional[int] = Form(None),
    top_k: Optional[int] = Form(None),
    score_threshold: Optional[float] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    # ── 1. 验证知识库存在且用户有权限 ────────────────────────
    kb = knowledge_base_model.get_by_id(kb_id)
    if not kb:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found")

    if str(kb["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # ── 2. 读取文件内容 ───────────────────────────────────────
    try:
        content = await file.read()
        file_size = len(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件读取失败: {str(e)}"
        )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"文件过大（{file_size / 1024 / 1024:.1f} MB），"
                f"最大支持 {MAX_FILE_SIZE_BYTES // 1024 // 1024} MB。"
                "请拆分文件后分批上传。"
            ),
        )
    
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件为空，无法处理。请上传非空文件。"
        )

    # ── 3. 解码文本内容（非文本文件返回 None）──────────────────
    text_content = decode_file_content(content, file.filename)

    # ── 4. 保存原始文件 ───────────────────────────────────────
    timestamp = datetime.utcnow().timestamp()
    safe_name = os.path.basename(file.filename)  # 防止路径遍历
    file_path = os.path.join(
        settings.UPLOAD_DIR,
        f"{current_user['_id']}_{timestamp}_{safe_name}"
    )
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件保存失败: {str(e)}"
        )

    # ── 5. 构建并持久化向量索引 ────────────────────────────────
    used_strategy: Optional[RAGStrategy] = None
    if text_content is not None:
        try:
            used_strategy = _build_strategy(
                strategy_mode=strategy_mode,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                top_k=top_k,
                score_threshold=score_threshold,
                file_content=text_content,
                file_name=file.filename,
            )
            build_and_save_index(
                kb_id=kb_id,
                file_content=text_content,
                file_name=file.filename,
                strategy=used_strategy,
            )
            knowledge_base_model.update(kb_id, {"indexed": True, "updated_at": datetime.utcnow()})
        except Exception as e:
            # 回滚
            try:
                os.remove(file_path)
            except OSError:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"向量索引构建失败，请检查 API Key 是否有效: {str(e)}"
            )

    # ── 6. 返回文件信息 ────────────────────────────────────────
    return {
        "id": kb_id,
        "file_name": file.filename,
        "file_size": file_size,
        "file_type": file.content_type,
        "file_path": file_path,
        "indexed": text_content is not None,
        "updated_at": datetime.utcnow()
    }
