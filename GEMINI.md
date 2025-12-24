# Project Context: Yukyu Pro - Advanced Leave Management

## Overview
**Yukyu Pro** is a modern, React-based web application designed to manage employee paid leave (Yukyu) compliance in Japan. It specifically targets the legal requirement for employees with 10+ granted days to take at least 5 days of paid leave annually.

The application features a premium, dark-themed UI and integrates with Google's Gemini AI to provide intelligent insights regarding compliance risks.

## Tech Stack
- **Frontend Framework**: React 19 (via Vite)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Inferred from class usage), with custom animations and textures.
- **State Management/Persistence**: Local State + `localStorage` (No external database).
- **AI Integration**: Google GenAI SDK (`@google/genai`) - Model: `gemini-2.0-flash`.
- **Visualization**: Recharts.
- **Data Handling**: `xlsx` (Excel import/export), `jspdf` (PDF generation).

## Architecture & Key Directories

### `/src` (Root)
- **`App.tsx`**: Main application entry point. Handles routing (tab switching) and global layout.
- **`types.ts`**: Centralized TypeScript definitions for `Employee`, `LeaveRecord`, `AppData`, etc.

### `/components`
UI Modules corresponding to the main navigation tabs:
- **`Dashboard.tsx`**: Main overview.
- **`ExcelSync.tsx`**: Likely handles importing employee data from Excel files.
- **`EmployeeList.tsx`**: Roster view.
- **`LeaveRequest.tsx`**: Interface for logging leave.
- **`AccountingReports.tsx`**: Reporting view.
- **`Sidebar.tsx`**: Main navigation.

### `/services`
- **`db.ts`**: A wrapper around `localStorage` to simulate a database. Handles `saveData`, `loadData`, `upsertEmployee`.
- **`geminiService.ts`**: Integration with Google Gemini. Analyzes employee data to generate compliance warnings and action plans in JSON format.

## Key Data Models (`types.ts`)
- **`Employee`**: Tracks `grantedTotal`, `usedTotal`, `balance`, etc.
- **`LeaveRecord`**: Individual leave events.
- **`AppData`**: The root state object stored in `localStorage`.

## Setup & Running

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Configuration**:
    Create a `.env.local` file in the root directory:
    ```env
    VITE_GEMINI_API_KEY=your_api_key_here
    ```
    *(Note: Check code to confirm if it uses `VITE_` prefix or strictly `process.env`. `geminiService.ts` uses `process.env.API_KEY` which might need Vite config adjustment to `import.meta.env` or `define` plugin).*

3.  **Start Development Server**:
    ```bash
    npm run dev
    ```

4.  **Build**:
    ```bash
    npm run build
    ```

## Development Conventions
- **Language**: English for code (variables, functions), Japanese for UI text and AI prompts.
- **Styling**: Utility-first (Tailwind).
- **AI Prompts**: Structured to return strict JSON for UI consumption.
