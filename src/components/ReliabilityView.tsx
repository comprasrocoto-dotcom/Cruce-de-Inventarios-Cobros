import React, { useMemo, useState } from 'react';
import { ArticleSummary, ReliabilitySummary, ReliabilityStats } from '../types';
import { getReliabilitySummary } from '../utils/inventory';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle, 
  DollarSign, 
  Building2, 
  ChevronRight, 
  ArrowRight,
  PieChart,
  BarChart3,
  Search,
  Filter,
  FileDown,
  X,
  FileText,
  CheckCircle2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie,
  Legend
} from 'recharts';

interface ReliabilityViewProps {
  data: ArticleSummary[];
}

export const ReliabilityView: React.FC<ReliabilityViewProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'sede' | 'cc'>('sede');
  const [selectedSede, setSelectedSede] = useState<ReliabilityStats | null>(null);
  const [selectedCCFilter, setSelectedCCFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  // Modal specific states
  const [modalFilter, setModalFilter] = useState<'Todos' | 'Faltantes' | 'Sobrantes' | 'Sin diferencia'>('Todos');
  const [showOnlyFaltantes, setShowOnlyFaltantes] = useState(false);

  const summary = useMemo(() => getReliabilitySummary(data, viewMode), [data, viewMode]);

  const allItemsForSede = useMemo(() => {
    if (!selectedSede) return [];
    return data.filter(a => {
      if (selectedCCFilter) {
        return a.sede === selectedSede.sede && (a.cc || 'SIN CC') === selectedCCFilter;
      }
      const key = viewMode === 'sede' ? a.sede : (a.cc || 'SIN CC');
      return key === selectedSede.sede;
    });
  }, [data, selectedSede, viewMode, selectedCCFilter]);

  const filteredItems = useMemo(() => {
    let items = [...allItemsForSede].filter(a => {
      if (showOnlyFaltantes) return a.totalDiferencia < -0.0001;
      if (modalFilter === 'Faltantes') return a.totalDiferencia < -0.0001;
      if (modalFilter === 'Sobrantes') return a.totalDiferencia > 0.0001;
      if (modalFilter === 'Sin diferencia') return Math.abs(a.totalDiferencia) < 0.0001;
      return true;
    });

    // Sorting
    if (modalFilter === 'Faltantes' || showOnlyFaltantes) {
      items.sort((a, b) => a.totalDiferencia - b.totalDiferencia); // More negative first
    } else if (modalFilter === 'Sobrantes') {
      items.sort((a, b) => b.totalDiferencia - a.totalDiferencia); // More positive first
    } else if (modalFilter === 'Sin diferencia') {
      items.sort((a, b) => a.articulo.localeCompare(b.articulo));
    } else {
      // "Todos" - sort by absolute difference descending
      items.sort((a, b) => Math.abs(b.totalDiferencia) - Math.abs(a.totalDiferencia));
    }

    return items;
  }, [allItemsForSede, modalFilter, showOnlyFaltantes]);

  React.useEffect(() => {
    if (selectedSede) {
      console.log("totalItemsSede", allItemsForSede.length);
      console.log("filteredItems", filteredItems.length);
      console.log("sampleFiltered", filteredItems.slice(0, 5));
    }
  }, [selectedSede, allItemsForSede, filteredItems]);

  const heatmapData = useMemo(() => {
    const sedes: string[] = Array.from(new Set<string>(data.map(a => a.sede))).sort();
    const ccs: string[] = Array.from(new Set<string>(data.map(a => a.cc || 'SIN CC'))).sort();

    const matrix = sedes.map(sede => {
      const row: any = { sede };
      ccs.forEach(cc => {
        const items = data.filter(a => a.sede === sede && (a.cc || 'SIN CC') === cc);
        if (items.length === 0) {
          row[cc] = null;
        } else {
          const sinDif = items.filter(a => Math.abs(a.totalDiferencia) < 0.0001).length;
          const reliability = (sinDif / items.length) * 100;
          row[cc] = {
            reliability,
            count: items.length,
            sinDif
          };
        }
      });
      return row;
    });

    return { sedes, ccs, matrix };
  }, [data]);

  const getHeatmapCellColor = (reliability: number | null) => {
    if (reliability === null) return 'bg-slate-50 text-slate-300';
    if (reliability >= 85) return 'bg-[#27AE60] text-white';
    if (reliability >= 70) return 'bg-[#F2C94C] text-black';
    return 'bg-[#EB5757] text-white';
  };

  const handleHeatmapCellClick = (sedeName: string, ccName: string, reliabilityData: any) => {
    if (!reliabilityData) return;
    
    // Find the ReliabilityStats for this sede to open the modal
    // We use the 'sede' view summary to get the base stats
    const sedeStatsSummary = getReliabilitySummary(data, 'sede');
    const sedeStats = sedeStatsSummary.sedesStats.find(s => s.sede === sedeName);
    
    if (sedeStats) {
      setViewMode('sede');
      setSelectedSede(sedeStats);
      setSelectedCCFilter(ccName);
    }
  };

  const entityLabel = viewMode === 'sede' ? 'Sede' : 'Centro de Costos';
  const entitiesLabel = viewMode === 'sede' ? 'Sedes' : 'Centros de Costos';
  const reportTitle = viewMode === 'sede' ? 'Confiabilidad por Sede' : 'Confiabilidad por Centro de Costos';

  const filteredSedes = useMemo(() => {
    return summary.sedesStats.filter(s => {
      const matchesSearch = s.sede.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = levelFilter === 'all' || s.nivel === levelFilter;
      return matchesSearch && matchesLevel;
    });
  }, [summary, searchTerm, levelFilter]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val);

  const formatVariation = (val: number, unidad: string = 'UNIDADES') => {
    const absVal = Math.abs(val);
    if (absVal < 0.01) return '0';

    let formatted = val;
    const unitUpper = unidad.toUpperCase();

    if (unitUpper.includes('UNIDAD')) {
      formatted = Math.round(val);
    } else if (unitUpper.includes('GRAMO') || unitUpper.includes('ONZA')) {
      formatted = Number(val.toFixed(2));
    } else {
      formatted = Number(val.toFixed(2));
    }

    // toLocaleString with es-CO will use . for thousands and , for decimals
    return formatted.toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const getVariationColor = (val: number) => {
    if (Math.abs(val) < 0.01) return 'text-status-sin-diferencia';
    return val < 0 ? 'text-status-faltante' : 'text-status-sobrante';
  };

  const getLevelColor = (nivel: string) => {
    switch (nivel) {
      case 'Confiable': return 'text-[#27AE60] bg-emerald-50 border-emerald-100';
      case 'Alerta': return 'text-[#F2C94C] bg-amber-50 border-amber-100';
      case 'Crítico': return 'text-[#EB5757] bg-rose-50 border-rose-100';
      default: return 'text-brand-text-secondary bg-slate-50 border-brand-border';
    }
  };

  const getSemaphoreEmoji = (p: number) => {
    if (p >= 85) return '🟢';
    if (p >= 70) return '🟡';
    return '🔴';
  };

  const getStatusLabel = (p: number) => {
    if (p >= 85) return 'Confiable';
    if (p >= 70) return 'Alerta';
    return 'Crítico';
  };

  const ReliabilityBar = ({ percentage }: { percentage: number }) => {
    const getColor = (p: number) => {
      if (p >= 85) return '#27AE60';
      if (p >= 70) return '#F2C94C';
      return '#EB5757';
    };

    return (
      <div className="w-full mt-2">
        <div className="w-full h-[10px] bg-[#E5E7EB] rounded-[8px] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-[8px]"
            style={{ backgroundColor: getColor(percentage) }}
          />
        </div>
      </div>
    );
  };

  const distributionData = useMemo(() => {
    const counts = { Confiable: 0, Alerta: 0, Crítico: 0 };
    summary.sedesStats.forEach(s => {
      if (counts.hasOwnProperty(s.nivel)) {
        counts[s.nivel as keyof typeof counts]++;
      }
    });
    return [
      { name: 'Confiable', value: counts.Confiable, color: '#27AE60' },
      { name: 'Alerta', value: counts.Alerta, color: '#F2C94C' },
      { name: 'Crítico', value: counts.Crítico, color: '#EB5757' },
    ].filter(d => d.value > 0);
  }, [summary]);

  const chartData = useMemo(() => {
    return summary.sedesStats.slice(0, 10).map(s => ({
      name: s.sede,
      confiabilidad: Math.round(s.confiabilidad),
      impacto: s.impactoEconomico
    }));
  }, [summary]);

  const downloadPDF = (sede: ReliabilityStats) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const dateStr = new Date().toLocaleString();

    // Header
    doc.setFontSize(18);
    doc.setTextColor(31, 58, 95); // #1F3A5F
    doc.text(`Detalle de Confiabilidad - ${sede.sede}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Generado por: Sistema de Auditoría de Inventarios`, 14, 30);
    doc.text(`Fecha: ${dateStr}`, 14, 35);

    // KPIs
    doc.setFontSize(12);
    doc.setTextColor(31, 58, 95);
    doc.text(`Confiabilidad: ${Math.round(sede.confiabilidad)}%`, 14, 45);
    doc.text(`Evaluados: ${sede.articulosEvaluados}`, 14, 52);
    doc.text(`Sin diferencia: ${sede.articulosSinDiferencia}`, 70, 45);
    doc.text(`Con diferencia: ${sede.articulosConDiferencia}`, 70, 52);

    // CC Analysis
    const ccStatsMap = new Map<string, {
      evaluados: number;
      sinDiferencia: number;
      conDiferencia: number;
      impacto: number;
    }>();

    allItemsForSede.forEach(a => {
      const cc = a.cc || 'SIN CC';
      if (!ccStatsMap.has(cc)) {
        ccStatsMap.set(cc, { evaluados: 0, sinDiferencia: 0, conDiferencia: 0, impacto: 0 });
      }
      const stats = ccStatsMap.get(cc)!;
      stats.evaluados++;
      const diff = Math.abs(a.totalDiferencia);
      if (diff < 0.0001) {
        stats.sinDiferencia++;
      } else {
        stats.conDiferencia++;
      }
      stats.impacto += diff * (a.ultimoCoste || a.costePromedio);
    });

    const ccStatsArray = Array.from(ccStatsMap.entries()).map(([cc, stats]) => {
      const confiabilidad = stats.evaluados > 0 ? (stats.sinDiferencia / stats.evaluados) * 100 : 0;
      return {
        cc,
        ...stats,
        confiabilidad,
        estado: getStatusLabel(confiabilidad),
        emoji: getSemaphoreEmoji(confiabilidad)
      };
    }).sort((a, b) => a.confiabilidad - b.confiabilidad);

    let currentY = 65;

    // SECTION: CONFIABILIDAD POR CENTRO DE COSTOS
    doc.setFontSize(14);
    doc.setTextColor(31, 58, 95);
    doc.text('CONFIABILIDAD POR CENTRO DE COSTOS', 14, currentY);
    currentY += 6;

    autoTable(doc, {
      startY: currentY,
      head: [['Centro de Costos', 'Evaluados', 'Sin Dif.', 'Con Dif.', 'Impacto $', 'Confiabilidad', 'Estado']],
      body: ccStatsArray.map(c => [
        c.cc,
        c.evaluados,
        c.sinDiferencia,
        c.conDiferencia,
        formatCurrency(c.impacto),
        `${Math.round(c.confiabilidad)}%`,
        `${c.emoji} ${c.estado}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'center', fontStyle: 'bold' },
        6: { halign: 'left' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text(`Confiabilidad General (Sede): ${Math.round(sede.confiabilidad)}%`, 14, currentY);
    doc.text(`${getSemaphoreEmoji(sede.confiabilidad)} ${getStatusLabel(sede.confiabilidad)}`, 14, currentY + 6);
    doc.setFont('helvetica', 'normal');
    
    currentY += 12;

    // Data Segregation
    const faltantes = allItemsForSede.filter(a => a.totalDiferencia < -0.0001)
      .sort((a, b) => (Math.abs(b.totalDiferencia) * (b.ultimoCoste || b.costePromedio)) - (Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio)));
    
    const sobrantes = allItemsForSede.filter(a => a.totalDiferencia > 0.0001)
      .sort((a, b) => b.totalDiferencia - a.totalDiferencia);
    
    const sinDiferencia = allItemsForSede.filter(a => Math.abs(a.totalDiferencia) < 0.0001)
      .sort((a, b) => a.articulo.localeCompare(b.articulo));

    if (faltantes.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(235, 87, 87); // #EB5757 Rojo alerta
      doc.text('ARTÍCULOS FALTANTES', 14, currentY);
      currentY += 6;
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Total artículos faltantes: ${faltantes.length}`, 14, currentY);
      currentY += 4;

      autoTable(doc, {
        startY: currentY,
        head: [['Artículo', 'Unidad', 'Variación', 'Impacto Económico']],
        body: faltantes.map(a => [
          a.articulo,
          a.subarticulo,
          formatVariation(a.totalDiferencia, a.subarticulo),
          formatCurrency(Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio))
        ]),
        theme: 'striped',
        headStyles: { fillColor: [31, 58, 95] }, // #1F3A5F
        styles: { fontSize: 8 },
        columnStyles: {
          2: { textColor: [235, 87, 87], fontStyle: 'bold', halign: 'right' },
          3: { halign: 'right' }
        },
        didDrawPage: (data) => {
          currentY = data.cursor?.y || currentY;
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // SECTION 2: ARTÍCULOS SOBRANTES
    if (sobrantes.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFontSize(14);
      doc.setTextColor(39, 174, 96); // #27AE60 Verde positivo
      doc.text('ARTÍCULOS SOBRANTES', 14, currentY);
      currentY += 6;
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Total artículos sobrantes: ${sobrantes.length}`, 14, currentY);
      currentY += 4;

      autoTable(doc, {
        startY: currentY,
        head: [['Artículo', 'Unidad', 'Variación', 'Impacto Económico']],
        body: sobrantes.map(a => [
          a.articulo,
          a.subarticulo,
          `+${formatVariation(a.totalDiferencia, a.subarticulo)}`,
          formatCurrency(Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio))
        ]),
        theme: 'striped',
        headStyles: { fillColor: [31, 58, 95] }, // #1F3A5F
        styles: { fontSize: 8 },
        columnStyles: {
          2: { textColor: [39, 174, 96], fontStyle: 'bold', halign: 'right' },
          3: { halign: 'right' }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // SECTION 3: ARTÍCULOS SIN DIFERENCIA
    if (sinDiferencia.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      doc.setFontSize(14);
      doc.setTextColor(75, 85, 99); // gray-600
      doc.text('ARTÍCULOS SIN DIFERENCIA', 14, currentY);
      currentY += 6;
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Total artículos sin diferencia: ${sinDiferencia.length}`, 14, currentY);
      currentY += 4;

      autoTable(doc, {
        startY: currentY,
        head: [['Artículo', 'Unidad', 'Variación', 'Impacto Económico']],
        body: sinDiferencia.map(a => [
          a.articulo,
          a.subarticulo,
          '0',
          '$0'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [31, 58, 95] }, // #1F3A5F
        styles: { fontSize: 8 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text('Sistema de Auditoría de Inventarios - Reporte generado automáticamente', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

    doc.save(`Confiabilidad_${sede.sede}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-text">{reportTitle}</h2>
          <p className="text-brand-text-secondary">Indicador de precisión y consistencia del inventario por {entityLabel.toLowerCase()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Selector */}
          <div className="bg-brand-bg p-1 rounded-xl flex mr-4">
            <button
              onClick={() => setViewMode('sede')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'sede' ? 'bg-white text-[#2F80ED] shadow-sm' : 'text-brand-text-secondary hover:text-brand-text'}`}
            >
              Por Sede
            </button>
            <button
              onClick={() => setViewMode('cc')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'cc' ? 'bg-white text-[#2F80ED] shadow-sm' : 'text-brand-text-secondary hover:text-brand-text'}`}
            >
              Por Centro de Costos
            </button>
          </div>
          <button className="flex items-center space-x-2 bg-white border border-brand-border text-brand-text px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all">
            <FileDown className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
          <button className="flex items-center space-x-2 bg-brand-secondary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand-secondary-hover transition-all shadow-lg shadow-blue-100">
            <FileDown className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* Main Findings Block */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
        <div className="flex items-center space-x-2 mb-4 text-brand-secondary">
          <Target className="w-5 h-5" />
          <h3 className="font-bold uppercase tracking-wider text-sm">Hallazgos Principales</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-start space-x-3">
            <div className="bg-emerald-50 p-2 rounded-lg text-status-sobrante mt-1 border border-emerald-100">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-text-secondary font-semibold uppercase">{entityLabel} más confiable</p>
              <p className="text-lg font-bold text-text-main">{summary.sedeMasConfiable}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="bg-rose-50 p-2 rounded-lg text-status-faltante mt-1 border border-rose-100">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-text-secondary font-semibold uppercase">{entityLabel} menos confiable</p>
              <p className="text-lg font-bold text-text-main">{summary.sedeMenosConfiable}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="bg-amber-50 p-2 rounded-lg text-amber-600 mt-1 border border-amber-100">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-text-secondary font-semibold uppercase">Mayor Impacto Económico</p>
              <p className="text-lg font-bold text-text-main">{formatCurrency(summary.impactoEconomicoTotal)}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="bg-blue-50 p-2 rounded-lg text-secondary mt-1 border border-blue-100">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-text-secondary font-semibold uppercase">Diferencias Detectadas</p>
              <p className="text-lg font-bold text-text-main">{summary.totalDiferencias} artículos</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl card border-l-4 border-[#27AE60]">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-5 h-5 text-[#27AE60]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Confiables</span>
          </div>
          <p className="text-3xl font-bold text-text-main">{summary.sedesStats.filter(s => s.confiabilidad >= 85).length}</p>
          <p className="text-sm text-text-secondary mt-1">{entitiesLabel} con precisión alta</p>
        </div>
        <div className="bg-white p-6 rounded-2xl card border-l-4 border-[#F2C94C]">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#F2C94C]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">En Alerta</span>
          </div>
          <p className="text-3xl font-bold text-text-main">{summary.sedesStats.filter(s => s.confiabilidad >= 70 && s.confiabilidad < 85).length}</p>
          <p className="text-sm text-text-secondary mt-1">{entitiesLabel} con descuadres medios</p>
        </div>
        <div className="bg-white p-6 rounded-2xl card border-l-4 border-[#EB5757]">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#EB5757]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Críticos</span>
          </div>
          <p className="text-3xl font-bold text-text-main">{summary.sedesStats.filter(s => s.confiabilidad < 70).length}</p>
          <p className="text-sm text-text-secondary mt-1">{entitiesLabel} con descuadres graves</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl card">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="w-5 h-5 text-text-secondary" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">{entitiesLabel}</span>
          </div>
          <p className="text-3xl font-bold text-text-main">{summary.totalSedes}</p>
          <p className="text-sm text-text-secondary mt-1">{entitiesLabel} evaluados</p>
        </div>
        <div className="bg-white p-6 rounded-2xl card">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-5 h-5 text-secondary" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Promedio</span>
          </div>
          <p className="text-3xl font-bold text-text-main">{Math.round(summary.promedioConfiabilidad)}%</p>
          <p className="text-sm text-text-secondary mt-1">Confiabilidad general</p>
        </div>
        <div className="bg-white p-6 rounded-2xl card">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Diferencias</span>
          </div>
          <p className="text-3xl font-bold text-text-main">{summary.totalDiferencias}</p>
          <p className="text-sm text-text-secondary mt-1">Artículos con descuadre</p>
        </div>
        <div className="bg-white p-6 rounded-2xl card">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-5 h-5 text-success" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Impacto</span>
          </div>
          <p className="text-3xl font-bold text-text-main">{formatCurrency(summary.impactoEconomicoTotal)}</p>
          <p className="text-sm text-text-secondary mt-1">Valor total diferencias</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl card">
          <div className="flex items-center space-x-2 mb-6 text-text-secondary">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Confiabilidad por {entityLabel} (%)</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '12px', fontWeight: 500 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="confiabilidad" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.confiabilidad >= 85 ? '#27AE60' : entry.confiabilidad >= 70 ? '#F2C94C' : '#EB5757'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl card">
          <div className="flex items-center space-x-2 mb-6 text-text-secondary">
            <PieChart className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Distribución por Nivel de Riesgo</span>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 text-brand-text-secondary">
            <Filter className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Filtros de {entitiesLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-secondary" />
              <input 
                type="text"
                placeholder={`Buscar ${entityLabel.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-brand-border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary"
              />
            </div>
            <select 
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-slate-50 border border-brand-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            >
              <option value="all">Todos los niveles</option>
              <option value="Confiable">Confiable</option>
              <option value="Alerta">Alerta</option>
              <option value="Crítico">Crítico</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sede Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSedes.map((sede) => (
          <motion.div 
            key={sede.sede}
            layoutId={sede.sede}
            onClick={() => setSelectedSede(sede)}
            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all cursor-pointer group flex flex-col h-full"
          >
            {/* FILA SUPERIOR: Nombre (izq) */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-lg line-clamp-2 leading-tight">
                  {sede.sede}
                </h4>
                {/* DEBAJO DEL NOMBRE: Etiqueta de estado */}
                <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getLevelColor(sede.nivel)}`}>
                  <span className="mr-1">{getSemaphoreEmoji(sede.confiabilidad)}</span>
                  {sede.nivel}
                </div>
              </div>
            </div>

            {/* DEBAJO DEL BLOQUE SUPERIOR: Confiabilidad y Barra */}
            <div className="mb-6">
              <p className="text-sm font-bold text-slate-700">
                Confiabilidad: <span className="text-indigo-600">{sede.confiabilidad.toFixed(1)}%</span>
              </p>
              <ReliabilityBar percentage={sede.confiabilidad} />
            </div>

            {/* Bloques de Artículos, Diferencias, Impacto */}
            <div className="space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Artículos</p>
                  <p className="text-sm font-bold text-slate-700">{sede.articulosEvaluados}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diferencias</p>
                  <p className="text-sm font-bold text-slate-700">{sede.articulosConDiferencia}</p>
                </div>
                <div className="col-span-2 bg-rose-50/50 p-3 rounded-xl border border-rose-100/50">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Impacto Económico</p>
                  <p className="text-lg font-black text-rose-600 leading-none mt-1">{formatCurrency(sede.impactoEconomico)}</p>
                </div>
              </div>
            </div>

            {/* Link: Ver detalle completo */}
            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-indigo-600 font-bold text-xs group-hover:translate-x-1 transition-transform">
              <span>Ver detalle completo</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Heatmap Section */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center space-x-2 mb-8 text-slate-400">
          <PieChart className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Mapa de Calor de Confiabilidad (Sede vs Centro de Costos)</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-4 bg-slate-50 border border-slate-200 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest sticky left-0 z-10 min-w-[180px]">
                  Sede / Centro
                </th>
                {heatmapData.ccs.map(cc => (
                  <th key={cc} className="p-4 bg-slate-50 border border-slate-200 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[120px]">
                    {cc}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.matrix.map((row) => (
                <tr key={row.sede}>
                  <td className="p-4 bg-white border border-slate-200 font-bold text-slate-700 text-sm sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    {row.sede}
                  </td>
                  {heatmapData.ccs.map(cc => {
                    const cell = row[cc];
                    return (
                      <td 
                        key={cc} 
                        className={`p-0 border border-slate-200 transition-all ${cell ? 'cursor-pointer hover:opacity-80 active:scale-95' : ''}`}
                        onClick={() => handleHeatmapCellClick(row.sede, cc, cell)}
                      >
                        <div className={`w-full h-full min-h-[60px] flex flex-col items-center justify-center p-2 ${getHeatmapCellColor(cell?.reliability ?? null)}`}>
                          {cell ? (
                            <>
                              <span className="text-lg font-black leading-none">{Math.round(cell.reliability)}%</span>
                              <span className="text-[10px] font-bold opacity-80 mt-1 uppercase tracking-tighter">
                                {getStatusLabel(cell.reliability)}
                              </span>
                              <span className="text-[9px] opacity-60 mt-0.5">
                                {cell.sinDif}/{cell.count} art.
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] font-medium opacity-40 italic">N/A</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-6 flex flex-wrap items-center gap-6 justify-center text-[11px] font-bold uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#27AE60]"></div>
            <span className="text-slate-500">Confiable (≥85%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#F2C94C]"></div>
            <span className="text-slate-500">Alerta (70-84%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#EB5757]"></div>
            <span className="text-slate-500">Crítico ({'<'}70%)</span>
          </div>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Ranking de Confiabilidad por {entityLabel}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pos</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entityLabel}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Confiabilidad %</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Evaluados</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Sin Dif.</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Con Dif.</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Variación</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Impacto $</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nivel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summary.sedesStats.map((s, idx) => (
                <tr key={s.sede} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-emerald-100 text-emerald-700' : idx === summary.sedesStats.length - 1 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{s.sede}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-black text-slate-900">{Math.round(s.confiabilidad)}%</span>
                      <span className="text-[10px] font-bold flex items-center gap-1">
                        <span>{getSemaphoreEmoji(s.confiabilidad)}</span>
                        <span className={
                          s.confiabilidad >= 85 ? 'text-[#27AE60]' : 
                          s.confiabilidad >= 70 ? 'text-[#F2C94C]' : 
                          'text-[#EB5757]'
                        }>{getStatusLabel(s.confiabilidad)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{s.articulosEvaluados}</td>
                  <td className="px-6 py-4 text-center text-emerald-600 font-medium">{s.articulosSinDiferencia}</td>
                  <td className="px-6 py-4 text-center text-rose-600 font-medium">{s.articulosConDiferencia}</td>
                  <td className={`px-6 py-4 text-right font-medium ${getVariationColor(s.variacionTotal)}`}>
                    {formatVariation(s.variacionTotal, 'GRAMOS')}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-rose-600">{formatCurrency(s.impactoEconomico)}</td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getLevelColor(s.nivel)}`}>
                      {s.nivel}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedSede(s)}
                      className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-100 shadow-sm"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedSede && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSede(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              layoutId={selectedSede.sede}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Detalle de Confiabilidad - {selectedSede.sede}</h3>
                  {selectedCCFilter && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filtrado por:</span>
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border border-indigo-100">
                        {selectedCCFilter}
                      </span>
                      <button 
                        onClick={() => setSelectedCCFilter(null)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getLevelColor(selectedSede.nivel)}`}>
                    <span className="mr-1">{getSemaphoreEmoji(selectedSede.confiabilidad)}</span>
                    Estado {selectedSede.nivel}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => downloadPDF(selectedSede)}
                    className="flex items-center space-x-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-rose-500" />
                    <span>Descargar PDF</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedSede(null);
                      setSelectedCCFilter(null);
                      setModalFilter('Todos');
                      setShowOnlyFaltantes(false);
                    }}
                    className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-slate-200"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confiabilidad</p>
                    <p className="text-2xl font-black text-slate-900">{Math.round(selectedSede.confiabilidad)}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Evaluados</p>
                    <p className="text-2xl font-black text-slate-900">{selectedSede.articulosEvaluados}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sin Diferencia</p>
                    <p className="text-2xl font-black text-emerald-600">{selectedSede.articulosSinDiferencia}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Con Diferencia</p>
                    <p className="text-2xl font-black text-rose-600">{selectedSede.articulosConDiferencia}</p>
                  </div>
                </div>

                {/* Modal Filters */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                      {(['Todos', 'Faltantes', 'Sobrantes', 'Sin diferencia'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setModalFilter(f)}
                          className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${modalFilter === f ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={showOnlyFaltantes}
                        onChange={(e) => setShowOnlyFaltantes(e.target.checked)}
                      />
                      <div className={`w-10 h-5 rounded-full transition-colors ${showOnlyFaltantes ? 'bg-rose-500' : 'bg-slate-200'}`}></div>
                      <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${showOnlyFaltantes ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">Mostrar solo unidades faltantes</span>
                  </label>
                </div>

                {/* Tables Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Listado de Referencias
                    </h4>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                      Referencias encontradas: {filteredItems.length}
                    </span>
                  </div>
                  
                  <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-[#1F3A5F] text-white">
                        <tr>
                          <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">ARTÍCULO</th>
                          <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">UNIDAD</th>
                          <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px] text-right">VARIACIÓN</th>
                          <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px] text-right">IMPACTO ECONÓMICO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredItems.map((a, i) => (
                          <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'} hover:bg-[#F3F4F6] transition-colors`}>
                            <td className="px-6 py-3 font-medium text-slate-700">{a.articulo}</td>
                            <td className="px-6 py-3 text-slate-500 text-[10px] font-bold">{a.subarticulo}</td>
                            <td className={`px-6 py-3 text-right font-bold ${a.totalDiferencia < 0 ? 'text-rose-600' : a.totalDiferencia > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {a.totalDiferencia > 0 ? '+' : ''}{showOnlyFaltantes ? formatVariation(Math.abs(a.totalDiferencia), a.subarticulo) : formatVariation(a.totalDiferencia, a.subarticulo)}
                            </td>
                            <td className={`px-6 py-3 text-right font-black ${a.totalDiferencia < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                              {formatCurrency(Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio))}
                            </td>
                          </tr>
                        ))}
                        {filteredItems.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic bg-slate-50">
                              No hay artículos que coincidan con el filtro
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Impacto Total {entityLabel}</p>
                    <p className="text-2xl font-black text-rose-700">{formatCurrency(selectedSede.impactoEconomico)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedSede(null);
                    setModalFilter('Todos');
                    setShowOnlyFaltantes(false);
                  }}
                  className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all"
                >
                  Cerrar Detalle
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
