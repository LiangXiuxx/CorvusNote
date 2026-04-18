from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List
from datetime import datetime
from bson.objectid import ObjectId
from app.api.auth import get_current_user
from app.models.note import NoteModel
from app.schemas.note import Note, NoteCreate, NoteUpdate

router = APIRouter(prefix="/api/notes", tags=["notes"])
note_model = NoteModel()

@router.post("", response_model=Note)
async def create_note(note_data: NoteCreate, current_user: dict = Depends(get_current_user)):
    new_note = note_model.create({
        "user_id": ObjectId(current_user["_id"]),
        "title": note_data.title,
        "content": note_data.content,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    })
    
    return Note(
        id=str(new_note["_id"]),
        user_id=str(new_note["user_id"]),
        title=new_note["title"],
        content=new_note["content"],
        created_at=new_note["created_at"],
        updated_at=new_note["updated_at"]
    )

@router.get("", response_model=List[Note])
async def get_notes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    notes = note_model.get_by_user_id(str(current_user["_id"]), skip=skip, limit=limit)
    return [
        Note(
            id=str(note["_id"]),
            user_id=str(note["user_id"]),
            title=note["title"],
            content=note["content"],
            created_at=note["created_at"],
            updated_at=note["updated_at"]
        )
        for note in notes
    ]

@router.get("/{note_id}", response_model=Note)
async def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    note = note_model.get_by_id(note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    if str(note["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return Note(
        id=str(note["_id"]),
        user_id=str(note["user_id"]),
        title=note["title"],
        content=note["content"],
        created_at=note["created_at"],
        updated_at=note["updated_at"]
    )

@router.put("/{note_id}", response_model=Note)
async def update_note(note_id: str, note_data: NoteUpdate, current_user: dict = Depends(get_current_user)):
    note = note_model.get_by_id(note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    if str(note["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    update_data = {}
    if note_data.title is not None:
        update_data["title"] = note_data.title
    if note_data.content is not None:
        update_data["content"] = note_data.content
    update_data["updated_at"] = datetime.utcnow()
    
    updated_note = note_model.update(note_id, update_data)
    
    return Note(
        id=str(updated_note["_id"]),
        user_id=str(updated_note["user_id"]),
        title=updated_note["title"],
        content=updated_note["content"],
        created_at=updated_note["created_at"],
        updated_at=updated_note["updated_at"]
    )

@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    note = note_model.get_by_id(note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    if str(note["user_id"]) != str(current_user["_id"]) and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    note_model.delete(note_id)
    return None
