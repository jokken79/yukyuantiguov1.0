"""
Employee routes for Yukyu Pro Backend
"""
from fastapi import APIRouter, HTTPException
from typing import List
from datetime import datetime
import json

from ..models import Employee
from ..config.db import get_db_connection

router = APIRouter(prefix="/api", tags=["employees"])


@router.get("/employees", response_model=List[Employee])
async def get_employees():
    """Get all employees from database"""
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM employees").fetchall()
    conn.close()
    
    result = []
    for row in rows:
        emp = dict(row)
        period_history = json.loads(emp['period_history']) if emp['period_history'] else []
        yukyu_dates = json.loads(emp['yukyu_dates']) if emp['yukyu_dates'] else []
        result.append({
            "id": emp["id"],
            "employeeNum": emp["employee_num"],
            "name": emp["name"],
            "haken": emp["haken"],
            "granted": emp["granted"],
            "used": emp["used"],
            "balance": emp["balance"],
            "usageRate": emp["usage_rate"],
            "year": emp["year"],
            "periodHistory": period_history,
            "yukyuDates": yukyu_dates
        })
    return result


@router.post("/employees")
async def sync_employees(employees: List[Employee]):
    """Sync employees to database"""
    conn = get_db_connection()
    c = conn.cursor()
    timestamp = datetime.now().isoformat()
    
    try:
        for emp in employees:
            ph_json = json.dumps([p.dict() for p in emp.periodHistory]) if emp.periodHistory else None
            yd_json = json.dumps(emp.yukyuDates) if emp.yukyuDates else None
            c.execute('''
                INSERT OR REPLACE INTO employees
                (id, employee_num, name, haken, granted, used, balance, usage_rate, year, period_history, yukyu_dates, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                emp.id, emp.employee_num, emp.name, emp.haken,
                emp.granted, emp.used, emp.balance, emp.usage_rate,
                emp.year, ph_json, yd_json, timestamp
            ))
        conn.commit()
        return {"status": "success", "count": len(employees)}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
