"""
AI analysis routes for Yukyu Pro Backend
"""
from fastapi import APIRouter
from typing import Dict, Any
import json
import os

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/analyze")
async def analyze_compliance(data: Dict[str, Any]):
    """Analyze employee compliance using Gemini AI"""
    if not GEMINI_API_KEY:
        return [{
            "title": "AI分析未設定",
            "description": "GEMINI_API_KEYがバックエンドで設定されていません。",
            "type": "info"
        }]
    
    employees = data.get("employees", [])
    if not employees:
        return []

    risk_employees = [
        e for e in employees
        if e.get("status") == "在職中"
        and e.get("grantedTotal", 0) >= 10
        and e.get("usedTotal", 0) < 5
    ]

    prompt = f"""
    日本の労働基準法（年5日有給休暇取得義務化）に基づき、以下のデータを分析してください。
    従業員総数: {len(employees)}
    法的リスク対象: {len(risk_employees)}名
    {chr(10).join([f"{e.get('name')}: {e.get('usedTotal')}日" for e in risk_employees[:10]])}
    
    3つのインサイト（法的コンプライアンス警告、具体的アクションプラン、ポジティブな予測）を日本語のJSON形式で返してください。
    """

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        return [{
            "title": "法的分析オフライン",
            "description": f"AIエラー: {str(e)}",
            "type": "warning"
        }]
