from pydantic_settings import BaseSettings
from pydantic import field_validator

# 已知不安全的默认 SECRET_KEY 值，出现任何一个都拒绝启动
_DANGEROUS_KEYS = {
    "your-secret-key-here", "", "secret", "change-me",
    "changeme", "mysecret", "supersecret",
}


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "CorvusNote"
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 天
    UPLOAD_DIR: str = "./uploads"
    VECTOR_STORE_DIR: str = "./vector_stores"
    DASHSCOPE_API_KEY: str = ""

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if v in _DANGEROUS_KEYS or len(v) < 32:
            raise ValueError(
                "\n\n[安全错误] SECRET_KEY 不安全，服务器拒绝启动。\n"
                "请在 backend/.env 中设置一个强随机密钥（≥32字符），例如：\n"
                "  python -c \"import secrets; print(secrets.token_hex(32))\"\n"
            )
        return v

    class Config:
        env_file = ".env"

settings = Settings()
