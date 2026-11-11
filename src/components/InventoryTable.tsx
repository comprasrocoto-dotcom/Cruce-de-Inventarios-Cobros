/**
 * Tabla detallada de inventario. Lista de forma jerárquica los artículos y sus
 * variaciones (faltantes/sobrantes), resaltando los que deben cobrarse. Es la
 * vista principal de las pestañas Cobros y Análisis.
 */
import React, { useState } from 'react';
import { ArticleSummary } from '../types';
import { ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryTableProps {
  data: ArticleSummary[];
}

export const InventoryTable: React.FC<InventoryTableProps> = ({ data }) => {
  const [expandedSedes, setExpandedSedes] = useState<Record<string, boolean>>({});
  const [expandedArticles, setExpandedArticles] = useState<Record<string, boolean>>({});
  /** Filtro LOCAL de este listado (no toca los Filtros Avanzados globales):
   *  permite aterrizar rápido en una sede o artículo solo aquí. */
  const [filtroLocal, setFiltroLocal] = useState('');

  const dataLocal = React.useMemo(() => {
    const q = filtroLocal.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (a) =>
        a.articulo.toLowerCase().includes(q) ||
        a.sede.toLowerCase().includes(q) ||
        (a.codBarras || '').toLowerCase().includes(q)
    );
  }, [data, filtroLocal]);

  const toggleSede = (sede: string) => {
    setExpandedSedes((prev) => ({ ...prev, [sede]: !prev[sede] }));
  };

  const toggleArticle = (key: string) => {
    setExpandedArticles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Group by Sede
  const groupedBySede = dataLocal.reduce(
    (acc, art) => {
      if (!acc[art.sede]) acc[art.sede] = [];
      acc[art.sede].push(art);
      return acc;
    },
    {} as Record<string, ArticleSummary[]>
  );

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);

  if (data.length === 0) {
    return (
      <div className="bg-[#f7f8fa] rounded-md p-12 text-center border border-brand-border shadow-sm">
        <Info className="w-12 h-12 text-text-secondary mx-auto mb-4" />
        <h3 className="text-lg font-bold text-text-secondary">No hay artículos para mostrar</h3>
        <p className="text-text-secondary text-sm">Ajusta los filtros para ver más resultados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra del listado: contadores + filtro LOCAL (solo esta tabla) */}
      <div className="flex flex-wrap items-center gap-3 border border-linea bg-marca-suave text-tinta-2 px-4 py-2 rounded text-[10px] font-mono uppercase tracking-widest">
        <span>Sedes: {Object.keys(groupedBySede).length}</span>
        <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
        <span>
          Artículos: {dataLocal.length}
          {filtroLocal ? ` de ${data.length}` : ''}
        </span>
        <div className="relative flex-1 min-w-[220px] max-w-md ml-auto">
          <input
            value={filtroLocal}
            onChange={(e) => setFiltroLocal(e.target.value)}
            placeholder="Filtrar este listado: sede o artículo…"
            className="w-full bg-[#f7f8fa] border border-brand-border rounded-lg pl-3 pr-8 py-1.5 text-xs font-sans normal-case tracking-normal text-text-main placeholder:text-text-secondary/60 focus:outline-none focus:ring-1 focus:ring-[#1976d2]"
            title="Filtra SOLO este listado (los Filtros Avanzados de arriba aplican a toda la app)"
          />
          {filtroLocal && (
            <button
              onClick={() => setFiltroLocal('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-main"
              title="Limpiar"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto card rounded-[12px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#e3f2fd] text-text-main text-[10px] uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4 font-bold rounded-tl-[12px]">Sede / Artículo</th>
              <th className="px-6 py-4 font-bold">Unidad</th>
              <th className="px-6 py-4 font-bold text-right">Diferencia Neta</th>
              <th className="px-6 py-4 font-bold text-center">Estado</th>
              <th className="px-6 py-4 font-bold text-right">Coste Línea</th>
              <th className="px-6 py-4 font-bold text-right rounded-tr-[12px]">Total Cobro</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {(Object.entries(groupedBySede) as [string, ArticleSummary[]][]).map(
              ([sede, articles]) => (
                <React.Fragment key={sede}>
                  {/* Sede Header Row */}
                  <tr
                    className="bg-[#f7f8fa] cursor-pointer hover:bg-[#e3f2fd] transition-colors border-b border-brand-border"
                    onClick={() => toggleSede(sede)}
                  >
                    <td colSpan={6} className="px-6 py-3">
                      <div className="flex items-center font-bold text-text-main uppercase tracking-tight">
                        {expandedSedes[sede] ? (
                          <ChevronDown className="w-5 h-5 mr-2 text-secondary" />
                        ) : (
                          <ChevronRight className="w-5 h-5 mr-2 text-text-secondary" />
                        )}
                        <span>SEDE: {sede}</span>
                        <span className="ml-3 px-2 py-0.5 bg-[#f7f8fa] text-secondary rounded text-[10px] font-bold border border-brand-border">
                          {articles.length} ARTÍCULOS
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Articles within Sede */}
                  {expandedSedes[sede] &&
                    articles.map((art, artIdx) => {
                      const artKey = `${sede}-${art.articulo}`;
                      const isExpanded = expandedArticles[artKey];

                      return (
                        <React.Fragment key={artKey}>
                          <tr
                            className={clsx(
                              'border-b border-brand-border transition-colors cursor-pointer',
                              artIdx % 2 === 0 ? 'bg-[#f7f8fa]' : 'bg-[#f7f8fa]',
                              'hover:bg-[#e3f2fd]',
                              isExpanded && 'bg-[#152338]'
                            )}
                            onClick={() => toggleArticle(artKey)}
                          >
                            <td className="px-6 py-4 pl-12">
                              <div className="flex items-center">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 mr-2 text-secondary" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 mr-2 text-text-secondary" />
                                )}
                                <span className="font-bold text-text-main">{art.articulo}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-text-secondary font-medium">
                              {art.subarticulo}
                            </td>
                            <td
                              className={clsx(
                                'px-6 py-4 text-right font-black',
                                art.totalDiferencia < 0
                                  ? 'text-status-faltante'
                                  : 'text-status-sobrante'
                              )}
                            >
                              {art.totalDiferencia.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="inline-flex flex-col items-center gap-1">
                                {art.debeCobrar ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#fdecea] text-status-cobra border border-rose-900">
                                    <AlertCircle className="w-3 h-3 mr-1" /> Cobra
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#f7f8fa] text-status-sin-cobra border border-brand-border">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> No cobra
                                  </span>
                                )}
                                {/* Bandera de calidad: cobro que debe validarse contra el ERP
                                    antes de descontar (coste atípico, monto implausible). */}
                                {art.requiereRevision && (
                                  <span
                                    title={art.motivoRevision}
                                    className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#fff3e0] text-amber-700 border border-amber-700 cursor-help"
                                  >
                                    ⚠ Revisar
                                  </span>
                                )}
                                {/* Evidencia de auditoría: sobrante fuerte en la misma
                                    sede+subfamilia -> el faltante puede ser el mismo
                                    producto contado bajo otro código. */}
                                {art.posibleConfusion && (
                                  <span
                                    title={art.posibleConfusion}
                                    className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0f2233] text-sky-300 border border-sky-800 cursor-help"
                                  >
                                    ¿Confusión de códigos?
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-text-secondary font-medium">
                              {formatCurrency(art.ultimoCoste || art.costePromedio)}
                            </td>
                            <td className="px-6 py-4 text-right font-black text-text-main">
                              {art.totalCobro > 0 ? formatCurrency(art.totalCobro) : '-'}
                            </td>
                          </tr>

                          {/* Movement Details (Level 3) */}
                          <AnimatePresence>
                            {isExpanded && (
                              <tr className="bg-[#f7f8fa]/80">
                                <td colSpan={6} className="px-12 py-4">
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="ml-8 border-l-4 border-secondary/30 pl-6 py-2">
                                      <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3">
                                        Detalle de movimientos por fecha
                                      </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {art.movements.map((m, idx) => (
                                          <div
                                            key={idx}
                                            className="bg-[#f7f8fa] p-3 rounded-xl border border-border shadow-sm flex justify-between items-center"
                                          >
                                            <div>
                                              <p className="text-[10px] font-bold text-text-secondary uppercase">
                                                {format(m.fecha, 'MMMM yyyy', { locale: es })}
                                              </p>
                                              <p className="text-xs font-bold text-text-main">
                                                {format(m.fecha, 'dd MMM yyyy', { locale: es })}
                                              </p>
                                            </div>
                                            <div className="text-right">
                                              <p
                                                className={clsx(
                                                  'text-sm font-black',
                                                  m.variacion < 0
                                                    ? 'text-status-faltante'
                                                    : 'text-status-sobrante'
                                                )}
                                              >
                                                {m.variacion > 0 ? '+' : ''}
                                                {m.variacion.toLocaleString()}
                                              </p>
                                              <p className="text-[10px] font-medium text-text-secondary">
                                                {formatCurrency(m.costeLinea)}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </motion.div>
                                </td>
                              </tr>
                            )}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
