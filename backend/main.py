from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uvicorn
import sqlite3
import json
import os
import google.generativeai as genai
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Constants
DB_NAME = "yukyu.db"

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# --- Models ---
class PeriodHistory(BaseModel):
    periodIndex: int
    periodName: str
    elapsedMonths: int
    yukyuStartDate: str
    grantDate: str
    expiryDate: str
    granted: float
    used: float
    balance: float
    expired: float
    isExpired: bool
    isCurrentPeriod: bool
    yukyuDates: List[str] = []
    source: str
    syncedAt: str

class Employee(BaseModel):
    id: str
    employee_num: str = Field(alias="employeeNum")
    name: str
    haken: Optional[str] = None
    granted: float
    used: float
    balance: float
    usage_rate: float = Field(alias="usageRate")
    year: int
    # Extended fields
    periodHistory: Optional[List[PeriodHistory]] = None
    yukyuDates: Optional[List[str]] = None

class LeaveRecord(BaseModel):
    id: str
    employeeId: str
    date: str
    type: str
    duration: str
    note: Optional[str] = None
    status: str
    createdAt: str

# --- Database Setup ---
def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY,
            employee_num TEXT,
            name TEXT,
            haken TEXT,
            granted REAL,
            used REAL,
            balance REAL,
            usage_rate REAL,
            year INTEGER,
            period_history TEXT,
            yukyu_dates TEXT,
            last_updated TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS leave_records (
            id TEXT PRIMARY KEY,
            employee_id TEXT,
            date TEXT,
            type TEXT,
            duration TEXT,
            note TEXT,
            status TEXT,
            created_at TEXT
        )
    ''')
    conn.commit()
    conn.close()

# --- App Init ---
app = FastAPI(title="Yukyu Pro Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "backend": "FastAPI"}

# --- Employees Endpoints ---
@app.get("/api/employees", response_model=List[Employee])
async def get_employees():
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

@app.post("/api/employees")
async def sync_employees(employees: List[Employee]):
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

# --- Leave Records Endpoints ---
@app.get("/api/records", response_model=List[LeaveRecord])
async def get_records():
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM leave_records").fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/api/records")
async def save_record(record: LeaveRecord):
    conn = get_db_connection()
    c = conn.cursor()
    try:
        c.execute('''
            INSERT OR REPLACE INTO leave_records
            (id, employee_id, date, type, duration, note, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (record.id, record.employeeId, record.date, record.type, record.duration, record.note, record.status, record.createdAt))
        conn.commit()
        return {"status": "success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# --- AI Endpoints ---
@app.post("/api/analyze")
async def analyze_compliance(data: Dict[str, Any]):
    if not GEMINI_API_KEY:
        return [{"title": "AI分析未設定", "description": "GEMINI_API_KEYがバックエンドで設定されていません。", "type": "info"}]
    
    employees = data.get("employees", [])
    if not employees: return []

    risk_employees = [e for e in employees if e.get("status") == "在職中" and e.get("grantedTotal", 0) >= 10 and e.get("usedTotal", 0) < 5]

    prompt = f"""
    日本の労働基準法（年5日有給休暇取得義務化）に基づき、以下のデータを分析してください。
    従業員総数: {len(employees)}
    法的リスク対象: {len(risk_employees)}名
    {chr(10).join([f"{e.get('name')}: {e.get('usedTotal')}日" for e in risk_employees[:10]])}
    
    3つのインサイト（法的コンプライアンス警告、具体的アクションプラン、ポジティブな予測）を日本語のJSON形式で返してください。
    """

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        return json.loads(response.text)
    except Exception as e:
        return [{"title": "法的分析オフライン", "description": f"AIエラー: {str(e)}", "type": "warning"}]

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
