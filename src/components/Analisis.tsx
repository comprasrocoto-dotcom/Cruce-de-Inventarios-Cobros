import React, { useState, useMemo } from 'react';
import { Card } from './Card';
import { InventoryItem, formatNumber, formatCurrency, cn } from '../utils';
import { Search, Filter, ChevronDown } from 'lucide-react';

interface AnalisisProps {
  data: InventoryItem[];
}

export const Analisis: React.FC<AnalisisProps> = ({ data }) => {
  const [filters, setFilters] = useState({
    sede: '',
    cc: '',
    subfamilia: '',
    articulo: '',
    riesgo: ''
  });

  const sedes = useMemo(() => Array.from(new Set(data.map(item => item.sede))), [data]);
  const ccs = useMemo(() => Array.from(new Set(data.map(item => item.cc))), [data]);
  const subfamilias = useMemo(() => Array.from(new Set(data.map(item => item.subfamilia))), [data]);

  const filteredData = useMemo(() => {
    const rawFiltered = data.filter(item => {
      const matchSede = !filters.sede || item.sede === filters.sede;
      const matchCC = !filters.cc || item.cc === filters.cc;
      const matchSubfamilia = !filters.subfamilia || item.subfamilia === filters.subfamilia;
      const matchArticulo = !filters.articulo || item.articulo.toLowerCase().includes(filters.articulo.toLowerCase());
      return matchSede && matchCC && matchSubfamilia && matchArticulo;
    });

    // Grouping by Sede + CC + Articulo + Unidad
    const groups: Record<string, InventoryItem & { latestDate: string }> = {};
    
    rawFiltered.forEach(item => {
      const key = `${item.sede}-${item.cc}-${item.articulo}-${item.unidad}`;
      if (!groups[key]) {
        groups[key] = { ...item, latestDate: item.fechaDoc || '' };
      } else {
        groups[key].variacionStock += Number(item.variacionStock || 0);
        if (item.fechaDoc && item.fechaDoc >= groups[key].latestDate && item.costeLinea > 0) {
          groups[key].latestDate = item.fechaDoc;
          groups[key].costeLinea = item.costeLinea;
        }
      }
    });

    return Object.values(groups).filter(item => {
      const impacto = Math.abs(item.variacionStock) * item.costeLinea;
      let matchRiesgo = true;
      if (filters.riesgo === 'ALTO') matchRiesgo = impacto > 100000;
      if (filters.riesgo === 'MEDIO') matchRiesgo = impacto > 20000 && impacto <= 100000;
      if (filters.riesgo === 'BAJO') matchRiesgo = impacto <= 20000;
      return matchRiesgo;
    });
  }, [data, filters]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Sede</label>
            <select 
              className="w-full p-2 border border-brand-input-border rounded-lg text-sm bg-white outline-none focus:border-brand-primary"
              value={filters.sede}
              onChange={(e) => setFilters({...filters, sede: e.target.value})}
            >
              <option value="">Todas</option>
              {sedes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Centro Costos</label>
            <select 
              className="w-full p-2 border border-brand-input-border rounded-lg text-sm bg-white outline-none focus:border-brand-primary"
              value={filters.cc}
              onChange={(e) => setFilters({...filters, cc: e.target.value})}
            >
              <option value="">Todos</option>
              {ccs.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Subfamilia</label>
            <select 
              className="w-full p-2 border border-brand-input-border rounded-lg text-sm bg-white outline-none focus:border-brand-primary"
              value={filters.subfamilia}
              onChange={(e) => setFilters({...filters, subfamilia: e.target.value})}
            >
              <option value="">Todas</option>
              {subfamilias.map(sf => <option key={sf} value={sf}>{sf}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Artículo</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Buscar..."
                className="w-full p-2 pl-8 border border-brand-input-border rounded-lg text-sm outline-none focus:border-brand-primary"
                value={filters.articulo}
                onChange={(e) => setFilters({...filters, articulo: e.target.value})}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Nivel Riesgo</label>
            <select 
              className="w-full p-2 border border-brand-input-border rounded-lg text-sm bg-white outline-none focus:border-brand-primary"
              value={filters.riesgo}
              onChange={(e) => setFilters({...filters, riesgo: e.target.value})}
            >
              <option value="">Todos</option>
              <option value="ALTO">Alto Impacto</option>
              <option value="MEDIO">Medio Impacto</option>
              <option value="BAJO">Bajo Impacto</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm text-left">
          <thead className="bg-brand-table-header text-brand-text uppercase text-xs font-bold">
            <tr>
              <th className="px-4 py-3 border-b border-brand-border">Sede</th>
              <th className="px-4 py-3 border-b border-brand-border">Centro Costos</th>
              <th className="px-4 py-3 border-b border-brand-border">Artículo</th>
              <th className="px-4 py-3 border-b border-brand-border">Unidad</th>
              <th className="px-4 py-3 border-b border-brand-border text-right">Variación</th>
              <th className="px-4 py-3 border-b border-brand-border text-right">Coste Línea</th>
              <th className="px-4 py-3 border-b border-brand-border text-right">Impacto Econ.</th>
              <th className="px-4 py-3 border-b border-brand-border text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {filteredData.map((item, idx) => {
              const impacto = Math.abs(item.variacionStock) * item.costeLinea;
              return (
                <tr key={idx} className="hover:bg-brand-table-hover transition-colors">
                  <td className="px-4 py-3 font-medium">{item.sede}</td>
                  <td className="px-4 py-3">{item.cc}</td>
                  <td className="px-4 py-3">{item.articulo}</td>
                  <td className="px-4 py-3 text-gray-500">{item.unidad}</td>
                  <td className={cn(
                    "px-4 py-3 text-right font-bold",
                    item.variacionStock < 0 ? "text-red-600" : item.variacionStock > 0 ? "text-green-600" : "text-gray-400"
                  )}>
                    {formatNumber(item.variacionStock, item.unidad)}
                  </td>
                  <td className="px-4 py-3 text-right">${formatCurrency(item.costeLinea)}</td>
                  <td className="px-4 py-3 text-right font-bold">${formatCurrency(impacto)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      item.variacionStock === 0 ? "bg-gray-100 text-gray-500" : 
                      item.variacionStock < 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                    )}>
                      {item.variacionStock === 0 ? "OK" : item.variacionStock < 0 ? "Faltante" : "Sobrante"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredData.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No se encontraron resultados con los filtros aplicados.
          </div>
        )}
      </Card>
    </div>
  );
};
