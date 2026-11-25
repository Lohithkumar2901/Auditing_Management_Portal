from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, Header
from fastapi.responses import FileResponse, HTMLResponse
from typing import Optional, List
import os
from jose import jwt, JWTError

from auth import get_current_user, require_admin, require_reviewer_or_admin, SECRET_KEY, ALGORITHM
from services import document_service
from services import doc_preview_service

MIME_MAP = {
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

def _verify_any_token(authorization: Optional[str], token: Optional[str]):
    """Accept JWT from Authorization header OR ?token= query param."""
    raw = None
    if authorization and authorization.startswith("Bearer "):
        raw = authorization[7:]
    elif token:
        raw = token
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(raw, SECRET_KEY, algorithms=[ALGORITHM])
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/kpi")
def get_kpi(current_user: dict = Depends(get_current_user)):
    return document_service.get_kpi_summary()


@router.get("/kpi/{kpi_key}")
def get_kpi_detail(kpi_key: str, current_user: dict = Depends(get_current_user)):
    return document_service.get_documents_by_kpi_filter(kpi_key)


@router.get("/")
def list_documents(
    doc_type: Optional[str] = Query(None),
    review_status: Optional[str] = Query(None),
    approval_status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    types = None
    if doc_type:
        upper = doc_type.upper()
        # Procedures page also shows SOPs
        types = ["PROCEDURE", "SOP"] if upper == "PROCEDURE" else [upper]
    return document_service.get_documents(types, review_status, approval_status)


@router.get("/{doc_id}/view")
def view_document_file(
    doc_id: int,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    _verify_any_token(authorization, token)

    doc = document_service.get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    path = doc.get("file_path", "")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    ext = os.path.splitext(path)[1].lower()
    filename = os.path.basename(path)

    if ext == ".pdf":
        return FileResponse(
            path,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
    elif ext == ".docx":
        html = doc_preview_service.docx_to_html(path)
        return HTMLResponse(content=html)
    elif ext == ".xlsx":
        html = doc_preview_service.xlsx_to_html(path)
        return HTMLResponse(content=html)
    elif ext == ".pptx":
        html = doc_preview_service.pptx_to_html(path)
        return HTMLResponse(content=html)
    else:
        return FileResponse(
            path,
            media_type=MIME_MAP.get(ext, "application/octet-stream"),
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )


@router.get("/{doc_id}")
def get_document(doc_id: int, current_user: dict = Depends(get_current_user)):
    doc = document_service.get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/")
async def create_document(
    document_name: str = Form(...),
    document_type: str = Form(...),
    version_no: str = Form("v1"),
    remarks: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    file_path = ""
    if file and file.filename:
        file_path = await document_service.save_uploaded_file(file, document_type)
    doc_id = document_service.create_document(
        document_name=document_name,
        document_type=document_type.upper(),
        file_path=file_path,
        uploaded_by=current_user["username"],
        version_no=version_no,
        remarks=remarks,
    )
    return {"id": doc_id, "message": "Document created successfully"}


@router.put("/{doc_id}")
def update_document(
    doc_id: int,
    document_name: Optional[str] = Form(None),
    version_no: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    success = document_service.update_document(doc_id, document_name, version_no, remarks)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or no changes made")
    return {"message": "Document updated successfully"}


@router.delete("/{doc_id}")
def delete_document(doc_id: int, current_user: dict = Depends(get_current_user)):
    doc = document_service.delete_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": "Document deleted successfully"}


@router.post("/{doc_id}/submit")
def submit_for_review(doc_id: int, current_user: dict = Depends(get_current_user)):
    document_service.submit_for_review(doc_id)
    return {"message": "Document submitted for review"}


@router.post("/{doc_id}/review")
def review_document(
    doc_id: int,
    remarks: Optional[str] = Form(None),
    current_user: dict = Depends(require_reviewer_or_admin),
):
    document_service.review_document(doc_id, current_user["username"], remarks)
    return {"message": "Document marked as reviewed"}


@router.post("/{doc_id}/approve")
def approve_document(
    doc_id: int,
    remarks: Optional[str] = Form(None),
    current_user: dict = Depends(require_admin),
):
    document_service.approve_document(doc_id, current_user["username"], remarks)
    return {"message": "Document approved and published"}


@router.post("/{doc_id}/reject")
def reject_document(
    doc_id: int,
    remarks: Optional[str] = Form(None),
    current_user: dict = Depends(require_admin),
):
    document_service.reject_document(doc_id, remarks)
    return {"message": "Document rejected"}
