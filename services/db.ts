
import { AppData, Employee, LeaveRecord } from '../types';

const DB_KEY = 'yukyu_pro_storage';

export const db = {
  saveData: (data: AppData) => {
    localStorage.setItem(DB_KEY, JSON.stringify(data));
  },

  loadData: (): AppData => {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      return {
        employees: [],
        records: [],
        config: { companyName: 'My Company', fiscalYearStart: '04-01' }
      };
    }
    return JSON.parse(raw);
  },

  upsertEmployee: (employee: Employee) => {
    const data = db.loadData();
    const index = data.employees.findIndex(e => e.id === employee.id);
    if (index >= 0) {
      data.employees[index] = employee;
    } else {
      data.employees.push(employee);
    }
    db.saveData(data);
  },

  addRecord: (record: LeaveRecord) => {
    const data = db.loadData();
    data.records.push(record);
    
    // Update employee balance logic
    const emp = data.employees.find(e => e.id === record.employeeId);
    if (emp) {
      emp.usedTotal += 1;
      emp.balance -= 1;
    }
    
    db.saveData(data);
  },

  clearAll: () => {
    localStorage.removeItem(DB_KEY);
  }
};
