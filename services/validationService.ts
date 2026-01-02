/**
 * Validation Service
 *
 * Servicio centralizado para validar operaciones de aprobación de vacaciones.
 * Previene el BUG #2: balances negativos al aprobar solicitudes.
 *
 * Responsabilidades:
 * - Validar balance suficiente antes de aprobar
 * - Validar fechas duplicadas
 * - Validar estado del empleado
 * - Retornar errores específicos para la UI
 */

import { Employee, LeaveRecord } from '../types';
import { getEmployeeBalance } from './balanceCalculator';

/**
 * Códigos de error de validación
 */
export type ValidationErrorCode =
  | 'INSUFFICIENT_BALANCE'    // Balance insuficiente
  | 'DUPLICATE_DATE'          // Fecha ya existe en yukyuDates
  | 'EMPLOYEE_RETIRED'        // Empleado ya está retirado
  | 'EMPLOYEE_NOT_FOUND'      // Empleado no encontrado
  | 'INVALID_DATE'            // Fecha inválida
  | 'FUTURE_DATE';            // Fecha en el futuro

/**
 * Resultado de validación
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  code?: ValidationErrorCode;
}

/**
 * Mensajes de error en japonés para cada código
 */
export const ERROR_MESSAGES: Record<ValidationErrorCode, string> = {
  INSUFFICIENT_BALANCE: '残高不足：この社員は有給日数がありません。',
  DUPLICATE_DATE: '重複：この日付は既に取得済みです。',
  EMPLOYEE_RETIRED: 'エラー：退社した社員の申請は承認できません。',
  EMPLOYEE_NOT_FOUND: 'エラー：社員が見つかりません。',
  INVALID_DATE: 'エラー：無効な日付です。',
  FUTURE_DATE: '警告：未来の日付が選択されています。'
};

/**
 * Valida si se puede aprobar una solicitud de vacaciones
 *
 * Realiza las siguientes validaciones:
 * 1. Empleado existe
 * 2. Empleado está activo (no 退社)
 * 3. Balance suficiente (remaining >= 1)
 * 4. Fecha no duplicada en yukyuDates
 * 5. Fecha válida
 *
 * @param employee - Empleado que solicita vacaciones
 * @param record - Registro de solicitud
 * @returns Resultado de validación con código de error si falla
 *
 * @example
 * const validation = canApproveLeave(employee, record);
 * if (!validation.isValid) {
 *   alert(validation.error);
 *   return;
 * }
 */
export function canApproveLeave(
  employee: Employee | undefined,
  record: LeaveRecord
): ValidationResult {
  // 1. Verificar que el empleado existe
  if (!employee) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.EMPLOYEE_NOT_FOUND,
      code: 'EMPLOYEE_NOT_FOUND'
    };
  }

  // 2. Verificar que el empleado está activo
  if (employee.status === '退社') {
    return {
      isValid: false,
      error: ERROR_MESSAGES.EMPLOYEE_RETIRED,
      code: 'EMPLOYEE_RETIRED'
    };
  }

  // 3. Verificar fecha válida
  try {
    const requestDate = new Date(record.date);
    if (isNaN(requestDate.getTime())) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.INVALID_DATE,
        code: 'INVALID_DATE'
      };
    }

    // Advertencia para fechas futuras (no bloquear, solo advertir)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (requestDate > now) {
      // No bloqueamos, pero podríamos agregar un warning
      console.warn('Fecha futura detectada:', record.date);
    }
  } catch (e) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.INVALID_DATE,
      code: 'INVALID_DATE'
    };
  }

  // Solo validar balance para vacaciones pagadas
  if (record.type === 'paid') {
    // 4. Verificar balance suficiente
    const balance = getEmployeeBalance(employee);

    if (balance.remaining < 1) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.INSUFFICIENT_BALANCE,
        code: 'INSUFFICIENT_BALANCE'
      };
    }

    // 5. Verificar fecha no duplicada
    const yukyuDates = employee.yukyuDates || [];
    if (yukyuDates.includes(record.date)) {
      return {
        isValid: false,
        error: ERROR_MESSAGES.DUPLICATE_DATE,
        code: 'DUPLICATE_DATE'
      };
    }
  }

  // Todas las validaciones pasaron
  return { isValid: true };
}

/**
 * Valida múltiples solicitudes y retorna resultados separados
 *
 * @param employees - Map de empleados por ID
 * @param records - Registros a validar
 * @returns Objeto con arrays de IDs válidos e inválidos
 *
 * @example
 * const result = validateMultipleLeaves(employeeMap, records);
 * console.log(`Válidos: ${result.valid.length}, Inválidos: ${result.invalid.length}`);
 */
export function validateMultipleLeaves(
  employees: Map<string, Employee>,
  records: LeaveRecord[]
): {
  valid: string[];
  invalid: Array<{ recordId: string; error: string; code: ValidationErrorCode }>;
} {
  const valid: string[] = [];
  const invalid: Array<{ recordId: string; error: string; code: ValidationErrorCode }> = [];

  records.forEach(record => {
    if (!record.id) return;

    const employee = employees.get(record.employeeId);
    const validation = canApproveLeave(employee, record);

    if (validation.isValid) {
      valid.push(record.id);
    } else {
      invalid.push({
        recordId: record.id,
        error: validation.error || 'Error desconocido',
        code: validation.code || 'EMPLOYEE_NOT_FOUND'
      });
    }
  });

  return { valid, invalid };
}

/**
 * Verifica si una fecha específica ya fue tomada por el empleado
 *
 * @param employee - Empleado a verificar
 * @param date - Fecha en formato ISO (YYYY-MM-DD)
 * @returns true si la fecha ya existe en yukyuDates
 */
export function isDateAlreadyTaken(employee: Employee, date: string): boolean {
  const yukyuDates = employee.yukyuDates || [];
  return yukyuDates.includes(date);
}

/**
 * Verifica si el empleado puede tomar N días más
 *
 * @param employee - Empleado a verificar
 * @param daysNeeded - Número de días que quiere tomar
 * @returns true si tiene balance suficiente
 */
export function hasEnoughBalance(employee: Employee, daysNeeded: number = 1): boolean {
  const balance = getEmployeeBalance(employee);
  return balance.remaining >= daysNeeded;
}
