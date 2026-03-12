import { RawInventoryRow, ArticleSummary, SedeSummary, DashboardStats, InventoryMovement, ReliabilitySummary, ReliabilityStats, HistoricalPeriodStats, HistoricalTraceabilityData } from '../types';
import { parse, isValid, format, startOfMonth, startOfWeek, startOfDay, isWithinInterval, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const EXACT_MOJIBAKE_MAP: Record<string, string> = {
  "Fecha Doc": "fecha",
  "Serie / NÃºmero": "serie",
  "AlmacÃ©n": "sede",
  "CC": "cc",
  "Subfamilia": "subfamilia",
  "ArtÃculo": "articulo",
  "CÃ³d. Barras": "codBarras",
  "SubartÃculo": "subarticulo",
  "Coste LÃnea": "costeLinea",
  "Stock a Fecha": "stockFecha",
  "VariaciÃ³n Stock": "variacion",
  "Stock Inventario": "stockInventario"
};

const INDEX_FALLBACK: Record<number, string> = {
  0: "fecha",
  1: "serie",
  2: "sede",
  3: "cc",
  4: "subfamilia",
  5: "articulo",
  6: "codBarras",
  7: "subarticulo",
  8: "costeLinea",
  9: "stockFecha",
  10: "variacion",
  11: "stockInventario"
};

const ALIASES: Record<string, string[]> = {
  "fecha": ["fecha doc", "fecha", "fecha documento"],
  "sede": ["almacen", "bodega", "sede", "almacen"],
  "articulo": ["articulo", "producto", "item", "insumo"],
  "subarticulo": ["subarticulo", "unidad", "unidad de medida", "medida", "u m", "um"],
  "costeLinea": ["coste linea", "costo linea", "coste", "costo", "valor costo"],
  "variacion": ["variacion stock", "variacion", "ajuste", "ajuste stock", "diferencia stock", "movimiento stock"],
  "subfamilia": ["subfamilia", "familia"],
  "stockFecha": ["stock a fecha", "stock fecha"],
  "stockInventario": ["stock inventario", "inventario"],
  "codBarras": ["cod barras", "codigo barras", "cod.", "barras"]
};

function normalizeHeader(header: string): string {
  if (!header) return "";
  let str = header.toString();
  
  // 1. Mojibake correction
  str = str.replace(/Ã³/g, 'o');
  str = str.replace(/Ã¡/g, 'a');
  str = str.replace(/Ã©/g, 'e');
  str = str.replace(/Ãº/g, 'u');
  str = str.replace(/Ã±/g, 'n');
  str = str.replace(/Ã/g, 'i');
  str = str.replace(/Â/g, '');
  
  // 2. Standard normalization
  str = str.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
  str = str.replace(/[^a-z0-9\s/]/g, '');
  
  return str.trim();
}

function findInternalName(header: string, index: number): string | null {
  // 1. Exact Mojibake Match
  if (EXACT_MOJIBAKE_MAP[header]) return EXACT_MOJIBAKE_MAP[header];

  const normalized = normalizeHeader(header);

  // 2. Normalized Match
  for (const [internalName, synonyms] of Object.entries(ALIASES)) {
    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeHeader(synonym);
      if (normalized === normalizedSynonym) return internalName;
    }
  }

  // 3. Partial Match
  for (const [internalName, synonyms] of Object.entries(ALIASES)) {
    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeHeader(synonym);
      if (normalized.includes(normalizedSynonym) || normalizedSynonym.includes(normalized)) {
        return internalName;
      }
    }
  }

  // 4. Index Fallback (if within range 0-11)
  if (index >= 0 && index <= 11) return INDEX_FALLBACK[index];

  return null;
}

