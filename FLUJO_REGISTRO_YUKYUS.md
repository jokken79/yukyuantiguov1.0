# 📊 Cómo Registrar Yukyus de Empleados

Este documento explica cómo funciona el registro automático de yukyus cuando importas empleados.

---

## 🎯 ESCENARIO 1: Empleado CON Datos de Yukyu en Excel

### Empleado que YA está en ambos archivos:

```
📄 社員台帳 (DAICHO):
№240323 | 兼城賢士 | 入社日: 2021-05-10 | 在職中

📄 有給休暇管理 (YUKYU):
№240323 | 経過月: 6  | 付与数: 10 | 消化日数: 6
№240323 | 経過月: 18 | 付与数: 11 | 消化日数: 11
№240323 | 経過月: 30 | 付与数: 12 | 消化日数: 12
№240323 | 経過月: 42 | 付与数: 14 | 消化日数: 3
№240323 | 経過月: 54 | 付与数: 16 | 消化日数: 0
```

### ¿Qué hace la app al importar?

1. **Lee DAICHO:**
   - ✅ Crea empleado con: id, name, client, entryDate, status

2. **Lee YUKYU:**
   - ✅ Crea `periodHistory[]` con 5 períodos (6m, 18m, 30m, 42m, 54m)
   - ✅ Calcula fechas de expiración para cada período (grantDate + 2 años)
   - ✅ Calcula valores current (períodos vigentes): 付与30, 消化3, 残27
   - ✅ Calcula valores historical (todos): 付与63, 消化32, 残31

3. **Al abrir la app después:**
   - ✅ `db.loadData()` ejecuta `recalculateExpiration()` automáticamente
   - ✅ Verifica si necesita generar nuevos períodos → **NO** (ya tiene 5)
   - ✅ Verifica si alguno expiró → **SÍ** (períodos 1 y 2)
   - ✅ Actualiza valores current/historical
   - ✅ UI muestra datos actualizados

### Resultado:
✅ **COMPLETO** - Tiene historial + generación automática funcionando

---

## 🆕 ESCENARIO 2: Empleado NUEVO (solo en DAICHO, sin yukyu)

### Empleado que solo está en la lista básica:

```
📄 社員台帳 (DAICHO):
№250103 | 新入社員 太郎 | 入社日: 2020-01-01 | 在職中

📄 有給休暇管理 (YUKYU):
(VACÍO - no tiene filas para este empleado)
```

### ¿Qué hace la app al importar?

1. **Lee DAICHO:**
   - ✅ Crea empleado con:
     ```typescript
     {
       id: "250103",
       name: "新入社員 太郎",
       entryDate: "2020-01-01",  // ⭐ CRÍTICO: Lee la 入社日
       status: "在職中",
       grantedTotal: 0,
       usedTotal: 0,
       balance: 0,
       periodHistory: undefined  // ⬅️ Vacío porque no hay datos de yukyu
     }
     ```

2. **Lee YUKYU:**
   - ℹ️ No encuentra filas para este empleado
   - ✅ No hace nada (correcto)

3. **Primera vez que abres la app:**
   ```
   db.loadData() ejecuta:
     ↓
   recalculateExpiration(empleado):
     ↓
   generateNewPeriods(empleado):
     - Ve que tiene entryDate: "2020-01-01"
     - Calcula: Han pasado 60 meses (5 años)
     - Consulta tabla japonesa:
       * 6m  → debe tener 10日
       * 18m → debe tener 11日
       * 30m → debe tener 12日
       * 42m → debe tener 14日
       * 54m → debe tener 16日
     - 🆕 GENERA AUTOMÁTICAMENTE 5 períodos nuevos
     - Calcula fechas de expiración:
       * Período 1: 2020-07-01 + 2 años = 2022-07-01 ❌ EXPIRADO
       * Período 2: 2021-07-01 + 2 años = 2023-07-01 ❌ EXPIRADO
       * Período 3: 2022-07-01 + 2 años = 2024-07-01 ❌ EXPIRADO
       * Período 4: 2023-07-01 + 2 años = 2025-07-01 ✅ VIGENTE
       * Período 5: 2024-07-01 + 2 años = 2026-07-01 ✅ VIGENTE

   Resultado:
   periodHistory: [5 períodos generados]
   currentGrantedTotal: 30日 (14+16, solo períodos 4-5)
   currentUsedTotal: 0日 (sin consumo registrado)
   currentBalance: 30日

   Console:
   🆕 新入社員 太郎: Generando 5 nuevo(s) período(s) automáticamente
      → 初回(6ヶ月) (6m): 10日, expira 2022-07-01
      → 1年6ヶ月 (18m): 11日, expira 2023-07-01
      → 2年6ヶ月 (30m): 12日, expira 2024-07-01
      → 3年6ヶ月 (42m): 14日, expira 2025-07-01
      → 4年6ヶ月 (54m): 16日, expira 2026-07-01
   ```

