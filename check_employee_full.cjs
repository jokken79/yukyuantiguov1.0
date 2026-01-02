const XLSX = require('xlsx');

const filePath = 'C:\\Users\\Jpkken\\Downloads\\有給休暇管理 (1).xlsm';
const wb = XLSX.readFile(filePath);

const sheetName = '作業者データ　有給';
if (wb.SheetNames.includes(sheetName)) {
  const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
  const found = data.filter(row => {
    const id = String(row['社員№'] || row['社員番号'] || row['№'] || '').trim();
    return id === '240321';
  });

  console.log(`Empleado №240321 - Total filas encontradas: ${found.length}\n`);

  found.forEach((row, i) => {
    console.log(`\n═══════ FILA ${i+1} ═══════`);
    console.log('Campos completos:');
    Object.keys(row).forEach(key => {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        console.log(`  ${key}: ${row[key]}`);
      }
    });
  });
}
