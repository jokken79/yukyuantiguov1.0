const XLSX = require('xlsx');

const filePath = 'C:\\Users\\Jpkken\\Downloads\\有給休暇管理 (1).xlsm';
const wb = XLSX.readFile(filePath);

const sheetName = '作業者データ　有給';
if (wb.SheetNames.includes(sheetName)) {
  const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

  // Buscar por Kenji (兼城 o 賢士 o Kaneshiro)
  const found = data.filter(row => {
    const name = String(row['氏名'] || '');
    return name.includes('兼城') || name.includes('賢士') || name.includes('KANESHIRO');
  });

  if (found.length > 0) {
    console.log(`✅ Encontrado: ${found[0]['氏名']} - Total ${found.length} filas\n`);

    found.forEach((row, i) => {
      console.log(`\n═══ PERÍODO ${i+1} ═══`);
      console.log('社員№:', row['社員№']);
      console.log('氏名:', row['氏名']);
      console.log('入社日:', row['入社日']);
      console.log('経過月:', row['経過月']);
      console.log('有給発生日:', row['有給発生'] || row['有給発生日']);
      console.log('付与数:', row['付与数']);
      console.log('消化日数:', row['消化日数']);
      console.log('期末残高:', row['期末残高'] || row['残日数']);
      console.log('時効数:', row['時効数'] || row['時効']);
      console.log('時効後残:', row['時効後残'] || row['時効後残日数']);

      // Mostrar fechas de yukyu
      const dates = [];
      for (let j = 1; j <= 40; j++) {
        const key = String(j);
        const keySpace = key + ' ';
        if (row[key] || row[keySpace]) {
          dates.push(row[key] || row[keySpace]);
        }
      }
      if (dates.length > 0) {
        console.log('Fechas de yukyu tomadas:', dates.length, 'días');
      }
    });

    console.log('\n\n📊 RESUMEN TOTAL (sumando todas las filas):');
    const total付与 = found.reduce((sum, r) => sum + (Number(r['付与数']) || 0), 0);
    const total消化 = found.reduce((sum, r) => sum + (Number(r['消化日数']) || 0), 0);
    const total残高 = found.reduce((sum, r) => sum + (Number(r['期末残高'] || r['残日数']) || 0), 0);
    const total時効 = found.reduce((sum, r) => sum + (Number(r['時効数'] || r['時効']) || 0), 0);

    console.log('付与合計:', total付与);
    console.log('消化合計:', total消化);
    console.log('残高合計:', total残高);
    console.log('時効合計:', total時効);
  } else {
    console.log('❌ No se encontró a Kenji Kaneshiro');
  }
}
