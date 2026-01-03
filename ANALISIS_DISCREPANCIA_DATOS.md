# 🔍 Análisis de Discrepancia de Datos - Yukyu Pro

## 🚨 PROBLEMA CRÍTICO DETECTADO

### Evidencia Visual

**Screenshot 101347.png (社員台帳/EmployeeList):**
- Muestra TODOS los empleados con:
  - 付与: **30日**
  - 消化: **0日**
  - 残日数: **残30日**

**Screenshot 101523.png (有給休暇申請/LeaveRequest - 諸岡 貴士):**
- Muestra datos REALES del empleado:
  - 付与: **14日**
  - 消化: **32日**
  - 残高: **6日**
  - Historial detallado por períodos

**⚠️ DISCREPANCIA:** Los mismos datos del mismo empleado muestran valores completamente diferentes según el componente.

---

## 🔎 ANÁLISIS TÉCNICO

### 1. Flujo de Datos en EmployeeList.tsx

```typescript
// Línea 202-204
{emp.currentGrantedTotal !== undefined ? (
  <div className="font-black">{emp.currentGrantedTotal}日</div>
) : (
  <div className="font-black">{emp.grantedTotal}日</div>
)}
```

**Lógica:**
1. Intenta usar `emp.currentGrantedTotal` (nuevo sistema)
2. Si es `undefined`, usa fallback `emp.grantedTotal` (legacy)

**Problema Potencial:**
- Si `currentGrantedTotal` es `undefined`, usa legacy fields
- Los legacy fields pueden tener datos obsoletos o incorrectos

### 2. Flujo de Datos en LeaveRequest.tsx

```typescript
// Líneas 182-216 - calculatedTotals
const calculatedTotals = useMemo(() => {
  if (!historyByYear || historyByYear.length === 0) {
    return {
      totalGranted: selectedEmployee?.grantedTotal || 0,
      totalUsed: selectedEmployee?.usedTotal || 0,
      balance: selectedEmployee?.balance || 0,
      expiredCount: selectedEmployee?.expiredCount || 0
    };
  }

  // Sumar todos los días otorgados de los períodos NO expirados
  const totalGranted = historyByYear
    .filter(period => !period.isExpired)
    .reduce((sum, period) => sum + period.daysGranted, 0);

  // Sumar todos los días consumidos
  const totalUsed = historyByYear
    .reduce((sum, period) => sum + period.dates.length, 0);

  // Balance = otorgados - consumidos (solo períodos no expirados)
  const balance = totalGranted - historyByYear
    .filter(period => !period.isExpired)
    .reduce((sum, period) => sum + period.dates.length, 0);

  return { totalGranted, totalUsed, balance, expiredCount };
}, [historyByYear, selectedEmployee]);
```

**Lógica:**
1. **CALCULA EN TIEMPO REAL** basándose en:
   - `historyByYear`: Períodos agrupados por antigüedad
   - `yukyuDates`: Fechas de consumo del Excel + app records
   - Tabla legal japonesa: `LEGAL_GRANT_TABLE`
2. Filtra períodos expirados vs vigentes
3. Cuenta fechas consumidas directamente

**Resultado:** Valores DINÁMICOS y ACTUALIZADOS

---

## 🎯 CAUSA RAÍZ IDENTIFICADA

### Hipótesis #1: Problema en ExcelSync (MÁS PROBABLE)

**Archivo:** `components/ExcelSync.tsx` líneas 380-397

```typescript
// ⭐ PROBLEMA POTENCIAL:
currentGrantedTotal: currentGrantedTotal || undefined,
currentUsedTotal: currentUsedTotal || undefined,
currentBalance: currentBalance || undefined,
```

**BUG:** Si `currentGrantedTotal = 0`, se convierte en `undefined` porque:
```javascript
0 || undefined = undefined  // ❌ MALO
```

**Efecto:**
- Empleado con 0 días otorgados → `currentGrantedTotal = undefined`
- EmployeeList usa fallback → `grantedTotal`
- Si `grantedTotal` también tiene valor incorrecto → muestra datos erróneos

**Solución:**
```typescript
currentGrantedTotal: currentGrantedTotal !== undefined ? currentGrantedTotal : undefined,
// O mejor:
currentGrantedTotal,  // Si puede ser 0, déjalo ser 0
```

