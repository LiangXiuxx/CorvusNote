from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson.objectid import ObjectId

class UserBase(BaseModel):
    username: str
    nickname: Optional[str] = ""
    is_admin: Optional[bool] = False
    is_guest: Optional[bool] = False
    avatar: Optional[str] = ""
    avatar_color: Optional[str] = ""
    status: Optional[str] = "active"

class UserCreate(BaseModel):
    username: str
    password: str
    avatar: Optional[str] = ""

class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    password: Optional[str] = None
    avatar: Optional[str] = None
    avatar_color: Optional[str] = None

class User(UserBase):
    id: str
    token_version: Optional[int] = 0
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None
    username: Optional[str] = None
