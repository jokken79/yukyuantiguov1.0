
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { db } from '../services/db';
import { Employee, PeriodHistory } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { mergeExcelData, validateMerge, getMergeSummary } from '../services/mergeService';
import { getEmployeeBalance } from '../services/balanceCalculator';
import { convertNameToKatakana } from '../services/nameConverter';

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
  daicho: { synced: boolean; count: number; activeCount: number; resignedCount: number; lastSync: string | null };
  yukyu: { synced: boolean; count: number; activeCount: number; resignedCount: number; lastSync: string | null };
  includeResigned: boolean;
}

const SYNC_STATUS_KEY = 'yukyu_sync_status';

const loadSyncStatus = (): SyncStatus => {
  try {
    const saved = localStorage.getItem(SYNC_STATUS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    daicho: { synced: false, count: 0, activeCount: 0, resignedCount: 0, lastSync: null },
    yukyu: { synced: false, count: 0, activeCount: 0, resignedCount: 0, lastSync: null },
    includeResigned: true  // ⭐ Por defecto incluir TODOS los empleados (activos + retirados)
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
const processDaicho = (
  workbook: XLSX.WorkBook,
  existingEmployees: Employee[],
  includeResigned: boolean
): { employees: Employee[]; count: number; activeCount: number; resignedCount: number } => {
  let activeCount = 0;
  let resignedCount = 0;

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

      // ⭐ NUEVO: Leer 入社日 del DAICHO
      const entryDateRaw = findValue(row, ['入社日', '入社', '入社年月日']);
      const entryDate = entryDateRaw ? excelDateToISO(entryDateRaw) : undefined;

      // Contar por estado
      if (status === '退社') {
        resignedCount++;
        if (!includeResigned) return; // Saltar si no incluimos退社
      } else {
        activeCount++;
      }

      const existingIdx = existingEmployees.findIndex(emp => emp.id === id);

      // ⭐ Corregir katakana roto (ej: ンウイェン → グエン)
      const correctedKana = nameKana ? convertNameToKatakana(String(nameKana)) : undefined;

      if (existingIdx >= 0) {
        const emp = existingEmployees[existingIdx];
        existingEmployees[existingIdx] = {
          ...emp,
          name: name ? String(name) : emp.name,
          nameKana: correctedKana || emp.nameKana,
          client: client ? String(client) : emp.client,
          category: category,
          status: status,
          entryDate: entryDate || emp.entryDate, // ⭐ Actualizar entryDate si existe
          lastSync: new Date().toISOString()
        };
      } else {
        existingEmployees.push({
          id,
          name: name ? String(name) : '未設定',
          nameKana: correctedKana,
          client: client ? String(client) : '未設定',
          category: category,
          entryDate: entryDate, // ⭐ Agregar entryDate para empleados nuevos
          grantedTotal: 0,
          usedTotal: 0,
          balance: 0,
          expiredCount: 0,
          status: status,
          lastSync: new Date().toISOString()
        });
      }
    });
  });

  const count = includeResigned ? activeCount + resignedCount : activeCount;
  return { employees: existingEmployees, count, activeCount, resignedCount };
};

