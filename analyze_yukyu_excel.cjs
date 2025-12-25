const XLSX = require('xlsx');
const path = require('path');

// Analizar el archivo de yukyus
const filePath = path.join(__dirname, '有給休暇管理.xlsm');

console.log('='.repeat(80));
console.log('ANÁLISIS EXHAUSTIVO DEL EXCEL: 有給休暇管理.xlsm');
console.log('='.repeat(80));

try {
  const workbook = XLSX.read(require('fs').readFileSync(filePath), { type: 'buffer' });

  console.log('\n📋 SHEETS ENCONTRADOS:');
  console.log('-'.repeat(40));
  workbook.SheetNames.forEach((name, idx) => {
    console.log(`  ${idx + 1}. "${name}"`);
  });

  // Analizar cada sheet
  workbook.SheetNames.forEach(sheetName => {
    console.log('\n' + '='.repeat(80));
    console.log(`📊 SHEET: "${sheetName}"`);
    console.log('='.repeat(80));

    const sheet = workbook.Sheets[sheetName];
    if (!sheet['!ref']) {
      console.log('  ⚠️  Sheet vacío');
      return;
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    console.log(`  Rango: ${sheet['!ref']}`);
    console.log(`  Filas: ${range.e.r - range.s.r + 1}, Columnas: ${range.e.c - range.s.c + 1}`);

    // Convertir a array de arrays para análisis
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Mostrar primeras 10 filas
    console.log('\n  📝 PRIMERAS 10 FILAS (raw data):');
    console.log('-'.repeat(60));
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i];
      if (row && row.some(cell => cell !== '')) {
        // Mostrar columnas A-G (índices 0-6) y sus valores
        const preview = row.slice(0, 20).map((cell, idx) => {
          const colLetter = XLSX.utils.encode_col(idx);
          const cellVal = cell === '' ? '(vacío)' : String(cell).substring(0, 15);
          return `${colLetter}:${cellVal}`;
        }).join(' | ');
        console.log(`  Fila ${i + 1}: ${preview}`);
      } else {
        console.log(`  Fila ${i + 1}: (vacía)`);
      }
    }

    // Analizar fila 5 específicamente (índice 4)
    if (rawData.length >= 5) {
      console.log('\n  🎯 ANÁLISIS FILA 5 (Headers según usuario):');
      console.log('-'.repeat(60));
      const row5 = rawData[4] || [];
      row5.forEach((cell, idx) => {
        if (cell !== '') {
          const colLetter = XLSX.utils.encode_col(idx);
          console.log(`    ${colLetter}5: "${cell}"`);
        }
      });
    }

    // Analizar fila 6 (primer dato según usuario)
    if (rawData.length >= 6) {
      console.log('\n  📊 ANÁLISIS FILA 6 (Primera fila de datos):');
      console.log('-'.repeat(60));
      const row6 = rawData[5] || [];
      row6.forEach((cell, idx) => {
        if (cell !== '' && cell !== null && cell !== undefined) {
          const colLetter = XLSX.utils.encode_col(idx);
          const cellType = typeof cell;
          console.log(`    ${colLetter}6: "${String(cell).substring(0, 30)}" (tipo: ${cellType})`);
        }
      });
    }

    // Detectar estructura específica del usuario
    console.log('\n  🔍 VERIFICACIÓN DE ESTRUCTURA ESPERADA:');
    console.log('-'.repeat(60));
    const expectedColumns = {
      'B': 'Estado (在籍中/退社)',
      'C': 'ID empleado',
      'D': 'Fábrica',
      'E': 'Nombre (parte 1)',
      'F': 'Nombre (parte 2)',
      'G': 'Fecha entrada',
      'H': 'Tiempo transcurrido',
      'I': 'Meses',
      'J': 'Fecha yukyu',
      'K': 'Días otorgados',
      'L-Q': 'Cálculos',
      'R-BE': 'Fechas yukyus (40)',
      'BF': 'Fecha renuncia',
      'BG': 'Comentarios'
    };

    if (rawData.length >= 5) {
      const row5 = rawData[4] || [];
      // Columna B (índice 1)
      console.log(`    B5 (Estado): "${row5[1] || '(vacío)'}"`);
      // Columna C (índice 2)
      console.log(`    C5 (ID): "${row5[2] || '(vacío)'}"`);
      // Columna D (índice 3)
      console.log(`    D5 (Fábrica): "${row5[3] || '(vacío)'}"`);
      // Columna E (índice 4)
      console.log(`    E5 (Nombre1): "${row5[4] || '(vacío)'}"`);
      // Columna F (índice 5)
      console.log(`    F5 (Nombre2): "${row5[5] || '(vacío)'}"`);
      // Columna G (índice 6)
      console.log(`    G5 (Fecha entrada): "${row5[6] || '(vacío)'}"`);
      // Columna J (índice 9)
      console.log(`    J5 (Fecha yukyu): "${row5[9] || '(vacío)'}"`);
      // Columna K (índice 10)
      console.log(`    K5 (Días otorgados): "${row5[10] || '(vacío)'}"`);
      // Columna R (índice 17) - primera fecha yukyu
      console.log(`    R5 (1er yukyu): "${row5[17] || '(vacío)'}"`);
    }

    // Contar filas con datos
    const dataRows = rawData.filter((row, idx) => idx >= 5 && row && row.some(cell => cell !== '')).length;
    console.log(`\n  📈 Total filas con datos (desde fila 6): ${dataRows}`);
  });

  // Verificar si existen los sheets que busca el código actual
  console.log('\n' + '='.repeat(80));
  console.log('⚠️  VERIFICACIÓN DE SHEETS ESPERADOS POR EL CÓDIGO:');
  console.log('='.repeat(80));
  const expectedSheets = ['DBGenzaiX', 'DBUkeoiX', 'DBStaffX'];
  expectedSheets.forEach(name => {
    const found = workbook.SheetNames.includes(name);
    console.log(`  ${name}: ${found ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`);
  });

  // Sugerencia de sheets que podrían ser equivalentes
  console.log('\n  💡 SHEETS DISPONIBLES vs ESPERADOS:');
  console.log('  Código espera: DBGenzaiX, DBUkeoiX, DBStaffX');
  console.log('  Excel tiene: ' + workbook.SheetNames.join(', '));

} catch (err) {
  console.error('Error:', err.message);
}
