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
    const diff = Number(item.variacionStock || 0);
    const unit = (item.unidad || '').toUpperCase();
    
    // Solo se cobra cuando hay faltante (diferencia negativa)
    if (diff >= 0) return "NO COBRA";

    const absDiff = Math.abs(diff);
    
    // Reglas de cobro por unidad
    if (unit.includes('GRAMO') || unit === 'G' || unit === 'GR') {
      return absDiff > 1000 ? "COBRA" : "NO COBRA";
    }
    if (unit.includes('ONZ') || unit === 'OZ') {
      return absDiff > 5 ? "COBRA" : "NO COBRA";
    }
    // Por defecto (UNIDADES u otros)
    return absDiff > 1 ? "COBRA" : "NO COBRA";
  };

  const calculateTotalCobro = (item: InventoryItem) => {
    const status = getCobroStatus(item);
    const costeLinea = Number(item.costeLinea || 0);
    const diff = Number(item.variacionStock || 0);
    
    if (status === "COBRA") {
      return Math.abs(diff) * costeLinea;
    }
    return 0;
  };

  const formatCurrencyCOP = (value: number) => {
    return value.toLocaleString("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
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
        'Total Cobro': calculateTotalCobro(item)
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
        calculateTotalCobro(item).toFixed(2)
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
                const itemTotal = calculateTotalCobro(item);
                // Debugging log for each item
                if (itemTotal > 0) {
                  console.log("Item Cobrable:", {
                    articulo: item.articulo,
                    unidad: item.unidad,
                    diferenciaNeta: item.variacionStock,
                    costeLinea: item.costeLinea,
                    estado: getCobroStatus(item),
                    totalCobro: itemTotal
                  });
                }
                return acc + itemTotal;
              }, 0);

              // Debugging log for each sede
              console.log("Sede Total:", {
                sede,
                totalCobroSede: totalSede
              });

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
                      {formatCurrencyCOP(totalSede)}
                    </td>
                  </tr>
                  {isExpanded && itemsSede.map((item, idx) => {
                    const status = getCobroStatus(item);
                    const totalCobro = calculateTotalCobro(item);
                    const isCobra = status === "COBRA";
                    
                    return (
                      <tr key={`${sede}-${idx}`} className={cn(
                        "hover:bg-brand-table-hover transition-colors",
                        isCobra && "bg-red-50/30"
                      )}>
                        <td className={cn(
                          "px-4 py-3 pl-10 text-gray-700",
                          isCobra && "font-bold text-gray-900"
                        )}>{item.articulo}</td>
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
                            isCobra ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"
                          )}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrencyCOP(Number(item.costeLinea || 0))}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right font-bold",
                          isCobra ? "text-red-700" : "text-gray-400"
                        )}>
                          {formatCurrencyCOP(totalCobro)}
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
