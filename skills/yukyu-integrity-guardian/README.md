# 🛡️ Yukyu Integrity Guardian

**Guardián de integridad de datos de yukyu para uso empresarial**

## 📋 Descripción

Skill especializado para garantizar la integridad, consistencia y exactitud de los datos de yukyu (有給休暇) en Yukyu Pro. Diseñado específicamente para entornos empresariales donde los datos DEBEN ser 100% confiables.

## ⚡ Comandos Disponibles

### `/yukyu-validate`
Ejecuta validación completa de todos los empleados y reporta problemas detectados.

**Uso:**
```bash
/yukyu-validate
```

**Salida:**
- Número de empleados analizados
- Conteo de problemas por severidad (críticos, errores, warnings, info)
- Detalle de cada problema encontrado
- Reporte exportable a CSV

**Ejemplo:**
```
🛡️ REPORTE DE INTEGRIDAD DE DATOS
═══════════════════════════════════
📊 Total empleados: 50
⚠️ Empleados con problemas: 3

🚨 Críticos: 2
❌ Errores: 1
⚠️ Advertencias: 5
```

---

### `/yukyu-repair`
Repara automáticamente datos inconsistentes recalculando desde periodHistory.

**Uso:**
```bash
/yukyu-repair [--mode=auto|conservative]
```

**Opciones:**
- `--mode=auto`: Repara todos los problemas (predeterminado)
- `--mode=conservative`: Solo repara problemas críticos

**Reparaciones que realiza:**
- Recalcula `currentGrantedTotal`, `currentUsedTotal`, `currentBalance`
- Recalcula `historicalGrantedTotal`, `historicalUsedTotal`, `historicalBalance`
- Sincroniza campos legacy (`grantedTotal`, `usedTotal`, `balance`)
- Aplica límite legal de 40 días
- Calcula `excededDays` si aplica

**Ejemplo:**
```
🔧 REPARACIÓN COMPLETADA
═══════════════════════
✅ 3 empleados reparados

1. 諸岡 貴士 (#HM0006)
   - currentGrantedTotal: undefined → 14日
   - currentBalance: 30日 → 6日
   Razón: Recalculado desde periodHistory
```

---

### `/yukyu-audit`
Genera reporte de auditoría completo con estado actual del sistema.

**Uso:**
```bash
/yukyu-audit [--export=console|csv|pdf]
```

**Incluye:**
- Resumen general de todos los empleados
- Estado de integridad de datos
- Historial de reparaciones (si las hubo)
- Comparación current vs historical
- Empleados en riesgo legal
- Estadísticas de uso de yukyus

**Salida CSV:**
```csv
社員番号,氏名,深刻度,コード,メッセージ,フィールド
"HM0006","諸岡 貴士","critical","MISSING_CURRENT_GRANTED","currentGrantedTotal es undefined","currentGrantedTotal"
```

---

### `/yukyu-compare`
Compara valores entre diferentes fuentes de datos para detectar discrepancias.

**Uso:**
```bash
/yukyu-compare <employeeId>
```

**Compara:**
- Values de EmployeeList (current)
- Values de LeaveRequest (calculados dinámicamente)
- Values de periodHistory (source of truth)
- Values legacy (backward compatibility)
- yukyuDates count vs currentUsedTotal

**Ejemplo:**
```
🔍 COMPARACIÓN DE FUENTES - 諸岡 貴士 (HM0006)
═══════════════════════════════════════════════

付与 (Granted):
  EmployeeList:  14日 ✅
  LeaveRequest:  14日 ✅
  periodHistory: 14日 ✅
  Legacy:        30日 ❌ DISCREPANCIA

消化 (Used):
  EmployeeList:  32日 ✅
  LeaveRequest:  32日 ✅
  yukyuDates:    32 fechas ✅
  Legacy:        0日 ❌ DISCREPANCIA
```

---

### `/yukyu-debug`
Activa modo debug con inspección detallada de datos de empleados.

**Uso:**
```bash
/yukyu-debug [employeeId]
```

**Sin employeeId:** Muestra resumen de todos los empleados
**Con employeeId:** Inspección detallada de un empleado específico

**Salida:**
```javascript
📊 EMPLEADO: 諸岡 貴士 (HM0006)
═══════════════════════════════════

DATOS BÁSICOS:
  Cliente: 名護農業組合
  Estado: 在職中
  入社日: 2021-05-10

DATOS DE YUKYU:
  periodHistory: 5 períodos
  yukyuDates: 32 fechas

VALORES ACTUALES:
  付与: 14日
  消化: 32日
  残高: 6日 (limitado a 40日)
  超過: 0日

PERIODHISTORY DETALLE:
  1. 初回(6ヶ月): 付与10 消化6 残4 ❌ EXPIRADO
  2. 1年6ヶ月: 付与11 消化11 残0 ❌ EXPIRADO
  3. 2年6ヶ月: 付与12 消化12 残0 ❌ EXPIRADO
  4. 3年6ヶ月: 付与14 消化3 残11 ✅ VIGENTE
  5. 4年6ヶ月: 付与16 消化0 残16 ✅ VIGENTE (超過5日 limitados)
```

---

## 🔧 Integración Automática

El Guardian se ejecuta **automáticamente** cada vez que se cargan los datos:

