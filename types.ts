
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
}

export interface LeaveRecord {
  employeeId: string;
  date: string;
  type: 'paid' | 'unpaid' | 'special';
  note?: string;
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
