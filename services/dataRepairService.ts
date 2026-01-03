/**
 * Data Repair Service
 *
 * Repara automáticamente datos inconsistentes o corruptos
 * recalculando valores desde la fuente de verdad (periodHistory).
 *
 * Garantiza integridad de datos en producción empresarial.
 */

import { Employee } from '../types';

export interface RepairAction {
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

export interface RepairResult {
  employeeId: string;
  employeeName: string;
  wasRepaired: boolean;
  actions: RepairAction[];
  employee: Employee;
}

/**
 * Repara los datos de un empleado recalculando desde periodHistory
 *
 * @param employee - Empleado a reparar
 * @returns Resultado de la reparación con empleado corregido
 */
export function repairEmployeeData(employee: Employee): RepairResult {
  const actions: RepairAction[] = [];
  let repairedEmployee = { ...employee };

  // Si no hay periodHistory, no podemos reparar
  if (!repairedEmployee.periodHistory || repairedEmployee.periodHistory.length === 0) {
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      wasRepaired: false,
      actions: [],
      employee: repairedEmployee
    };
  }

  const now = new Date();

  // ═══════════════════════════════════════════════════════
  // RECALCULAR VALORES ACTUALES (current)
  // ═══════════════════════════════════════════════════════

  const currentPeriods = repairedEmployee.periodHistory.filter(p => {
    const expiryDate = typeof p.expiryDate === 'string'
      ? new Date(p.expiryDate)
      : p.expiryDate;

    // Periodo vigente si:
    // 1. No ha expirado según fecha
    // 2. No tiene días expirados según Excel (expired = 0)
    return now < expiryDate && p.expired === 0;
  });

  // Calcular granted total de períodos vigentes
  const calculatedCurrentGranted = currentPeriods.reduce((sum, p) => sum + p.granted, 0);

  if (repairedEmployee.currentGrantedTotal !== calculatedCurrentGranted) {
    actions.push({
      field: 'currentGrantedTotal',
      oldValue: repairedEmployee.currentGrantedTotal,
      newValue: calculatedCurrentGranted,
      reason: `Recalculado desde ${currentPeriods.length} períodos vigentes`
    });
    repairedEmployee.currentGrantedTotal = calculatedCurrentGranted;
  }

  // Calcular used total de períodos vigentes
  const calculatedCurrentUsed = currentPeriods.reduce((sum, p) => sum + p.used, 0);

  if (repairedEmployee.currentUsedTotal !== calculatedCurrentUsed) {
    actions.push({
      field: 'currentUsedTotal',
      oldValue: repairedEmployee.currentUsedTotal,
      newValue: calculatedCurrentUsed,
      reason: `Recalculado desde ${currentPeriods.length} períodos vigentes`
    });
    repairedEmployee.currentUsedTotal = calculatedCurrentUsed;
  }

  // Calcular balance (raw, sin límite legal aún)
  const rawCurrentBalance = currentPeriods.reduce((sum, p) => sum + p.balance, 0);

  // Aplicar límite legal de 40 días
  const LEGAL_MAX_BALANCE = 40;
  const calculatedCurrentBalance = Math.min(rawCurrentBalance, LEGAL_MAX_BALANCE);
  const calculatedExcededDays = rawCurrentBalance > LEGAL_MAX_BALANCE
    ? rawCurrentBalance - LEGAL_MAX_BALANCE
    : 0;

  if (repairedEmployee.currentBalance !== calculatedCurrentBalance) {
    actions.push({
      field: 'currentBalance',
      oldValue: repairedEmployee.currentBalance,
      newValue: calculatedCurrentBalance,
      reason: rawCurrentBalance > LEGAL_MAX_BALANCE
        ? `Aplicado límite legal 40日 (raw: ${rawCurrentBalance})`
        : `Recalculado desde ${currentPeriods.length} períodos vigentes`
    });
    repairedEmployee.currentBalance = calculatedCurrentBalance;
  }

