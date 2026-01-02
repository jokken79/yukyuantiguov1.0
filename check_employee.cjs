const XLSX = require('xlsx');
const path = require('path');

const filePath = 'C:\\Users\\Jpkken\\Downloads\\有給休暇管理 (1).xlsm';
console.log('Leyendo archivo:', filePath);

const wb = XLSX.readFile(filePath);
console.log('Hojas disponibles:', wb.SheetNames.join(', '));

const sheets = ['作業者データ　有給', '請負'];
sheets.forEach(sheetName => {
  if (wb.SheetNames.includes(sheetName)) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
    const found = data.filter(row => {
      const id = String(row['社員№'] || row['社員番号'] || row['社員ID'] || row['ID'] || row['No'] || row['№'] || '').trim();
      return id === '240321' || id.includes('240321');
    });
    console.log(`\n${sheetName}: ${found.length > 0 ? '✅ ENCONTRADO (' + found.length + ' filas)' : '❌ NO encontrado'}`);
    if (found.length > 0) {
      found.forEach((row, i) => {
        console.log(`\nFila ${i+1}:`);
        console.log('  社員№:', row['社員№'] || row['№']);
        console.log('  氏名:', row['氏名']);
        console.log('  付与数:', row['付与数']);
        console.log('  消化日数:', row['消化日数']);
        console.log('  残日数:', row['残日数'] || row['期末残高']);
      });
    }
  } else {
    console.log(`\n❌ Hoja "${sheetName}" no existe en el archivo`);
  }
});
