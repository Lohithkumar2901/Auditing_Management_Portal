import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from dotenv import load_dotenv

from auth import get_current_user
from models.schemas import TrackerCreate, TrackerUpdate, SubmitRequest
from services import tracker_service

load_dotenv()
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

router = APIRouter(prefix="/tracker", tags=["Tracker"])


@router.get("/groups")
def list_groups(current_user: dict = Depends(get_current_user)):
    return tracker_service.get_tracker_groups()


@router.get("/entries")
def list_entries(group_name: str, current_user: dict = Depends(get_current_user)):
    return tracker_service.get_tracker_by_group(group_name)


@router.post("/entries")
def create_entry(data: TrackerCreate, current_user: dict = Depends(get_current_user)):
    return tracker_service.create_tracker_entry(data.model_dump())


@router.put("/entries/{tracker_id}")
def update_entry(
    tracker_id: int,
    data: TrackerUpdate,
    current_user: dict = Depends(get_current_user),
):
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return tracker_service.update_tracker_entry(tracker_id, payload)


@router.delete("/entries/{tracker_id}")
def delete_entry(tracker_id: int, current_user: dict = Depends(get_current_user)):
    return tracker_service.delete_tracker_entry(tracker_id)


@router.post("/submit")
def submit_group(body: SubmitRequest, current_user: dict = Depends(get_current_user)):
    return tracker_service.submit_tracker_group(body.group_name, current_user["username"])


@router.post("/upload-evidence/{tracker_id}")
async def upload_tracker_evidence(
    tracker_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1]
    filename = f"tracker_{tracker_id}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    return tracker_service.update_tracker_evidence(tracker_id, file_path)
