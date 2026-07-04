/**
 * Sección "Recetas e Ingredientes" (pestaña Cobros).
 *
 * Agrupa cada receta (artículo SUB. de HioPOS) con sus ingredientes según la
 * composición registrada en el proyecto de recetas, y cruza contra el
 * inventario filtrado para responder la pregunta operativa clave:
 *
 *   ¿ese sobrante de proteína es real, o es una receta que no se registró?
 *
 * Alerta "SIN REGISTRO": ingredientes con sobrante fuera de tolerancia y la
 * receta sin fabricaciones registradas en el horizonte -> sobrante fantasma.
 *
 * Si RECETAS_API_URL está vacía muestra las instrucciones de configuración
 * sin afectar el resto de la app.
 */
import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ChefHat,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  FileSpreadsheet,
  Link2,
} from 'lucide-react';
import { ArticleSummary } from '../types';
import { RECETAS_API_URL } from '../config';
import {
  fetchRecetas,
  cruzarRecetasConInventario,
  RecetasPayload,
  GrupoReceta,
} from '../utils/recetas';

interface RecipesViewProps {
  articles: ArticleSummary[];
}

export const RecipesView: React.FC<RecipesViewProps> = ({ articles }) => {
  const [payload, setPayload] = useState<RecetasPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      setPayload(await fetchRecetas());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar las recetas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (RECETAS_API_URL) cargar();
  }, []);

  const cruce = useMemo(
    () => (payload ? cruzarRecetasConInventario(articles, payload) : null),
    [articles, payload]
  );

  const gruposVisibles = useMemo(() => {
    if (!cruce) return [];
    return soloAlertas ? cruce.grupos.filter((g) => g.alertaSinRegistro) : cruce.grupos;
  }, [cruce, soloAlertas]);

  const toggle = (key: string) => {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fmtVar = (v?: number) =>
    v === undefined
      ? '—'
      : (v > 0 ? '+' : '') + v.toLocaleString('es-CO', { maximumFractionDigits: 2 });

  const fmtFechaCorta = (iso: string) => {
    const [, m, d] = iso.split('-');
    const meses = [
      'ene',
      'feb',
      'mar',
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
      'oct',
      'nov',
      'dic',
    ];
    return `${d} ${meses[Number(m) - 1] || m}`;
  };

  /** Chips de variación por fecha: solo agrupa y muestra, no cruza cantidades. */
  const ChipsVariacion = ({
    items,
    unidad,
  }: {
    items?: { fecha: string; variacion: number }[];
    unidad?: string;
  }) => {
    if (!items || items.length === 0)
      return <span className="text-text-secondary/60 text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1.5 justify-end">
        {items.map((v) => (
          <span
            key={v.fecha}
            className={`inline-flex items-baseline gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${
              v.variacion < -0.0001
                ? 'bg-[#2d0f0f]/60 text-status-faltante border-rose-900/60'
                : v.variacion > 0.0001
                  ? 'bg-[#0a2d1a]/60 text-status-sobrante border-emerald-900/60'
                  : 'bg-[#0d1b2a] text-text-secondary border-brand-border'
            }`}
            title={`${v.fecha}: ${fmtVar(v.variacion)}${unidad ? ' ' + unidad : ''}`}
          >
            <span className="opacity-70 font-black uppercase">{fmtFechaCorta(v.fecha)}</span>
            {fmtVar(v.variacion)}
          </span>
        ))}
      </div>
    );
  };

  // ── Excel jerárquico: receta → ingredientes ──
  const exportarExcel = () => {
    if (!cruce) return;
    const filas: any[] = [];
    for (const g of gruposVisibles) {
      filas.push({
        Tipo: 'RECETA',
        Sede: g.sede,
        Código: g.receta.codigo,
        Nombre: g.receta.nombre,
        'Cant. Receta': '',
        Unidad: g.receta.unidad,
        'Variación Inventario (neto)': g.articuloReceta?.variacionUltimoCiclo ?? '',
        'Variaciones por fecha': (g.variacionesRecetaPorFecha || [])
          .map((v) => `${v.fecha}: ${v.variacion}`)
          .join(' | '),
        'Fabricaciones en rango': g.fechasFabricacion.join(' | ') || 0,
        'Última fabricación': g.ultimaFabricacion || '',
        Alerta: g.alertaSinRegistro ? 'SIN REGISTRO (sobrante fantasma)' : '',
      });
      for (const i of g.ingredientes) {
        filas.push({
          Tipo: '  Ingrediente',
          Sede: g.sede,
          Código: i.codigo,
          Nombre: i.nombre,
          'Cant. Receta': i.cantNeta,
          Unidad: i.unidadReceta,
          'Variación Inventario (neto)': i.inv?.variacionUltimoCiclo ?? 'sin cruce',
          'Variaciones por fecha': (i.variacionesPorFecha || [])
            .map((v) => `${v.fecha}: ${v.variacion}`)
            .join(' | '),
          'Fabricaciones en rango': '',
          'Última fabricación': '',
          Alerta:
            i.inv && (i.inv.variacionUltimoCiclo ?? 0) > 0.0001 && !i.inv.dentroDeTolerancia
              ? 'SOBRANTE fuera de tolerancia'
              : '',
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 10 },
      { wch: 40 },
      { wch: 12 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 16 },
      { wch: 34 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recetas e Ingredientes');
    XLSX.writeFile(wb, `Recetas_Ingredientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Estado: sin configurar ──
  if (!RECETAS_API_URL) {
    return (
      <div className="bg-white rounded-2xl border border-brand-border shadow-sm p-8 text-center">
        <div className="inline-flex bg-[#0a1a2d] p-3 rounded-xl text-[#38BDF8] mb-4">
          <ChefHat className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-text-main">Recetas e Ingredientes</h3>
        <p className="text-sm text-text-secondary mt-2 max-w-xl mx-auto">
          Esta sección cruza las recetas registradas con el inventario para detectar
          <b> sobrantes fantasma</b> (proteína que "sobra" porque la receta no se registró). Para
          activarla: despliega <code>apps-script/RecetasAPI.gs</code> como Aplicación web y pega su
          URL <code>/exec</code> en <code>src/config.ts → RECETAS_API_URL</code>.
        </p>
      </div>
    );
  }

  // ── Encabezado común ──
  return (
    <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
      <div className="p-6 border-b border-brand-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#132238]/50">
        <div className="flex items-center gap-3">
          <div className="bg-[#0a1a2d] p-2 rounded-lg text-[#38BDF8]">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-text-main uppercase tracking-tight">
              Recetas e Ingredientes
            </h3>
            <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">
              Cruce con el registro de recetas · detección de sobrantes fantasma
              {cruce?.rango ? ` · horizonte ${cruce.rango.desde} a ${cruce.rango.hasta}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={soloAlertas}
              onChange={(e) => setSoloAlertas(e.target.checked)}
              className="accent-amber-500"
            />
            Solo alertas SIN REGISTRO
          </label>
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-brand-border text-text-main hover:bg-[#132238] transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={exportarExcel}
            disabled={!cruce || gruposVisibles.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel Recetas
          </button>
        </div>
      </div>

      {/* Estados de carga / error */}
      {loading && (
        <div className="p-8 flex items-center justify-center gap-3 text-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin text-[#38BDF8]" />
          <span className="text-sm font-medium">Cargando recetas del proyecto de registro…</span>
        </div>
      )}
      {error && !loading && (
        <div className="m-6 flex items-center gap-2 px-4 py-3 bg-[#2d0f0f] border border-[#5A2020] rounded-xl text-[#EF4444] text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={cargar} className="ml-auto text-xs font-bold underline">
            Reintentar
          </button>
        </div>
      )}

      {cruce && !loading && !error && (
        <>
          {/* Reporte de emparejamiento: el cruce nunca falla en silencio */}
          <div className="px-6 py-3 border-b border-brand-border flex flex-wrap items-center gap-3 text-[11px] font-bold">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#0a1a2d] text-[#38BDF8] border border-blue-900/40">
              <Link2 className="w-3 h-3" />
              Recetas cruzadas: {cruce.reporte.recetasCruzadas}/{cruce.reporte.recetasTotal}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#0a1a2d] text-[#38BDF8] border border-blue-900/40">
              <Link2 className="w-3 h-3" />
              Ingredientes cruzados: {cruce.reporte.ingredientesCruzados}/
              {cruce.reporte.ingredientesTotal}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#2d230f] text-amber-400 border border-amber-700/40">
              <AlertTriangle className="w-3 h-3" />
              Alertas SIN REGISTRO: {cruce.grupos.filter((g) => g.alertaSinRegistro).length}
            </span>
            {cruce.reporte.recetasSinCruce.length > 0 && (
              <span
                className="text-text-secondary cursor-help"
                title={`Sin cruce en este corte: ${cruce.reporte.recetasSinCruce.slice(0, 30).join(', ')}${cruce.reporte.recetasSinCruce.length > 30 ? '…' : ''}`}
              >
                ({cruce.reporte.recetasSinCruce.length} recetas sin presencia en el inventario
                filtrado)
              </span>
            )}
          </div>

          {/* Grupos */}
          {gruposVisibles.length === 0 ? (
            <div className="p-10 text-center text-sm text-text-secondary italic">
              {soloAlertas
                ? 'Sin alertas de sobrante fantasma en el corte actual. 🎉'
                : 'Ninguna receta cruza con el inventario filtrado.'}
            </div>
          ) : (
            <div className="divide-y divide-brand-border">
              {gruposVisibles.map((g: GrupoReceta) => {
                const key = `${g.sede}|${g.receta.codigo}`;
                const abierto = abiertos.has(key);
                return (
                  <div key={key}>
                    {/* Fila de la receta */}
                    <button
                      onClick={() => toggle(key)}
                      className={`w-full flex flex-wrap items-center gap-3 px-6 py-4 text-left transition-colors hover:bg-[#132238]/60 ${
                        g.alertaSinRegistro ? 'bg-[#2d230f]/40' : ''
                      }`}
                    >
                      {abierto ? (
                        <ChevronDown className="w-4 h-4 text-text-secondary flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-[220px]">
                        <p className="font-bold text-text-main">
                          {g.receta.codigo} · {g.receta.nombre || g.articuloReceta?.articulo}
                        </p>
                        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                          {g.sede} · {g.ingredientes.length} ingredientes
                          {g.articuloReceta
                            ? ` · variación receta ${fmtVar(g.articuloReceta.variacionUltimoCiclo)}`
                            : ''}
                        </p>
                      </div>
                      {/* Fabricaciones en el horizonte */}
                      {g.fabricacionesEnRango > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0a2d1a] text-emerald-400 border border-emerald-900"
                          title={`Fabricaciones registradas: ${g.fechasFabricacion.join(', ')}`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Registrada: {g.fechasFabricacion.map(fmtFechaCorta).join(' · ')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0d1b2a] text-text-secondary border border-brand-border">
                          Sin fabricaciones en el rango
                        </span>
                      )}
                      {g.alertaSinRegistro && (
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#2d230f] text-amber-400 border border-amber-700 cursor-help"
                          title={`${g.ingredientesConSobrante} ingrediente(s) con sobrante fuera de tolerancia y la receta sin fabricaciones registradas en el horizonte: lo más probable es que la producción no se registró.`}
                        >
                          <AlertTriangle className="w-3 h-3" />⚠ SIN REGISTRO
                        </span>
                      )}
                    </button>

                    {/* Ingredientes */}
                    {abierto && (
                      <div className="px-6 pb-5">
                        <div className="ml-7 border-l-4 border-[#38BDF8]/30 pl-5 overflow-x-auto">
                          {g.variacionesRecetaPorFecha && (
                            <div className="flex flex-wrap items-center gap-2 py-2 mb-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                                Variación de la receta por fecha:
                              </span>
                              <ChipsVariacion
                                items={g.variacionesRecetaPorFecha}
                                unidad={g.articuloReceta?.subarticulo}
                              />
                            </div>
                          )}
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                                <th className="py-2 pr-4">Código</th>
                                <th className="py-2 pr-4">Ingrediente</th>
                                <th className="py-2 pr-4 text-right">Cant. receta</th>
                                <th
                                  className="py-2 pr-4 text-right"
                                  title="Variaciones de inventario del ingrediente, por fecha de conteo. Solo se agrupan para lectura: no se cruzan cantidades con la receta."
                                >
                                  Variación por fecha
                                </th>
                                <th className="py-2 text-center">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border/60">
                              {g.ingredientes.map((i) => {
                                const sobrante =
                                  i.inv &&
                                  (i.inv.variacionUltimoCiclo ?? 0) > 0.0001 &&
                                  !i.inv.dentroDeTolerancia;
                                return (
                                  <tr key={i.codigo}>
                                    <td className="py-2 pr-4 font-mono text-xs text-text-secondary">
                                      {i.codigo}
                                    </td>
                                    <td className="py-2 pr-4 font-medium text-text-main">
                                      {i.nombre}
                                    </td>
                                    <td className="py-2 pr-4 text-right text-text-secondary">
                                      {i.cantNeta.toLocaleString('es-CO')} {i.unidadReceta}
                                    </td>
                                    <td className="py-2 pr-4 text-right">
                                      {i.inv ? (
                                        <div className="flex flex-col items-end gap-1">
                                          <ChipsVariacion
                                            items={i.variacionesPorFecha}
                                            unidad={i.inv.subarticulo}
                                          />
                                          <span className="text-[9px] font-bold text-text-secondary">
                                            Neto: {fmtVar(i.inv.variacionUltimoCiclo)}{' '}
                                            {i.inv.subarticulo}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-text-secondary/60 text-xs italic">
                                          sin cruce en esta sede
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 text-center">
                                      {sobrante ? (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#2d230f] text-amber-400 border border-amber-700">
                                          Sobrante fuera de tolerancia
                                        </span>
                                      ) : i.inv ? (
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#0d1b2a] text-text-secondary border border-brand-border">
                                          {i.inv.dentroDeTolerancia ? 'OK' : 'Fuera de margen'}
                                        </span>
                                      ) : (
                                        <span className="text-text-secondary/50 text-[10px] italic">
                                          —
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
