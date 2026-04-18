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

router = APIRouter(prefix="/api/knowledge-bases", tags=["knowledge-bases"])
knowledge_base_model = KnowledgeBaseModel()

# 确保上传目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# 支持建立向量索引的文件类型
INDEXABLE_EXTENSIONS = {".txt", ".md", ".markdown", ".pdf", ".docx"}

# 单文件最大上传大小：20 MB（PDF/DOCX 通常比纯文本大）
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024


def _extract_pdf(raw: bytes) -> str:
    """从 PDF 字节提取纯文本（pypdf）。"""
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
    """从 DOCX 字节提取纯文本（python-docx）。"""
    import io
    from docx import Document
    doc = Document(io.BytesIO(raw))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def _decode_content(raw: bytes, filename: str) -> str | None:
    """
    将文件字节解码为字符串。
    支持：.txt / .md / .markdown（纯文本）、.pdf（pypdf）、.docx（python-docx）。
    返回 None 表示文件类型不支持索引。
    抛出 HTTPException(400) 表示解析失败。
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in INDEXABLE_EXTENSIONS:
        return None

    if ext == ".pdf":
        try:
            text = _extract_pdf(raw)
            if not text.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PDF [{filename}] 未能提取到文本内容，可能是扫描件或加密文件。",
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

    # .txt / .md / .markdown — 依次尝试 UTF-8 / GBK
    for encoding in ("utf-8", "gbk"):
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"文件 [{filename}] 编码无法识别，请使用 UTF-8 或 GBK 编码保存后重新上传。",
    )


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

    # ── 2. 解码文本内容（非文本文件返回 None）───────────────────
    text_content = _decode_content(content, file.filename)

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
