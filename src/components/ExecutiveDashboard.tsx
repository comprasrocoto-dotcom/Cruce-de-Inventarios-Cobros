import React, { useMemo } from 'react';
import { ArticleSummary } from '../types';
import {
  TrendingDown,
  TrendingUp,
  Package,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  BarChart3,
} from 'lucide-react';

interface Props {
  data: ArticleSummary[];
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

const fmtNumber = (val: number) =>
  new Intl.NumberFormat('es-CO').format(val);

export const ExecutiveDashboard: React.FC<Props> = ({ data }) => {
  const summary = useMemo(() => {
    const totalProductos = data.length;
    const conNovedades = data.filter(a => a.totalDiferencia !== 0).length;
    const faltantes = data.filter(a => (a.totalFaltantes ?? 0) > 0);
    const sobrantes = data.filter(a => (a.totalSobrantes ?? 0) > 0);
    const totalPerdidas = faltantes.reduce((s, a) => s + (a.valorPerdida ?? 0), 0);
    const totalSobrantesVal = sobrantes.reduce((s, a) => s + (a.valorSobrante ?? 0), 0);
    const balanceFinal = totalSobrantesVal - totalPerdidas;

    const top10Diff = [...data]
      .sort((a, b) => Math.abs(b.totalDiferencia) - Math.abs(a.totalDiferencia))
      .slice(0, 10);

    const top10Recurrentes = [...data]
      .sort((a, b) => b.movements.length - a.movements.length)
      .slice(0, 10);

    const sevAlta = data.filter(a => a.severidad === 'ALTA').length;
    const sevMedia = data.filter(a => a.severidad === 'MEDIA').length;
    const sevBaja = data.filter(a => a.severidad === 'BAJA').length;

    return { totalProductos, conNovedades, totalPerdidas, totalSobrantesVal, balanceFinal, top10Diff, top10Recurrentes, sevAlta, sevMedia, sevBaja };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-brand-text-secondary">
        <BarChart3 className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">Sin datos para el dashboard ejecutivo</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-brand-text" />
            <span className="text-xs text-brand-text-secondary uppercase tracking-tight">Total Productos</span>
          </div>
          <p className="text-2xl font-bold text-brand-text">{fmtNumber(summary.totalProductos)}</p>
        </div>

        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-brand-text-secondary uppercase tracking-tight">Con Novedades</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{fmtNumber(summary.conNovedades)}</p>
        </div>

        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-500" />
            <span className="text-xs text-brand-text-secondary uppercase tracking-tight">Total P\u00e9rdidas</span>
          </div>
          <p className="text-lg font-bold text-red-600">{fmtCurrency(summary.totalPerdidas)}</p>
        </div>

        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-xs text-brand-text-secondary uppercase tracking-tight">Total Sobrantes</span>
          </div>
          <p className="text-lg font-bold text-green-600">{fmtCurrency(summary.totalSobrantesVal)}</p>
        </div>

        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-brand-text" />
            <span className="text-xs text-brand-text-secondary uppercase tracking-tight">Balance Final</span>
          </div>
          <p className={`text-lg font-bold ${summary.balanceFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmtCurrency(summary.balanceFinal)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-brand-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs text-brand-text-secondary uppercase tracking-tight">Sin Novedad</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmtNumber(summary.totalProductos - summary.conNovedades)}</p>
        </div>
      </div>

      {/* Severity Indicators */}
      <div className="bg-white rounded-xl border border-brand-border p-4">
        <h3 className="font-bold text-brand-text mb-3">Clasificaci\u00f3n por Severidad</h3>
        <div className="flex gap-4">
          <div className="flex-1 bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{summary.sevAlta}</p>
            <p className="text-xs text-red-500 uppercase">ALTA</p>
          </div>
          <div className="flex-1 bg-yellow-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{summary.sevMedia}</p>
            <p className="text-xs text-yellow-500 uppercase">MEDIA</p>
          </div>
          <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.sevBaja}</p>
            <p className="text-xs text-green-500 uppercase">BAJA / SIN</p>
          </div>
        </div>
      </div>

      {/* Top 10 Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 10 by difference */}
        <div className="bg-white rounded-xl border border-brand-border overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border bg-brand-background">
            <h3 className="font-bold text-brand-text text-sm uppercase tracking-wide">Top 10 - Mayores Diferencias</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-brand-text-secondary">#</th>
                  <th className="px-3 py-2 text-left text-xs text-brand-text-secondary">Producto</th>
                  <th className="px-3 py-2 text-right text-xs text-brand-text-secondary">Diferencia</th>
                  <th className="px-3 py-2 text-right text-xs text-brand-text-secondary">Valor</th>
                </tr>
              </thead>
              <tbody>
                {summary.top10Diff.map((a, idx) => (
                  <tr key={idx} className={`border-t border-gray-100 ${a.severidad === 'ALTA' ? 'bg-red-50' : a.severidad === 'MEDIA' ? 'bg-yellow-50' : ''}`}>
                    <td className="px-3 py-2 text-brand-text-secondary">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-brand-text max-w-[180px] truncate">{a.articulo}</td>
                    <td className={`px-3 py-2 text-right font-bold ${a.totalDiferencia < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {a.totalDiferencia > 0 ? '+' : ''}{fmtNumber(a.totalDiferencia)}
                    </td>
                    <td className="px-3 py-2 text-right text-brand-text-secondary">{fmtCurrency(a.valorPerdida ?? a.valorSobrante ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 by recurrence */}
        <div className="bg-white rounded-xl border border-brand-border overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border bg-brand-background">
            <h3 className="font-bold text-brand-text text-sm uppercase tracking-wide">Top 10 - M\u00e1s Recurrentes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-brand-text-secondary">#</th>
                  <th className="px-3 py-2 text-left text-xs text-brand-text-secondary">Producto</th>
                  <th className="px-3 py-2 text-right text-xs text-brand-text-secondary">Movs.</th>
                  <th className="px-3 py-2 text-right text-xs text-brand-text-secondary">Diferencia Neta</th>
                </tr>
              </thead>
              <tbody>
                {summary.top10Recurrentes.map((a, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-brand-text-secondary">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium text-brand-text max-w-[180px] truncate">{a.articulo}</td>
                    <td className="px-3 py-2 text-right text-brand-text">{a.movements.length}</td>
                    <td className={`px-3 py-2 text-right font-bold ${a.totalDiferencia < 0 ? 'text-red-600' : a.totalDiferencia > 0 ? 'text-green-600' : 'text-brand-text-secondary'}`}>
                      {a.totalDiferencia > 0 ? '+' : ''}{fmtNumber(a.totalDiferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
