import React from 'react';
import { Filter, Search } from 'lucide-react';

interface FiltersProps {
  sedes: string[];
  ccs: string[];
  subfamilias: string[];
  filters: {
    sede: string;
    cc: string;
    subfamilia: string;
    status: string;
    search: string;
  };
  setFilters: (f: any) => void;
}

export const Filters: React.FC<FiltersProps> = ({ sedes, ccs, subfamilias, filters, setFilters }) => {
  return (
    <div className="bg-[#F5F7FA] p-6 rounded-[12px] mb-8 border border-[#D6DEE6]">
      <div className="flex items-center space-x-2 mb-4 text-[#1F3A5F]">
        <Filter className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-widest">Filtros de Análisis</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs font-bold text-[#1F3A5F] mb-1 uppercase">Sede (Almacén)</label>
          <select 
            value={filters.sede}
            onChange={(e) => setFilters({ ...filters, sede: e.target.value })}
            className="w-full bg-white border border-[#D6DEE6] rounded-[6px] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80ED] transition-all"
          >
            <option value="">Todas las sedes</option>
            {sedes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#1F3A5F] mb-1 uppercase">Centro de Costos</label>
          <select 
            value={filters.cc}
            onChange={(e) => setFilters({ ...filters, cc: e.target.value })}
            className="w-full bg-white border border-[#D6DEE6] rounded-[6px] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80ED] transition-all"
          >
            <option value="">Todos los CC</option>
            {ccs.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#1F3A5F] mb-1 uppercase">Subfamilia</label>
          <select 
            value={filters.subfamilia}
            onChange={(e) => setFilters({ ...filters, subfamilia: e.target.value })}
            className="w-full bg-white border border-[#D6DEE6] rounded-[6px] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80ED] transition-all"
          >
            <option value="">Todas las subfamilias</option>
            {subfamilias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#1F3A5F] mb-1 uppercase">Mostrar</label>
          <select 
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="w-full bg-white border border-[#D6DEE6] rounded-[6px] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80ED] transition-all"
          >
            <option value="all">Todos los registros</option>
            <option value="cobrables">Solo cobrables</option>
            <option value="faltantes">Solo faltantes</option>
            <option value="sobrantes">Solo sobrantes</option>
          </select>
        </div>
        <div className="relative">
          <label className="block text-xs font-bold text-[#1F3A5F] mb-1 uppercase">Buscar Artículo</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Nombre o código..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full bg-white border border-[#D6DEE6] rounded-[6px] pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2F80ED] transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
