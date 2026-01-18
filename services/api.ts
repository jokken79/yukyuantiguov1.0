import { AppData, Employee, LeaveRecord } from '../types';

const API_BASE = '/api';

export const api = {
  // Health check
  checkHealth: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  // --- Employees ---
  syncEmployees: async (employees: Employee[]): Promise<void> => {
    const res = await fetch(`${API_BASE}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employees)
    });
    if (!res.ok) throw new Error('Failed to sync employees');
  },

  getEmployees: async (): Promise<Employee[]> => {
    const res = await fetch(`${API_BASE}/employees`);
    if (!res.ok) throw new Error('Failed to fetch employees');
    return res.json();
  },

  // --- Leave Records ---
  getRecords: async (): Promise<LeaveRecord[]> => {
    const res = await fetch(`${API_BASE}/records`);
    if (!res.ok) throw new Error('Failed to fetch records');
    return res.json();
  },

  saveRecord: async (record: LeaveRecord): Promise<void> => {
    const res = await fetch(`${API_BASE}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) throw new Error('Failed to save record');
  },

  // --- AI ---
  analyze: async (data: AppData) => {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('AI analysis failed');
    return res.json();
  }
};