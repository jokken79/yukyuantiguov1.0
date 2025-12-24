
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { Employee } from '../types';

interface ExcelSyncProps {
  onSyncComplete: () => void;
}

const ExcelSync: React.FC<ExcelSyncProps> = ({ onSyncComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ count: number; type: string; color: string } | null>(null);

  const processFile = (file: File) => {
    setLoading(true);
    setStats(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const firstSheet = workbook.Sheets[firstSheetName];

        // 1. まず配列として読み込み、ヘッダー行を探す
        const rawRows = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
        let headerRowIndex = 0;
        const targetKeywords = ['社員', '氏名', 'Employee', 'Name', 'ID', 'No', '№', '名前', '派遣先'];

        for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
          const row = rawRows[i];
          if (!Array.isArray(row)) continue;
          
          const matchCount = row.filter((cell: any) => 
            cell && typeof cell === 'string' && targetKeywords.some(kw => cell.includes(kw))
          ).length;

          if (matchCount >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        // 2. 特定したヘッダー行からデータを再取得
        const jsonData = XLSX.utils.sheet_to_json<any>(firstSheet, { range: headerRowIndex });

        const currentAppData = db.loadData();
        const existingEmployees = [...currentAppData.employees];
        let updateCount = 0;
        
        // ヘッダーの特徴から自動判別
        let hasLeaveData = false;
        if (jsonData.length > 0) {
          const firstRowKeys = Object.keys(jsonData[0]).map(k => k.trim());
          hasLeaveData = firstRowKeys.some(k => 
            ['付与', '消化', '残日数', '有給', 'Granted', 'Used', 'Balance'].some(keyword => k.includes(keyword))
          );
        }

        const detectedType = hasLeaveData ? "有給休暇管理データ" : "社員台帳（マスター）";
        const typeColor = hasLeaveData ? "text-blue-500 border-blue-500/30 bg-blue-500/10" : "text-yellow-500 border-yellow-500/30 bg-yellow-500/10";

        jsonData.forEach((row: any) => {
          const findVal = (keys: string[]) => {
            const foundKey = Object.keys(row).find(k => keys.includes(k.trim()));
            return foundKey ? row[foundKey] : null;
          };

          const id = String(findVal(['社員№', '社員番号', '社員ID', 'ID', 'No', '№']));
          if (!id || id === 'undefined' || id === 'null') return;

          const existingIdx = existingEmployees.findIndex(e => e.id === id);
          
          const name = findVal(['氏名', '名前', '従業員名', 'Name']);
          const client = findVal(['派遣先', '工場', '部署', '勤務地', 'Client', 'Factory']);
          const grantedTotal = findVal(['付与数', '付与合計', '付与日数', '当期付与', 'Granted']);
          const usedTotal = findVal(['消化日数', '消化合計', '使用日数', 'Used']);
          const balance = findVal(['期末残高', '残日数', '有給残', 'Balance']);
          const expiredCount = findVal(['時効数', '時効', '消滅日数', 'Expired']);
          const status = findVal(['在職中', '状態', 'ステータス', 'Status']);

          if (existingIdx >= 0) {
            const emp = existingEmployees[existingIdx];
            existingEmployees[existingIdx] = {
              ...emp,
              name: name ? String(name) : emp.name,
              client: client ? String(client) : emp.client,
              grantedTotal: grantedTotal !== null ? Number(grantedTotal) : emp.grantedTotal,
              usedTotal: usedTotal !== null ? Number(usedTotal) : emp.usedTotal,
              balance: balance !== null ? Number(balance) : emp.balance,
              expiredCount: expiredCount !== null ? Number(expiredCount) : emp.expiredCount,
              status: status ? String(status) : emp.status,
              lastSync: new Date().toISOString()
            };
          } else {
            existingEmployees.push({
              id,
              name: name ? String(name) : '未設定',
              client: client ? String(client) : '未設定',
              grantedTotal: Number(grantedTotal || 0),
              usedTotal: Number(usedTotal || 0),
              balance: Number(balance || 0),
              expiredCount: Number(expiredCount || 0),
              status: status ? String(status) : '在職中',
              lastSync: new Date().toISOString()
            });
          }
          updateCount++;
        });

        currentAppData.employees = existingEmployees;
        db.saveData(currentAppData);

        setStats({ count: updateCount, type: detectedType, color: typeColor });
        onSyncComplete();
      } catch (err) {
        console.error(err);
        alert("エクセルの解析に失敗しました。ファイル形式を確認してください。");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-12 max-w-[1200px] mx-auto space-y-12 animate-fadeIn relative pb-32">
      <div className="absolute top-0 right-0 text-[18vw] font-black text-white/[0.01] select-none pointer-events-none italic tracking-tighter uppercase">SYNC</div>

      <header className="flex flex-col md:flex-row justify-between items-end gap-8 relative z-10 border-b border-white/5 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="h-14 w-2 bg-blue-500 shadow-[0_0_20px_#00e5ff] animate-pulse"></div>
            <h2 className="text-7xl font-black italic tracking-tighter aggressive-text">UNIVERSAL SYNC</h2>
          </div>
          <div className="flex items-center gap-4 text-white/30 font-black tracking-[0.4em] ml-8 uppercase text-sm">
             <span>Cross-Extension Support</span>
             <span className="text-blue-500">●</span>
             <span>.xlsx / .xlsm / .xls</span>
          </div>
        </div>
        
        {stats && (
          <div className={`text-right px-8 py-4 border animate-fadeIn ${stats.color.split(' ')[1]}`}>
            <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${stats.color.split(' ')[0]}`}>DETECTED: {stats.type}</p>
            <p className="text-2xl font-black italic">{stats.count} <span className="text-xs">ENTRIES SYNCED</span></p>
          </div>
        )}
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); }}
        className={`relative border-2 border-dashed p-24 text-center transition-all duration-700 ${
          isDragging ? 'border-blue-500 bg-blue-500/5 scale-[1.01]' : 'border-white/5 hover:border-white/10 bg-[#0a0a0a]'
        }`}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroEnabled.12"
          className="absolute inset-0 opacity-0 cursor-pointer z-20"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); }}
        />
        
        {loading ? (
          <div className="flex flex-col items-center py-10 space-y-8">
            <div className="w-24 h-24 border-t-4 border-blue-500 rounded-full animate-spin"></div>
            <p className="text-2xl font-black italic tracking-tighter aggressive-text animate-pulse">SMART_DETECT RUNNING...</p>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="flex justify-center items-center gap-8 opacity-20 group-hover:opacity-100 transition-opacity">
               <div className="text-7xl font-black italic tracking-tighter">XLSX</div>
               <div className="h-10 w-1 bg-white"></div>
               <div className="text-7xl font-black italic tracking-tighter text-blue-500">XLSM</div>
               <div className="h-10 w-1 bg-white"></div>
               <div className="text-7xl font-black italic tracking-tighter">XLS</div>
            </div>
            <div>
              <h3 className="text-4xl font-black italic tracking-tighter mb-4 uppercase">Drag any workbook here</h3>
              <p className="text-white/30 font-bold uppercase tracking-widest text-xs">
                AIが自動的に「台帳」か「管理表」かを判別し、データベースを構築します
              </p>
            </div>
            <div className="pt-8">
              <button className="px-16 py-6 bg-white text-black font-black italic tracking-widest text-xs hover:scale-105 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                SELECT_SOURCE_FILE
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-blue-500/50 transition-colors">
          <div className="text-blue-500 font-black text-xl italic tracking-tighter">01. SMART_IDENTIFY</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            ファイルの中身を瞬時に解析。有給の計算式が含まれていれば「管理データ」、名簿のみであれば「台帳」として最適に振り分けます。
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-red-600/50 transition-colors">
          <div className="text-red-600 font-black text-xl italic tracking-tighter">02. MASTER_MERGE</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            異なるファイルからでも「社員番号」を基にパズルのようにデータを結合。情報の断片化を防ぎます。
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-white/50 transition-colors">
          <div className="text-white font-black text-xl italic tracking-tighter">03. LEGACY_READY</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            マクロ入りのXLSMや古いXLSにも完全対応。工場の現場で10年以上使われているファイルもそのまま活用可能です。
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExcelSync;
