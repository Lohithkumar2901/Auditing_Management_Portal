from fastapi import APIRouter, Depends
from auth import get_current_user, require_admin
from models.schemas import DrillCreate, DrillUpdate
from services import drill_service

router = APIRouter(prefix="/drills", tags=["Drill Schedule"])


@router.get("/")
def list_drills(current_user: dict = Depends(get_current_user)):
    return drill_service.get_all_drills()


@router.post("/")
def create_drill(data: DrillCreate, current_user: dict = Depends(get_current_user)):
    return drill_service.create_drill(data.model_dump())


@router.get("/{drill_id}")
def get_drill(drill_id: int, current_user: dict = Depends(get_current_user)):
    return drill_service.get_drill_by_id(drill_id)


@router.put("/{drill_id}")
def update_drill(drill_id: int, data: DrillUpdate, current_user: dict = Depends(get_current_user)):
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return drill_service.update_drill(drill_id, payload)


@router.delete("/{drill_id}")
def delete_drill(drill_id: int, current_user: dict = Depends(get_current_user)):
    return drill_service.delete_drill(drill_id)
