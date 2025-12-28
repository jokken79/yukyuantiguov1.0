# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Yukyu Pro** is a React-based leave management system for Japanese paid leave (有給休暇) compliance. It helps companies track whether employees with 10+ granted days take the legally required 5+ days annually (Labor Standards Act Article 39).

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

The key is exposed via Vite's `define` config as `process.env.API_KEY` and `process.env.GEMINI_API_KEY`.

## Architecture

### Data Flow
The app is fully client-side with localStorage persistence:
```
localStorage ("yukyu_pro_storage")
    → db.loadData() → AppData {employees[], records[], config}
    → React component state
    → UI rendering
```

No backend API exists. External API: Google Gemini AI for compliance analysis.

### Tab-Based Navigation
Six main modules accessed via Sidebar:
1. **Dashboard** - Analytics, charts, AI-generated compliance insights
2. **EmployeeList** - Roster with search, filtering, pagination
3. **LeaveRequest** - Submit new leave applications
4. **ApplicationManagement** - Approve/reject leave requests (single & bulk)
5. **AccountingReports** - Financial/payroll reporting
6. **ExcelSync** - Import data from two Excel file types

### Key Services (`/services`)
- **db.ts** - localStorage CRUD wrapper, employee/record management
- **geminiService.ts** - Gemini AI integration for compliance analysis
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
- Required sheets: `DBGenzaiX`, `DBUkeoiX`, `DBStaffX`
- Imports: employee ID, name, client, status

**有給休暇管理 (Leave Management)**
- Required sheets: `作業者データ　有給`, `請負`
- Imports: all leave balance fields, up to 40 leave date columns

Files are merged by employee ID (`社員№`).

## Conventions

- **Code language**: English for variables/functions
- **UI language**: Japanese throughout
- **Styling**: Tailwind CSS via CDN with glassmorphism effects
- **Theme**: Dark mode default, stored in localStorage (`uns-yukyu-theme`), respects system preference
- **Path alias**: `@/*` resolves to project root

## Key Business Logic

Compliance calculation in Dashboard:
- Employees with `grantedTotal >= 10` must take at least 5 days
- `usedTotal < 5` triggers legal risk warning
- Dashboard prominently displays at-risk employees with details
