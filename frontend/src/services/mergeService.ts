/**
 * Merge Service
 *
 * Servicio crítico para resolver BUG #1: Re-sync Excel sobrescribe aprobaciones.
 *
 * Responsabilidades:
 * - Detectar primera sync vs re-sync
 * - Merge inteligente: combinar fechas Excel + aprobaciones locales
 * - Detectar conflictos (Excel < local)
 * - Generar warnings para mostrar al usuario
 * - Preservar datos locales en re-import
 */

import { Employee, MergeResult } from '../types';

/**
 * Tipo de sincronización detectado
 */
export type SyncType = 'first_sync' | 're_sync';

/**
 * Tipo de conflicto detectado
 */
export interface Conflict {
  type: 'excel_has_fewer_dates' | 'date_mismatch' | 'balance_discrepancy';
  description: string;
  excelCount: number;
  localCount: number;
  diff: number;
}

/**
 * Detecta si es primera sincronización o re-sync
 */
export function detectSyncType(employee: Employee): SyncType {
  // Si no tiene lastExcelSync, es la primera vez
  if (!employee.lastExcelSync) {
    return 'first_sync';
  }

  return 're_sync';
}

/**
 * Mergea datos de Excel con datos locales del empleado
 *
 * Estrategia:
 * - Primera sync: Usar fechas del Excel completamente
 * - Re-sync: Combinar fechas Excel + aprobaciones locales, detectar conflictos
 *
 * @param excelData - Datos parciales importados desde Excel
 * @param localEmployee - Empleado existente en localStorage
 * @returns Resultado del merge con empleado actualizado, conflictos y warnings
 *
 * @example
 * const result = mergeExcelData(excelEmployee, localEmployee);
 * if (result.conflicts.length > 0) {
 *   console.warn('Conflictos detectados:', result.conflicts);
 * }
 */
export function mergeExcelData(
  excelData: Partial<Employee>,
  localEmployee: Employee
): MergeResult {
  const syncType = detectSyncType(localEmployee);
  const conflicts: string[] = [];
  const warnings: string[] = [];

  // Datos base del empleado (campos que vienen del Excel)
  const baseEmployee: Employee = {
    ...localEmployee,
    // Actualizar campos del Excel (preservar local si Excel no tiene el campo)
    name: excelData.name !== undefined ? excelData.name : localEmployee.name,
    nameKana: excelData.nameKana !== undefined ? excelData.nameKana : localEmployee.nameKana,
    client: excelData.client !== undefined ? excelData.client : localEmployee.client,
    category: excelData.category !== undefined ? excelData.category : localEmployee.category,
    entryDate: excelData.entryDate !== undefined ? excelData.entryDate : localEmployee.entryDate,
    status: excelData.status !== undefined ? excelData.status : localEmployee.status,

    // ⭐ NUEVO: Preservar periodHistory y campos de expiración
    periodHistory: excelData.periodHistory !== undefined ? excelData.periodHistory : localEmployee.periodHistory,

    // ⭐ NUEVO: Valores ACTUALES (períodos vigentes)
    currentGrantedTotal: excelData.currentGrantedTotal !== undefined ? excelData.currentGrantedTotal : localEmployee.currentGrantedTotal,
    currentUsedTotal: excelData.currentUsedTotal !== undefined ? excelData.currentUsedTotal : localEmployee.currentUsedTotal,
    currentBalance: excelData.currentBalance !== undefined ? excelData.currentBalance : localEmployee.currentBalance,
    currentExpiredCount: excelData.currentExpiredCount !== undefined ? excelData.currentExpiredCount : localEmployee.currentExpiredCount,

    // ⭐ NUEVO: Valores HISTÓRICOS (todos los períodos)
    historicalGrantedTotal: excelData.historicalGrantedTotal !== undefined ? excelData.historicalGrantedTotal : localEmployee.historicalGrantedTotal,
    historicalUsedTotal: excelData.historicalUsedTotal !== undefined ? excelData.historicalUsedTotal : localEmployee.historicalUsedTotal,
    historicalBalance: excelData.historicalBalance !== undefined ? excelData.historicalBalance : localEmployee.historicalBalance,
    historicalExpiredCount: excelData.historicalExpiredCount !== undefined ? excelData.historicalExpiredCount : localEmployee.historicalExpiredCount,

    // Campos calculados - se actualizarán después del merge de fechas
    grantedTotal: excelData.grantedTotal !== undefined ? excelData.grantedTotal : localEmployee.grantedTotal,
    carryOver: excelData.carryOver !== undefined ? excelData.carryOver : localEmployee.carryOver,
    totalAvailable: excelData.totalAvailable !== undefined ? excelData.totalAvailable : localEmployee.totalAvailable,
    expiredCount: excelData.expiredCount !== undefined ? excelData.expiredCount : localEmployee.expiredCount,

    // lastSync siempre se actualiza
    lastSync: new Date().toISOString()
  };

  // CRÍTICO: Merge de yukyuDates[]
  const excelDates = excelData.yukyuDates || [];
  const localDates = localEmployee.yukyuDates || [];
  const localApprovals = localEmployee.localModifications?.approvedDates || [];

  let finalYukyuDates: string[];

  if (syncType === 'first_sync') {
    // ==========================================
    // PRIMERA SYNC: Importar todo del Excel
    // ==========================================
    finalYukyuDates = [...excelDates];

    console.log(`📥 Primera sincronización para ${localEmployee.name}:`);
    console.log(`   Importando ${excelDates.length} fechas del Excel`);
  } else {
    // ==========================================
    // RE-SYNC: Merge inteligente
    // ==========================================
    console.log(`🔄 Re-sincronización para ${localEmployee.name}:`);
    console.log(`   Excel: ${excelDates.length} fechas`);
    console.log(`   Local: ${localDates.length} fechas (${localApprovals.length} aprobaciones locales)`);

    // Combinar todas las fechas únicas
    const allDates = new Set([...excelDates, ...localApprovals]);
    finalYukyuDates = Array.from(allDates);

    // DETECCIÓN DE CONFLICTOS
    // Conflicto #1: Excel tiene menos fechas que local
    if (excelDates.length < localDates.length) {
      const diff = localDates.length - excelDates.length;
      const conflict = `⚠️ Excel tiene ${diff} fecha(s) menos que los datos locales`;
      conflicts.push(conflict);
      warnings.push(conflict);

      console.warn(conflict);
      console.warn(`   Preservando ${localApprovals.length} aprobaciones locales`);
    }

    // Conflicto #2: Fechas que están en local pero NO en Excel
    const missingInExcel = localDates.filter(d => !excelDates.includes(d));
    if (missingInExcel.length > 0) {
      const conflict = `ℹ️ ${missingInExcel.length} fecha(s) local no encontrada(s) en Excel (probablemente aprobaciones locales)`;
      warnings.push(conflict);

      console.log(`   Fechas locales preservadas: ${missingInExcel.slice(0, 3).join(', ')}${missingInExcel.length > 3 ? '...' : ''}`);
    }

    // Conflicto #3: Balance discrepancia
    if (excelData.balance !== undefined && localEmployee.balance !== undefined) {
      const balanceDiff = Math.abs(excelData.balance - localEmployee.balance);
      if (balanceDiff > 0) {
        const warning = `⚠️ Discrepancia de balance: Excel=${excelData.balance}, Local=${localEmployee.balance} (diff=${balanceDiff})`;
        warnings.push(warning);
        console.warn(warning);
      }
    }

    console.log(`   Resultado: ${finalYukyuDates.length} fechas totales después del merge`);
  }

  // Ordenar fechas
  finalYukyuDates.sort();

  // Crear empleado actualizado
  const mergedEmployee: Employee = {
    ...baseEmployee,
    yukyuDates: finalYukyuDates,

    // ⭐ NUEVO: Actualizar lastExcelSync
    lastExcelSync: new Date().toISOString(),

    // ⭐ NUEVO: Preservar localModifications
    localModifications: syncType === 're_sync'
      ? localEmployee.localModifications
      : { approvedDates: [], manualAdjustments: 0 }
  };

  // El balance se recalculará después usando balanceCalculator en ExcelSync

  return {
    employee: mergedEmployee,
    conflicts,
    warnings
  };
}

