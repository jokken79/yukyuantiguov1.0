# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Rules

**IMPORTANT**: Always communicate with the user in Spanish. All responses, explanations, questions, and documentation should be in Spanish, even though the codebase uses English for variable names and comments.

## Project Overview

**Yukyu Pro** is a React-based leave management system for Japanese paid leave (有給休暇) compliance. It helps companies track whether employees with 10+ granted days take the legally required 5+ days annually (Labor Standards Act Article 39).

**Tech Stack**: React 19 + TypeScript + Vite + Tailwind CSS (via CDN)

## Commands

```bash
# Frontend
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build to dist/
npm run preview      # Preview production build

# Backend (optional - in /backend folder)
cd backend
pip install -r requirements.txt
python main.py       # Start FastAPI server at http://localhost:8000
```

No test or lint commands are configured.

## Scripts de Inicio (Windows)

La carpeta `scripts/` contiene archivos .bat para iniciar la aplicación:

| Script | Descripción |
|--------|-------------|
| `start_all.bat` | **SUPER LAUNCHER v3.0** - Inicia frontend + backend con configuración completa |
| `start_app.bat` | Solo frontend con opción de puerto personalizado |
| `start_frontend.bat` | Solo frontend en puerto 3000 (default) |
| `start_backend.bat` | Solo backend FastAPI en puerto 8000 |

### SUPER LAUNCHER (`start_all.bat`)

El script más completo con las siguientes características:
- **Fase 1**: Configuración de puertos (Backend default: 8000, Frontend default: 3000)
- **Fase 2**: Limpieza opcional (node_modules, venv, __pycache__)
- **Fase 3**: Verificación e instalación de dependencias (venv + node_modules)
- **Fase 4**: Liberación automática de puertos ocupados
- **Fase 5**: Sincronización de configuración (.env.local con VITE_API_URL)
- **Fase 6**: Inicio de servicios en ventanas separadas + apertura de navegador

### Uso recomendado

```bash
# Opción 1: SUPER LAUNCHER (recomendado)
scripts\start_all.bat

# Opción 2: Manual con puerto específico
npm run dev -- --port 3777

# Opción 3: Liberar puertos ocupados (PowerShell)
Get-NetTCPConnection -LocalPort 3777 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force
```

**Nota importante**: `start_frontend.bat` navega a la raíz del proyecto (no a `/frontend`) ya que el código frontend activo está en la raíz.

## Environment Setup

Create `.env.local` in the project root:
```env
GEMINI_API_KEY=your_api_key_here
```

**Important**: The Gemini API key is optional. The app handles missing keys gracefully by showing an info message instead of crashing. The key is exposed via Vite's `define` config as both `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

## Project Structure

```
/ (root)                    # Main frontend code
├── components/             # React components
├── services/               # Business logic & data services
├── contexts/               # React contexts (ThemeContext)
├── hooks/                  # Custom hooks (useKeyboardShortcuts)
├── types.ts                # TypeScript definitions
├── App.tsx                 # Main app component
└── index.tsx               # Entry point

/backend/                   # Optional FastAPI backend (SQLite)
├── main.py                 # FastAPI entry point
├── src/routes/             # API routes (employees, records, ai)
└── yukyu.db                # SQLite database

/frontend/src/              # Duplicate/alternate frontend structure (mostly mirrors root)
```

**Note**: There's code duplication between root and `/frontend/src/`. The root folder is the actively used frontend codebase.

## Architecture

### Data Flow
The app is **primarily client-side** with localStorage persistence:
```
localStorage ("yukyu_pro_storage")
    → db.loadData() → AppData {employees[], records[], config}
    → React component state
    → UI rendering
```

**Primary storage**: Browser localStorage. Optional backend at `/backend/` provides FastAPI + SQLite persistence (proxied via `/api` in vite.config.ts). External API: Google Gemini AI for compliance analysis.

### State Management Pattern
Components follow a **shared state refresh pattern**:
- `App.tsx` holds the root `appData` state loaded from `db.loadData()`
- Child components receive `data` prop and `onUpdate`/`onSyncComplete` callbacks
- After mutations (approve, import, etc.), components call the callback which triggers `refreshData()` in App
- `refreshData()` re-runs `db.loadData()` to sync with latest localStorage state

