/**
 * Análisis Gerencial. Presenta una lectura ejecutiva por sede (o global) con
 * foco en impacto económico, faltantes/sobrantes y estabilidad, pensada para
 * la toma de decisiones. Corresponde a la pestaña Gerencial.
 */
import React, { useMemo, useState } from 'react';
import { ArticleSummary, ReliabilityStats } from '../types';
import { getReliabilitySummary } from '../utils/inventory';
import { HelpTip } from './HelpTip';
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
  AlertTriangle,
  CheckCircle2,
  Building2,
  ArrowRight,
  BarChart3,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { motion } from 'motion/react';

interface ManagementAnalysisProps {
  data: ArticleSummary[];
  selectedSede?: string;
}

const getRiskLevel = (impact: 'ALTO' | 'MEDIO' | 'BAJO', freq: 'ALTA' | 'MEDIA' | 'BAJA') => {
  if (impact === 'ALTO') {
    if (freq === 'BAJA') return { label: 'Medio', emoji: '🟠', color: '#ef6c00' };
    return { label: 'Crítico', emoji: '🔴', color: '#d32f2f' };
  }
  if (impact === 'MEDIO') {
    if (freq === 'BAJA') return { label: 'Bajo', emoji: '🟢', color: '#2e7d32' };
    if (freq === 'MEDIA') return { label: 'Medio', emoji: '🟠', color: '#ef6c00' };
    return { label: 'Crítico', emoji: '🔴', color: '#d32f2f' };
  }
  // BAJO
  if (freq === 'ALTA') return { label: 'Medio', emoji: '🟠', color: '#ef6c00' };
  return { label: 'Bajo', emoji: '🟢', color: '#2e7d32' };
};

