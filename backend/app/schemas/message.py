from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class MessageBase(BaseModel):
    content: str
    role: str

class MessageCreate(MessageBase):
    file: Optional[Dict[str, Any]] = None
    mounted_knowledge_bases: Optional[List[str]] = []

class Message(MessageBase):
    id: str
    conversation_id: str
    file: Optional[Dict[str, Any]] = None
    mounted_knowledge_bases: Optional[List[str]] = []
    created_at: datetime

    class Config:
        from_attributes = True
