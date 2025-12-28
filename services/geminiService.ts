
import { GoogleGenAI, Type } from "@google/genai";
import { AppData, AIInsight } from "../types";

// Lazy initialization to avoid crash when API key is not set
let ai: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI | null => {
  if (ai) return ai;
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  ai = new GoogleGenAI({ apiKey });
  return ai;
};

export const analyzeLeaveData = async (data: AppData): Promise<AIInsight[]> => {
  if (data.employees.length === 0) return [];

  const aiClient = getAI();
  if (!aiClient) {
    return [{
      title: "AI分析未設定",
      description: "GEMINI_API_KEYが設定されていません。Vercel環境変数を確認してください。",
      type: "info"
    }];
  }

  const riskEmployees = data.employees.filter(e => e.status === '在職中' && e.grantedTotal >= 10 && e.usedTotal < 5);

  const prompt = `
    日本の労働基準法（年5日有給休暇取得義務化）に基づき、以下のデータを分析してください。
    
    【データ概要】
    従業員総数: ${data.employees.length}
    法的リスク対象（10日以上付与かつ5日未消化）: ${riskEmployees.length}名
    
    【リスク対象者詳細】
    ${riskEmployees.slice(0, 10).map(e => `${e.name}: 消化済み${e.usedTotal}日 (残り${5 - e.usedTotal}日必要)`).join('\n')}

    以下の3つのインサイトを日本語で生成してください。
    1. 【法的コンプライアンス警告】: 5日未達の人数に基づいた緊急性の分析。
    2. 【具体的アクションプラン】: どの派遣先や誰を優先的に休ませるべきかのアドバイス。
    3. 【ポジティブな予測】: 全員達成した場合の組織への影響。
    
    レスポンスは必ず日本語のJSON形式で返してください。
  `;

  try {
    const response = await aiClient.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['warning', 'info', 'success'] }
            },
            required: ["title", "description", "type"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return [{
      title: "法的分析オフライン",
      description: "AIアドバイザーに接続できません。手動でリスク対象者を確認してください。",
      type: "warning"
    }];
  }
};
