from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class NoteBase(BaseModel):
    title: str
    content: str

class NoteCreate(NoteBase):
    pass

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    images: Optional[Dict[str, str]] = None  # {imgId: base64DataUrl}

class Note(NoteBase):
    id: str
    user_id: str
    images: Dict[str, str] = {}
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
