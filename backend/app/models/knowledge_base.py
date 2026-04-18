from pymongo.collection import Collection
from bson.objectid import ObjectId
from app.core.database import get_db

class KnowledgeBaseModel:
    def __init__(self):
        self.db = get_db()
        self.collection: Collection = self.db["knowledge_bases"]
    
    def create(self, kb_data: dict) -> dict:
        result = self.collection.insert_one(kb_data)
        return self.collection.find_one({"_id": result.inserted_id})
    
    def get_by_id(self, kb_id: str) -> dict:
        return self.collection.find_one({"_id": ObjectId(kb_id)})
    
    def get_by_user_id(self, user_id: str, skip: int = 0, limit: int = 100) -> list:
        return list(
            self.collection.find({"user_id": ObjectId(user_id)})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
    
    def update(self, kb_id: str, update_data: dict) -> dict:
        self.collection.update_one(
            {"_id": ObjectId(kb_id)},
            {"$set": update_data}
        )
        return self.get_by_id(kb_id)
    
    def delete(self, kb_id: str) -> bool:
        result = self.collection.delete_one({"_id": ObjectId(kb_id)})
        return result.deleted_count > 0
