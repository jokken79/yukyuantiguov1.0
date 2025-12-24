
export interface Employee {
  id: string; // 社員№
  name: string; // 氏名
  client: string; // 派遣先
  grantedTotal: number; // 付与合計
  usedTotal: number; // 消化合計
  balance: number; // 期末残高
  expiredCount: number; // 時効数
  status: string; // 在職中 / 退職
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
