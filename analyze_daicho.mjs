import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Analizar el archivo DAICHO (社員台帳)
const filePath = join(__dirname, '【新】社員台帳(UNS)T　2022.04.05～.xlsm');

console.log('='.repeat(80));
console.log('ANÁLISIS DEL DAICHO: 【新】社員台帳(UNS)T　2022.04.05～.xlsm');
console.log('='.repeat(80));

try {
  const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });

  console.log('\n📋 SHEETS ENCONTRADOS:');
  console.log('-'.repeat(40));
  workbook.SheetNames.forEach((name, i) => {
    console.log('  ' + (i + 1) + '. "' + name + '"');
  });

  // Analizar cada sheet en detalle
  workbook.SheetNames.forEach(sheetName => {
    console.log('\n' + '='.repeat(80));
    console.log('📊 SHEET: "' + sheetName + '"');
    console.log('='.repeat(80));

    const sheet = workbook.Sheets[sheetName];
    if (!sheet['!ref']) {
      console.log('  ⚠️  Sheet vacío');
      return;
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log('  Rango: ' + sheet['!ref']);
    console.log('  Filas: ' + (range.e.r - range.s.r + 1) + ', Columnas: ' + (range.e.c - range.s.c + 1));

    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Mostrar primeras 15 filas para entender estructura
    console.log('\n  📝 PRIMERAS 15 FILAS:');
    console.log('-'.repeat(70));
    for (let i = 0; i < Math.min(15, rawData.length); i++) {
      const row = rawData[i];
      if (row && row.some(cell => cell !== '')) {
        const cells = [];
        for (let j = 0; j < Math.min(15, row.length); j++) {
          const cell = row[j];
          if (cell !== '') {
            const colLetter = XLSX.utils.encode_col(j);
            const cellVal = String(cell).substring(0, 12);
            cells.push(colLetter + ':' + cellVal);
          }
        }
        console.log('  Fila ' + (i + 1) + ': ' + cells.join(' | '));
      }
    }

    // Buscar fila de headers
    console.log('\n  🔍 BUSCANDO HEADERS (keywords: 社員, 氏名, ID, №):');
    const keywords = ['社員', '氏名', 'ID', '№', '派遣先', '入社', 'Name'];
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i] || [];
      const matches = row.filter(cell =>
        cell && typeof cell === 'string' &&
        keywords.some(kw => cell.includes(kw))
      );
      if (matches.length >= 2) {
        console.log('  ✅ Fila ' + (i + 1) + ' parece ser HEADER: ' + matches.join(', '));
      }
    }

    // Contar filas con datos
    const dataRows = rawData.filter(row => row && row.some(cell => cell !== '')).length;
    console.log('\n  📈 Total filas con datos: ' + dataRows);
  });

  // Verificar sheets esperados por el código
  console.log('\n' + '='.repeat(80));
  console.log('⚠️  VERIFICACIÓN DE SHEETS ESPERADOS POR ExcelSync.tsx:');
  console.log('='.repeat(80));
  const expectedSheets = ['DBGenzaiX', 'DBUkeoiX', 'DBStaffX'];
  expectedSheets.forEach(name => {
    const found = workbook.SheetNames.includes(name);
    console.log('  ' + name + ': ' + (found ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'));
  });

} catch (err) {
  console.error('Error:', err.message);
}
