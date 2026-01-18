"""
Leave record routes for Yukyu Pro Backend
"""
from fastapi import APIRouter, HTTPException
from typing import List

from ..models import LeaveRecord
from ..config.db import get_db_connection

router = APIRouter(prefix="/api", tags=["records"])


@router.get("/records", response_model=List[LeaveRecord])
async def get_records():
    """Get all leave records from database"""
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM leave_records").fetchall()
    conn.close()
    return [dict(row) for row in rows]


@router.post("/records")
async def save_record(record: LeaveRecord):
    """Save a leave record to database"""
    conn = get_db_connection()
    c = conn.cursor()
    
    try:
        c.execute('''
            INSERT OR REPLACE INTO leave_records
            (id, employee_id, date, type, duration, note, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            record.id, record.employeeId, record.date, record.type,
            record.duration, record.note, record.status, record.createdAt
        ))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
