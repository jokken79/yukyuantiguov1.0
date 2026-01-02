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
