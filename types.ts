
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
}

export interface LeaveRecord {
  id?: string; // Unique ID for the record
  employeeId: string;
  date: string;
  type: 'paid' | 'unpaid' | 'special';
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
