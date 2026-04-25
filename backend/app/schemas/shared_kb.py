from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SharedKBCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    cover: Optional[str] = None
    category: str = "推荐"
    is_public: bool = False


class SharedKBUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None


class SharedKB(BaseModel):
    id: str
    name: str
    description: str
    cover: Optional[str]
    owner_id: str
    owner_name: str
    is_public: bool
    category: str
    member_count: int = 0
    file_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SharedKBListItem(BaseModel):
    id: str
    name: str
    description: str
    cover: Optional[str]
    owner_name: str
    category: str
    member_count: int
    file_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class SharedKBMember(BaseModel):
    id: str
    kb_id: str
    user_id: str
    role: str
    joined_at: datetime

    class Config:
        from_attributes = True


class SharedKBFile(BaseModel):
    id: str
    kb_id: str
    name: str
    file_size: int
    file_type: str
    uploader_id: str
    uploader_name: str
    indexed: bool = False
    uploaded_at: datetime

    class Config:
        from_attributes = True


class SharedKBFileContent(BaseModel):
    id: str
    name: str
    file_type: str
    content: str  # 提取后的纯文本（用于前端预览）