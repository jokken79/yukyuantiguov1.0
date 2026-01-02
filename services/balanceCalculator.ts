/**
 * Balance Calculator Service
 *
 * Servicio centralizado para cálculo de balance de vacaciones según
 * la Ley de Normas Laborales de Japón (労働基準法39条).
 *
 * Responsabilidades:
 * - Calcular días otorgados basados en períodos de aniversario
 * - Calcular días consumidos desde yukyuDates[]
 * - Calcular días expirados (2 años desde la fecha de otorgamiento)
 * - Proveer balance consistente en toda la aplicación
 */

import { Employee } from '../types';

/**
 * Información de balance calculada
 */
export interface BalanceInfo {
  granted: number;      // Días otorgados totales (no expirados)
  used: number;         // Días consumidos
  remaining: number;    // Balance restante (granted - used)
  expiredCount: number; // Días que expiraron (時効)
}

/**
 * Información detallada de un período de vacaciones
 */
export interface PeriodInfo {
  periodIndex: number;
  periodName: string;
  grantDate: Date;
  expiryDate: Date;
  daysGranted: number;
  daysUsed: number;
  isExpired: boolean;
  isCurrentPeriod: boolean;
}

/**
 * Tabla legal de días otorgados según 労働基準法39条
 * - 6ヶ月: 10日
 * - 1年6ヶ月: 11日
 * - 2年6ヶ月: 12日
 * - 3年6ヶ月: 14日
 * - 4年6ヶ月: 16日
 * - 5年6ヶ月: 18日
 * - 6年6ヶ月以上: 20日
 */
const LEGAL_GRANT_TABLE: { months: number; days: number }[] = [
  { months: 6, days: 10 },    // 6ヶ月
  { months: 18, days: 11 },   // 1年6ヶ月
  { months: 30, days: 12 },   // 2年6ヶ月
  { months: 42, days: 14 },   // 3年6ヶ月
  { months: 54, days: 16 },   // 4年6ヶ月
  { months: 66, days: 18 },   // 5年6ヶ月
  { months: 78, days: 20 },   // 6年6ヶ月以上
];

/**
 * Calcula el índice del período de grant basado en meses desde la entrada
 */
function getGrantPeriodIndex(monthsFromEntry: number): number {
  if (monthsFromEntry < 6) return -1; // Antes de la primera asignación

  // Encontrar el período correspondiente (de más alto a más bajo)
  for (let i = LEGAL_GRANT_TABLE.length - 1; i >= 0; i--) {
    if (monthsFromEntry >= LEGAL_GRANT_TABLE[i].months) {
      return i;
    }
  }
  return 0;
}

/**
 * Calcula la fecha de grant para un período específico
 */
function getGrantDate(entryDate: Date, periodIndex: number): Date {
  const grantDate = new Date(entryDate);
  grantDate.setMonth(grantDate.getMonth() + LEGAL_GRANT_TABLE[periodIndex].months);
  return grantDate;
}

/**
 * Calcula el período de grant para una fecha específica
 */
function getGrantPeriodForDate(date: Date, entryDate: Date): number {
  const diffMonths = (date.getFullYear() - entryDate.getFullYear()) * 12 +
                     (date.getMonth() - entryDate.getMonth());
  return getGrantPeriodIndex(diffMonths);
}

/**
 * Genera el nombre del período (e.g., "初回(6ヶ月)", "2年6ヶ月")
 */
function getPeriodName(periodIndex: number): string {
  const monthsFromEntry = LEGAL_GRANT_TABLE[periodIndex].months;
  if (monthsFromEntry === 6) {
    return '初回(6ヶ月)';
  }
  const years = Math.floor(monthsFromEntry / 12);
  const months = monthsFromEntry % 12;
  return `${years}年${months > 0 ? months + 'ヶ月' : ''}`;
}

/**
 * Calcula todos los períodos de vacaciones para un empleado
 */
