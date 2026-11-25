from fastapi import APIRouter, Depends
from auth import require_admin
from models.schemas import ApprovalAction
from services import tracker_service

router = APIRouter(prefix="/approval", tags=["Approval"])


@router.get("/pending")
def get_pending(current_user: dict = Depends(require_admin)):
    return tracker_service.get_pending_trackers()


@router.post("/action")
def take_action(data: ApprovalAction, current_user: dict = Depends(require_admin)):
    if data.action not in ("approve", "reject"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")
    return tracker_service.approve_tracker(
        data.tracker_id, data.action, current_user["username"], data.remarks
    )
