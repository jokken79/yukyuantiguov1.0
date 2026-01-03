
export interface Employee {
  id: string; // 社員№
  name: string; // 氏名
  nameKana?: string; // カナ
  client: string; // 派遣先
  category?: string; // 派遣社員 / 請負社員 / スタッフ

  // Datos de Yukyu (有給休暇管理)
  entryDate?: string; // 入社日
  elapsedTime?: string; // 経過月数 (例: "5年10ヶ月")
  elapsedMonths?: number; // 経過月
  yukyuStartDate?: string; // 有給発生日
  grantedTotal: number; // 付与数
  carryOver?: number; // 繰越
  totalAvailable?: number; // 保有数
  usedTotal: number; // 消化日数
  balance: number; // 期末残高
  expiredCount: number; // 時効数
  remainingAfterExpiry?: number; // 時効後残
  yukyuDates?: string[]; // 有給取得日 (R-BE列の日付)

  status: string; // 在職中 / 退社
  lastSync: string;

  // ⭐ NUEVOS CAMPOS - Refactor v2
  lastExcelSync?: string; // Timestamp de última sincronización con Excel
  localModifications?: {
    approvedDates: string[]; // Fechas aprobadas localmente (no en Excel)
    manualAdjustments: number; // Ajustes manuales al balance
  };

  // ⭐ NUEVOS CAMPOS - Sistema de Expiración con Historial Completo
  periodHistory?: PeriodHistory[]; // Historial detallado de cada período de yukyu

  // Valores ACTUALES (solo períodos vigentes/no expirados)
  currentGrantedTotal?: number; // 付与数 de períodos vigentes
  currentUsedTotal?: number; // 消化日数 de períodos vigentes
  currentBalance?: number; // 残高 de períodos vigentes (⭐ MÁXIMO 40日 por ley)
  currentExpiredCount?: number; // Siempre 0 (períodos actuales no tienen expirados)
  excededDays?: number; // 日数 que exceden el límite legal de 40日 (se pierden)

  // Valores HISTÓRICOS (todos los períodos incluyendo expirados)
  historicalGrantedTotal?: number; // 付与数 total de todos los períodos
  historicalUsedTotal?: number; // 消化日数 total de todos los períodos
  historicalBalance?: number; // 残高 total de todos los períodos
  historicalExpiredCount?: number; // 時効数 total de todos los períodos
}

export interface LeaveRecord {
  id?: string; // Unique ID for the record
  employeeId: string;
  date: string;
  type: 'paid' | 'unpaid' | 'special';
  duration: 'full' | 'half'; // 全日 (1日) o 半日 (0.5日)
  note?: string;
  status: 'pending' | 'approved' | 'rejected'; // 承認ステータス
  createdAt: string; // 申請日時
  approvedAt?: string; // 承認日時
  approvedBy?: string; // 承認者

  // ⭐ NUEVO CAMPO - Refactor v2
  syncedToYukyuDates?: boolean; // Indica si ya se agregó a employee.yukyuDates[]
}

export interface AppData {
  employees: Employee[];
  records: LeaveRecord[];
  config: {
    companyName: string;
    fiscalYearStart: string;
  };
}

export interface AIInsight {
  title: string;
  description: string;
  type: 'warning' | 'info' | 'success';
}

// ⭐ NUEVOS TIPOS - Refactor v2

/**
 * Información de balance calculada (usado por balanceCalculator)
 */
export interface BalanceInfo {
  granted: number;      // Días otorgados totales (no expirados)
  used: number;         // Días consumidos
  remaining: number;    // Balance restante (granted - used)
  expiredCount: number; // Días que expiraron (時効)
}

/**
 * Resultado de validación de aprobación (usado por validationService)
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  code?: 'INSUFFICIENT_BALANCE' | 'DUPLICATE_DATE' | 'EMPLOYEE_RETIRED' | 'EMPLOYEE_NOT_FOUND' | 'INVALID_DATE' | 'FUTURE_DATE';
}

/**
 * Resultado de merge de Excel (usado por mergeService)
 */
export interface MergeResult {
  employee: Employee;
  conflicts: string[];
  warnings: string[];
}

/**
 * Historial detallado de un período de yukyu
 * Preserva información exacta de cada fila del Excel de 有給休暇管理
 * Permite tracking completo de períodos expirados y vigentes
 */
export interface PeriodHistory {
  // Identificación del período
  periodIndex: number; // 0-based index (0=初回, 1=2回目, etc.)
  periodName: string; // "初回(6ヶ月)", "1年6ヶ月", "2年6ヶ月", etc.

  // Datos temporales
  elapsedMonths: number; // 経過月 (6, 18, 30, 42, 54, etc.)
  yukyuStartDate: string; // 有給発生日 del Excel (YYYY-MM-DD)
  grantDate: Date; // Fecha calculada de otorgamiento (entryDate + elapsedMonths)
  expiryDate: Date; // Fecha de expiración (grantDate + 2 años)

  // Balance del Excel para este período específico
  granted: number; // 付与数 de esta fila (10, 11, 12, 14, 16, etc.)
  used: number; // 消化日数 de esta fila
  balance: number; // 期末残高 de esta fila
  expired: number; // 時効数 del Excel ⭐ fuente de verdad para determinar expiración
  carryOver?: number; // 繰越 (si existe)

  // Estado del período
  isExpired: boolean; // true si expired > 0 o expiryDate < now
  isCurrentPeriod: boolean; // true si es el período actual del empleado

  // Fechas específicas consumidas en este período
  yukyuDates: string[]; // Subset de fechas que pertenecen a este período

  // Metadata
  source: 'excel'; // Siempre 'excel' (fuente de los datos)
  syncedAt: string; // Timestamp ISO de cuando se importó (YYYY-MM-DDTHH:mm:ss.sssZ)
}
