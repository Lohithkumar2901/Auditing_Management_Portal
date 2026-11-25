import json
from fastapi import HTTPException
from database import db_cursor

# Maps substrings found in a service_name → the LIKE search term used against
# the checklist.checklist column.  Only these explicit entries cause a cross-
# reference; every other service_name uses strict exact matching so that new
# tracker entries never accidentally surface unrelated existing checklists.
SERVICE_CHECKLIST_ALIASES = {
    'active directory': 'AD Authentication Failover',
    'ad auth':          'AD Authentication Failover',
    'azure':            'Azure',
    'cppm':             'CPPM',
    'aruba':            'CPPM',
    'clearpass':        'CPPM',
    'design file':      'DESIGN FILE SERVER',
    'file server':      'DESIGN FILE SERVER',
    'firewall':         'Firewall',
    'l3 switch':        'L3 Switch',
    'core switch':      'L3 Switch',
    'network switch':   'L3 Switch',
    'mailvault':        'MAILVAULT',
    'mail archive':     'MAILVAULT',
    'sap access':       'SAP Access via DR Network',
    'webserver':        'WEBSERVER-SAPLOGON',
    'saplogon':         'WEBSERVER-SAPLOGON',
    'sap web':          'WEBSERVER-SAPLOGON',
}

_CHECKLIST_FILTER = "(step IS NOT NULL AND step != '' AND step != 'Step')"


def _resolve_alias(service_name: str) -> str | None:
    """Return the alias search term if service_name matches a known key, else None."""
    low = service_name.lower()
    for key, alias in SERVICE_CHECKLIST_ALIASES.items():
        if key in low:
            return alias
    return None


def _fetch_exact(cursor, term: str) -> list:
    """Strict equality lookup — never matches unrelated checklists."""
    cursor.execute(
        f"SELECT * FROM checklist WHERE checklist = %s AND {_CHECKLIST_FILTER} ORDER BY id ASC",
        (term,),
    )
    return _hydrate(cursor.fetchall())


def _fetch_like(cursor, term: str) -> list:
    """LIKE lookup — used only for known alias terms."""
    cursor.execute(
        f"SELECT * FROM checklist WHERE checklist LIKE %s AND {_CHECKLIST_FILTER} ORDER BY id ASC",
        (f"%{term}%",),
    )
    return _hydrate(cursor.fetchall())


def _hydrate(rows: list) -> list:
    for row in rows:
        if row.get("row_data") and isinstance(row["row_data"], str):
            try:
                row["row_data"] = json.loads(row["row_data"])
            except Exception:
                pass
    return rows


def get_checklist_by_service(service_name: str):
    with db_cursor() as (cursor, _):
        # 1. Exact match — items the user explicitly created for this service
        rows = _fetch_exact(cursor, service_name)
        if rows:
            return rows
        # 2. Known alias — only pre-defined service types link to existing checklists
        alias = _resolve_alias(service_name)
        if alias:
            return _fetch_like(cursor, alias)
        # 3. Unknown service — return empty; never fall back to generic LIKE
        return []


def checklist_exists_for_service(service_name: str) -> bool:
    with db_cursor() as (cursor, _):
        cursor.execute(
            f"SELECT COUNT(*) AS cnt FROM checklist WHERE checklist = %s AND {_CHECKLIST_FILTER}",
            (service_name,),
        )
        if cursor.fetchone()["cnt"] > 0:
            return True
        alias = _resolve_alias(service_name)
        if not alias:
            return False
        cursor.execute(
            f"SELECT COUNT(*) AS cnt FROM checklist WHERE checklist LIKE %s AND {_CHECKLIST_FILTER}",
            (f"%{alias}%",),
        )
        return cursor.fetchone()["cnt"] > 0


def get_all_checklist_groups():
    with db_cursor() as (cursor, _):
        cursor.execute(
            """
            SELECT DISTINCT checklist AS group_name, COUNT(*) AS total,
                   SUM(status = 'Completed') AS completed
            FROM checklist
            WHERE checklist IS NOT NULL AND checklist != '' AND checklist != 'checklist'
            GROUP BY checklist
            ORDER BY MIN(id) ASC
            """
        )
        return cursor.fetchall()


def create_checklist_item(data: dict):
    with db_cursor() as (cursor, conn):
        if data.get("row_data"):
            cursor.execute(
                "INSERT INTO checklist (checklist, row_data, status) VALUES (%s, %s, 'Pending')",
                (data["checklist"], json.dumps(data["row_data"])),
            )
        else:
            cursor.execute(
                """
                INSERT INTO checklist
                  (checklist, step, method, expected_result,
                   status, start_time, end_time, remarks)
                VALUES (%s,%s,%s,%s,'Pending',%s,%s,%s)
                """,
                (
                    data["checklist"], data.get("step"), data.get("method"),
                    data.get("expected_result"), data.get("start_time"),
                    data.get("end_time"), data.get("remarks"),
                ),
            )
        conn.commit()
        return {"id": cursor.lastrowid, "message": "Checklist item created"}


def update_checklist_item(item_id: int, data: dict):
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT id FROM checklist WHERE id = %s", (item_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Checklist item not found")

        if not data:
            return {"message": "Nothing to update"}

        if "row_data" in data and data["row_data"] is not None:
            cursor.execute(
                "UPDATE checklist SET row_data = %s WHERE id = %s",
                (json.dumps(data["row_data"]), item_id),
            )
        else:
            filtered = {k: v for k, v in data.items() if k != "row_data"}
            if not filtered:
                return {"message": "Nothing to update"}
            set_clause = ", ".join(f"{k} = %s" for k in filtered)
            values = list(filtered.values()) + [item_id]
            cursor.execute(f"UPDATE checklist SET {set_clause} WHERE id = %s", values)

        conn.commit()
        return {"message": "Checklist item updated"}


def delete_checklist_item(item_id: int):
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT id FROM checklist WHERE id = %s", (item_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Checklist item not found")
        cursor.execute("DELETE FROM checklist WHERE id = %s", (item_id,))
        conn.commit()
        return {"message": "Checklist item deleted"}


def upload_checklist_evidence(item_id: int, file_path: str):
    with db_cursor() as (cursor, conn):
        cursor.execute(
            "UPDATE checklist SET evidence = %s, status = 'Completed' WHERE id = %s",
            (file_path, item_id),
        )
        conn.commit()
        return {"message": "Evidence uploaded, status set to Completed"}