```typescript
// En services/db.ts - loadData()
1. Migración de datos (si necesario)
2. Recálculo de expiraciones
3. 🛡️ validateAllEmployees() ← Validación automática
4. Si hay problemas → smartRepair() ← Reparación automática
5. Guardar datos reparados
6. Validar nuevamente
7. Retornar datos limpios
```

**Console Logs:**
```
🛡️ Ejecutando validación de integridad de datos...
⚠️ PROBLEMAS DE INTEGRIDAD DETECTADOS:
   🚨 Críticos: 2
   ❌ Errores: 1
   ⚠️ Advertencias: 3

🔧 Iniciando reparación automática de datos...
✅ Reparación completada: 3 empleados reparados

🔍 Validación post-reparación:
   🚨 Críticos: 0
   ❌ Errores: 0
   ⚠️ Advertencias: 0
```

---

## 📊 Validaciones Realizadas

### Críticas (impiden funcionalidad)
- ✅ `periodHistory` existe si tiene `entryDate`
- ✅ `currentGrantedTotal` poblado si hay `periodHistory`
- ✅ `currentUsedTotal` poblado si hay `periodHistory`
- ✅ `currentBalance` poblado si hay `periodHistory`

### Errores (datos incorrectos)
- ✅ Balance no negativo
- ✅ `currentGrantedTotal` ≤ `historicalGrantedTotal`
- ✅ `currentUsedTotal` ≤ `currentGrantedTotal`
- ✅ `currentBalance` = `currentGrantedTotal` - `currentUsedTotal`
- ✅ `currentBalance` ≤ 40日 (límite legal)

### Warnings (inconsistencias)
- ✅ `currentGrantedTotal` vs `grantedTotal` (legacy)
- ✅ `historicalUsedTotal` vs `usedTotal` (legacy)
- ✅ `currentBalance` vs `balance` (legacy)
- ✅ `yukyuDates.length` vs `currentUsedTotal`
- ✅ `periodHistory` calculado vs valores almacenados

### Info (datos faltantes no críticos)
- ℹ️ `entryDate` faltante
- ℹ️ `yukyuDates` vacío

---

## 🚀 Instalación

El skill ya está integrado en Yukyu Pro. No requiere instalación adicional.

---

## 🎯 Casos de Uso

### 1. Después de Importar Excel
```bash
/yukyu-validate
# Verifica que todos los datos se importaron correctamente
```

### 2. Antes de Generar Reportes
```bash
/yukyu-audit --export=csv
# Asegura que los reportes tendrán datos exactos
```

### 3. Debugging de un Empleado Específico
```bash
/yukyu-debug HM0006
# Inspección detallada de 諸岡 貴士
```

### 4. Reparación Manual
```bash
/yukyu-repair --mode=auto
# Fuerza reparación de todos los empleados
```

### 5. Comparación de Fuentes
```bash
/yukyu-compare HM0006
# Compara EmployeeList vs LeaveRequest vs periodHistory
```

---

## ⚠️ Notas Importantes

1. **Source of Truth:** `periodHistory` es la fuente de verdad. Todos los valores se recalculan desde ahí.

2. **Límite Legal:** El sistema aplica automáticamente el límite de 40日 según 労働基準法第115条.

3. **Reparación Automática:** Se ejecuta SOLO si se detectan problemas críticos o errores. Los warnings no disparan reparación automática.

4. **Logging:** Todas las validaciones y reparaciones se registran en console para trazabilidad.

5. **Backward Compatibility:** Los campos legacy se mantienen sincronizados para compatibilidad con código anterior.

---

## 📝 Logs de Ejemplo

### Validación Exitosa
```
🛡️ Ejecutando validación de integridad de datos...
✅ Validación de integridad: Sin problemas detectados
```

### Validación con Problemas
```
🛡️ Ejecutando validación de integridad de datos...
⚠️ PROBLEMAS DE INTEGRIDAD DETECTADOS:
   🚨 Críticos: 3
   ❌ Errores: 2
   ⚠️ Advertencias: 8

🔧 Iniciando reparación automática de datos...

═══════════════════════════════════════════════════════
🔧 REPORTE DE REPARACIÓN DE DATOS - YUKYU PRO
═══════════════════════════════════════════════════════

📊 Total empleados reparados: 3

1. 諸岡 貴士 (HM0006)
   Acciones realizadas: 4
   - currentGrantedTotal: undefined → 14日
     Razón: Recalculado desde 2 períodos vigentes
   - currentBalance: 30日 → 6日
     Razón: Recalculado desde 2 períodos vigentes
   - grantedTotal (legacy): 30日 → 14日
     Razón: Sincronizar con currentGrantedTotal
   - balance (legacy): 30日 → 6日
     Razón: Sincronizar con currentBalance

✅ Reparación completada

🔍 Validación post-reparación:
   🚨 Críticos: 0
   ❌ Errores: 0
   ⚠️ Advertencias: 0
```

---

## 🔒 Garantías Empresariales

✅ **Datos 100% consistentes** entre todos los componentes
✅ **Detección automática** de problemas al cargar datos
✅ **Reparación automática** sin intervención manual
✅ **Trazabilidad completa** mediante console logs
✅ **Validación post-reparación** para verificar corrección
✅ **Exportación de reportes** para auditorías
✅ **Límite legal aplicado** automáticamente (40日)
✅ **Backward compatibility** mantenida

---

## 📄 Licencia

MIT - Uso libre para empresas
