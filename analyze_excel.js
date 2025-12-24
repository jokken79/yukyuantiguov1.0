import * as XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'D:\\【新】社員台帳(UNS)T　2022.04.05～.xlsm';

console.log('=== EXCEL FILE ANALYSIS ===\n');
console.log('File:', filePath);

try {
  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  console.log('\n=== SHEETS ===');
  console.log('Sheet names:', workbook.SheetNames);

  // Analyze first sheet
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  console.log('\n=== FIRST SHEET:', firstSheetName, '===');

  // Get range
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  console.log('Range:', sheet['!ref']);
  console.log('Rows:', range.e.r + 1, 'Cols:', range.e.c + 1);

  // Read first 30 rows as array
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  console.log('\n=== FIRST 30 ROWS (Looking for headers) ===');
  const targetKeywords = ['社員', '氏名', 'Employee', 'Name', 'ID', 'No', '№', '名前', '派遣先', '番号'];

  for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) {
      console.log(`Row ${i}: [empty]`);
      continue;
    }

    // Check for keywords
    const cells = row.slice(0, 15).map(c => String(c || '').trim());
    const matchCount = cells.filter(cell =>
      targetKeywords.some(kw => cell.includes(kw))
    ).length;

    const display = cells.slice(0, 10).join(' | ');
    console.log(`Row ${i} (matches: ${matchCount}): ${display}`);
  }

  // Find header row
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const matchCount = row.filter(cell =>
      cell && typeof cell === 'string' && targetKeywords.some(kw => cell.includes(kw))
    ).length;

    if (matchCount >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  console.log('\n=== DETECTED HEADER ROW ===');
  console.log('Header row index:', headerRowIndex);

  if (headerRowIndex >= 0) {
    console.log('Header cells:', rawRows[headerRowIndex]);

    // Get data using detected header
    const jsonData = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
    console.log('\n=== DATA SAMPLE (first 5 records) ===');
    console.log('Total records:', jsonData.length);

    if (jsonData.length > 0) {
      console.log('\nColumn names found:');
      console.log(Object.keys(jsonData[0]));

      console.log('\nFirst 5 records:');
      jsonData.slice(0, 5).forEach((row, idx) => {
        console.log(`\nRecord ${idx + 1}:`, JSON.stringify(row, null, 2).substring(0, 500));
      });
    }
  } else {
    console.log('NO HEADER ROW DETECTED!');
    console.log('\nChecking all sheets for potential data...');

    workbook.SheetNames.forEach(sheetName => {
      console.log(`\n--- Sheet: ${sheetName} ---`);
      const s = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' });
      console.log('Rows:', rows.length);
      if (rows.length > 0) {
        console.log('First row:', rows[0].slice(0, 10));
      }
    });
  }

  // Analyze ALL sheets
  console.log('\n\n=== ANALYZING ALL SHEETS ===');

  workbook.SheetNames.forEach(sheetName => {
    const s = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' });
    const dataRows = rows.filter(r => r && r.length > 0 && r.some(c => c !== ''));

    console.log(`\n--- Sheet: "${sheetName}" ---`);
    console.log(`Total rows: ${rows.length}, Data rows: ${dataRows.length}`);

    if (dataRows.length > 0) {
      console.log('Headers (Row 0):', dataRows[0].slice(0, 8));
      if (dataRows.length > 1) {
        console.log('Sample data (Row 1):', dataRows[1].slice(0, 8));
      }
    }
  });

} catch (error) {
  console.error('Error:', error.message);
}
