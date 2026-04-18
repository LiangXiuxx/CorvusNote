from pymongo.collection import Collection
from bson.objectid import ObjectId
from app.core.database import get_db

class ConversationModel:
    def __init__(self):
        self.db = get_db()
        self.collection: Collection = self.db["conversations"]
    
    def create(self, conversation_data: dict) -> dict:
        result = self.collection.insert_one(conversation_data)
        return self.collection.find_one({"_id": result.inserted_id})
    
    def get_by_id(self, conversation_id: str) -> dict:
        return self.collection.find_one({"_id": ObjectId(conversation_id)})
    
    def get_by_user_id(self, user_id: str, skip: int = 0, limit: int = 100) -> list:
        return list(
            self.collection.find({"user_id": ObjectId(user_id)})
            .sort("updated_at", -1)  # 最近更新的排在最前
            .skip(skip)
            .limit(limit)
        )
    
    def update(self, conversation_id: str, update_data: dict) -> dict:
        self.collection.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": update_data}
        )
        return self.get_by_id(conversation_id)
    
    def delete(self, conversation_id: str) -> bool:
        result = self.collection.delete_one({"_id": ObjectId(conversation_id)})
        return result.deleted_count > 0
