import React, { useMemo } from 'react';
import { ArticleSummary, ReliabilityStats } from '../types';
import { getReliabilitySummary } from '../utils/inventory';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  ReferenceLine
} from 'recharts';
import { 
  Trophy, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  Building2,
  ArrowRight,
  BarChart3,
  ShieldAlert,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';

interface ManagementAnalysisProps {
  data: ArticleSummary[];
}

export const ManagementAnalysis: React.FC<ManagementAnalysisProps> = ({ data }) => {
  const summary = useMemo(() => getReliabilitySummary(data, 'sede'), [data]);

  const rankingData = useMemo(() => {
    return [...summary.sedesStats].sort((a, b) => a.confiabilidad - b.confiabilidad);
  }, [summary]);

  const topLossesData = useMemo(() => {
    return [...summary.sedesStats].sort((a, b) => b.impactoEconomico - a.impactoEconomico).slice(0, 5);
  }, [summary]);

  const problematicProducts = useMemo(() => {
    // Group all data by article name to get global frequency if needed, 
    // but here we analyze based on the current provided data set.
    const items = data.map(a => {
      const impacto = Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio);
      const variacionAbs = Math.abs(a.totalDiferencia);
      const frecuencia = a.movements ? a.movements.filter(m => Math.abs(m.variacion) > 0.0001).length : 1;
      return { ...a, impacto, variacionAbs, frecuencia };
    });

    const maxImpacto = Math.max(...items.map(i => i.impacto), 1);
    const maxVariacion = Math.max(...items.map(i => i.variacionAbs), 1);
    const maxFrecuencia = Math.max(...items.map(i => i.frecuencia), 1);

    return items.map(i => {
      const score = (
        (i.impacto / maxImpacto * 0.6) + 
        (i.variacionAbs / maxVariacion * 0.3) + 
        (i.frecuencia / maxFrecuencia * 0.1)
      ) * 100;

      let nivel: 'CRÍTICO' | 'MEDIO' | 'BAJO' = 'BAJO';
      let color = '#27AE60';
      let emoji = '🟢';

      if (score >= 80) {
        nivel = 'CRÍTICO';
        color = '#EB5757';
        emoji = '🔴';
      } else if (score >= 50) {
        nivel = 'MEDIO';
        color = '#F2C94C';
        emoji = '🟠';
      }

      return { ...i, score, nivel, color, emoji };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [data]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const getStatusColor = (p: number) => {
    if (p >= 85) return '#27AE60';
    if (p >= 70) return '#F2C94C';
    return '#EB5757';
  };

  const getStatusLabel = (p: number) => {
    if (p >= 85) return 'CONFIABLE';
    if (p >= 70) return 'ALERTA';
    return 'CRÍTICO';
  };

  const getStatusEmoji = (p: number) => {
    if (p >= 85) return '🟢';
    if (p >= 70) return '🟡';
    return '🔴';
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="bg-[#1F3A5F] text-white p-8 rounded-[12px] shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">Análisis Gerencial de Inventarios</h2>
          <p className="text-[#A7C4E0] font-medium">Ranking de control y auditoría por sede</p>
        </div>
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <Trophy className="w-64 h-64" />
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[12px] border border-[#D6DEE6] border-l-4 border-[#EB5757] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#EB5757]" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sedes Críticas</span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad < 70).length}</p>
          <p className="text-sm text-slate-500 mt-1">Requieren auditoría inmediata</p>
        </div>
        <div className="bg-white p-6 rounded-[12px] border border-[#D6DEE6] border-l-4 border-[#F2C94C] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#F2C94C]" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sedes en Alerta</span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad >= 70 && s.confiabilidad < 85).length}</p>
          <p className="text-sm text-slate-500 mt-1">Necesitan seguimiento preventivo</p>
        </div>
        <div className="bg-white p-6 rounded-[12px] border border-[#D6DEE6] border-l-4 border-[#27AE60] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-5 h-5 text-[#27AE60]" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sedes Confiables</span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad >= 85).length}</p>
          <p className="text-sm text-slate-500 mt-1">Control de inventario óptimo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ranking Table */}
        <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#D6DEE6] bg-[#F5F7FA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#2F80ED]" />
              <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Ranking de Confiabilidad</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Orden: Menor a Mayor</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#A7C4E0]">
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Pos</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Sede</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Evaluados</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Impacto $</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Confiabilidad</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEE6]">
                {rankingData.map((s, idx) => (
                  <tr key={s.sede} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-rose-100 text-rose-700' : idx === rankingData.length - 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-[#1F3A5F]">{s.sede}</td>
                    <td className="px-4 py-4 text-center text-slate-600 text-sm">{s.articulosEvaluados}</td>
                    <td className="px-4 py-4 text-right font-bold text-rose-600 text-sm">{formatCurrency(s.impactoEconomico)}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-bold text-[#1F3A5F]">{Math.round(s.confiabilidad)}%</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <span>{getStatusEmoji(s.confiabilidad)}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: getStatusColor(s.confiabilidad) }}>
                          {getStatusLabel(s.confiabilidad)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bar Chart Comparison */}
        <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <BarChart3 className="w-5 h-5 text-[#2F80ED]" />
            <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Comparativa Visual de Confiabilidad</h3>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rankingData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="sede" 
                  type="category" 
                  width={120}
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#1F3A5F' }}
                />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as ReliabilityStats;
                      return (
                        <div className="bg-white p-3 border border-[#D6DEE6] shadow-xl rounded-lg">
                          <p className="font-bold text-[#1F3A5F] mb-1">{data.sede}</p>
                          <p className="text-xs text-slate-500">Confiabilidad: <span className="font-bold" style={{ color: getStatusColor(data.confiabilidad) }}>{Math.round(data.confiabilidad)}%</span></p>
                          <p className="text-xs text-slate-500">Impacto: <span className="font-bold text-rose-600">{formatCurrency(data.impactoEconomico)}</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="confiabilidad" 
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                >
                  {rankingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.confiabilidad)} />
                  ))}
                </Bar>
                <ReferenceLine x={85} stroke="#27AE60" strokeDasharray="3 3" label={{ position: 'top', value: 'Meta 85%', fill: '#27AE60', fontSize: 10, fontWeight: 700 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#27AE60]"></div>
              <span className="text-slate-500">Confiable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#F2C94C]"></div>
              <span className="text-slate-500">Alerta</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EB5757]"></div>
              <span className="text-slate-500">Crítico</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Economic Impact */}
      <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#D6DEE6] bg-[#F5F7FA] flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-[#EB5757]" />
          <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Top 5 Sedes con Mayor Impacto Económico (Pérdida)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#A7C4E0]">
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Sede</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Impacto Económico</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Artículos con Diferencia</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Confiabilidad</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Acción Sugerida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DEE6]">
              {topLossesData.map((s) => (
                <tr key={s.sede} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 p-2 rounded-lg">
                        <Building2 className="w-4 h-4 text-[#1F3A5F]" />
                      </div>
                      <span className="font-bold text-[#1F3A5F]">{s.sede}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-rose-600 text-lg">
                    {formatCurrency(s.impactoEconomico)}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600 font-medium">
                    {s.articulosConDiferencia}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-[#1F3A5F]">{Math.round(s.confiabilidad)}%</span>
                      <span className="text-[9px] font-bold" style={{ color: getStatusColor(s.confiabilidad) }}>
                        {getStatusLabel(s.confiabilidad)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[#2F80ED] font-bold text-xs uppercase tracking-wider">
                      <span>Auditoría Prioritaria</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Problematic Products Section */}
      <div className="space-y-8">
        <div className="bg-[#1F3A5F] text-white p-8 rounded-[12px] shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">Productos con Mayor Riesgo Operativo</h2>
            <p className="text-[#A7C4E0] font-medium">Artículos con mayor impacto en diferencias de inventario</p>
          </div>
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
            <ShieldAlert className="w-64 h-64" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Problematic Chart */}
          <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-8">
              <Activity className="w-5 h-5 text-[#EB5757]" />
              <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Productos más Problemáticos (Impacto $)</h3>
            </div>
            <div className="flex-1 min-h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={problematicProducts}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="articulo" 
                    type="category" 
                    width={120}
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#1F3A5F' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#F8FAFC' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border border-[#D6DEE6] shadow-xl rounded-lg">
                            <p className="font-bold text-[#1F3A5F] mb-1">{data.articulo}</p>
                            <p className="text-xs text-slate-500">Puntaje Riesgo: <span className="font-bold" style={{ color: data.color }}>{Math.round(data.score)} pts</span></p>
                            <p className="text-xs text-slate-500">Impacto: <span className="font-bold text-rose-600">{formatCurrency(data.impacto)}</span></p>
                            <p className="text-xs text-slate-500">Frecuencia: <span className="font-bold text-[#1F3A5F]">{data.frecuencia} errores</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="impacto" 
                    radius={[0, 4, 4, 0]}
                    barSize={24}
                  >
                    {problematicProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Problematic Table */}
          <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#D6DEE6] bg-[#F5F7FA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#EB5757]" />
                <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Ranking de Riesgo Operativo</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#A7C4E0]">
                    <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Pos</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Artículo</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Impacto $</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Err.</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Riesgo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D6DEE6]">
                  {problematicProducts.map((p, idx) => (
                    <tr key={p.articulo} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-slate-500">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#1F3A5F] text-sm">{p.articulo}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">{p.cc || 'SIN CC'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-rose-600 text-sm">{formatCurrency(p.impacto)}</td>
                      <td className="px-4 py-4 text-center text-slate-600 font-bold">{p.frecuencia}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <span>{p.emoji}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.color }}>
                            {p.nivel}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
