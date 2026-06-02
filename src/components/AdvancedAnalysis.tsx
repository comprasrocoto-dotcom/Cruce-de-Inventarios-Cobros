import React, { useState, useMemo } from 'react';
import { ArticleSummary } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, TrendingDown, TrendingUp, Minus, ChevronDown, ChevronRight, DollarSign, Package, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdvancedAnalysisProps {
  data: ArticleSummary[];
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);
const fmtNum = (val: number) => new Intl.NumberFormat('es-CO').format(val);

export const AdvancedAnalysis: React.FC<AdvancedAnalysisProps> = ({ data }) => {
  const [activeSection, setActiveSection] = useState<'variaciones' | 'consolidado' | 'cobros' | 'clasificacion'>('variaciones');
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

  const totals = useMemo(() => ({
    valorPerdidas: filtered.reduce((acc, a) => acc + (a.valorPerdida || 0), 0),
    valorSobrantes: filtered.reduce((acc, a) => acc + (a.valorSobrante || 0), 0),
    cantidadCobrar: filtered.reduce((acc, a) => acc + (a.cantidadACobrar || 0), 0),
  }), [filtered]);

  const getSeverityStyle = (s: string) => {
    if (s === 'CRITICO') return 'bg-red-100 text-red-800 border-red-300';
    if (s === 'MEDIO') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-green-100 text-green-800 border-green-300';
  };

  const getRowStyle = (a: ArticleSummary) => {
    if (a.severidad === 'CRITICO') return 'border-l-4 border-red-500 bg-red-50';
    if (a.severidad === 'MEDIO') return 'border-l-4 border-yellow-400 bg-yellow-50';
    return 'border-l-4 border-green-400 bg-green-50';
  };

  const tabs = [
    { id: 'variaciones', label: 'Variaciones', icon: TrendingDown },
    { id: 'consolidado', label: 'Consolidado', icon: Package },
    { id: 'cobros', label: 'Cobros', icon: DollarSign },
    { id: 'clasificacion', label: 'Clasificacion', icon: AlertTriangle },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
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
          <p className="text-2xl font-bold text-orange-700">{fmtNum(totals.cantidadCobrar)} unidades</p>
          <p className="text-xs text-orange-400">Faltantes netos despues de compensar sobrantes</p>
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

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* VARIACIONES */}
          {activeSection === 'variaciones' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 font-medium">{conNovedades.length} productos con variaciones</p>
              {conNovedades.map(art => {
                const key = `${art.sede}|${art.articulo}`;
                const expanded = expandedProduct === key;
                return (
                  <div key={key} className={`rounded-xl border p-4 ${getRowStyle(art)}`}>
                    <button
                      onClick={() => setExpandedProduct(expanded ? null : key)}
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
                          <p className="text-sm font-bold ${art.totalDiferencia < 0 ? 'text-red-600' : 'text-blue-600'}">
                            {art.totalDiferencia > 0 ? '+' : ''}{fmtNum(art.totalDiferencia)} {art.subarticulo}
                          </p>
                          <p className="text-xs text-gray-500">{fmtCurrency(art.valorPerdida + art.valorSobrante)}</p>
                        </div>
                        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 border-t border-gray-200 pt-3">
                            <p className="text-xs font-bold text-gray-600 mb-2 uppercase">Historico de movimientos</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-gray-500">
                                  <th className="pb-1">Fecha</th>
                                  <th className="pb-1 text-right">Stock Teorico</th>
                                  <th className="pb-1 text-right">Stock Inventario</th>
                                  <th className="pb-1 text-right">Diferencia</th>
                                  <th className="pb-1 text-right">Coste Linea</th>
                                </tr>
                              </thead>
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
                  <tr className="bg-gray-50 border-b border-gray-200">
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
                  {conNovedades.map((art, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-gray-800">{art.articulo}</p>
                        <p className="text-xs text-gray-400">{art.subarticulo}</p>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{art.sede}</td>
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

          {/* COBROS */}
          {activeSection === 'cobros' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-bold text-orange-800 mb-1">Regla de Cobro</p>
                <p className="text-xs text-orange-600">
                  Cantidad a Cobrar = Faltantes Totales - Sobrantes Totales. Si el resultado es positivo se cobra; si es negativo, representa un sobrante neto.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">Producto</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-600">Unidad</th>
                      <th className="text-right py-3 px-4 font-semibold text-red-600">Faltantes</th>
                      <th className="text-right py-3 px-4 font-semibold text-blue-600">Sobrantes</th>
                      <th className="text-right py-3 px-4 font-semibold text-orange-600">A Cobrar</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Valor Perdida</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Valor Sobrante</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.filter(a => a.cantidadACobrar > 0 || a.totalFaltantes > 0 || a.totalSobrantes > 0)
                      .sort((a, b) => b.cantidadACobrar - a.cantidadACobrar)
                      .map((art, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold text-gray-800">{art.articulo}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{art.subarticulo}</td>
                        <td className="py-3 px-4 text-right font-bold text-red-600">{fmtNum(art.totalFaltantes)}</td>
                        <td className="py-3 px-4 text-right font-bold text-blue-600">{fmtNum(art.totalSobrantes)}</td>
                        <td className="py-3 px-4 text-right font-bold text-orange-600">{fmtNum(art.cantidadACobrar)}</td>
                        <td className="py-3 px-4 text-right text-red-500">{fmtCurrency(art.valorPerdida)}</td>
                        <td className="py-3 px-4 text-right text-blue-500">{fmtCurrency(art.valorSobrante)}</td>
                        <td className="py-3 px-4 text-center">
                          {art.cantidadACobrar > 0 ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">COBRAR</span>
                          ) : art.totalSobrantes > art.totalFaltantes ? (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">SOBRANTE NETO</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">COMPENSADO</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