export function normalizeData(rawRows: RawInventoryRow[]): { articles: ArticleSummary[], errors: string[], debug: any } {
  const errors: string[] = [];
  
  if (!rawRows || rawRows.length === 0) {
    return { articles: [], errors: ["El archivo no contiene datos válidos"], debug: {} };
  }

  // Detect columns from first row
  const firstRow = rawRows[0];
  const headerMap: Record<string, string> = {};
  const debugInfo: any = {
    originalHeaders: Object.keys(firstRow),
    normalizedHeaders: [],
    mappedColumns: {}
  };

  Object.keys(firstRow).forEach((key, index) => {
    const normalized = normalizeHeader(key);
    debugInfo.normalizedHeaders.push(normalized);
    
    const internalName = findInternalName(key, index);
    if (internalName) {
      headerMap[key] = internalName;
      debugInfo.mappedColumns[internalName] = key;
    }
  });

  const requiredColumns = ['fecha', 'sede', 'articulo', 'subarticulo', 'costeLinea', 'variacion'];
  const foundColumns = Object.values(headerMap);
  const missing = requiredColumns.filter(col => !foundColumns.includes(col));

  if (missing.length > 0) {
    const friendlyNames: Record<string, string> = {
      fecha: 'Fecha Doc',
      sede: 'Almacén',
      articulo: 'Artículo',
      subarticulo: 'Subartículo',
      costeLinea: 'Coste Línea',
      variacion: 'Variación Stock'
    };
    return { 
      articles: [], 
      errors: [`Faltan columnas obligatorias: ${missing.map(m => friendlyNames[m] || m).join(', ')}. Por favor verifica los encabezados.`],
      debug: debugInfo
    };
  }

  const normalized: any[] = rawRows.map(row => {
    const newRow: any = {};
    Object.keys(row).forEach(key => {
      const normalizedKey = headerMap[key];
      if (normalizedKey) {
        newRow[normalizedKey] = row[key];
      }
    });
    return newRow;
  }).filter(row => row.articulo && row.sede);

  const grouped = new Map<string, ArticleSummary>();

  normalized.forEach(row => {
    let fecha = row.fecha;
    if (fecha instanceof Date) {
      // Already a date from XLSX
    } else if (typeof fecha === 'number') {
      fecha = new Date((fecha - 25569) * 86400 * 1000);
    } else if (typeof fecha === 'string') {
      const cleanFecha = fecha.trim();
      const formats = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy', 'd/M/yyyy'];
      let parsedDate = null;
      for (const f of formats) {
        const d = parse(cleanFecha, f, new Date());
        if (isValid(d)) {
          parsedDate = d;
          break;
        }
      }
      fecha = parsedDate || new Date(cleanFecha);
    } else {
      fecha = new Date(fecha);
    }

    // Ensure we have a valid date, otherwise skip row
    if (!isValid(fecha)) {
      return;
    }

    const variacionRaw = row.variacion;
    let variacion = 0;
    if (typeof variacionRaw === 'number') {
      variacion = variacionRaw;
    } else if (typeof variacionRaw === 'string') {
      // Handle strings with commas or spaces
      variacion = parseFloat(variacionRaw.replace(/,/g, '').trim()) || 0;
    }

    const costeRaw = row.costeLinea;
    let costeLinea = 0;
    if (typeof costeRaw === 'number') {
      costeLinea = costeRaw;
    } else if (typeof costeRaw === 'string') {
      costeLinea = parseFloat(costeRaw.replace(/,/g, '').trim()) || 0;
    }

    const subarticulo = (row.subarticulo || 'UNIDADES').toString().toUpperCase().trim();
    const sedeStr = row.sede.toString().trim();
    const ccStr = (row.cc || '').toString().trim();
    const articuloStr = row.articulo.toString().trim();
    const key = `${sedeStr}|${ccStr}|${articuloStr}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sede: sedeStr,
        cc: ccStr,
        articulo: articuloStr,
        subarticulo,
        subfamilia: (row.subfamilia || '').toString().trim(),
        codBarras: (row.codBarras || '').toString().trim(),
        movements: [],
        totalDiferencia: 0,
        costePromedio: 0,
        ultimoCoste: 0,
        totalCobro: 0,
        debeCobrar: false,
        tipo: 'SIN_VARIACION'
      });
    }

    const summary = grouped.get(key)!;
    summary.movements.push({ fecha, variacion, costeLinea });
  });

  const articles: ArticleSummary[] = Array.from(grouped.values()).map(summary => {
    summary.movements.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    
    const totalDiferencia = summary.movements.reduce((acc, m) => acc + m.variacion, 0);
    const totalCoste = summary.movements.reduce((acc, m) => acc + m.costeLinea, 0);
    const costePromedio = summary.movements.length > 0 ? totalCoste / summary.movements.length : 0;
    const ultimoCoste = summary.movements.length > 0 ? summary.movements[summary.movements.length - 1].costeLinea : 0;
    
    const costToUse = costePromedio > 0 ? costePromedio : ultimoCoste;

    summary.totalDiferencia = totalDiferencia;
    summary.costePromedio = costePromedio;
    summary.ultimoCoste = ultimoCoste;
    
    if (totalDiferencia < -0.0001) summary.tipo = 'FALTANTE';
    else if (totalDiferencia > 0.0001) summary.tipo = 'SOBRANTE';
    else summary.tipo = 'SIN_VARIACION';

    const absDiff = Math.abs(totalDiferencia);
    let debeCobrar = false;

    if (summary.tipo === 'FALTANTE') {
      const unit = summary.subarticulo;
      if (unit.includes('GRAMO')) {
        debeCobrar = absDiff > 1000;
      } else if (unit.includes('ONZA')) {
        debeCobrar = absDiff > 5;
      } else if (unit.includes('UNIDAD')) {
        debeCobrar = absDiff > 1;
      } else {
        debeCobrar = absDiff > 1;
      }
    }

    summary.debeCobrar = debeCobrar;
    summary.totalCobro = debeCobrar ? absDiff * (summary.ultimoCoste || summary.costePromedio) : 0;

    return summary;
  });

  return { articles, errors, debug: debugInfo };
}

export function getDashboardStats(articles: ArticleSummary[]): DashboardStats {
  const sedesMap = new Map<string, ArticleSummary[]>();
  
  articles.forEach(a => {
    if (!sedesMap.has(a.sede)) sedesMap.set(a.sede, []);
    sedesMap.get(a.sede)!.push(a);
  });

  const sedes: SedeSummary[] = Array.from(sedesMap.entries()).map(([sede, arts]) => {
    const totalCobroSede = arts.reduce((acc, a) => acc + a.totalCobro, 0);
    return {
      sede,
      articulos: arts,
      totalCobroSede,
      totalArticulos: arts.length,
      totalFaltantes: arts.filter(a => a.tipo === 'FALTANTE').length,
      totalCobrables: arts.filter(a => a.debeCobrar).length
    };
  });

  return {
    totalArticulos: articles.length,
    totalFaltantes: articles.filter(a => a.tipo === 'FALTANTE').length,
    totalCobrables: articles.filter(a => a.debeCobrar).length,
    valorTotalCobro: articles.reduce((acc, a) => acc + a.totalCobro, 0),
    sedes
  };
}

export function getReliabilitySummary(articles: ArticleSummary[], groupBy: 'sede' | 'cc' = 'sede'): ReliabilitySummary {
  const entityMap = new Map<string, ArticleSummary[]>();
  
  articles.forEach(a => {
    const key = groupBy === 'sede' ? a.sede : (a.cc || 'SIN CC');
    if (!entityMap.has(key)) entityMap.set(key, []);
    entityMap.get(key)!.push(a);
  });

  const sedesStats: ReliabilityStats[] = Array.from(entityMap.entries()).map(([entityName, arts]) => {
    const articulosEvaluados = arts.length;
    const articulosSinDiferencia = arts.filter(a => Math.abs(a.totalDiferencia) < 0.0001).length;
    const articulosConDiferencia = articulosEvaluados - articulosSinDiferencia;
    const confiabilidad = articulosEvaluados > 0 ? (articulosSinDiferencia / articulosEvaluados) * 100 : 0;
    
    const variacionTotal = arts.reduce((acc, a) => acc + a.totalDiferencia, 0);
    const impactoEconomico = arts.reduce((acc, a) => acc + (Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio)), 0);

    let nivel: ReliabilityStats['nivel'] = 'Crítico';
    if (confiabilidad >= 85) nivel = 'Confiable';
    else if (confiabilidad >= 70) nivel = 'Alerta';

    const sortedByImpact = [...arts].sort((a, b) => {
      const impactA = Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio);
      const impactB = Math.abs(b.totalDiferencia) * (b.ultimoCoste || b.costePromedio);
      return impactB - impactA;
    });

    const topArticulosCriticos = sortedByImpact.slice(0, 10).map(a => ({
      articulo: a.articulo,
      variacion: a.totalDiferencia,
      impacto: Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio),
      unidad: a.subarticulo
    }));

    const sortedByReliability = [...arts].sort((a, b) => Math.abs(a.totalDiferencia) - Math.abs(b.totalDiferencia));
    const topArticulosConfiables = sortedByReliability.slice(0, 10).map(a => ({
      articulo: a.articulo,
      variacion: a.totalDiferencia,
      impacto: Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio),
      unidad: a.subarticulo
    }));

    return {
      sede: entityName,
      confiabilidad,
      nivel,
      articulosEvaluados,
      articulosSinDiferencia,
      articulosConDiferencia,
      variacionTotal,
      impactoEconomico,
      topArticulosCriticos,
      topArticulosConfiables
    };
  }).sort((a, b) => b.confiabilidad - a.confiabilidad);

  const totalSedes = sedesStats.length;
  const sedeMasConfiable = sedesStats.length > 0 ? sedesStats[0].sede : 'N/A';
  const sedeMenosConfiable = sedesStats.length > 0 ? sedesStats[sedesStats.length - 1].sede : 'N/A';
  const promedioConfiabilidad = totalSedes > 0 ? sedesStats.reduce((acc, s) => acc + s.confiabilidad, 0) / totalSedes : 0;
  const totalDiferencias = sedesStats.reduce((acc, s) => acc + s.articulosConDiferencia, 0);
  const impactoEconomicoTotal = sedesStats.reduce((acc, s) => acc + s.impactoEconomico, 0);

  return {
    totalSedes,
    sedeMasConfiable,
    sedeMenosConfiable,
    promedioConfiabilidad,
    totalDiferencias,
    impactoEconomicoTotal,
    sedesStats
  };
}

export function getHistoricalTraceability(
  articles: ArticleSummary[],
  groupBy: 'month' | 'week' | 'day' = 'month',
  filters: { sede?: string; cc?: string; subfamilia?: string; articulo?: string; start?: Date; end?: Date }
): HistoricalTraceabilityData {
  const periodMap = new Map<string, ArticleSummary[]>();
  const sedePeriodMap: Record<string, Map<string, ArticleSummary[]>> = {};
  const ccPeriodMap: Record<string, Map<string, ArticleSummary[]>> = {};

  const getPeriodKey = (date: Date) => {
    if (groupBy === 'month') return format(startOfMonth(date), 'MMMM yyyy', { locale: es });
    if (groupBy === 'week') return `Semana ${format(startOfWeek(date), 'dd/MM/yyyy', { locale: es })}`;
    return format(startOfDay(date), 'dd/MM/yyyy', { locale: es });
  };

  const getPeriodDate = (date: Date) => {
    if (groupBy === 'month') return startOfMonth(date);
    if (groupBy === 'week') return startOfWeek(date);
    return startOfDay(date);
  };

  articles.forEach(art => {
    if (filters.sede && art.sede !== filters.sede) return;
    if (filters.cc && art.cc !== filters.cc) return;
    if (filters.subfamilia && art.subfamilia !== filters.subfamilia) return;
    if (filters.articulo && !art.articulo.toLowerCase().includes(filters.articulo.toLowerCase())) return;

    const movementsByPeriod = new Map<string, InventoryMovement[]>();
    art.movements.forEach(m => {
      if (filters.start && m.fecha < filters.start) return;
      if (filters.end && m.fecha > filters.end) return;

      const key = getPeriodKey(m.fecha);
      if (!movementsByPeriod.has(key)) movementsByPeriod.set(key, []);
      movementsByPeriod.get(key)!.push(m);
    });

    movementsByPeriod.forEach((movements, periodKey) => {
      const totalDiferencia = movements.reduce((acc, m) => acc + m.variacion, 0);
      const totalCoste = movements.reduce((acc, m) => acc + m.costeLinea, 0);
      const costePromedio = movements.length > 0 ? totalCoste / movements.length : 0;
      const ultimoCoste = movements.length > 0 ? movements[movements.length - 1].costeLinea : 0;
      
      const absDiff = Math.abs(totalDiferencia);
      let tipo: ArticleSummary['tipo'] = 'SIN_VARIACION';
      if (totalDiferencia < -0.0001) tipo = 'FALTANTE';
      else if (totalDiferencia > 0.0001) tipo = 'SOBRANTE';

      let debeCobrar = false;
      if (tipo === 'FALTANTE') {
        const unit = art.subarticulo;
        if (unit.includes('GRAMO')) debeCobrar = absDiff > 1000;
        else if (unit.includes('ONZA')) debeCobrar = absDiff > 5;
        else if (unit.includes('UNIDAD')) debeCobrar = absDiff > 1;
        else debeCobrar = absDiff > 1;
      }

      const virtualArt: ArticleSummary = {
        ...art,
        movements,
        totalDiferencia,
        costePromedio,
        ultimoCoste,
        totalCobro: debeCobrar ? absDiff * (ultimoCoste || costePromedio) : 0,
        debeCobrar,
        tipo
      };

      if (!periodMap.has(periodKey)) periodMap.set(periodKey, []);
      periodMap.get(periodKey)!.push(virtualArt);

      if (!sedePeriodMap[art.sede]) sedePeriodMap[art.sede] = new Map();
      if (!sedePeriodMap[art.sede].has(periodKey)) sedePeriodMap[art.sede].set(periodKey, []);
      sedePeriodMap[art.sede].get(periodKey)!.push(virtualArt);

      const ccKey = art.cc || 'SIN CC';
      if (!ccPeriodMap[ccKey]) ccPeriodMap[ccKey] = new Map();
      if (!ccPeriodMap[ccKey].has(periodKey)) ccPeriodMap[ccKey].set(periodKey, []);
      ccPeriodMap[ccKey].get(periodKey)!.push(virtualArt);
    });
  });

  const calculateStats = (arts: ArticleSummary[], periodKey: string): HistoricalPeriodStats => {
    const evaluados = arts.length;
    const sinDiferencia = arts.filter(a => Math.abs(a.totalDiferencia) < 0.0001).length;
    const conDiferencia = evaluados - sinDiferencia;
    const confiabilidad = evaluados > 0 ? (sinDiferencia / evaluados) * 100 : 0;
    const impactoEconomico = arts.reduce((acc, a) => acc + (Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio)), 0);
    const faltantes = arts.filter(a => a.tipo === 'FALTANTE').length;
    const sobrantes = arts.filter(a => a.tipo === 'SOBRANTE').length;
    const cobrables = arts.filter(a => a.debeCobrar).length;
    const valorCobro = arts.reduce((acc, a) => acc + a.totalCobro, 0);

    const date = arts[0]?.movements[0]?.fecha || new Date();

    return {
      period: periodKey,
      date: getPeriodDate(date),
      evaluados,
      sinDiferencia,
      conDiferencia,
      confiabilidad,
      impactoEconomico,
      faltantes,
      sobrantes,
      cobrables,
      valorCobro,
      estado: 'Estable'
    };
  };

  const processPeriodStats = (map: Map<string, ArticleSummary[]>): HistoricalPeriodStats[] => {
    const stats = Array.from(map.entries()).map(([key, arts]) => calculateStats(arts, key));
    stats.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (let i = 1; i < stats.length; i++) {
      const current = stats[i];
      const previous = stats[i - 1];
      current.variacionVsAnterior = current.confiabilidad - previous.confiabilidad;
      if (current.variacionVsAnterior > 0.0001) current.estado = 'Mejoró';
      else if (current.variacionVsAnterior < -0.0001) current.estado = 'Empeoró';
      else current.estado = 'Estable';
    }

    return stats;
  };

  const periods = processPeriodStats(periodMap);
  const bySede: Record<string, HistoricalPeriodStats[]> = {};
  Object.keys(sedePeriodMap).forEach(sede => {
    bySede[sede] = processPeriodStats(sedePeriodMap[sede]);
  });

  const byCC: Record<string, HistoricalPeriodStats[]> = {};
  Object.keys(ccPeriodMap).forEach(cc => {
    byCC[cc] = processPeriodStats(ccPeriodMap[cc]);
  });

  return { periods, bySede, byCC };
}
