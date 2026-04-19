from pymongo.collection import Collection
from bson.objectid import ObjectId
from app.core.database import get_db
from datetime import datetime


class SharedKnowledgeBaseModel:
    def __init__(self):
        self.db = get_db()
        self.collection: Collection = self.db["shared_knowledge_bases"]

    def create(self, kb_data: dict) -> dict:
        result = self.collection.insert_one(kb_data)
        return self.collection.find_one({"_id": result.inserted_id})

    def get_by_id(self, kb_id: str) -> dict:
        return self.collection.find_one({"_id": ObjectId(kb_id)})

    def get_by_owner(self, owner_id: str, skip: int = 0, limit: int = 100) -> list:
        return list(
            self.collection.find({"owner_id": ObjectId(owner_id)})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )

    def get_public(self, category: str = None, search: str = None, skip: int = 0, limit: int = 20) -> list:
        query = {"is_public": True}
        if category and category != "推荐":
            query["category"] = category
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]

        return list(
            self.collection.find(query)
            .sort("member_count", -1)
            .skip(skip)
            .limit(limit)
        )

    def get_by_ids(self, kb_ids: list) -> list:
        return list(
            self.collection.find({"_id": {"$in": [ObjectId(kid) for kid in kb_ids]}})
        )

    def count_public(self, category: str = None) -> int:
        query = {"is_public": True}
        if category and category != "推荐":
            query["category"] = category
        return self.collection.count_documents(query)

    def update(self, kb_id: str, update_data: dict) -> dict:
        update_data["updated_at"] = datetime.utcnow()
        self.collection.update_one(
            {"_id": ObjectId(kb_id)},
            {"$set": update_data}
        )
        return self.get_by_id(kb_id)

    def increment_member_count(self, kb_id: str, delta: int = 1) -> None:
        self.collection.update_one(
            {"_id": ObjectId(kb_id)},
            {"$inc": {"member_count": delta}}
        )

    def increment_file_count(self, kb_id: str, delta: int = 1) -> None:
        self.collection.update_one(
            {"_id": ObjectId(kb_id)},
            {"$inc": {"file_count": delta}}
        )

    def delete(self, kb_id: str) -> bool:
        result = self.collection.delete_one({"_id": ObjectId(kb_id)})
        return result.deleted_count > 0

    def count_by_owner_public(self, owner_id: str) -> int:
        return self.collection.count_documents({
            "owner_id": ObjectId(owner_id),
            "is_public": True
        })


class SharedKBMemberModel:
    def __init__(self):
        self.db = get_db()
        self.collection: Collection = self.db["shared_kb_members"]

    def add_member(self, kb_id: str, user_id: str, role: str = "member") -> dict:
        member_data = {
            "kb_id": ObjectId(kb_id),
            "user_id": ObjectId(user_id),
            "role": role,
            "joined_at": datetime.utcnow()
        }
        result = self.collection.insert_one(member_data)
        return self.collection.find_one({"_id": result.inserted_id})

    def get_member(self, kb_id: str, user_id: str) -> dict:
        return self.collection.find_one({
            "kb_id": ObjectId(kb_id),
            "user_id": ObjectId(user_id)
        })

    def get_members(self, kb_id: str) -> list:
        return list(self.collection.find({"kb_id": ObjectId(kb_id)}))

    def get_user_kbs(self, user_id: str) -> list:
        return list(self.collection.find({"user_id": ObjectId(user_id)}))

    def is_member(self, kb_id: str, user_id: str) -> bool:
        return self.collection.find_one({
            "kb_id": ObjectId(kb_id),
            "user_id": ObjectId(user_id)
        }) is not None

    def remove_member(self, kb_id: str, user_id: str) -> bool:
        result = self.collection.delete_one({
            "kb_id": ObjectId(kb_id),
            "user_id": ObjectId(user_id)
        })
        return result.deleted_count > 0

    def get_member_count(self, kb_id: str) -> int:
        return self.collection.count_documents({"kb_id": ObjectId(kb_id)})
