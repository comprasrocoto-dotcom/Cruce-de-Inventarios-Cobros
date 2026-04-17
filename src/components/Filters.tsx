import React from 'react';
import { Filter, Search, X, Calendar, RotateCcw, User } from 'lucide-react';
import { GlobalFilters } from '../types';

interface FiltersProps {
  sedes: string[];
  ccs: string[];
  subfamilias: string[];
  responsables: string[];
  filters: GlobalFilters;
  setFilters: (f: any) => void;
}

export const Filters: React.FC<FiltersProps> = ({ 
  sedes, 
  ccs, 
  subfamilias, 
  responsables,
  filters, 
  setFilters 
}) => {
  const handleMultiSelect = (field: keyof GlobalFilters, value: string) => {
    const currentValues = filters[field] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    setFilters({ ...filters, [field]: newValues });
  };

  const clearFilters = () => {
    setFilters({
      sedes: [],
      ccs: [],
      subfamilias: [],
      responsables: [],
      status: 'all',
      search: '',
      fechaInicio: '',
      fechaFin: ''
    });
  };

  const removeChip = (field: keyof GlobalFilters, value: string) => {
    const currentValues = filters[field] as string[];
    setFilters({ ...filters, [field]: currentValues.filter(v => v !== value) });
  };

  const hasActiveFilters = 
    filters.sedes.length > 0 || 
    filters.ccs.length > 0 || 
    filters.subfamilias.length > 0 || 
    filters.responsables.length > 0 || 
    filters.search !== '' || 
    filters.status !== 'all' || 
    filters.fechaInicio !== '' || 
    filters.fechaFin !== '';

  return (
    <div className="bg-white p-6 rounded-2xl mb-8 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2 text-slate-800">
          <Filter className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold uppercase tracking-tight">Filtros Avanzados</h3>
        </div>
        
        {hasActiveFilters && (
          <button 
            onClick={clearFilters}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
          >
            <RotateCcw className="w-3 h-3" />
            Limpiar Filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        {/* Sede Multi-select */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Sede (Almacén)</label>
          <select 
            onChange={(e) => {
              if (e.target.value) handleMultiSelect('sedes', e.target.value);
              e.target.value = "";
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
          >
            <option value="">Seleccionar sedes...</option>
            {sedes.map(s => (
              <option key={s} value={s} disabled={filters.sedes.includes(s)}>
                {s} {filters.sedes.includes(s) ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* CC Multi-select */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Centro de Costos</label>
          <select 
            onChange={(e) => {
              if (e.target.value) handleMultiSelect('ccs', e.target.value);
              e.target.value = "";
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
          >
            <option value="">Seleccionar CC...</option>
            {ccs.map(c => (
              <option key={c} value={c} disabled={filters.ccs.includes(c)}>
                {c} {filters.ccs.includes(c) ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Responsables Multi-select */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Responsable</label>
          <select 
            onChange={(e) => {
              if (e.target.value) handleMultiSelect('responsables', e.target.value);
              e.target.value = "";
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
          >
            <option value="">Seleccionar responsable...</option>
            {responsables.map(r => (
              <option key={r} value={r} disabled={filters.responsables.includes(r)}>
                {r} {filters.responsables.includes(r) ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Estado</label>
          <select 
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700"
          >
            <option value="all">Todos los registros</option>
            <option value="cobrables">Solo cobrables</option>
            <option value="faltantes">Solo faltantes</option>
            <option value="sobrantes">Solo sobrantes</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="space-y-4 col-span-1 md:col-span-2">
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Rango de Fechas</label>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="date"
                value={filters.fechaInicio}
                onChange={(e) => setFilters({ ...filters, fechaInicio: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="date"
                value={filters.fechaFin}
                onChange={(e) => setFilters({ ...filters, fechaFin: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 xl:col-span-6">
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Buscar por Artículo o Código</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Ej: Carne de Res, 770123..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Active Chips */}
      {hasActiveFilters && (
        <div className="mt-6 flex flex-wrap gap-2 pt-6 border-t border-slate-100">
          {filters.sedes.map(s => (
            <div key={s} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100">
              <span className="opacity-60 uppercase text-[9px]">Sede:</span> {s}
              <button onClick={() => removeChip('sedes', s)}><X className="w-3 h-3 hover:text-indigo-900" /></button>
            </div>
          ))}
          {filters.ccs.map(c => (
            <div key={c} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">
              <span className="opacity-60 uppercase text-[9px]">CC:</span> {c}
              <button onClick={() => removeChip('ccs', c)}><X className="w-3 h-3 hover:text-blue-900" /></button>
            </div>
          ))}
          {filters.responsables.map(r => (
            <div key={r} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200">
              <User className="w-3 h-3 opacity-50" />
              {r}
              <button onClick={() => removeChip('responsables', r)}><X className="w-3 h-3 hover:text-slate-900" /></button>
            </div>
          ))}
          {filters.fechaInicio && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
              <span className="opacity-60 uppercase text-[9px]">Desde:</span> {filters.fechaInicio}
              <button onClick={() => setFilters({ ...filters, fechaInicio: '' })}><X className="w-3 h-3 hover:text-amber-900" /></button>
            </div>
          )}
          {filters.fechaFin && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
              <span className="opacity-60 uppercase text-[9px]">Hasta:</span> {filters.fechaFin}
              <button onClick={() => setFilters({ ...filters, fechaFin: '' })}><X className="w-3 h-3 hover:text-amber-900" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
