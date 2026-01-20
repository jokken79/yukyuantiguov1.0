import { AppData, Employee, LeaveRecord } from '../types';

const API_BASE = '/api';
const SYNC_TIMEOUT = 5000; // 5 seconds timeout for sync operations

// Helper function for fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

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
  // Non-blocking sync with timeout - silently fails if backend unavailable
  syncEmployees: async (employees: Employee[]): Promise<void> => {
    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/employees`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(employees)
        },
        SYNC_TIMEOUT
      );
      if (!res.ok) {
        console.warn('Backend sync failed (non-critical):', res.status);
      }
    } catch (e) {
      // Silently ignore - backend sync is optional
      console.warn('Backend sync skipped (backend unavailable)');
    }
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