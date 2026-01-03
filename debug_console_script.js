/**
 * 🐛 Script de Diagnóstico de Integridad de Datos - Yukyu Pro
 *
 * Ejecutar en la consola del navegador (F12 → Console):
 *
 * 1. Copiar todo este archivo
 * 2. Pegar en la consola
 * 3. Ejecutar: debugYukyuData()
 */

function debugYukyuData() {
  console.log('🔍 ========================================');
  console.log('🔍 YUKYU PRO - DIAGNÓSTICO DE INTEGRIDAD');
  console.log('🔍 ========================================\n');

  // Leer datos de localStorage
  const rawData = localStorage.getItem('yukyu_pro_storage');

  if (!rawData) {
    console.error('❌ No hay datos en localStorage. Importa un Excel primero.');
    return;
  }

  const data = JSON.parse(rawData);
  const employees = data.employees || [];

  console.log(`📊 Total empleados: ${employees.length}\n`);

  // Resumen general
  let countWithPeriodHistory = 0;
  let countWithCurrentFields = 0;
  let countWithEntryDate = 0;
  let countWithYukyuDates = 0;
  let issues = [];

  employees.forEach((emp, idx) => {
    if (emp.periodHistory && emp.periodHistory.length > 0) countWithPeriodHistory++;
    if (emp.currentGrantedTotal !== undefined) countWithCurrentFields++;
    if (emp.entryDate) countWithEntryDate++;
    if (emp.yukyuDates && emp.yukyuDates.length > 0) countWithYukyuDates++;

    // Detectar problemas
    if (emp.currentGrantedTotal === undefined) {
      issues.push({
        employeeId: emp.id,
        name: emp.name,
        issue: 'currentGrantedTotal es undefined',
        severity: 'error'
      });
    }

    if (!emp.periodHistory || emp.periodHistory.length === 0) {
      issues.push({
        employeeId: emp.id,
        name: emp.name,
        issue: 'periodHistory vacío o undefined',
        severity: 'warning'
      });
    }

    if (emp.currentGrantedTotal !== undefined && emp.grantedTotal !== emp.currentGrantedTotal) {
      issues.push({
        employeeId: emp.id,
        name: emp.name,
        issue: `Discrepancia: current(${emp.currentGrantedTotal}) vs legacy(${emp.grantedTotal})`,
        severity: 'warning'
      });
    }

    if (emp.currentBalance !== undefined && emp.currentBalance < 0) {
      issues.push({
        employeeId: emp.id,
        name: emp.name,
        issue: `Balance negativo: ${emp.currentBalance}`,
        severity: 'error'
      });
    }
  });

  // Mostrar resumen
  console.log('📈 RESUMEN GENERAL:');
  console.log(`   ✅ Con periodHistory: ${countWithPeriodHistory}/${employees.length}`);
  console.log(`   ✅ Con currentXXX fields: ${countWithCurrentFields}/${employees.length}`);
  console.log(`   ✅ Con entryDate: ${countWithEntryDate}/${employees.length}`);
  console.log(`   ✅ Con yukyuDates: ${countWithYukyuDates}/${employees.length}\n`);

  // Mostrar problemas
  if (issues.length > 0) {
    console.log(`🚨 PROBLEMAS DETECTADOS (${issues.length}):\n`);

    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');

    if (errors.length > 0) {
      console.log(`❌ ERRORES CRÍTICOS (${errors.length}):`);
      errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.name} (${err.employeeId}): ${err.issue}`);
      });
      console.log('');
    }

    if (warnings.length > 0) {
      console.log(`⚠️ ADVERTENCIAS (${warnings.length}):`);
      warnings.forEach((warn, idx) => {
        console.log(`   ${idx + 1}. ${warn.name} (${warn.employeeId}): ${warn.issue}`);
      });
      console.log('');
    }
  } else {
    console.log('✅ No se detectaron problemas de integridad\n');
  }

  // Inspección detallada de un empleado de muestra
  const sampleEmp = employees.find(e => e.periodHistory && e.periodHistory.length > 0) || employees[0];

  if (sampleEmp) {
    console.log('🔬 INSPECCIÓN DETALLADA DE EMPLEADO DE MUESTRA:\n');
    console.log(`Nombre: ${sampleEmp.name} (${sampleEmp.id})`);
    console.log(`entryDate: ${sampleEmp.entryDate || 'undefined'}`);
    console.log(`periodHistory: ${sampleEmp.periodHistory ? sampleEmp.periodHistory.length + ' períodos' : 'undefined'}`);
    console.log(`yukyuDates: ${sampleEmp.yukyuDates ? sampleEmp.yukyuDates.length + ' fechas' : 'undefined'}`);
    console.log('');
    console.log('Valores ACTUALES (current):');
    console.log(`  付与: ${sampleEmp.currentGrantedTotal !== undefined ? sampleEmp.currentGrantedTotal + '日' : 'undefined'}`);
    console.log(`  消化: ${sampleEmp.currentUsedTotal !== undefined ? sampleEmp.currentUsedTotal + '日' : 'undefined'}`);
    console.log(`  残高: ${sampleEmp.currentBalance !== undefined ? sampleEmp.currentBalance + '日' : 'undefined'}`);
    console.log('');
    console.log('Valores LEGACY:');
    console.log(`  付与: ${sampleEmp.grantedTotal}日`);
    console.log(`  消化: ${sampleEmp.usedTotal}日`);
    console.log(`  残高: ${sampleEmp.balance}日`);
    console.log('');
    console.log('Valores HISTÓRICOS (historical):');
    console.log(`  付与: ${sampleEmp.historicalGrantedTotal !== undefined ? sampleEmp.historicalGrantedTotal + '日' : 'undefined'}`);
    console.log(`  消化: ${sampleEmp.historicalUsedTotal !== undefined ? sampleEmp.historicalUsedTotal + '日' : 'undefined'}`);
    console.log(`  残高: ${sampleEmp.historicalBalance !== undefined ? sampleEmp.historicalBalance + '日' : 'undefined'}`);
    console.log('');

    if (sampleEmp.periodHistory && sampleEmp.periodHistory.length > 0) {
      console.log('📋 periodHistory detalle:');
      sampleEmp.periodHistory.forEach((period, idx) => {
        console.log(`  ${idx + 1}. ${period.periodName}: 付与${period.granted} 消化${period.used} 残${period.balance} ${period.isExpired ? '❌ EXPIRADO' : '✅ VIGENTE'}`);
      });
      console.log('');
    }
  }

  // Funciones auxiliares disponibles
  console.log('🛠️ FUNCIONES DISPONIBLES:\n');
  console.log('   inspectEmployee("社員番号") - Inspeccionar empleado específico');
  console.log('   listAllEmployees() - Listar todos los empleados con resumen');
  console.log('   findDiscrepancies() - Encontrar todas las discrepancias');
  console.log('   exportIssues() - Exportar problemas a CSV\n');

  // Retornar datos para inspección
  return {
    employees,
    issues,
    summary: {
      total: employees.length,
      withPeriodHistory: countWithPeriodHistory,
      withCurrentFields: countWithCurrentFields,
      withEntryDate: countWithEntryDate,
      withYukyuDates: countWithYukyuDates
    }
  };
}

function inspectEmployee(employeeId) {
  const rawData = localStorage.getItem('yukyu_pro_storage');
  if (!rawData) {
    console.error('❌ No hay datos en localStorage');
    return;
  }

  const data = JSON.parse(rawData);
  const emp = data.employees.find(e => e.id === employeeId || e.name.includes(employeeId));

  if (!emp) {
    console.error(`❌ Empleado no encontrado: ${employeeId}`);
    return;
  }

  console.log('🔍 ========================================');
  console.log(`🔍 EMPLEADO: ${emp.name} (${emp.id})`);
  console.log('🔍 ========================================\n');

  console.log('DATOS BÁSICOS:');
  console.log(`  Cliente: ${emp.client}`);
  console.log(`  Estado: ${emp.status}`);
  console.log(`  Categoría: ${emp.category || 'undefined'}`);
  console.log(`  入社日: ${emp.entryDate || 'undefined'}\n`);

  console.log('DATOS DE YUKYU:');
  console.log(`  periodHistory: ${emp.periodHistory ? emp.periodHistory.length + ' períodos' : '❌ undefined'}`);
  console.log(`  yukyuDates: ${emp.yukyuDates ? emp.yukyuDates.length + ' fechas' : '❌ undefined'}\n`);

  console.log('VALORES ACTUALES (current - períodos vigentes):');
  console.log(`  付与: ${emp.currentGrantedTotal !== undefined ? emp.currentGrantedTotal + '日' : '❌ undefined'}`);
  console.log(`  消化: ${emp.currentUsedTotal !== undefined ? emp.currentUsedTotal + '日' : '❌ undefined'}`);
  console.log(`  残高: ${emp.currentBalance !== undefined ? emp.currentBalance + '日' : '❌ undefined'}`);
  console.log(`  時効: ${emp.currentExpiredCount !== undefined ? emp.currentExpiredCount : '❌ undefined'}\n`);

  console.log('VALORES HISTÓRICOS (historical - todos los períodos):');
  console.log(`  付与: ${emp.historicalGrantedTotal !== undefined ? emp.historicalGrantedTotal + '日' : 'undefined'}`);
  console.log(`  消化: ${emp.historicalUsedTotal !== undefined ? emp.historicalUsedTotal + '日' : 'undefined'}`);
  console.log(`  残高: ${emp.historicalBalance !== undefined ? emp.historicalBalance + '日' : 'undefined'}`);
  console.log(`  時効: ${emp.historicalExpiredCount !== undefined ? emp.historicalExpiredCount : 'undefined'}\n`);

  console.log('VALORES LEGACY (backward compatibility):');
  console.log(`  付与: ${emp.grantedTotal}日`);
  console.log(`  消化: ${emp.usedTotal}日`);
  console.log(`  残高: ${emp.balance}日`);
  console.log(`  時効: ${emp.expiredCount}\n`);

  if (emp.periodHistory && emp.periodHistory.length > 0) {
    console.log('📋 HISTORIAL DE PERÍODOS:');
    emp.periodHistory.forEach((period, idx) => {
      console.log(`  ${idx + 1}. ${period.periodName}:`);
      console.log(`     付与: ${period.granted}日, 消化: ${period.used}日, 残: ${period.balance}日, 時効: ${period.expired}日`);
      console.log(`     発生日: ${period.yukyuStartDate}, 有効期限: ${period.expiryDate.split('T')[0]}`);
      console.log(`     状態: ${period.isExpired ? '❌ EXPIRADO' : '✅ VIGENTE'}`);
      if (period.yukyuDates && period.yukyuDates.length > 0) {
        console.log(`     消化fechas: ${period.yukyuDates.length} (${period.yukyuDates.slice(0, 3).join(', ')}${period.yukyuDates.length > 3 ? '...' : ''})`);
      }
    });
    console.log('');
  }

  // Análisis de discrepancias
  console.log('🔬 ANÁLISIS DE DISCREPANCIAS:\n');

  if (emp.currentGrantedTotal === undefined) {
    console.log('❌ currentGrantedTotal es undefined → EmployeeList usará fallback legacy');
  }

  if (emp.currentGrantedTotal !== undefined && emp.grantedTotal !== emp.currentGrantedTotal) {
    console.log(`⚠️ Discrepancia付与: current(${emp.currentGrantedTotal}) vs legacy(${emp.grantedTotal})`);
  }

  if (emp.currentUsedTotal !== undefined && emp.usedTotal !== emp.currentUsedTotal) {
    console.log(`⚠️ Discrepancia消化: current(${emp.currentUsedTotal}) vs legacy(${emp.usedTotal})`);
  }

  if (emp.yukyuDates && emp.currentUsedTotal !== undefined && emp.yukyuDates.length !== emp.currentUsedTotal) {
    console.log(`⚠️ yukyuDates(${emp.yukyuDates.length}) ≠ currentUsedTotal(${emp.currentUsedTotal})`);
  }

  if (emp.currentBalance !== undefined && emp.currentBalance < 0) {
    console.log(`🚨 Balance negativo: ${emp.currentBalance}日`);
  }

  return emp;
}

function listAllEmployees() {
  const rawData = localStorage.getItem('yukyu_pro_storage');
  if (!rawData) {
    console.error('❌ No hay datos en localStorage');
    return;
  }

  const data = JSON.parse(rawData);
  const employees = data.employees || [];

  console.log('📋 LISTA DE TODOS LOS EMPLEADOS:\n');

  employees.forEach((emp, idx) => {
    const current = emp.currentGrantedTotal !== undefined ? emp.currentGrantedTotal : '❌ undef';
    const legacy = emp.grantedTotal;
    const mismatch = emp.currentGrantedTotal !== undefined && emp.currentGrantedTotal !== emp.grantedTotal ? '⚠️' : '';

    console.log(`${idx + 1}. ${emp.name} (${emp.id}) - 付与: ${current} ${mismatch}`);
  });

  return employees;
}

function findDiscrepancies() {
  const rawData = localStorage.getItem('yukyu_pro_storage');
  if (!rawData) {
    console.error('❌ No hay datos en localStorage');
    return;
  }

  const data = JSON.parse(rawData);
  const employees = data.employees || [];
  const discrepancies = [];

  employees.forEach(emp => {
    const empDiscrepancies = [];

    if (emp.currentGrantedTotal === undefined) {
      empDiscrepancies.push('currentGrantedTotal undefined');
    }

    if (!emp.periodHistory || emp.periodHistory.length === 0) {
      empDiscrepancies.push('periodHistory vacío');
    }

    if (emp.currentGrantedTotal !== undefined && emp.grantedTotal !== emp.currentGrantedTotal) {
      empDiscrepancies.push(`付与: current(${emp.currentGrantedTotal}) ≠ legacy(${emp.grantedTotal})`);
    }

    if (emp.currentUsedTotal !== undefined && emp.usedTotal !== emp.currentUsedTotal) {
      empDiscrepancies.push(`消化: current(${emp.currentUsedTotal}) ≠ legacy(${emp.usedTotal})`);
    }

    if (emp.currentBalance !== undefined && emp.currentBalance < 0) {
      empDiscrepancies.push(`Balance negativo: ${emp.currentBalance}`);
    }

    if (empDiscrepancies.length > 0) {
      discrepancies.push({
        id: emp.id,
        name: emp.name,
        issues: empDiscrepancies
      });
    }
  });

  console.log(`🔍 DISCREPANCIAS ENCONTRADAS: ${discrepancies.length}/${employees.length}\n`);

  discrepancies.forEach((disc, idx) => {
    console.log(`${idx + 1}. ${disc.name} (${disc.id}):`);
    disc.issues.forEach(issue => {
      console.log(`   - ${issue}`);
    });
  });

  return discrepancies;
}

function exportIssues() {
  const discrepancies = findDiscrepancies();

  if (discrepancies.length === 0) {
    console.log('✅ No hay problemas para exportar');
    return;
  }

  const csv = ['ID,Nombre,Problemas'].concat(
    discrepancies.map(d => `${d.id},"${d.name}","${d.issues.join('; ')}"`)
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yukyu_issues_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();

  console.log('✅ CSV exportado con éxito');
}

// Ejecutar automáticamente al cargar
console.log('🛠️ Script de diagnóstico cargado. Ejecuta: debugYukyuData()');
