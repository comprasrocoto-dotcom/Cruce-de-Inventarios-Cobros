import React, { useMemo, useState } from 'react';
import { ArticleSummary, ReliabilitySummary, ReliabilityStats, ProductStability } from '../types';
import { getReliabilitySummary, getProductStabilityAnalysis } from '../utils/inventory';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
  FileSpreadsheet,
  X,
  FileText,
  CheckCircle2,
  ShieldAlert,
  Activity,
  Award,
  Zap
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
  filters: {
    sede: string;
    cc: string;
    subfamilia: string;
    status: string;
    search: string;
  };
}

export const ReliabilityView: React.FC<ReliabilityViewProps> = ({ data, filters }) => {
  const [mainTab, setMainTab] = useState<'operativo' | 'tecnico' | 'estabilidad'>('operativo');
  const [viewMode, setViewMode] = useState<'sede' | 'cc'>('sede');
  const [selectedSede, setSelectedSede] = useState<ReliabilityStats | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductStability | null>(null);
  const [selectedCCFilter, setSelectedCCFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  // Modal specific states
  const [modalFilter, setModalFilter] = useState<'Todos' | 'Faltantes' | 'Sobrantes' | 'Sin diferencia'>('Todos');
  const [showOnlyFaltantes, setShowOnlyFaltantes] = useState(false);
  const [modalTab, setModalTab] = useState<'operacion' | 'tecnico'>('operacion');

  const summary = useMemo(() => getReliabilitySummary(data, viewMode), [data, viewMode]);
  const analisisEstabilidad = useMemo(() => getProductStabilityAnalysis(data), [data]);

  const resumenFinanciero = useMemo(() => {
    let totalPerdidaMargen = 0;
    let totalRecuperable = 0;

    data.forEach(item => {
      totalPerdidaMargen += (item.perdidaPorMargen || 0);
      totalRecuperable += (item.dineroRecuperable || 0);
    });

    return {
      totalPerdidaMargen,
      totalRecuperable
    };
  }, [data]);

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
      // "Todos" - sort by dinero recuperable descending (Ranking de pérdidas)
      items.sort((a, b) => (b.dineroRecuperable || 0) - (a.dineroRecuperable || 0));
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
      case 'Confiable': return 'text-[#27AE60] bg-emerald-50 border-[#27AE60]/20';
      case 'Alerta': return 'text-[#F2C94C] bg-amber-50 border-[#F2C94C]/20';
      case 'Crítico': return 'text-[#EB5757] bg-rose-50 border-[#EB5757]/20';
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

  const getStatusColor = (p: number) => {
    if (p >= 85) return '#27AE60';
    if (p >= 70) return '#F2C94C';
    return '#EB5757';
  };

  const downloadGeneralPDF = (sede: ReliabilityStats) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const dateStr = new Date().toLocaleString();
    const sedeItems = data.filter(a => a.sede === sede.sede);

    // Header
    doc.setFontSize(18);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text(`Reporte de Confiabilidad - ${sede.sede}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sistema de Auditoría de Inventarios`, 14, 28);
    doc.text(`Fecha: ${dateStr}`, 14, 33);

    // Indicadores Rápidos (Tarjetas Horizontales Compactas)
    let currentY = 40;
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(14, currentY, pageWidth - 28, 22, 3, 3, 'F');
    
    const colWidth = (pageWidth - 28) / 5;
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'bold');
    doc.text('CONFIABILIDAD', 20, currentY + 7);
    doc.text('EVALUADOS', 20 + colWidth, currentY + 7);
    doc.text('DIFERENCIAS', 20 + colWidth * 2, currentY + 7);
    doc.text('IMPACTO TOTAL', 20 + colWidth * 3, currentY + 7);
    doc.text('RIESGO', 20 + colWidth * 4, currentY + 7);

    doc.setFontSize(11);
    doc.setTextColor(getStatusColor(sede.confiabilidad));
    doc.text(`${Math.round(sede.confiabilidad)}%`, 20, currentY + 15);
    
    doc.setTextColor(31, 58, 95);
    doc.text(`${sede.articulosEvaluados}`, 20 + colWidth, currentY + 15);
    doc.text(`${sede.articulosConDiferencia}`, 20 + colWidth * 2, currentY + 15);
    doc.text(formatCurrency(sede.impactoEconomico), 20 + colWidth * 3, currentY + 15);
    
    const riskLevel = sede.confiabilidad >= 85 ? 'BAJO' : sede.confiabilidad >= 70 ? 'MEDIO' : 'ALTO';
    doc.setTextColor(getStatusColor(sede.confiabilidad));
    doc.text(riskLevel, 20 + colWidth * 4, currentY + 15);

    currentY += 32;

    // 1. CONFIABILIDAD POR CENTRO DE COSTOS
    doc.setFontSize(12);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('1. CONFIABILIDAD POR CENTRO DE COSTOS', 14, currentY);
    currentY += 6;

    const ccStatsMap = new Map<string, {
      evaluados: number;
      sinDiferencia: number;
      conDiferencia: number;
      impacto: number;
      items: ArticleSummary[];
    }>();

    sedeItems.forEach(a => {
      const cc = a.cc || 'SIN CC';
      if (!ccStatsMap.has(cc)) {
        ccStatsMap.set(cc, { evaluados: 0, sinDiferencia: 0, conDiferencia: 0, impacto: 0, items: [] });
      }
      const stats = ccStatsMap.get(cc)!;
      stats.evaluados++;
      stats.items.push(a);
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

    autoTable(doc, {
      startY: currentY,
      head: [['Centro de Costos', 'Evaluados', 'Sin Dif.', 'Con Dif.', 'Impacto $', 'Confiabilidad', 'Estado']],
      body: ccStatsArray.map(c => [
        c.cc,
        c.evaluados,
        c.sinDiferencia,
        c.conDiferencia,
        formatCurrency(c.impacto),
        { content: `${Math.round(c.confiabilidad)}%`, styles: { textColor: getStatusColor(c.confiabilidad), fontStyle: 'bold' } },
        `${c.emoji} ${c.estado}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 8 },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'center' }
      }
    });

    // 2. DETALLE DE ARTÍCULOS
    doc.addPage();
    currentY = 20;
    doc.setFontSize(14);
    doc.text('2. DETALLE DE ARTÍCULOS EVALUADOS', 14, currentY);
    currentY += 10;

    ccStatsArray.forEach((ccData) => {
      if (currentY > 240) { doc.addPage(); currentY = 20; }
      doc.setFontSize(11);
      doc.setTextColor(31, 58, 95);
      doc.text(`CENTRO DE COSTOS: ${ccData.cc.toUpperCase()}`, 14, currentY);
      currentY += 5;

      const items = ccData.items.sort((a, b) => Math.abs(b.totalDiferencia) - Math.abs(a.totalDiferencia));
      
      autoTable(doc, {
        startY: currentY,
        head: [['Artículo', 'Unidad', 'Variación', 'Impacto $']],
        body: items.map(a => [
          a.articulo,
          a.subarticulo,
          formatVariation(a.totalDiferencia, a.subarticulo),
          formatCurrency(Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio))
        ]),
        theme: 'striped',
        headStyles: { fillColor: [107, 114, 128] },
        styles: { fontSize: 7 },
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    addFooter(doc, pageWidth);
    doc.save(`Reporte_General_${sede.sede}.pdf`);
  };

  const downloadLossesPDF = (sede: ReliabilityStats) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const sedeItems = data.filter(a => a.sede === sede.sede);

    doc.setFontSize(18);
    doc.setTextColor(235, 87, 87);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOP 10 PÉRDIDAS - ${sede.sede}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('Análisis detallado de faltantes críticos por centro de costos.', 14, 28);

    let currentY = 40;
    const ccs = Array.from(new Set(sedeItems.map(a => a.cc || 'SIN CC')));

    ccs.forEach(cc => {
      const ccStr = String(cc);
      const losses = sedeItems
        .filter(a => (a.cc || 'SIN CC') === ccStr && a.totalDiferencia < -0.0001)
        .sort((a, b) => (Math.abs(b.totalDiferencia) * (b.ultimoCoste || b.costePromedio)) - (Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio)))
        .slice(0, 10);

      if (losses.length > 0) {
        if (currentY > 240) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12);
        doc.setTextColor(235, 87, 87);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOP PÉRDIDAS ${ccStr.toUpperCase()}`, 14, currentY);
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          head: [['Artículo', 'Variación', 'Impacto Económico']],
          body: losses.map(a => [
            a.articulo,
            formatVariation(a.totalDiferencia, a.subarticulo),
            formatCurrency(Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio))
          ]),
          theme: 'striped',
          headStyles: { fillColor: [235, 87, 87] },
          styles: { fontSize: 8 },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', fontStyle: 'bold' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }
    });

    addFooter(doc, pageWidth);
    doc.save(`Top_Perdidas_${sede.sede}.pdf`);
  };

  const downloadGainsPDF = (sede: ReliabilityStats) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const sedeItems = data.filter(a => a.sede === sede.sede);

    doc.setFontSize(18);
    doc.setTextColor(39, 174, 96);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOP 10 GANANCIAS (SOBRANTES) - ${sede.sede}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('Análisis de sobrantes encontrados en los conteos físicos.', 14, 28);

    let currentY = 40;
    const ccs = Array.from(new Set(sedeItems.map(a => a.cc || 'SIN CC')));

    ccs.forEach(cc => {
      const ccStr = String(cc);
      const gains = sedeItems
        .filter(a => (a.cc || 'SIN CC') === ccStr && a.totalDiferencia > 0.0001)
        .sort((a, b) => (b.totalDiferencia * (b.ultimoCoste || b.costePromedio)) - (a.totalDiferencia * (a.ultimoCoste || a.costePromedio)))
        .slice(0, 10);

      if (gains.length > 0) {
        if (currentY > 240) { doc.addPage(); currentY = 20; }
        doc.setFontSize(12);
        doc.setTextColor(39, 174, 96);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOP GANANCIAS ${ccStr.toUpperCase()}`, 14, currentY);
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          head: [['Artículo', 'Unidad', 'Variación', 'Impacto Económico']],
          body: gains.map(a => [
            a.articulo,
            a.subarticulo,
            `+${formatVariation(a.totalDiferencia, a.subarticulo)}`,
            formatCurrency(Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio))
          ]),
          theme: 'striped',
          headStyles: { fillColor: [39, 174, 96] },
          styles: { fontSize: 8 },
          columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right', fontStyle: 'bold' } }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }
    });

    addFooter(doc, pageWidth);
    doc.save(`Top_Ganancias_${sede.sede}.pdf`);
  };

  const downloadProblematicPDF = (sede: ReliabilityStats) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const sedeItems = data.filter(a => a.sede === sede.sede);

    doc.setFontSize(18);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text(`PRODUCTOS DE MAYOR RIESGO - ${sede.sede}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('Artículos con mayor impacto y frecuencia de errores.', 14, 28);

    const problemItems = sedeItems.map(a => {
      const impacto = Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio);
      const variacionAbs = Math.abs(a.totalDiferencia);
      const frecuencia = a.movements ? a.movements.filter(m => Math.abs(m.variacion) > 0.0001).length : 1;
      return { ...a, impacto, variacionAbs, frecuencia };
    });

    const maxImpacto = Math.max(...problemItems.map(i => i.impacto), 1);
    const maxVariacion = Math.max(...problemItems.map(i => i.variacionAbs), 1);
    const maxFrecuencia = Math.max(...problemItems.map(i => i.frecuencia), 1);

    const scoredItems = problemItems.map(i => {
      const score = ((i.impacto / maxImpacto * 0.6) + (i.variacionAbs / maxVariacion * 0.3) + (i.frecuencia / maxFrecuencia * 0.1)) * 100;
      let nivel = score >= 80 ? 'CRÍTICO' : score >= 50 ? 'MEDIO' : 'BAJO';
      let emoji = score >= 80 ? '🔴' : score >= 50 ? '🟠' : '🟢';
      return { ...i, score, nivel, emoji };
    }).sort((a, b) => b.score - a.score).slice(0, 10);

    autoTable(doc, {
      startY: 40,
      head: [['Ranking', 'Artículo', 'CC', 'Impacto $', 'Err.', 'Riesgo']],
      body: scoredItems.map((a, idx) => [
        idx + 1,
        a.articulo,
        a.cc || 'SIN CC',
        formatCurrency(a.impacto),
        a.frecuencia,
        `${a.emoji} ${a.nivel}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'center' } }
    });

    addFooter(doc, pageWidth);
    doc.save(`Riesgo_Operativo_${sede.sede}.pdf`);
  };

  const addFooter = (doc: jsPDF, pageWidth: number) => {
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
      doc.text('Sistema de Auditoría de Inventarios - Reporte generado automáticamente', pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }
  };

  const downloadPDF = (sede: ReliabilityStats) => {
    downloadGeneralPDF(sede);
  };

  const exportDashboardToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const dateStr = new Date().toLocaleDateString('es-CO');
    const conf = Math.round(summary.promedioConfiabilidad);
    const status = conf >= 85 ? 'CONFIABLE' : conf >= 70 ? 'ALERTA' : 'CRÍTICO';
    const statusColor = conf >= 85 ? [39, 174, 96] : conf >= 70 ? [242, 201, 76] : [235, 87, 87];

    // --- PÁGINA 1: PORTADA EJECUTIVA ---
    // Fondo decorativo superior
    doc.setFillColor(31, 58, 95);
    doc.rect(0, 0, pageWidth, 60, 'F');

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE GERENCIAL DE', pageWidth / 2, 25, { align: 'center' });
    doc.text('CONFIABILIDAD DE INVENTARIOS', pageWidth / 2, 35, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(200, 200, 200);
    doc.setFont('helvetica', 'normal');
    doc.text('Sistema de Auditoría de Inventarios', pageWidth / 2, 45, { align: 'center' });

    // Detalles Portada
    let coverY = 80;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('DETALLES DEL REPORTE', 20, coverY);
    coverY += 8;
    
    doc.setDrawColor(226, 232, 240);
    doc.line(20, coverY, pageWidth - 20, coverY);
    coverY += 10;

    doc.setFontSize(11);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha de generación:', 20, coverY);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, 70, coverY);
    coverY += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Sedes evaluadas:', 20, coverY);
    doc.setFont('helvetica', 'normal');
    doc.text(summary.totalSedes.toString(), 70, coverY);
    coverY += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Centro de costos:', 20, coverY);
    doc.setFont('helvetica', 'normal');
    doc.text(filters.cc || 'Todos', 70, coverY);
    coverY += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Subfamilias:', 20, coverY);
    doc.setFont('helvetica', 'normal');
    doc.text(filters.subfamilia || 'Todas', 70, coverY);
    coverY += 15;

    // Indicador Central
    doc.setFontSize(16);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('CONFIABILIDAD GENERAL', pageWidth / 2, coverY, { align: 'center' });
    coverY += 25;

    doc.setFontSize(72);
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.text(`${conf}%`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 15;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Estado general del sistema: ${status}`, pageWidth / 2, coverY, { align: 'center' });
    coverY += 25;

    // KPIs Principales (Cards en Portada)
    const kpiCardWidth = (pageWidth - 50) / 2;
    const kpiCardHeight = 35;

    // Sede más confiable
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(20, coverY, kpiCardWidth, kpiCardHeight, 3, 3, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('SEDE MÁS CONFIABLE', 25, coverY + 10);
    doc.setFontSize(11);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    const bestSedeLines = doc.splitTextToSize(summary.sedeMasConfiable, kpiCardWidth - 10);
    doc.text(bestSedeLines, 25, coverY + 22);

    // Sede menos confiable
    doc.roundedRect(pageWidth / 2 + 5, coverY, kpiCardWidth, kpiCardHeight, 3, 3, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('SEDE MENOS CONFIABLE', pageWidth / 2 + 10, coverY + 10);
    doc.setFontSize(11);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    const worstSedeLines = doc.splitTextToSize(summary.sedeMenosConfiable, kpiCardWidth - 10);
    doc.text(worstSedeLines, pageWidth / 2 + 10, coverY + 22);

    coverY += kpiCardHeight + 10;

    // Impacto económico
    doc.setFillColor(254, 242, 242); // Rose 50
    doc.setDrawColor(254, 202, 202); // Rose 200
    doc.roundedRect(20, coverY, kpiCardWidth, kpiCardHeight, 3, 3, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27); // Rose 800
    doc.setFont('helvetica', 'normal');
    doc.text('IMPACTO ECONÓMICO TOTAL', 25, coverY + 10);
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38); // Rose 600
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(summary.impactoEconomicoTotal), 25, coverY + 25);

    // Diferencias detectadas
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(pageWidth / 2 + 5, coverY, kpiCardWidth, kpiCardHeight, 3, 3, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('DIFERENCIAS DETECTADAS', pageWidth / 2 + 10, coverY + 10);
    doc.setFontSize(14);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text(`${summary.totalDiferencias} artículos`, pageWidth / 2 + 10, coverY + 25);

    // --- PÁGINA 2: DASHBOARD DE CONFIABILIDAD ---
    doc.addPage();
    let currentY = 20;
    doc.setFontSize(16);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('DASHBOARD DE CONFIABILIDAD', 14, currentY);
    currentY += 12;

    // Hallazgos Principales
    doc.setFontSize(12);
    doc.text('HALLAZGOS PRINCIPALES', 14, currentY);
    currentY += 8;
    
    const findings = [
      { label: `${entityLabel} más confiable`, value: summary.sedeMasConfiable },
      { label: `${entityLabel} menos confiable`, value: summary.sedeMenosConfiable },
      { label: 'Mayor Impacto Económico', value: formatCurrency(summary.impactoEconomicoTotal) },
      { label: 'Diferencias Detectadas', value: `${summary.totalDiferencias} artículos` }
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Indicador', 'Valor']],
      body: findings.map(f => [f.label, f.value]),
      theme: 'grid',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 10 }
    });
    
    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Indicadores Generales
    doc.setFontSize(12);
    doc.text('INDICADORES GENERALES', 14, currentY);
    currentY += 8;

    const kpis = [
      { label: `${entitiesLabel.toUpperCase()}`, value: summary.totalSedes.toString() },
      { label: 'CONFIABILIDAD', value: `${Math.round(summary.promedioConfiabilidad)}%` },
      { label: 'DIFERENCIAS', value: summary.totalDiferencias.toString() },
      { label: 'IMPACTO TOTAL', value: formatCurrency(summary.impactoEconomicoTotal) }
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Sedes', 'Confiabilidad', 'Diferencias', 'Impacto Total']],
      body: [[kpis[0].value, kpis[1].value, kpis[2].value, kpis[3].value]],
      theme: 'grid',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 10, halign: 'center' }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Clasificación de Sedes
    doc.setFontSize(12);
    doc.text('CLASIFICACIÓN DE SEDES POR NIVEL DE RIESGO', 14, currentY);
    currentY += 8;

    const counts = { Confiable: 0, Alerta: 0, Crítico: 0 };
    summary.sedesStats.forEach(s => {
      if (counts.hasOwnProperty(s.nivel)) {
        counts[s.nivel as keyof typeof counts]++;
      }
    });

    autoTable(doc, {
      startY: currentY,
      head: [['Nivel', 'Cantidad de sedes', 'Descripción']],
      body: [
        ['Confiables', counts.Confiable, 'Sedes con precisión alta (>=85%)'],
        ['En alerta', counts.Alerta, 'Sedes con descuadres medios (70-84%)'],
        ['Críticos', counts.Crítico, 'Sedes con descuadres graves (<70%)']
      ],
      theme: 'grid',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 9 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Gráficos (Representación visual simplificada)
    if (currentY > 200) { doc.addPage(); currentY = 20; }
    doc.setFontSize(12);
    doc.text('CONFIABILIDAD POR SEDE (%)', 14, currentY);
    currentY += 8;

    const chartWidth = pageWidth - 60;
    const barHeight = 6;
    summary.sedesStats.slice(0, 8).forEach((s, i) => {
      doc.setFontSize(8);
      doc.setTextColor(31, 58, 95);
      doc.text(s.sede, 14, currentY + 4);
      const barW = (s.confiabilidad / 100) * chartWidth;
      doc.setFillColor(getStatusColor(s.confiabilidad));
      doc.rect(50, currentY, barW, barHeight, 'F');
      doc.text(`${Math.round(s.confiabilidad)}%`, 50 + barW + 2, currentY + 4);
      currentY += barHeight + 3;
    });

    // --- PÁGINA 3: TABLA DETALLADA ---
    doc.addPage();
    currentY = 20;
    doc.setFontSize(16);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE CONFIABILIDAD POR SEDE', 14, currentY);
    currentY += 10;

    const sortedSedes = [...summary.sedesStats].sort((a, b) => a.confiabilidad - b.confiabilidad);

    autoTable(doc, {
      startY: currentY,
      head: [['Sede', 'Evaluados', 'Sin Dif.', 'Con Dif.', 'Confiabilidad', 'Impacto $', 'Estado']],
      body: sortedSedes.map(s => [
        s.sede,
        s.articulosEvaluados,
        s.articulosSinDiferencia,
        s.articulosConDiferencia,
        `${Math.round(s.confiabilidad)}%`,
        formatCurrency(s.impactoEconomico),
        s.nivel
      ]),
      theme: 'striped',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 8 },
      columnStyles: {
        4: { halign: 'center', fontStyle: 'bold' },
        5: { halign: 'right' },
        6: { halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = parseInt(data.cell.text[0]);
          if (val >= 85) data.cell.styles.textColor = [39, 174, 96];
          else if (val >= 70) data.cell.styles.textColor = [242, 201, 76];
          else data.cell.styles.textColor = [235, 87, 87];
        }
      }
    });

    // --- PÁGINA 4: ANÁLISIS DE ESTABILIDAD POR PRODUCTO ---
    doc.addPage();
    currentY = 20;
    doc.setFontSize(16);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('ANÁLISIS DE ESTABILIDAD POR PRODUCTO', 14, currentY);
    currentY += 10;

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Ranking de productos según frecuencia de descuadres fuera de margen.', 14, currentY);
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
      head: [['Pos', 'Producto', 'Evaluaciones', 'Fuera de Margen', 'Estabilidad %', 'Impacto $', 'Estado']],
      body: analisisEstabilidad.slice(0, 30).map((p, i) => [
        i + 1,
        p.producto,
        p.totalInstancias,
        p.instanciasFueraMargen,
        `${Math.round(p.porcentajeFueraMargen)}%`,
        formatCurrency(p.impactoTotal),
        p.estado
      ]),
      theme: 'striped',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
                4: { halign: 'center', fontStyle: 'bold' },
        5: { halign: 'right' },
        6: { halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const val = data.cell.text[0];
          if (val === 'Estable') data.cell.styles.textColor = [39, 174, 96];
          else if (val === 'Inestable') data.cell.styles.textColor = [242, 201, 76];
          else if (val === 'Crítico') data.cell.styles.textColor = [235, 87, 87];
        }
      }
    });

    // --- PÁGINA 5: INFORME: AJUSTES POR MARGEN DE ERROR ---
    doc.addPage();
    currentY = 20;
    doc.setFontSize(16);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME: AJUSTES POR MARGEN DE ERROR', 14, currentY);
    currentY += 10;

    const allArticles = data.slice(0, 50);
    const adjustmentBody = allArticles.slice(0, 50).map(a => [
      a.articulo,
      a.subarticulo,
      a.totalDiferencia,
      a.margenError,
      formatCurrency(a.totalCobro),
      a.reglaAplicada
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Producto', 'Unidad', 'Dif', 'Margen', 'Ajuste (Cobro)', 'Regla']],
      body: adjustmentBody,
      theme: 'grid',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 7 },
    });

    // --- PÁGINA 5: CONCLUSIONES DEL SISTEMA ---
    doc.addPage();
    currentY = 20;
    doc.setFontSize(16);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCLUSIONES DEL SISTEMA', 14, currentY);
    currentY += 12;

    doc.setFontSize(11);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'normal');

    const interpretation = conf >= 85 
      ? "El sistema presenta un nivel alto de control de inventarios, con una confiabilidad general favorable."
      : conf >= 70 
      ? "El sistema presenta un nivel aceptable de control, aunque existen alertas que requieren seguimiento."
      : "El sistema presenta un nivel crítico de control de inventarios, con un alto volumen de diferencias que requieren intervención.";

    doc.setFont('helvetica', 'bold');
    doc.text(interpretation, 14, currentY);
    currentY += 12;

    const phrases = [
      `La confiabilidad general del inventario es del ${conf}%, lo que indica un nivel ${status.toLowerCase()} de control.`,
      `Se evaluaron ${summary.totalSedes} sedes en total.`,
      `La sede con mejor desempeño fue ${summary.sedeMasConfiable.toUpperCase()}.`,
      `La sede con menor confiabilidad fue ${summary.sedeMenosConfiable.toUpperCase()}.`,
      `Se detectaron ${summary.totalDiferencias} artículos con diferencias en inventario.`,
      `El impacto económico total asociado a estas diferencias fue de ${formatCurrency(summary.impactoEconomicoTotal)}.`
    ];

    doc.setFont('helvetica', 'normal');
    phrases.forEach(phrase => {
      const lines = doc.splitTextToSize(phrase, pageWidth - 28);
      doc.text(lines, 14, currentY);
      currentY += (lines.length * 7);
    });

    // --- PÁGINA 5: RECOMENDACIONES ---
    currentY += 15;
    if (currentY > 200) { doc.addPage(); currentY = 20; }
    
    doc.setFontSize(14);
    doc.setTextColor(31, 58, 95);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOMENDACIONES', 14, currentY);
    currentY += 10;

    const recommendations = [
      "Realizar auditorías inmediatas en las sedes con menor confiabilidad.",
      "Priorizar la revisión de los centros de costos con mayor impacto económico.",
      "Analizar las referencias con mayor frecuencia de diferencias para identificar patrones.",
      "Implementar un seguimiento periódico (semanal/quincenal) del indicador de confiabilidad.",
      "Reforzar la capacitación del personal en los procesos de registro y conteo."
    ];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    recommendations.forEach(rec => {
      const lines = doc.splitTextToSize(`• ${rec}`, pageWidth - 35);
      doc.text(lines, 18, currentY);
      currentY += (lines.length * 7);
    });

    addFooter(doc, pageWidth);
    doc.save(`Reporte_Gerencial_Confiabilidad_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = () => {
    // Basic implementation for Reliability Excel
    const workbook = XLSX.utils.book_new();
    
    const dataRows = summary.sedesStats.map(s => ({
      Sede: s.sede,
      Evaluados: s.articulosEvaluados,
      'Sin Diferencia': s.articulosSinDiferencia,
      'Con Diferencia': s.articulosConDiferencia,
      'Confiabilidad %': Math.round(s.confiabilidad),
      'Impacto Económico': s.impactoEconomico,
      Nivel: s.nivel
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Confiabilidad");

    const stabilityRows = analisisEstabilidad.map(p => ({
      Producto: p.producto,
      'Total Instancias': p.totalInstancias,
      'Instancias Fuera de Margen': p.instanciasFueraMargen,
      'Frecuencia Inestabilidad %': Math.round(p.porcentajeFueraMargen),
      'Impacto Total $': p.impactoTotal,
      Estado: p.estado
    }));

    const stabilitySheet = XLSX.utils.json_to_sheet(stabilityRows);
    XLSX.utils.book_append_sheet(workbook, stabilitySheet, "Estabilidad");

    XLSX.writeFile(workbook, `Reporte_Confiabilidad_y_Estabilidad_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-4">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 shadow-sm">
            <button
              onClick={() => setMainTab('operativo')}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${mainTab === 'operativo' ? 'bg-[#1F3A5F] text-white shadow-lg' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}
            >
              <Target className="w-4 h-4" />
              Dashboard Operativo
            </button>
            <button
              onClick={() => setMainTab('tecnico')}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${mainTab === 'tecnico' ? 'bg-[#1F3A5F] text-white shadow-lg' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Informe Técnico de Márgenes
            </button>
            <button
              onClick={() => setMainTab('estabilidad')}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${mainTab === 'estabilidad' ? 'bg-[#1F3A5F] text-white shadow-lg' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}
            >
              <Activity className="w-4 h-4" />
              Estabilidad de Productos
            </button>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-brand-text">
              {mainTab === 'operativo' ? reportTitle : mainTab === 'tecnico' ? 'Informe Técnico de Control de Inventarios' : 'Panel de Estabilidad de Productos'}
            </h2>
            <p className="text-brand-text-secondary">
              {mainTab === 'operativo' 
                ? `Indicador de precisión y consistencia del inventario por ${entityLabel.toLowerCase()}`
                : mainTab === 'tecnico'
                  ? 'Análisis detallado de variaciones, inventarios iniciales/finales y tolerancias por referencia'
                  : 'Análisis de volatilidad y frecuencia de descuadres fuera de margen por cada referencia'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {mainTab === 'operativo' && (
            <div className="bg-brand-bg p-1 rounded-[6px] flex mr-4 border border-[#D6DEE6]">
              <button
                onClick={() => setViewMode('sede')}
                className={`px-4 py-1.5 rounded-[4px] text-xs font-bold transition-all ${viewMode === 'sede' ? 'bg-[#2F80ED] text-white shadow-sm' : 'text-brand-text-secondary hover:text-brand-text'}`}
              >
                Por Sede
              </button>
              <button
                onClick={() => setViewMode('cc')}
                className={`px-4 py-1.5 rounded-[4px] text-xs font-bold transition-all ${viewMode === 'cc' ? 'bg-[#2F80ED] text-white shadow-sm' : 'text-brand-text-secondary hover:text-brand-text'}`}
              >
                Por CC
              </button>
            </div>
          )}
          <button 
            onClick={exportToExcel}
            className="flex items-center space-x-2 bg-white border border-[#D6DEE6] text-[#1F3A5F] px-4 py-2 rounded-[6px] text-sm font-bold hover:bg-slate-50 transition-all"
          >
            <FileDown className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
          <button 
            onClick={exportDashboardToPDF}
            className="flex items-center space-x-2 bg-[#2F80ED] text-white px-4 py-2 rounded-[6px] text-sm font-bold hover:bg-[#1C6DD0] transition-all shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {mainTab === 'operativo' && (
        <React.Fragment>
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

      {/* REPORTE FINANCIERO DE PÉRDIDAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-yellow-50 border border-yellow-100 p-6 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-yellow-100 p-3 rounded-full text-yellow-600 shadow-sm">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-yellow-600 uppercase tracking-widest">💸 Pérdida por margen</p>
              <p className="text-3xl font-black text-yellow-700">{formatCurrency(resumenFinanciero.totalPerdidaMargen)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-tighter">Dinero no cobrado por tolerancia</p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-rose-100 p-3 rounded-full text-rose-600 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">🚨 Dinero recuperable</p>
              <p className="text-3xl font-black text-rose-700">{formatCurrency(resumenFinanciero.totalRecuperable)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-tighter">Dinero que ya debería cobrarse</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[12px] border border-[#D6DEE6] border-l-4 border-[#27AE60] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-5 h-5 text-[#27AE60]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Confiables</span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad >= 85).length}</p>
          <p className="text-sm text-text-secondary mt-1">{entitiesLabel} con precisión alta</p>
        </div>
        <div className="bg-white p-6 rounded-[12px] border border-[#D6DEE6] border-l-4 border-[#F2C94C] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#F2C94C]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">En Alerta</span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad >= 70 && s.confiabilidad < 85).length}</p>
          <p className="text-sm text-text-secondary mt-1">{entitiesLabel} con descuadres medios</p>
        </div>
        <div className="bg-white p-6 rounded-[12px] border border-[#D6DEE6] border-l-4 border-[#EB5757] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-[#EB5757]" />
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Críticos</span>
          </div>
          <p className="text-3xl font-bold text-[#1F3A5F]">{summary.sedesStats.filter(s => s.confiabilidad < 70).length}</p>
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
            className="bg-white rounded-[12px] p-6 shadow-sm border border-[#D6DEE6] hover:shadow-md transition-all cursor-pointer group flex flex-col h-full"
          >
            {/* FILA SUPERIOR: Nombre (izq) */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="font-bold text-[#1F3A5F] group-hover:text-[#2F80ED] transition-colors text-lg line-clamp-2 leading-tight">
                  {sede.sede}
                </h4>
                {/* DEBAJO DEL NOMBRE: Etiqueta de estado */}
                <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider border ${getLevelColor(sede.nivel)}`}>
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
                <div className="bg-[#F5F7FA] p-3 rounded-[6px] border border-[#D6DEE6]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Artículos</p>
                  <p className="text-sm font-bold text-[#1F3A5F]">{sede.articulosEvaluados}</p>
                </div>
                <div className="bg-[#F5F7FA] p-3 rounded-[6px] border border-[#D6DEE6]">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diferencias</p>
                  <p className="text-sm font-bold text-[#1F3A5F]">{sede.articulosConDiferencia}</p>
                </div>
                <div className="col-span-2 bg-rose-50/50 p-3 rounded-[6px] border border-rose-100/50">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Impacto Económico</p>
                  <p className="text-lg font-bold text-rose-600 leading-none mt-1">{formatCurrency(sede.impactoEconomico)}</p>
                </div>
              </div>
            </div>

            {/* Link: Ver detalle completo */}
            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-[#2F80ED] font-bold text-xs group-hover:translate-x-1 transition-transform">
              <span>Ver detalle completo</span>
              <ArrowRight className="w-4 h-4" />
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
                <th className="p-4 bg-[#A7C4E0] border border-[#D6DEE6] text-left text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest sticky left-0 z-10 min-w-[180px]">
                  Sede / Centro
                </th>
                {heatmapData.ccs.map(cc => (
                  <th key={cc} className="p-4 bg-[#A7C4E0] border border-[#D6DEE6] text-center text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest min-w-[120px]">
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
              <tr className="bg-[#A7C4E0]">
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Pos</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">{entityLabel}</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Confiabilidad %</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Evaluados</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Sin Dif.</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-center">Con Dif.</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Variación</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest text-right">Impacto $</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest">Nivel</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#1F3A5F] uppercase tracking-widest"></th>
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
    </React.Fragment>
      )}

      {mainTab === 'tecnico' && (
        /* INFORME INDEPENDIENTE DE MARGEN DE ERROR (TECHNICAL VIEW) */
        <div className="space-y-8 pb-20">
          {/* Technical KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#1F3A5F] p-6 rounded-2xl text-white shadow-xl overflow-hidden relative group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">Referencias Evaluadas</p>
              <p className="text-4xl font-black">{data.length}</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white w-full" />
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-slate-400">Confiabilidad Técnica Alta</p>
              <p className="text-4xl font-black text-[#27AE60]">{data.filter(a => a.confiabilidadTecnica === 'ALTA').length}</p>
              <p className="text-xs text-slate-500 mt-2">Referencias con ajuste &lt; 2%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-slate-400">Confiabilidad Técnica Media</p>
              <p className="text-4xl font-black text-[#F2C94C]">{data.filter(a => a.confiabilidadTecnica === 'MEDIA').length}</p>
              <p className="text-xs text-slate-500 mt-2">Referencias con ajuste 2% - 10%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-slate-400">Referencias Críticas (Baja)</p>
              <p className="text-4xl font-black text-[#EB5757]">{data.filter(a => a.confiabilidadTecnica === 'BAJA').length}</p>
              <p className="text-xs text-slate-500 mt-2">Referencias con ajuste &gt; 10%</p>
            </div>
          </div>

          {/* Technical Data Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-[#1F3A5F] p-2 rounded-lg text-white">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-tight">Control de Inventario y Tolerancia</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Análisis detallado de variaciones técnicas y márgenes aplicados</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Producto / Sede / CC</th>
                    <th className="px-4 py-4 text-right">Inv. Inicial</th>
                    <th className="px-4 py-4 text-right">Variación</th>
                    <th className="px-4 py-4 text-right">Inv. Final</th>
                    <th className="px-4 py-4 text-right">Tolerancia</th>
                    <th className="px-4 py-4 text-center">Estado Técnico</th>
                    <th className="px-4 py-4 text-center">Confiabilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.slice(0, 100).map((a, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-[#1F3A5F] group-hover:text-blue-600 transition-colors uppercase tracking-tight">{a.articulo}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{a.sede}</span>
                          <span className="text-[9px] font-black bg-blue-50 text-[#2F80ED] px-1.5 py-0.5 rounded uppercase">{a.cc}</span>
                          <span className="text-[9px] font-medium text-slate-400 uppercase italic leading-none">{a.subarticulo}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs text-slate-500">
                        {formatVariation(a.stockEsperado, a.subarticulo)}
                      </td>
                      <td className={`px-4 py-4 text-right font-mono text-xs font-bold ${a.totalDiferencia < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {a.totalDiferencia > 0 ? '+' : ''}{formatVariation(a.totalDiferencia, a.subarticulo)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs text-[#1F3A5F] font-bold underline decoration-slate-200 underline-offset-4">
                        {formatVariation(a.stockFisico, a.subarticulo)}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-xs text-indigo-500">
                        {formatVariation(a.margenError, a.subarticulo)}
                        <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mt-1">{a.reglaAplicada}</p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${a.dentroDeTolerancia ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                          {a.dentroDeTolerancia ? 'DENTRO DE MARGEN' : 'EXCEDE TOLERANCIA'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2 py-1 rounded-[4px] text-[10px] font-black uppercase tracking-tighter shadow-sm ${
                          a.confiabilidadTecnica === 'ALTA' ? 'bg-[#27AE60] text-white' : 
                          a.confiabilidadTecnica === 'MEDIA' ? 'bg-[#F2C94C] text-slate-800' : 
                          'bg-[#EB5757] text-white'
                        }`}>
                          {a.confiabilidadTecnica}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.length > 100 && (
                <div className="p-4 bg-slate-50 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 italic">
                  Mostrando las primeras 100 de {data.length} referencias totales.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mainTab === 'estabilidad' && (
        <div className="space-y-8 pb-20">
          {/* Stability KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Productos Estables</p>
                <p className="text-2xl font-black text-slate-800">{analisisEstabilidad.filter(p => p.estado === 'Estable').length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="bg-amber-100 p-3 rounded-xl text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Productos Inestables</p>
                <p className="text-2xl font-black text-slate-800">{analisisEstabilidad.filter(p => p.estado === 'Inestable').length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="bg-rose-100 p-3 rounded-xl text-rose-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Productos Críticos</p>
                <p className="text-2xl font-black text-slate-800">{analisisEstabilidad.filter(p => p.estado === 'Crítico').length}</p>
              </div>
            </div>
            <div className="bg-[#1F3A5F] p-6 rounded-2xl text-white shadow-xl flex items-center gap-4 overflow-hidden relative group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
              <div className="bg-white/10 p-3 rounded-xl z-10">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div className="z-10">
                <p className="text-[10px] font-black uppercase tracking-wider opacity-60">Impacto Total Riesgo</p>
                <p className="text-xl font-black">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(analisisEstabilidad.reduce((acc, p) => acc + p.impactoTotal, 0))}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart Card */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-tight">Frecuencia de Inestabilidad (%)</h3>
                </div>
              </div>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analisisEstabilidad.slice(0, 15)} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis 
                      dataKey="producto" 
                      type="category" 
                      width={120} 
                      axisLine={false} 
                      tickLine={false} 
                      style={{ fontSize: '10px', fontWeight: 700, fill: '#64748b' }} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          const impactStr = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(item.impactoTotal);
                          return (
                            <div className="bg-[#1F3A5F] p-4 rounded-xl shadow-2xl text-white border border-white/10">
                              <p className="text-xs font-black uppercase mb-1">{item.producto}</p>
                              <p className="text-2xl font-black">{Math.round(item.porcentajeFueraMargen)}% <span className="text-[10px] font-bold opacity-60">Fuera de Margen</span></p>
                              <p className="text-[10px] font-bold mt-2 opacity-80">Impacto: {impactStr}</p>
                              <p className="text-[10px] font-bold opacity-60">Evaluado en {item.totalInstancias} sedes/CCs</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="porcentajeFueraMargen" radius={[0, 4, 4, 0]} barSize={20}>
                      {analisisEstabilidad.slice(0, 15).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.porcentajeFueraMargen > 60 ? '#EB5757' : entry.porcentajeFueraMargen > 30 ? '#F2C94C' : '#27AE60'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ranking Card */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-800 uppercase tracking-tight">Ranking de Criticidad</h3>
                </div>
                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-widest">Top 20 Referencias</span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {analisisEstabilidad.slice(0, 20).map((item, i) => (
                  <div 
                    key={i} 
                    onClick={() => setSelectedProduct(item)}
                    className="flex items-center justify-between p-4 rounded-xl border border-slate-50 hover:border-slate-100 hover:bg-slate-50/50 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${
                        item.estado === 'Crítico' ? 'bg-rose-100 text-rose-600' : 
                        item.estado === 'Inestable' ? 'bg-amber-100 text-amber-600' : 
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700 uppercase leading-none">{item.producto}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                          {item.totalInstancias} EVALUACIONES • {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(item.impactoTotal)} IMPACTO
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-black ${
                        item.estado === 'Crítico' ? 'text-rose-600' : 
                        item.estado === 'Inestable' ? 'text-amber-500' : 
                        'text-emerald-600'
                      }`}>
                        {Math.round(item.porcentajeFueraMargen)}%
                      </p>
                      <p className="text-[9px] font-black text-slate-300 uppercase leading-none">Descuadre</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[12px] shadow-2xl overflow-hidden flex flex-col border border-[#D6DEE6]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-[#D6DEE6] flex items-center justify-between bg-[#F5F7FA]">
                <div>
                  <h3 className="text-xl font-bold text-[#1F3A5F]">Detalle de Confiabilidad - {selectedSede.sede}</h3>
                  {selectedCCFilter && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Filtrado por:</span>
                      <span className="bg-blue-50 text-[#2F80ED] px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase border border-blue-100">
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
                  <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider border ${getLevelColor(selectedSede.nivel)}`}>
                    <span className="mr-1">{getSemaphoreEmoji(selectedSede.confiabilidad)}</span>
                    Estado {selectedSede.nivel}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-white p-1 rounded-[6px] border border-[#D6DEE6]">
                    <button 
                      onClick={() => downloadGeneralPDF(selectedSede)}
                      className="flex items-center space-x-2 px-3 py-1.5 rounded-[4px] text-[10px] font-bold text-[#1F3A5F] hover:bg-slate-50 transition-all border-r border-[#D6DEE6]"
                      title="Reporte General"
                    >
                      <FileText className="w-3 h-3" />
                      <span>General</span>
                    </button>
                    <button 
                      onClick={() => downloadLossesPDF(selectedSede)}
                      className="flex items-center space-x-2 px-3 py-1.5 rounded-[4px] text-[10px] font-bold text-[#EB5757] hover:bg-rose-50 transition-all border-r border-[#D6DEE6]"
                      title="Top Pérdidas"
                    >
                      <TrendingDown className="w-3 h-3" />
                      <span>Pérdidas</span>
                    </button>
                    <button 
                      onClick={() => downloadGainsPDF(selectedSede)}
                      className="flex items-center space-x-2 px-3 py-1.5 rounded-[4px] text-[10px] font-bold text-[#27AE60] hover:bg-emerald-50 transition-all border-r border-[#D6DEE6]"
                      title="Top Ganancias"
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>Ganancias</span>
                    </button>
                    <button 
                      onClick={() => downloadProblematicPDF(selectedSede)}
                      className="flex items-center space-x-2 px-3 py-1.5 rounded-[4px] text-[10px] font-bold text-[#2F80ED] hover:bg-blue-50 transition-all"
                      title="Riesgo Operativo"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      <span>Riesgo</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedSede(null);
                      setSelectedCCFilter(null);
                      setModalFilter('Todos');
                      setShowOnlyFaltantes(false);
                    }}
                    className="p-2 hover:bg-white rounded-[6px] text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-[#D6DEE6]"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#F5F7FA] p-4 rounded-[8px] border border-[#D6DEE6]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confiabilidad</p>
                    <p className="text-2xl font-bold text-[#1F3A5F]">{Math.round(selectedSede.confiabilidad)}%</p>
                  </div>
                  <div className="bg-[#F5F7FA] p-4 rounded-[8px] border border-[#D6DEE6]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Evaluados</p>
                    <p className="text-2xl font-bold text-[#1F3A5F]">{selectedSede.articulosEvaluados}</p>
                  </div>
                  <div className="bg-[#F5F7FA] p-4 rounded-[8px] border border-[#D6DEE6]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sin Diferencia</p>
                    <p className="text-2xl font-bold text-[#27AE60]">{selectedSede.articulosSinDiferencia}</p>
                  </div>
                  <div className="bg-[#F5F7FA] p-4 rounded-[8px] border border-[#D6DEE6]">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Con Diferencia</p>
                    <p className="text-2xl font-bold text-[#EB5757]">{selectedSede.articulosConDiferencia}</p>
                  </div>
                </div>

                {/* Modal Tabs & Filters */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#F5F7FA] p-4 rounded-[8px] border border-[#D6DEE6]">
                  <div className="flex bg-white p-1 rounded-[8px] border border-[#D6DEE6] shadow-sm">
                    <button
                      onClick={() => setModalTab('operacion')}
                      className={`px-4 py-2 rounded-[6px] text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${modalTab === 'operacion' ? 'bg-[#1F3A5F] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Auditoría Operativa
                    </button>
                    <button
                      onClick={() => setModalTab('tecnico')}
                      className={`px-4 py-2 rounded-[6px] text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${modalTab === 'tecnico' ? 'bg-[#1F3A5F] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Control Técnico
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <div className="flex bg-white p-1 rounded-[6px] border border-[#D6DEE6]">
                      {(['Todos', 'Faltantes', 'Sobrantes', 'Sin diferencia'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setModalFilter(f)}
                          className={`px-3 py-1 rounded-[4px] text-xs font-bold transition-all ${modalFilter === f ? 'bg-[#2F80ED] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tables Section */}
                <div className="space-y-4">
                  {modalTab === 'operacion' ? (
                    <React.Fragment>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center">
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Listado de Referencias - Auditoría
                        </h4>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                          Referencias: {filteredItems.length}
                        </span>
                      </div>
                      
                      <div className="overflow-hidden rounded-[8px] border border-[#D6DEE6] shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#A7C4E0] text-[#1F3A5F]">
                            <tr>
                              <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">ARTÍCULO</th>
                              <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">UNIDAD</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">DIF</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">MARGEN</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">PÉRDIDA $</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">RECUPERABLE $</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">REGLA APLICADA</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#D6DEE6]">
                            {filteredItems.map((a, i) => (
                              <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-[#F0F4F8]'} hover:bg-[#E5EDF5] transition-colors`}>
                                <td className="px-6 py-3 font-bold text-[#1F3A5F]">{a.articulo}</td>
                                <td className="px-6 py-3 text-slate-500 text-[10px] font-bold">{a.subarticulo}</td>
                                <td className={`px-4 py-3 text-right font-bold ${a.totalDiferencia < 0 ? 'text-[#EB5757]' : a.totalDiferencia > 0 ? 'text-[#27AE60]' : 'text-slate-400'}`}>
                                  {a.totalDiferencia > 0 ? '+' : ''}{formatVariation(a.totalDiferencia, a.subarticulo)}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-500 text-[10px] font-medium">
                                  {formatVariation(a.margenError, a.subarticulo)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-amber-600">
                                  {a.perdidaPorMargen > 0 ? formatCurrency(a.perdidaPorMargen) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-rose-600">
                                  {a.dineroRecuperable > 0 ? formatCurrency(a.dineroRecuperable) : '-'}
                                </td>
                                <td className="px-4 py-3 text-[9px] text-slate-400 font-bold italic uppercase">
                                  {a.reglaAplicada}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center">
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Informe Técnico de Margen de Error
                        </h4>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                          Referencias: {filteredItems.length}
                        </span>
                      </div>
                      
                      <div className="overflow-hidden rounded-[8px] border border-[#D6DEE6] shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#1F3A5F] text-white">
                            <tr>
                              <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">ARTÍCULO</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">INV. INICIAL</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">VARIACIÓN</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">INV. FINAL</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">MARGEN</th>
                              <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-center">ESTADO</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#D6DEE6]">
                            {filteredItems.map((a, i) => (
                              <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50 transition-colors`}>
                                <td className="px-6 py-3 font-bold text-[#1F3A5F]">
                                  {a.articulo}
                                  <div className="text-[9px] text-slate-400 uppercase leading-none mt-0.5">{a.subarticulo}</div>
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-slate-600">
                                  {formatVariation(a.stockEsperado, a.subarticulo)}
                                </td>
                                <td className={`px-4 py-3 text-right font-black ${a.totalDiferencia < 0 ? 'text-[#EB5757]' : a.totalDiferencia > 0 ? 'text-[#27AE60]' : 'text-slate-400'}`}>
                                  {a.totalDiferencia > 0 ? '+' : ''}{formatVariation(a.totalDiferencia, a.subarticulo)}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-[#1F3A5F]">
                                  {formatVariation(a.stockFisico, a.subarticulo)}
                                </td>
                                <td className="px-4 py-3 text-right text-indigo-600 font-bold">
                                  {formatVariation(a.margenError, a.subarticulo)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${a.dentroDeTolerancia ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                    {a.dentroDeTolerancia ? 'DENTRO DE MARGEN' : 'EXCEDE TOLERANCIA'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </React.Fragment>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-[#F5F7FA] border-t border-[#D6DEE6] flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Impacto Total {entityLabel}</p>
                    <p className="text-2xl font-bold text-[#EB5757]">{formatCurrency(selectedSede.impactoEconomico)}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedSede(null);
                    setModalFilter('Todos');
                    setShowOnlyFaltantes(false);
                  }}
                  className="bg-[#1F3A5F] text-white px-6 py-2 rounded-[6px] text-sm font-bold hover:bg-[#2F80ED] transition-all"
                >
                  Cerrar Detalle
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              layoutId={selectedProduct.producto}
              className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[12px] shadow-2xl overflow-hidden flex flex-col border border-[#D6DEE6]"
            >
              <div className="p-6 border-b border-[#D6DEE6] flex items-center justify-between bg-[#F5F7FA]">
                <div>
                  <h3 className="text-xl font-bold text-[#1F3A5F]">Trazabilidad de Producto: {selectedProduct.producto}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Nivel de Estabilidad: 
                      <span className={`ml-2 px-2 py-0.5 rounded-[4px] text-white ${
                        selectedProduct.estado === 'Crítico' ? 'bg-rose-500' : 
                        selectedProduct.estado === 'Inestable' ? 'bg-amber-500' : 
                        'bg-emerald-500'
                      }`}>
                        {selectedProduct.estado}
                      </span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Impacto Total: {formatCurrency(selectedProduct.impactoTotal)}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="bg-white rounded-[8px] border border-[#D6DEE6] shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#1F3A5F] text-white">
                      <tr>
                        <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Sede / Centro de Costo</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Variación</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Ajuste Cobro</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-right">Impacto $</th>
                        <th className="px-4 py-3 font-bold uppercase tracking-wider text-[10px] text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D6DEE6]">
                      {data.filter(a => a.articulo === selectedProduct.producto).map((a, i) => (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-100 transition-colors`}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-[#1F3A5F]">{a.sede}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">{a.cc || 'SIN CC'}</div>
                          </td>
                          <td className={`px-4 py-4 text-right font-mono text-xs ${a.totalDiferencia < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {a.totalDiferencia > 0 ? '+' : ''}{formatVariation(a.totalDiferencia, a.subarticulo)}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-xs text-indigo-600">
                            {formatVariation(a.ajusteCobro, a.subarticulo)}
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-slate-700">
                            {formatCurrency(Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio))}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${a.dentroDeTolerancia ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                              {a.dentroDeTolerancia ? 'ESTABLE' : 'INCONSISTENTE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 bg-[#F5F7FA] border-t border-[#D6DEE6] flex justify-end">
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="bg-[#1F3A5F] text-white px-6 py-2 rounded-[6px] text-sm font-bold hover:bg-[#2F80ED] transition-all"
                >
                  Cerrar Trazabilidad
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
