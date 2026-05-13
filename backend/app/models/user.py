from pymongo.collection import Collection
from bson.objectid import ObjectId
from datetime import datetime
from app.core.database import get_db

class UserModel:
    def __init__(self):
        self.db = get_db()
        self.collection: Collection = self.db["users"]

    def create(self, user_data: dict) -> dict:
        result = self.collection.insert_one(user_data)
        return self.collection.find_one({"_id": result.inserted_id})

    def get_by_username(self, username: str) -> dict:
        return self.collection.find_one({"username": username})

    def get_by_id(self, user_id: str) -> dict:
        return self.collection.find_one({"_id": ObjectId(user_id)})

    def update(self, user_id: str, update_data: dict) -> dict:
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        return self.get_by_id(user_id)

    def delete(self, user_id: str) -> bool:
        result = self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0

    def get_all(self) -> list:
        return list(self.collection.find())

    def increment_token_version(self, user_id: str) -> int:
        """token_version 自增 +1，使该用户的所有旧 JWT 失效。返回新的 token_version。"""
        result = self.collection.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$inc": {"token_version": 1}},
            return_document=True
        )
        if result:
            return result.get("token_version", 1)
        return 1

    def update_last_login(self, user_id: str) -> None:
        """更新最后登录时间"""
        self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login_at": datetime.utcnow()}}
        )
