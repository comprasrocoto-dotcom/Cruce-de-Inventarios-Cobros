/**
 * Botones de exportación. Genera salidas (Excel/CSV) del conjunto de artículos
 * actualmente filtrado para su descarga, agrupando y formateando los datos.
 */
import React from 'react';
import { FileDown, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
// jspdf-autotable v5: se usa la función importada (el parche de prototipo
// `doc.autoTable` del v3 ya no existe; por eso el PDF "no generaba nada").
import autoTable from 'jspdf-autotable';
import { agruparCobrablesParaReporte } from '../utils/agrupacion';
import { RecetasPayload } from '../utils/recetas';

export type VarianteReporte = 'jerarquico' | 'agrupado';

/** "RECETA SUB004 · SUB. ACEITE DE ACHIOTE" -> "SUB. ACEITE DE ACHIOTE" */
const nombreSubDe = (g: { etiqueta: string }) => {
  const partes = g.etiqueta.split('·');
  return (partes[partes.length - 1] || g.etiqueta).trim();
};

/** "RECETA SUB004 · ..." -> "SUB004" (autosuficiente: no depende de metadatos). */
const codigoRecetaDe = (g: { etiqueta: string; recetaCodigo?: string }) => {
  if (g.recetaCodigo) return g.recetaCodigo;
  const m = /^RECETA\s+(\S+)/.exec(g.etiqueta);
  return m ? m[1] : '';
};
import { ArticleSummary } from '../types';
import { format, startOfMonth, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExportButtonsProps {
  data: ArticleSummary[];
  onlyCobrables?: boolean;
  /** Etiqueta de la política de cobro activa (queda en el encabezado del Excel). */
  politicaLabel?: string;
  /**
   * 'jerarquico' (por defecto): reporte clásico por fechas.
   * 'agrupado': mismos encabezados, pero los artículos ORDENADOS por grupo
   * (recetas primero, luego semejanza de nombre) — plano en Excel, con
   * separadores de grupo en el PDF.
   */
  variante?: VarianteReporte;
  /** Catálogo de recetas (RecetasAPI) para la agrupación por recetas. */
  recetasPayload?: RecetasPayload | null;
}

/**
 * Construye el libro de cobros (una hoja por sede). EXPORTADO para poder
 * probarlo con datos reales sin pasar por el DOM — estos reportes ya nos
 * fallaron dos veces en silencio.
 */
export function construirLibroCobros(
  data: ArticleSummary[],
  politicaLabel?: string,
  variante: VarianteReporte = 'jerarquico',
  recetasPayload?: RecetasPayload | null
): XLSX.WorkBook {
  {
    const workbook = XLSX.utils.book_new();

    // 1. Identify all unique dates (normalized to start of day) and group them by month
    const allMovements = data.flatMap((a) => a.movements);
    const uniqueDates = (
      Array.from(new Set(allMovements.map((m) => startOfDay(m.fecha).getTime()))) as number[]
    )
      .sort((a, b) => a - b)
      .map((t) => new Date(t));

    const monthsMap = new Map<string, Date[]>();
    uniqueDates.forEach((date) => {
      const monthKey = format(startOfMonth(date), 'MMMM yyyy', { locale: es });
      if (!monthsMap.has(monthKey)) monthsMap.set(monthKey, []);
      monthsMap.get(monthKey)!.push(date);
    });

    const sortedMonths = Array.from(monthsMap.keys());

    // Group by Sede
    const sedes = Array.from(new Set(data.map((a) => a.sede))) as string[];

    sedes.forEach((sedeName) => {
      // TODOS los artículos de la sede (recetas SUB. incluidas), no solo los
      // cobrables: el Excel es el reporte COMPLETO del corte (pedido del
      // negocio 04/07/2026). El PDF sí sigue siendo solo de cobros.
      // En la variante 'agrupado' se ordenan por grupos: cada RECETA encabeza
      // y debajo sus ingredientes; al final, semejanza de nombre y solos.
      let sedeArticles = data.filter((a) => a.sede === sedeName);
      let gruposSede: ReturnType<typeof agruparCobrablesParaReporte> | null = null;
      if (variante === 'agrupado') {
        gruposSede = agruparCobrablesParaReporte(sedeArticles, recetasPayload);
        sedeArticles = gruposSede.flatMap((g) => g.articulos);
      }
      if (sedeArticles.length === 0) return;

      const rows: any[][] = [];
      const merges: XLSX.Range[] = [];

      // --- HEADER SECTION (banner dinámico) ---
      rows.push(['REPORTE DE COBROS POR AJUSTES DE INVENTARIO']);
      rows.push([`Sede / Almacén: ${sedeName}`]);
      rows.push([`Fecha de generación: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`]);
      if (politicaLabel) rows.push([`Política de cobro: ${politicaLabel}`]);
      const bannerRows = rows.length; // cuántas filas de banner hay (3 o 4)
      rows.push([]); // Spacer
      // Fila donde comienzan los ENCABEZADOS de la tabla. Antes estaba
      // cableada en 4/5 y al insertar la fila de política todo se corría:
      // los merges caían sobre filas equivocadas y "desaparecían" encabezados.
      const rTH = rows.length;

      // --- DYNAMIC TABLE HEADERS (Rows 4-5) ---
      const row4: any[] = ['Artículo', 'Unidad'];
      const row5: any[] = ['', ''];

      let currentCol = 2;

      sortedMonths.forEach((monthKey) => {
        const dates = monthsMap.get(monthKey)!;
        const monthName = format(dates[0], 'MMM', { locale: es }).replace('.', '');

        // Month Header (Level 1)
        row4.push(monthName);
        // Fill row4 with empty strings for the merge
        for (let i = 0; i < dates.length; i++) {
          if (i > 0) row4.push('');
        }

        // Dates (Level 2)
        dates.forEach((date) => {
          row5.push(format(date, 'd-MMM', { locale: es }).replace('.', ''));
        });

        // Monthly Total Column
        const totalLabel = `Total ${monthName}`;
        row4.push(''); // Part of the merge
        row5.push(totalLabel);

        // Merge month header across dates + total column
        merges.push({
          s: { r: rTH, c: currentCol },
          e: { r: rTH, c: currentCol + dates.length },
        });

        currentCol += dates.length + 1;
      });

      // Final Static Columns
      row4.push('Total General', 'Coste Línea', 'Total Cobro');
      row5.push('', '', '');

      // Merge static headers vertically
      merges.push({ s: { r: rTH, c: 0 }, e: { r: rTH + 1, c: 0 } }); // Artículo
      merges.push({ s: { r: rTH, c: 1 }, e: { r: rTH + 1, c: 1 } }); // Unidad
      merges.push({ s: { r: rTH, c: currentCol }, e: { r: rTH + 1, c: currentCol } }); // Total General
      merges.push({ s: { r: rTH, c: currentCol + 1 }, e: { r: rTH + 1, c: currentCol + 1 } }); // Coste Línea
      merges.push({ s: { r: rTH, c: currentCol + 2 }, e: { r: rTH + 1, c: currentCol + 2 } }); // Total Cobro

      rows.push(row4);
      rows.push(row5);

      // --- DATA ROWS ---
      /**
       * La RECETA siempre encabeza su grupo (como en el PDF, donde es el
       * separador). Si el artículo SUB. de la receta NO existe en el
       * inventario de esta sede, se sintetiza su primera línea con la
       * información del registro de recetas (nombre, código y unidad); las
       * columnas de fechas/totales quedan vacías porque no hubo movimientos.
       */
      const pushFilaRecetaSintetica = (etiqueta: string, unidad: string) => {
        const fila: any[] = [etiqueta, unidad];
        while (fila.length < row4.length) fila.push('');
        rows.push(fila);
      };

      const pushArticleRow = (art: ArticleSummary) => {
        const dateValues = new Map<number, number>();
        art.movements.forEach((m) => {
          const t = startOfDay(m.fecha).getTime();
          dateValues.set(t, (dateValues.get(t) || 0) + m.variacion);
        });

        const row: any[] = [art.articulo, art.subarticulo];
        let pivotTotal = 0;

        sortedMonths.forEach((monthKey) => {
          const dates = monthsMap.get(monthKey)!;
          let monthSum = 0;

          dates.forEach((date) => {
            const val = dateValues.get(startOfDay(date).getTime()) || 0;
            row.push(val);
            monthSum += val;
            pivotTotal += val;
          });

          row.push(monthSum);
        });

        // Validation Log as requested
        if (Math.abs(pivotTotal - art.totalDiferencia) > 0.000001) {
          console.warn(`Discrepancia detectada en ${art.articulo}:`, {
            rawTotal: art.totalDiferencia,
            pivotTotal: pivotTotal,
            diff: art.totalDiferencia - pivotTotal,
          });
        }

        // Montos alineados con el MOTOR de la app: costo mediano (robusto a
        // costos dañados del ERP) y el cobro de la POLÍTICA activa — antes el
        // Excel recalculaba por su cuenta y podía discrepar de la pantalla.
        const costToUse = art.costeMediano || art.ultimoCoste || art.costePromedio || 0;
        row.push(art.totalDiferencia, costToUse, art.totalCobro);
        rows.push(row);
      };

      if (variante === 'agrupado' && gruposSede) {
        gruposSede.forEach((g) => {
          if (g.tipo === 'RECETA') {
            // Presencia verificada AQUÍ mismo por Cód. Barras (autosuficiente:
            // no confía en banderas externas — un deploy a medias produjo
            // sintéticas duplicadas con "()" vacío el 05/07/2026).
            const codigo = codigoRecetaDe(g);
            const subPresente =
              codigo !== '' &&
              g.articulos.some(
                (a) =>
                  String(a.codBarras || '')
                    .trim()
                    .toUpperCase() === codigo
              );
            if (!subPresente) {
              const unidad =
                g.recetaUnidad ||
                recetasPayload?.recetas.find(
                  (r) =>
                    String(r.codigo || '')
                      .trim()
                      .toUpperCase() === codigo
                )?.unidad ||
                '';
              const sufijo = codigo ? ` (${codigo})` : '';
              pushFilaRecetaSintetica(`${nombreSubDe(g)}${sufijo}`, String(unidad));
            }
          }
          g.articulos.forEach(pushArticleRow);
        });
      } else {
        sedeArticles.forEach(pushArticleRow);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // --- STYLING & CONFIGURATION ---
      // Banner: una fusión por cada fila del banner (3 o 4 según política)
      for (let b = 0; b < bannerRows; b++) {
        merges.push({ s: { r: b, c: 0 }, e: { r: b, c: row4.length - 1 } });
      }

      worksheet['!merges'] = merges;

      // Auto-width
      const wscols = row4.map((_, i) => {
        let maxLen = 10;
        rows.slice(rTH).forEach((r) => {
          const val = r[i]?.toString() || '';
          if (val.length > maxLen) maxLen = val.length;
        });
        return { wch: Math.min(maxLen + 2, 50) };
      });
      worksheet['!cols'] = wscols;

      const safeSheetName = sedeName.replace(/[\\/?*[\]]/g, '').substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    });

    return workbook;
  }
}

/** Construye el documento PDF de cobros. EXPORTADO por la misma razón. */
export function construirPDFCobros(
  data: ArticleSummary[],
  politicaLabel?: string,
  variante: VarianteReporte = 'jerarquico',
  recetasPayload?: RecetasPayload | null
): jsPDF | null {
  {
    const doc = new jsPDF('l', 'mm', 'a4');
    const filteredData = data.filter((a) => a.debeCobrar);

    if (filteredData.length === 0) return null;

    doc.setFontSize(18);
    doc.text(
      variante === 'agrupado'
        ? 'Reporte de Cobros Agrupado (recetas y semejanza)'
        : 'Reporte Final de Cobros por Sede',
      14,
      22
    );

    doc.setFontSize(9);
    doc.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 29);
    if (politicaLabel) doc.text(`Política de cobro: ${politicaLabel}`, 14, 34);

    const fmtCOP = (n: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(n);
    const filaDe = (a: ArticleSummary) => [
      a.sede,
      a.articulo,
      a.subarticulo,
      (a.variacionUltimoCiclo ?? a.totalDiferencia).toLocaleString('es-CO'),
      a.requiereRevision ? 'REVISAR' : 'COBRA',
      fmtCOP(a.costeMediano || a.ultimoCoste || a.costePromedio || 0),
      fmtCOP(a.totalCobro),
    ];

    let tableData: any[] = [];
    if (variante === 'agrupado') {
      // Agrupación por sede: separador de grupo (fila fusionada) + artículos.
      const sedes = Array.from(new Set(filteredData.map((a) => a.sede)));
      sedes.forEach((sede) => {
        const grupos = agruparCobrablesParaReporte(
          filteredData.filter((a) => a.sede === sede),
          recetasPayload
        );
        grupos.forEach((g) => {
          tableData.push([
            {
              content: `${sede}  ·  ${g.etiqueta}  ·  ${g.articulos.length} art. — ${fmtCOP(g.totalCobro)}`,
              colSpan: 7,
              styles: {
                fillColor: g.tipo === 'RECETA' ? [10, 42, 61] : [40, 40, 48],
                textColor: [251, 197, 25],
                fontStyle: 'bold',
              },
            },
          ]);
          g.articulos.forEach((a) => tableData.push(filaDe(a)));
        });
      });
    } else {
      tableData = filteredData.map(filaDe);
    }

    autoTable(doc, {
      startY: politicaLabel ? 38 : 35,
      head: [
        ['Sede', 'Artículo', 'Unidad', 'Dif. Neta Horizonte', 'Estado', 'Costo', 'Total Cobro'],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [31, 58, 95] },
      styles: { fontSize: 8 },
      columnStyles: {
        3: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    });

    return doc;
  }
}

export const ExportButtons = ({
  data,
  onlyCobrables = false,
  politicaLabel,
  variante = 'jerarquico',
  recetasPayload,
}: ExportButtonsProps) => {
  void onlyCobrables;
  const exportToExcel = () => {
    const wb = construirLibroCobros(data, politicaLabel, variante, recetasPayload);
    if (wb.SheetNames.length === 0) {
      alert('No hay datos de cobros para exportar.');
      return;
    }
    XLSX.writeFile(
      wb,
      `Reporte_Cobros_${variante === 'agrupado' ? 'Agrupado' : 'Jerarquico'}_${format(new Date(), 'yyyyMMdd')}.xlsx`
    );
  };
  const exportToPDF = () => {
    const doc = construirPDFCobros(data, politicaLabel, variante, recetasPayload);
    if (!doc) {
      alert('No hay datos de cobros para exportar.');
      return;
    }
    doc.save(variante === 'agrupado' ? 'Reporte_Cobros_Agrupado.pdf' : 'Reporte_Cobros.pdf');
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        onClick={exportToExcel}
        className="flex items-center space-x-2 bg-[#27AE60] hover:bg-[#1E8449] text-white px-4 py-2 rounded-[6px] text-sm font-bold transition-all shadow-sm"
      >
        <FileDown className="w-4 h-4" />
        <span>{variante === 'agrupado' ? 'Excel Cobros Agrupado' : 'Excel Jerárquico'}</span>
      </button>
      <button
        onClick={exportToPDF}
        className="flex items-center space-x-2 bg-[#EB5757] hover:bg-[#C0392B] text-white px-4 py-2 rounded-[6px] text-sm font-bold transition-all shadow-sm"
      >
        <FileText className="w-4 h-4" />
        <span>{variante === 'agrupado' ? 'PDF Cobros Agrupado' : 'PDF Cobros'}</span>
      </button>
    </div>
  );
};