### Hipótesis #2: periodHistory Vacío

Si `periodHistory` está vacío o no se generó correctamente:
1. `recalculateExpiration()` no puede calcular valores correctos
2. Retorna empleado SIN cambios
3. Los valores legacy quedan intactos (potencialmente incorrectos)

### Hipótesis #3: Datos del Excel Incorrectos

El Excel importado puede tener:
- Filas duplicadas para el mismo empleado
- Valores sumados incorrectamente
- 付与数 que no coincide con la realidad

---

## 🔬 DIFERENCIAS CLAVE: LeaveRequest vs EmployeeList

| Aspecto | EmployeeList | LeaveRequest |
|---------|-------------|--------------|
| **Source** | localStorage (`emp.currentGrantedTotal`) | Cálculo dinámico (`calculatedTotals`) |
| **付与 (Granted)** | Valor guardado | Suma de `period.daysGranted` (no expirados) |
| **消化 (Used)** | Valor guardado | Cuenta de `period.dates.length` (todas) |
| **残高 (Balance)** | Valor guardado | `granted - used` (solo no expirados) |
| **Actualización** | Al importar Excel + `recalculateExpiration()` | Cada render (useMemo) |
| **Dependencias** | `periodHistory` correcto | `yukyuDates` + `entryDate` |

**Conclusión:** LeaveRequest es MÁS CONFIABLE porque:
1. Calcula en tiempo real
2. Usa fuente de verdad: `yukyuDates` + tabla legal
3. No depende de valores pre-calculados potencialmente erróneos

---

## ⚠️ RIESGOS EMPRESARIALES

### Impacto Crítico

1. **Compliance Legal:**
   - Datos incorrectos pueden llevar a incumplimiento de 労働基準法39条
   - Riesgo de multas y sanciones

2. **Confianza del Usuario:**
   - Gerentes ven tabla con datos incorrectos
   - Toman decisiones basadas en información falsa

3. **Auditorías:**
   - Discrepancias entre reportes y datos reales
   - Falta de trazabilidad

4. **Reputación:**
   - Sistema no confiable para uso empresarial real

---

## ✅ PLAN DE CORRECCIÓN

### FASE 1: Diagnóstico Inmediato

**Crear herramienta de debug:**

```typescript
// Agregar a EmployeeList.tsx o crear componente separado
const DebugEmployeeData = ({ emp }: { emp: Employee }) => {
  return (
    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-xs">
      <h4 className="font-black mb-2">🐛 DEBUG: {emp.name}</h4>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <strong>periodHistory:</strong> {emp.periodHistory?.length || 'undefined'}
        </div>
        <div>
          <strong>currentGrantedTotal:</strong> {emp.currentGrantedTotal ?? 'undefined'}
        </div>
        <div>
          <strong>grantedTotal (legacy):</strong> {emp.grantedTotal}
        </div>
        <div>
          <strong>currentUsedTotal:</strong> {emp.currentUsedTotal ?? 'undefined'}
        </div>
        <div>
          <strong>usedTotal (legacy):</strong> {emp.usedTotal}
        </div>
        <div>
          <strong>currentBalance:</strong> {emp.currentBalance ?? 'undefined'}
        </div>
        <div>
          <strong>balance (legacy):</strong> {emp.balance}
        </div>
      </div>
    </div>
  );
};
```

**Ejecutar en console del navegador:**
```javascript
// Inspeccionar datos de un empleado específico
const emp = JSON.parse(localStorage.getItem('yukyu_pro_storage'))
  .employees
  .find(e => e.name.includes('諸岡'));

console.log('📊 DATOS DEL EMPLEADO:', emp);
console.log('periodHistory:', emp.periodHistory);
console.log('currentGrantedTotal:', emp.currentGrantedTotal);
console.log('grantedTotal:', emp.grantedTotal);
console.log('yukyuDates:', emp.yukyuDates);
```

### FASE 2: Corrección del Bug en ExcelSync.tsx

**Líneas 380-397 - Cambiar:**