export function getEmployeePeriods(employee: Employee): PeriodInfo[] {
  if (!employee.entryDate) {
    return [];
  }

  const now = new Date();
  const entryDate = new Date(employee.entryDate);
  const yukyuDates = employee.yukyuDates || [];

  // Calcular período actual del empleado
  const monthsFromEntry = (now.getFullYear() - entryDate.getFullYear()) * 12 +
                          (now.getMonth() - entryDate.getMonth());
  const currentPeriodIndex = getGrantPeriodIndex(monthsFromEntry);

  if (currentPeriodIndex < 0) {
    // Empleado todavía no ha alcanzado los 6 meses
    return [];
  }

  // Agrupar fechas por período
  const datesByPeriod: Map<number, string[]> = new Map();

  yukyuDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const periodIndex = getGrantPeriodForDate(date, entryDate);

    if (periodIndex >= 0) {
      if (!datesByPeriod.has(periodIndex)) {
        datesByPeriod.set(periodIndex, []);
      }
      datesByPeriod.get(periodIndex)!.push(dateStr);
    }
  });

  // Crear información de períodos (desde el período 0 hasta el actual)
  const periods: PeriodInfo[] = [];

  for (let i = 0; i <= currentPeriodIndex; i++) {
    const grantDate = getGrantDate(entryDate, i);
    const expiryDate = new Date(grantDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 2); // 時効は2年

    const isExpired = now >= expiryDate;
    const isCurrentPeriod = i === currentPeriodIndex;
    const daysGranted = LEGAL_GRANT_TABLE[i].days;
    const usedDates = datesByPeriod.get(i) || [];
    const daysUsed = usedDates.length;

    periods.push({
      periodIndex: i,
      periodName: getPeriodName(i),
      grantDate,
      expiryDate,
      daysGranted,
      daysUsed,
      isExpired,
      isCurrentPeriod
    });
  }

  return periods;
}

/**
 * Calcula el balance de vacaciones de un empleado
 *
 * SINGLE SOURCE OF TRUTH: Este es el único lugar donde se calcula el balance
 * Todos los componentes deben usar esta función para garantizar consistencia
 *
 * @param employee - Empleado para calcular balance
 * @returns Información de balance calculada
 *
 * @example
 * const balance = getEmployeeBalance(employee);
 * console.log(`Balance: ${balance.remaining} días`);
 * console.log(`Otorgados: ${balance.granted}, Usados: ${balance.used}`);
 */
export function getEmployeeBalance(employee: Employee): BalanceInfo {
  // Si no tiene fecha de entrada, retornar valores desde el empleado
  if (!employee.entryDate) {
    return {
      granted: employee.grantedTotal || 0,
      used: employee.usedTotal || 0,
      remaining: employee.balance || 0,
      expiredCount: employee.expiredCount || 0
    };
  }

  const periods = getEmployeePeriods(employee);

  if (periods.length === 0) {
    // Empleado aún no ha alcanzado 6 meses
    return {
      granted: 0,
      used: 0,
      remaining: 0,
      expiredCount: 0
    };
  }

  // Calcular totales
  let totalGranted = 0;
  let totalUsed = 0;
  let totalExpired = 0;

  periods.forEach(period => {
    if (period.isExpired) {
      // Días que expiraron sin usar
      const unusedInExpiredPeriod = period.daysGranted - period.daysUsed;
      totalExpired += Math.max(0, unusedInExpiredPeriod);
    } else {
      // Solo contar períodos no expirados
      totalGranted += period.daysGranted;
    }

    totalUsed += period.daysUsed;
  });

  // Balance = días otorgados (no expirados) - días usados en períodos no expirados
  const usedInNonExpiredPeriods = periods
    .filter(p => !p.isExpired)
    .reduce((sum, p) => sum + p.daysUsed, 0);

  const remaining = totalGranted - usedInNonExpiredPeriods;

  return {
    granted: totalGranted,
    used: totalUsed,
    remaining: Math.max(0, remaining), // No puede ser negativo
    expiredCount: totalExpired
  };
}

/**
 * Verifica si un empleado cumple con el requisito legal de 5 días
 * (労働基準法39条 - 5日年次有給休暇取得義務化)
 *
 * @param employee - Empleado a verificar
 * @returns true si el empleado está en riesgo legal (10+ otorgados, <5 usados)
 */
export function isLegalRisk(employee: Employee): boolean {
  const balance = getEmployeeBalance(employee);
  return balance.granted >= 10 && balance.used < 5;
}

/**
 * Calcula cuántos días más necesita tomar el empleado para cumplir la ley
 *
 * @param employee - Empleado a verificar
 * @returns Número de días que faltan para cumplir (0 si ya cumple)
 */
export function getDaysNeededForCompliance(employee: Employee): number {
  const balance = getEmployeeBalance(employee);

  if (balance.granted < 10) {
    return 0; // No aplica la ley de 5 días
  }

  const needed = 5 - balance.used;
  return Math.max(0, needed);
}