  if (repairedEmployee.excededDays !== calculatedExcededDays) {
    actions.push({
      field: 'excededDays',
      oldValue: repairedEmployee.excededDays,
      newValue: calculatedExcededDays,
      reason: calculatedExcededDays > 0
        ? `${calculatedExcededDays}日 exceden límite legal de 40日`
        : 'Dentro del límite legal'
    });
    repairedEmployee.excededDays = calculatedExcededDays;
  }

  // currentExpiredCount siempre es 0 para períodos actuales
  if (repairedEmployee.currentExpiredCount !== 0) {
    actions.push({
      field: 'currentExpiredCount',
      oldValue: repairedEmployee.currentExpiredCount,
      newValue: 0,
      reason: 'Períodos actuales no tienen expirados'
    });
    repairedEmployee.currentExpiredCount = 0;
  }

  // ═══════════════════════════════════════════════════════
  // RECALCULAR VALORES HISTÓRICOS (historical)
  // ═══════════════════════════════════════════════════════

  const allPeriods = repairedEmployee.periodHistory;

  const calculatedHistoricalGranted = allPeriods.reduce((sum, p) => sum + p.granted, 0);

  if (repairedEmployee.historicalGrantedTotal !== calculatedHistoricalGranted) {
    actions.push({
      field: 'historicalGrantedTotal',
      oldValue: repairedEmployee.historicalGrantedTotal,
      newValue: calculatedHistoricalGranted,
      reason: `Suma de todos los ${allPeriods.length} períodos`
    });
    repairedEmployee.historicalGrantedTotal = calculatedHistoricalGranted;
  }

  const calculatedHistoricalUsed = allPeriods.reduce((sum, p) => sum + p.used, 0);

  if (repairedEmployee.historicalUsedTotal !== calculatedHistoricalUsed) {
    actions.push({
      field: 'historicalUsedTotal',
      oldValue: repairedEmployee.historicalUsedTotal,
      newValue: calculatedHistoricalUsed,
      reason: `Suma de todos los ${allPeriods.length} períodos`
    });
    repairedEmployee.historicalUsedTotal = calculatedHistoricalUsed;
  }

  const calculatedHistoricalBalance = allPeriods.reduce((sum, p) => sum + p.balance, 0);

  if (repairedEmployee.historicalBalance !== calculatedHistoricalBalance) {
    actions.push({
      field: 'historicalBalance',
      oldValue: repairedEmployee.historicalBalance,
      newValue: calculatedHistoricalBalance,
      reason: `Suma de todos los ${allPeriods.length} períodos`
    });
    repairedEmployee.historicalBalance = calculatedHistoricalBalance;
  }

  const calculatedHistoricalExpired = allPeriods.reduce((sum, p) => sum + p.expired, 0);

  if (repairedEmployee.historicalExpiredCount !== calculatedHistoricalExpired) {
    actions.push({
      field: 'historicalExpiredCount',
      oldValue: repairedEmployee.historicalExpiredCount,
      newValue: calculatedHistoricalExpired,
      reason: `Suma de días expirados de todos los ${allPeriods.length} períodos`
    });
    repairedEmployee.historicalExpiredCount = calculatedHistoricalExpired;
  }

  // ═══════════════════════════════════════════════════════
  // ACTUALIZAR CAMPOS LEGACY (backward compatibility)
  // ═══════════════════════════════════════════════════════

  if (repairedEmployee.grantedTotal !== calculatedCurrentGranted) {
    actions.push({
      field: 'grantedTotal (legacy)',
      oldValue: repairedEmployee.grantedTotal,
      newValue: calculatedCurrentGranted,
      reason: 'Sincronizar con currentGrantedTotal'
    });
    repairedEmployee.grantedTotal = calculatedCurrentGranted;
  }