```typescript
// ❌ ANTES (MALO):
currentGrantedTotal: currentGrantedTotal || undefined,
currentUsedTotal: currentUsedTotal || undefined,
currentBalance: currentBalance || undefined,

// ✅ DESPUÉS (CORRECTO):
currentGrantedTotal,
currentUsedTotal,
currentBalance,
currentExpiredCount,
```

**Explicación:** Si el valor es `0`, debe ser `0`, no `undefined`.

### FASE 3: Unificar Source of Truth

**Opción A: Usar siempre cálculo dinámico (como LeaveRequest)**

Modificar EmployeeList.tsx para calcular valores en tiempo real igual que LeaveRequest.

**Ventajas:**
- ✅ Siempre muestra datos correctos
- ✅ No depende de localStorage potencialmente corrupto
- ✅ Consistencia total con LeaveRequest

**Desventajas:**
- ❌ Más procesamiento (pero con useMemo es aceptable)
- ❌ Duplicación de lógica de cálculo

**Opción B: Mejorar recalculateExpiration() y confiar en él**

Asegurar que `recalculateExpiration()` SIEMPRE genera valores correctos y usarlos.

**Ventajas:**
- ✅ Un solo source of truth
- ✅ Performance (valores pre-calculados)
- ✅ Simplicidad en componentes

**Desventajas:**
- ❌ Depende de que recalculation sea 100% correcto
- ❌ Requiere que periodHistory esté SIEMPRE correcto

### FASE 4: Validación Robusta

**Crear servicio de validación de integridad:**

```typescript
// services/dataIntegrityValidator.ts

export interface IntegrityCheck {
  employeeId: string;
  employeeName: string;
  issues: string[];
  severity: 'error' | 'warning' | 'info';
}

export function validateEmployeeData(employee: Employee): IntegrityCheck {
  const issues: string[] = [];

  // 1. Verificar periodHistory existe
  if (!employee.periodHistory || employee.periodHistory.length === 0) {
    issues.push('⚠️ periodHistory vacío o undefined');
  }

  // 2. Verificar currentXXX fields poblados
  if (employee.currentGrantedTotal === undefined) {
    issues.push('❌ currentGrantedTotal es undefined');
  }

  // 3. Verificar consistencia entre current y historical
  if (employee.currentGrantedTotal !== undefined &&
      employee.historicalGrantedTotal !== undefined &&
      employee.currentGrantedTotal > employee.historicalGrantedTotal) {
    issues.push('🚨 currentGrantedTotal > historicalGrantedTotal (imposible)');
  }

  // 4. Verificar balance no negativo
  if (employee.currentBalance !== undefined && employee.currentBalance < 0) {
    issues.push('🚨 Balance negativo detectado');
  }

  // 5. Comparar con cálculo dinámico (como LeaveRequest)
  if (employee.yukyuDates && employee.entryDate) {
    const dynamicUsed = employee.yukyuDates.length;
    if (employee.currentUsedTotal !== undefined &&
        Math.abs(dynamicUsed - employee.currentUsedTotal) > 5) {
      issues.push(`⚠️ Discrepancia: yukyuDates(${dynamicUsed}) vs currentUsedTotal(${employee.currentUsedTotal})`);
    }
  }

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    issues,
    severity: issues.some(i => i.includes('🚨')) ? 'error' :
              issues.some(i => i.includes('❌')) ? 'warning' : 'info'
  };
}

export function validateAllEmployees(employees: Employee[]): IntegrityCheck[] {
  return employees.map(validateEmployeeData).filter(check => check.issues.length > 0);
}
```

**Ejecutar validación al cargar datos:**

```typescript
// En db.loadData(), después de recalculateAllExpirations
import { validateAllEmployees } from './dataIntegrityValidator';

const integrityIssues = validateAllEmployees(updatedEmployees);
if (integrityIssues.length > 0) {
  console.warn('🚨 PROBLEMAS DE INTEGRIDAD DETECTADOS:', integrityIssues);
  // Opcional: Mostrar notificación al usuario
}
```

### FASE 5: Herramienta de Reparación Automática

