
import { Employee, PeriodHistory } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeValue } from '../utils/csvSanitizer';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export const exportEmployeesToCSV = (employees: Employee[]) => {
  if (employees.length === 0) {
    toast.error("エクスポートするデータがありません。");
    return;
  }

  const headers = ['社員№', '氏名', '派遣先', '付与合計', '消化合計', '期末残高', '時効数', '状態', '最終同期'];
  const rows = employees.map(e => [
    e.id,
    e.name,
    e.client,
    e.grantedTotal,
    e.usedTotal,
    e.balance,
    e.expiredCount,
    e.status,
    e.lastSync
  ]);

  let csvContent = headers.join(',') + '\n';
  rows.forEach(row => {
    // ⭐ NUEVO: Sanitizar cada celda para prevenir CSV formula injection (BUG #6)
    const sanitizedRow = row.map(val => sanitizeValue(val));
    csvContent += sanitizedRow.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',') + '\n';
  });

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `yukyu_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#050505',
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // If content is taller than one page, we could add pages, 
    // but for simple dashboard/list view, we scale to fit or use a long page.
    // For simplicity, we add it as one continuous image scaled to width.
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  } catch (error) {
    console.error('PDF export failed', error);
    toast.error('PDFの出力に失敗しました。');
  }
};

// ==================== EXCEL EXPORT FUNCTIONS ====================

/**
 * Convierte una fecha ISO string a número de fecha de Excel
 * Fórmula inversa a la importación: (timestamp / 86400000) + 25569
 */
function dateToExcelNumber(isoDateString: string): number {
  if (!isoDateString) return 0;

  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return 0;

    // Fórmula INVERSA a excelDateToISO():
    // Excel date = (JS timestamp / 86400000) + 25569
    const excelDate = (date.getTime() / 86400000) + 25569;
    return Math.floor(excelDate);
  } catch {
    return 0;
  }
}

/**
 * Distribuye un array de fechas en columnas "1" a "40"
 * Retorna objeto con keys "1", "2", ... "40" y values como números Excel
 */
function distributeYukyuDates(dates: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  const limitedDates = dates.slice(0, 40); // Máximo 40

  limitedDates.forEach((dateStr, index) => {
    const cleanDate = dateStr.replace(/半休$/, '').trim(); // Limpiar sufijos
    const excelNum = dateToExcelNumber(cleanDate);

    if (excelNum > 0) {
      result[String(index + 1)] = excelNum; // "1", "2", "3", ..., "40"
    }
  });

  return result;
}

/**
 * Combina fechas del período Excel + aprobaciones locales que pertenecen al período
 * Filtra fechas locales por rango de fechas del período
 */
function mergeLocalApprovals(
  period: PeriodHistory,
  employee: Employee
): string[] {
  // Fechas del Excel del período
  const periodDates = [...(period.yukyuDates || [])];

  // Aprobaciones locales
  const localDates = employee.localModifications?.approvedDates || [];

  // Filtrar locales que pertenecen a ESTE período
  const periodStartDate = new Date(period.grantDate);
  const periodEndDate = new Date(period.expiryDate);

  const localDatesInPeriod = localDates.filter(dateStr => {
    const date = new Date(dateStr);
    return date >= periodStartDate && date < periodEndDate;
  });

  // Combinar y eliminar duplicados
  const allDates = [...periodDates, ...localDatesInPeriod];
  const uniqueDates = Array.from(new Set(allDates));

  // Ordenar cronológicamente
  return uniqueDates.sort((a, b) =>
    new Date(a).getTime() - new Date(b).getTime()
  );
}

/**
 * Genera una fila de Excel con todas las columnas necesarias
 * Soporta datos de período (periodHistory) o fallback legacy
 */
function generateExcelRow(
  employee: Employee,
  period?: PeriodHistory,
  mergedDates?: string[]
): Record<string, any> {
  const row: Record<string, any> = {};

  // Columnas básicas (SIEMPRE)
  row['在職中'] = employee.status || '在職中';
  row['社員№'] = employee.id;
  row['派遣先'] = employee.client;
  row['氏名'] = employee.name;
  row['カナ'] = employee.nameKana || '';

  if (employee.entryDate) {
    row['入社日'] = dateToExcelNumber(employee.entryDate);
  }

  if (period) {
    // DATOS DEL PERÍODO (periodHistory existe)
    row['経過月数'] = employee.elapsedTime || '';
    row['経過月'] = period.elapsedMonths;

    if (period.yukyuStartDate) {
      row['有給発生日'] = dateToExcelNumber(period.yukyuStartDate);
    }

    row['付与数'] = period.granted;
    row['繰越'] = period.carryOver || '';
    row['保有数'] = period.granted + (period.carryOver || 0);
    row['消化日数'] = period.used;
    row['期末残高'] = period.balance;
    row['時効数'] = period.expired;
    row['時効後残'] = period.balance;

    // Distribuir fechas merged en columnas 1-40
    if (mergedDates && mergedDates.length > 0) {
      const dateColumns = distributeYukyuDates(mergedDates);
      Object.assign(row, dateColumns);
    }
  } else {
    // FALLBACK LEGACY (sin periodHistory)
    row['経過月数'] = employee.elapsedTime || '';
    row['経過月'] = employee.elapsedMonths || 0;

    if (employee.yukyuStartDate) {
      row['有給発生日'] = dateToExcelNumber(employee.yukyuStartDate);
    }

    row['付与数'] = employee.grantedTotal;
    row['繰越'] = employee.carryOver || '';
    row['保有数'] = employee.totalAvailable || employee.grantedTotal;
    row['消化日数'] = employee.usedTotal;
    row['期末残高'] = employee.balance;
    row['時効数'] = employee.expiredCount;
    row['時効後残'] = employee.remainingAfterExpiry || employee.balance;

    if (employee.yukyuDates && employee.yukyuDates.length > 0) {
      const dateColumns = distributeYukyuDates(employee.yukyuDates);
      Object.assign(row, dateColumns);
    }
  }

  return row;
}

/**
 * Exporta todos los empleados a Excel con formato idéntico al archivo de importación
 * - Múltiples filas por empleado (una por período)
 * - 40 columnas de fechas ("1" a "40")
 * - Sheets separados por categoría
 * - Incluye datos Excel originales + aprobaciones locales
 */
export const exportEmployeesToExcel = (employees: Employee[]) => {
  if (employees.length === 0) {
    toast.error("エクスポートするデータがありません。");
    return;
  }

  try {
    const workbook = XLSX.utils.book_new();

    // Agrupar por categoría
    const categories = {
      '作業者データ　有給': employees.filter(e =>
        e.category === '派遣社員' || !e.category
      ),
      '請負': employees.filter(e =>
        e.category === '請負社員'
      )
    };

    // Crear sheet por categoría
    Object.entries(categories).forEach(([sheetName, employeeList]) => {
      const allRows: Record<string, any>[] = [];

      // Generar filas
      employeeList.forEach(employee => {
        if (employee.periodHistory && employee.periodHistory.length > 0) {
          // MÚLTIPLES FILAS (una por período)
          employee.periodHistory.forEach(period => {
            const mergedDates = mergeLocalApprovals(period, employee);
            const row = generateExcelRow(employee, period, mergedDates);
            allRows.push(row);
          });
        } else {
          // UNA FILA (fallback legacy)
          const row = generateExcelRow(employee);
          allRows.push(row);
        }
      });

      // Crear worksheet
      if (allRows.length > 0) {
        const header = [
          '在職中', '社員№', '派遣先', '氏名', 'カナ', '入社日',
          '経過月数', '経過月', '有給発生日', '付与数', '繰越', '保有数',
          '消化日数', '期末残高', '時効数', '時効後残',
          ...Array.from({ length: 40 }, (_, i) => String(i + 1))
        ];

        const worksheet = XLSX.utils.json_to_sheet(allRows, { header });
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    });

    // Descargar archivo
    const filename = `有給休暇管理_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);

  } catch (error) {
    console.error('Excel export failed:', error);
    toast.error('Excelの出力に失敗しました。');
  }
};