4. **Guardar automáticamente:**
   - ✅ La app guarda el empleado actualizado en localStorage
   - ✅ Ahora tiene `periodHistory[]` completo
   - ✅ Próxima vez que abras la app, ya no generará duplicados

### Resultado:
✅ **AUTOMÁTICO** - Genera yukyus según antigüedad sin necesidad de Excel

---

## 🔄 FLUJO COMPLETO - Paso a Paso

### Paso 1: Importar Excel Primera Vez

```
Usuario importa:
1. 社員台帳 (DAICHO) → Crea empleados con entryDate
2. 有給休暇管理 (YUKYU) → Agrega periodHistory (si existe)

Empleados quedan en 3 estados posibles:
a) Con periodHistory (tenían datos en YUKYU) ✅
b) Sin periodHistory pero CON entryDate (solo en DAICHO) ⚠️
c) Sin periodHistory SIN entryDate (error - falta入社日) ❌
```

### Paso 2: Primera Carga de la App

```
db.loadData() automáticamente:
  ↓
recalculateAllExpirations(employees):
  ↓
Para cada empleado:
  - Si NO tiene periodHistory PERO tiene entryDate:
    → generateNewPeriods() crea todos los períodos
  - Si YA tiene periodHistory:
    → Verifica si necesita generar más períodos
    → Recalcula expiraciones
    → Actualiza values current/historical
  ↓
Guarda cambios automáticamente
```

### Paso 3: Uso Continuo

```
Cada vez que abres la app:
  ↓
db.loadData() ejecuta recalculateAllExpirations():
  1. ¿Necesita nuevos períodos? → Genera si es necesario
  2. ¿Alguno expiró? → Marca como expirado
  3. Actualiza valores current/historical
  4. Guarda cambios
  ↓
UI siempre muestra datos ACTUALIZADOS
```

---

## ✅ VERIFICACIÓN - ¿Cómo saber si funcionó?

### Opción 1: Revisar Console del Navegador

Después de importar y abrir la app, deberías ver:

```
📊 新入社員 太郎: 5 períodos creados
   Current:  付与30 消化0 残30
   Total:    付与63 消化0 残63

🆕 新入社員 太郎: Generando 5 nuevo(s) período(s) automáticamente
   → 初回(6ヶ月) (6m): 10日, expira 2022-07-01
   → 1年6ヶ月 (18m): 11日, expira 2023-07-01
   ...
```

### Opción 2: Verificar en EmployeeList

El empleado debería mostrar:

```
付与: 30日 (全期間: 63日)
消化: 0日
残日数: 残30日
```

---

## 🚨 PROBLEMAS COMUNES

### Problema 1: Empleado muestra 付与0日

**Causa:** El Excel de DAICHO NO tiene columna **入社日**

**Solución:**
1. Agregar columna **入社日** al Excel de DAICHO
2. Re-importar el archivo

### Problema 2: Empleado NO genera períodos automáticamente

**Causa:** `entryDate` está vacío

**Verificación:**
1. Abrir DevTools (F12)
2. Ejecutar en Console:
   ```javascript
   JSON.parse(localStorage.getItem('yukyu_pro_storage'))
     .employees
     .find(e => e.id === '250103')
   ```
3. Verificar que tenga `entryDate: "2020-01-01"`

**Solución:**
- Si `entryDate` es `undefined` → Re-importar Excel con 入社日

### Problema 3: Genera períodos duplicados

**Causa:** Bug en la lógica de generación (NO debería pasar)

**Solución temporal:**
1. Borrar localStorage: `localStorage.clear()`
2. Re-importar Excel
3. Reportar el bug

---

## 📝 RESUMEN

### Para empleados CON datos de yukyu en Excel:
✅ Se importan TODOS los períodos del Excel
✅ Se generan períodos faltantes automáticamente
✅ Se calculan expiraciones automáticamente

### Para empleados SIN datos de yukyu (solo DAICHO):
✅ Se genera TODO automáticamente basándose en **入社日**
✅ Se crean períodos según tabla japonesa oficial
✅ Se calculan fechas de expiración correctamente
✅ Se muestran valores current/historical

### Requisito CRÍTICO:
⚠️ **El Excel de DAICHO DEBE tener columna 入社日**
⚠️ Sin 入社日, la app NO puede generar períodos automáticamente

---

## 🎯 CONCLUSIÓN

**NO necesitas Excel de yukyu para TODOS los empleados.**

Solo necesitas:
1. 📄 社員台帳 (DAICHO) con **入社日** (obligatorio)
2. 📄 有給休暇管理 (YUKYU) solo para empleados que YA tienen historial

La app genera TODO automáticamente para el resto! 🚀
