from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from bson.objectid import ObjectId

class UserBase(BaseModel):
    username: str
    is_admin: Optional[bool] = False
    is_guest: Optional[bool] = False
    avatar: Optional[str] = ""

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    avatar: Optional[str] = None

class User(UserBase):
    id: str
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
