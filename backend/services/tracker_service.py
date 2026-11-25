import json
from datetime import datetime
from fastapi import HTTPException
from database import db_cursor

_SKIP_VALUES = {"tracker", "", None}


def _is_real_row(row: dict) -> bool:
    return row.get("tracker") not in _SKIP_VALUES and row.get("service_name") not in _SKIP_VALUES


def get_tracker_groups():
    with db_cursor() as (cursor, _):
        cursor.execute(
            """
            SELECT
                tracker                                         AS group_name,
                COUNT(*)                                        AS total,
                SUM(status = 'Pending')                         AS pending,
                SUM(status = 'Completed')                       AS completed,
                SUM(COALESCE(status,'') NOT IN ('Pending','Completed')) AS in_progress
            FROM drill_tracker
            WHERE tracker IS NOT NULL
              AND tracker != ''
              AND tracker != 'tracker'
            GROUP BY tracker
            ORDER BY MIN(id) ASC
            """
        )
        return cursor.fetchall()


def get_tracker_by_group(group_name: str):
    with db_cursor() as (cursor, _):
        cursor.execute(
            """
            SELECT * FROM drill_tracker
            WHERE tracker = %s
              AND (service_name IS NULL
                   OR (service_name != '' AND service_name != 'VM / Service Name'))
            ORDER BY id ASC
            """,
            (group_name,),
        )
        rows = cursor.fetchall()
        for row in rows:
            if row.get("row_data") and isinstance(row["row_data"], str):
                try:
                    row["row_data"] = json.loads(row["row_data"])
                except Exception:
                    pass
        return rows


def create_tracker_entry(data: dict):
    with db_cursor() as (cursor, conn):
        if data.get("row_data"):
            cursor.execute(
                "INSERT INTO drill_tracker (tracker, row_data, status) VALUES (%s, %s, 'In Progress')",
                (data["tracker"], json.dumps(data["row_data"])),
            )
        else:
            cursor.execute(
                """
                INSERT INTO drill_tracker
                  (tracker, host_server, service_name, ip_address, backup_type,
                   responsible_person, planned_date, actual_date, activity,
                   status, remarks)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'In Progress',%s)
                """,
                (
                    data["tracker"], data.get("host_server"), data.get("service_name"),
                    data.get("ip_address"), data.get("backup_type"),
                    data.get("responsible_person"), data.get("planned_date"),
                    data.get("actual_date"), data.get("activity"), data.get("remarks"),
                ),
            )
        conn.commit()
        return {"id": cursor.lastrowid, "message": "Tracker entry created"}


def update_tracker_entry(tracker_id: int, data: dict):
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT id FROM drill_tracker WHERE id = %s", (tracker_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Tracker entry not found")

        if not data:
            return {"message": "Nothing to update"}

        if "row_data" in data and data["row_data"] is not None:
            cursor.execute(
                "UPDATE drill_tracker SET row_data = %s WHERE id = %s",
                (json.dumps(data["row_data"]), tracker_id),
            )
        else:
            filtered = {k: v for k, v in data.items() if k != "row_data" and v is not None}
            if not filtered:
                return {"message": "Nothing to update"}
            set_clause = ", ".join(f"{k} = %s" for k in filtered)
            values = list(filtered.values()) + [tracker_id]
            cursor.execute(f"UPDATE drill_tracker SET {set_clause} WHERE id = %s", values)

        conn.commit()
        return {"message": "Tracker entry updated"}


def delete_tracker_entry(tracker_id: int):
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT id FROM drill_tracker WHERE id = %s", (tracker_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Tracker entry not found")
        cursor.execute("DELETE FROM drill_tracker WHERE id = %s", (tracker_id,))
        conn.commit()
        return {"message": "Tracker entry deleted"}


def submit_tracker_group(group_name: str, submitted_by: str):
    with db_cursor() as (cursor, conn):
        cursor.execute(
            """
            SELECT COUNT(*) AS cnt FROM drill_tracker
            WHERE tracker = %s
              AND COALESCE(status,'') NOT IN ('Pending','Completed')
              AND service_name IS NOT NULL AND service_name != ''
              AND service_name != 'VM / Service Name'
            """,
            (group_name,),
        )
        if cursor.fetchone()["cnt"] == 0:
            cursor.execute(
                """
                SELECT COUNT(*) AS cnt FROM drill_tracker
                WHERE tracker = %s
                  AND COALESCE(status,'') NOT IN ('Pending','Completed')
                  AND row_data IS NOT NULL
                """,
                (group_name,),
            )
            if cursor.fetchone()["cnt"] == 0:
                raise HTTPException(status_code=400, detail="No In-Progress entries to submit")
        cursor.execute(
            """
            UPDATE drill_tracker
            SET status = 'Pending'
            WHERE tracker = %s
              AND COALESCE(status,'') NOT IN ('Pending','Completed')
            """,
            (group_name,),
        )
        conn.commit()
        return {"message": f"{cursor.rowcount} entries submitted for approval"}


def update_tracker_evidence(tracker_id: int, file_path: str):
    with db_cursor() as (cursor, conn):
        cursor.execute(
            "UPDATE drill_tracker SET evidence = %s, status = 'Pending' WHERE id = %s",
            (file_path, tracker_id),
        )
        conn.commit()
        return {"message": "Evidence uploaded — entry submitted for approval"}


def get_pending_trackers():
    with db_cursor() as (cursor, _):
        cursor.execute(
            "SELECT * FROM drill_tracker WHERE status = 'Pending' ORDER BY id ASC"
        )
        rows = cursor.fetchall()
        for row in rows:
            if row.get("row_data") and isinstance(row["row_data"], str):
                try:
                    row["row_data"] = json.loads(row["row_data"])
                except Exception:
                    pass
        return rows


def approve_tracker(tracker_id: int, action: str, approved_by: str, remarks: str = None):
    with db_cursor() as (cursor, conn):
        cursor.execute(
            "SELECT id, status FROM drill_tracker WHERE id = %s", (tracker_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Tracker entry not found")
        if row["status"] != "Pending":
            raise HTTPException(
                status_code=400, detail="Only Pending entries can be approved/rejected"
            )
        new_status = "Completed" if action == "approve" else "In Progress"
        note = f"| {action.title()}d by {approved_by}"
        if remarks:
            note += f": {remarks}"
        cursor.execute(
            "UPDATE drill_tracker SET status = %s, remarks = CONCAT(COALESCE(remarks,''), %s) WHERE id = %s",
            (new_status, note, tracker_id),
        )
        conn.commit()
        return {"message": f"Entry {action}d successfully"}
