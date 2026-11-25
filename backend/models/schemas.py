from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str
    full_name: str


# ── Tracker ──────────────────────────────────────────────────────────────────

class TrackerCreate(BaseModel):
    tracker: str
    row_data: Optional[dict] = None
    host_server: Optional[str] = None
    service_name: Optional[str] = None
    ip_address: Optional[str] = None
    backup_type: Optional[str] = None
    responsible_person: Optional[str] = None
    planned_date: Optional[str] = None
    actual_date: Optional[str] = None
    activity: Optional[str] = None
    remarks: Optional[str] = None


class TrackerUpdate(BaseModel):
    row_data: Optional[dict] = None
    host_server: Optional[str] = None
    service_name: Optional[str] = None
    ip_address: Optional[str] = None
    backup_type: Optional[str] = None
    responsible_person: Optional[str] = None
    planned_date: Optional[str] = None
    actual_date: Optional[str] = None
    activity: Optional[str] = None
    remarks: Optional[str] = None


class SubmitRequest(BaseModel):
    group_name: str


# ── Checklist ────────────────────────────────────────────────────────────────

class ChecklistCreate(BaseModel):
    checklist: str
    row_data: Optional[dict] = None
    step: Optional[str] = None
    method: Optional[str] = None
    expected_result: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    remarks: Optional[str] = None


class ChecklistUpdate(BaseModel):
    row_data: Optional[dict] = None
    step: Optional[str] = None
    method: Optional[str] = None
    expected_result: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    remarks: Optional[str] = None


# ── Drill Schedule ───────────────────────────────────────────────────────────

class DrillCreate(BaseModel):
    activity: str
    policy: Optional[str] = None
    frequency: Optional[str] = None
    method: Optional[str] = None
    responsibility: Optional[str] = None
    evidence: Optional[str] = None
    review_type: Optional[str] = 'Repeat'
    review_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class DrillUpdate(BaseModel):
    activity: Optional[str] = None
    policy: Optional[str] = None
    frequency: Optional[str] = None
    method: Optional[str] = None
    responsibility: Optional[str] = None
    evidence: Optional[str] = None
    review_type: Optional[str] = None
    review_date: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


# ── Approval ─────────────────────────────────────────────────────────────────

class ApprovalAction(BaseModel):
    tracker_id: int
    action: str
    remarks: Optional[str] = None


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentUpdate(BaseModel):
    document_name: Optional[str] = None
    version_no: Optional[str] = None
    remarks: Optional[str] = None


class DocumentReviewAction(BaseModel):
    remarks: Optional[str] = None


class DocumentApprovalAction(BaseModel):
    action: str  # 'approve' or 'reject'
    remarks: Optional[str] = None
