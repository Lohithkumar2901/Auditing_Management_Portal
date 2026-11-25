import calendar
from datetime import date, timedelta
from fastapi import HTTPException
from database import db_cursor

FREQ_PREFIX = {
    'daily':        'DMSD',
    'fortnight':    'DMSF',
    'monthly':      'DMSM',
    'quarterly':    'DMSQ',
    'half-yearly':  'DMSH',
    'yearly':       'DMSY',
}

def _freq_prefix(frequency: str) -> str:
    return FREQ_PREFIX.get((frequency or '').lower().strip(), 'DMSX')


def _next_code(cursor, prefix: str) -> str:
    cursor.execute(
        "SELECT drill_code FROM drill_schedule WHERE drill_code LIKE %s ORDER BY drill_code DESC LIMIT 1",
        (f"{prefix}%",),
    )
    row = cursor.fetchone()
    num = (int(row['drill_code'][4:]) + 1) if (row and row.get('drill_code')) else 1
    return f"{prefix}{num:03d}"


def _add_months(d: date, n: int) -> date:
    month = d.month + n
    year  = d.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _advance_date(d: date, freq: str) -> date:
    f = (freq or '').lower().strip()
    if f == 'daily':        return d + timedelta(days=1)
    if f == 'fortnight':    return d + timedelta(days=15)
    if f == 'monthly':      return _add_months(d, 1)
    if f == 'quarterly':    return _add_months(d, 3)
    if f == 'half-yearly':  return _add_months(d, 6)
    if f == 'yearly':       return _add_months(d, 12)
    return d


def _maybe_advance_review(cursor, conn, row: dict) -> dict:
    """Auto-advance review_date for Repeat drills whose date is in the past."""
    rd = row.get('review_date')
    if not rd or row.get('review_type') != 'Repeat' or not row.get('frequency'):
        return row
    if isinstance(rd, str):
        try:
            rd = date.fromisoformat(rd)
        except ValueError:
            return row
    today = date.today()
    if rd >= today:
        return row
    while rd < today:
        rd = _advance_date(rd, row['frequency'])
    cursor.execute("UPDATE drill_schedule SET review_date = %s WHERE id = %s", (rd, row['id']))
    conn.commit()
    row['review_date'] = rd.isoformat()
    return row


def get_all_drills():
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT * FROM drill_schedule ORDER BY id ASC")
        rows = cursor.fetchall()
        result = []
        for row in rows:
            # Ensure every row has a drill_code
            if not row.get('drill_code'):
                prefix = _freq_prefix(row.get('frequency', ''))
                code   = _next_code(cursor, prefix)
                cursor.execute("UPDATE drill_schedule SET drill_code = %s WHERE id = %s", (code, row['id']))
                conn.commit()
                row['drill_code'] = code
            row = _maybe_advance_review(cursor, conn, row)
            result.append(row)
        return result


def get_drill_by_id(drill_id: int):
    with db_cursor() as (cursor, _):
        cursor.execute("SELECT * FROM drill_schedule WHERE id = %s", (drill_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Drill not found")
        return row


def create_drill(data: dict):
    with db_cursor() as (cursor, conn):
        prefix = _freq_prefix(data.get('frequency', ''))
        code   = _next_code(cursor, prefix)
        cursor.execute(
            """INSERT INTO drill_schedule
               (drill_code, activity, policy, frequency, method, responsibility,
                evidence, review_type, review_date, start_date, end_date)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                code,
                data['activity'], data.get('policy'), data.get('frequency'),
                data.get('method'), data.get('responsibility'), data.get('evidence'),
                data.get('review_type', 'Repeat'),
                data.get('review_date') or None,
                data.get('start_date') or None,
                data.get('end_date')   or None,
            ),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "drill_code": code, "message": "Drill created"}


def update_drill(drill_id: int, data: dict):
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT id, frequency FROM drill_schedule WHERE id = %s", (drill_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Drill not found")

        # Regenerate code if frequency changed
        new_freq = data.get('frequency')
        if new_freq and new_freq != row.get('frequency'):
            prefix = _freq_prefix(new_freq)
            data['drill_code'] = _next_code(cursor, prefix)

        allowed = {'activity','policy','frequency','method','responsibility',
                   'evidence','review_type','review_date','start_date','end_date','drill_code'}
        fields  = {k: v for k, v in data.items() if k in allowed}
        if not fields:
            return {"message": "Nothing to update"}
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        cursor.execute(
            f"UPDATE drill_schedule SET {set_clause} WHERE id = %s",
            [*fields.values(), drill_id],
        )
        conn.commit()
        return {"message": "Drill updated"}


def delete_drill(drill_id: int):
    with db_cursor() as (cursor, conn):
        cursor.execute("SELECT id FROM drill_schedule WHERE id = %s", (drill_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Drill not found")
        cursor.execute("DELETE FROM drill_schedule WHERE id = %s", (drill_id,))
        conn.commit()
        return {"message": "Drill deleted"}
