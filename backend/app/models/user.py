from pymongo.collection import Collection
from bson.objectid import ObjectId
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
