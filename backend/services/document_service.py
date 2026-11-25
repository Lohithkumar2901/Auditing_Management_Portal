import os
from datetime import date
from database import db_cursor

UPLOAD_BASE = "/data/files/documents"

TYPE_FOLDER_MAP = {
    "POLICY": "policies",
    "PROCEDURE": "procedures",
    "SOP": "sop",
    "FORMAT": "formats",
    "TRAINING": "training",
}


def get_documents(doc_types=None, review_status=None, approval_status=None):
    with db_cursor() as (cursor, conn):
        conditions, params = [], []
        if doc_types:
            placeholders = ",".join(["%s"] * len(doc_types))
            conditions.append(f"document_type IN ({placeholders})")
            params.extend(doc_types)
        if review_status:
            conditions.append("review_status = %s")
            params.append(review_status)
        if approval_status:
            conditions.append("approval_status = %s")
            params.append(approval_status)
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cursor.execute(f"SELECT * FROM documents {where} ORDER BY created_at DESC", params)
        return cursor.fetchall()


def get_document_by_id(doc_id):
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT * FROM documents WHERE id = %s", (doc_id,))
        return cursor.fetchone()


def create_document(document_name, document_type, file_path, uploaded_by,
                    version_no="v1", remarks=None):
    today = date.today().isoformat()
    with db_cursor() as (cursor, conn):
        cursor.execute("""
            INSERT INTO documents
              (document_type, document_name, uploaded_date, status, file_path,
               uploaded_by, version_no, remarks,
               review_status, approval_status, visibility_status, submitted_date)
            VALUES (%s, %s, %s, 'Pending', %s, %s, %s, %s,
                    'Pending', 'Pending', 'Hidden', %s)
        """, (document_type, document_name, today, file_path,
              uploaded_by, version_no, remarks, today))
        return cursor.lastrowid


def update_document(doc_id, document_name=None, version_no=None, remarks=None):
    fields = {}
    if document_name is not None:
        fields["document_name"] = document_name
    if version_no is not None:
        fields["version_no"] = version_no
    if remarks is not None:
        fields["remarks"] = remarks
    if not fields:
        return False
    with db_cursor() as (cursor, conn):
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        cursor.execute(
            f"UPDATE documents SET {set_clause} WHERE id = %s",
            list(fields.values()) + [doc_id]
        )
        return cursor.rowcount > 0


def delete_document(doc_id):
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT * FROM documents WHERE id = %s", (doc_id,))
        doc = cursor.fetchone()
        if not doc:
            return None
        cursor.execute("DELETE FROM documents WHERE id = %s", (doc_id,))
        return doc


def submit_for_review(doc_id):
    with db_cursor() as (cursor, conn):
        cursor.execute("""
            UPDATE documents
               SET review_status = 'Pending',
                   approval_status = 'Pending',
                   visibility_status = 'Hidden',
                   submitted_date = %s
             WHERE id = %s
        """, (date.today().isoformat(), doc_id))
        return cursor.rowcount > 0


def review_document(doc_id, reviewer, remarks=None):
    with db_cursor() as (cursor, conn):
        cursor.execute("""
            UPDATE documents
               SET review_status = 'Reviewed',
                   reviewed_date = %s,
                   reviewed_by = %s
                   {remarks_clause}
             WHERE id = %s
        """.replace("{remarks_clause}", ", remarks = %s" if remarks else ""),
            ([date.today().isoformat(), reviewer, remarks, doc_id]
             if remarks else [date.today().isoformat(), reviewer, doc_id])
        )
        return cursor.rowcount > 0


def approve_document(doc_id, approver, remarks=None):
    with db_cursor() as (cursor, conn):
        cursor.execute("""
            UPDATE documents
               SET approval_status = 'Approved',
                   approval_date = %s,
                   visibility_status = 'Visible',
                   status = 'Approved',
                   approved_by = %s
                   {remarks_clause}
             WHERE id = %s
        """.replace("{remarks_clause}", ", remarks = %s" if remarks else ""),
            ([date.today().isoformat(), approver, remarks, doc_id]
             if remarks else [date.today().isoformat(), approver, doc_id])
        )
        return cursor.rowcount > 0


def reject_document(doc_id, remarks=None):
    with db_cursor() as (cursor, conn):
        cursor.execute("""
            UPDATE documents
               SET approval_status = 'Rejected',
                   review_status = 'Pending'
                   {remarks_clause}
             WHERE id = %s
        """.replace("{remarks_clause}", ", remarks = %s" if remarks else ""),
            ([remarks, doc_id] if remarks else [doc_id])
        )
        return cursor.rowcount > 0


def get_kpi_summary():
    with db_cursor() as (cursor, conn):
        cursor.execute("""
            SELECT
                COUNT(*)                                                          AS total,
                SUM(review_status = 'Pending')                                    AS pending_review,
                SUM(review_status = 'Reviewed')                                   AS reviewed,
                SUM(review_status = 'Reviewed' AND approval_status = 'Pending')   AS pending_approval,
                SUM(approval_status = 'Approved')                                 AS approved,
                SUM(approval_status = 'Rejected')                                 AS rejected
            FROM documents
        """)
        return cursor.fetchone()


def get_documents_by_kpi_filter(kpi_key):
    """Return documents matching a KPI filter key."""
    filter_map = {
        "total":            {},
        "pending_review":   {"review_status": "Pending"},
        "reviewed":         {"review_status": "Reviewed"},
        "pending_approval": {"review_status": "Reviewed", "approval_status": "Pending"},
        "approved":         {"approval_status": "Approved"},
        "rejected":         {"approval_status": "Rejected"},
    }
    filters = filter_map.get(kpi_key, {})
    with db_cursor() as (cursor, conn):
        conditions = [f"{k} = %s" for k in filters]
        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
        cursor.execute(
            f"SELECT * FROM documents {where} ORDER BY created_at DESC",
            list(filters.values())
        )
        return cursor.fetchall()


async def save_uploaded_file(file, document_type: str) -> str:
    folder = TYPE_FOLDER_MAP.get(document_type.upper(), "uploads")
    save_dir = os.path.join(UPLOAD_BASE, folder)
    os.makedirs(save_dir, exist_ok=True)
    safe_name = os.path.basename(file.filename)
    file_path = os.path.join(save_dir, safe_name)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    return file_path
