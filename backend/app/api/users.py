from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime
from app.api.auth import get_current_user
from app.models.user import UserModel
from app.schemas.user import User, UserUpdate
from app.core.security import get_password_hash

router = APIRouter(prefix="/api/users", tags=["users"])
user_model = UserModel()

@router.get("/profile", response_model=User)
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    return User(
        id=str(current_user["_id"]),
        username=current_user["username"],
        is_admin=current_user["is_admin"],
        is_guest=current_user.get("is_guest", False),
        avatar=current_user["avatar"],
        created_at=current_user["created_at"],
        updated_at=current_user["updated_at"]
    )

@router.put("/profile", response_model=User)
async def update_user_profile(user_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if user_data.username:
        # 检查用户名是否已存在
        existing_user = user_model.get_by_username(user_data.username)
        if existing_user and str(existing_user["_id"]) != str(current_user["_id"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        update_data["username"] = user_data.username
    
    if user_data.password:
        update_data["password_hash"] = get_password_hash(user_data.password)
    
    if user_data.avatar:
        update_data["avatar"] = user_data.avatar
    
    update_data["updated_at"] = datetime.utcnow()
    
    updated_user = user_model.update(str(current_user["_id"]), update_data)
    
    return User(
        id=str(updated_user["_id"]),
        username=updated_user["username"],
        is_admin=updated_user["is_admin"],
        is_guest=updated_user.get("is_guest", False),
        avatar=updated_user["avatar"],
        created_at=updated_user["created_at"],
        updated_at=updated_user["updated_at"]
    )

@router.get("/admin", response_model=List[User])
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    users = user_model.get_all()
    return [
        User(
            id=str(user["_id"]),
            username=user["username"],
            is_admin=user["is_admin"],
            is_guest=user.get("is_guest", False),
            avatar=user["avatar"],
            created_at=user["created_at"],
            updated_at=user["updated_at"]
        )
        for user in users
    ]

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # 防止删除自己
    if str(current_user["_id"]) == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    user_model.delete(user_id)
    return None

@router.get("/test")
async def test():
    """临时测试端点，用于检查用户列表"""
    users = user_model.get_all()
    return {"users": [user["username"] for user in users]}
