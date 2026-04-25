"""
文件解析工具：MIME 签名校验 + PDF/DOCX/文本提取。
供 knowledge_bases.py 和 shared_kb.py 共用，消除重复代码。
"""
import io
import os
from fastapi import HTTPException, status

INDEXABLE_EXTENSIONS = {".txt", ".md", ".markdown", ".pdf", ".docx"}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


def validate_file_mime(raw: bytes, filename: str) -> None:
    """
    校验文件魔数是否与扩展名一致，防止 MIME 欺骗攻击。
    仅对 PDF（%PDF）和 DOCX（ZIP PK 头）做严格检验；
    文本文件通过编码解析隐式验证。
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        if not raw[:4] == b"%PDF":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件 [{filename}] 扩展名为 .pdf，但内容不是合法的 PDF 格式，请检查文件是否损坏或被篡改。",
            )
    elif ext == ".docx":
        # DOCX 是 ZIP 格式，ZIP 魔数为 PK\x03\x04 / PK\x05\x06 / PK\x07\x08
        if raw[:2] != b"PK":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"文件 [{filename}] 扩展名为 .docx，但内容不是合法的 DOCX 格式，请检查文件是否损坏或被篡改。",
            )


def extract_pdf(raw: bytes) -> str:
    """从 PDF 字节提取纯文本（pypdf）。"""
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(raw))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p for p in pages if p.strip())


def extract_docx(raw: bytes) -> str:
    """从 DOCX 字节提取纯文本（python-docx）。"""
    from docx import Document
    doc = Document(io.BytesIO(raw))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def decode_file_content(raw: bytes, filename: str) -> str | None:
    """
    将文件字节解码为字符串，附带 MIME 签名校验。

    返回值：
      - str：解码后的纯文本内容
      - None：文件类型不在 INDEXABLE_EXTENSIONS 中，无需索引

    异常：
      - HTTPException(400)：文件签名不匹配、解析失败、编码无法识别
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext not in INDEXABLE_EXTENSIONS:
        return None

    validate_file_mime(raw, filename)

    if ext == ".pdf":
        try:
            text = extract_pdf(raw)
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
            return extract_docx(raw)
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
