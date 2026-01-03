
import { AppData, Employee, LeaveRecord } from '../types';
import { migrateData, showMigrationInfo } from './migrationService';
import { canApproveLeave } from './validationService';
import { getEmployeeBalance } from './balanceCalculator';
import { recalculateAllExpirations } from './expirationService';
import { validateAllEmployees, generateReportSummary } from './dataIntegrityValidator';
import { smartRepair, generateRepairSummary } from './dataRepairService';

const DB_KEY = 'yukyu_pro_storage';

// Generate unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const db = {
  saveData: (data: AppData) => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(data));
    } catch (error: any) {
      if (error.name === 'QuotaExceededError') {
        alert('⚠️ Almacenamiento lleno. Por favor, exporte los datos y limpie registros antiguos.');
        throw error;
      }
      console.error('Error guardando datos:', error);
      throw error;
    }
  },

  loadData: (): AppData => {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        return {
          employees: [],
          records: [],
          config: { companyName: 'My Company', fiscalYearStart: '04-01' }
        };
      }

      let data = JSON.parse(raw);

      // Migrate old records without status field (legacy support)
      data.records = data.records.map((r: any) => ({
        ...r,
        id: r.id || generateId(),
        status: r.status || 'approved', // Old records are considered approved
        createdAt: r.createdAt || new Date().toISOString()
      }));

      // ⭐ NUEVO: Auto-migración a versión 2
      const migrationResult = migrateData(data);

      if (migrationResult.info.wasNeeded) {
        // Si hubo migración, mostrar info y guardar
        showMigrationInfo(migrationResult.info);
        // Guardar datos migrados de vuelta a localStorage
        db.saveData(migrationResult.data);
      }

      // ⭐ NUEVO: Recálculo automático de expiraciones cada vez que se cargan los datos
      const updatedEmployees = recalculateAllExpirations(migrationResult.data.employees);

      // ⭐ NUEVO: Validación de integridad de datos
      console.log('🛡️ Ejecutando validación de integridad de datos...');
      const integrityReport = validateAllEmployees(updatedEmployees);

      if (integrityReport.criticalCount > 0 || integrityReport.errorCount > 0) {
        console.warn('⚠️ PROBLEMAS DE INTEGRIDAD DETECTADOS:');
        console.warn(`   🚨 Críticos: ${integrityReport.criticalCount}`);
        console.warn(`   ❌ Errores: ${integrityReport.errorCount}`);
        console.warn(`   ⚠️ Advertencias: ${integrityReport.warningCount}`);
        console.warn('');
        console.warn('🔧 Iniciando reparación automática de datos...');

        // Reparar empleados con problemas
        const { repaired, results } = smartRepair(updatedEmployees, 'auto');

        if (results.length > 0) {
          console.log('✅ Reparación completada:');
          console.log(generateRepairSummary(results));

          // Guardar datos reparados
          const repairedData = {
            ...migrationResult.data,
            employees: repaired
          };

          db.saveData(repairedData);

          // Validar nuevamente después de reparar
          const postRepairReport = validateAllEmployees(repaired);
          console.log('🔍 Validación post-reparación:');
          console.log(`   🚨 Críticos: ${postRepairReport.criticalCount}`);
          console.log(`   ❌ Errores: ${postRepairReport.errorCount}`);
          console.log(`   ⚠️ Advertencias: ${postRepairReport.warningCount}`);

          return repairedData;
        }
      } else {
        console.log('✅ Validación de integridad: Sin problemas detectados');
      }

      const finalData = {
        ...migrationResult.data,
        employees: updatedEmployees
      };

      // Si hubo cambios en las expiraciones, guardar automáticamente
      if (updatedEmployees !== migrationResult.data.employees) {
        db.saveData(finalData);
      }

      return finalData;
    } catch (error) {
      console.error('❌ Error al cargar datos:', error);
      alert('Error al cargar datos. Verifique la consola para más detalles.');
      // Retornar datos vacíos en caso de error crítico
      return {
        employees: [],
        records: [],
        config: { companyName: 'My Company', fiscalYearStart: '04-01' }
      };
    }
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
  approveRecord: (recordId: string, approvedBy?: string): { success: boolean; error?: string; code?: string } => {
    const data = db.loadData();
    const record = data.records.find(r => r.id === recordId);

    if (!record || record.status !== 'pending') {
      return { success: false, error: 'Record not found or not pending' };
    }

    const emp = data.employees.find(e => e.id === record.employeeId);

    // ⭐ NUEVO: Validar ANTES de aprobar
    const validation = canApproveLeave(emp, record);
    if (!validation.isValid) {
      console.warn('Approval blocked:', validation.code, validation.error);
      return { success: false, error: validation.error, code: validation.code };
    }

    // Aprobar record
    record.status = 'approved';
    record.approvedAt = new Date().toISOString();
    record.approvedBy = approvedBy || 'システム';

    // ⭐ NUEVO: Actualizar yukyuDates[] (BUG #4)
    if (record.type === 'paid' && emp) {
      // Asegurar que yukyuDates existe
      if (!emp.yukyuDates) {
        emp.yukyuDates = [];
      }

      // Agregar fecha si no existe (la validación ya verificó que no esté duplicada)
      if (!emp.yukyuDates.includes(record.date)) {
        emp.yukyuDates.push(record.date);
        emp.yukyuDates.sort(); // Mantener ordenado
      }

      // ⭐ NUEVO: Marcar como modificación local
      if (!emp.localModifications) {
        emp.localModifications = { approvedDates: [], manualAdjustments: 0 };
      }
      if (!emp.localModifications.approvedDates.includes(record.date)) {
        emp.localModifications.approvedDates.push(record.date);
      }

      // ⭐ NUEVO: Recalcular balance usando balanceCalculator
      const balance = getEmployeeBalance(emp);
      emp.grantedTotal = balance.granted;
      emp.usedTotal = balance.used;
      emp.balance = balance.remaining;
      emp.expiredCount = balance.expiredCount;

      // ⭐ NUEVO: Marcar record como sincronizado
      record.syncedToYukyuDates = true;
    }

    db.saveData(data);
    return { success: true };
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
  approveMultiple: (recordIds: string[], approvedBy?: string): { succeeded: string[]; failed: Array<{ recordId: string; reason: string; code?: string }> } => {
    const data = db.loadData();
    const results = {
      succeeded: [] as string[],
      failed: [] as Array<{ recordId: string; reason: string; code?: string }>
    };

    recordIds.forEach(recordId => {
      const record = data.records.find(r => r.id === recordId);

      if (!record || record.status !== 'pending') {
        results.failed.push({ recordId, reason: 'Record not found or not pending' });
        return;
      }

      const emp = data.employees.find(e => e.id === record.employeeId);

      // ⭐ NUEVO: Validar individualmente
      const validation = canApproveLeave(emp, record);
      if (!validation.isValid) {
        results.failed.push({
          recordId,
          reason: validation.error || 'Validation failed',
          code: validation.code
        });
        return;
      }

      // Aprobar (mismo código que approveRecord)
      record.status = 'approved';
      record.approvedAt = new Date().toISOString();
      record.approvedBy = approvedBy || 'システム';

      // ⭐ Actualizar yukyuDates[] y balance
      if (record.type === 'paid' && emp) {
        if (!emp.yukyuDates) {
          emp.yukyuDates = [];
        }

        if (!emp.yukyuDates.includes(record.date)) {
          emp.yukyuDates.push(record.date);
          emp.yukyuDates.sort();
        }

        if (!emp.localModifications) {
          emp.localModifications = { approvedDates: [], manualAdjustments: 0 };
        }
        if (!emp.localModifications.approvedDates.includes(record.date)) {
          emp.localModifications.approvedDates.push(record.date);
        }

        const balance = getEmployeeBalance(emp);
        emp.grantedTotal = balance.granted;
        emp.usedTotal = balance.used;
        emp.balance = balance.remaining;
        emp.expiredCount = balance.expiredCount;

        record.syncedToYukyuDates = true;
      }

      results.succeeded.push(recordId);
    });

    db.saveData(data);
    return results;
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