// ⭐ Construir historial de períodos desde múltiples filas del Excel
const buildPeriodHistory = (
  rows: any[],
  employeeId: string,
  category: string
): PeriodHistory[] => {
  const now = new Date();
  const periodHistory: PeriodHistory[] = [];

  const firstRow = rows[0];
  const entryDateRaw = findValue(firstRow, ['入社日', '入社']);
  const entryDate = entryDateRaw ? excelDateToISO(entryDateRaw) : undefined;

  if (!entryDate) {
    console.warn(`⚠️ ${employeeId}: Sin 入社日, no se puede crear periodHistory`);
    return [];
  }

  const entry = new Date(entryDate);

  rows.forEach((row, index) => {
    // Extraer datos de la fila
    const elapsedMonths = Number(findValue(row, ['経過月', '経過月数'])) || 0;
    const yukyuStartDateRaw = findValue(row, ['有給発生', '有給発生日']);
    const granted = Number(findValue(row, ['付与数', '付与合計', '付与日数', '当期付与'])) || 0;
    const used = Number(findValue(row, ['消化日数', '消化合計', '使用日数'])) || 0;
    const balance = Number(findValue(row, ['期末残高', '残日数', '有給残', '残高'])) || 0;
    const expired = Number(findValue(row, ['時効数', '時効', '消滅日数', '時効日数'])) || 0;
    const carryOver = Number(findValue(row, ['繰越', '繰越日数'])) || undefined;

    // Calcular fechas
    const yukyuStartDate = yukyuStartDateRaw ? excelDateToISO(yukyuStartDateRaw) : undefined;

    const grantDate = new Date(entry);
    grantDate.setMonth(grantDate.getMonth() + elapsedMonths);

    const expiryDate = new Date(grantDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 2);

    // ⭐ CONFIAR en 時効数 del Excel como fuente de verdad
    const isExpired = expired > 0 || now >= expiryDate;

    // Determinar período actual
    const monthsFromEntry = (now.getFullYear() - entry.getFullYear()) * 12 +
                            (now.getMonth() - entry.getMonth());
    const isCurrentPeriod = Math.abs(elapsedMonths - monthsFromEntry) <= 6;

    // Nombre del período
    const periodName = elapsedMonths === 6
      ? '初回(6ヶ月)'
      : `${Math.floor(elapsedMonths / 12)}年${elapsedMonths % 12 > 0 ? elapsedMonths % 12 + 'ヶ月' : ''}`;

    const rowYukyuDates = extractYukyuDates(row);

    periodHistory.push({
      periodIndex: index,
      periodName,
      elapsedMonths,
      yukyuStartDate: yukyuStartDate || grantDate.toISOString().split('T')[0],
      grantDate,
      expiryDate,
      granted,
      used,
      balance,
      expired,
      carryOver,
      isExpired,
      isCurrentPeriod,
      yukyuDates: rowYukyuDates,
      source: 'excel',
      syncedAt: new Date().toISOString()
    });
  });

  // Ordenar por fecha de otorgamiento (más antiguo primero)
  periodHistory.sort((a, b) => a.grantDate.getTime() - b.grantDate.getTime());

  console.log(`📊 ${employeeId}: ${periodHistory.length} períodos creados`);
  return periodHistory;
};

