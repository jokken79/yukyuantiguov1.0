
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { Employee } from '../types';

interface ExcelSyncProps {
  onSyncComplete: () => void;
}

// Tipos de archivo Excel soportados
type FileType = 'daicho' | 'yukyu' | 'unknown';

// Configuración de sheets por tipo de archivo
const DAICHO_SHEETS = [
  { name: 'DBGenzaiX', category: '派遣社員', color: '#00e5ff' },
  { name: 'DBUkeoiX', category: '請負社員', color: '#ff6b6b' },
  { name: 'DBStaffX', category: 'スタッフ', color: '#ffd93d' }
];

const YUKYU_SHEETS = [
  { name: '作業者データ　有給', category: '派遣社員', color: '#00e5ff' },
  { name: '請負', category: '請負社員', color: '#ff6b6b' }
];

// Convertir número de fecha Excel a string ISO
const excelDateToISO = (excelDate: number | string): string | undefined => {
  if (!excelDate || excelDate === '' || excelDate === 0) return undefined;
  if (typeof excelDate === 'string') {
    // Si ya es string (como "2025/6/12半休"), extraer la fecha
    const match = excelDate.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
    if (match) return match[1];
    return excelDate;
  }
  // Convertir número Excel a fecha
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString().split('T')[0];
};

// Detectar tipo de archivo basado en sheets disponibles
const detectFileType = (sheetNames: string[]): FileType => {
  const hasDaichoSheets = DAICHO_SHEETS.some(s => sheetNames.includes(s.name));
  const hasYukyuSheets = YUKYU_SHEETS.some(s => sheetNames.includes(s.name));

  if (hasDaichoSheets) return 'daicho';
  if (hasYukyuSheets) return 'yukyu';
  return 'unknown';
};

// Helper para buscar valor en columnas con múltiples nombres posibles
const findValue = (row: any, keys: string[]): any => {
  const foundKey = Object.keys(row).find(k => keys.includes(k.trim()));
  return foundKey ? row[foundKey] : null;
};

// Normalizar estado (在職中/退社)
const normalizeStatus = (statusRaw: any): string => {
  if (!statusRaw) return '在職中';
  const statusStr = String(statusRaw).trim();
  if (statusStr === '退社' || statusStr.includes('退')) return '退社';
  if (statusStr === '在職中' || statusStr.includes('在職')) return '在職中';
  return statusStr || '在職中';
};

// Extraer fechas de yukyu de columnas R-BE (índices 17-56)
const extractYukyuDates = (row: any): string[] => {
  const dates: string[] = [];
  const keys = Object.keys(row);

  // Columnas numéricas 1, 2, 3... hasta 40 o más
  for (let i = 1; i <= 40; i++) {
    const colName = String(i);
    const colNameWithSpace = `${i} `; // Algunas columnas tienen espacio
    const value = row[colName] || row[colNameWithSpace];

    if (value) {
      const dateStr = excelDateToISO(value);
      if (dateStr) {
        dates.push(dateStr);
      }
    }
  }

  return dates;
};

