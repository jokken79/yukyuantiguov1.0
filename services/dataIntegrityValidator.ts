/**
 * Data Integrity Validator Service
 *
 * Valida la integridad de los datos de empleados y yukyu
 * detectando inconsistencias, valores faltantes y discrepancias.
 *
 * Usado para garantizar calidad de datos en producción empresarial.
 */

import { Employee } from '../types';

export type IssueSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface IntegrityIssue {
  code: string;
  message: string;
  severity: IssueSeverity;
  field?: string;
  expected?: any;
  actual?: any;
}

export interface IntegrityCheck {
  employeeId: string;
  employeeName: string;
  issues: IntegrityIssue[];
  hasCriticalIssues: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface IntegrityReport {
  totalEmployees: number;
  employeesWithIssues: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  checks: IntegrityCheck[];
  timestamp: string;
}

/**
 * Valida un solo empleado y retorna lista de problemas encontrados
 */
export function validateEmployeeData(employee: Employee): IntegrityCheck {
  const issues: IntegrityIssue[] = [];

  // ═══════════════════════════════════════════════════════
  // VALIDACIONES CRÍTICAS (impiden funcionalidad básica)
  // ═══════════════════════════════════════════════════════

  // 1. periodHistory debe existir si tiene entryDate
  if (employee.entryDate && (!employee.periodHistory || employee.periodHistory.length === 0)) {
    issues.push({
      code: 'MISSING_PERIOD_HISTORY',
      message: 'Empleado con entryDate pero sin periodHistory (no se pueden calcular yukyus)',
      severity: 'critical',
      field: 'periodHistory',
      expected: 'array con períodos',
      actual: employee.periodHistory
    });
  }

  // 2. currentXXX fields deben estar poblados si hay periodHistory
  if (employee.periodHistory && employee.periodHistory.length > 0) {
    if (employee.currentGrantedTotal === undefined) {
      issues.push({
        code: 'MISSING_CURRENT_GRANTED',
        message: 'currentGrantedTotal es undefined (fallback a legacy incorrecto)',
        severity: 'critical',
        field: 'currentGrantedTotal'
      });
    }

    if (employee.currentUsedTotal === undefined) {
      issues.push({
        code: 'MISSING_CURRENT_USED',
        message: 'currentUsedTotal es undefined',
        severity: 'critical',
        field: 'currentUsedTotal'
      });
    }

    if (employee.currentBalance === undefined) {
      issues.push({
        code: 'MISSING_CURRENT_BALANCE',
        message: 'currentBalance es undefined',
        severity: 'critical',
        field: 'currentBalance'
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // VALIDACIONES DE ERROR (datos incorrectos)
  // ═══════════════════════════════════════════════════════

  // 3. Balance no debe ser negativo
  if (employee.currentBalance !== undefined && employee.currentBalance < 0) {
    issues.push({
      code: 'NEGATIVE_BALANCE',
      message: `Balance negativo detectado: ${employee.currentBalance}日`,
      severity: 'error',
      field: 'currentBalance',
      actual: employee.currentBalance,
      expected: '>= 0'
    });
  }

  // 4. currentGrantedTotal no debe exceder historicalGrantedTotal
  if (
    employee.currentGrantedTotal !== undefined &&
    employee.historicalGrantedTotal !== undefined &&
    employee.currentGrantedTotal > employee.historicalGrantedTotal
  ) {
    issues.push({
      code: 'CURRENT_EXCEEDS_HISTORICAL',
      message: `currentGrantedTotal(${employee.currentGrantedTotal}) > historicalGrantedTotal(${employee.historicalGrantedTotal}) - imposible`,
      severity: 'error',
      field: 'currentGrantedTotal',
      actual: employee.currentGrantedTotal,
      expected: `<= ${employee.historicalGrantedTotal}`
    });
  }

  // 5. currentUsedTotal no debe exceder currentGrantedTotal
  if (
    employee.currentUsedTotal !== undefined &&
    employee.currentGrantedTotal !== undefined &&
    employee.currentUsedTotal > employee.currentGrantedTotal
  ) {
    issues.push({
      code: 'USED_EXCEEDS_GRANTED',
      message: `currentUsedTotal(${employee.currentUsedTotal}) > currentGrantedTotal(${employee.currentGrantedTotal})`,
      severity: 'error',
      field: 'currentUsedTotal',
      actual: employee.currentUsedTotal,
      expected: `<= ${employee.currentGrantedTotal}`
    });
  }

  // 6. Balance debe ser granted - used
  if (
    employee.currentBalance !== undefined &&
    employee.currentGrantedTotal !== undefined &&
    employee.currentUsedTotal !== undefined
  ) {
    const expectedBalance = employee.currentGrantedTotal - employee.currentUsedTotal;
    const actualBalance = employee.currentBalance;

    // Permitir diferencia de 1 día por redondeos
    if (Math.abs(expectedBalance - actualBalance) > 1) {
      issues.push({
        code: 'BALANCE_MISMATCH',
        message: `Balance incorrecto: esperado ${expectedBalance}, actual ${actualBalance}`,
        severity: 'error',
        field: 'currentBalance',
        expected: expectedBalance,
        actual: actualBalance
      });
    }
  }

  // 7. Límite legal de 40 días
  if (employee.currentBalance !== undefined && employee.currentBalance > 40) {
    issues.push({
      code: 'EXCEEDS_LEGAL_LIMIT',
      message: `Balance (${employee.currentBalance}日) excede límite legal de 40日`,
      severity: 'error',
      field: 'currentBalance',
      actual: employee.currentBalance,
      expected: '<= 40'
    });
  }

  // ═══════════════════════════════════════════════════════
  // VALIDACIONES DE WARNING (inconsistencias)
  // ═══════════════════════════════════════════════════════

  // 8. Discrepancia entre current y legacy
  if (
    employee.currentGrantedTotal !== undefined &&
    employee.grantedTotal !== undefined &&
    employee.currentGrantedTotal !== employee.grantedTotal
  ) {
    issues.push({
      code: 'LEGACY_MISMATCH_GRANTED',
      message: `Discrepancia付与: current(${employee.currentGrantedTotal}) vs legacy(${employee.grantedTotal})`,
      severity: 'warning',
      field: 'grantedTotal',
      expected: employee.currentGrantedTotal,
      actual: employee.grantedTotal
    });
  }

  if (
    employee.currentUsedTotal !== undefined &&
    employee.historicalUsedTotal !== undefined &&
    employee.historicalUsedTotal !== employee.usedTotal
  ) {
    issues.push({
      code: 'LEGACY_MISMATCH_USED',
      message: `Discrepancia消化: historical(${employee.historicalUsedTotal}) vs legacy(${employee.usedTotal})`,
      severity: 'warning',
      field: 'usedTotal',
      expected: employee.historicalUsedTotal,
      actual: employee.usedTotal
    });
  }

  if (
    employee.currentBalance !== undefined &&
    employee.balance !== undefined &&
    employee.currentBalance !== employee.balance
  ) {
    issues.push({
      code: 'LEGACY_MISMATCH_BALANCE',
      message: `Discrepancia残高: current(${employee.currentBalance}) vs legacy(${employee.balance})`,
      severity: 'warning',
      field: 'balance',
      expected: employee.currentBalance,
      actual: employee.balance
    });
  }

  // 9. yukyuDates vs currentUsedTotal
  if (
    employee.yukyuDates &&
    employee.currentUsedTotal !== undefined &&
    Math.abs(employee.yukyuDates.length - employee.currentUsedTotal) > 3
  ) {
    issues.push({
      code: 'YUKYU_DATES_MISMATCH',
      message: `yukyuDates(${employee.yukyuDates.length}) ≠ currentUsedTotal(${employee.currentUsedTotal})`,
      severity: 'warning',
      field: 'yukyuDates',
      expected: employee.currentUsedTotal,
      actual: employee.yukyuDates.length
    });
  }

  // 10. periodHistory vs valores calculados
  if (employee.periodHistory && employee.periodHistory.length > 0) {
    const now = new Date();
    const currentPeriods = employee.periodHistory.filter(p => {
      const expiryDate = typeof p.expiryDate === 'string'
        ? new Date(p.expiryDate)
        : p.expiryDate;
      return now < expiryDate && p.expired === 0;
    });

    const calculatedGranted = currentPeriods.reduce((sum, p) => sum + p.granted, 0);

    if (
      employee.currentGrantedTotal !== undefined &&
      Math.abs(calculatedGranted - employee.currentGrantedTotal) > 0
    ) {
      issues.push({
        code: 'PERIOD_CALC_MISMATCH',
        message: `付与 calculado de periodHistory(${calculatedGranted}) ≠ currentGrantedTotal(${employee.currentGrantedTotal})`,
        severity: 'warning',
        field: 'periodHistory',
        expected: calculatedGranted,
        actual: employee.currentGrantedTotal
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // VALIDACIONES INFO (datos faltantes no críticos)
  // ═══════════════════════════════════════════════════════

  // 11. entryDate faltante
  if (!employee.entryDate) {
    issues.push({
      code: 'MISSING_ENTRY_DATE',
      message: '入社日 faltante (no se pueden generar períodos automáticamente)',
      severity: 'info',
      field: 'entryDate'
    });
  }

  // 12. yukyuDates vacío
  if (!employee.yukyuDates || employee.yukyuDates.length === 0) {
    issues.push({
      code: 'NO_YUKYU_DATES',
      message: 'Sin fechas de yukyu registradas',
      severity: 'info',
      field: 'yukyuDates'
    });
  }

  // Calcular flags de resumen
  const hasCriticalIssues = issues.some(i => i.severity === 'critical');
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    issues,
    hasCriticalIssues,
    hasErrors,
    hasWarnings
  };
}

/**
 * Valida todos los empleados y retorna reporte completo
 */
export function validateAllEmployees(employees: Employee[]): IntegrityReport {
  const checks = employees
    .map(validateEmployeeData)
    .filter(check => check.issues.length > 0); // Solo incluir empleados con problemas

  const criticalCount = checks.reduce((sum, c) => sum + c.issues.filter(i => i.severity === 'critical').length, 0);
  const errorCount = checks.reduce((sum, c) => sum + c.issues.filter(i => i.severity === 'error').length, 0);
  const warningCount = checks.reduce((sum, c) => sum + c.issues.filter(i => i.severity === 'warning').length, 0);
  const infoCount = checks.reduce((sum, c) => sum + c.issues.filter(i => i.severity === 'info').length, 0);

  return {
    totalEmployees: employees.length,
    employeesWithIssues: checks.length,
    criticalCount,
    errorCount,
    warningCount,
    infoCount,
    checks,
    timestamp: new Date().toISOString()
  };
}

/**
 * Genera resumen legible del reporte
 */
export function generateReportSummary(report: IntegrityReport): string {
  const lines = [
    '═══════════════════════════════════════════════════════',
    '🛡️ REPORTE DE INTEGRIDAD DE DATOS - YUKYU PRO',
    '═══════════════════════════════════════════════════════',
    '',
    `📊 Total empleados analizados: ${report.totalEmployees}`,
    `⚠️ Empleados con problemas: ${report.employeesWithIssues}`,
    '',
    '📈 RESUMEN DE PROBLEMAS:',
    `   🚨 Críticos: ${report.criticalCount}`,
    `   ❌ Errores: ${report.errorCount}`,
    `   ⚠️ Advertencias: ${report.warningCount}`,
    `   ℹ️ Info: ${report.infoCount}`,
    '',
    `⏰ Generado: ${new Date(report.timestamp).toLocaleString('ja-JP')}`,
    ''
  ];

  if (report.employeesWithIssues === 0) {
    lines.push('✅ NO SE DETECTARON PROBLEMAS DE INTEGRIDAD');
  } else {
    lines.push('🔍 DETALLES POR EMPLEADO:');
    lines.push('');

    report.checks.forEach((check, idx) => {
      lines.push(`${idx + 1}. ${check.employeeName} (${check.employeeId})`);

      const critical = check.issues.filter(i => i.severity === 'critical');
      const errors = check.issues.filter(i => i.severity === 'error');
      const warnings = check.issues.filter(i => i.severity === 'warning');
      const infos = check.issues.filter(i => i.severity === 'info');

      if (critical.length > 0) {
        critical.forEach(issue => {
          lines.push(`   🚨 [${issue.code}] ${issue.message}`);
        });
      }

      if (errors.length > 0) {
        errors.forEach(issue => {
          lines.push(`   ❌ [${issue.code}] ${issue.message}`);
        });
      }

      if (warnings.length > 0) {
        warnings.forEach(issue => {
          lines.push(`   ⚠️ [${issue.code}] ${issue.message}`);
        });
      }

      if (infos.length > 0 && (critical.length === 0 && errors.length === 0)) {
        // Solo mostrar infos si no hay problemas más serios
        infos.forEach(issue => {
          lines.push(`   ℹ️ [${issue.code}] ${issue.message}`);
        });
      }

      lines.push('');
    });
  }

  lines.push('═══════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Exporta reporte a CSV
 */
export function exportReportToCSV(report: IntegrityReport): string {
  const headers = ['社員番号', '氏名', '深刻度', 'コード', 'メッセージ', 'フィールド'];
  const rows = [headers];

  report.checks.forEach(check => {
    check.issues.forEach(issue => {
      rows.push([
        check.employeeId,
        check.employeeName,
        issue.severity,
        issue.code,
        issue.message,
        issue.field || ''
      ]);
    });
  });

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}
