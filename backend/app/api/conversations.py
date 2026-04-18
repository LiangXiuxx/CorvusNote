from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List
from datetime import datetime
from bson.objectid import ObjectId
from app.api.auth import get_current_user
from app.models.conversation import ConversationModel
from app.models.message import MessageModel
from app.schemas.conversation import Conversation, ConversationCreate, ConversationUpdate

router = APIRouter(prefix="/api/conversations", tags=["conversations"])
conversation_model = ConversationModel()
message_model = MessageModel()

@router.post("", response_model=Conversation)
async def create_conversation(conversation_data: ConversationCreate, current_user: dict = Depends(get_current_user)):
    new_conversation = conversation_model.create({
        "user_id": ObjectId(current_user["_id"]),
        "title": conversation_data.title,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    return Conversation(
        id=str(new_conversation["_id"]),
        user_id=str(new_conversation["user_id"]),
        title=new_conversation["title"],
        created_at=new_conversation["created_at"],
        updated_at=new_conversation["updated_at"]
    )

@router.get("", response_model=List[Conversation])
async def get_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    conversations = conversation_model.get_by_user_id(str(current_user["_id"]), skip=skip, limit=limit)
    return [
        Conversation(
            id=str(conv["_id"]),
            user_id=str(conv["user_id"]),
            title=conv["title"],
            created_at=conv["created_at"],
            updated_at=conv["updated_at"]
        )
        for conv in conversations
    ]

@router.get("/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    conversation = conversation_model.get_by_id(conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if str(conversation["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return Conversation(
        id=str(conversation["_id"]),
        user_id=str(conversation["user_id"]),
        title=conversation["title"],
        created_at=conversation["created_at"],
        updated_at=conversation["updated_at"]
    )

@router.put("/{conversation_id}", response_model=Conversation)
async def update_conversation(conversation_id: str, conversation_data: ConversationUpdate, current_user: dict = Depends(get_current_user)):
    conversation = conversation_model.get_by_id(conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if str(conversation["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    update_data = {}
    if conversation_data.title:
        update_data["title"] = conversation_data.title
    
    update_data["updated_at"] = datetime.utcnow()
    
    updated_conversation = conversation_model.update(conversation_id, update_data)
    
    return Conversation(
        id=str(updated_conversation["_id"]),
        user_id=str(updated_conversation["user_id"]),
        title=updated_conversation["title"],
        created_at=updated_conversation["created_at"],
        updated_at=updated_conversation["updated_at"]
    )

@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    conversation = conversation_model.get_by_id(conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if str(conversation["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # 删除对话相关的消息
    message_model.delete_by_conversation_id(conversation_id)
    
    # 删除对话
    conversation_model.delete(conversation_id)
    
    return None