// Procesar archivo DAICHO (社員台帳)
const processDaicho = (
  workbook: XLSX.WorkBook,
  existingEmployees: Employee[]
): { employees: Employee[]; stats: string[]; count: number } => {
  const sheetStats: string[] = [];
  let totalCount = 0;

  DAICHO_SHEETS.forEach(({ name: sheetName, category }) => {
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log(`[Daicho] Sheet "${sheetName}" not found, skipping...`);
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

    if (jsonData.length === 0) {
      console.log(`[Daicho] Sheet "${sheetName}" has no data, skipping...`);
      return;
    }

    let sheetCount = 0;

    jsonData.forEach((row: any) => {
      const id = String(findValue(row, ['社員№', '社員番号', '社員ID', 'ID', 'No', '№']));
      if (!id || id === 'undefined' || id === 'null' || id === '') return;

      const name = findValue(row, ['氏名', '名前', '従業員名', 'Name']);
      const nameKana = findValue(row, ['カナ', 'かな', 'Kana']);
      const client = findValue(row, ['派遣先', '請負業務', '事務所', '工場', '部署', '勤務地', 'Client', 'Factory']);
      const statusRaw = findValue(row, ['現在', '在職中', '状態', 'ステータス', 'Status']);

      const existingIdx = existingEmployees.findIndex(emp => emp.id === id);
      const status = normalizeStatus(statusRaw);

      if (existingIdx >= 0) {
        // Actualizar empleado existente (solo datos básicos del Daicho)
        const emp = existingEmployees[existingIdx];
        existingEmployees[existingIdx] = {
          ...emp,
          name: name ? String(name) : emp.name,
          nameKana: nameKana ? String(nameKana) : emp.nameKana,
          client: client ? String(client) : emp.client,
          category: category,
          status: status,
          lastSync: new Date().toISOString()
        };
      } else {
        // Crear nuevo empleado
        existingEmployees.push({
          id,
          name: name ? String(name) : '未設定',
          nameKana: nameKana ? String(nameKana) : undefined,
          client: client ? String(client) : '未設定',
          category: category,
          grantedTotal: 0,
          usedTotal: 0,
          balance: 0,
          expiredCount: 0,
          status: status,
          lastSync: new Date().toISOString()
        });
      }
      sheetCount++;
    });

    if (sheetCount > 0) {
      sheetStats.push(`${category}: ${sheetCount}`);
      totalCount += sheetCount;
    }
  });

  return { employees: existingEmployees, stats: sheetStats, count: totalCount };
};