### Tab-Based Navigation
Six main modules accessed via Sidebar:
1. **Dashboard** - Analytics, charts, AI-generated compliance insights
2. **EmployeeList** - Roster with search, filtering, pagination
3. **LeaveRequest** - Submit new leave applications
4. **ApplicationManagement** - Approve/reject leave requests (single & bulk)
5. **AccountingReports** - Financial/payroll reporting
6. **ExcelSync** - Import data from two Excel file types

### Key Services (`/services`)
- **db.ts** - localStorage CRUD wrapper with approval workflow methods
  - `addRecord()` - Creates pending leave requests
  - `approveRecord()`/`rejectRecord()` - Single approval actions, auto-updates employee balances
  - `approveMultiple()`/`rejectMultiple()` - Bulk approval operations
  - Auto-migration: Old records without status get `status: 'approved'` on load
  - Auto data repair: Calls `validateAllEmployees()` and `smartRepair()` on load
- **balanceCalculator.ts** - Single source of truth for leave balance calculations
  - `getEmployeeBalance()` - Calculates granted/used/remaining/expired days
  - `getEmployeePeriods()` - Returns all leave periods with expiry dates
  - `isLegalRisk()` - Checks if employee needs 5+ days (労働基準法39条)
  - Handles half-day leave (`:half` suffix in yukyuDates)