```typescript
// services/dataRepairService.ts

export function repairEmployeeData(employee: Employee): Employee {
  // Si periodHistory existe, recalcular TODO desde ahí
  if (employee.periodHistory && employee.periodHistory.length > 0) {
    const now = new Date();
    const currentPeriods = employee.periodHistory.filter(p => {
      const expiryDate = typeof p.expiryDate === 'string'
        ? new Date(p.expiryDate)
        : p.expiryDate;
      return now < expiryDate && p.expired === 0;
    });

    const repairedCurrentGrantedTotal = currentPeriods.reduce((sum, p) => sum + p.granted, 0);
    const repairedCurrentUsedTotal = currentPeriods.reduce((sum, p) => sum + p.used, 0);
    const repairedCurrentBalance = currentPeriods.reduce((sum, p) => sum + p.balance, 0);

    console.log(`🔧 REPARANDO ${employee.name}:`, {
      antes: {
        granted: employee.currentGrantedTotal,
        used: employee.currentUsedTotal,
        balance: employee.currentBalance
      },
      despues: {
        granted: repairedCurrentGrantedTotal,
        used: repairedCurrentUsedTotal,
        balance: repairedCurrentBalance
      }
    });

    return {
      ...employee,
      currentGrantedTotal: repairedCurrentGrantedTotal,
      currentUsedTotal: repairedCurrentUsedTotal,
      currentBalance: Math.min(repairedCurrentBalance, 40), // Límite legal
      grantedTotal: repairedCurrentGrantedTotal, // Legacy
      balance: Math.min(repairedCurrentBalance, 40) // Legacy
    };
  }

  return employee;
}
```

---

## 🤖 OPCIÓN: Skill/Agente Especializado

### Propuesta: "Yukyu Integrity Guardian"

**Responsabilidades:**

1. **Validación Continua:**
   - Ejecutar `validateAllEmployees()` cada vez que se cargan datos
   - Alertar sobre discrepancias automáticamente

2. **Reparación Automática:**
   - Ejecutar `repairEmployeeData()` cuando detecta inconsistencias
   - Logging detallado de todas las reparaciones

3. **Auditoría:**
   - Generar reportes de integridad
   - Comparar EmployeeList vs LeaveRequest en tiempo real
   - Exportar discrepancias a CSV

4. **Testing:**
   - Simular importaciones con datos problemáticos
   - Verificar que recalculateExpiration funciona correctamente
   - Pruebas de edge cases (0 días, 40+ días, períodos expirados)

**Implementación:**

```typescript
// skills/yukyu-integrity/skill.json
{
  "name": "yukyu-integrity",
  "description": "Guardian de integridad de datos de yukyu con validación automática y reparación",
  "trigger": "manual",
  "commands": {
    "validate": "Validar integridad de todos los empleados",
    "repair": "Reparar automáticamente datos inconsistentes",
    "audit": "Generar reporte de auditoría completo",
    "compare": "Comparar valores entre EmployeeList y LeaveRequest"
  }
}
```

---

## 📊 RESUMEN EJECUTIVO

### Problema

- **Datos mostrados en 社員台帳 (EmployeeList) NO coinciden con datos reales del empleado**
- Todos los empleados muestran "30日" cuando deberían mostrar valores individuales
- Riesgo empresarial CRÍTICO

### Causa Raíz (Hipótesis)

1. Bug en ExcelSync.tsx: `value || undefined` convierte `0` en `undefined`
2. periodHistory vacío o mal generado → recalculateExpiration no funciona
3. Datos del Excel incorrectos desde el inicio

### Solución

1. **Inmediato:** Diagnosticar con herramienta de debug
2. **Corto plazo:** Corregir bug en ExcelSync (`|| undefined`)
3. **Medio plazo:** Implementar validación de integridad
4. **Largo plazo:** Skill/Agente especializado para monitoreo continuo

### Decisión Requerida

¿Prefieres que:

**A)** Primero diagnostique el problema exacto viendo datos en localStorage?
**B)** Corrija el bug en ExcelSync inmediatamente y re-importe?
**C)** Unifique source of truth usando cálculo dinámico siempre?
**D)** Cree skill especializado de integridad de datos?
**E)** Todo lo anterior en orden secuencial?

---

**⚠️ ESTO ES CRÍTICO PARA UNA EMPRESA REAL. Los datos DEBEN ser 100% confiables.**
