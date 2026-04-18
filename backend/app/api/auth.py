from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta, datetime
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token
from app.models.user import UserModel
from app.schemas.user import UserCreate, User, Token

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

user_model = UserModel()

@router.post("/register", response_model=User)
async def register(user_data: UserCreate):
    # 检查用户名是否已存在
    existing_user = user_model.get_by_username(user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # 密码加密
    hashed_password = get_password_hash(user_data.password)
    
    # 创建用户：注册接口始终创建普通用户，忽略请求体中的 is_admin / is_guest 字段
    new_user = user_model.create({
        "username": user_data.username,
        "password_hash": hashed_password,
        "is_admin": False,
        "is_guest": False,
        "avatar": user_data.avatar or f"https://ui-avatars.com/api/?name={user_data.username}&background=random&color=fff",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    # 转换为响应模型
    return User(
        id=str(new_user["_id"]),
        username=new_user["username"],
        is_admin=new_user["is_admin"],
        is_guest=new_user.get("is_guest", False),
        avatar=new_user["avatar"],
        created_at=new_user["created_at"],
        updated_at=new_user["updated_at"]
    )

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # 查找用户
    user = user_model.get_by_username(form_data.username)
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["_id"]), "username": user["username"]},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = user_model.get_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user
