from pymongo import MongoClient
from pymongo.database import Database
from app.core.config import settings

client: MongoClient = None
db: Database = None

def get_db() -> Database:
    global client, db
    if client is None:
        client = MongoClient(settings.MONGODB_URL)
        db = client[settings.MONGODB_DB_NAME]
    return db

def close_db():
    if client:
        client.close()
