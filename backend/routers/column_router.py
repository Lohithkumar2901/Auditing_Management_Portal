from fastapi import APIRouter, Depends
from auth import get_current_user
from services.column_service import (
    get_tracker_columns, add_tracker_column, delete_tracker_column,
    get_checklist_columns, add_checklist_column, delete_checklist_column,
)

router = APIRouter(prefix="/columns", tags=["Columns"])


@router.get("/tracker")
def list_tracker_cols(group: str, current_user: dict = Depends(get_current_user)):
    return get_tracker_columns(group)


@router.post("/tracker")
def create_tracker_col(body: dict, current_user: dict = Depends(get_current_user)):
    return add_tracker_column(body["tracker_group"], body["col_name"])


@router.delete("/tracker/{col_id}")
def remove_tracker_col(col_id: int, current_user: dict = Depends(get_current_user)):
    return delete_tracker_column(col_id)


@router.get("/checklist")
def list_checklist_cols(group: str, current_user: dict = Depends(get_current_user)):
    return get_checklist_columns(group)


@router.post("/checklist")
def create_checklist_col(body: dict, current_user: dict = Depends(get_current_user)):
    return add_checklist_column(body["checklist_group"], body["col_name"])


@router.delete("/checklist/{col_id}")
def remove_checklist_col(col_id: int, current_user: dict = Depends(get_current_user)):
    return delete_checklist_column(col_id)