- **geminiService.ts** - Gemini AI integration for compliance analysis
  - Lazy initialization pattern (doesn't crash if API key missing)
  - Uses `gemini-2.0-flash` model with JSON schema for structured insights
- **expirationService.ts** - Period expiration tracking (2-year 時効)
  - `recalculateAllExpirations()` - Auto-runs on data load
- **mergeService.ts** - Excel import merge logic
  - `mergeExcelData()` - Combines DAICHO + YUKYU Excel data with existing employees
- **validationService.ts** - Pre-approval validation
  - `canApproveLeave()` - Validates balance, duplicates, retired status before approval
- **dataIntegrityValidator.ts** - Data health checks
  - `validateAllEmployees()` - Returns critical/error/warning counts
- **dataRepairService.ts** - Auto-repair corrupted data
  - `smartRepair()` - Fixes common data issues automatically
- **migrationService.ts** - Schema version migrations
- **exportService.ts** - CSV and PDF export utilities
- **nameConverter.ts** - Romaji to Katakana conversion (supports Vietnamese, Portuguese names)
- **api.ts** - Optional backend API client (for FastAPI backend)

### Data Models (`types.ts`)
- **Employee** - Core employee record with leave balance data, periodHistory[], and current/historical balance fields
- **LeaveRecord** - Individual leave request with approval status and duration (full/half)
- **AppData** - Root state object containing employees[], records[], config{}
- **PeriodHistory** - Detailed history of each yukyu grant period (see section below)
- **BalanceInfo** - Calculated balance info from balanceCalculator
- **ValidationResult** - Result from canApproveLeave() validation
- **AIInsight** - Gemini-generated compliance warnings

## Excel Import (ExcelSync)

Two file types with specific sheet requirements:

**社員台帳 (Employee Registry)**
- Required sheets: `DBGenzaiX` (派遣社員), `DBUkeoiX` (請負社員), `DBStaffX` (スタッフ)
- Imports: employee ID (`社員№`), name, client (`派遣先`), status (`在職中`/`退社`)
- Each sheet represents a different employee category

**有給休暇管理 (Leave Management)**
- Required sheets: `作業者データ　有給` (派遣社員), `請負` (請負社員)
- Imports: all leave balance fields (`付与数`, `消化日数`, `残高`, etc.)
- **Critical**: Extracts up to 40 leave dates from columns named `"1"` to `"40"` (with or without trailing space)
- Excel date conversion: `(excelDate - 25569) * 86400 * 1000`

**Import Logic**:
- Files are merged by employee ID (`社員№`)
- DAICHO creates/updates basic employee data
- YUKYU enriches existing employees with leave balance fields
- Toggle controls whether retired employees (`退社`) are imported
- Sync status persisted in localStorage (`yukyu_sync_status`)

## Conventions

- **Code language**: English for variables/functions
- **UI language**: Japanese throughout (all user-facing text, error messages, labels)
- **Styling**: Tailwind CSS via CDN with glassmorphism effects and noise texture overlay
- **Theme**: Dark mode default, stored in localStorage (`uns-yukyu-theme`), respects system preference
- **Path alias**: `@/*` resolves to project root
- **Loading patterns**: Skeleton screens on initial load and tab switches (300-600ms delays)
- **Logo**: Imagen externa `public/uns-logo.png` con fallback a texto CSS
- **TOP 10 使用者**: Nombres mostrados en カタカナ usando `getDisplayName()`

## Accesibilidad (a11y) - WCAG 2.1 AA

La aplicación implementa mejoras de accesibilidad en todos los componentes principales:

### CSS Global (`index.html`)
- `:focus-visible` con outline azul para navegación por teclado
- `@media (prefers-reduced-motion)` para usuarios sensibles a animaciones
- Clase `.sr-only` para contenido exclusivo de screen readers

### Componentes con ARIA

**Sidebar.tsx**
- `role="navigation"` con `aria-label="メインナビゲーション"`
- `aria-current="page"` en tab activo
- `aria-expanded` y `aria-controls` en hamburger móvil

**EmployeeList.tsx**
- Tabla con `role="grid"` y `aria-sort` en headers ordenables
- Paginación con `<nav aria-label>` y `aria-current="page"`
- Modal con `aria-modal`, `aria-labelledby`, `aria-describedby`

**ApplicationManagement.tsx**
- Filtros de estado con `aria-pressed`
- Checkboxes con `aria-label` dinámico (nombre del empleado)
- Live region `aria-live="polite"` para conteo de selección
- Tabla con `role="grid"` y `role="gridcell"`

**LeaveRequest.tsx**
- Formularios con `<fieldset>` y `<legend>` semánticos
- Labels con `htmlFor` vinculados a inputs
- `aria-invalid` y `aria-describedby` para validación de errores

**Dashboard.tsx**
- Sección KPI con `role="region"` y `aria-labelledby`
- Cards KPI con `role="group"` y `aria-label` descriptivos
- 消化合計 KPI: Validación de NaN/undefined para evitar mostrar "NaN日"
- TOP 10 使用者: Usa `displayName` con カタカナ y tooltip mejorado

**ThemeToggle.tsx**
- `role="switch"` con `aria-checked`
- `aria-hidden="true"` en iconos decorativos

### Puntuación estimada: 8/10 WCAG 2.1 AA

## Key Business Logic

### Legal Compliance Calculation
Dashboard identifies employees at legal risk:
- Employees with `grantedTotal >= 10` AND `status === '在職中'` must take at least 5 days
- `usedTotal < 5` triggers legal risk warning
- Dashboard prominently displays at-risk employees with specific deficit (`5 - usedTotal`)

### Approval Workflow
Leave requests follow a three-state lifecycle:
1. **pending** - Newly created requests (via LeaveRequest tab)
2. **approved** - Manager approved, employee balance auto-decremented
3. **rejected** - Manager rejected, no balance impact

**Important**: Only `pending` requests can be approved/rejected. Approved records cannot be deleted (data integrity protection).

### 半日有給 (Half-Day Leave) Support

El sistema soporta solicitudes de medio día (0.5日):

**LeaveRecord.duration field**:
- `'full'` - Día completo (1.0日) - default
- `'half'` - Medio día (0.5日)

**Encoding en yukyuDates[]**:
- Día completo: `"YYYY-MM-DD"`
- Medio día: `"YYYY-MM-DD:half"`

**Cálculo de balance** (`balanceCalculator.ts`):
```typescript
function parseYukyuDate(dateStr: string): { date: string; value: number } {
  if (dateStr.endsWith(':half')) {
    return { date: dateStr.replace(':half', ''), value: 0.5 };
  }
  return { date: dateStr, value: 1 };
}
```

**UI indicators**:
- LeaveRequest: Botones 全日/半日 para seleccionar duración
- ApplicationManagement: Muestra "(半日)" o "(全日)" junto al tipo
- EmployeeList: Muestra "(半)" junto a fechas de medio día
- AccountingReports: Muestra "(半)" y calcula totales correctamente

### Fin de Semana Permitido (4x2 Shifts)

El sistema **NO bloquea** sábados y domingos para permitir trabajadores con turnos 4x2 (trabajan 4 días, descansan 2). La validación de fin de semana fue eliminada de `LeaveRequest.tsx`.

### Reportes Contables (AccountingReports)

**Selector de año dinámico**: Muestra desde 2024 hasta el año actual (no hardcodeado).

**Cálculo de medios días**: Los reportes calculan correctamente 0.5 para `duration: 'half'`.

**Indicador visual**: Las fechas de medio día muestran "(半)" en amarillo.

## Sistema de Períodos de Yukyu (periodHistory)

Cada empleado tiene un array `periodHistory` que almacena el historial completo de períodos de yukyu (有給休暇) otorgados a lo largo de su carrera.

### Estructura de datos (`PeriodHistory`)

```typescript
interface PeriodHistory {
  periodIndex: number;      // Índice del período (0, 1, 2...)
  periodName: string;       // Nombre legible (初回(6ヶ月), 1年6ヶ月, 2年6ヶ月...)
  elapsedMonths: number;    // Meses desde entrada (6, 18, 30, 42, 54, 66...)
  yukyuStartDate: string;   // Fecha de inicio de validez
  grantDate: Date;          // Fecha de otorgamiento
  expiryDate: Date;         // Fecha de vencimiento (2 años después)
  granted: number;          // Días otorgados en este período
  used: number;             // Días consumidos
  balance: number;          // Días restantes
  expired: number;          // Días expirados (時効)
  carryOver?: number;       // Días transferidos del período anterior
  isExpired: boolean;       // Si el período ya venció
  isCurrentPeriod: boolean; // Si es el período actual
  yukyuDates: string[];     // Array de fechas de uso
  source: string;           // Origen de datos ('excel', 'manual')
  syncedAt: string;         // Timestamp de última sincronización
}
```

### Valores válidos de elapsedMonths

Los períodos de yukyu se otorgan en intervalos específicos según la ley laboral japonesa:

| elapsedMonths | periodName | 付与日数 (días según ley) |
|---------------|------------|---------------------------|
| 6 | 初回(6ヶ月) | 10日 |
| 18 | 1年6ヶ月 | 11日 |
| 30 | 2年6ヶ月 | 12日 |
| 42 | 3年6ヶ月 | 14日 |
| 54 | 4年6ヶ月 | 16日 |
| 66 | 5年6ヶ月 | 18日 |
| 78+ | 6年6ヶ月+ | 20日 (máximo) |

### Columnas de Excel soportadas para 経過月

La función `findValue()` usa normalización Unicode para buscar columnas:
- `経過月` (estándar)
- `経過月数` (con 数)
- `經過月` (kanji tradicional)
- Cálculo automático desde `有給発生日` - `入社日` (fallback)

### Lógica de importación (buildPeriodHistory)

1. **Normalización Unicode**: Los nombres de columnas se normalizan con NFKC para manejar variaciones de kanji (経 vs 經)
2. **Fallback de fechas**: Si `経過月` no se encuentra, se calcula desde la diferencia entre `有給発生日` y `入社日`
3. **Deduplicación**: Se usa Map con `elapsedMonths` como key para evitar duplicados
4. **Mergeo de fechas**: Períodos duplicados mergean sus `yukyuDates` sin duplicar

### Cálculo de valores actuales vs históricos

- **currentGrantedTotal/currentBalance**: Solo períodos vigentes (no expirados)
- **historicalGrantedTotal/historicalBalance**: Todos los períodos incluyendo expirados

Los valores "current" se usan para mostrar el balance disponible, mientras que los "historical" se usan para reportes y auditoría.
