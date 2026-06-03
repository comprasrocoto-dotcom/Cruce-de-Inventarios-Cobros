import React from 'react';
import { ArticleSummary, GlobalFilters } from '../types';
import { FileText } from 'lucide-react';

interface Props {
  data: ArticleSummary[];
  filters: GlobalFilters;
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const fmtNumber = (val: number) =>
  new Intl.NumberFormat('es-CO').format(val);

export const PDFReport: React.FC<Props> = ({ data, filters }) => {
  const generatePDF = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let yPos = margin;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('AUDITOR\u00cdA DE INVENTARIOS', margin, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Cruce de Inventarios y Cobros', margin, 19);
    doc.text('Generado: ' + new Date().toLocaleString('es-CO'), margin, 25);
    yPos = 38;

    // Filters section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Filtros Aplicados', margin, yPos);
    yPos += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const filterLines = [
      'Sede(s): ' + (filters.sedes.length ? filters.sedes.join(', ') : 'Todas'),
      'Per\u00edodo: ' + (filters.fechaInicio || 'Inicio') + ' - ' + (filters.fechaFin || 'Fin'),
      'B\u00fasqueda: ' + (filters.search || 'Sin filtro'),
      'Total registros: ' + fmtNumber(data.length),
    ];
    filterLines.forEach(function(line) {
      doc.text(line, margin, yPos);
      yPos += 5;
    });
    yPos += 4;

    // Executive Summary
    const faltantes = data.filter(function(a) { return (a.totalFaltantes ?? 0) > 0; });
    const sobrantes = data.filter(function(a) { return (a.totalSobrantes ?? 0) > 0; });
    const totalPerdidas = faltantes.reduce(function(s, a) { return s + (a.valorPerdida ?? 0); }, 0);
    const totalSobrantesVal = sobrantes.reduce(function(s, a) { return s + (a.valorSobrante ?? 0); }, 0);
    const conNovedades = data.filter(function(a) { return a.totalDiferencia !== 0; }).length;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Ejecutivo', margin, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin, right: margin },
      head: [['Indicador', 'Valor']],
      body: [
        ['Total Productos Revisados', fmtNumber(data.length)],
        ['Productos Con Novedades', fmtNumber(conNovedades)],
        ['Productos Sin Novedad', fmtNumber(data.length - conNovedades)],
        ['Total P\u00e9rdidas', fmtCurrency(totalPerdidas)],
        ['Total Sobrantes', fmtCurrency(totalSobrantesVal)],
        ['Balance Final', fmtCurrency(totalSobrantesVal - totalPerdidas)],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Novedades Table
    if (yPos > 230) { doc.addPage(); yPos = margin; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Listado de Novedades', margin, yPos);
    yPos += 6;

    const conNovedadesData = data.filter(function(a) { return a.totalDiferencia !== 0; })
      .sort(function(a, b) { return Math.abs(b.totalDiferencia) - Math.abs(a.totalDiferencia); });

    autoTable(doc, {
      startY: yPos,
      margin: { left: margin, right: margin },
      head: [['Sede', 'Producto', 'Faltante', 'Sobrante', 'Neto', 'Valor P\u00e9rdida']],
      body: conNovedadesData.map(function(a) { return [
        a.sede,
        a.articulo.length > 30 ? a.articulo.substring(0, 30) + '...' : a.articulo,
        fmtNumber(a.totalFaltantes ?? 0),
        fmtNumber(a.totalSobrantes ?? 0),
        (a.totalDiferencia > 0 ? '+' : '') + fmtNumber(a.totalDiferencia),
        fmtCurrency(a.valorPerdida ?? 0),
      ]; }),
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 60 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 29 },
      },
      didParseCell: function(data: any) {
        if (data.section === 'body' && data.column.index === 4) {
          const val = parseFloat(data.cell.text[0].replace(/[^0-9-]/g, ''));
          if (val < 0) data.cell.styles.textColor = [220, 38, 38];
          else if (val > 0) data.cell.styles.textColor = [22, 163, 74];
        }
      },
    });

    // Footer on each page
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text('PROMPT MAESTRO - Sistema de Auditor\u00eda de Inventarios', margin, 290);
      doc.text('P\u00e1gina ' + i + ' de ' + totalPages, pageWidth - margin, 290, { align: 'right' });
    }

    const fecha = new Date().toISOString().split('T')[0];
    doc.save('auditoria-inventarios-' + fecha + '.pdf');
  };

  return (
    <button
      onClick={generatePDF}
      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
    >
      <FileText className="w-4 h-4" />
      Exportar PDF
    </button>
  );
};

export default PDFReport;
