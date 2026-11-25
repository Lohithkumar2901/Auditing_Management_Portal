import json
from database import db_cursor

# Mirrors the alias table in checklist_service — kept here to avoid circular imports.
_CHECKLIST_ALIASES = {
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

def _resolve_cl_alias(name: str) -> str | None:
    low = name.lower()
    for key, alias in _CHECKLIST_ALIASES.items():
        if key in low:
            return alias
    return None


def get_tracker_columns(tracker_group: str):
    with db_cursor() as (cursor, _):
        cursor.execute(
            "SELECT * FROM tracker_columns WHERE tracker_group = %s ORDER BY col_order, id",
            (tracker_group,),
        )
        return cursor.fetchall()


def add_tracker_column(tracker_group: str, col_name: str):
    with db_cursor() as (cursor, conn):
        cursor.execute(
            "SELECT COALESCE(MAX(col_order), 0) + 1 AS nxt FROM tracker_columns WHERE tracker_group = %s",
            (tracker_group,),
        )
        nxt = cursor.fetchone()["nxt"]
        cursor.execute(
            "INSERT IGNORE INTO tracker_columns (tracker_group, col_name, col_order) VALUES (%s, %s, %s)",
            (tracker_group, col_name.strip(), nxt),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "message": "Column added"}


def delete_tracker_column(col_id: int):
    with db_cursor() as (cursor, conn):
        cursor.execute("DELETE FROM tracker_columns WHERE id = %s", (col_id,))
        conn.commit()
        return {"message": "Column deleted"}


def get_checklist_columns(checklist_group: str):
    with db_cursor() as (cursor, _):
        # 1. Exact match (columns stored under this service/group name)
        cursor.execute(
            "SELECT * FROM checklist_columns WHERE checklist_group = %s ORDER BY col_order, id",
            (checklist_group,),
        )
        rows = cursor.fetchall()
        if rows:
            return rows
        # 2. Alias fallback — e.g. "Active Directory (PDC)" → "AD Authentication Failover"
        alias = _resolve_cl_alias(checklist_group)
        if alias:
            cursor.execute(
                "SELECT * FROM checklist_columns WHERE checklist_group LIKE %s ORDER BY col_order, id",
                (f"%{alias}%",),
            )
            return cursor.fetchall()
        return []


def add_checklist_column(checklist_group: str, col_name: str):
    with db_cursor() as (cursor, conn):
        cursor.execute(
            "SELECT COALESCE(MAX(col_order), 0) + 1 AS nxt FROM checklist_columns WHERE checklist_group = %s",
            (checklist_group,),
        )
        nxt = cursor.fetchone()["nxt"]
        cursor.execute(
            "INSERT IGNORE INTO checklist_columns (checklist_group, col_name, col_order) VALUES (%s, %s, %s)",
            (checklist_group, col_name.strip(), nxt),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "message": "Column added"}


def delete_checklist_column(col_id: int):
    with db_cursor() as (cursor, conn):
        cursor.execute("DELETE FROM checklist_columns WHERE id = %s", (col_id,))
        conn.commit()
        return {"message": "Column deleted"}
