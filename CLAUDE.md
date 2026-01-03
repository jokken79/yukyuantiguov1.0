# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Rules

**IMPORTANT**: Always communicate with the user in Spanish. All responses, explanations, questions, and documentation should be in Spanish, even though the codebase uses English for variable names and comments.

## Project Overview

**Yukyu Pro** is a React-based leave management system for Japanese paid leave (有給休暇) compliance. It helps companies track whether employees with 10+ granted days take the legally required 5+ days annually (Labor Standards Act Article 39).

**Tech Stack**: React 19 + TypeScript + Vite + Tailwind CSS (via CDN)

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

No test or lint commands are configured.

## Environment Setup

Create `.env.local` in the project root:
```env
GEMINI_API_KEY=your_api_key_here
```

**Important**: The Gemini API key is optional. The app handles missing keys gracefully by showing an info message instead of crashing. The key is exposed via Vite's `define` config as both `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

## Architecture

### Data Flow
The app is **fully client-side** with localStorage persistence:
```
localStorage ("yukyu_pro_storage")
    → db.loadData() → AppData {employees[], records[], config}
    → React component state
    → UI rendering
```

**Critical**: No backend API exists. All data is stored in browser localStorage. External API: Google Gemini AI for compliance analysis only.

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
- **geminiService.ts** - Gemini AI integration for compliance analysis
  - Lazy initialization pattern (doesn't crash if API key missing)
  - Uses `gemini-3-flash-preview` model with JSON schema for structured insights
- **exportService.ts** - CSV and PDF export utilities
- **nameConverter.ts** - Romaji to Katakana conversion (supports Vietnamese, Portuguese names)

### Data Models (`types.ts`)
- **Employee** - Core employee record with leave balance data
- **LeaveRecord** - Individual leave request with approval status
- **AppData** - Root state object containing employees[], records[], config{}
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
