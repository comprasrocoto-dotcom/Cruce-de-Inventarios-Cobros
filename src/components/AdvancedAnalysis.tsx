
import React, { useState, useMemo } from 'react';
import { ArticleSummary } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronRight, DollarSign, Package, Search, CheckCircle, XCircle, AlertCircle, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdvancedAnalysisProps {
  data: ArticleSummary[];
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
const fmtNum = (val: number) => new Intl.NumberFormat('es-CO').format(val);

// Clasificación de confiabilidad
const getConfiabilidadClasificacion = (pct: number): { label: string; color: string; bg: string; border: string } => {
  if (pct >= 98) return { label: 'Excelente', color: 'text-green-400', bg: 'bg-[#0a2d1a]', border: 'border-green-900' };
  if (pct >= 95) return { label: 'Buena', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300' };
  if (pct >= 90) return { label: 'Aceptable', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300' };
  if (pct >= 80) return { label: 'Riesgo', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300' };
  return { label: 'Critica', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300' };
};

export const AdvancedAnalysis: React.FC<AdvancedAnalysisProps> = ({ data }) => {
  const [activeSection, setActiveSection] = useState<'variaciones' | 'consolidado' | 'cobros' | 'clasificacion' | 'ejecutivo'>('variaciones');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm) return data;
    const t = searchTerm.toLowerCase();
    return data.filter(a =>
      a.articulo.toLowerCase().includes(t) ||
      a.familia.toLowerCase().includes(t) ||
      a.subfamilia.toLowerCase().includes(t) ||
      a.sede.toLowerCase().includes(t)
    );
  }, [data, searchTerm]);

  const perdidas = useMemo(() => filtered.filter(a => a.totalFaltantes > 0).sort((a, b) => b.valorPerdida - a.valorPerdida), [filtered]);
  const sobrantes = useMemo(() => filtered.filter(a => a.totalSobrantes > 0).sort((a, b) => b.valorSobrante - a.valorSobrante), [filtered]);
  const conNovedades = useMemo(() => filtered.filter(a => a.tipo !== 'SIN_VARIACION').sort((a, b) => Math.abs(b.totalDiferencia) - Math.abs(a.totalDiferencia)), [filtered]);

  // COBROS: SOLO productos con diferencia NEGATIVA (faltantes)
  const cobrosItems = useMemo(() =>
    filtered
      .filter(a => a.totalDiferencia < 0)
      .sort((a, b) => b.valorPerdida - a.valorPerdida),
    [filtered]
  );

  const totals = useMemo(() => ({
    valorPerdidas: filtered.reduce((acc, a) => acc + (a.valorPerdida || 0), 0),
    valorSobrantes: filtered.reduce((acc, a) => acc + (a.valorSobrante || 0), 0),
    cantidadCobrar: cobrosItems.reduce((acc, a) => acc + Math.abs(a.totalDiferencia), 0),
    valorTotalCobros: cobrosItems.reduce((acc, a) => acc + (a.valorPerdida || 0), 0),
  }), [filtered, cobrosItems]);

  // Totales de cobros por sede (solo faltantes)
  const cobrosPorSede = useMemo(() => {
    const map = new Map<string, { items: ArticleSummary[]; total: number }>();
    cobrosItems.forEach(a => {
      if (!map.has(a.sede)) map.set(a.sede, { items: [], total: 0 });
      const entry = map.get(a.sede)!;
      entry.items.push(a);
      entry.total += a.valorPerdida || 0;
    });
    return Array.from(map.entries())
      .map(([sede, v]) => ({ sede, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [cobrosItems]);

  // Resumen ejecutivo por sede
  const resumenPorSede = useMemo(() => {
    const sedes = Array.from(new Set(data.map(a => a.sede)));
    return sedes.map(sede => {
      const sedeItems = data.filter(a => a.sede === sede);
      const total = sedeItems.length;
      const conDif = sedeItems.filter(a => a.tipo !== 'SIN_VARIACION').length;
      const sinDif = total - conDif;
      const confiabilidad = total > 0 ? (sinDif / total) * 100 : 100;
      const margenError = 100 - confiabilidad;
      const clasif = getConfiabilidadClasificacion(confiabilidad);
      return { sede, total, conDif, sinDif, confiabilidad, margenError, clasif };
    }).sort((a, b) => a.confiabilidad - b.confiabilidad);
  }, [data]);

  const getSeverityStyle = (s: string) => {
    if (s === 'CRITICO') return 'bg-red-100 text-red-800 border-red-300';
    if (s === 'MEDIO') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-[#0a2d1a] text-green-800 border-green-900';
  };

  const tabs = [
    { id: 'variaciones' as const, label: 'Variaciones', icon: TrendingDown },
    { id: 'consolidado' as const, label: 'Consolidado', icon: Package },
    { id: 'cobros' as const, label: 'Cobros', icon: DollarSign },
    { id: 'ejecutivo' as const, label: 'Resumen Ejecutivo', icon: Building2 },
    { id: 'clasificacion' as const, label: 'Clasificacion', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-500 font-bold uppercase mb-1">Total Perdidas</p>
          <p className="text-2xl font-bold text-red-700">{fmtCurrency(totals.valorPerdidas)}</p>
          <p className="text-xs text-red-400">{perdidas.length} productos con faltantes</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-500 font-bold uppercase mb-1">Total Sobrantes</p>
          <p className="text-2xl font-bold text-blue-700">{fmtCurrency(totals.valorSobrantes)}</p>
          <p className="text-xs text-blue-400">{sobrantes.length} productos con sobrantes</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs text-orange-500 font-bold uppercase mb-1">Total a Cobrar</p>
          <p className="text-2xl font-bold text-orange-700">{fmtCurrency(totals.valorTotalCobros)}</p>
          <p className="text-xs text-orange-400">{cobrosItems.length} productos con faltantes netos</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar por producto, familia, sede..."
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeSection === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* VARIACIONES */}
      {activeSection === 'variaciones' && (
        <div className="space-y-2">
          {conNovedades.map((art, i) => {
            const key = art.articulo + art.sede + art.familia;
            const expandido = expandedProduct === key;
            return (
              <div key={i} className={`border p-4 ${getSeverityStyle(art.severidad)}`}>
                <button
                  onClick={() => setExpandedProduct(expandido ? null : key)}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {art.tipo === 'FALTANTE' ? (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    ) : art.tipo === 'SOBRANTE' ? (
                      <TrendingUp className="w-5 h-5 text-blue-500" />
                    ) : (
                      <Minus className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="text-left">
                      <p className="font-semibold text-gray-800 text-sm">{art.articulo}</p>
                      <p className="text-xs text-gray-500">{art.sede} | {art.familia} - {art.subfamilia}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${getSeverityStyle(art.severidad)}`}>
                      {art.severidad}
                    </span>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${art.totalDiferencia < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {art.totalDiferencia > 0 ? '+' : ''}{fmtNum(art.totalDiferencia)} {art.subarticulo}
                      </p>
                      <p className="text-xs text-gray-500">{fmtCurrency(art.valorPerdida + art.valorSobrante)}</p>
                    </div>
                    {expandido ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                <AnimatePresence>
                  {expandido && (
                    <motion.div
                      initial={{ altura: 0, opacidad: 0 }}
                      animar={{ altura: 'automatico', opacidad: 1 }}
                      salida={{ altura: 0, opacidad: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 border-t border-gray-200 pt-3">
                        <p className="text-xs font-bold text-gray-600 mb-2 mayusculas">Historico de movimientos</p>
                        <table className="w-full text-xs">
                          <encabezado>
                            <tr className="text-left text-gray-500">
                              <th className="pb-1">Fecha</th>
                              <th className="pb-1 text-right">Stock Fecha</th>
                              <th className="pb-1 text-right">Stock Inventario</th>
                              <th className="pb-1 text-right">Diferencia</th>
                              <th className="pb-1 text-right">Coste Linea</th>
                            </tr>
                          </encabezado>
                          <tbody>
                            {art.movements.map((m, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                <td className="py-1">{format(m.fecha, 'dd/MM/yyyy', { locale: es })}</td>
                                <td className="py-1 text-right">{fmtNum(m.stockFecha)}</td>
                                <td className="py-1 text-right">{fmtNum(m.stockInventario)}</td>
                                <td className={`py-1 text-right font-bold ${m.variacion < 0 ? 'text-red-600' : m.variacion > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                                  {m.variacion > 0 ? '+' : ''}{fmtNum(m.variacion)}
                                </td>
                                <td className="py-1 text-right">{fmtCurrency(m.costeLinea)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* CONSOLIDADO */}
      {activeSection === 'consolidado' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#132238] border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Producto</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Sede</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-600">Familia</th>
                <th className="text-right py-3 px-4 font-semibold text-red-600">Total Faltantes</th>
                <th className="text-right py-3 px-4 font-semibold text-blue-600">Total Sobrantes</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Variacion Neta</th>
                <th className="text-right py-3 px-4 font-semibold text-orange-600">A Cobrar</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-600">Severidad</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((art, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-[#132238]">
                  <td className="py-3 px-4 font-semibold text-gray-800 text-xs">{art.articulo}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{art.sede}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{art.familia}</td>
                  <td className="py-3 px-4 text-right font-bold text-red-600">{fmtNum(art.totalFaltantes)}</td>
                  <td className="py-3 px-4 text-right font-bold text-blue-600">{fmtNum(art.totalSobrantes)}</td>
                  <td className={`py-3 px-4 text-right font-bold ${art.totalDiferencia < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {art.totalDiferencia > 0 ? '+' : ''}{fmtNum(art.totalDiferencia)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-orange-600">{fmtNum(art.cantidadACobrar)}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${getSeverityStyle(art.severidad)}`}>
                      {art.severidad}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* COBROS - SOLO FALTANTES (variacion negativa) */}
      {activeSection === 'cobros' && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-orange-800 mb-1">Regla de Cobro</p>
            <p className="text-xs text-orange-600">
              Solo se incluyen productos con Variacion NEGATIVA (faltantes reales). Los sobrantes NO se incluyen en el cobro.
            </p>
          </div>

          {/* Total general de cobros */}
          <div className="bg-orange-100 border-2 border-orange-400 rounded-xl p-4">
            <p className="text-sm font-bold text-orange-800 uppercase mb-2">Total General de Cobros</p>
            <p className="text-3xl font-bold text-orange-700">{fmtCurrency(totals.valorTotalCobros)}</p>
            <p className="text-xs text-orange-600 mt-1">{cobrosItems.length} productos con faltantes | {fmtNum(totals.cantidadCobrar)} unidades totales</p>
          </div>

          {/* Tabla de cobros */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#132238] border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Producto</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Sede</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-600">Fecha</th>
                  <th className="text-right py-3 px-4 font-semibold text-red-600">Cantidad Faltante</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-600">Valor Unitario</th>
                  <th className="text-right py-3 px-4 font-semibold text-orange-600">Valor a Cobrar</th>
                </tr>
              </thead>
              <tbody>
                {cobrosItems.map((art, i) => {
                  const cantFaltante = Math.abs(art.totalDiferencia);
                  const valorUnit = cantFaltante > 0 ? (art.valorPerdida / cantFaltante) : (art.ultimoCoste || art.costePromedio || 0);
                  const ultimaFecha = art.movements && art.movements.length > 0
                    ? art.movements[art.movements.length - 1].fecha
                    : null;
                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-orange-50">
                      <td className="py-3 px-4 font-semibold text-gray-800 text-xs">{art.articulo}</td>
                      <td className="py-3 px-4 text-gray-600 text-xs">{art.sede}</td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {ultimaFecha ? format(ultimaFecha, 'dd/MM/yyyy', { locale: es }) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-red-600">{fmtNum(cantFaltante)} {art.subarticulo}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{fmtCurrency(valorUnit)}</td>
                      <td className="py-3 px-4 text-right font-bold text-orange-600">{fmtCurrency(art.valorPerdida)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total por sede */}
          <div className="mt-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase mb-3">Total de Cobros por Sede</h3>
            <div className="space-y-2">
              {cobrosPorSede.map(({ sede, items, total }) => (
                <div key={sede} className="bg-white border border-orange-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{sede}</p>
                    <p className="text-xs text-gray-500">{items.length} producto(s) con faltantes</p>
                  </div>
                  <p className="text-lg font-bold text-orange-600">{fmtCurrency(total)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESUMEN EJECUTIVO POR SEDE */}
      {activeSection === 'ejecutivo' && (
        <div className="space-y-6">
          <h3 className="text-base font-bold text-gray-800">Resumen Ejecutivo por Sede</h3>

          {/* Tarjetas agrupadas por categoria */}
          {(['Critica', 'Riesgo', 'Aceptable', 'Buena', 'Excelente'] as const).map(categoria => {
            const sedesFiltradas = resumenPorSede.filter(s => s.clasif.label === categoria);
            if (sedesFiltradas.length === 0) return null;

            const catConfig: Record<string, { title: string; range: string; bg: string; border: string; headerBg: string }> = {
              'Critica': { title: 'SEDES CRITICAS', range: '< 80%', bg: 'bg-red-50', border: 'border-red-300', headerBg: 'bg-red-600' },
              'Riesgo': { title: 'SEDES EN RIESGO', range: '80% a 89.99%', bg: 'bg-orange-50', border: 'border-orange-300', headerBg: 'bg-orange-500' },
              'Aceptable': { title: 'SEDES ACEPTABLES', range: '90% a 94.99%', bg: 'bg-yellow-50', border: 'border-yellow-300', headerBg: 'bg-yellow-500' },
              'Buena': { title: 'SEDES CON BUENA CONFIABILIDAD', range: '95% a 97.99%', bg: 'bg-blue-50', border: 'border-blue-300', headerBg: 'bg-blue-500' },
              'Excelente': { title: 'SEDES EXCELENTES', range: '98% o superior', bg: 'bg-[#0a2d1a]', border: 'border-green-900', headerBg: 'bg-green-600' },
            };

            const cfg = catConfig[categoria];
            return (
              <div key={categoria} className={`border-2 ${cfg.border} rounded-xl overflow-hidden`}>
                <div className={`${cfg.headerBg} text-white px-4 py-2 flex justify-between items-center`}>
                  <span className="font-bold text-sm uppercase">{cfg.title}</span>
                  <span className="text-xs opacity-80">{cfg.range}</span>
                </div>
                <div className={`${cfg.bg} p-4 space-y-3`}>
                  {sedesFiltradas.map(s => (
                    <div key={s.sede} className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-gray-800">{s.sede}</p>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.clasif.bg} ${s.clasif.color} ${s.clasif.border} border`}>
                          {s.clasif.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-gray-500">Productos Contados</p>
                          <p className="font-bold text-gray-800 text-sm">{fmtNum(s.total)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Con Diferencia</p>
                          <p className="font-bold text-red-600 text-sm">{fmtNum(s.conDif)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Margen de Error</p>
                          <p className="font-bold text-orange-600 text-sm">{s.margenError.toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Confiabilidad</p>
                          <p className={`font-bold text-sm ${s.clasif.color}`}>{s.confiabilidad.toFixed(2)}%</p>
                        </div>
                      </div>
                      {/* Barra de confiabilidad */}
                      <div className="mt-2 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${s.confiabilidad >= 98 ? 'bg-[#0a2d1a]0' : s.confiabilidad >= 95 ? 'bg-blue-500' : s.confiabilidad >= 90 ? 'bg-yellow-500' : s.confiabilidad >= 80 ? 'bg-orange-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(s.confiabilidad, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLASIFICACION */}
      {activeSection === 'clasificacion' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Perdidas */}
          <div>
            <h4 className="font-bold text-red-700 text-sm mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              PERDIDAS ({perdidas.length} productos)
            </h4>
            <div className="space-y-2">
              {perdidas.slice(0, 20).map((art, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div>
                    <p className="text-xs font-bold text-red-800">{art.articulo}</p>
                    <p className="text-xs text-red-400">{art.sede} | -{fmtNum(art.totalFaltantes)} {art.subarticulo}</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">{fmtCurrency(art.valorPerdida)}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Sobrantes */}
          <div>
            <h4 className="font-bold text-blue-700 text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              SOBRANTES ({sobrantes.length} productos)
            </h4>
            <div className="space-y-2">
              {sobrantes.slice(0, 20).map((art, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <div>
                    <p className="text-xs font-bold text-blue-800">{art.articulo}</p>
                    <p className="text-xs text-blue-400">{art.sede} | +{fmtNum(art.totalSobrantes)} {art.subarticulo}</p>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{fmtCurrency(art.valorSobrante)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