/**
 * Valida la integridad del merge
 */
export function validateMerge(result: MergeResult): boolean {
  const { employee, conflicts } = result;

  // Validación 1: yukyuDates debe existir
  if (!employee.yukyuDates) {
    console.error('❌ Error de merge: yukyuDates no existe');
    return false;
  }

  // Validación 2: No debe haber fechas duplicadas
  const uniqueDates = new Set(employee.yukyuDates);
  if (uniqueDates.size !== employee.yukyuDates.length) {
    console.error('❌ Error de merge: Fechas duplicadas encontradas');
    return false;
  }

  // Validación 3: Fechas deben estar ordenadas
  const sorted = [...employee.yukyuDates].sort();
  const isOrdered = employee.yukyuDates.every((date, i) => date === sorted[i]);
  if (!isOrdered) {
    console.warn('⚠️ Advertencia: yukyuDates no está ordenado (se corregirá)');
    employee.yukyuDates = sorted;
  }

  return true;
}

/**
 * Genera un resumen de cambios después del merge
 */
export function getMergeSummary(
  oldEmployee: Employee,
  newEmployee: Employee
): string {
  const oldDates = oldEmployee.yukyuDates?.length || 0;
  const newDates = newEmployee.yukyuDates?.length || 0;
  const diff = newDates - oldDates;

  const parts: string[] = [];

  parts.push(`👤 ${newEmployee.name}`);
  parts.push(`   Fechas: ${oldDates} → ${newDates} (${diff >= 0 ? '+' : ''}${diff})`);

  if (newEmployee.status !== oldEmployee.status) {
    parts.push(`   Estado: ${oldEmployee.status} → ${newEmployee.status}`);
  }

  if (newEmployee.client !== oldEmployee.client) {
    parts.push(`   Cliente: ${oldEmployee.client} → ${newEmployee.client}`);
  }

  return parts.join('\n');
}

/**
 * Función de utilidad para debugging
 */
export function debugMerge(
  excelData: Partial<Employee>,
  localEmployee: Employee
): void {
  console.log('=== DEBUG MERGE ===');
  console.log('Empleado:', localEmployee.name);
  console.log('Tipo de sync:', detectSyncType(localEmployee));
  console.log('Excel yukyuDates:', excelData.yukyuDates?.length || 0);
  console.log('Local yukyuDates:', localEmployee.yukyuDates?.length || 0);
  console.log('Local approvals:', localEmployee.localModifications?.approvedDates.length || 0);
  console.log('==================');
}
