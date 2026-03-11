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

  const toggleSede = (sede: string) => {
    setExpandedSedes(prev => ({ ...prev, [sede]: !prev[sede] }));
  };

  const toggleArticle = (key: string) => {
    setExpandedArticles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Group by Sede
  const groupedBySede = data.reduce((acc, art) => {
    if (!acc[art.sede]) acc[art.sede] = [];
    acc[art.sede].push(art);
    return acc;
  }, {} as Record<string, ArticleSummary[]>);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
        <Info className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-400">No hay artículos para mostrar</h3>
        <p className="text-slate-400 text-sm">Ajusta los filtros para ver más resultados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Depuración Temporal */}
      <div className="flex items-center space-x-4 bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest">
        <span>Sedes: {Object.keys(groupedBySede).length}</span>
        <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
        <span>Artículos filtrados: {data.length}</span>
      </div>

      <div className="overflow-x-auto card rounded-[12px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#A7C4E0] text-[#1F3A5F] text-[10px] uppercase tracking-widest">
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
            {(Object.entries(groupedBySede) as [string, ArticleSummary[]][]).map(([sede, articles]) => (
              <React.Fragment key={sede}>
                {/* Sede Header Row */}
                <tr 
                  className="bg-[#F0F4F8] cursor-pointer hover:bg-[#E5EDF5] transition-colors border-b border-[#D6DEE6]"
                  onClick={() => toggleSede(sede)}
                >
                  <td colSpan={6} className="px-6 py-3">
                    <div className="flex items-center font-bold text-[#1F3A5F] uppercase tracking-tight">
                      {expandedSedes[sede] ? (
                        <ChevronDown className="w-5 h-5 mr-2 text-[#2F80ED]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 mr-2 text-slate-400" />
                      )}
                      <span>SEDE: {sede}</span>
                      <span className="ml-3 px-2 py-0.5 bg-white text-[#2F80ED] rounded text-[10px] font-bold border border-[#D6DEE6]">
                        {articles.length} ARTÍCULOS
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Articles within Sede */}
                {expandedSedes[sede] && articles.map((art, artIdx) => {
                  const artKey = `${sede}-${art.articulo}`;
                  const isExpanded = expandedArticles[artKey];
                  
                  return (
                    <React.Fragment key={artKey}>
                      <tr 
                        className={clsx(
                          "border-b border-slate-100 transition-colors cursor-pointer",
                          artIdx % 2 === 0 ? "bg-white" : "bg-[#F0F4F8]",
                          "hover:bg-[#E5EDF5]",
                          isExpanded && "bg-[#EAF2FB]"
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
                        <td className="px-6 py-4 text-text-secondary font-medium">{art.subarticulo}</td>
                        <td className={clsx(
                          "px-6 py-4 text-right font-black",
                          art.totalDiferencia < 0 ? "text-status-faltante" : "text-status-sobrante"
                        )}>
                          {art.totalDiferencia.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {art.debeCobrar ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-status-cobra border border-rose-100">
                              <AlertCircle className="w-3 h-3 mr-1" /> Cobra
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-50 text-status-sin-cobra border border-brand-border">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> No cobra
                            </span>
                          )}
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
                          <tr className="bg-slate-50/80">
                            <td colSpan={6} className="px-12 py-4">
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                 <div className="ml-8 border-l-4 border-secondary/30 pl-6 py-2">
                                  <h4 className="text-[10px] font-black text-secondary uppercase tracking-widest mb-3">Detalle de movimientos por fecha</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {art.movements.map((m, idx) => (
                                      <div key={idx} className="bg-white p-3 rounded-xl border border-border shadow-sm flex justify-between items-center">
                                        <div>
                                          <p className="text-[10px] font-bold text-text-secondary uppercase">{format(m.fecha, 'MMMM yyyy', { locale: es })}</p>
                                          <p className="text-xs font-bold text-text-main">{format(m.fecha, 'dd MMM yyyy', { locale: es })}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className={clsx(
                                            "text-sm font-black",
                                            m.variacion < 0 ? "text-status-faltante" : "text-status-sobrante"
                                          )}>
                                            {m.variacion > 0 ? '+' : ''}{m.variacion.toLocaleString()}
                                          </p>
                                          <p className="text-[10px] font-medium text-text-secondary">{formatCurrency(m.costeLinea)}</p>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
