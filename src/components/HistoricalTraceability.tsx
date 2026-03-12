import React, { useMemo, useState } from 'react';
import { ArticleSummary, HistoricalPeriodStats, HistoricalTraceabilityData } from '../types';
import { getHistoricalTraceability } from '../utils/inventory';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  ComposedChart, Area
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Minus, Calendar, Building2, LayoutGrid, Package, 
  AlertTriangle, CheckCircle2, DollarSign, Download, FileText, Table as TableIcon,
  ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface HistoricalTraceabilityProps {
  data: ArticleSummary[];
  sedes: string[];
  ccs: string[];
  subfamilias: string[];
  fileName?: string;
  onReset?: () => void;
}

export const HistoricalTraceability: React.FC<HistoricalTraceabilityProps> = ({ data, sedes, ccs, subfamilias, fileName, onReset }) => {
  const [filters, setFilters] = useState({
    sede: '',
    cc: '',
    subfamilia: '',
    articulo: '',
    start: '',
    end: '',
    groupBy: 'month' as 'month' | 'week' | 'day'
  });

  const historicalData: HistoricalTraceabilityData = useMemo(() => {
    return getHistoricalTraceability(data, filters.groupBy, {
      sede: filters.sede,
      cc: filters.cc,
      subfamilia: filters.subfamilia,
      articulo: filters.articulo,
      start: filters.start ? new Date(filters.start) : undefined,
      end: filters.end ? new Date(filters.end) : undefined
    });
  }, [data, filters]);

  const stats = historicalData.periods;
  const currentStats = stats[stats.length - 1];
  const firstStats = stats[0];

  const kpis = useMemo(() => {
    if (stats.length === 0) return null;

    const bestPeriod = [...stats].sort((a, b) => b.confiabilidad - a.confiabilidad)[0];
    const worstPeriod = [...stats].sort((a, b) => a.confiabilidad - b.confiabilidad)[0];
    const accumulatedImpact = stats.reduce((acc, s) => acc + s.impactoEconomico, 0);
    const accumulatedVariation = currentStats.confiabilidad - firstStats.confiabilidad;

    let trend: 'Mejorando' | 'Empeoró' | 'Estable' = 'Estable';
    if (accumulatedVariation > 2) trend = 'Mejorando';
    else if (accumulatedVariation < -2) trend = 'Empeoró';

    return {
      currentReliability: currentStats.confiabilidad,
      bestPeriod,
      worstPeriod,
      accumulatedImpact,
      accumulatedVariation,
      trend
    };
  }, [stats, currentStats, firstStats]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Main periods sheet
    const mainData = stats.map(s => ({
      'Período': s.period,
      'Evaluados': s.evaluados,
      'Sin Diferencia': s.sinDiferencia,
      'Con Diferencia': s.conDiferencia,
      'Confiabilidad %': s.confiabilidad.toFixed(2),
      'Impacto Económico': s.impactoEconomico,
      'Variación %': s.variacionVsAnterior?.toFixed(2) || '-',
      'Estado': s.estado
    }));
    const wsMain = XLSX.utils.json_to_sheet(mainData);
    XLSX.utils.book_append_sheet(wb, wsMain, 'Evolución General');

    // Sede sheet
    const sedeData: any[] = [];
    (Object.entries(historicalData.bySede) as [string, HistoricalPeriodStats[]][]).forEach(([sede, sedeStats]) => {
      sedeStats.forEach(s => {
        sedeData.push({
          'Sede': sede,
          'Período': s.period,
          'Confiabilidad %': s.confiabilidad.toFixed(2),
          'Impacto': s.impactoEconomico,
          'Estado': s.estado
        });
      });
    });
    const wsSede = XLSX.utils.json_to_sheet(sedeData);
    XLSX.utils.book_append_sheet(wb, wsSede, 'Evolución por Sede');

    XLSX.writeFile(wb, `Trazabilidad_Inventario_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(31, 58, 95);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('REPORTE HISTÓRICO DE CONFIABILIDAD', 15, 25);
    doc.setFontSize(10);
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 33);

    // Filters summary
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text('Resumen de Filtros:', 15, 50);
    doc.setFontSize(10);
    doc.text(`Sede: ${filters.sede || 'Todas'}`, 15, 58);
    doc.text(`CC: ${filters.cc || 'Todos'}`, 15, 63);
    doc.text(`Rango: ${filters.start || 'Inicio'} - ${filters.end || 'Fin'}`, 15, 68);

    // Table
    (doc as any).autoTable({
      startY: 75,
      head: [['Período', 'Evaluados', 'Sin Dif.', 'Confiabilidad', 'Impacto $', 'Estado']],
      body: stats.map(s => [
        s.period,
        s.evaluados,
        s.sinDiferencia,
        `${s.confiabilidad.toFixed(1)}%`,
        formatCurrency(s.impactoEconomico),
        s.estado
      ]),
      headStyles: { fillStyle: [31, 58, 95] },
      theme: 'grid'
    });

    doc.save(`Reporte_Historico_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (data.length === 0) return null;

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="bg-[#1F3A5F] text-white p-8 rounded-[12px] shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-1 uppercase tracking-tight">TRAZABILIDAD</h2>
          <p className="text-[#A7C4E0] font-medium">Comparativo histórico de confiabilidad e impacto económico</p>
        </div>
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <Activity className="w-64 h-64" />
        </div>
      </div>

      {/* Archivo Historico Card */}
      {fileName && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-100 p-6 rounded-[12px] flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-emerald-900 font-bold uppercase text-xs tracking-wider">ARCHIVO HISTÓRICO CARGADO CORRECTAMENTE</h4>
              <p className="text-emerald-700 text-sm font-medium">{fileName}</p>
              <p className="text-emerald-600 text-[10px] font-bold uppercase mt-1">{data.length} registros históricos procesados con éxito</p>
            </div>
          </div>
          <button 
            onClick={onReset}
            className="px-4 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-100 transition-colors shadow-sm"
          >
            Cargar otro
          </button>
        </motion.div>
      )}

      {/* Filters */}
      <div className="bg-white p-6 rounded-[12px] border border-brand-border shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3" /> Sede
            </label>
            <select 
              value={filters.sede}
              onChange={(e) => setFilters({...filters, sede: e.target.value})}
              className="w-full p-2 rounded-md border border-brand-border text-sm font-medium focus:ring-2 focus:ring-[#2F80ED] outline-none"
            >
              <option value="">Todas las Sedes</option>
              {sedes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-1">
              <LayoutGrid className="w-3 h-3" /> Centro de Costos
            </label>
            <select 
              value={filters.cc}
              onChange={(e) => setFilters({...filters, cc: e.target.value})}
              className="w-full p-2 rounded-md border border-brand-border text-sm font-medium focus:ring-2 focus:ring-[#2F80ED] outline-none"
            >
              <option value="">Todos los CC</option>
              {ccs.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3 h-3" /> Subfamilia
            </label>
            <select 
              value={filters.subfamilia}
              onChange={(e) => setFilters({...filters, subfamilia: e.target.value})}
              className="w-full p-2 rounded-md border border-brand-border text-sm font-medium focus:ring-2 focus:ring-[#2F80ED] outline-none"
            >
              <option value="">Todas las Subfamilias</option>
              {subfamilias.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3 h-3" /> Artículo
            </label>
            <input 
              type="text"
              value={filters.articulo}
              onChange={(e) => setFilters({...filters, articulo: e.target.value})}
              placeholder="Buscar artículo..."
              className="w-full p-2 rounded-md border border-brand-border text-sm font-medium focus:ring-2 focus:ring-[#2F80ED] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Fecha Inicial
            </label>
            <input 
              type="date"
              value={filters.start}
              onChange={(e) => setFilters({...filters, start: e.target.value})}
              className="w-full p-2 rounded-md border border-brand-border text-sm font-medium focus:ring-2 focus:ring-[#2F80ED] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Fecha Final
            </label>
            <input 
              type="date"
              value={filters.end}
              onChange={(e) => setFilters({...filters, end: e.target.value})}
              className="w-full p-2 rounded-md border border-brand-border text-sm font-medium focus:ring-2 focus:ring-[#2F80ED] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3 h-3" /> Agrupar por
            </label>
            <select 
              value={filters.groupBy}
              onChange={(e) => setFilters({...filters, groupBy: e.target.value as any})}
              className="w-full p-2 rounded-md border border-brand-border text-sm font-medium focus:ring-2 focus:ring-[#2F80ED] outline-none"
            >
              <option value="month">Mes</option>
              <option value="week">Semana</option>
              <option value="day">Día</option>
            </select>
          </div>
          <div className="lg:col-span-3 flex items-end justify-end gap-3">
            <button 
              onClick={downloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <TableIcon className="w-4 h-4" /> Excel Histórico
            </button>
            <button 
              onClick={downloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-md text-xs font-bold uppercase tracking-wider hover:bg-rose-700 transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4" /> PDF Histórico
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white p-5 rounded-[12px] border border-brand-border shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confiabilidad Actual</p>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[#1F3A5F]">{kpis.currentReliability.toFixed(1)}%</p>
              <span className={`text-[10px] font-bold mb-1 flex items-center ${kpis.accumulatedVariation >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {kpis.accumulatedVariation >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(kpis.accumulatedVariation).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-[12px] border border-brand-border shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mejor Período</p>
            <p className="text-xl font-bold text-[#27AE60] truncate">{kpis.bestPeriod.period}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{kpis.bestPeriod.confiabilidad.toFixed(1)}% confiabilidad</p>
          </div>
          <div className="bg-white p-5 rounded-[12px] border border-brand-border shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Peor Período</p>
            <p className="text-xl font-bold text-[#EB5757] truncate">{kpis.worstPeriod.period}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">{kpis.worstPeriod.confiabilidad.toFixed(1)}% confiabilidad</p>
          </div>
          <div className="bg-white p-5 rounded-[12px] border border-brand-border shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Impacto Acumulado</p>
            <p className="text-xl font-bold text-[#1F3A5F]">{formatCurrency(kpis.accumulatedImpact)}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Pérdida total en rango</p>
          </div>
          <div className="bg-white p-5 rounded-[12px] border border-brand-border shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Variación Acumulada</p>
            <p className={`text-xl font-bold ${kpis.accumulatedVariation >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {kpis.accumulatedVariation >= 0 ? '+' : ''}{kpis.accumulatedVariation.toFixed(1)}%
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Desde el inicio del rango</p>
          </div>
          <div className="bg-white p-5 rounded-[12px] border border-brand-border shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tendencia General</p>
            <div className="flex items-center gap-2">
              {kpis.trend === 'Mejorando' ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : kpis.trend === 'Empeoró' ? <TrendingDown className="w-5 h-5 text-rose-500" /> : <Minus className="w-5 h-5 text-slate-400" />}
              <p className={`text-xl font-bold ${kpis.trend === 'Mejorando' ? 'text-emerald-600' : kpis.trend === 'Empeoró' ? 'text-rose-600' : 'text-slate-600'}`}>
                {kpis.trend}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Section (Conclusiones Historicas) */}
      {kpis && (
        <div className="bg-[#F8FAFC] p-8 rounded-[12px] border border-brand-border shadow-inner">
          <h3 className="text-sm font-bold text-[#1F3A5F] uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Conclusiones Históricas
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2F80ED] mt-1.5 flex-shrink-0"></div>
                <p className="text-slate-600 leading-relaxed">
                  En el rango analizado, la confiabilidad pasó de <span className="font-bold text-[#1F3A5F]">{firstStats.confiabilidad.toFixed(1)}%</span> a <span className="font-bold text-[#1F3A5F]">{currentStats.confiabilidad.toFixed(1)}%</span>, 
                  mejorando <span className={`font-bold ${kpis.accumulatedVariation >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{Math.abs(kpis.accumulatedVariation).toFixed(1)} puntos porcentuales</span>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2F80ED] mt-1.5 flex-shrink-0"></div>
                <p className="text-slate-600 leading-relaxed">
                  El impacto económico disminuyó de <span className="font-bold text-[#1F3A5F]">{formatCurrency(firstStats.impactoEconomico)}</span> a <span className="font-bold text-rose-600">{formatCurrency(currentStats.impactoEconomico)}</span>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2F80ED] mt-1.5 flex-shrink-0"></div>
                <p className="text-slate-600 leading-relaxed">
                  El período con peor desempeño fue <span className="font-bold text-rose-600 uppercase">{kpis.worstPeriod.period}</span> con un <span className="font-bold">{kpis.worstPeriod.confiabilidad.toFixed(1)}%</span>.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              {Object.entries(historicalData.bySede).length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2F80ED] mt-1.5 flex-shrink-0"></div>
                  <p className="text-slate-600 leading-relaxed">
                    La sede con mejor evolución fue <span className="font-bold text-[#2F80ED] uppercase">{
                      Object.entries(historicalData.bySede)
                        .map(([name, s]) => ({ name, var: (s[s.length-1]?.confiabilidad || 0) - (s[0]?.confiabilidad || 0) }))
                        .sort((a, b) => b.var - a.var)[0]?.name
                    }</span>.
                  </p>
                </div>
              )}
              {Object.entries(historicalData.byCC).length > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2F80ED] mt-1.5 flex-shrink-0"></div>
                  <p className="text-slate-600 leading-relaxed">
                    El centro de costos con mayor mejora fue <span className="font-bold text-[#2F80ED] uppercase">{
                      Object.entries(historicalData.byCC)
                        .map(([name, s]) => ({ name, var: (s[s.length-1]?.confiabilidad || 0) - (s[0]?.confiabilidad || 0) }))
                        .sort((a, b) => b.var - a.var)[0]?.name
                    }</span>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Reliability Evolution */}
        <div className="bg-white p-6 rounded-[12px] border border-brand-border shadow-sm">
          <h3 className="text-sm font-bold text-[#1F3A5F] uppercase tracking-wider mb-8 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2F80ED]" /> Evolución de la Confiabilidad %
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Confiabilidad']}
                />
                <Area type="monotone" dataKey="confiabilidad" fill="#2F80ED" fillOpacity={0.1} stroke="none" />
                <Line type="monotone" dataKey="confiabilidad" stroke="#2F80ED" strokeWidth={3} dot={{ r: 4, fill: '#2F80ED' }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Economic Impact */}
        <div className="bg-white p-6 rounded-[12px] border border-brand-border shadow-sm">
          <h3 className="text-sm font-bold text-[#1F3A5F] uppercase tracking-wider mb-8 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-rose-500" /> Impacto Económico Histórico
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Impacto']}
                />
                <Bar dataKey="impactoEconomico" fill="#EB5757" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Faltantes vs Sobrantes */}
        <div className="bg-white p-6 rounded-[12px] border border-brand-border shadow-sm">
          <h3 className="text-sm font-bold text-[#1F3A5F] uppercase tracking-wider mb-8 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F2C94C]" /> Faltantes vs Sobrantes por Período
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }} />
                <Bar dataKey="faltantes" name="Faltantes" fill="#EB5757" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sobrantes" name="Sobrantes" fill="#27AE60" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolution by Sede */}
        <div className="bg-white p-6 rounded-[12px] border border-brand-border shadow-sm">
          <h3 className="text-sm font-bold text-[#1F3A5F] uppercase tracking-wider mb-8 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#2F80ED]" /> Evolución por Sede
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="period" 
                  allowDuplicatedCategory={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }} />
                {(Object.entries(historicalData.bySede) as [string, HistoricalPeriodStats[]][]).map(([sede, s], idx) => (
                  <Line 
                    key={sede} 
                    data={s} 
                    type="monotone" 
                    dataKey="confiabilidad" 
                    name={sede} 
                    stroke={[
                      '#2F80ED', '#27AE60', '#F2C94C', '#EB5757', '#9B51E0', '#2D9CDB', '#F2994A'
                    ][idx % 7]} 
                    strokeWidth={2} 
                    dot={{ r: 3 }} 
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Comparative Table */}
      <div className="bg-white rounded-[12px] border border-brand-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border bg-[#1F3A5F] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-white" />
            <h3 className="font-bold text-white uppercase tracking-tight">COMPARATIVO POR PERÍODO</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#A7C4E0]">
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Período</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Evaluados</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Sin diferencia</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Con diferencia</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Confiabilidad</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Impacto Económico</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Faltantes</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Sobrantes</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Var. vs período anterior</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Tendencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {stats.map((s) => (
                <tr key={s.period} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-4 font-bold text-[#1F3A5F] text-sm">{s.period}</td>
                  <td className="px-4 py-4 text-center text-slate-600 text-sm font-bold">{s.evaluados}</td>
                  <td className="px-4 py-4 text-center text-emerald-600 text-sm font-bold">{s.sinDiferencia}</td>
                  <td className="px-4 py-4 text-center text-rose-600 text-sm font-bold">{s.conDiferencia}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`font-bold text-sm ${s.confiabilidad >= 85 ? 'text-emerald-600' : s.confiabilidad >= 70 ? 'text-amber-500' : 'text-rose-600'}`}>
                      {s.confiabilidad.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-[#1F3A5F] text-sm">{formatCurrency(s.impactoEconomico)}</td>
                  <td className="px-4 py-4 text-center text-rose-500 text-xs font-bold">{s.faltantes}</td>
                  <td className="px-4 py-4 text-center text-emerald-500 text-xs font-bold">{s.sobrantes}</td>
                  <td className="px-4 py-4 text-center">
                    {s.variacionVsAnterior !== undefined ? (
                      <span className={`text-xs font-bold flex items-center justify-center gap-1 ${s.variacionVsAnterior >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {s.variacionVsAnterior >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(s.variacionVsAnterior).toFixed(1)}%
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                      s.estado === 'Mejoró' ? 'bg-emerald-100 text-emerald-700' : 
                      s.estado === 'Empeoró' ? 'bg-rose-100 text-rose-700' : 
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {s.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evolution by Sede & CC Cards */}
      <div className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#1F3A5F] uppercase tracking-widest flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Evolución por Sede
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(Object.entries(historicalData.bySede) as [string, HistoricalPeriodStats[]][]).map(([sede, s]) => {
              const first = s[0]?.confiabilidad || 0;
              const last = s[s.length - 1]?.confiabilidad || 0;
              const variation = last - first;
              const totalImpact = s.reduce((acc, curr) => acc + curr.impactoEconomico, 0);
              const trend = variation > 2 ? 'Mejorando' : variation < -2 ? 'Empeoró' : 'Estable';

              return (
                <div key={sede} className="bg-white p-5 rounded-[12px] border border-brand-border shadow-sm hover:shadow-md transition-shadow">
                  <h4 className="font-bold text-[#1F3A5F] text-sm uppercase mb-4 border-b pb-2">{sede}</h4>
                  <div className="space-y-2 mb-4">
                    {s.slice(-3).map(period => (
                      <div key={period.period} className="flex justify-between text-xs font-medium">
                        <span className="text-slate-500">{period.period}</span>
                        <span className={`font-bold ${period.confiabilidad >= 85 ? 'text-emerald-600' : period.confiabilidad >= 70 ? 'text-amber-500' : 'text-rose-600'}`}>
                          {period.confiabilidad.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-slate-100 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400">Variación:</span>
                      <span className={variation >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {variation >= 0 ? '+' : ''}{variation.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400">Impacto:</span>
                      <span className="text-rose-600">{formatCurrency(totalImpact)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400">Tendencia:</span>
                      <span className={trend === 'Mejorando' ? 'text-emerald-600' : trend === 'Empeoró' ? 'text-rose-600' : 'text-slate-600'}>
                        {trend}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-[#1F3A5F] uppercase tracking-widest flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" /> Evolución por Centro de Costos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(Object.entries(historicalData.byCC) as [string, HistoricalPeriodStats[]][]).map(([cc, s]) => {
              const first = s[0]?.confiabilidad || 0;
              const last = s[s.length - 1]?.confiabilidad || 0;
              const variation = last - first;
              const totalImpact = s.reduce((acc, curr) => acc + curr.impactoEconomico, 0);
              const trend = variation > 2 ? 'Mejorando' : variation < -2 ? 'Empeoró' : 'Estable';

              return (
                <div key={cc} className="bg-white p-5 rounded-[12px] border border-brand-border shadow-sm hover:shadow-md transition-shadow">
                  <h4 className="font-bold text-[#1F3A5F] text-sm uppercase mb-4 border-b pb-2">{cc}</h4>
                  <div className="space-y-2 mb-4">
                    {s.slice(-3).map(period => (
                      <div key={period.period} className="flex justify-between text-xs font-medium">
                        <span className="text-slate-500">{period.period}</span>
                        <span className={`font-bold ${period.confiabilidad >= 85 ? 'text-emerald-600' : period.confiabilidad >= 70 ? 'text-amber-500' : 'text-rose-600'}`}>
                          {period.confiabilidad.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-slate-100 space-y-1">
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400">Variación:</span>
                      <span className={variation >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {variation >= 0 ? '+' : ''}{variation.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400">Impacto:</span>
                      <span className="text-rose-600">{formatCurrency(totalImpact)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold uppercase">
                      <span className="text-slate-400">Tendencia:</span>
                      <span className={trend === 'Mejorando' ? 'text-emerald-600' : trend === 'Empeoró' ? 'text-rose-600' : 'text-slate-600'}>
                        {trend}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