export const ManagementAnalysis: React.FC<ManagementAnalysisProps> = ({ data, selectedSede }) => {
  const filteredData = useMemo(() => {
    if (!selectedSede) return data;
    return data.filter((a) => a.sede === selectedSede);
  }, [data, selectedSede]);

  const summary = useMemo(
    () => getReliabilitySummary(filteredData, selectedSede ? 'cc' : 'sede'),
    [filteredData, selectedSede]
  );

  const rankingData = useMemo(() => {
    return [...summary.sedesStats].sort((a, b) => a.confiabilidad - b.confiabilidad);
  }, [summary]);

  const topLossesData = useMemo(() => {
    return [...summary.sedesStats]
      .sort((a, b) => b.impactoEconomico - a.impactoEconomico)
      .slice(0, 5);
  }, [summary]);

  const problematicProducts = useMemo(() => {
    const items = filteredData.map((a) => {
      const impacto = Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio);
      const variacionAbs = Math.abs(a.totalDiferencia);
      const frecuencia = a.movements
        ? a.movements.filter((m) => Math.abs(m.variacion) > 0.0001).length
        : 1;
      return { ...a, impacto, variacionAbs, frecuencia };
    });

    if (items.length === 0) return [];

    const maxImpacto = Math.max(...items.map((i) => i.impacto), 1);
    const maxVariacion = Math.max(...items.map((i) => i.variacionAbs), 1);
    const maxFrecuencia = Math.max(...items.map((i) => i.frecuencia), 1);

    return items
      .map((i) => {
        const score =
          ((i.impacto / maxImpacto) * 0.6 +
            (i.variacionAbs / maxVariacion) * 0.3 +
            (i.frecuencia / maxFrecuencia) * 0.1) *
          100;

        let nivel: 'CRÍTICO' | 'MEDIO' | 'BAJO' = 'BAJO';
        let color = '#2e7d32';
        let emoji = '🟢';

        if (score >= 80) {
          nivel = 'CRÍTICO';
          color = '#d32f2f';
          emoji = '🔴';
        } else if (score >= 50) {
          nivel = 'MEDIO';
          color = '#ef6c00';
          emoji = '🟠';
        }

        return { ...i, score, nivel, color, emoji };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [filteredData]);

  // Estado para agrupar por mes o por sede
  const [groupBy, setGroupBy] = useState<'mes' | 'sede'>('mes');
  const [selectedSedeFilter, setSelectedSedeFilter] = useState<string>('all');

  // Datos para el Comparativo Historico de Confiabilidad por Sede
  const historicalData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const inventoryMap = new Map<
      string,
      Map<
        string,
        {
          sede: string;
          fecha: string;
          total: number;
          conDiferencia: number;
          perdidas: number;
          sobrantes: number;
        }
      >
    >();
    data.forEach((a) => {
      if (!a.movements) return;
      a.movements.forEach((m) => {
        const fecha = m.fecha ? new Date(m.fecha).toISOString().slice(0, 10) : 'Sin fecha';
        const sede = m.sede || a.sede || 'Sin sede';
        if (!inventoryMap.has(fecha)) inventoryMap.set(fecha, new Map());
        const sedeMap = inventoryMap.get(fecha)!;
        if (!sedeMap.has(sede)) {
          sedeMap.set(sede, { sede, fecha, total: 0, conDiferencia: 0, perdidas: 0, sobrantes: 0 });
        }
        const entry = sedeMap.get(sede)!;
        entry.total++;
        if (Math.abs(m.variacion || 0) > 0.0001) entry.conDiferencia++;
        if ((m.variacion || 0) < -0.0001)
          entry.perdidas += Math.abs(m.variacion || 0) * (m.costeLinea || 0);
        if ((m.variacion || 0) > 0.0001)
          entry.sobrantes += (m.variacion || 0) * (m.costeLinea || 0);
      });
    });
    const result: {
      sede: string;
      fecha: string;
      confiabilidad: number;
      perdidas: number;
      sobrantes: number;
      total: number;
    }[] = [];
    inventoryMap.forEach((sedeMap, fecha) => {
      sedeMap.forEach((entry) => {
        const confiabilidad =
          entry.total > 0 ? ((entry.total - entry.conDiferencia) / entry.total) * 100 : 100;
        result.push({
          sede: entry.sede,
          fecha,
          confiabilidad: Math.round(confiabilidad * 10) / 10,
          perdidas: entry.perdidas,
          sobrantes: entry.sobrantes,
          total: entry.total,
        });
      });
    });
    return result.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [data]);

  const sedeHistoricalData = useMemo(() => {
    const sedeMap = new Map<
      string,
      {
        sede: string;
        confiabilidad: number;
        perdidas: number;
        sobrantes: number;
        total: number;
        count: number;
      }
    >();
    historicalData.forEach((item) => {
      if (!sedeMap.has(item.sede)) {
        sedeMap.set(item.sede, {
          sede: item.sede,
          confiabilidad: 0,
          perdidas: 0,
          sobrantes: 0,
          total: 0,
          count: 0,
        });
      }
      const entry = sedeMap.get(item.sede)!;
      entry.confiabilidad += item.confiabilidad;
      entry.perdidas += item.perdidas;
      entry.sobrantes += item.sobrantes;
      entry.total += item.total;
      entry.count++;
    });
    return Array.from(sedeMap.values())
      .map((e) => ({
        ...e,
        confiabilidad: e.count > 0 ? Math.round((e.confiabilidad / e.count) * 10) / 10 : 100,
        balance: e.sobrantes - e.perdidas,
      }))
      .sort((a, b) => a.confiabilidad - b.confiabilidad);
  }, [historicalData]);

  const fechasDisponibles = useMemo(() => {
    return [...new Set(historicalData.map((d) => d.fecha))].sort();
  }, [historicalData]);

  const sedesDisponibles = useMemo(() => {
    return [...new Set(historicalData.map((d) => d.sede))].sort();
  }, [historicalData]);

  const chartDataByMes = useMemo(() => {
    if (fechasDisponibles.length === 0) return [];
    const filtered =
      selectedSedeFilter === 'all'
        ? historicalData
        : historicalData.filter((d) => d.sede === selectedSedeFilter);
    return fechasDisponibles.map((fecha) => {
      const obj: Record<string, string | number> = { fecha };
      const itemsForFecha = filtered.filter((d) => d.fecha === fecha);
      itemsForFecha.forEach((item) => {
        obj[item.sede] = item.confiabilidad;
      });
      return obj;
    });
  }, [historicalData, fechasDisponibles, selectedSedeFilter]);

  const sedeColors = useMemo(() => {
    const colors = [
      '#2F80ED',
      '#2e7d32',
      '#ef6c00',
      '#d32f2f',
      '#9B51E0',
      '#2D9CDB',
      '#6FCF97',
      '#ef6c00',
      '#BB6BD9',
      '#56CCF2',
    ];
    const map: Record<string, string> = {};
    sedesDisponibles.forEach((sede, i) => {
      map[sede] = colors[i % colors.length];
    });
    return map;
  }, [sedesDisponibles]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);

  const getStatusColor = (p: number) => {
    if (p >= 85) return '#2e7d32';
    if (p >= 70) return '#ef6c00';
    return '#d32f2f';
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
      <div className="bg-[#f5f7fa] text-text-main p-8 rounded-[12px] shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">
            <HelpTip clave="gerencial" className="mr-2" />
            Análisis Gerencial de Inventarios {selectedSede ? `— ${selectedSede}` : ''}
          </h2>
          <p className="text-text-secondary font-medium">
            {selectedSede
              ? `Auditoría detallada para ${selectedSede}`
              : 'Ranking de control y auditoría por sede'}
          </p>
        </div>
        <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
          <Trophy className="w-64 h-64" />
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#ffffff] p-6 rounded-[12px] border border-brand-border border-l-4 border-[#d32f2f] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#d32f2f]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              {selectedSede ? 'CC Críticos' : 'Sedes Críticas'}
            </span>
          </div>
          <p className="text-3xl font-bold text-text-main">
            {summary.sedesStats.filter((s) => s.confiabilidad < 70).length}
          </p>
          <p className="text-sm text-text-secondary mt-1">Requieren auditoría inmediata</p>
        </div>
        <div className="bg-[#ffffff] p-6 rounded-[12px] border border-brand-border border-l-4 border-[#ef6c00] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#ef6c00]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              {selectedSede ? 'CC en Alerta' : 'Sedes en Alerta'}
            </span>
          </div>
          <p className="text-3xl font-bold text-text-main">
            {summary.sedesStats.filter((s) => s.confiabilidad >= 70 && s.confiabilidad < 85).length}
          </p>
          <p className="text-sm text-text-secondary mt-1">Necesitan seguimiento preventivo</p>
        </div>
        <div className="bg-[#ffffff] p-6 rounded-[12px] border border-brand-border border-l-4 border-[#2e7d32] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-5 h-5 text-[#2e7d32]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">
              {selectedSede ? 'CC Confiables' : 'Sedes Confiables'}
            </span>
          </div>
          <p className="text-3xl font-bold text-text-main">
            {summary.sedesStats.filter((s) => s.confiabilidad >= 85).length}
          </p>
          <p className="text-sm text-text-secondary mt-1">Control de inventario óptimo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ranking Table */}
        <div className="bg-[#ffffff] rounded-[12px] border border-brand-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-brand-border bg-[#ffffff] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#1976d2]" />
              <h3 className="font-bold text-text-main uppercase tracking-tight">
                Ranking de Confiabilidad {selectedSede ? `— ${selectedSede}` : ''}
              </h3>
            </div>
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
              Orden: Menor a Mayor
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#f5f7fa]">
                  <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest">
                    {selectedSede ? 'Centro de Costos' : 'Sede'}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest text-center">
                    Evaluados
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest text-right">
                    Impacto $
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest text-center">
                    Confiabilidad
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {rankingData.map((s, idx) => (
                  <tr key={s.sede} className="hover:bg-[#f5f7fa] transition-colors">
                    <td className="px-4 py-4">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-[#fdecea] text-rose-400' : idx === rankingData.length - 1 ? 'bg-[#e8f5e9] text-emerald-700' : 'bg-slate-100 text-text-secondary'}`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-text-main">{s.sede}</td>
                    <td className="px-4 py-4 text-center text-text-secondary text-sm">
                      {s.articulosEvaluados}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-rose-600 text-sm">
                      {formatCurrency(s.impactoEconomico)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-bold text-text-main">
                        {Math.round(s.confiabilidad)}%
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        <span>{getStatusEmoji(s.confiabilidad)}</span>
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: getStatusColor(s.confiabilidad) }}
                        >
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
        <div className="bg-[#ffffff] rounded-[12px] border border-brand-border shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-8">
            <BarChart3 className="w-5 h-5 text-[#1976d2]" />
            <h3 className="font-bold text-text-main uppercase tracking-tight">
              Comparativa Visual de Confiabilidad
            </h3>
          </div>
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rankingData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={true}
                  vertical={false}
                  stroke="#e3f2fd"
                />
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
                        <div className="bg-[#ffffff] p-3 border border-brand-border shadow-xl rounded-lg bg-[#ffffff]">
                          <p className="font-bold text-text-main mb-1">{data.sede}</p>
                          <p className="text-xs text-text-secondary">
                            Confiabilidad:{' '}
                            <span
                              className="font-bold"
                              style={{ color: getStatusColor(data.confiabilidad) }}
                            >
                              {Math.round(data.confiabilidad)}%
                            </span>
                          </p>
                          <p className="text-xs text-text-secondary">
                            Impacto:{' '}
                            <span className="font-bold text-rose-600">
                              {formatCurrency(data.impactoEconomico)}
                            </span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="confiabilidad" radius={[0, 4, 4, 0]} barSize={24}>
                  {rankingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getStatusColor(entry.confiabilidad)} />
                  ))}
                </Bar>
                <ReferenceLine
                  x={85}
                  stroke="#2e7d32"
                  strokeDasharray="3 3"
                  label={{
                    position: 'top',
                    value: 'Meta 85%',
                    fill: '#2e7d32',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#2e7d32]"></div>
              <span className="text-text-secondary">Confiable</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#1976d2]"></div>
              <span className="text-text-secondary">Alerta</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#d32f2f]"></div>
              <span className="text-text-secondary">Crítico</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Economic Impact */}
      <div className="bg-[#ffffff] rounded-[12px] border border-brand-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-border bg-[#ffffff] flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-[#d32f2f]" />
          <h3 className="font-bold text-text-main uppercase tracking-tight">
            {selectedSede
              ? `Top Impacto Económico en ${selectedSede}`
              : 'Top 5 Sedes con Mayor Impacto Económico (Pérdida)'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f5f7fa]">
                <th className="px-6 py-4 text-[10px] font-bold text-text-main uppercase tracking-widest">
                  {selectedSede ? 'Centro de Costos' : 'Sede'}
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-main uppercase tracking-widest text-right">
                  Impacto Económico
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-main uppercase tracking-widest text-center">
                  Artículos con Diferencia
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-main uppercase tracking-widest text-center">
                  Confiabilidad
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-main uppercase tracking-widest">
                  Acción Sugerida
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {topLossesData.map((s) => (
                <tr key={s.sede} className="hover:bg-[#f5f7fa] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-[#f5f7fa] p-2 rounded-lg">
                        <Building2 className="w-4 h-4 text-text-main" />
                      </div>
                      <span className="font-bold text-text-main">{s.sede}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-rose-600 text-lg">
                    {formatCurrency(s.impactoEconomico)}
                  </td>
                  <td className="px-6 py-4 text-center text-text-secondary font-medium">
                    {s.articulosConDiferencia}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-text-main">
                        {Math.round(s.confiabilidad)}%
                      </span>
                      <span
                        className="text-[9px] font-bold"
                        style={{ color: getStatusColor(s.confiabilidad) }}
                      >
                        {getStatusLabel(s.confiabilidad)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[#1976d2] font-bold text-xs uppercase tracking-wider">
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

      {/* Problematic Table */}
      <div className="bg-[#ffffff] rounded-[12px] border border-brand-border shadow-sm overflow-hidden flex flex-col">
        <div className="p-6 border-b border-brand-border bg-[#ffffff] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#d32f2f]" />
            <h3 className="font-bold text-text-main uppercase tracking-tight">
              Ranking de Riesgo Operativo {selectedSede ? `— ${selectedSede}` : ''}
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f5f7fa]">
                <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest">
                  Pos
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest">
                  Artículo
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest text-right">
                  Impacto $
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest text-center">
                  Err.
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-text-main uppercase tracking-widest">
                  Riesgo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {problematicProducts.map((p, idx) => (
                <tr key={p.articulo} className="hover:bg-[#f5f7fa] transition-colors">
                  <td className="px-4 py-4">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-100 text-text-secondary">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-text-main text-sm">{p.articulo}</span>
                      <span className="text-[10px] text-text-secondary uppercase font-bold">
                        {p.cc || 'SIN CC'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-rose-600 text-sm">
                    {formatCurrency(p.impacto)}
                  </td>
                  <td className="px-4 py-4 text-center text-text-secondary font-bold">
                    {p.frecuencia}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <span>{p.emoji}</span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: p.color }}
                      >
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

      {/* Comparativo Historico de Confiabilidad por Sede */}
      <div className="space-y-8">
        <div className="bg-[#f5f7fa] text-text-main p-8 rounded-[12px] shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">
              Comparativo Histórico de Confiabilidad por Sede
            </h2>
            <p className="text-text-secondary font-medium">
              Evaluación de tendencias de confiabilidad entre inventarios consecutivos
            </p>
          </div>
          <div className="absolute right-0 top-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
            <BarChart3 className="w-64 h-64" />
          </div>
        </div>

        {/* Selector de agrupacion */}
        <div className="bg-[#ffffff] rounded-[12px] border border-brand-border shadow-sm p-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="font-bold text-text-main text-sm uppercase tracking-tight">
                Agrupar por:
              </span>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="groupBy"
                    value="mes"
                    checked={groupBy === 'mes'}
                    onChange={() => setGroupBy('mes')}
                    className="accent-[#2F80ED]"
                  />
                  <span className="text-sm font-medium text-text-main">Por Mes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="groupBy"
                    value="sede"
                    checked={groupBy === 'sede'}
                    onChange={() => setGroupBy('sede')}
                    className="accent-[#2F80ED]"
                  />
                  <span className="text-sm font-medium text-text-main">Por Sede</span>
                </label>
              </div>
            </div>
            {groupBy === 'mes' && sedesDisponibles.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="font-bold text-text-main text-sm uppercase tracking-tight">
                  Filtrar sede:
                </span>
                <select
                  value={selectedSedeFilter}
                  onChange={(e) => setSelectedSedeFilter(e.target.value)}
                  className="border border-brand-border rounded-lg px-3 py-1.5 text-sm text-text-main font-medium bg-[#ffffff] focus:outline-none focus:ring-2 focus:ring-[#2F80ED]"
                >
                  <option value="all">Todas las sedes</option>
                  {sedesDisponibles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {groupBy === 'mes' ? (
          <div className="bg-[#ffffff] rounded-[12px] border border-brand-border shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-[#1976d2]" />
              <h3 className="font-bold text-text-main uppercase tracking-tight">
                Confiabilidad por Inventario
              </h3>
            </div>
            {chartDataByMes.length === 0 ? (
              <div className="flex-1 min-h-[300px] flex items-center justify-center">
                <p className="text-text-secondary text-sm font-medium">
                  No hay datos de movimientos disponibles
                </p>
              </div>
            ) : (
              /* Altura EXPLÍCITA: dentro de flex, ResponsiveContainer con
                 height=100% puede medir 0px y la gráfica "no muestra nada"
                 sin error alguno (colapso clásico de Recharts). */
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartDataByMes}
                    margin={{ top: 10, right: 30, left: 0, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3f2fd" />
                    <XAxis
                      dataKey="fecha"
                      tick={{ fontSize: 10, fill: '#8ba4c0' }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => v + '%'}
                      tick={{ fontSize: 11, fill: '#8ba4c0' }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [value.toFixed(1) + '%', name]}
                      contentStyle={{ borderRadius: 8, border: '1px solid #D6DEE6', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 16, fontSize: 11 }} />
                    <ReferenceLine
                      y={98}
                      stroke="#2e7d32"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Excelente 98%',
                        position: 'right',
                        fontSize: 9,
                        fill: '#2e7d32',
                      }}
                    />
                    <ReferenceLine
                      y={90}
                      stroke="#ef6c00"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Aceptable 90%',
                        position: 'right',
                        fontSize: 9,
                        fill: '#ef6c00',
                      }}
                    />
                    <ReferenceLine
                      y={80}
                      stroke="#d32f2f"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Riesgo 80%',
                        position: 'right',
                        fontSize: 9,
                        fill: '#d32f2f',
                      }}
                    />
                    {(selectedSedeFilter === 'all' ? sedesDisponibles : [selectedSedeFilter]).map(
                      (sede) => (
                        <Bar
                          key={sede}
                          dataKey={sede}
                          fill={sedeColors[sede] || '#2F80ED'}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        />
                      )
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#ffffff] rounded-[12px] border border-brand-border shadow-sm p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-[#1976d2]" />
                <h3 className="font-bold text-text-main uppercase tracking-tight">
                  Confiabilidad Promedio por Sede
                </h3>
              </div>
              {sedeHistoricalData.length === 0 ? (
                <div className="min-h-[300px] flex items-center justify-center">
                  <p className="text-text-secondary text-sm font-medium">
                    No hay datos de movimientos disponibles
                  </p>
                </div>
              ) : (
                <div className="min-h-[400px]">
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(400, sedeHistoricalData.length * 50)}
                  >
                    <BarChart
                      data={sedeHistoricalData}
                      layout="vertical"
                      margin={{ top: 10, right: 60, left: 80, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e3f2fd" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(v) => v + '%'}
                        tick={{ fontSize: 11, fill: '#8ba4c0' }}
                      />
                      <YAxis
                        type="category"
                        dataKey="sede"
                        tick={{ fontSize: 11, fill: '#1F3A5F', fontWeight: 600 }}
                        width={75}
                      />
                      <Tooltip
                        formatter={(value: number) => [value.toFixed(1) + '%', 'Confiabilidad']}
                        contentStyle={{
                          borderRadius: 8,
                          border: '1px solid #D6DEE6',
                          fontSize: 12,
                        }}
                      />
                      <ReferenceLine x={98} stroke="#2e7d32" strokeDasharray="4 4" />
                      <ReferenceLine x={90} stroke="#ef6c00" strokeDasharray="4 4" />
                      <ReferenceLine x={80} stroke="#d32f2f" strokeDasharray="4 4" />
                      <Bar dataKey="confiabilidad" radius={[0, 4, 4, 0]} maxBarSize={32}>
                        {sedeHistoricalData.map((entry) => (
                          <Cell
                            key={entry.sede}
                            fill={
                              entry.confiabilidad >= 98
                                ? '#2e7d32'
                                : entry.confiabilidad >= 95
                                  ? '#2F80ED'
                                  : entry.confiabilidad >= 90
                                    ? '#ef6c00'
                                    : entry.confiabilidad >= 80
                                      ? '#E2A03F'
                                      : '#d32f2f'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-[#ffffff] rounded-[12px] border border-brand-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-brand-border bg-[#ffffff] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-text-main" />
                <h3 className="font-bold text-text-main uppercase tracking-tight">
                  Análisis Económico por Sede
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-brand-border bg-[#ffffff]">
                      <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest">
                        Sede
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">
                        Confiabilidad
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">
                        Total Pérdidas
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">
                        Total Sobrantes
                      </th>
                      <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-widest text-right">
                        Balance Final
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sedeHistoricalData.map((sede, idx) => (
                      <tr
                        key={sede.sede}
                        className={`border-b border-[#F0F4F8] ${idx % 2 === 0 ? 'bg-[#ffffff]' : 'bg-[#ffffff]'}`}
                      >
                        <td className="px-4 py-4 font-bold text-text-main text-sm">{sede.sede}</td>
                        <td className="px-4 py-4 text-right">
                          <span
                            className={`font-bold text-sm ${
                              sede.confiabilidad >= 98
                                ? 'text-emerald-600'
                                : sede.confiabilidad >= 95
                                  ? 'text-blue-600'
                                  : sede.confiabilidad >= 90
                                    ? 'text-orange-500'
                                    : sede.confiabilidad >= 80
                                      ? 'text-amber-700'
                                      : 'text-red-600'
                            }`}
                          >
                            {sede.confiabilidad.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-red-600 text-sm">
                          {formatCurrency(sede.perdidas)}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-emerald-600 text-sm">
                          {formatCurrency(sede.sobrantes)}
                        </td>
                        <td className="px-4 py-4 text-right text-sm">
                          <span
                            className={`font-bold ${sede.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                          >
                            {sede.balance >= 0 ? '+' : ''}
                            {formatCurrency(sede.balance)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