  if (repairedEmployee.usedTotal !== calculatedHistoricalUsed) {
    actions.push({
      field: 'usedTotal (legacy)',
      oldValue: repairedEmployee.usedTotal,
      newValue: calculatedHistoricalUsed,
      reason: 'Sincronizar con historicalUsedTotal'
    });
    repairedEmployee.usedTotal = calculatedHistoricalUsed;
  }

  if (repairedEmployee.balance !== calculatedCurrentBalance) {
    actions.push({
      field: 'balance (legacy)',
      oldValue: repairedEmployee.balance,
      newValue: calculatedCurrentBalance,
      reason: 'Sincronizar con currentBalance'
    });
    repairedEmployee.balance = calculatedCurrentBalance;
  }

  if (repairedEmployee.expiredCount !== calculatedHistoricalExpired) {
    actions.push({
      field: 'expiredCount (legacy)',
      oldValue: repairedEmployee.expiredCount,
      newValue: calculatedHistoricalExpired,
      reason: 'Sincronizar con historicalExpiredCount'
    });
    repairedEmployee.expiredCount = calculatedHistoricalExpired;
  }

  // ═══════════════════════════════════════════════════════
  // ACTUALIZAR TIMESTAMP
  // ═══════════════════════════════════════════════════════

  if (actions.length > 0) {
    repairedEmployee.lastSync = new Date().toISOString();
  }

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    wasRepaired: actions.length > 0,
    actions,
    employee: repairedEmployee
  };
}

/**
 * Repara todos los empleados que tienen periodHistory
 *
 * @param employees - Array de empleados
 * @returns Array de resultados de reparación
 */
export function repairAllEmployees(employees: Employee[]): RepairResult[] {
  return employees
    .map(repairEmployeeData)
    .filter(result => result.wasRepaired); // Solo retornar los que fueron reparados
}

/**
 * Genera resumen legible de las reparaciones realizadas
 */
export function generateRepairSummary(results: RepairResult[]): string {
  const totalRepaired = results.length;

  if (totalRepaired === 0) {
    return '✅ No se requirieron reparaciones';
  }

  const lines = [
    '═══════════════════════════════════════════════════════',
    '🔧 REPORTE DE REPARACIÓN DE DATOS - YUKYU PRO',
    '═══════════════════════════════════════════════════════',
    '',
    `📊 Total empleados reparados: ${totalRepaired}`,
    ''
  ];

  results.forEach((result, idx) => {
    lines.push(`${idx + 1}. ${result.employeeName} (${result.employeeId})`);
    lines.push(`   Acciones realizadas: ${result.actions.length}`);

    result.actions.forEach(action => {
      const oldStr = action.oldValue !== undefined ? action.oldValue : 'undefined';
      const newStr = action.newValue !== undefined ? action.newValue : 'undefined';

      lines.push(`   - ${action.field}: ${oldStr} → ${newStr}`);
      lines.push(`     Razón: ${action.reason}`);
    });

    lines.push('');
  });

  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Modo de reparación: automático vs conservador
 */
export type RepairMode = 'auto' | 'conservative';

/**
 * Repara empleados según el modo especificado
 *
 * @param employees - Empleados a reparar
 * @param mode - 'auto' repara todo, 'conservative' solo críticos
 */
export function smartRepair(
  employees: Employee[],
  mode: RepairMode = 'auto'
): { repaired: Employee[], results: RepairResult[] } {
  const results = mode === 'auto'
    ? repairAllEmployees(employees)
    : repairAllEmployees(employees).filter(r =>
      r.actions.some(a => a.field.includes('current'))
    );

  // Crear mapa de empleados reparados
  const repairedMap = new Map(results.map(r => [r.employeeId, r.employee]));

  // Merge: usar reparado si existe, sino original
  const repaired = employees.map(emp =>
    repairedMap.has(emp.id) ? repairedMap.get(emp.id)! : emp
  );

  return { repaired, results };
}