// Procesar YUKYU
const processYukyu = (
  workbook: XLSX.WorkBook,
  existingEmployees: Employee[],
  includeResigned: boolean
): { employees: Employee[]; count: number; activeCount: number; resignedCount: number } => {
  let activeCount = 0;
  let resignedCount = 0;

  const employeeYukyuMap: Map<string, {
    allRows: any[];
    allYukyuDates: string[];
    category: string;
    status: string;
  }> = new Map();

  YUKYU_SHEETS.forEach(({ name: sheetName, category }) => {
    if (!workbook.SheetNames.includes(sheetName)) return;

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet);
    if (jsonData.length === 0) return;

    jsonData.forEach((row: any) => {
      const id = String(findValue(row, ['社員№', '社員番号', '社員ID', 'ID', 'No', '№']));
      if (!id || id === 'undefined' || id === 'null' || id === '') return;

      const statusRaw = findValue(row, ['在職中', '現在', '状態', 'ステータス', 'Status']);
      const status = normalizeStatus(statusRaw);
      const yukyuDates = extractYukyuDates(row);
      const existing = employeeYukyuMap.get(id);

      if (!existing) {
        // Primera fila de este empleado
        employeeYukyuMap.set(id, {
          allRows: [row],
          allYukyuDates: yukyuDates,
          category,
          status
        });
      } else {
        // Filas adicionales del mismo empleado
        existing.allRows.push(row);
        existing.allYukyuDates.push(...yukyuDates);
      }
    });
  });

  employeeYukyuMap.forEach(({ allRows, allYukyuDates, category, status }, id) => {
    // Contar por estado
    if (status === '退社') {
      resignedCount++;
      if (!includeResigned) return; // Saltar si no incluimos退社
    } else {
      activeCount++;
    }

    // ⭐ NUEVO: Construir historial de períodos completo
    const periodHistory = buildPeriodHistory(allRows, id, category);

    // ⭐ NUEVO: Calcular valores ACTUALES (solo períodos vigentes/no expirados)
    const currentPeriods = periodHistory.filter(p => !p.isExpired);
    const currentGrantedTotal = currentPeriods.reduce((sum, p) => sum + p.granted, 0);
    const currentUsedTotal = currentPeriods.reduce((sum, p) => sum + p.used, 0);
    const currentBalance = currentPeriods.reduce((sum, p) => sum + p.balance, 0);
    const currentExpiredCount = 0; // Los períodos actuales nunca tienen expirados

    // ⭐ NUEVO: Calcular valores HISTÓRICOS (todos los períodos)
    const historicalGrantedTotal = periodHistory.reduce((sum, p) => sum + p.granted, 0);
    const historicalUsedTotal = periodHistory.reduce((sum, p) => sum + p.used, 0);
    const historicalBalance = periodHistory.reduce((sum, p) => sum + p.balance, 0);
    const historicalExpiredCount = periodHistory.reduce((sum, p) => sum + p.expired, 0);

    // ⭐ LEGACY: Calcular valores para backward compatibility
    let carryOver = 0;
    let totalAvailable = 0;
    let remainingAfterExpiry = 0;
    allRows.forEach(row => {
      carryOver += Number(findValue(row, ['繰越', '繰越日数'])) || 0;
      totalAvailable += Number(findValue(row, ['保有数', '保有日数'])) || 0;
      remainingAfterExpiry += Number(findValue(row, ['時効後残', '時効後残日数'])) || 0;
    });

    // ⭐ NUEVO: Tomar valores no-numéricos de la PRIMERA fila
    const firstRow = allRows[0];
    const name = findValue(firstRow, ['氏名', '名前', '従業員名', 'Name']);
    const nameKanaRaw = findValue(firstRow, ['カナ', 'かな', 'Kana']);
    const client = findValue(firstRow, ['派遣先', '請負業務', '事務所', '工場', '部署', '勤務地']);

    // ⭐ Corregir katakana roto (ej: ンウイェン → グエン)
    const nameKana = nameKanaRaw ? convertNameToKatakana(String(nameKanaRaw)) : undefined;

    const entryDateRaw = findValue(firstRow, ['入社日', '入社']);
    const elapsedTime = findValue(firstRow, ['経過月数']);
    const elapsedMonths = Number(findValue(firstRow, ['経過月', '経過月数'])) || 0;
    const yukyuStartDateRaw = findValue(firstRow, ['有給発生', '有給発生日']);

    const entryDate = excelDateToISO(entryDateRaw);
    const yukyuStartDate = excelDateToISO(yukyuStartDateRaw);
    const uniqueYukyuDates = [...new Set(allYukyuDates)].sort();

    // ⭐ NUEVO: Console log mejorado con valores dual
    console.log(`📋 ${name} (№${id}): ${periodHistory.length} períodos`);
    console.log(`   Current:  付与${currentGrantedTotal} 消化${currentUsedTotal} 残${currentBalance}`);
    console.log(`   Total:    付与${historicalGrantedTotal} 消化${historicalUsedTotal} 時効${historicalExpiredCount}`);

    const existingIdx = existingEmployees.findIndex(emp => emp.id === id);

    if (existingIdx >= 0) {
      const emp = existingEmployees[existingIdx];

      // ⭐ NUEVO: Preparar datos del Excel para merge
      const excelData: Partial<Employee> = {
        name: name ? String(name) : undefined,
        nameKana: nameKana ? String(nameKana) : undefined,
        client: client ? String(client) : undefined,
        category: category || undefined,
        entryDate: entryDate || undefined,
        elapsedTime: elapsedTime ? String(elapsedTime) : undefined,
        elapsedMonths: elapsedMonths || undefined,
        yukyuStartDate: yukyuStartDate || undefined,

        // ⭐ NUEVO: Historial completo de períodos
        periodHistory: periodHistory.length > 0 ? periodHistory : undefined,

        // ⭐ NUEVO: Valores ACTUALES (solo períodos vigentes)
        // ⚠️ CRÍTICO: NO usar || undefined porque 0 se convierte en undefined
        currentGrantedTotal,
        currentUsedTotal,
        currentBalance,
        currentExpiredCount,

        // ⭐ NUEVO: Valores HISTÓRICOS (todos los períodos)
        historicalGrantedTotal,
        historicalUsedTotal,
        historicalBalance,
        historicalExpiredCount,

        // ⭐ LEGACY: Campos para backward compatibility
        grantedTotal: currentGrantedTotal,
        carryOver: carryOver || undefined,
        totalAvailable: totalAvailable || undefined,
        usedTotal: historicalUsedTotal,
        balance: currentBalance,
        expiredCount: historicalExpiredCount,
        remainingAfterExpiry: remainingAfterExpiry || undefined,
        yukyuDates: uniqueYukyuDates.length > 0 ? uniqueYukyuDates : undefined,
        status: status
      };

      // ⭐ NUEVO: Merge inteligente que preserva aprobaciones locales
      const mergeResult = mergeExcelData(excelData, emp);

      // Validar merge
      if (!validateMerge(mergeResult)) {
        console.error(`❌ Error al mergear empleado ${emp.name}`);
      }

      // Mostrar warnings si existen
      if (mergeResult.warnings.length > 0) {
        console.warn(`⚠️ Warnings para ${emp.name}:`, mergeResult.warnings);
      }

      // Mostrar conflictos si existen
      if (mergeResult.conflicts.length > 0) {
        console.warn(`⚠️ Conflictos para ${emp.name}:`, mergeResult.conflicts);
        // TODO: Agregar modal UI para mostrar conflictos al usuario
      }

      // ⚠️ DESHABILITADO: Confiamos en los valores del Excel
      // Los valores ya están sumados correctamente de todas las filas
      // No necesitamos recalcular porque el Excel tiene la información real
      //
      // const balanceInfo = getEmployeeBalance(mergeResult.employee);
      // mergeResult.employee.grantedTotal = balanceInfo.granted;
      // mergeResult.employee.usedTotal = balanceInfo.used;
      // mergeResult.employee.balance = balanceInfo.remaining;
      // mergeResult.employee.expiredCount = balanceInfo.expiredCount;

      // OPCIONAL: Solo recalcular si hay aprobaciones locales
      const hasLocalApprovals = mergeResult.employee.localModifications?.approvedDates?.length > 0;
      if (hasLocalApprovals) {
        console.warn(`⚠️ ${mergeResult.employee.name} tiene aprobaciones locales. Recalculando usedTotal.`);
        const balanceInfo = getEmployeeBalance(mergeResult.employee);
        mergeResult.employee.usedTotal = balanceInfo.used; // Solo actualizar usedTotal
        mergeResult.employee.balance = mergeResult.employee.grantedTotal - balanceInfo.used;
      }

      // Actualizar empleado
      existingEmployees[existingIdx] = mergeResult.employee;

      // Mostrar resumen de cambios
      const summary = getMergeSummary(emp, mergeResult.employee);
      if (emp.yukyuDates?.length !== mergeResult.employee.yukyuDates?.length) {
        console.log(summary);
      }
    } else {
      // ⭐ Crear nuevo empleado con todos los campos (incluidos los nuevos)
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

        // ⭐ NUEVO: Historial completo de períodos
        periodHistory: periodHistory.length > 0 ? periodHistory : undefined,

        // ⭐ NUEVO: Valores ACTUALES (solo períodos vigentes)
        currentGrantedTotal: currentGrantedTotal || undefined,
        currentUsedTotal: currentUsedTotal || undefined,
        currentBalance: currentBalance || undefined,
        currentExpiredCount: currentExpiredCount,

        // ⭐ NUEVO: Valores HISTÓRICOS (todos los períodos)
        historicalGrantedTotal: historicalGrantedTotal || undefined,
        historicalUsedTotal: historicalUsedTotal || undefined,
        historicalBalance: historicalBalance || undefined,
        historicalExpiredCount: historicalExpiredCount || undefined,

        // ⭐ LEGACY: Campos para backward compatibility
        grantedTotal: currentGrantedTotal || undefined,
        carryOver,
        totalAvailable,
        usedTotal: historicalUsedTotal || undefined,
        balance: currentBalance || undefined,
        expiredCount: historicalExpiredCount || undefined,
        remainingAfterExpiry,
        yukyuDates: uniqueYukyuDates.length > 0 ? uniqueYukyuDates : undefined,
        status: status,
        lastSync: new Date().toISOString()
      });
    }
  });

  const count = includeResigned ? activeCount + resignedCount : activeCount;
  return { employees: existingEmployees, count, activeCount, resignedCount };
};

