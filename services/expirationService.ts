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
  // ⭐ PASO 0: Generar nuevos períodos automáticamente si es necesario
  const newPeriods = generateNewPeriods(employee);

  if (newPeriods.length > 0) {
    console.log(`🆕 ${employee.name}: Generando ${newPeriods.length} nuevo(s) período(s) automáticamente`);
    newPeriods.forEach(p => {
      console.log(`   → ${p.periodName} (${p.elapsedMonths}m): ${p.granted}日, expira ${p.expiryDate.split('T')[0]}`);
    });
  }

  // Combinar períodos existentes + nuevos períodos generados
  const allPeriods = [...(employee.periodHistory || []), ...newPeriods];

  // Si no hay períodos después de intentar generar, retornar sin cambios
  if (allPeriods.length === 0) {
    return employee;
  }

  const now = new Date();

  // ⭐ PASO 1: Recalcular isExpired para cada período
  const updatedPeriodHistory: PeriodHistory[] = allPeriods.map(period => {
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
  const rawCurrentBalance = currentPeriods.reduce((sum, p) => sum + p.balance, 0);

  // ⭐ NUEVO: Aplicar límite legal de 40 días (労働基準法第115条)
  const LEGAL_MAX_BALANCE = 40;
  const currentBalance = Math.min(rawCurrentBalance, LEGAL_MAX_BALANCE);
  const excededDays = rawCurrentBalance > LEGAL_MAX_BALANCE ? rawCurrentBalance - LEGAL_MAX_BALANCE : 0;

  if (excededDays > 0) {
    console.warn(`⚠️ ${employee.name}: Balance excede límite legal (${rawCurrentBalance}日 > 40日). Exceso: ${excededDays}日 se pierden por 時効.`);
  }

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
    currentBalance, // ⭐ LIMITADO A 40日 máximo por ley
    currentExpiredCount,
    excededDays, // ⭐ Días que exceden el límite legal (se pierden)

    // Valores HISTÓRICOS
    historicalGrantedTotal,
    historicalUsedTotal,
    historicalBalance,
    historicalExpiredCount,

    // ⭐ LEGACY: Actualizar campos legacy para backward compatibility
    grantedTotal: currentGrantedTotal,
    usedTotal: historicalUsedTotal,
    balance: currentBalance, // ⭐ LIMITADO A 40日
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

/**
 * Tabla de otorgamiento de yukyus según ley japonesa
 * Basada en 労働基準法39条
 */
const YUKYU_GRANT_TABLE = [
  { elapsedMonths: 6, granted: 10, periodName: '初回(6ヶ月)' },      // 6 meses
  { elapsedMonths: 18, granted: 11, periodName: '1年6ヶ月' },       // 1.5 años
  { elapsedMonths: 30, granted: 12, periodName: '2年6ヶ月' },       // 2.5 años
  { elapsedMonths: 42, granted: 14, periodName: '3年6ヶ月' },       // 3.5 años
  { elapsedMonths: 54, granted: 16, periodName: '4年6ヶ月' },       // 4.5 años
  { elapsedMonths: 66, granted: 18, periodName: '5年6ヶ月' },       // 5.5 años
  { elapsedMonths: 78, granted: 20, periodName: '6年6ヶ月' },       // 6.5 años
];

/**
 * Genera nuevos períodos automáticamente según el tiempo transcurrido
 *
 * @param employee - Empleado con entryDate
 * @returns Nuevos períodos generados (si los hay)
 */
export function generateNewPeriods(employee: Employee): PeriodHistory[] {
  // Verificar que tenga fecha de entrada
  if (!employee.entryDate) {
    return [];
  }

  const now = new Date();
  const entryDate = new Date(employee.entryDate);

  // Calcular meses transcurridos desde la entrada
  const monthsFromEntry = (now.getFullYear() - entryDate.getFullYear()) * 12 +
                          (now.getMonth() - entryDate.getMonth());

  // Obtener períodos que YA existen
  const existingElapsedMonths = (employee.periodHistory || [])
    .map(p => p.elapsedMonths)
    .sort((a, b) => a - b);

  // Determinar qué períodos DEBERÍAN existir según la tabla
  const periodsToGenerate: PeriodHistory[] = [];

  YUKYU_GRANT_TABLE.forEach((grant, index) => {
    // Si ya pasó el tiempo para este período Y aún no existe
    if (monthsFromEntry >= grant.elapsedMonths && !existingElapsedMonths.includes(grant.elapsedMonths)) {

      // Calcular fechas
      const grantDate = new Date(entryDate);
      grantDate.setMonth(grantDate.getMonth() + grant.elapsedMonths);

      const expiryDate = new Date(grantDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);

      // Determinar si ya expiró
      const isExpired = now >= expiryDate;

      // Obtener el siguiente index para periodIndex
      const maxExistingIndex = Math.max(-1, ...(employee.periodHistory || []).map(p => p.periodIndex));
      const newIndex = maxExistingIndex + periodsToGenerate.length + 1;

      periodsToGenerate.push({
        periodIndex: newIndex,
        periodName: grant.periodName,
        elapsedMonths: grant.elapsedMonths,
        yukyuStartDate: grantDate.toISOString().split('T')[0],
        grantDate: grantDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        granted: grant.granted,
        used: 0, // Nuevo período sin uso
        balance: grant.granted, // Balance inicial = granted
        expired: 0, // Nuevo período no tiene expirados
        carryOver: 0,
        isExpired,
        isCurrentPeriod: !isExpired && Math.abs(grant.elapsedMonths - monthsFromEntry) <= 6,
        yukyuDates: [], // Sin fechas consumidas
        source: 'excel', // Se marca como excel para consistencia
        syncedAt: now.toISOString()
      });
    }
  });

  // Si generamos períodos después del último de la tabla, continuar con 20 días
  const lastTableEntry = YUKYU_GRANT_TABLE[YUKYU_GRANT_TABLE.length - 1];
  if (monthsFromEntry > lastTableEntry.elapsedMonths) {
    // Generar períodos cada 12 meses después del último de la tabla
    let currentMonths = lastTableEntry.elapsedMonths + 12;
    const maxExistingIndex = Math.max(-1, ...(employee.periodHistory || []).map(p => p.periodIndex));
    let newIndexCounter = maxExistingIndex + periodsToGenerate.length + 1;

    while (currentMonths <= monthsFromEntry) {
      if (!existingElapsedMonths.includes(currentMonths)) {
        const grantDate = new Date(entryDate);
        grantDate.setMonth(grantDate.getMonth() + currentMonths);

        const expiryDate = new Date(grantDate);
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);

        const isExpired = now >= expiryDate;
        const years = Math.floor(currentMonths / 12);
        const months = currentMonths % 12;
        const periodName = months > 0 ? `${years}年${months}ヶ月` : `${years}年`;

        periodsToGenerate.push({
          periodIndex: newIndexCounter++,
          periodName,
          elapsedMonths: currentMonths,
          yukyuStartDate: grantDate.toISOString().split('T')[0],
          grantDate: grantDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          granted: 20, // Después de 6.5 años siempre son 20 días
          used: 0,
          balance: 20,
          expired: 0,
          carryOver: 0,
          isExpired,
          isCurrentPeriod: !isExpired && Math.abs(currentMonths - monthsFromEntry) <= 6,
          yukyuDates: [],
          source: 'excel',
          syncedAt: now.toISOString()
        });
      }
      currentMonths += 12;
    }
  }

  return periodsToGenerate;
}
