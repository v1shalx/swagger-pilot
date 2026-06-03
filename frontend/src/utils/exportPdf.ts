import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { TestReport } from '../types';

export async function exportToPdf(report: TestReport, elementId: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Report export area not found');
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#030712',
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.setFontSize(14);
  pdf.text('SwaggerPilot Test Report', margin, 8);
  pdf.setFontSize(9);
  pdf.text(`${report.title} — ${new Date(report.completedAt).toLocaleString()}`, margin, 14);

  pdf.addImage(imgData, 'PNG', margin, position + 8, imgWidth, imgHeight);
  heightLeft -= pageHeight - position - 8;

  while (heightLeft > 0) {
    pdf.addPage();
    position = margin - (imgHeight - heightLeft);
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  pdf.save(`swagger-pilot-report-${timestamp}.pdf`);
}

export function exportToJson(report: TestReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `swagger-pilot-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
