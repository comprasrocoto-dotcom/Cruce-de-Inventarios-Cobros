/**
 * Componente raíz / shell de la aplicación.
 *
 * Responsabilidades:
 *  - Mantener el estado global: artículos cargados, filtros y pestaña activa.
 *  - Aplicar el pipeline de filtrado (sede, CC, familia, fechas, búsqueda...)
 *    y recalcular las métricas derivadas por rango de fechas.
 *  - Persistir los filtros en localStorage.
 *  - Orquestar las 7 pestañas: Resumen, Análisis, Cobros, Confiabilidad,
 *    Gerencial, Trazabilidad y Ejecutivo.
 */
import React, { useState, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { Filters } from './components/Filters';
import { InventoryTable } from './components/InventoryTable';
import { RecipesView } from './components/RecipesView';
import { HelpProvider, HelpTip } from './components/HelpTip';
import type { PoliticaCobro } from './utils/inventory';
import { fetchRecetas, RecetasPayload } from './utils/recetas';
import {
  CONFIG_MARGENES_DEFAULT,
  reglaTexto,
  type ConfigMargenes,
  type UnidadMargen,
} from './utils/confiabilidad';
import { ReliabilityView } from './components/ReliabilityView';
import { NivelConfiabilidad } from './components/NivelConfiabilidad';
import type { LineaInventario } from './lib/inventariosSupabase';
import { ManagementAnalysis } from './components/ManagementAnalysis';
import { ExportButtons } from './components/ExportButtons';
import { StatsCard } from './components/StatsCard';
import { ArticleSummary, GlobalFilters } from './types';
import { getDashboardStats, aplicarPoliticaCobro, POLITICAS_COBRO } from './utils/inventory';
import { evaluarItem, resumenHorizonte } from './utils/confiabilidad';
import { useEffect } from 'react';
import {
  Upload,
  LayoutDashboard,
  BarChart2,
  DollarSign,
  ShieldCheck,
  Package,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  BarChart3,
  Activity,
  TrendingUp,
  Settings,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HistoricalTraceability } from './components/HistoricalTraceability';
import { AdvancedAnalysis } from './components/AdvancedAnalysis';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { PDFReport } from './components/PDFReport';

type Tab =
  'RESUMEN' | 'ANÁLISIS' | 'COBROS' | 'CONFIABILIDAD' | 'GERENCIAL' | 'TRAZABILIDAD' | 'EJECUTIVO';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('RESUMEN');
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  // Líneas tal como están en Supabase (nivel de confiabilidad por inventario).
  const [lineas, setLineas] = useState<LineaInventario[]>([]);
  // Al cambiar, FileUpload recarga los datos desde Supabase (p. ej. tras borrar un inventario).
  const [recargarToken, setRecargarToken] = useState(0);
  // Política de cobro activa (Configuración de Cobro en el RESUMEN).
  // Se persiste en el navegador para sobrevivir recargas.
  const [politicaCobro, setPoliticaCobro] = useState<PoliticaCobro>(() => {
    try {
      const v = window.localStorage.getItem('politicaCobro');
      if (v === 'COMPLETO' || v === 'EXCEDENTE' || v === 'SIN_MARGEN') return v;
    } catch {
      /* almacenamiento no disponible */
    }
    return 'COMPLETO';
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('politicaCobro', politicaCobro);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [politicaCobro]);

  // Márgenes de tolerancia: config APLICADA (persistida) y BORRADOR editable.
  const [configMargenes, setConfigMargenes] = useState<ConfigMargenes>(() => {
    try {
      const raw = window.localStorage.getItem('configMargenes');
      if (raw) {
        const parsed = JSON.parse(raw);
        const unidades: UnidadMargen[] = ['UNIDADES', 'COPAS', 'ONZAS', 'GRAMOS'];
        if (
          unidades.every(
            (u) =>
              parsed?.[u] &&
              (parsed[u].modo === 'FIJO' || parsed[u].modo === 'PORCENTAJE') &&
              typeof parsed[u].valor === 'number' &&
              parsed[u].valor >= 0
          )
        ) {
          return parsed as ConfigMargenes;
        }
      }
    } catch {
      /* almacenamiento no disponible */
    }
    return CONFIG_MARGENES_DEFAULT;
  });
  const [borradorMargenes, setBorradorMargenes] = useState<ConfigMargenes>(configMargenes);

  // Catálogo de recetas para el reporte AGRUPADO del Detalle de Cobros.
  const [recetasPayload, setRecetasPayload] = useState<RecetasPayload | null>(null);
  useEffect(() => {
    fetchRecetas()
      .then(setRecetasPayload)
      .catch(() => setRecetasPayload(null));
  }, []);
  const [recalculando, setRecalculando] = useState(false);
  const hayCambiosMargenes = JSON.stringify(borradorMargenes) !== JSON.stringify(configMargenes);

  useEffect(() => {
    try {
      window.localStorage.setItem('configMargenes', JSON.stringify(configMargenes));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [configMargenes]);

  /** Aplica el borrador con recálculo VISIBLE: el usuario ve que está pasando. */
  const aplicarConfiguracion = () => {
    setRecalculando(true);
    // pequeño respiro para que el estado "Recalculando…" alcance a pintarse
    window.setTimeout(() => {
      setConfigMargenes(borradorMargenes);
      window.setTimeout(() => setRecalculando(false), 400);
    }, 60);
  };

  const editarMargen = (u: UnidadMargen, campo: 'modo' | 'valor', valor: string) => {
    setBorradorMargenes((prev) => ({
      ...prev,
      [u]:
        campo === 'modo'
          ? { ...prev[u], modo: valor as 'FIJO' | 'PORCENTAJE' }
          : { ...prev[u], valor: Math.max(0, Number(valor) || 0) },
    }));
  };

  // Artículos con la política aplicada: recalcula cobros, banderas y pistas
  // en caliente al cambiar el selector (copias nuevas -> React refresca todo).
  const articlesConPolitica = useMemo(
    () => aplicarPoliticaCobro(articles, politicaCobro, undefined, configMargenes),
    [articles, politicaCobro, configMargenes]
  );

  /** Resumen corto de la configuración activa (insignias, PDF y Excel). */
  const margenesLabel = useMemo(
    () =>
      (['UNIDADES', 'COPAS', 'ONZAS', 'GRAMOS'] as UnidadMargen[])
        .map((u) => `${u.slice(0, u === 'GRAMOS' ? 4 : 3)} ${reglaTexto(configMargenes[u], u)}`)
        .join(' · '),
    [configMargenes]
  );
  const [fileName, setFileName] = useState<string>('');
  // Muestra el panel de carga (dropdown) para subir un Excel aunque ya haya datos.
  const [mostrarCargador, setMostrarCargador] = useState(false);
  const [filters, setFilters] = useState<GlobalFilters>({
    sedes: [],
    ccs: [],
    subfamilias: [],
    responsables: [],
    familias: [],
    subArticulos: [],
    proveedores: [],
    status: 'all',
    search: '',
    fechaInicio: '',
    fechaFin: '',
  });

  // Persistencia de filtros
  useEffect(() => {
    const saved = localStorage.getItem('inventory_filters');
    if (saved) {
      try {
        setFilters(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading filters', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('inventory_filters', JSON.stringify(filters));
  }, [filters]);

  const filteredArticles = useMemo(() => {
    const startDate = filters.fechaInicio ? new Date(filters.fechaInicio + 'T00:00:00') : null;
    const endDate = filters.fechaFin ? new Date(filters.fechaFin + 'T23:59:59') : null;

    const base = articlesConPolitica
      .filter((art) => {
        const matchesSede = filters.sedes.length === 0 || filters.sedes.includes(art.sede);
        const matchesCC = filters.ccs.length === 0 || filters.ccs.includes(art.cc);
        const matchesSubfamilia =
          filters.subfamilias.length === 0 || filters.subfamilias.includes(art.subfamilia);
        const matchesResponsable =
          filters.responsables.length === 0 ||
          filters.responsables.includes(art.responsable || 'Sin asignar');

        const matchesSearch =
          !filters.search ||
          art.articulo.toLowerCase().includes(filters.search.toLowerCase()) ||
          art.codBarras.toLowerCase().includes(filters.search.toLowerCase());

        const matchesFamilia = !filters.familias?.length || filters.familias.includes(art.familia);
        const matchesSubArticulo =
          !filters.subArticulos?.length || filters.subArticulos.includes(art.subarticulo);
        const matchesProveedor =
          !filters.proveedores?.length || filters.proveedores.includes(art.proveedor);

        return (
          matchesSede &&
          matchesCC &&
          matchesSubfamilia &&
          matchesFamilia &&
          matchesSubArticulo &&
          matchesProveedor &&
          matchesResponsable &&
          matchesSearch
        );
      })
      .map((art) => {
        if (!startDate && !endDate) return art;

        const movements = art.movements.filter((m) => {
          const d = new Date(m.fecha);
          if (startDate && d < startDate) return false;
          if (endDate && d > endDate) return false;
          return true;
        });

        if (movements.length === 0) return null;

        const totalDiferencia = movements.reduce((acc, m) => acc + m.variacion, 0);
        const totalFaltantes = movements
          .filter((m) => m.variacion < 0)
          .reduce((acc, m) => acc + Math.abs(m.variacion), 0);
        const totalSobrantes = movements
          .filter((m) => m.variacion > 0)
          .reduce((acc, m) => acc + m.variacion, 0);
        const lastMov = movements[movements.length - 1];
        const ultimoCoste = lastMov.costeLinea;
        // Costo robusto: mediana global del artículo > último coste del periodo > promedio.
        const valorUnitario = art.costeMediano || ultimoCoste || art.costePromedio;

        let tipo: ArticleSummary['tipo'] = 'SIN_VARIACION';
        if (totalDiferencia < -0.0001) tipo = 'FALTANTE';
        else if (totalDiferencia > 0.0001) tipo = 'SOBRANTE';

        // El COBRO del rango filtrado es el NETO de las variaciones del rango:
        // el ERP ajusta el stock en cada carga, así que cada variación es la
        // pérdida de su periodo y las de conteos sucesivos se suman.
        const horizonte = resumenHorizonte(movements);
        const variacionCiclo = horizonte.variacion;

        // OJO: aquí NO se evalúa tolerancia ni se calcula cobro. Antes este
        // bloque re-evaluaba con márgenes PREDETERMINADOS y política COMPLETO
        // fijos, así que al filtrar por fechas se perdía la Configuración de
        // Cobro. Ahora solo se reconstruyen los números del rango y, al final
        // del memo, aplicarPoliticaCobro recalcula margen/tolerancia/cobro/
        // banderas con la config y política ACTIVAS (una sola fuente de verdad).
        return {
          ...art,
          movements,
          fecha: movements[movements.length - 1].fecha,
          totalDiferencia,
          totalFaltantes,
          totalSobrantes,
          ultimoCoste,
          tipo,
          variacionUltimoCiclo: variacionCiclo,
          baseTeorica: horizonte.base,
          fechaUltimoCiclo: lastMov.fecha,
          serieUltimoCiclo: lastMov.serie,
          valorPerdida: totalFaltantes * valorUnitario,
          valorSobrante: totalSobrantes * valorUnitario,
        } as ArticleSummary;
      })
      .filter((art): art is ArticleSummary => art !== null);

    // Con rango de fechas: re-aplicar reglas ACTIVAS sobre el corte reconstruido.
    const conReglas =
      startDate || endDate
        ? aplicarPoliticaCobro(base, politicaCobro, undefined, configMargenes).map((a) => ({
            ...a,
            cantidadACobrar: a.debeCobrar
              ? Math.abs(a.variacionUltimoCiclo ?? a.totalDiferencia)
              : 0,
          }))
        : base;

    return conReglas.filter((art) => {
      if (filters.status === 'cobrables') return art.debeCobrar;
      if (filters.status === 'faltantes') return art.tipo === 'FALTANTE';
      if (filters.status === 'sobrantes') return art.tipo === 'SOBRANTE';
      return true;
    });
  }, [articlesConPolitica, filters, politicaCobro, configMargenes]);

  const dashboardStats = useMemo(() => getDashboardStats(filteredArticles), [filteredArticles]);

  const uniqueSedes = useMemo(
    () => Array.from(new Set(articles.map((a) => a.sede))).sort(),
    [articles]
  );
  const uniqueFamilias = useMemo(
    () =>
      Array.from(new Set(articles.map((a) => a.familia)))
        .filter(Boolean)
        .sort(),
    [articles]
  );
  const uniqueProveedores = useMemo(
    () =>
      Array.from(new Set(articles.map((a) => a.proveedor)))
        .filter(Boolean)
        .sort(),
    [articles]
  );
  const uniqueSubArticulos = useMemo(
    () =>
      Array.from(new Set(articles.map((a) => a.subarticulo)))
        .filter(Boolean)
        .sort(),
    [articles]
  );
  const uniqueCCs = useMemo(
    () =>
      Array.from(new Set(articles.map((a) => a.cc)))
        .filter(Boolean)
        .sort(),
    [articles]
  );
  const uniqueSubfamilias = useMemo(
    () =>
      Array.from(new Set(articles.map((a) => a.subfamilia)))
        .filter(Boolean)
        .sort(),
    [articles]
  );
  const uniqueResponsables = useMemo(
    () => Array.from(new Set(articles.map((a) => a.responsable || 'Sin asignar'))).sort(),
    [articles]
  );

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);

  const renderContent = () => {
    if (articles.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="bg-[#132238] p-8 rounded-full">
            <Package className="w-16 h-16 text-secondary opacity-30" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-main mb-2">No hay datos cargados</h2>
            <p className="text-text-secondary max-w-md mx-auto">
              Sube el primer inventario de HioPOS (CSV o Excel) desde el panel de la esquina superior
              derecha: queda guardado en la base para todos los usuarios.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        <Filters
          sedes={uniqueSedes}
          ccs={uniqueCCs}
          familias={uniqueFamilias}
          subfamilias={uniqueSubfamilias}
          subArticulos={uniqueSubArticulos}
          responsables={uniqueResponsables}
          proveedores={uniqueProveedores}
          filters={filters}
          setFilters={setFilters}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'RESUMEN' && (
              <div className="space-y-8">
                <div className="flex items-center gap-2 -mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">
                    Indicadores del corte
                  </span>
                  <HelpTip clave="kpis" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                  <StatsCard
                    title="Artículos Revisados"
                    value={dashboardStats.totalArticulos}
                    icon={Package}
                    color="bg-[#38BDF8]"
                    description="Artículos evaluados en el cruce"
                  />
                  <StatsCard
                    title="Artículos Faltantes"
                    value={dashboardStats.totalFaltantes}
                    icon={AlertTriangle}
                    color="bg-[#F59E0B]"
                    description="Artículos con diferencia negativa"
                  />
                  <StatsCard
                    title="Artículos Cobrables"
                    value={dashboardStats.totalCobrables}
                    icon={TrendingDown}
                    color="bg-[#EF4444]"
                    description="Faltantes que superan el margen"
                  />
                  <StatsCard
                    title="Valor Total a Cobrar"
                    value={formatCurrency(dashboardStats.valorTotalCobro)}
                    icon={DollarSign}
                    color="bg-[#22C55E]"
                    description="Impacto económico total"
                  />
                  <StatsCard
                    title="Artículos Sobrantes"
                    value={dashboardStats.totalSobrantes}
                    icon={TrendingUp}
                    color="bg-emerald-600"
                    description={`≈ $${Math.round(dashboardStats.valorSobrante).toLocaleString('es-CO')} a costo · no cobran, pero son síntoma de proceso`}
                  />
                </div>

                <div className="bg-card p-8 rounded-[12px] shadow-sm border border-brand-border">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-brand-text">
                        Resumen por Sede <HelpTip clave="resumenSede" />
                      </h3>
                      <p className="text-sm text-brand-text-secondary">
                        Distribución de cobros y faltantes por almacén
                      </p>
                    </div>
                    <ExportButtons
                      data={filteredArticles}
                      politicaLabel={`${POLITICAS_COBRO[politicaCobro].etiqueta}  |  Márgenes: ${margenesLabel}`}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dashboardStats.sedes.map((sede) => (
                      <div
                        key={sede.sede}
                        className="p-5 rounded-[8px] border border-brand-border bg-[#132238]"
                      >
                        <h4 className="font-bold text-brand-text mb-3 uppercase tracking-tight">
                          {sede.sede}
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-text-secondary font-medium">
                              Artículos:
                            </span>
                            <span className="font-bold text-brand-text">{sede.totalArticulos}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-text-secondary font-medium">
                              Faltantes:
                            </span>
                            <span className="font-bold text-status-faltante">
                              {sede.totalFaltantes}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-text-secondary font-medium">
                              Cobrables:
                            </span>
                            <span className="font-bold text-status-cobra">
                              {sede.totalCobrables}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-text-secondary font-medium">
                              Sobrantes:
                            </span>
                            <span
                              className="font-bold text-status-sobrante"
                              title={`≈ $${Math.round(sede.valorSobranteSede).toLocaleString('es-CO')} a costo. No cobran, pero señalan proceso roto (recetas sin registrar, compras sin cargar, errores de unidad).`}
                            >
                              {sede.totalSobrantes}
                              <span className="opacity-60 font-medium">
                                {' '}
                                (≈ $
                                {Math.round(sede.valorSobranteSede / 1000).toLocaleString('es-CO')}
                                k)
                              </span>
                            </span>
                          </div>
                          <div className="pt-2 border-t border-brand-border flex justify-between items-center">
                            <span className="text-[10px] font-bold text-brand-text-secondary uppercase">
                              Total Cobro
                            </span>
                            <span className="text-sm font-bold text-status-sobrante">
                              {formatCurrency(sede.totalCobroSede)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── CONFIGURACIÓN DE COBRO: reglas visibles + política seleccionable ── */}
                <div className="bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-brand-border flex items-center gap-3 bg-[#132238]/50">
                    <div className="bg-[#0a1a2d] p-2 rounded-lg text-[#FBC519]">
                      <Settings className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-main uppercase tracking-tight">
                        Configuración de Cobro <HelpTip clave="configuracion" />
                      </h3>
                      <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">
                        Reglas de tolerancia por unidad · política aplicada a toda la app y a los
                        reportes
                      </p>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Márgenes de tolerancia EDITABLES: borrador + Aplicar */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-3">
                        Margen de tolerancia por unidad de medida
                      </p>
                      <div className="space-y-2">
                        {(
                          [
                            ['UNIDADES', 'Lo contable se cuenta con los dedos.'],
                            ['COPAS', 'Vasos y copas: conteo exacto.'],
                            ['ONZAS', 'El error normal del jigger al servir.'],
                            ['GRAMOS', 'Mermas de pesaje y porcionado. En %, piso de 100 g.'],
                          ] as [UnidadMargen, string][]
                        ).map(([u, porQue]) => (
                          <div
                            key={u}
                            className={`p-3 rounded-lg border bg-[#132238] ${
                              JSON.stringify(borradorMargenes[u]) !==
                              JSON.stringify(configMargenes[u])
                                ? 'border-[#FBC519]/60'
                                : 'border-brand-border'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="min-w-[110px]">
                                <span className="font-bold text-text-main text-sm">{u}</span>
                                <p className="text-[10px] text-text-secondary">{porQue}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={borradorMargenes[u].modo}
                                  onChange={(e) => editarMargen(u, 'modo', e.target.value)}
                                  className="bg-[#0a1a2d] border border-brand-border rounded-lg px-2 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-[#FBC519]"
                                >
                                  <option value="FIJO">± fijo</option>
                                  <option value="PORCENTAJE">% del teórico</option>
                                </select>
                                <input
                                  type="number"
                                  min={0}
                                  step={borradorMargenes[u].modo === 'PORCENTAJE' ? 0.1 : 1}
                                  value={borradorMargenes[u].valor}
                                  onChange={(e) => editarMargen(u, 'valor', e.target.value)}
                                  className="w-20 bg-[#0a1a2d] border border-brand-border rounded-lg px-2 py-1.5 text-sm font-bold text-right text-text-main focus:outline-none focus:ring-1 focus:ring-[#FBC519]"
                                />
                                <span className="text-[10px] font-bold text-text-secondary w-16">
                                  {borradorMargenes[u].modo === 'PORCENTAJE'
                                    ? '%'
                                    : u.toLowerCase().slice(0, -1) + '(s)'}
                                </span>
                              </div>
                            </div>
                            <p className="text-[10px] text-[#38BDF8] mt-1 font-bold">
                              Activo: {reglaTexto(configMargenes[u], u)}
                              {JSON.stringify(borradorMargenes[u]) !==
                                JSON.stringify(configMargenes[u]) && (
                                <span className="text-[#FBC519]">
                                  {' '}
                                  → nuevo: {reglaTexto(borradorMargenes[u], u)} (sin aplicar)
                                </span>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={aplicarConfiguracion}
                          disabled={!hayCambiosMargenes || recalculando}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                            hayCambiosMargenes && !recalculando
                              ? 'bg-[#FBC519] text-[#081423] hover:brightness-110'
                              : 'bg-[#132238] text-text-secondary border border-brand-border cursor-not-allowed'
                          }`}
                        >
                          {recalculando ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Recalculando toda la app…
                            </>
                          ) : (
                            <>Aplicar configuración</>
                          )}
                        </button>
                        <button
                          onClick={() => setBorradorMargenes(CONFIG_MARGENES_DEFAULT)}
                          disabled={recalculando}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-text-secondary border border-brand-border hover:text-text-main hover:bg-[#132238] transition-colors"
                          title="Vuelve el borrador a los valores predeterminados (UNID ±0, COPAS ±0, ONZAS ±3, GRAMOS 2.5%). Recuerda Aplicar."
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Predeterminados
                        </button>
                      </div>
                      <p className="text-[10px] text-text-secondary mt-2 italic">
                        Los cambios NO actúan hasta pulsar Aplicar. Editar los márgenes cambia el
                        estándar técnico: también recalcula tolerancias, confiabilidad y alertas de
                        recetas — y queda impreso en PDF y Excel.
                      </p>
                    </div>

                    {/* Política de cobro (seleccionable, recalcula en vivo) */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-3">
                        Política de cobro activa
                      </p>
                      <div className="space-y-2">
                        {(Object.keys(POLITICAS_COBRO) as PoliticaCobro[]).map((pol) => (
                          <button
                            key={pol}
                            onClick={() => setPoliticaCobro(pol)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              politicaCobro === pol
                                ? 'bg-[#0a1a2d] border-[#FBC519] ring-1 ring-[#FBC519]/40'
                                : 'bg-[#132238] border-brand-border hover:border-[#38BDF8]/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-bold text-sm ${politicaCobro === pol ? 'text-[#FBC519]' : 'text-text-main'}`}
                              >
                                {POLITICAS_COBRO[pol].etiqueta}
                              </span>
                              {politicaCobro === pol && (
                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#FBC519] text-[#081423]">
                                  Activa
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-text-secondary mt-1">
                              {POLITICAS_COBRO[pol].descripcion}
                            </p>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-text-secondary mt-3 italic">
                        Al cambiarla, cobros, banderas y totales se recalculan al instante en toda
                        la aplicación. La confiabilidad NO cambia: la exactitud del inventario es
                        independiente de cuánto se decida descontar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'COBROS' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-brand-text">
                      Detalle de Cobros <HelpTip clave="cobros" />
                    </h3>
                    <span
                      className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-[#0a1a2d] text-[#FBC519] border border-[#FBC519]/40"
                      title={POLITICAS_COBRO[politicaCobro].descripcion}
                    >
                      Política: {POLITICAS_COBRO[politicaCobro].etiqueta}
                      <span className="opacity-70 normal-case font-bold"> · {margenesLabel}</span>
                    </span>
                    <p className="text-sm text-brand-text-secondary">
                      Listado jerárquico de artículos y variaciones
                    </p>
                  </div>
                  <ExportButtons
                    data={filteredArticles}
                    politicaLabel={`${POLITICAS_COBRO[politicaCobro].etiqueta}  |  Márgenes: ${margenesLabel}`}
                    variante="agrupado"
                    recetasPayload={recetasPayload}
                  />
                </div>
                <InventoryTable data={filteredArticles} />
                {/* Cruce con el registro de recetas: sobrantes fantasma. */}
                <RecipesView articles={filteredArticles} />
              </div>
            )}

            {activeTab === 'ANÁLISIS' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-brand-text">
                      Análisis de Variaciones <HelpTip clave="analisis" />
                    </h3>
                    <p className="text-sm text-brand-text-secondary">
                      Exploración detallada de movimientos
                    </p>
                  </div>
                </div>
                <InventoryTable data={filteredArticles} />
                <AdvancedAnalysis data={filteredArticles} />
              </div>
            )}

            {activeTab === 'CONFIABILIDAD' && (
              <>
                <NivelConfiabilidad lineas={lineas} onCambio={() => setRecargarToken((t) => t + 1)} />
                <ReliabilityView data={filteredArticles} filters={filters} setFilters={setFilters} />
              </>
            )}

            {activeTab === 'GERENCIAL' && (
              <ManagementAnalysis
                data={filteredArticles}
                selectedSede={filters.sedes.length === 1 ? filters.sedes[0] : undefined}
              />
            )}

            {activeTab === 'EJECUTIVO' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-brand-text">
                      Dashboard Ejecutivo <HelpTip clave="ejecutivo" />
                    </h3>
                    <p className="text-sm text-brand-text-secondary">
                      KPIs, tendencias y top productos
                    </p>
                  </div>
                  <ExportButtons
                    data={filteredArticles}
                    politicaLabel={`${POLITICAS_COBRO[politicaCobro].etiqueta}  |  Márgenes: ${margenesLabel}`}
                  />
                  <PDFReport
                    data={filteredArticles}
                    filters={filters}
                    politicaLabel={`${POLITICAS_COBRO[politicaCobro].etiqueta}  |  Márgenes: ${margenesLabel}`}
                  />
                </div>
                <ExecutiveDashboard data={filteredArticles} />
              </div>
            )}

            {activeTab === 'TRAZABILIDAD' && (
              <HistoricalTraceability
                configMargenes={configMargenes}
                data={filteredArticles}
                sedes={uniqueSedes}
                ccs={uniqueCCs}
                subfamilias={uniqueSubfamilias}
                fileName={fileName}
                onReset={() => {
                  setArticles([]);
                  setFileName('');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  };

  return (
    <HelpProvider articles={filteredArticles}>
      <div className="min-h-screen flex flex-col bg-background">
        {/* Top Bar */}
        <header className="relative bg-[#081423] text-white px-6 py-4 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="bg-[#FBC519] p-2 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none uppercase">
                Cruces de Inventario
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#C9D4E3] font-bold">
                Auditoría y Cobros por Sede
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {articles.length > 0 && (
              <button
                onClick={() => setMostrarCargador((v) => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                  mostrarCargador
                    ? 'bg-[#FBC519] text-[#081423]'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
                title="Subir un inventario de HioPOS a la base"
              >
                <Upload className="w-4 h-4" />
                Subir inventario
              </button>
            )}
            {articles.length > 0 && <HelpTip clave="cargar" />}
            <FileUpload
              onDataLoaded={(data) => {
                setArticles(data);
                setMostrarCargador(false);
              }}
              onReset={() => {
                setArticles([]);
                setLineas([]);
                setFileName('');
                setMostrarCargador(false);
              }}
              onFileNameChange={(name) => setFileName(name)}
              onLineasCargadas={setLineas}
              recargarToken={recargarToken}
              hasData={articles.length > 0}
              forzarVisible={mostrarCargador}
            />
            {articles.length > 0 && (
              <>
                <div className="h-8 w-px bg-white/10"></div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-[#38BDF8] uppercase">Estado</p>
                  <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>{' '}
                    Sistema Activo
                  </p>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Navigation Tabs */}
        {articles.length > 0 && (
          <nav className="bg-[#0F1C2E] border-b border-brand-border px-6 flex items-center gap-8 shadow-sm overflow-x-auto">
            {(
              [
                'RESUMEN',
                'ANÁLISIS',
                'COBROS',
                'CONFIABILIDAD',
                'GERENCIAL',
                'TRAZABILIDAD',
                'EJECUTIVO',
              ] as Tab[]
            ).map((tab) => {
              const Icon = {
                RESUMEN: LayoutDashboard,
                ANÁLISIS: BarChart2,
                COBROS: DollarSign,
                CONFIABILIDAD: ShieldCheck,
                GERENCIAL: BarChart3,
                TRAZABILIDAD: Activity,
                EJECUTIVO: LayoutDashboard,
              }[tab];

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm transition-all ${
                    activeTab === tab
                      ? 'border-[#FBC519] text-secondary'
                      : 'border-transparent text-text-secondary hover:text-text-main'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab}
                </button>
              );
            })}
          </nav>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{renderContent()}</main>

        {/* Footer */}
        <footer className="bg-[#0F1C2E] border-t border-brand-border p-4 text-center text-[10px] text-[#8EA3BF] font-bold uppercase tracking-widest">
          © {new Date().getFullYear()} PROMPT MAESTRO – SISTEMA DE AUDITORÍA DE INVENTARIOS
        </footer>
      </div>
    </HelpProvider>
  );
}
