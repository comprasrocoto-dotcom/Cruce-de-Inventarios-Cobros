import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend,
} from 'recharts';
import { 
  Trophy, 
  TrendingDown, 
  TrendingUp,
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
  selectedSede?: string;
}

const getRiskLevel = (impact: 'ALTO' | 'MEDIO' | 'BAJO', freq: 'ALTA' | 'MEDIA' | 'BAJA') => {
  if (impact === 'ALTO') {
    if (freq === 'BAJA') return { label: 'Medio', emoji: 'ð ', color: '#F2C94C' };
    return { label: 'CrÃ­tico', emoji: 'ð´', color: '#EB5757' };
  }
  if (impact === 'MEDIO') {
    if (freq === 'BAJA') return { label: 'Bajo', emoji: 'ð¢', color: '#27AE60' };
    if (freq === 'MEDIA') return { label: 'Medio', emoji: 'ð ', color: '#F2C94C' };
    return { label: 'CrÃ­tico', emoji: 'ð´', color: '#EB5757' };
  }
  // BAJO
  if (freq === 'ALTA') return { label: 'Medio', emoji: 'ð ', color: '#F2C94C' };
  return { label: 'Bajo', emoji: 'ð¢', color: '#27AE60' };
};

export const ManagementAnalysis: React.FC<ManagementAnalysisProps> = ({ data, selectedSede }) => {
  const filteredData = useMemo(() => {
    if (!selectedSede) return data;
    return data.filter(a => a.sede === selectedSede);
  }, [data, selectedSede]);

  const summary = useMemo(() => getReliabilitySummary(filteredData, selectedSede ? 'cc' : 'sede'), [filteredData, selectedSede]);

  const rankingData = useMemo(() => {
    return [...summary.sedesStats].sort((a, b) => a.confiabilidad - b.confiabilidad);
  }, [summary]);

  const topLossesData = useMemo(() => {
    return [...summary.sedesStats].sort((a, b) => b.impactoEconomico - a.impactoEconomico).slice(0, 5);
  }, [summary]);

  const problematicProducts = useMemo(() => {
    const items = filteredData.map(a => {
      const impacto = Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio);
      const variacionAbs = Math.abs(a.totalDiferencia);
      const frecuencia = a.movements ? a.movements.filter(m => Math.abs(m.variacion) > 0.0001).length : 1;
      return { ...a, impacto, variacionAbs, frecuencia };
    });

    if (items.length === 0) return [];

    const maxImpacto = Math.max(...items.map(i => i.impacto), 1);
    const maxVariacion = Math.max(...items.map(i => i.variacionAbs), 1);
    const maxFrecuencia = Math.max(...items.map(i => i.frecuencia), 1);

    return items.map(i => {
      const score = (
        (i.impacto / maxImpacto * 0.6) + 
        (i.variacionAbs / maxVariacion * 0.3) + 
        (i.frecuencia / maxFrecuencia * 0.1)
      ) * 100;

      let nivel: 'CRÃTICO' | 'MEDIO' | 'BAJO' = 'BAJO';
      let color = '#27AE60';
      let emoji = 'ð¢';

      if (score >= 80) {
        nivel = 'CRÃTICO';
        color = '#EB5757';
        emoji = 'ð´';
      } else if (score >= 50) {
        nivel = 'MEDIO';
        color = '#F2C94C';
        emoji = 'ð ';
      }

      return { ...i, score, nivel, color, emoji };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [filteredData]);

  const topGainsProducts = useMemo(() => {
    return [...filteredData]
      .filter(a => a.totalDiferencia > 0.0001)
      .sort((a, b) => (b.totalDiferencia * (b.ultimoCoste || b.costePromedio)) - (a.totalDiferencia * (a.ultimoCoste || a.costePromedio)))
      .slice(0, 5);
  }, [filteredData]);

  const topLossesProducts = useMemo(() => {
    return [...filteredData]
      .filter(a => a.totalDiferencia < -0.0001)
      .sort((a, b) => (Math.abs(b.totalDiferencia) * (b.ultimoCoste || b.costePromedio)) - (Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio)))
      .slice(0, 5);
  }, [filteredData]);

  const riskMatrixData = useMemo(() => {
    const items = filteredData.map(a => {
      const impacto = Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio);
      const variacionAbs = Math.abs(a.totalDiferencia);
      const frecuencia = a.movements ? a.movements.filter(m => Math.abs(m.variacion) > 0.0001).length : 1;
      return { ...a, impacto, variacionAbs, frecuencia };
    }).filter(i => i.impacto > 0 || i.frecuencia > 0);

    if (items.length === 0) return [];

    const sortedByImpact = [...items].sort((a, b) => b.impacto - a.impacto);
    const total = sortedByImpact.length;

    return sortedByImpact.map((item, index) => {
      const percentile = (index / total) * 100;
      
      let nivelImpacto: 'ALTO' | 'MEDIO' | 'BAJO' = 'BAJO';
      if (percentile < 20) nivelImpacto = 'ALTO';
      else if (percentile < 60) nivelImpacto = 'MEDIO';

      let nivelFrecuencia: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
      if (item.frecuencia > 3) nivelFrecuencia = 'ALTA';
      else if (item.frecuencia >= 2) nivelFrecuencia = 'MEDIA';

      const risk = getRiskLevel(nivelImpacto, nivelFrecuencia);

      return {
        ...item,
        nivelImpacto,
        nivelFrecuencia,
        riskLabel: risk.label,
        riskEmoji: risk.emoji,
        riskColor: risk.color
      };
    });
  }, [filteredData]);

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
    return 'CRÃTICO';
  };

  const getStatusEmoji = (p: number) => {
    if (p >= 85) return 'ð¢';
    if (p >= 70) return 'ð¡';
    return 'ð´';
  };

  const [historicalSedeFiler, setHistoricalSedeFiler] = useState('');
  const [agrupacion, setAgrupacion] = useState('sede');
  const sedesForHistorical = useMemo(() => Array.from(new Set(filteredData.map((a) => a.sede))).sort(), [filteredData]);
  const historicalBarData = useMemo(() => {
    const sedes = historicalSedeFiler ? [historicalSedeFiler] : Array.from(new Set(filteredData.map((a) => a.sede))).sort();
    return sedes.map(sede => {
      const items = filteredData.filter((a) => a.sede === sede);
      const total = items.length;
      const conDif = items.filter((a) => a.tipo !== 'SIN_VARIACION').length;
      const confiabilidad = total > 0 ? ((total - conDif) / total) * 100 : 100;
      return { sede, confiabilidad: Math.round(confiabilidad * 100) / 100, total, conDif };
    }).sort((a, b) => a.confiabilidad - b.confiabilidad);
  }, [filteredData, historicalSedeFiler]);
  const economicBarData = useMemo(() => {
    if (agrupacion === 'sede') {
      const sedes = Array.from(new Set(filteredData.map((a) => a.sede))).sort();
      return sedes.map(sede => {
        const items = filteredData.filter((a) => a.sede === sede);
        const perdidas = items.reduce((acc, a) => acc + (a.valorPerdida || 0), 0);
        const sobrantes = items.reduce((acc, a) => acc + (a.valorSobrante || 0), 0);
        return { label: sede, perdidas, sobrantes, balance: sobrantes - perdidas };
      });
    }
    const byMonth = new Map();
    filteredData.forEach((a) => {
      (a.movements || []).forEach((m) => {
        if (!m.fecha) return;
        const key = new Date(m.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'short' });
        if (!byMonth.has(key)) byMonth.set(key, { perdidas: 0, sobrantes: 0 });
        const e = byMonth.get(key);
        if (m.variacion < 0) e.perdidas += Math.abs(m.costeLinea || 0);
        else if (m.variacion > 0) e.sobrantes += (m.costeLinea || 0);
      });
    });
    return Array.from(byMonth.entries()).map(([label, v]) => ({ label, perdidas: v.perdidas, sobrantes: v.sobrantes, balance: v.sobrantes - v.perdidas })).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredData, agrupacion]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="bg-[#1F3A5F] text-white p-8 rounded-[12px] shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">
            AnÃ¡lisis Gerencial de Inventarios {selectedSede ? `â ${selectedSede}` : ''}
          </h2>
          <p className="text-[#A7C4E0] font-medium">
            {selectedSede ? `AuditorÃ­a detallada para ${selectedSede}` : 'Ranking de control y auditorÃ­a por sede'}
          </p>
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
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {selectedSede ? 'CC CrÃ­ticos' : 'Sedes CrÃ­ticas'}
            </span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad < 70).length}</p>
          <p className="text-sm text-slate-500 mt-1">Requieren auditorÃ­a inmediata</p>
        </div>
        <div className="bg-white p-6 rounded-[12px] border border-[#D6DEE6] border-l-4 border-[#F2C94C] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#F2C94C]" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {selectedSede ? 'CC en Alerta' : 'Sedes en Alerta'}
            </span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad >= 70 && s.confiabilidad < 85).length}</p>
          <p className="text-sm text-slate-500 mt-1">Necesitan seguimiento preventivo</p>
        </div>
        <div className="bg-white p-6 rounded-[12px] border border-[#D6DEE6] border-l-4 border-[#27AE60] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-5 h-5 text-[#27AE60]" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {selectedSede ? 'CC Confiables' : 'Sedes Confiables'}
            </span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad >= 85).length}</p>
          <p className="text-sm text-slate-500 mt-1">Control de inventario Ã³ptimo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ranking Table */}
        <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-[#D6DEE6] bg-[#F5F7FA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#2F80ED]" />
              <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">
                Ranking de Confiabilidad {selectedSede ? `â ${selectedSede}` : ''}
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Orden: Menor a Mayor</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#A7C4E0]">
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Pos</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">
                    {selectedSede ? 'Centro de Costos' : 'Sede'}
                  </th>
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
              <span className="text-slate-500">CrÃ­tico</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Economic Impact */}
      <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#D6DEE6] bg-[#F5F7FA] flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-[#EB5757]" />
          <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">
            {selectedSede ? `Top Impacto EconÃ³mico en ${selectedSede}` : 'Top 5 Sedes con Mayor Impacto EconÃ³mico (PÃ©rdida)'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#A7C4E0]">
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">
                  {selectedSede ? 'Centro de Costos' : 'Sede'}
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Impacto EconÃ³mico</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">ArtÃ­culos con Diferencia</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Confiabilidad</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">AcciÃ³n Sugerida</th>
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
                      <span>AuditorÃ­a Prioritaria</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Gains and Losses Products (New Section) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#D6DEE6] bg-[#F5F7FA] flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-[#EB5757]" />
            <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Top 5 PÃ©rdidas CrÃ­ticas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#A7C4E0]">
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">ArtÃ­culo</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">VariaciÃ³n</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Impacto $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEE6]">
                {topLossesProducts.map((p) => (
                  <tr key={p.articulo + p.cc + p.sede} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#1F3A5F] text-xs">{p.articulo}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-bold">{p.cc || 'SIN CC'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 font-bold text-xs">
                      {p.totalDiferencia.toFixed(2)} {p.subarticulo}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#1F3A5F] text-xs">
                      {formatCurrency(Math.abs(p.totalDiferencia) * (p.ultimoCoste || p.costePromedio))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#D6DEE6] bg-[#F5F7FA] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#27AE60]" />
            <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Top 5 Ganancias (Sobrantes)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#A7C4E0]">
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">ArtÃ­culo</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">VariaciÃ³n</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Impacto $</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEE6]">
                {topGainsProducts.map((p) => (
                  <tr key={p.articulo + p.cc + p.sede} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#1F3A5F] text-xs">{p.articulo}</span>
                        <span className="text-[9px] text-slate-400 uppercase font-bold">{p.cc || 'SIN CC'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-bold text-xs">
                      +{p.totalDiferencia.toFixed(2)} {p.subarticulo}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#1F3A5F] text-xs">
                      {formatCurrency(Math.abs(p.totalDiferencia) * (p.ultimoCoste || p.costePromedio))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Problematic Products Section */}
      <div className="space-y-8">
        <div className="bg-[#1F3A5F] text-white p-8 rounded-[12px] shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">
              Productos con Mayor Riesgo Operativo {selectedSede ? `â ${selectedSede}` : ''}
            </h2>
            <p className="text-[#A7C4E0] font-medium">
              {selectedSede ? `AnÃ¡lisis de criticidad para ${selectedSede}` : 'ArtÃ­culos con mayor impacto en diferencias de inventario'}
            </p>
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
              <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Productos mÃ¡s ProblemÃ¡ticos (Impacto $)</h3>
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
                <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">
                  Ranking de Riesgo Operativo {selectedSede ? `â ${selectedSede}` : ''}
                </h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#A7C4E0]">
                    <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Pos</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">ArtÃ­culo</th>
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

      {/* COMPARATIVO HISTÓRICO DE CONFIABILIDAD POR SEDE */}
      <div className="space-y-8">
        <div className="bg-[#1F3A5F] text-white p-8 rounded-[12px] shadow-lg">
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">
            Comparativo Histórico de Confiabilidad por Sede
          </h2>
          <p className="text-[#A7C4E0] mt-1 text-sm">
            Evalúa si cada sede mejora o empeora entre inventarios consecutivos
          </p>
        </div>

        {/* Bar Chart - Confiabilidad por Sede */}
        <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#2F80ED]" />
              <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">
                Confiabilidad por Sede {selectedSede ? `— ${selectedSede}` : '(Todas)'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Filtrar Sede:</label>
              <select
                value={historicalSedeFiler}
                onChange={e => setHistoricalSedeFiler(e.target.value)}
                className="text-sm border border-[#D6DEE6] rounded-lg px-3 py-1.5 text-[#1F3A5F] focus:outline-none"
              >
                <option value="">Todas</option>
                {sedesForHistorical.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicalBarData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="sede" tick={{ fontSize: 10, fontWeight: 700, fill: '#1F3A5F' }} angle={-35} textAnchor="end" height={80} />
                <YAxis domain={[0, 100]} tickFormatter={v => v + '%'} tick={{ fontSize: 10, fontWeight: 700, fill: '#1F3A5F' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-white p-3 border border-[#D6DEE6] shadow-xl rounded-lg">
                          <p className="font-bold text-[#1F3A5F] mb-1">{d?.sede}</p>
                          <p className="text-xs text-slate-500">Confiabilidad: <span className="font-bold">{d?.confiabilidad}%</span></p>
                          <p className="text-xs text-slate-500">Con diferencia: <span className="font-bold">{d?.conDif}</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={98} stroke="#27AE60" strokeDasharray="5 5" />
                <ReferenceLine y={90} stroke="#F2C94C" strokeDasharray="5 5" />
                <ReferenceLine y={80} stroke="#EB5757" strokeDasharray="5 5" />
                <Bar dataKey="confiabilidad" name="Confiabilidad %" radius={[4, 4, 0, 0]}>
                  {historicalBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.confiabilidad >= 98 ? '#27AE60' : entry.confiabilidad >= 95 ? '#2F80ED' : entry.confiabilidad >= 90 ? '#F2C94C' : entry.confiabilidad >= 80 ? '#F2994A' : '#EB5757'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {historicalBarData.map(entry => (
              <div key={entry.sede} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs font-bold text-[#1F3A5F]">{entry.sede}</p>
                <p className="text-lg font-bold" style={{ color: entry.confiabilidad >= 98 ? '#27AE60' : entry.confiabilidad >= 95 ? '#2F80ED' : entry.confiabilidad >= 90 ? '#D4A017' : entry.confiabilidad >= 80 ? '#F2994A' : '#EB5757' }}>
                  {entry.confiabilidad}%
                </p>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${entry.confiabilidad >= 98 ? 'bg-green-100 text-green-700' : entry.confiabilidad >= 95 ? 'bg-blue-100 text-blue-700' : entry.confiabilidad >= 90 ? 'bg-yellow-100 text-yellow-700' : entry.confiabilidad >= 80 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                  {entry.confiabilidad >= 98 ? 'Excelente' : entry.confiabilidad >= 95 ? 'Buena' : entry.confiabilidad >= 90 ? 'Aceptable' : entry.confiabilidad >= 80 ? 'Riesgo' : 'Critica'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Economic Analysis - Grouping by Sede/Mes */}
        <div className="bg-white rounded-[12px] border border-[#D6DEE6] shadow-sm p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#EB5757]" />
              <h3 className="font-bold text-[#1F3A5F] uppercase tracking-tight">Análisis Económico</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase">Agrupar por:</span>
              <button onClick={() => setAgrupacion('sede')} className={`px-3 py-1.5 text-xs rounded-full font-bold ${agrupacion === 'sede' ? 'bg-[#1F3A5F] text-white' : 'bg-slate-100 text-slate-500'}`}>○ Sede</button>
              <button onClick={() => setAgrupacion('mes')} className={`px-3 py-1.5 text-xs rounded-full font-bold ${agrupacion === 'mes' ? 'bg-[#1F3A5F] text-white' : 'bg-slate-100 text-slate-500'}`}>○ Mes</button>
            </div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={economicBarData} margin={{ top: 20, right: 30, left: 20, bottom: agrupacion === 'sede' ? 80 : 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 700, fill: '#1F3A5F' }} angle={agrupacion === 'sede' ? -35 : 0} textAnchor={agrupacion === 'sede' ? 'end' : 'middle'} height={agrupacion === 'sede' ? 80 : 40} />
                <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#1F3A5F' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-[#D6DEE6] shadow-xl rounded-lg">
                          <p className="font-bold text-[#1F3A5F] mb-2">{payload[0]?.payload?.label}</p>
                          {payload.map((p, i) => (
                            <p key={i} className="text-xs" style={{ color: p.color }}>
                              {p.name}: <span className="font-bold">{formatCurrency(Math.abs(Number(p.value || 0)))}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="perdidas" name="Perdidas" fill="#EB5757" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sobrantes" name="Sobrantes" fill="#27AE60" radius={[4, 4, 0, 0]} />
                <Bar dataKey="balance" name="Balance Neto" fill="#2F80ED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#F5F7FA] border-b border-[#D6DEE6]">
                  <th className="px-4 py-3 font-bold text-[#1F3A5F] uppercase">{agrupacion === 'sede' ? 'Sede' : 'Mes'}</th>
                  <th className="px-4 py-3 font-bold text-[#1F3A5F] uppercase text-right">Valor Perdidas</th>
                  <th className="px-4 py-3 font-bold text-[#1F3A5F] uppercase text-right">Valor Sobrantes</th>
                  <th className="px-4 py-3 font-bold text-[#1F3A5F] uppercase text-right">Balance Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D6DEE6]">
                {economicBarData.map(row => (
                  <tr key={row.label} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-[#1F3A5F]">{row.label}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(row.perdidas)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[#27AE60]">{formatCurrency(row.sobrantes)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${row.balance >= 0 ? 'text-[#2F80ED]' : 'text-rose-600'}`}>
                      {formatCurrency(Math.abs(row.balance))} {row.balance >= 0 ? '(Favor)' : '(Deficit)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-[#D6DEE6] text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Sistema de Auditoría de Inventarios — Análisis generado automáticamente
          </p>
        </div>
      </div>
  );
};
