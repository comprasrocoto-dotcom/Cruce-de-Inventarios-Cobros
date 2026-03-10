import React, { useState } from 'react';
import { Card } from './Card';
import { InventoryItem, formatNumber, formatCurrency, cn } from '../utils';
import { Download, FileSpreadsheet, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface CobrosProps {
  data: InventoryItem[];
}

export const Cobros: React.FC<CobrosProps> = ({ data }) => {
  const [expandedSedes, setExpandedSedes] = useState<Record<string, boolean>>({});

  const toggleSede = (sede: string) => {
    setExpandedSedes(prev => ({ ...prev, [sede]: !prev[sede] }));
  };

  const sedes: string[] = Array.from(new Set(data.map(item => item.sede)));

  const getCobroStatus = (item: InventoryItem) => {
    const diff = item.variacionStock;
    const unit = (item.unidad || '').toLowerCase();
    
    if (diff >= 0) return "NO COBRA";

    const absDiff = Math.abs(diff);
    if (unit.includes('gramo') || unit === 'g') {
      return absDiff > 1000 ? "COBRA" : "NO COBRA";
    }
    if (unit.includes('onz') || unit === 'oz') {
      return absDiff > 5 ? "COBRA" : "NO COBRA";
    }
    return absDiff > 1 ? "COBRA" : "NO COBRA";
  };

  const exportExcel = () => {
    const exportData = data
      .filter(item => getCobroStatus(item) === "COBRA")
      .map(item => ({
        Sede: item.sede,
        Artículo: item.articulo,
        Unidad: item.unidad,
        Diferencia: item.variacionStock,
        Estado: getCobroStatus(item),
        'Coste Línea': item.costeLinea,
        'Total Cobro': Math.abs(item.variacionStock) * item.costeLinea
      }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cobros");
    XLSX.writeFile(wb, `Cobros_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("REPORTE DE COBROS POR FALTANTES", 14, 15);
    doc.setFontSize(10);
    doc.text(`Fecha Generación: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = data
      .filter(item => getCobroStatus(item) === "COBRA")
      .map(item => [
        item.sede,
        item.articulo,
        item.unidad,
        formatNumber(item.variacionStock, item.unidad),
        item.costeLinea.toFixed(2),
        (Math.abs(item.variacionStock) * item.costeLinea).toFixed(2)
      ]);

    (doc as any).autoTable({
      head: [['Sede', 'Artículo', 'Unidad', 'Diferencia', 'Coste', 'Total Cobro']],
      body: tableData,
      startY: 30,
      theme: 'grid',
      headStyles: { fillStyle: '#2E7BCF' }
    });

    doc.save(`Cobros_Inventario_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-brand-text">Gestión de Cobros</h2>
        <div className="flex gap-2">
          <button 
            onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-brand-table-header text-brand-text uppercase text-xs font-bold">
            <tr>
              <th className="px-4 py-3 border-b border-brand-border">Sede / Artículo</th>
              <th className="px-4 py-3 border-b border-brand-border">Unidad</th>
              <th className="px-4 py-3 border-b border-brand-border text-right">Diferencia Neta</th>
              <th className="px-4 py-3 border-b border-brand-border text-center">Estado</th>
              <th className="px-4 py-3 border-b border-brand-border text-right">Coste Línea</th>
              <th className="px-4 py-3 border-b border-brand-border text-right">Total Cobro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {sedes.map(sede => {
              const itemsSede = data.filter(item => item.sede === sede);
              const totalSede = itemsSede.reduce((acc, item) => {
                if (getCobroStatus(item) === "COBRA") {
                  return acc + (Math.abs(item.variacionStock) * item.costeLinea);
                }
                return acc;
              }, 0);
              const isExpanded = expandedSedes[sede];

              return (
                <React.Fragment key={sede}>
                  <tr 
                    className="bg-gray-50 cursor-pointer hover:bg-brand-table-hover transition-colors"
                    onClick={() => toggleSede(sede)}
                  >
                    <td className="px-4 py-3 font-bold flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      {sede}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-bold text-brand-primary">
                      ${formatCurrency(totalSede)}
                    </td>
                  </tr>
                  {isExpanded && itemsSede.map((item, idx) => {
                    const status = getCobroStatus(item);
                    const totalCobro = status === "COBRA" ? Math.abs(item.variacionStock) * item.costeLinea : 0;
                    return (
                      <tr key={`${sede}-${idx}`} className="hover:bg-brand-table-hover transition-colors">
                        <td className="px-4 py-3 pl-10 text-gray-700">{item.articulo}</td>
                        <td className="px-4 py-3 text-gray-500">{item.unidad}</td>
                        <td className={cn(
                          "px-4 py-3 text-right font-bold",
                          item.variacionStock < 0 ? "text-red-600" : "text-green-600"
                        )}>
                          {formatNumber(item.variacionStock, item.unidad)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                            status === "COBRA" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
                          )}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">${formatCurrency(item.costeLinea)}</td>
                        <td className="px-4 py-3 text-right font-bold">
                          {totalCobro > 0 ? `$${formatCurrency(totalCobro)}` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