// Progress state interface
interface ProgressState {
  stage: 'idle' | 'reading' | 'parsing' | 'processing' | 'saving' | 'complete';
  percent: number;
  message: string;
}

const PROGRESS_STAGES = {
  idle: { percent: 0, message: '' },
  reading: { percent: 20, message: 'ファイル読み込み中...' },
  parsing: { percent: 40, message: 'Excel解析中...' },
  processing: { percent: 70, message: 'データ処理中...' },
  saving: { percent: 90, message: '保存中...' },
  complete: { percent: 100, message: '完了!' }
};

// Componente Dropzone individual
interface DropzoneProps {
  type: 'daicho' | 'yukyu';
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  syncStatus: { synced: boolean; count: number; activeCount: number; resignedCount: number; lastSync: string | null };
  onProcess: (file: File) => void;
  loading: boolean;
  progress: ProgressState;
  includeResigned: boolean;
  isDark: boolean;
}

const Dropzone: React.FC<DropzoneProps> = ({ type, title, subtitle, icon, color, syncStatus, onProcess, loading, progress, includeResigned, isDark }) => {
  const [isDragging, setIsDragging] = useState(false);

  const bgColor = isDragging ? `bg-${color}-500/5` : isDark ? 'bg-[#0a0a0a]' : 'bg-white';
  const borderIdle = isDark ? 'border-white/10' : 'border-slate-200';
  const hoverBorder = isDark ? 'hover:border-white/20' : 'hover:border-slate-400';

  // Color classes for progress bar
  const progressColorClass = color === 'green' ? 'bg-green-500' : 'bg-blue-500';
  const progressBgClass = isDark ? 'bg-white/10' : 'bg-slate-200';

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) onProcess(file); }}
      className={`relative border-2 border-dashed p-8 text-center transition-all duration-500 rounded-lg ${
        isDragging ? `border-${color}-500 scale-[1.02]` : syncStatus.synced ? `border-${color}-500/30` : borderIdle
      } ${bgColor} ${hoverBorder} ${!isDark && 'shadow-sm'}`}
    >
      <input
        type="file"
        accept=".xlsx,.xls,.xlsm"
        className="absolute inset-0 opacity-0 cursor-pointer z-20"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onProcess(file); }}
        disabled={loading}
      />

      {loading ? (
        <div className="flex flex-col items-center py-6 space-y-4">
          {/* Progress Bar */}
          <div className={`w-full h-3 rounded-full overflow-hidden ${progressBgClass}`}>
            <div
              className={`h-full ${progressColorClass} transition-all duration-500 ease-out`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {/* Progress Percentage */}
          <div className="flex items-center justify-between w-full">
            <span className={`text-2xl font-black ${color === 'green' ? 'text-green-500' : 'text-blue-500'}`}>
              {progress.percent}%
            </span>
            <span className={`text-sm font-bold animate-pulse ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
              {progress.message}
            </span>
          </div>

          {/* Stage Indicators */}
          <div className="flex justify-center gap-2 w-full">
            {(['reading', 'parsing', 'processing', 'saving'] as const).map((stage, idx) => {
              const isActive = progress.stage === stage;
              const isComplete = PROGRESS_STAGES[progress.stage].percent > PROGRESS_STAGES[stage].percent;
              return (
                <div
                  key={stage}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                    isActive
                      ? `${color === 'green' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'} animate-pulse`
                      : isComplete
                        ? `${isDark ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-500'}`
                        : `${isDark ? 'bg-white/5 text-white/20' : 'bg-slate-50 text-slate-300'}`
                  }`}
                >
                  {isComplete ? '✓' : isActive ? '●' : '○'}
                  <span className="hidden sm:inline">
                    {stage === 'reading' && '読込'}
                    {stage === 'parsing' && '解析'}
                    {stage === 'processing' && '処理'}
                    {stage === 'saving' && '保存'}
                  </span>
                </div>
              );
            })}
          </div>
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
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isDark ? 'bg-white/5' : 'bg-slate-100'}`}>
                <span className={`text-3xl ${isDark ? 'opacity-30' : 'opacity-40'}`}>{icon}</span>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <h3 className={`text-2xl font-black italic tracking-tighter ${syncStatus.synced ? `text-${color}-500` : isDark ? 'text-white' : 'text-slate-800'}`}>
              {title}
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{subtitle}</p>
          </div>

          {/* Status */}
          {syncStatus.synced ? (
            <div className="text-sm font-bold space-y-1">
              <p className={`text-${color}-500`}>
                {syncStatus.count.toLocaleString()} 件同期済
              </p>
              <div className="flex justify-center gap-4 text-xs">
                <span className="text-green-500">在職中: {syncStatus.activeCount.toLocaleString()}</span>
                {includeResigned && syncStatus.resignedCount > 0 && (
                  <span className="text-red-500">退社: {syncStatus.resignedCount.toLocaleString()}</span>
                )}
                {!includeResigned && syncStatus.resignedCount > 0 && (
                  <span className={isDark ? 'text-white/30' : 'text-slate-400'}>(退社 {syncStatus.resignedCount} 件除外)</span>
                )}
              </div>
              {syncStatus.lastSync && (
                <p className={`text-xs mt-1 ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
                  {new Date(syncStatus.lastSync).toLocaleString('ja-JP')}
                </p>
              )}
            </div>
          ) : (
            <p className={`text-xs font-bold ${isDark ? 'text-white/30' : 'text-slate-400'}`}>ファイルをドラッグまたはクリック</p>
          )}
        </div>
      )}
    </div>
  );
};

const ExcelSync: React.FC<ExcelSyncProps> = ({ onSyncComplete }) => {
  const { isDark } = useTheme();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(loadSyncStatus);
  const [loadingDaicho, setLoadingDaicho] = useState(false);
  const [loadingYukyu, setLoadingYukyu] = useState(false);
  const [progressDaicho, setProgressDaicho] = useState<ProgressState>({ stage: 'idle', percent: 0, message: '' });
  const [progressYukyu, setProgressYukyu] = useState<ProgressState>({ stage: 'idle', percent: 0, message: '' });

  useEffect(() => {
    saveSyncStatus(syncStatus);
  }, [syncStatus]);

  const toggleIncludeResigned = () => {
    setSyncStatus(prev => ({
      ...prev,
      includeResigned: !prev.includeResigned
    }));
  };

  const setProgress = (setter: React.Dispatch<React.SetStateAction<ProgressState>>, stage: ProgressState['stage']) => {
    setter({ stage, ...PROGRESS_STAGES[stage] });
  };

  const processDaichoFile = (file: File) => {
    setLoadingDaicho(true);
    setProgress(setProgressDaicho, 'reading');
    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const readPercent = Math.round((e.loaded / e.total) * 20);
        setProgressDaicho({ stage: 'reading', percent: readPercent, message: PROGRESS_STAGES.reading.message });
      }
    };

    reader.onload = async (e) => {
      try {
        setProgress(setProgressDaicho, 'parsing');
        await new Promise(r => setTimeout(r, 100)); // Allow UI to update

        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const hasDaichoSheets = DAICHO_SHEETS.some(s => workbook.SheetNames.includes(s.name));
        if (!hasDaichoSheets) {
          toast.error('社員台帳ファイルではありません。\n必要なシート: DBGenzaiX, DBUkeoiX, DBStaffX', { duration: 6000 });
          setLoadingDaicho(false);
          setProgress(setProgressDaicho, 'idle');
          return;
        }

        setProgress(setProgressDaicho, 'processing');
        await new Promise(r => setTimeout(r, 100));

        const currentAppData = db.loadData();
        const result = processDaicho(workbook, [...currentAppData.employees], syncStatus.includeResigned);

        setProgress(setProgressDaicho, 'saving');
        await new Promise(r => setTimeout(r, 100));

        currentAppData.employees = result.employees;
        db.saveData(currentAppData);

        setProgress(setProgressDaicho, 'complete');
        await new Promise(r => setTimeout(r, 500));

        setSyncStatus(prev => ({
          ...prev,
          daicho: {
            synced: true,
            count: result.count,
            activeCount: result.activeCount,
            resignedCount: result.resignedCount,
            lastSync: new Date().toISOString()
          }
        }));

        onSyncComplete();
      } catch (err) {
        console.error('[Daicho] Error:', err);
        toast.error('社員台帳の解析に失敗しました。\nシート名やデータ形式を確認してください。', { duration: 6000 });
      } finally {
        setLoadingDaicho(false);
        setProgress(setProgressDaicho, 'idle');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processYukyuFile = (file: File) => {
    setLoadingYukyu(true);
    setProgress(setProgressYukyu, 'reading');
    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const readPercent = Math.round((e.loaded / e.total) * 20);
        setProgressYukyu({ stage: 'reading', percent: readPercent, message: PROGRESS_STAGES.reading.message });
      }
    };

    reader.onload = async (e) => {
      try {
        setProgress(setProgressYukyu, 'parsing');
        await new Promise(r => setTimeout(r, 100));

        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const hasYukyuSheets = YUKYU_SHEETS.some(s => workbook.SheetNames.includes(s.name));
        if (!hasYukyuSheets) {
          toast.error('有給休暇管理ファイルではありません。\n必要なシート: 作業者データ　有給, 請負', { duration: 6000 });
          setLoadingYukyu(false);
          setProgress(setProgressYukyu, 'idle');
          return;
        }

        setProgress(setProgressYukyu, 'processing');
        await new Promise(r => setTimeout(r, 100));

        const currentAppData = db.loadData();
        const result = processYukyu(workbook, [...currentAppData.employees], syncStatus.includeResigned);

        setProgress(setProgressYukyu, 'saving');
        await new Promise(r => setTimeout(r, 100));

        currentAppData.employees = result.employees;
        db.saveData(currentAppData);

        setProgress(setProgressYukyu, 'complete');
        await new Promise(r => setTimeout(r, 500));

        setSyncStatus(prev => ({
          ...prev,
          yukyu: {
            synced: true,
            count: result.count,
            activeCount: result.activeCount,
            resignedCount: result.resignedCount,
            lastSync: new Date().toISOString()
          }
        }));

        onSyncComplete();
      } catch (err) {
        console.error('[Yukyu] Error:', err);
        toast.error('有給休暇管理の解析に失敗しました。\nシート名やデータ形式を確認してください。', { duration: 6000 });
      } finally {
        setLoadingYukyu(false);
        setProgress(setProgressYukyu, 'idle');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const resetSync = () => {
    if (confirm('同期状態をリセットしますか？\n（データは削除されません）')) {
      setSyncStatus(prev => ({
        daicho: { synced: false, count: 0, activeCount: 0, resignedCount: 0, lastSync: null },
        yukyu: { synced: false, count: 0, activeCount: 0, resignedCount: 0, lastSync: null },
        includeResigned: prev.includeResigned
      }));
    }
  };

  const clearAllData = () => {
    const confirmMessage =
      '⚠️ 警告: すべてのデータを完全に削除します\n\n' +
      '以下のデータが永久に削除されます：\n' +
      '• 全社員データ\n' +
      '• 全有給申請記録\n' +
      '• 同期状態\n' +
      '• その他の設定\n\n' +
      'この操作は取り消せません。\n' +
      '本当に削除しますか？';

    if (confirm(confirmMessage)) {
      // Segunda confirmación para evitar borrados accidentales
      if (confirm('最終確認: 本当にすべてのデータを削除しますか？')) {
        localStorage.clear();
        toast.success('すべてのデータを削除しました。\nページをリロードします。', { duration: 2000 });
        setTimeout(() => window.location.reload(), 2000);
      }
    }
  };

  const bothSynced = syncStatus.daicho.synced && syncStatus.yukyu.synced;

  return (
    <div className="p-12 max-w-[1200px] mx-auto space-y-12 animate-fadeIn relative pb-32">
      <div className={`absolute top-0 right-0 text-[18vw] font-black select-none pointer-events-none italic tracking-tighter ${isDark ? 'text-white/[0.01]' : 'text-slate-900/[0.02]'}`}>同期</div>

      {/* Header */}
      <header className={`flex flex-col md:flex-row justify-between items-end gap-8 relative z-10 border-b pb-12 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="h-14 w-2 bg-blue-500 shadow-[0_0_20px_#00e5ff] animate-pulse"></div>
            <h2 className={`text-7xl font-black italic tracking-tighter ${isDark ? 'aggressive-text' : 'text-slate-800'}`}>データ同期</h2>
          </div>
          <div className={`flex items-center gap-4 font-black tracking-[0.4em] ml-8 text-sm ${isDark ? 'text-white/30' : 'text-slate-500'}`}>
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

      {/* Filter Toggle */}
      <div className="flex justify-center">
        <button
          onClick={toggleIncludeResigned}
          className={`flex items-center gap-3 px-6 py-3 rounded-lg border transition-all ${
            syncStatus.includeResigned
              ? 'border-red-500/50 bg-red-500/10 text-red-400'
              : isDark ? 'border-white/10 bg-white/5 text-white/60 hover:border-white/30' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
          }`}
        >
          <div className={`w-10 h-5 rounded-full relative transition-colors ${
            syncStatus.includeResigned ? 'bg-red-500' : 'bg-white/20'
          }`}>
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              syncStatus.includeResigned ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </div>
          <span className="text-sm font-bold">
            {syncStatus.includeResigned ? '退社者を含む' : '在職中のみ'}
          </span>
        </button>
      </div>

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
          progress={progressDaicho}
          includeResigned={syncStatus.includeResigned}
          isDark={isDark}
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
          progress={progressYukyu}
          includeResigned={syncStatus.includeResigned}
          isDark={isDark}
        />
      </div>

      {/* Reset & Clear Buttons */}
      <div className="flex flex-col items-center gap-6">
        {(syncStatus.daicho.synced || syncStatus.yukyu.synced) && (
          <button
            onClick={resetSync}
            className={`text-xs transition-colors font-bold tracking-wider ${isDark ? 'text-white/30 hover:text-white/60' : 'text-slate-400 hover:text-slate-600'}`}
          >
            同期状態をリセット
          </button>
        )}

        {/* Clear All Data Button - Dangerous Action */}
        <button
          onClick={clearAllData}
          className={`group flex items-center gap-3 px-6 py-3 border-2 border-red-500/30 rounded-lg transition-all hover:border-red-500 hover:bg-red-500/10 ${
            isDark ? 'bg-red-500/5' : 'bg-red-50'
          }`}
        >
          <span className="text-2xl">🗑️</span>
          <div className="text-left">
            <div className="text-xs font-black tracking-wider text-red-500 group-hover:text-red-400">
              すべてのデータを削除
            </div>
            <div className={`text-[9px] font-bold tracking-wide ${isDark ? 'text-white/30' : 'text-slate-400'}`}>
              完全クリア（確認あり）
            </div>
          </div>
        </button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        <div className={`p-10 border space-y-4 group hover:border-green-500/50 transition-colors ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-green-500 font-black text-xl italic tracking-tighter">01. 社員台帳</div>
          <p className={`text-xs leading-relaxed font-bold ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
            社員の基本情報（社員№、氏名、派遣先、ステータス）を取り込みます。派遣・請負・スタッフの3カテゴリに対応。
          </p>
        </div>
        <div className={`p-10 border space-y-4 group hover:border-blue-500/50 transition-colors ${isDark ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="text-blue-500 font-black text-xl italic tracking-tighter">02. 有給休暇管理</div>
          <p className={`text-xs leading-relaxed font-bold ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
            有給発生日、付与数、消化日数、期末残高、時効数、取得日一覧を完全に取り込みます。
          </p>
        </div>
        <div className={`p-10 border space-y-4 group transition-colors ${isDark ? 'bg-[#0a0a0a] border-white/5 hover:border-white/50' : 'bg-white border-slate-200 shadow-sm hover:border-slate-400'}`}>
          <div className={`font-black text-xl italic tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>03. データ統合</div>
          <p className={`text-xs leading-relaxed font-bold ${isDark ? 'text-white/40' : 'text-slate-500'}`}>
            社員番号を基にデータを自動統合。両方アップロードすると完全なデータベースが構築されます。
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExcelSync;
