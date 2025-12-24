
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../services/db';
import { Employee } from '../types';

interface ExcelSyncProps {
  onSyncComplete: () => void;
}

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

// Estado de sincronización guardado en localStorage
interface SyncStatus {
  daicho: { synced: boolean; count: number; lastSync: string | null };
  yukyu: { synced: boolean; count: number; lastSync: string | null };
}

const SYNC_STATUS_KEY = 'yukyu_sync_status';

const loadSyncStatus = (): SyncStatus => {
  try {
    const saved = localStorage.getItem(SYNC_STATUS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    daicho: { synced: false, count: 0, lastSync: null },
    yukyu: { synced: false, count: 0, lastSync: null }
  };
};

const saveSyncStatus = (status: SyncStatus) => {
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
};

// Convertir número de fecha Excel a string ISO
const excelDateToISO = (excelDate: number | string): string | undefined => {
  if (!excelDate || excelDate === '' || excelDate === 0) return undefined;
  if (typeof excelDate === 'string') {
    const match = excelDate.match(/(\d{4}\/\d{1,2}\/\d{1,2})/);
    if (match) return match[1];
    return excelDate;
  }
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  if (isNaN(date.getTime())) return undefined;
  return date.toISOString().split('T')[0];
};

// Helper para buscar valor en columnas
const findValue = (row: any, keys: string[]): any => {
  const foundKey = Object.keys(row).find(k => keys.includes(k.trim()));
  return foundKey ? row[foundKey] : null;
};

// Normalizar estado
const normalizeStatus = (statusRaw: any): string => {
  if (!statusRaw) return '在職中';
  const statusStr = String(statusRaw).trim();
  if (statusStr === '退社' || statusStr.includes('退')) return '退社';
  if (statusStr === '在職中' || statusStr.includes('在職')) return '在職中';
  return statusStr || '在職中';
};

// Extraer fechas de yukyu
const extractYukyuDates = (row: any): string[] => {
  const dates: string[] = [];
  for (let i = 1; i <= 40; i++) {
    const colName = String(i);
    const colNameWithSpace = `${i} `;
    const value = row[colName] || row[colNameWithSpace];
    if (value) {
      const dateStr = excelDateToISO(value);
      if (dateStr) dates.push(dateStr);
    }
  }
  return dates;
};

// Procesar DAICHO
const processDaicho = (workbook: XLSX.WorkBook, existingEmployees: Employee[]): { employees: Employee[]; count: number } => {
  let totalCount = 0;

  DAICHO_SHEETS.forEach(({ name: sheetName, category }) => {
    if (!workbook.SheetNames.includes(sheetName)) return;

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet);
    if (jsonData.length === 0) return;

    jsonData.forEach((row: any) => {
      const id = String(findValue(row, ['社員№', '社員番号', '社員ID', 'ID', 'No', '№']));
      if (!id || id === 'undefined' || id === 'null' || id === '') return;

      const name = findValue(row, ['氏名', '名前', '従業員名', 'Name']);
      const nameKana = findValue(row, ['カナ', 'かな', 'Kana']);
      const client = findValue(row, ['派遣先', '請負業務', '事務所', '工場', '部署', '勤務地']);
      const statusRaw = findValue(row, ['現在', '在職中', '状態', 'ステータス', 'Status']);
      const status = normalizeStatus(statusRaw);

      const existingIdx = existingEmployees.findIndex(emp => emp.id === id);

      if (existingIdx >= 0) {
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
      totalCount++;
    });
  });

  return { employees: existingEmployees, count: totalCount };
};

// Procesar YUKYU
const processYukyu = (workbook: XLSX.WorkBook, existingEmployees: Employee[]): { employees: Employee[]; count: number } => {
  let totalCount = 0;

  const employeeYukyuMap: Map<string, {
    latestRow: any;
    latestMonths: number;
    allYukyuDates: string[];
    category: string;
  }> = new Map();

  YUKYU_SHEETS.forEach(({ name: sheetName, category }) => {
    if (!workbook.SheetNames.includes(sheetName)) return;

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet);
    if (jsonData.length === 0) return;

    jsonData.forEach((row: any) => {
      const id = String(findValue(row, ['社員№', '社員番号', '社員ID', 'ID', 'No', '№']));
      if (!id || id === 'undefined' || id === 'null' || id === '') return;

      const elapsedMonths = Number(findValue(row, ['経過月', '経過月数'])) || 0;
      const yukyuDates = extractYukyuDates(row);
      const existing = employeeYukyuMap.get(id);

      if (!existing || elapsedMonths > existing.latestMonths) {
        employeeYukyuMap.set(id, {
          latestRow: row,
          latestMonths: elapsedMonths,
          allYukyuDates: existing ? [...existing.allYukyuDates, ...yukyuDates] : yukyuDates,
          category
        });
      } else {
        existing.allYukyuDates.push(...yukyuDates);
      }
    });
  });

  employeeYukyuMap.forEach(({ latestRow, allYukyuDates, category }, id) => {
    const row = latestRow;
    const name = findValue(row, ['氏名', '名前', '従業員名', 'Name']);
    const nameKana = findValue(row, ['カナ', 'かな', 'Kana']);
    const client = findValue(row, ['派遣先', '請負業務', '事務所', '工場', '部署', '勤務地']);
    const statusRaw = findValue(row, ['在職中', '現在', '状態', 'ステータス', 'Status']);

    const entryDateRaw = findValue(row, ['入社日', '入社']);
    const elapsedTime = findValue(row, ['経過月数']);
    const elapsedMonths = Number(findValue(row, ['経過月'])) || 0;
    const yukyuStartDateRaw = findValue(row, ['有給発生', '有給発生日']);
    const grantedTotal = Number(findValue(row, ['付与数', '付与合計', '付与日数', '当期付与'])) || 0;
    const carryOver = Number(findValue(row, ['繰越'])) || 0;
    const totalAvailable = Number(findValue(row, ['保有数'])) || 0;
    const usedTotal = Number(findValue(row, ['消化日数', '消化合計', '使用日数'])) || 0;
    const balance = Number(findValue(row, ['期末残高', '残日数', '有給残'])) || 0;
    const expiredCount = Number(findValue(row, ['時効数', '時効', '消滅日数'])) || 0;
    const remainingAfterExpiry = Number(findValue(row, ['時効後残'])) || 0;

    const status = normalizeStatus(statusRaw);
    const entryDate = excelDateToISO(entryDateRaw);
    const yukyuStartDate = excelDateToISO(yukyuStartDateRaw);
    const uniqueYukyuDates = [...new Set(allYukyuDates)].sort();

    const existingIdx = existingEmployees.findIndex(emp => emp.id === id);

    if (existingIdx >= 0) {
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

  return { employees: existingEmployees, count: totalCount };
};

// Componente Dropzone individual
interface DropzoneProps {
  type: 'daicho' | 'yukyu';
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  syncStatus: { synced: boolean; count: number; lastSync: string | null };
  onProcess: (file: File) => void;
  loading: boolean;
}

const Dropzone: React.FC<DropzoneProps> = ({ type, title, subtitle, icon, color, syncStatus, onProcess, loading }) => {
  const [isDragging, setIsDragging] = useState(false);

  const borderColor = syncStatus.synced ? `border-${color}-500/50` : 'border-white/10';
  const bgColor = isDragging ? `bg-${color}-500/5` : 'bg-[#0a0a0a]';

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) onProcess(file); }}
      className={`relative border-2 border-dashed p-8 text-center transition-all duration-500 rounded-lg ${
        isDragging ? `border-${color}-500 scale-[1.02]` : syncStatus.synced ? `border-${color}-500/30` : 'border-white/10'
      } ${bgColor} hover:border-white/20`}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.xlsm"
        className="absolute inset-0 opacity-0 cursor-pointer z-20"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onProcess(file); }}
      />

      {loading ? (
        <div className="flex flex-col items-center py-8 space-y-4">
          <div className={`w-16 h-16 border-t-4 border-${color}-500 rounded-full animate-spin`}></div>
          <p className="text-lg font-black italic tracking-tighter animate-pulse">解析中...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status Icon */}
          <div className="flex justify-center">
            {syncStatus.synced ? (
              <div className={`w-16 h-16 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
                <span className="text-3xl">✓</span>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <span className="text-3xl opacity-30">{icon}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <h3 className={`text-2xl font-black italic tracking-tighter ${syncStatus.synced ? `text-${color}-400` : 'text-white'}`}>
              {title}
            </h3>
            <p className="text-xs text-white/40 mt-1">{subtitle}</p>
          </div>

          {/* Status */}
          {syncStatus.synced ? (
            <div className={`text-${color}-400 text-sm font-bold`}>
              <p>{syncStatus.count.toLocaleString()} 件同期済</p>
              {syncStatus.lastSync && (
                <p className="text-xs text-white/30 mt-1">
                  {new Date(syncStatus.lastSync).toLocaleString('ja-JP')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-white/30 text-xs font-bold">ファイルをドラッグまたはクリック</p>
          )}
        </div>
      )}
    </div>
  );
};

const ExcelSync: React.FC<ExcelSyncProps> = ({ onSyncComplete }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(loadSyncStatus);
  const [loadingDaicho, setLoadingDaicho] = useState(false);
  const [loadingYukyu, setLoadingYukyu] = useState(false);

  useEffect(() => {
    saveSyncStatus(syncStatus);
  }, [syncStatus]);

  const processDaichoFile = (file: File) => {
    setLoadingDaicho(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const hasDaichoSheets = DAICHO_SHEETS.some(s => workbook.SheetNames.includes(s.name));
        if (!hasDaichoSheets) {
          alert('社員台帳ファイルではありません。\n必要なシート: DBGenzaiX, DBUkeoiX, DBStaffX');
          setLoadingDaicho(false);
          return;
        }

        const currentAppData = db.loadData();
        const result = processDaicho(workbook, [...currentAppData.employees]);

        currentAppData.employees = result.employees;
        db.saveData(currentAppData);

        setSyncStatus(prev => ({
          ...prev,
          daicho: { synced: true, count: result.count, lastSync: new Date().toISOString() }
        }));

        onSyncComplete();
      } catch (err) {
        console.error('[Daicho] Error:', err);
        alert('社員台帳の解析に失敗しました。');
      } finally {
        setLoadingDaicho(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processYukyuFile = (file: File) => {
    setLoadingYukyu(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const hasYukyuSheets = YUKYU_SHEETS.some(s => workbook.SheetNames.includes(s.name));
        if (!hasYukyuSheets) {
          alert('有給休暇管理ファイルではありません。\n必要なシート: 作業者データ　有給, 請負');
          setLoadingYukyu(false);
          return;
        }

        const currentAppData = db.loadData();
        const result = processYukyu(workbook, [...currentAppData.employees]);

        currentAppData.employees = result.employees;
        db.saveData(currentAppData);

        setSyncStatus(prev => ({
          ...prev,
          yukyu: { synced: true, count: result.count, lastSync: new Date().toISOString() }
        }));

        onSyncComplete();
      } catch (err) {
        console.error('[Yukyu] Error:', err);
        alert('有給休暇管理の解析に失敗しました。');
      } finally {
        setLoadingYukyu(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const resetSync = () => {
    if (confirm('同期状態をリセットしますか？\n（データは削除されません）')) {
      setSyncStatus({
        daicho: { synced: false, count: 0, lastSync: null },
        yukyu: { synced: false, count: 0, lastSync: null }
      });
    }
  };

  const bothSynced = syncStatus.daicho.synced && syncStatus.yukyu.synced;

  return (
    <div className="p-12 max-w-[1200px] mx-auto space-y-12 animate-fadeIn relative pb-32">
      <div className="absolute top-0 right-0 text-[18vw] font-black text-white/[0.01] select-none pointer-events-none italic tracking-tighter">同期</div>

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-end gap-8 relative z-10 border-b border-white/5 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="h-14 w-2 bg-blue-500 shadow-[0_0_20px_#00e5ff] animate-pulse"></div>
            <h2 className="text-7xl font-black italic tracking-tighter aggressive-text">データ同期</h2>
          </div>
          <div className="flex items-center gap-4 text-white/30 font-black tracking-[0.4em] ml-8 text-sm">
            <span>2ファイル対応</span>
            <span className="text-blue-500">●</span>
            <span>社員台帳 + 有給休暇管理</span>
          </div>
        </div>

        {bothSynced && (
          <div className="text-right px-8 py-4 border border-green-500/30 bg-green-500/10 animate-fadeIn">
            <p className="text-[10px] font-black tracking-[0.3em] mb-1 text-green-500">完全同期</p>
            <p className="text-2xl font-black italic text-green-400">
              {(syncStatus.daicho.count + syncStatus.yukyu.count).toLocaleString()}
              <span className="text-xs ml-2">件統合完了</span>
            </p>
          </div>
        )}
      </header>

      {/* Two Dropzones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Dropzone
          type="daicho"
          title="社員台帳"
          subtitle="DBGenzaiX / DBUkeoiX / DBStaffX"
          icon="📋"
          color="green"
          syncStatus={syncStatus.daicho}
          onProcess={processDaichoFile}
          loading={loadingDaicho}
        />
        <Dropzone
          type="yukyu"
          title="有給休暇管理"
          subtitle="作業者データ　有給 / 請負"
          icon="📅"
          color="blue"
          syncStatus={syncStatus.yukyu}
          onProcess={processYukyuFile}
          loading={loadingYukyu}
        />
      </div>

      {/* Reset Button */}
      {(syncStatus.daicho.synced || syncStatus.yukyu.synced) && (
        <div className="flex justify-center">
          <button
            onClick={resetSync}
            className="text-xs text-white/30 hover:text-white/60 transition-colors font-bold tracking-wider"
          >
            同期状態をリセット
          </button>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-green-500/50 transition-colors">
          <div className="text-green-500 font-black text-xl italic tracking-tighter">01. 社員台帳</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            社員の基本情報（社員№、氏名、派遣先、ステータス）を取り込みます。派遣・請負・スタッフの3カテゴリに対応。
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-blue-500/50 transition-colors">
          <div className="text-blue-500 font-black text-xl italic tracking-tighter">02. 有給休暇管理</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            有給発生日、付与数、消化日数、期末残高、時効数、取得日一覧を完全に取り込みます。
          </p>
        </div>
        <div className="bg-[#0a0a0a] p-10 border border-white/5 space-y-4 group hover:border-white/50 transition-colors">
          <div className="text-white font-black text-xl italic tracking-tighter">03. データ統合</div>
          <p className="text-xs text-white/40 leading-relaxed font-bold">
            社員番号を基にデータを自動統合。両方アップロードすると完全なデータベースが構築されます。
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExcelSync;
