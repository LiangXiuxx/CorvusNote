from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RAGStrategyConfig(BaseModel):
    """RAG 策略配置（上传时由前端传入，或由后端自动推断）"""
    chunk_size: int = 500
    chunk_overlap: int = 50
    top_k: int = 4
    score_threshold: float = 1.0
    enable_rewrite: bool = True
    enable_rerank: bool = True


class KnowledgeBaseBase(BaseModel):
    name: str


class KnowledgeBaseCreate(KnowledgeBaseBase):
    file_path: str
    file_size: int
    file_type: str


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None


class KnowledgeBase(KnowledgeBaseBase):
    id: str
    user_id: str
    file_path: str
    file_size: int
    file_type: str
    indexed: bool = False          # 是否已完成向量索引，前端据此判断 RAG 可用性
    strategy: Optional[RAGStrategyConfig] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
