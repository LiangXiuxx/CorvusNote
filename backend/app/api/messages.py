from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List
from datetime import datetime
from bson.objectid import ObjectId
from app.api.auth import get_current_user
from app.models.conversation import ConversationModel
from app.models.message import MessageModel
from app.schemas.message import Message, MessageCreate

router = APIRouter(prefix="/api/messages", tags=["messages"])
conversation_model = ConversationModel()
message_model = MessageModel()

@router.post("/conversation/{conversation_id}", response_model=Message)
async def create_message(conversation_id: str, message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    # 检查对话是否存在且属于当前用户
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
    
    new_message = message_model.create({
        "conversation_id": ObjectId(conversation_id),
        "role": message_data.role,
        "content": message_data.content,
        "file": message_data.file,
        "mounted_knowledge_bases": message_data.mounted_knowledge_bases,
        "created_at": datetime.utcnow()
    })
    
    # 更新对话的updated_at时间
    conversation_model.update(conversation_id, {"updated_at": datetime.utcnow()})
    
    return Message(
        id=str(new_message["_id"]),
        conversation_id=str(new_message["conversation_id"]),
        role=new_message["role"],
        content=new_message["content"],
        file=new_message.get("file"),
        mounted_knowledge_bases=new_message.get("mounted_knowledge_bases", []),
        created_at=new_message["created_at"]
    )

@router.get("/conversation/{conversation_id}", response_model=List[Message])
async def get_messages(
    conversation_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    current_user: dict = Depends(get_current_user),
):
    # 检查对话是否存在且属于当前用户
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

    messages = message_model.get_by_conversation_id(conversation_id, skip=skip, limit=limit)
    return [
        Message(
            id=str(msg["_id"]),
            conversation_id=str(msg["conversation_id"]),
            role=msg["role"],
            content=msg["content"],
            file=msg.get("file"),
            mounted_knowledge_bases=msg.get("mounted_knowledge_bases", []),
            created_at=msg["created_at"]
        )
        for msg in messages
    ]
