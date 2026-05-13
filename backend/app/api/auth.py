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


def _extract_color_from_avatar(avatar_url: str) -> str:
    """从 avatar URL 中提取背景色，默认 #1677ff"""
    import re
    m = re.search(r'background=([0-9a-fA-F]{6})', avatar_url)
    return f"#{m.group(1)}" if m else "#1677ff"


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

    # 默认头像
    avatar = user_data.avatar or (
        f"https://ui-avatars.com/api/?name={user_data.username}"
        f"&background=random&color=fff"
    )
    avatar_color = _extract_color_from_avatar(avatar)

    # 创建用户：注册接口始终创建普通用户
    new_user = user_model.create({
        "username": user_data.username,
        "nickname": user_data.username,       # 默认昵称=用户名
        "password_hash": hashed_password,
        "is_admin": False,
        "is_guest": False,
        "avatar": avatar,
        "avatar_color": avatar_color,
        "status": "active",
        "token_version": 1,                   # 初始版本号
        "last_login_at": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })

    return User(
        id=str(new_user["_id"]),
        username=new_user["username"],
        nickname=new_user.get("nickname", ""),
        is_admin=new_user["is_admin"],
        is_guest=new_user.get("is_guest", False),
        avatar=new_user["avatar"],
        avatar_color=new_user.get("avatar_color", ""),
        status=new_user.get("status", "active"),
        token_version=new_user.get("token_version", 1),
        last_login_at=None,
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

    # 检查账号状态
    if user.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # 更新最后登录时间
    user_model.update_last_login(str(user["_id"]))

    # 创建访问令牌（嵌入 token_version 用于后续验证）
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": str(user["_id"]),
            "token_version": user.get("token_version", 1)
        },
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
    token_version_in_token: int = payload.get("token_version", 0)
    if user_id is None:
        raise credentials_exception

    user = user_model.get_by_id(user_id)
    if user is None:
        raise credentials_exception

    # token_version 验证：
    # - 如果 token 中有 token_version 字段，则必须与 DB 一致（防止旧 token 在改密码后仍有效）
    # - 如果 token 中没有 token_version（旧系统签发的 token），则跳过验证（向后兼容）
    if token_version_in_token > 0:
        db_token_version = user.get("token_version", 0)
        if db_token_version != token_version_in_token:
            raise credentials_exception

    # 检查账号状态
    if user.get("status", "active") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    return user