import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, UploadFile, File
from dotenv import load_dotenv

from auth import get_current_user
from models.schemas import ChecklistCreate, ChecklistUpdate
from services import checklist_service

load_dotenv()
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

router = APIRouter(prefix="/checklist", tags=["Checklist"])


@router.get("/groups")
def list_groups(current_user: dict = Depends(get_current_user)):
    return checklist_service.get_all_checklist_groups()


@router.get("/items")
def list_items(service_name: str, current_user: dict = Depends(get_current_user)):
    return checklist_service.get_checklist_by_service(service_name)


@router.get("/exists")
def check_exists(service_name: str, current_user: dict = Depends(get_current_user)):
    exists = checklist_service.checklist_exists_for_service(service_name)
    return {"exists": exists}


@router.post("/items")
def create_item(data: ChecklistCreate, current_user: dict = Depends(get_current_user)):
    return checklist_service.create_checklist_item(data.model_dump())


@router.put("/items/{item_id}")
def update_item(
    item_id: int,
    data: ChecklistUpdate,
    current_user: dict = Depends(get_current_user),
):
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return checklist_service.update_checklist_item(item_id, payload)


@router.delete("/items/{item_id}")
def delete_item(item_id: int, current_user: dict = Depends(get_current_user)):
    return checklist_service.delete_checklist_item(item_id)


@router.post("/upload-evidence/{item_id}")
async def upload_evidence(
    item_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1]
    filename = f"checklist_{item_id}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    return checklist_service.upload_checklist_evidence(item_id, file_path)
