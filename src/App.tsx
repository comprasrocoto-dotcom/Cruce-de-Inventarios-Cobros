import React, { useState, useMemo } from 'react';
import { FileUpload } from './components/FileUpload';
import { Filters } from './components/Filters';
import { InventoryTable } from './components/InventoryTable';
import { ReliabilityView } from './components/ReliabilityView';
import { ManagementAnalysis } from './components/ManagementAnalysis';
import { ExportButtons } from './components/ExportButtons';
import { StatsCard } from './components/StatsCard';
import { ArticleSummary, GlobalFilters } from './types';
import { getDashboardStats } from './utils/inventory';
import { useEffect } from 'react';
import { 
  LayoutDashboard, 
  BarChart2, 
  DollarSign, 
  ShieldCheck, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown,
  BarChart3,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HistoricalTraceability } from './components/HistoricalTraceability';

type Tab = 'RESUMEN' | 'ANÁLISIS' | 'COBROS' | 'CONFIABILIDAD' | 'GERENCIAL' | 'TRAZABILIDAD';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('RESUMEN');
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [filters, setFilters] = useState<GlobalFilters>({
    sedes: [],
    ccs: [],
    subfamilias: [],
    responsables: [],
    status: 'all',
    search: '',
    fechaInicio: '',
    fechaFin: ''
  });

  // Persistencia de filtros
  useEffect(() => {
    const saved = localStorage.getItem('inventory_filters');
    if (saved) {
      try {
        setFilters(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading filters", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('inventory_filters', JSON.stringify(filters));
  }, [filters]);

  const filteredArticles = useMemo(() => {
    return articles.filter(art => {
      // Filtros multi-selección
      const matchesSede = filters.sedes.length === 0 || filters.sedes.includes(art.sede);
      const matchesCC = filters.ccs.length === 0 || filters.ccs.includes(art.cc);
      const matchesSubfamilia = filters.subfamilias.length === 0 || filters.subfamilias.includes(art.subfamilia);
      const matchesResponsable = filters.responsables.length === 0 || filters.responsables.includes(art.responsable || 'Sin asignar');
      
      // Búsqueda
      const matchesSearch = !filters.search || 
        art.articulo.toLowerCase().includes(filters.search.toLowerCase()) ||
        art.codBarras.toLowerCase().includes(filters.search.toLowerCase());
      
      // Estado
      let matchesStatus = true;
      if (filters.status === 'cobrables') matchesStatus = art.debeCobrar;
      else if (filters.status === 'faltantes') matchesStatus = art.tipo === 'FALTANTE';
      else if (filters.status === 'sobrantes') matchesStatus = art.tipo === 'SOBRANTE';

      // Fechas
      let matchesFecha = true;
      if (filters.fechaInicio || filters.fechaFin) {
        const itemDate = new Date(art.fecha);
        if (filters.fechaInicio && itemDate < new Date(filters.fechaInicio)) matchesFecha = false;
        if (filters.fechaFin && itemDate > new Date(filters.fechaFin)) matchesFecha = false;
      }

      return matchesSede && matchesCC && matchesSubfamilia && matchesResponsable && matchesSearch && matchesStatus && matchesFecha;
    });
  }, [articles, filters]);

  const dashboardStats = useMemo(() => getDashboardStats(filteredArticles), [filteredArticles]);

  const uniqueSedes = useMemo(() => Array.from(new Set(articles.map(a => a.sede))).sort(), [articles]);
  const uniqueCCs = useMemo(() => Array.from(new Set(articles.map(a => a.cc))).filter(Boolean).sort(), [articles]);
  const uniqueSubfamilias = useMemo(() => Array.from(new Set(articles.map(a => a.subfamilia))).filter(Boolean).sort(), [articles]);
  const uniqueResponsables = useMemo(() => Array.from(new Set(articles.map(a => a.responsable || 'Sin asignar'))).sort(), [articles]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const renderContent = () => {
    if (articles.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="bg-blue-50 p-8 rounded-full">
            <Package className="w-16 h-16 text-[#2F80ED] opacity-30" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1F3A5F] mb-2">No hay datos cargados</h2>
            <p className="text-slate-500 max-w-md mx-auto">
              Utiliza el botón <span className="font-bold text-[#2F80ED]">Cargar Excel</span> en la esquina superior derecha para comenzar el análisis de inventarios.
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
          subfamilias={uniqueSubfamilias}
          responsables={uniqueResponsables}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard 
                    title="Artículos Revisados" 
                    value={dashboardStats.totalArticulos} 
                    icon={Package} 
                    color="bg-kpi-revisados" 
                    description="Artículos evaluados en el cruce"
                  />
                  <StatsCard 
                    title="Artículos Faltantes" 
                    value={dashboardStats.totalFaltantes} 
                    icon={AlertTriangle} 
                    color="bg-kpi-faltantes" 
                    description="Artículos con diferencia negativa"
                  />
                  <StatsCard 
                    title="Artículos Cobrables" 
                    value={dashboardStats.totalCobrables} 
                    icon={TrendingDown} 
                    color="bg-kpi-cobrables" 
                    description="Faltantes que superan el margen"
                  />
                  <StatsCard 
                    title="Valor Total a Cobrar" 
                    value={formatCurrency(dashboardStats.valorTotalCobro)} 
                    icon={DollarSign} 
                    color="bg-kpi-valor" 
                    description="Impacto económico total"
                  />
                </div>
                
                <div className="bg-white p-8 rounded-[12px] shadow-sm border border-brand-border">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-brand-text">Resumen por Sede</h3>
                      <p className="text-sm text-brand-text-secondary">Distribución de cobros y faltantes por almacén</p>
                    </div>
                    <ExportButtons data={filteredArticles} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dashboardStats.sedes.map(sede => (
                      <div key={sede.sede} className="p-5 rounded-[8px] border border-brand-border bg-[#F5F7FA]">
                        <h4 className="font-bold text-brand-text mb-3 uppercase tracking-tight">{sede.sede}</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-text-secondary font-medium">Artículos:</span>
                            <span className="font-bold text-brand-text">{sede.totalArticulos}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-text-secondary font-medium">Faltantes:</span>
                            <span className="font-bold text-status-faltante">{sede.totalFaltantes}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-text-secondary font-medium">Cobrables:</span>
                            <span className="font-bold text-status-cobra">{sede.totalCobrables}</span>
                          </div>
                          <div className="pt-2 border-t border-brand-border flex justify-between items-center">
                            <span className="text-[10px] font-bold text-brand-text-secondary uppercase">Total Cobro</span>
                            <span className="text-sm font-bold text-status-sobrante">{formatCurrency(sede.totalCobroSede)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'COBROS' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-brand-text">Detalle de Cobros</h3>
                    <p className="text-sm text-brand-text-secondary">Listado jerárquico de artículos y variaciones</p>
                  </div>
                  <ExportButtons data={filteredArticles} />
                </div>
                <InventoryTable data={filteredArticles} />
              </div>
            )}

            {activeTab === 'ANÁLISIS' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-brand-text">Análisis de Variaciones</h3>
                    <p className="text-sm text-brand-text-secondary">Exploración detallada de movimientos</p>
                  </div>
                </div>
                <InventoryTable data={filteredArticles} />
              </div>
            )}

            {activeTab === 'CONFIABILIDAD' && (
              <ReliabilityView data={filteredArticles} filters={filters} setFilters={setFilters} />
            )}

            {activeTab === 'GERENCIAL' && (
              <ManagementAnalysis data={filteredArticles} selectedSede={filters.sedes.length === 1 ? filters.sedes[0] : undefined} />
            )}

            {activeTab === 'TRAZABILIDAD' && (
              <HistoricalTraceability 
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
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="bg-[#1F3A5F] text-white px-6 py-4 flex justify-between items-center shadow-md z-10">
        <div className="flex items-center gap-3">
          <div className="bg-[#2F80ED] p-2 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none uppercase">Cruces de Inventario</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#A7C4E0] font-bold">Auditoría y Cobros por Sede</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <FileUpload 
            onDataLoaded={(data) => setArticles(data)} 
            onReset={() => {
              setArticles([]);
              setFileName('');
            }}
            onFileNameChange={(name) => setFileName(name)}
            hasData={articles.length > 0}
          />
          {articles.length > 0 && (
            <>
              <div className="h-8 w-px bg-white/10"></div>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-[#5DADE2] uppercase">Estado</p>
                <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Sistema Activo
                </p>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      {articles.length > 0 && (
        <nav className="bg-white border-b border-border px-6 flex items-center gap-8 shadow-sm overflow-x-auto">
          {(['RESUMEN', 'ANÁLISIS', 'COBROS', 'CONFIABILIDAD', 'GERENCIAL', 'TRAZABILIDAD'] as Tab[]).map((tab) => {
            const Icon = {
              RESUMEN: LayoutDashboard,
              ANÁLISIS: BarChart2,
              COBROS: DollarSign,
              CONFIABILIDAD: ShieldCheck,
              GERENCIAL: BarChart3,
              TRAZABILIDAD: Activity
            }[tab];

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm transition-all ${
                  activeTab === tab 
                    ? 'border-[#2F80ED] text-[#2F80ED]' 
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
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-brand-border p-4 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        © {new Date().getFullYear()} PROMPT MAESTRO – SISTEMA DE AUDITORÍA DE INVENTARIOS
      </footer>
    </div>
  );
}
