
import { Employee } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sanitizeValue } from '../utils/csvSanitizer';

export const exportEmployeesToCSV = (employees: Employee[]) => {
  if (employees.length === 0) {
    alert("エクスポートするデータがありません。");
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
    alert('PDFの出力に失敗しました。');
  }
};
