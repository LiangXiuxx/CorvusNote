from pymongo.collection import Collection
from bson.objectid import ObjectId
from app.core.database import get_db

class MessageModel:
    def __init__(self):
        self.db = get_db()
        self.collection: Collection = self.db["messages"]
    
    def create(self, message_data: dict) -> dict:
        result = self.collection.insert_one(message_data)
        return self.collection.find_one({"_id": result.inserted_id})
    
    def get_by_conversation_id(
        self, conversation_id: str, skip: int = 0, limit: int = 200
    ) -> list:
        return list(
            self.collection.find({"conversation_id": ObjectId(conversation_id)})
            .sort("created_at", 1)   # 按时间升序，保证消息顺序正确
            .skip(skip)
            .limit(limit)
        )
    
    def delete_by_conversation_id(self, conversation_id: str) -> bool:
        result = self.collection.delete_many({"conversation_id": ObjectId(conversation_id)})
        return result.deleted_count > 0
