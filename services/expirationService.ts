/**
 * Expiration Service
 *
 * Servicio para recalcular automáticamente las expiraciones de yukyus
 * sin necesidad de re-importar el Excel.
 *
 * Responsabilidades:
 * - Recalcular isExpired para cada período basándose en fecha actual
 * - Recalcular valores currentXXX (períodos vigentes)
 * - Recalcular valores historicalXXX (todos los períodos)
 * - Actualizar campos legacy para backward compatibility
 */

import { Employee, PeriodHistory } from '../types';

/**
 * Recalcula las expiraciones de un empleado basándose en la fecha actual
 *
 * @param employee - Empleado con periodHistory
 * @returns Empleado con valores actualizados
 */
export function recalculateExpiration(employee: Employee): Employee {
  // Si no tiene periodHistory, retornar sin cambios
  if (!employee.periodHistory || employee.periodHistory.length === 0) {
    return employee;
  }

  const now = new Date();

  // ⭐ PASO 1: Recalcular isExpired para cada período
  const updatedPeriodHistory: PeriodHistory[] = employee.periodHistory.map(period => {
    // Convertir expiryDate a Date si es string
    const expiryDate = typeof period.expiryDate === 'string'
      ? new Date(period.expiryDate)
      : period.expiryDate;

    // ⭐ CONFIAR en 時効数 del Excel como fuente primaria
    // Si expired > 0, el período YA está expirado según el Excel
    // Si expired === 0, verificar si la fecha de expiración ya pasó
    const isExpired = period.expired > 0 || now >= expiryDate;

    return {
      ...period,
      isExpired,
      // Convertir Date objects a ISOString para almacenamiento
      grantDate: typeof period.grantDate === 'string'
        ? period.grantDate
        : period.grantDate.toISOString(),
      expiryDate: typeof period.expiryDate === 'string'
        ? period.expiryDate
        : period.expiryDate.toISOString()
    } as PeriodHistory;
  });

  // ⭐ PASO 2: Calcular valores ACTUALES (solo períodos vigentes)
  const currentPeriods = updatedPeriodHistory.filter(p => !p.isExpired);
  const currentGrantedTotal = currentPeriods.reduce((sum, p) => sum + p.granted, 0);
  const currentUsedTotal = currentPeriods.reduce((sum, p) => sum + p.used, 0);
  const currentBalance = currentPeriods.reduce((sum, p) => sum + p.balance, 0);
  const currentExpiredCount = 0; // Los períodos actuales nunca tienen expirados

  // ⭐ PASO 3: Calcular valores HISTÓRICOS (todos los períodos)
  const historicalGrantedTotal = updatedPeriodHistory.reduce((sum, p) => sum + p.granted, 0);
  const historicalUsedTotal = updatedPeriodHistory.reduce((sum, p) => sum + p.used, 0);
  const historicalBalance = updatedPeriodHistory.reduce((sum, p) => sum + p.balance, 0);
  const historicalExpiredCount = updatedPeriodHistory.reduce((sum, p) => sum + p.expired, 0);

  // ⭐ PASO 4: Actualizar empleado con valores recalculados
  return {
    ...employee,
    periodHistory: updatedPeriodHistory,

    // Valores ACTUALES
    currentGrantedTotal,
    currentUsedTotal,
    currentBalance,
    currentExpiredCount,

    // Valores HISTÓRICOS
    historicalGrantedTotal,
    historicalUsedTotal,
    historicalBalance,
    historicalExpiredCount,

    // ⭐ LEGACY: Actualizar campos legacy para backward compatibility
    grantedTotal: currentGrantedTotal,
    usedTotal: historicalUsedTotal,
    balance: currentBalance,
    expiredCount: historicalExpiredCount,

    // Actualizar timestamp
    lastSync: new Date().toISOString()
  };
}

/**
 * Recalcula expiraciones para todos los empleados
 *
 * @param employees - Array de empleados
 * @returns Array de empleados con valores actualizados
 */
export function recalculateAllExpirations(employees: Employee[]): Employee[] {
  let recalculatedCount = 0;
  let totalPeriodsExpired = 0;

  const updated = employees.map(emp => {
    // Solo recalcular si tiene periodHistory
    if (!emp.periodHistory || emp.periodHistory.length === 0) {
      return emp;
    }

    const oldExpiredPeriods = emp.periodHistory.filter(p => p.isExpired).length;
    const recalculated = recalculateExpiration(emp);
    const newExpiredPeriods = recalculated.periodHistory!.filter(p => p.isExpired).length;

    if (oldExpiredPeriods !== newExpiredPeriods) {
      recalculatedCount++;
      totalPeriodsExpired += (newExpiredPeriods - oldExpiredPeriods);
      console.log(`🔄 ${emp.name}: ${oldExpiredPeriods} → ${newExpiredPeriods} períodos expirados`);
    }

    return recalculated;
  });

  if (recalculatedCount > 0) {
    console.log(`✅ Recálculo automático: ${recalculatedCount} empleados actualizados, ${totalPeriodsExpired} períodos expirados`);
  }

  return updated;
}

/**
 * Verifica si un empleado necesita recálculo
 * (útil para optimización)
 */
export function needsRecalculation(employee: Employee): boolean {
  if (!employee.periodHistory || employee.periodHistory.length === 0) {
    return false;
  }

  const now = new Date();

  // Verificar si algún período tiene estado de expiración incorrecto
  return employee.periodHistory.some(period => {
    const expiryDate = typeof period.expiryDate === 'string'
      ? new Date(period.expiryDate)
      : period.expiryDate;

    const shouldBeExpired = period.expired > 0 || now >= expiryDate;
    return shouldBeExpired !== period.isExpired;
  });
}

/**
 * Obtiene resumen de períodos de un empleado
 * (útil para debugging)
 */
export function getExpirationSummary(employee: Employee): string {
  if (!employee.periodHistory || employee.periodHistory.length === 0) {
    return 'Sin historial de períodos';
  }

  const total = employee.periodHistory.length;
  const expired = employee.periodHistory.filter(p => p.isExpired).length;
  const active = total - expired;

  return `${employee.name}: ${total} períodos (${active} vigentes, ${expired} expirados)`;
}
