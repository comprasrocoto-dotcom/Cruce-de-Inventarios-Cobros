import React, { useState, useMemo } from 'react';
import { Card } from './Card';
import { CircularProgress } from './CircularProgress';
import { InventoryItem, formatCurrency, getReliabilityStatus, getReliabilityColor, formatNumber, cn } from '../utils';
import { ChevronRight, X, FileText, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ConfiabilidadProps {
  data: InventoryItem[];
}

export const Confiabilidad: React.FC<ConfiabilidadProps> = ({ data }) => {
  const [viewType, setViewType] = useState<'sede' | 'cc'>('sede');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [detailFilter, setDetailFilter] = useState<'all' | 'faltantes' | 'sobrantes' | 'ok'>('all');

  const groups = useMemo(() => {
    const key = viewType === 'sede' ? 'sede' : 'cc';
    const uniqueGroups = Array.from(new Set(data.map(item => item[key as keyof InventoryItem] as string)));
    
    return uniqueGroups.map(groupName => {
      const groupData = data.filter(item => item[key as keyof InventoryItem] === groupName);
      const total = groupData.length;
      const sinDiferencia = groupData.filter(item => item.variacionStock === 0).length;
      const diferencias = groupData.filter(item => item.variacionStock !== 0).length;
      const impacto = groupData.reduce((acc, item) => acc + (Math.abs(item.variacionStock) * item.costeLinea), 0);
      const confiabilidad = total > 0 ? (sinDiferencia / total) * 100 : 0;

      return {
        nombre: groupName,
        confiabilidad,
        articulos: total,
        diferencias,
        impacto,
        sinDiferencia
      };
    });
  }, [data, viewType]);

  const detailData = useMemo(() => {
    if (!selectedGroup) return null;
    const key = viewType === 'sede' ? 'sede' : 'cc';
    const groupItems = data.filter(item => item[key as keyof InventoryItem] === selectedGroup);
    
    const total = groupItems.length;
    const sinDiferencia = groupItems.filter(item => item.variacionStock === 0).length;
    const conDiferencia = groupItems.filter(item => item.variacionStock !== 0).length;
    const confiabilidad = total > 0 ? (sinDiferencia / total) * 100 : 0;

    const criticalItems = [...groupItems]
      .sort((a, b) => (Math.abs(b.variacionStock) * b.costeLinea) - (Math.abs(a.variacionStock) * a.costeLinea))
      .slice(0, 10);

    const reliableItems = groupItems
      .filter(item => item.variacionStock === 0)
      .slice(0, 10);

    const filteredTableItems = groupItems.filter(item => {
      if (detailFilter === 'faltantes') return item.variacionStock < 0;
      if (detailFilter === 'sobrantes') return item.variacionStock > 0;
      if (detailFilter === 'ok') return item.variacionStock === 0;
      return true;
    });

    return {
      nombre: selectedGroup,
      confiabilidad,
      total,
      sinDiferencia,
      conDiferencia,
      criticalItems,
      reliableItems,
      tableItems: filteredTableItems
    };
  }, [data, selectedGroup, viewType, detailFilter]);

  const exportDetailPDF = () => {
    if (!detailData) return;
    const doc = new jsPDF();
    doc.text(`DETALLE DE CONFIABILIDAD - ${detailData.nombre}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Confiabilidad: ${detailData.confiabilidad.toFixed(2)}%`, 14, 22);
    doc.text(`Artículos Evaluados: ${detailData.total}`, 14, 27);

    const tableData = detailData.tableItems.map(item => [
      item.articulo,
      item.unidad,
      formatNumber(item.variacionStock, item.unidad),
      (Math.abs(item.variacionStock) * item.costeLinea).toFixed(2)
    ]);

    (doc as any).autoTable({
      head: [['Artículo', 'Unidad', 'Variación', 'Impacto Econ.']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillStyle: '#2E7BCF' }
    });

    doc.save(`Detalle_Confiabilidad_${detailData.nombre}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-brand-text">Análisis de Confiabilidad</h2>
        <div className="flex bg-white p-1 rounded-lg border border-brand-border">
          <button 
            onClick={() => setViewType('sede')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${viewType === 'sede' ? 'bg-brand-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Ver por Sede
          </button>
          <button 
            onClick={() => setViewType('cc')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${viewType === 'cc' ? 'bg-brand-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Ver por Centro de Costos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-brand-text">{group.nombre}</h3>
                <span 
                  className="text-xs font-bold px-2 py-1 rounded-full uppercase"
                  style={{ 
                    backgroundColor: `${getReliabilityColor(group.confiabilidad)}20`,
                    color: getReliabilityColor(group.confiabilidad)
                  }}
                >
                  {getReliabilityStatus(group.confiabilidad)}
                </span>
              </div>
              <CircularProgress percentage={group.confiabilidad} size={70} strokeWidth={8} />
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-brand-border pt-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Artículos</p>
                <p className="text-lg font-bold">{group.articulos}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Diferencias</p>
                <p className="text-lg font-bold text-orange-600">{group.diferencias}</p>
              </div>
            </div>

            <button 
              onClick={() => setSelectedGroup(group.nombre)}
              className="w-full py-2 bg-gray-50 text-brand-primary text-sm font-bold rounded-lg hover:bg-brand-table-hover flex items-center justify-center gap-1 transition-colors"
            >
              Ver detalle completo <ChevronRight className="w-4 h-4" />
            </button>
          </Card>
        ))}
      </div>

      {/* Modal Detalle */}
      {selectedGroup && detailData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-brand-bg w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 bg-brand-topbar text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{detailData.nombre}</h2>
                <p className="text-sm text-gray-400">Detalle de confiabilidad de inventario</p>
              </div>
              <button onClick={() => setSelectedGroup(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="flex flex-col items-center justify-center p-4">
                  <CircularProgress percentage={detailData.confiabilidad} size={100} strokeWidth={10} />
                  <p className="mt-2 text-sm font-bold text-gray-500 uppercase">Confiabilidad</p>
                </Card>
                <Card className="flex flex-col items-center justify-center p-4">
                  <p className="text-3xl font-bold text-brand-primary">{detailData.total}</p>
                  <p className="text-sm font-bold text-gray-500 uppercase">Artículos Evaluados</p>
                </Card>
                <Card className="flex flex-col items-center justify-center p-4">
                  <p className="text-3xl font-bold text-green-600">{detailData.sinDiferencia}</p>
                  <p className="text-sm font-bold text-gray-500 uppercase">Sin Diferencia</p>
                </Card>
                <Card className="flex flex-col items-center justify-center p-4">
                  <p className="text-3xl font-bold text-red-600">{detailData.conDiferencia}</p>
                  <p className="text-sm font-bold text-gray-500 uppercase">Con Diferencia</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Top 10 Artículos Críticos (Mayor Impacto)">
                  <div className="space-y-3">
                    {detailData.criticalItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-brand-border pb-2">
                        <span className="font-medium truncate max-w-[200px]">{item.articulo}</span>
                        <div className="text-right">
                          <p className="font-bold text-red-600">{formatNumber(item.variacionStock, item.unidad)} {item.unidad}</p>
                          <p className="text-xs text-gray-500">${formatCurrency(Math.abs(item.variacionStock) * item.costeLinea)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card title="Top 10 Artículos Confiables">
                  <div className="space-y-3">
                    {detailData.reliableItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b border-brand-border pb-2">
                        <span className="font-medium truncate max-w-[200px]">{item.articulo}</span>
                        <span className="font-bold text-green-600">SIN DIFERENCIA</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold">Artículos que afectan la confiabilidad</h3>
                  <div className="flex gap-2">
                    <div className="flex bg-white p-1 rounded-lg border border-brand-border text-xs font-bold">
                      <button 
                        onClick={() => setDetailFilter('all')}
                        className={`px-3 py-1 rounded ${detailFilter === 'all' ? 'bg-brand-primary text-white' : 'text-gray-500'}`}
                      >
                        Todos
                      </button>
                      <button 
                        onClick={() => setDetailFilter('faltantes')}
                        className={`px-3 py-1 rounded ${detailFilter === 'faltantes' ? 'bg-brand-primary text-white' : 'text-gray-500'}`}
                      >
                        Faltantes
                      </button>
                      <button 
                        onClick={() => setDetailFilter('sobrantes')}
                        className={`px-3 py-1 rounded ${detailFilter === 'sobrantes' ? 'bg-brand-primary text-white' : 'text-gray-500'}`}
                      >
                        Sobrantes
                      </button>
                      <button 
                        onClick={() => setDetailFilter('ok')}
                        className={`px-3 py-1 rounded ${detailFilter === 'ok' ? 'bg-brand-primary text-white' : 'text-gray-500'}`}
                      >
                        Sin Diferencia
                      </button>
                    </div>
                    <button 
                      onClick={exportDetailPDF}
                      className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                    >
                      <FileText className="w-4 h-4" /> PDF
                    </button>
                  </div>
                </div>
                <Card className="p-0 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-brand-table-header text-brand-text uppercase text-xs font-bold">
                      <tr>
                        <th className="px-4 py-3 border-b border-brand-border">Artículo</th>
                        <th className="px-4 py-3 border-b border-brand-border">Unidad</th>
                        <th className="px-4 py-3 border-b border-brand-border text-right">Variación</th>
                        <th className="px-4 py-3 border-b border-brand-border text-right">Impacto Económico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {detailData.tableItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-brand-table-hover transition-colors">
                          <td className="px-4 py-3">{item.articulo}</td>
                          <td className="px-4 py-3 text-gray-500">{item.unidad}</td>
                          <td className={cn(
                            "px-4 py-3 text-right font-bold",
                            item.variacionStock < 0 ? "text-red-600" : item.variacionStock > 0 ? "text-green-600" : "text-gray-400"
                          )}>
                            {formatNumber(item.variacionStock, item.unidad)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            ${formatCurrency(Math.abs(item.variacionStock) * item.costeLinea)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