// Procesar archivo YUKYU (有給休暇管理)
const processYukyu = (
  workbook: XLSX.WorkBook,
  existingEmployees: Employee[]
): { employees: Employee[]; stats: string[]; count: number } => {
  const sheetStats: string[] = [];
  let totalCount = 0;

  // Mapa temporal para agregar datos de múltiples filas por empleado
  const employeeYukyuMap: Map<string, {
    latestRow: any;
    latestMonths: number;
    allYukyuDates: string[];
    category: string;
  }> = new Map();

  YUKYU_SHEETS.forEach(({ name: sheetName, category }) => {
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log(`[Yukyu] Sheet "${sheetName}" not found, skipping...`);
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

    if (jsonData.length === 0) {
      console.log(`[Yukyu] Sheet "${sheetName}" has no data, skipping...`);
      return;
    }

    console.log(`[Yukyu] Processing sheet "${sheetName}" with ${jsonData.length} rows`);

    jsonData.forEach((row: any) => {
      const id = String(findValue(row, ['社員№', '社員番号', '社員ID', 'ID', 'No', '№']));
      if (!id || id === 'undefined' || id === 'null' || id === '') return;

      const elapsedMonths = Number(findValue(row, ['経過月', '経過月数'])) || 0;
      const yukyuDates = extractYukyuDates(row);

      const existing = employeeYukyuMap.get(id);

      if (!existing || elapsedMonths > existing.latestMonths) {
        // Primera fila o fila más reciente
        employeeYukyuMap.set(id, {
          latestRow: row,
          latestMonths: elapsedMonths,
          allYukyuDates: existing ? [...existing.allYukyuDates, ...yukyuDates] : yukyuDates,
          category
        });
      } else {
        // Agregar solo las fechas de yukyu
        existing.allYukyuDates.push(...yukyuDates);
      }
    });
  });

  // Procesar el mapa y actualizar empleados
  employeeYukyuMap.forEach(({ latestRow, allYukyuDates, category }, id) => {
    const row = latestRow;

    const name = findValue(row, ['氏名', '名前', '従業員名', 'Name']);
    const nameKana = findValue(row, ['カナ', 'かな', 'Kana']);
    const client = findValue(row, ['派遣先', '請負業務', '事務所', '工場', '部署', '勤務地', 'Client', 'Factory']);
    const statusRaw = findValue(row, ['在職中', '現在', '状態', 'ステータス', 'Status']);

    // Datos de Yukyu
    const entryDateRaw = findValue(row, ['入社日', '入社']);
    const elapsedTime = findValue(row, ['経過月数']);
    const elapsedMonths = Number(findValue(row, ['経過月'])) || 0;
    const yukyuStartDateRaw = findValue(row, ['有給発生', '有給発生日']);
    const grantedTotal = Number(findValue(row, ['付与数', '付与合計', '付与日数', '当期付与', 'Granted'])) || 0;
    const carryOver = Number(findValue(row, ['繰越'])) || 0;
    const totalAvailable = Number(findValue(row, ['保有数'])) || 0;
    const usedTotal = Number(findValue(row, ['消化日数', '消化合計', '使用日数', 'Used'])) || 0;
    const balance = Number(findValue(row, ['期末残高', '残日数', '有給残', 'Balance'])) || 0;
    const expiredCount = Number(findValue(row, ['時効数', '時効', '消滅日数', 'Expired'])) || 0;
    const remainingAfterExpiry = Number(findValue(row, ['時効後残'])) || 0;

    const status = normalizeStatus(statusRaw);
    const entryDate = excelDateToISO(entryDateRaw);
    const yukyuStartDate = excelDateToISO(yukyuStartDateRaw);

    // Filtrar fechas duplicadas y ordenar
    const uniqueYukyuDates = [...new Set(allYukyuDates)].sort();

    const existingIdx = existingEmployees.findIndex(emp => emp.id === id);

    if (existingIdx >= 0) {
      // Actualizar empleado existente con datos de Yukyu
      const emp = existingEmployees[existingIdx];
      existingEmployees[existingIdx] = {
        ...emp,
        name: name ? String(name) : emp.name,
        nameKana: nameKana ? String(nameKana) : emp.nameKana,
        client: client ? String(client) : emp.client,
        category: emp.category || category,
        entryDate: entryDate || emp.entryDate,
        elapsedTime: elapsedTime ? String(elapsedTime) : emp.elapsedTime,
        elapsedMonths: elapsedMonths || emp.elapsedMonths,
        yukyuStartDate: yukyuStartDate || emp.yukyuStartDate,
        grantedTotal: grantedTotal || emp.grantedTotal,
        carryOver: carryOver || emp.carryOver,
        totalAvailable: totalAvailable || emp.totalAvailable,
        usedTotal: usedTotal || emp.usedTotal,
        balance: balance || emp.balance,
        expiredCount: expiredCount || emp.expiredCount,
        remainingAfterExpiry: remainingAfterExpiry || emp.remainingAfterExpiry,
        yukyuDates: uniqueYukyuDates.length > 0 ? uniqueYukyuDates : emp.yukyuDates,
        status: status,
        lastSync: new Date().toISOString()
      };
    } else {
      // Crear nuevo empleado
      existingEmployees.push({
        id,
        name: name ? String(name) : '未設定',
        nameKana: nameKana ? String(nameKana) : undefined,
        client: client ? String(client) : '未設定',
        category: category,
        entryDate,
        elapsedTime: elapsedTime ? String(elapsedTime) : undefined,
        elapsedMonths,
        yukyuStartDate,
        grantedTotal,
        carryOver,
        totalAvailable,
        usedTotal,
        balance,
        expiredCount,
        remainingAfterExpiry,
        yukyuDates: uniqueYukyuDates.length > 0 ? uniqueYukyuDates : undefined,
        status: status,
        lastSync: new Date().toISOString()
      });
    }
    totalCount++;
  });

  const categories = new Set(Array.from(employeeYukyuMap.values()).map(v => v.category));
  categories.forEach(cat => {
    const count = Array.from(employeeYukyuMap.values()).filter(v => v.category === cat).length;
    if (count > 0) sheetStats.push(`${cat}: ${count}`);
  });

  return { employees: existingEmployees, stats: sheetStats, count: totalCount };
};

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

        console.log('[ExcelSync] Sheets found:', workbook.SheetNames);

        // Detectar tipo de archivo
        const fileType = detectFileType(workbook.SheetNames);
        console.log('[ExcelSync] Detected file type:', fileType);

        if (fileType === 'unknown') {
          alert('ファイル形式を認識できません。\n対応シート:\n- 社員台帳: DBGenzaiX, DBUkeoiX, DBStaffX\n- 有給管理: 作業者データ　有給, 請負');
          setLoading(false);
          return;
        }

        const currentAppData = db.loadData();
        let existingEmployees = [...currentAppData.employees];
        let result: { employees: Employee[]; stats: string[]; count: number };

        if (fileType === 'daicho') {
          result = processDaicho(workbook, existingEmployees);
        } else {
          result = processYukyu(workbook, existingEmployees);
        }

        // Guardar datos
        currentAppData.employees = result.employees;
        db.saveData(currentAppData);

        // Mostrar estadísticas
        const typeLabel = fileType === 'daicho' ? '社員台帳' : '有給休暇管理';
        const detectedType = result.stats.length > 0
          ? `${typeLabel} (${result.stats.join(', ')})`
          : "データなし";

        const typeColor = fileType === 'daicho'
          ? "text-green-500 border-green-500/30 bg-green-500/10"
          : "text-blue-500 border-blue-500/30 bg-blue-500/10";

        setStats({ count: result.count, type: detectedType, color: typeColor });
        onSyncComplete();

      } catch (err) {
        console.error('[ExcelSync] Error:', err);
        alert("エクセルの解析に失敗しました。ファイル形式を確認してください。");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="p-12 max-w-[1200px] mx-auto space-y-12 animate-fadeIn relative pb-32">
      <div className="absolute top-0 right-0 text-[18vw] font-black text-white/[0.01] select-none pointer-events-none italic tracking-tighter">同期</div>

      <header className="flex flex-col md:flex-row justify-between items-end gap-8 relative z-10 border-b border-white/5 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="h-14 w-2 bg-blue-500 shadow-[0_0_20px_#00e5ff] animate-pulse"></div>
            <h2 className="text-7xl font-black italic tracking-tighter aggressive-text">データ同期</h2>
          </div>
          <div className="flex items-center gap-4 text-white/30 font-black tracking-[0.4em] ml-8 text-sm">
             <span>エクセル対応</span>
             <span className="text-blue-500">●</span>
             <span>社員台帳 / 有給休暇管理</span>
          </div>
        </div>

        {stats && (
          <div className={`text-right px-8 py-4 border animate-fadeIn ${stats.color.split(' ')[1]}`}>
            <p className={`text-[10px] font-black tracking-[0.3em] mb-1 ${stats.color.split(' ')[0]}`}>検出: {stats.type}</p>
            <p className="text-2xl font-black italic">{stats.count} <span className="text-xs">件同期完了</span></p>
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
            <p className="text-2xl font-black italic tracking-tighter aggressive-text animate-pulse">データ解析中...</p>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="flex justify-center items-center gap-8 opacity-20 group-hover:opacity-100 transition-opacity">
               <div className="text-5xl font-black italic tracking-tighter">台帳</div>
               <div className="h-10 w-1 bg-white"></div>
               <div className="text-5xl font-black italic tracking-tighter text-blue-500">有給</div>
            </div>
            <div>
              <h3 className="text-4xl font-black italic tracking-tighter mb-4">ここにファイルをドラッグ</h3>
              <p className="text-white/30 font-bold tracking-widest text-xs">
                社員台帳・有給休暇管理の両方に対応。自動識別してデータを統合します
              </p>
            </div>
            <div className="pt-8">
              <button className="px-16 py-6 bg-white text-black font-black italic tracking-widest text-xs hover:scale-105 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                ファイルを選択
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-green-500/50 transition-colors">
          <div className="text-green-500 font-black text-xl italic tracking-tighter">01. 社員台帳</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            DBGenzaiX, DBUkeoiX, DBStaffXシートから社員の基本情報（氏名、派遣先、ステータス）を取り込みます
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-blue-500/50 transition-colors">
          <div className="text-blue-500 font-black text-xl italic tracking-tighter">02. 有給休暇管理</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            有給発生日、付与数、消化日数、期末残高、時効数、取得日一覧を完全に取り込みます
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-white/50 transition-colors">
          <div className="text-white font-black text-xl italic tracking-tighter">03. データ統合</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            社員番号を基にデータを自動統合。台帳と有給管理の両方をアップロードすると完全なデータが構築されます
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExcelSync;
