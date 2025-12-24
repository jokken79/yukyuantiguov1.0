
import { AppData, Employee, LeaveRecord } from '../types';

const DB_KEY = 'yukyu_pro_storage';

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

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
    const data = JSON.parse(raw);
    // Migrate old records without status field
    data.records = data.records.map((r: any) => ({
      ...r,
      id: r.id || generateId(),
      status: r.status || 'approved', // Old records are considered approved
      createdAt: r.createdAt || new Date().toISOString()
    }));
    return data;
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

  // Add a new record (starts as pending)
  addRecord: (record: Omit<LeaveRecord, 'id' | 'status' | 'createdAt'>) => {
    const data = db.loadData();
    const newRecord: LeaveRecord = {
      ...record,
      id: generateId(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    data.records.push(newRecord);
    db.saveData(data);
    return newRecord;
  },

  // Approve a pending record
  approveRecord: (recordId: string, approvedBy?: string) => {
    const data = db.loadData();
    const record = data.records.find(r => r.id === recordId);
    if (!record || record.status !== 'pending') return false;

    record.status = 'approved';
    record.approvedAt = new Date().toISOString();
    record.approvedBy = approvedBy || 'システム';

    // Update employee balance when approved
    if (record.type === 'paid') {
      const emp = data.employees.find(e => e.id === record.employeeId);
      if (emp) {
        emp.usedTotal += 1;
        emp.balance -= 1;
      }
    }

    db.saveData(data);
    return true;
  },

  // Reject a pending record
  rejectRecord: (recordId: string, reason?: string) => {
    const data = db.loadData();
    const record = data.records.find(r => r.id === recordId);
    if (!record || record.status !== 'pending') return false;

    record.status = 'rejected';
    record.approvedAt = new Date().toISOString();
    if (reason) record.note = (record.note ? record.note + ' | ' : '') + `却下理由: ${reason}`;

    db.saveData(data);
    return true;
  },

  // Approve multiple records at once
  approveMultiple: (recordIds: string[], approvedBy?: string) => {
    const data = db.loadData();
    let approvedCount = 0;

    recordIds.forEach(recordId => {
      const record = data.records.find(r => r.id === recordId);
      if (!record || record.status !== 'pending') return;

      record.status = 'approved';
      record.approvedAt = new Date().toISOString();
      record.approvedBy = approvedBy || 'システム';

      if (record.type === 'paid') {
        const emp = data.employees.find(e => e.id === record.employeeId);
        if (emp) {
          emp.usedTotal += 1;
          emp.balance -= 1;
        }
      }
      approvedCount++;
    });

    db.saveData(data);
    return approvedCount;
  },

  // Reject multiple records at once
  rejectMultiple: (recordIds: string[], reason?: string) => {
    const data = db.loadData();
    let rejectedCount = 0;

    recordIds.forEach(recordId => {
      const record = data.records.find(r => r.id === recordId);
      if (!record || record.status !== 'pending') return;

      record.status = 'rejected';
      record.approvedAt = new Date().toISOString();
      if (reason) record.note = (record.note ? record.note + ' | ' : '') + `却下理由: ${reason}`;
      rejectedCount++;
    });

    db.saveData(data);
    return rejectedCount;
  },

  // Delete a record (only pending or rejected)
  deleteRecord: (recordId: string) => {
    const data = db.loadData();
    const index = data.records.findIndex(r => r.id === recordId);
    if (index < 0) return false;

    const record = data.records[index];
    if (record.status === 'approved') return false; // Can't delete approved records

    data.records.splice(index, 1);
    db.saveData(data);
    return true;
  },

  clearAll: () => {
    localStorage.removeItem(DB_KEY);
  }
};
