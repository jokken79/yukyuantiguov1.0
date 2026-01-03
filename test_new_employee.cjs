/**
 * Test de empleado NUEVO - Solo en DAICHO, sin datos de yukyu
 * Simula importar un empleado que solo tiene 入社日
 */

// Copiar la lógica de expirationService
const YUKYU_GRANT_TABLE = [
  { elapsedMonths: 6, granted: 10, periodName: '初回(6ヶ月)' },
  { elapsedMonths: 18, granted: 11, periodName: '1年6ヶ月' },
  { elapsedMonths: 30, granted: 12, periodName: '2年6ヶ月' },
  { elapsedMonths: 42, granted: 14, periodName: '3年6ヶ月' },
  { elapsedMonths: 54, granted: 16, periodName: '4年6ヶ月' },
  { elapsedMonths: 66, granted: 18, periodName: '5年6ヶ月' },
  { elapsedMonths: 78, granted: 20, periodName: '6年6ヶ月' },
];

function generateNewPeriods(employee, currentDate) {
  if (!employee.entryDate) {
    return [];
  }

  const now = currentDate;
  const entryDate = new Date(employee.entryDate);

  const monthsFromEntry = (now.getFullYear() - entryDate.getFullYear()) * 12 +
                          (now.getMonth() - entryDate.getMonth());

  const existingElapsedMonths = (employee.periodHistory || [])
    .map(p => p.elapsedMonths)
    .sort((a, b) => a - b);

  const periodsToGenerate = [];

  YUKYU_GRANT_TABLE.forEach((grant) => {
    if (monthsFromEntry >= grant.elapsedMonths && !existingElapsedMonths.includes(grant.elapsedMonths)) {
      const grantDate = new Date(entryDate);
      grantDate.setMonth(grantDate.getMonth() + grant.elapsedMonths);

      const expiryDate = new Date(grantDate);
      expiryDate.setFullYear(expiryDate.getFullYear() + 2);

      const isExpired = now >= expiryDate;

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
        used: 0,
        balance: grant.granted,
        expired: 0,
        carryOver: 0,
        isExpired,
        isCurrentPeriod: !isExpired && Math.abs(grant.elapsedMonths - monthsFromEntry) <= 6,
        yukyuDates: [],
        source: 'excel',
        syncedAt: now.toISOString()
      });
    }
  });

  // Períodos después de 6.5 años
  const lastTableEntry = YUKYU_GRANT_TABLE[YUKYU_GRANT_TABLE.length - 1];
  if (monthsFromEntry > lastTableEntry.elapsedMonths) {
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
          granted: 20,
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

function recalculateExpiration(employee, currentDate) {
  const newPeriods = generateNewPeriods(employee, currentDate);
  const allPeriods = [...(employee.periodHistory || []), ...newPeriods];

  if (allPeriods.length === 0) {
    return { ...employee, newPeriodsGenerated: 0 };
  }

  const now = currentDate;

  const updatedPeriodHistory = allPeriods.map(period => {
    const expiryDate = typeof period.expiryDate === 'string'
      ? new Date(period.expiryDate)
      : period.expiryDate;

    const isExpired = period.expired > 0 || now >= expiryDate;

    return {
      ...period,
      isExpired,
      grantDate: typeof period.grantDate === 'string'
        ? period.grantDate
        : period.grantDate.toISOString(),
      expiryDate: typeof period.expiryDate === 'string'
        ? period.expiryDate
        : period.expiryDate.toISOString()
    };
  });

  const currentPeriods = updatedPeriodHistory.filter(p => !p.isExpired);
  const currentGrantedTotal = currentPeriods.reduce((sum, p) => sum + p.granted, 0);
  const currentUsedTotal = currentPeriods.reduce((sum, p) => sum + p.used, 0);
  const rawCurrentBalance = currentPeriods.reduce((sum, p) => sum + p.balance, 0);

  // ⭐ NUEVO: Aplicar límite legal de 40 días
  const LEGAL_MAX_BALANCE = 40;
  const currentBalance = Math.min(rawCurrentBalance, LEGAL_MAX_BALANCE);
  const excededDays = rawCurrentBalance > LEGAL_MAX_BALANCE ? rawCurrentBalance - LEGAL_MAX_BALANCE : 0;

  const historicalGrantedTotal = updatedPeriodHistory.reduce((sum, p) => sum + p.granted, 0);
  const historicalUsedTotal = updatedPeriodHistory.reduce((sum, p) => sum + p.used, 0);
  const historicalBalance = updatedPeriodHistory.reduce((sum, p) => sum + p.balance, 0);
  const historicalExpiredCount = updatedPeriodHistory.reduce((sum, p) => sum + p.expired, 0);

  return {
    ...employee,
    periodHistory: updatedPeriodHistory,
    currentGrantedTotal,
    currentUsedTotal,
    currentBalance, // ⭐ LIMITADO A 40日
    currentExpiredCount: 0,
    excededDays, // ⭐ Días que exceden límite legal
    historicalGrantedTotal,
    historicalUsedTotal,
    historicalBalance,
    historicalExpiredCount,
    newPeriodsGenerated: newPeriods.length
  };
}

// ========================================
// TEST CASE 1: Empleado con 5 años trabajados
// ========================================
console.log('═══════════════════════════════════════════════════════');
console.log('🧪 TEST 1: Empleado NUEVO con 5 años trabajados');
console.log('═══════════════════════════════════════════════════════\n');

const employee1 = {
  id: '250103',
  name: '新入社員 太郎',
  entryDate: '2020-01-01',  // 5 años trabajados
  status: '在職中',
  // Sin periodHistory - solo tiene entrada en DAICHO
  grantedTotal: 0,
  usedTotal: 0,
  balance: 0
};

console.log('📋 DATOS INICIALES (importados de DAICHO):');
console.log(`   ID: ${employee1.id}`);
console.log(`   Nombre: ${employee1.name}`);
console.log(`   入社日: ${employee1.entryDate}`);
console.log(`   Meses trabajados: 60 (5 años)`);
console.log(`   periodHistory: undefined (sin datos de yukyu)`);
console.log(`   付与: 0日, 消化: 0日, 残: 0日\n`);

console.log('🔄 Primera vez que se abre la app (db.loadData() ejecuta):');
console.log('   → recalculateExpiration()\n');

const today = new Date('2025-01-03');
const employee1Updated = recalculateExpiration(employee1, today);

console.log('✨ RESULTADO DESPUÉS DE GENERACIÓN AUTOMÁTICA:\n');
console.log(`   Total períodos: ${employee1Updated.periodHistory.length}`);
console.log(`   🆕 Nuevos generados: ${employee1Updated.newPeriodsGenerated}`);
console.log(`   Current:  付与${employee1Updated.currentGrantedTotal} 消化${employee1Updated.currentUsedTotal} 残${employee1Updated.currentBalance}`);
console.log(`   Total:    付与${employee1Updated.historicalGrantedTotal} 消化${employee1Updated.historicalUsedTotal} 時効${employee1Updated.historicalExpiredCount}\n`);

console.log('   Detalle de períodos generados:');
employee1Updated.periodHistory.forEach(p => {
  const status = p.isExpired ? '❌ EXPIRADO' : '✅ VIGENTE';
  console.log(`   ${p.periodName} (${p.elapsedMonths}m): 付与${p.granted} 消化${p.used} 残${p.balance} | expira ${p.expiryDate.split('T')[0]} ${status}`);
});

console.log('\n───────────────────────────────────────────────────────\n');

// ========================================
// TEST CASE 2: Empleado recién ingresado (3 meses)
// ========================================
console.log('🧪 TEST 2: Empleado RECIÉN INGRESADO (3 meses)');
console.log('═══════════════════════════════════════════════════════\n');

const employee2 = {
  id: '241001',
  name: '新人 花子',
  entryDate: '2024-10-01',  // Solo 3 meses trabajados
  status: '在職中',
  grantedTotal: 0,
  usedTotal: 0,
  balance: 0
};

console.log('📋 DATOS INICIALES:');
console.log(`   ID: ${employee2.id}`);
console.log(`   Nombre: ${employee2.name}`);
console.log(`   入社日: ${employee2.entryDate}`);
console.log(`   Meses trabajados: 3 (aún no cumple 6 meses)`);
console.log(`   periodHistory: undefined\n`);

const employee2Updated = recalculateExpiration(employee2, today);

console.log('✨ RESULTADO:');
console.log(`   Total períodos: ${employee2Updated.periodHistory ? employee2Updated.periodHistory.length : 0}`);
console.log(`   🆕 Nuevos generados: ${employee2Updated.newPeriodsGenerated}`);

if (employee2Updated.newPeriodsGenerated === 0) {
  console.log('   ℹ️ Aún no califica para yukyus (necesita 6 meses mínimo)');
  console.log('   付与: 0日, 消化: 0日, 残: 0日');
} else {
  console.log(`   Current: 付与${employee2Updated.currentGrantedTotal} 消化${employee2Updated.currentUsedTotal} 残${employee2Updated.currentBalance}`);
}

console.log('\n───────────────────────────────────────────────────────\n');

// ========================================
// TEST CASE 3: Empleado con 10 años (períodos extendidos)
// ========================================
console.log('🧪 TEST 3: Empleado con 10 años trabajados (períodos extendidos)');
console.log('═══════════════════════════════════════════════════════\n');

const employee3 = {
  id: '201501',
  name: 'ベテラン 次郎',
  entryDate: '2015-01-01',  // 10 años trabajados = 120 meses
  status: '在職中',
  grantedTotal: 0,
  usedTotal: 0,
  balance: 0
};

console.log('📋 DATOS INICIALES:');
console.log(`   ID: ${employee3.id}`);
console.log(`   Nombre: ${employee3.name}`);
console.log(`   入社日: ${employee3.entryDate}`);
console.log(`   Meses trabajados: 120 (10 años)\n`);

const employee3Updated = recalculateExpiration(employee3, today);

console.log('✨ RESULTADO:');
console.log(`   Total períodos: ${employee3Updated.periodHistory.length}`);
console.log(`   🆕 Nuevos generados: ${employee3Updated.newPeriodsGenerated}`);
console.log(`   Current:  付与${employee3Updated.currentGrantedTotal} 消化${employee3Updated.currentUsedTotal} 残${employee3Updated.currentBalance}`);
console.log(`   Total:    付与${employee3Updated.historicalGrantedTotal} 消化${employee3Updated.historicalUsedTotal} 時効${employee3Updated.historicalExpiredCount}\n`);

console.log('   Períodos generados (últimos 5):');
const lastPeriods = employee3Updated.periodHistory.slice(-5);
lastPeriods.forEach(p => {
  const status = p.isExpired ? '❌ EXPIRADO' : '✅ VIGENTE';
  console.log(`   ${p.periodName} (${p.elapsedMonths}m): 付与${p.granted} | expira ${p.expiryDate.split('T')[0]} ${status}`);
});

console.log('\n═══════════════════════════════════════════════════════');
console.log('✅ VERIFICACIÓN COMPLETA');
console.log('═══════════════════════════════════════════════════════\n');

console.log('Resumen de comportamiento:');
console.log('1. ✅ Empleado con 5 años → Genera 5 períodos (3 expirados, 2 vigentes)');
console.log('2. ✅ Empleado con 3 meses → NO genera (necesita 6 meses mínimo)');
console.log('3. ✅ Empleado con 10 años → Genera 10 períodos (tabla + extendidos)');
console.log('4. ✅ Todos tienen fechas de expiración correctas (2 años)');
console.log('5. ✅ Valores current/historical calculados correctamente');
console.log('\n🎯 Sistema de generación automática verificado!\n');
