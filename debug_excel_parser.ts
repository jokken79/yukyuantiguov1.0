import * as XLSX from 'xlsx';

// Mock data simulating an Excel file with title rows
const mockData = [
  ["【新】社員台帳(UNS)T"], // Row 1: Title
  ["作成日: 2022/04/05"],   // Row 2: Metadata
  [],                       // Row 3: Empty
  ["社員№", "氏名", "派遣先", "付与合計", "消化合計"], // Row 4: Actual Headers
  [1001, "山田 太郎", "本社", 20, 10],               // Row 5: Data
  [1002, "鈴木 一郎", "工場A", 15, 5]
];

// Create a workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(mockData);
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

// Simulate the logic in ExcelSync.tsx
const firstSheetName = wb.SheetNames[0];
const firstSheet = wb.Sheets[firstSheetName];
const jsonData = XLSX.utils.sheet_to_json<any>(firstSheet);

console.log("--- Raw JSON Data (Current Logic) ---");
console.log(JSON.stringify(jsonData, null, 2));

// Test extraction logic
const employees: any[] = [];
jSONData.forEach((row: any) => {
  const findVal = (keys: string[]) => {
    const foundKey = Object.keys(row).find(k => keys.includes(k.trim()));
    return foundKey ? row[foundKey] : null;
  };

  const id = String(findVal(['社員№', '社員番号', '社員ID', 'ID', 'No', '№']));
  
  if (id && id !== 'undefined' && id !== 'null') {
      employees.push({ id, row });
  }
});

console.log("\n--- Extracted Employees ---");
console.log(employees);

if (employees.length === 0) {
    console.log("\n[FAIL] No employees extracted. The header row was likely missed.");
} else {
    console.log("\n[SUCCESS] Employees extracted.");
}

