/**
 * Núcleo de transformación y métricas de inventario.
 *
 * Contiene:
 *  - normalizeData: detecta y mapea columnas (con tolerancia a mojibake y
 *    sinónimos), agrupa por sede/artículo/subartículo, parsea fechas y costos,
 *    y produce los ArticleSummary con sus variaciones y cobros.
 *  - getDashboardStats / getReliabilitySummary / getHistoricalTraceability /
 *    getProductStabilityAnalysis / getResponsableStabilityAnalysis /
 *    getExecutiveSummary: agregaciones para las distintas vistas.
 *
 * La lógica de tolerancia y confiabilidad por ítem se delega en ./confiabilidad.
 */
import {
  RawInventoryRow,
  ArticleSummary,
  SedeSummary,
  DashboardStats,
  InventoryMovement,
  ReliabilitySummary,
  ReliabilityStats,
  HistoricalPeriodStats,
  HistoricalTraceabilityData,
  ProductStability,
  ResponsableStability,
  ExecutiveSummary,
} from "../types";

import {
  evaluarItem,
  calcularPerdidaEconomica,
  calcularEstadisticasConfiabilidad,
  obtenerEstado,
} from "./confiabilidad";

import {
  parse,
  isValid,
  format,
  startOfMonth,
  startOfWeek,
  startOfDay,
  isWithinInterval,
  addMonths,
  subMonths,
} from "date-fns";

import { es } from "date-fns/locale";

const EXACT_MOJIBAKE_MAP: Record<string, string> = {
  "Fecha Doc": "fecha",

  "Serie / NÃºmero": "serie",

  "AlmacÃ©n": "sede",

  Familia: "familia",

  Subfamilia: "subfamilia",
  "Centro de Costos": "cc",

  Proveedor: "proveedor",

  ArtÃculo: "articulo",

  "CÃ³d. Barras": "codBarras",

  SubartÃculo: "subarticulo",

  "Coste LÃnea": "costeLinea",

  "Stock a Fecha": "stockFecha",

  "VariaciÃ³n Stock": "variacion",

  "Stock Inventario": "stockInventario",
};

const INDEX_FALLBACK: Record<number, string> = {
  0: "fecha",

  1: "serie",

  2: "sede",

  3: "familia",

  4: "subfamilia",

  5: "cc",

  6: "articulo",

  7: "codBarras",

  8: "subarticulo",

  9: "costeLinea",

  10: "stockFecha",

  11: "variacion",

  12: "stockInventario",
};

const ALIASES: Record<string, string[]> = {
  fecha: ["fecha doc", "fecha", "fecha documento"],

  sede: ["almacen", "bodega", "sede", "almacen"],

  articulo: ["articulo", "producto", "item", "insumo"],

  subarticulo: [
    "subarticulo",
    "unidad",
    "unidad de medida",
    "medida",
    "u m",
    "um",
  ],

  costeLinea: ["coste linea", "costo linea", "coste", "costo", "valor costo"],

  variacion: [
    "variacion stock",
    "variacion",
    "ajuste",
    "ajuste stock",
    "diferencia stock",
    "movimiento stock",
  ],

  familia: ["familia", "category"],

  proveedor: ["proveedor", "distribuidor"],

  subfamilia: ["subfamilia", "subgrupo"],

  stockFecha: ["stock a fecha", "stock fecha"],

  stockInventario: ["stock inventario", "inventario"],

  codBarras: ["cod barras", "codigo barras", "cod.", "barras"],

  responsable: [
    "responsable",
    "usuario",
    "vendedor",
    "creado por",
    "persona",
    "empleado",
  ],
  cc: ["centro de costos", "centro costos", "cc", "centro de costo"],
};

function normalizeHeader(header: string): string {
  if (!header) return "";

  let str = header.toString();

  // 1. Mojibake correction

  str = str.replace(/Ã³/g, "o");

  str = str.replace(/Ã¡/g, "a");

  str = str.replace(/Ã©/g, "e");

  str = str.replace(/Ãº/g, "u");

  str = str.replace(/Ã±/g, "n");

  str = str.replace(/Ã/g, "i");

  str = str.replace(/Â/g, "");

  // 2. Standard normalization

  str = str
    .toLowerCase()

    .trim()

    .replace(/\s+/g, " ")

    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  str = str.replace(/[^a-z0-9\s/]/g, "");

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

      // Evita falsos positivos con alias muy cortos (cc, um, u m, cod)
      if (normalizedSynonym.length < 4) continue;
      if (
        normalized.includes(normalizedSynonym) ||
        normalizedSynonym.includes(normalized)
      ) {
        return internalName;
      }
    }
  }

  // 4. Index Fallback (if within range 0-11)

  if (index >= 0 && index <= 11) return INDEX_FALLBACK[index];

  return null;
}

/**
 * Parser numérico regional único y robusto.
 *
 * El export de HioPOS mezcla convenciones entre conteos:
 *   - Colombiana: punto = miles, coma = decimal  ("3.302,80", "6.220" = 6220)
 *   - US:         coma = miles,  punto = decimal ("14,554.22", "6.22" = 6.22)
 *
 * Reglas (aplicadas al texto ya limpio de $, espacios y NBSP):
 *   1. Ambos separadores presentes → el ÚLTIMO que aparece es el decimal.
 *   2. Un mismo separador repetido → son separadores de miles (se eliminan).
 *   3. Un único separador:
 *      - con 1, 2 o 4+ dígitos después → decimal ("94,67", "-321,66646").
 *      - con exactamente 3 dígitos después → miles ("6.220" → 6220),
 *        salvo que la parte entera sea "" o "0" ("0,045" → 0.045) o tenga
 *        más de 3 dígitos ("1234,567" → decimal, agrupación inválida).
 *
 * La ambigüedad residual (un valor genuinamente decimal con exactamente
 * 3 decimales, ej. "2,500" = 2.5) se mitiga aguas abajo con la identidad
 * contable Inv = Teórico + Var (ver reparación en normalizeData).
 */
export function parseNumeroRegional(raw: unknown): number {
  if (typeof raw === "number") return isFinite(raw) ? raw : 0;
  if (raw === null || raw === undefined) return 0;

  let str = String(raw)
    .replace(/[$\u00A0\s]/g, "")
    .trim();
  if (!str) return 0;

  let negativo = false;
  if (str.startsWith("-")) {
    negativo = true;
    str = str.slice(1);
  } else if (str.startsWith("(") && str.endsWith(")")) {
    negativo = true;
    str = str.slice(1, -1);
  }

  const tienePunto = str.includes(".");
  const tieneComa = str.includes(",");
  let normalizado = str;

  if (tienePunto && tieneComa) {
    // Regla 1: el último separador que aparece es el decimal
    const decimal = str.lastIndexOf(".") > str.lastIndexOf(",") ? "." : ",";
    const miles = decimal === "." ? "," : ".";
    normalizado = str.split(miles).join("");
    if (decimal === ",") normalizado = normalizado.replace(",", ".");
  } else if (tienePunto || tieneComa) {
    const sep = tienePunto ? "." : ",";
    const partes = str.split(sep);
    if (partes.length > 2) {
      // Regla 2: separador repetido → miles ("484.945.432" → 484945432)
      normalizado = partes.join("");
    } else {
      const [entera, fraccion] = partes;
      const esMiles =
        fraccion.length === 3 &&
        entera !== "" &&
        entera !== "0" &&
        entera.length <= 3;
      normalizado = esMiles ? entera + fraccion : entera + "." + fraccion; // Regla 3
    }
  }

  const num = parseFloat(normalizado);
  if (!isFinite(num)) return 0;
  return negativo ? -num : num;
}

/**
 * Clasifica el documento HioPOS a partir de su Serie / Número.
 *   - "CONTEO** / N"  → CONTEO  (conteo físico: base válida para cobros)
 *   - "a / NNNN"      → AJUSTE  (ajuste de sistema: explica, no imputa)
 *   - otro            → OTRO
 */
export function clasificarDocumento(
  serie: string,
): "CONTEO" | "AJUSTE" | "OTRO" {
  const s = (serie || "").trim().toUpperCase();
  if (s.startsWith("CONTEO")) return "CONTEO";
  if (/^A\s*\//.test(s)) return "AJUSTE";
  return "OTRO";
}

/** Mediana de los valores positivos de una lista (robusta frente a outliers). */
function medianaPositiva(valores: number[]): number {
  const positivos = valores.filter((v) => v > 0).sort((a, b) => a - b);
  if (positivos.length === 0) return 0;
  const mitad = Math.floor(positivos.length / 2);
  return positivos.length % 2 === 0
    ? (positivos[mitad - 1] + positivos[mitad]) / 2
    : positivos[mitad];
}

/** Detecta sub-recetas / producto en proceso (se analizan pero no se cobran). */
function esSubRecetaFn(subfamilia: string, articulo: string): boolean {
  const sf = (subfamilia || "").toUpperCase();
  const art = (articulo || "").toUpperCase();
  return (
    (sf.includes("SUB") && sf.includes("RECETA")) || art.startsWith("SUB.")
  );
}

export function normalizeData(rawRows: RawInventoryRow[]): {
  articles: ArticleSummary[];
  errors: string[];
  debug: any;
} {
  const errors: string[] = [];

  if (!rawRows || rawRows.length === 0) {
    return {
      articles: [],
      errors: ["El archivo no contiene datos válidos"],
      debug: {},
    };
  }

  // Detect columns from first row

  const firstRow = rawRows[0];

  const headerMap: Record<string, string> = {};

  const debugInfo: any = {
    originalHeaders: Object.keys(firstRow),

    normalizedHeaders: [],

    mappedColumns: {},
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

  const requiredColumns = [
    "fecha",
    "sede",
    "articulo",
    "subarticulo",
    "costeLinea",
    "variacion",
  ];

  const foundColumns = Object.values(headerMap);

  const missing = requiredColumns.filter((col) => !foundColumns.includes(col));

  if (missing.length > 0) {
    const friendlyNames: Record<string, string> = {
      fecha: "Fecha Doc",

      sede: "Almacén",

      articulo: "Artículo",

      subarticulo: "Subartículo",

      costeLinea: "Coste Línea",

      variacion: "Variación Stock",
    };

    return {
      articles: [],

      errors: [
        `Faltan columnas obligatorias: ${missing.map((m) => friendlyNames[m] || m).join(", ")}. Por favor verifica los encabezados.`,
      ],

      debug: debugInfo,
    };
  }

  const normalized: any[] = rawRows
    .map((row) => {
      const newRow: any = {};

      Object.keys(row).forEach((key) => {
        const normalizedKey = headerMap[key];

        if (normalizedKey) {
          newRow[normalizedKey] = row[key];
        }
      });

      return newRow;
    })
    .filter((row) => row.articulo && row.sede);

  const grouped = new Map<string, ArticleSummary>();

  normalized.forEach((row) => {
    let fecha = row.fecha;

    if (fecha instanceof Date) {
      // Already a date from XLSX
    } else if (typeof fecha === "number") {
      fecha = new Date((fecha - 25569) * 86400 * 1000);
    } else if (typeof fecha === "string") {
      const cleanFecha = fecha.trim();
      const slashParts = cleanFecha.split("/");

      if (slashParts.length === 3) {
        const firstSeg = slashParts[0];
        const secondSeg = slashParts[1];
        let yearNum = Number(slashParts[2]);
        // Normaliza años de 2 dígitos (ej. "26" -> 2026) antes de validar
        if (yearNum < 100) yearNum += yearNum < 70 ? 2000 : 1900;
        const firstNum = Number(firstSeg);
        const secondNum = Number(secondSeg);

        // If first segment starts with 0 (e.g. 01, 06) or value > 12 => day-first (dd/MM/yyyy)
        // Otherwise single-digit or 10-12 without leading zero => month-first (M/d/yyyy)
        const isDayFirst =
          firstSeg.charAt(0) === "0" ||
          firstNum > 12 ||
          secondSeg.charAt(0) === "0";

        if (isDayFirst) {
          // dd/MM/yyyy
          const day = firstNum;
          const month = secondNum;
          if (
            month >= 1 &&
            month <= 12 &&
            day >= 1 &&
            day <= 31 &&
            yearNum > 1900
          ) {
            fecha = new Date(yearNum, month - 1, day);
          }
        } else {
          // M/d/yyyy (month first, US/sheet format)
          const month = firstNum;
          const day = secondNum;
          if (
            month >= 1 &&
            month <= 12 &&
            day >= 1 &&
            day <= 31 &&
            yearNum > 1900
          ) {
            fecha = new Date(yearNum, month - 1, day);
          }
        }
      } else {
        // Try ISO yyyy-MM-dd
        const isoD = parse(cleanFecha, "yyyy-MM-dd", new Date());
        if (isValid(isoD)) fecha = isoD;
      }
    } else {
      fecha = new Date(fecha);
    }

    // Ensure we have a valid date, otherwise skip row

    if (!isValid(fecha)) {
      return;
    }

    // Parser regional único: el export de HioPOS mezcla convención COL y US
    // entre conteos, y los 4 campos numéricos deben interpretarse igual.
    let variacion = parseNumeroRegional(row.variacion);
    const costeLinea = parseNumeroRegional(row.costeLinea);
    const stockFecha = parseNumeroRegional(row.stockFecha);
    const stockInventario = parseNumeroRegional(row.stockInventario);

    // Compuerta de calidad con auto-reparación: cada fila del ERP cumple la
    // identidad contable Inv = Teórico + Variación. Si la variación parseada
    // la viola (dato corrupto en origen o ambigüedad regional), se recalcula
    // desde los stocks, que son la fuente más confiable de la fila.
    const serieStr = (row.serie || "").toString().trim();
    const tipoDocumento = clasificarDocumento(serieStr);
    let calidad: "OK" | "REPARADA" | "SOSPECHOSA" = "OK";
    const varEsperada = stockInventario - stockFecha;
    const toleranciaIdentidad = Math.max(
      0.05,
      Math.abs(stockInventario) * 0.001,
    );
    if (
      (stockFecha !== 0 || stockInventario !== 0) &&
      Math.abs(varEsperada - variacion) > toleranciaIdentidad
    ) {
      variacion = varEsperada;
      calidad = "REPARADA";
      debugInfo.filasReparadas = (debugInfo.filasReparadas || 0) + 1;
    } else if (
      stockFecha === 0 &&
      stockInventario === 0 &&
      Math.abs(variacion) > 0
    ) {
      // Sin stocks de referencia no hay forma de validar la variación.
      calidad = "SOSPECHOSA";
      debugInfo.filasSospechosas = (debugInfo.filasSospechosas || 0) + 1;
    }

    const subarticulo = (row.subarticulo || "UNIDADES")
      .toString()
      .toUpperCase()
      .trim();

    const sedeStr = row.sede.toString().trim();

    const familiaStr = (row.familia || "").toString().trim();

    const ccStr = (row.cc || familiaStr || "").toString().trim();

    const proveedorStr = (row.proveedor || "").toString().trim();

    const articuloStr = row.articulo.toString().trim();

    const responsableStr = (row.responsable || "Sin asignar").toString().trim();

    const key = `${sedeStr}|${articuloStr}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        sede: sedeStr,

        cc: ccStr,

        familia: familiaStr,

        proveedor: proveedorStr,

        responsable: responsableStr,

        articulo: articuloStr,

        subarticulo,

        subfamilia: (row.subfamilia || "").toString().trim(),

        codBarras: (row.codBarras || "").toString().trim(),

        fecha: new Date(),

        movements: [],

        totalDiferencia: 0,

        stockFisico: 0,

        stockEsperado: 0,

        costePromedio: 0,

        ultimoCoste: 0,

        totalCobro: 0,

        ajusteCobro: 0,

        confiabilidadTecnica: "ALTA",

        debeCobrar: false,

        dentroDeTolerancia: true,

        margenError: 0,

        reglaAplicada: "",

        perdidaPorMargen: 0,

        dineroRecuperable: 0,

        tipo: "SIN_VARIACION",

        totalFaltantes: 0,

        totalSobrantes: 0,

        cantidadACobrar: 0,

        valorPerdida: 0,

        valorSobrante: 0,

        severidad: "NORMAL",
      });
    }

    const summary = grouped.get(key)!;

    summary.movements.push({
      fecha,
      variacion,
      costeLinea,
      stockFecha,
      stockInventario,
      serie: serieStr,
      tipoDocumento,
      calidad,
    });
  });

  const articles: ArticleSummary[] = Array.from(grouped.values()).map(
    (summary) => {
      summary.movements.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

      const lastM = summary.movements[summary.movements.length - 1];

      summary.fecha = lastM?.fecha || new Date();

      summary.stockFisico = lastM?.stockInventario || 0;

      summary.stockEsperado = lastM?.stockFecha || 0;

      const totalDiferencia = summary.movements.reduce(
        (acc, m) => acc + m.variacion,
        0,
      );

      const totalCoste = summary.movements.reduce(
        (acc, m) => acc + m.costeLinea,
        0,
      );

      const totalStockTeorico = summary.movements.reduce(
        (acc, m) => acc + m.stockFecha,
        0,
      );

      const averageStockTeorico =
        summary.movements.length > 0
          ? totalStockTeorico / summary.movements.length
          : 0;

      const costePromedio =
        summary.movements.length > 0
          ? totalCoste / summary.movements.length
          : 0;

      const ultimoCoste =
        summary.movements.length > 0
          ? summary.movements[summary.movements.length - 1].costeLinea
          : 0;

      summary.totalDiferencia = totalDiferencia;

      summary.costePromedio = costePromedio;

      summary.ultimoCoste = ultimoCoste;

      if (totalDiferencia < -0.0001) summary.tipo = "FALTANTE";
      else if (totalDiferencia > 0.0001) summary.tipo = "SOBRANTE";
      else summary.tipo = "SIN_VARIACION";

      // 🧩 CICLOS DE CONTEO — la unidad de análisis del cobro.
      // Cada documento HioPOS (fecha + serie) es la foto de un ciclo independiente:
      // sumar ciclos no representa ninguna realidad física. La suma histórica se
      // conserva en totalDiferencia (vistas de análisis/trazabilidad), pero el
      // COBRO se evalúa sobre el ÚLTIMO CONTEO FÍSICO.
      const ciclosMap = new Map<
        string,
        {
          fecha: Date;
          serie: string;
          tipoDocumento: "CONTEO" | "AJUSTE" | "OTRO";
          variacion: number;
          stockFecha: number;
          stockInventario: number;
          costeLinea: number;
        }
      >();

      summary.movements.forEach((m) => {
        const claveCiclo = `${m.fecha.toISOString().slice(0, 10)}|${m.serie || ""}`;
        const previo = ciclosMap.get(claveCiclo);
        if (previo) {
          previo.variacion += m.variacion;
          previo.stockFecha = m.stockFecha;
          previo.stockInventario = m.stockInventario;
          previo.costeLinea = m.costeLinea || previo.costeLinea;
        } else {
          ciclosMap.set(claveCiclo, {
            fecha: m.fecha,
            serie: m.serie || "",
            tipoDocumento: m.tipoDocumento || "OTRO",
            variacion: m.variacion,
            stockFecha: m.stockFecha,
            stockInventario: m.stockInventario,
            costeLinea: m.costeLinea,
          });
        }
      });

      const ciclos = Array.from(ciclosMap.values()).sort(
        (a, b) => a.fecha.getTime() - b.fecha.getTime(),
      );

      const conteosFisicos = ciclos.filter((c) => c.tipoDocumento === "CONTEO");

      // Ciclo de cobro: el último conteo físico; si no existe ninguno, el último
      // documento disponible (solo como referencia, sin generar cobro).
      const cicloCobro =
        conteosFisicos.length > 0
          ? conteosFisicos[conteosFisicos.length - 1]
          : ciclos[ciclos.length - 1];

      const variacionCiclo = cicloCobro?.variacion ?? 0;

      summary.variacionUltimoCiclo = variacionCiclo;
      summary.fechaUltimoCiclo = cicloCobro?.fecha;
      summary.serieUltimoCiclo = cicloCobro?.serie;
      summary.tipoDocumentoUltimoCiclo = cicloCobro?.tipoDocumento;

      // Costo unitario robusto: la mediana resiste los costes corruptos del ERP
      // (ej. cientos de millones en una fila) que contaminan el promedio.
      summary.costeMediano = medianaPositiva(
        summary.movements.map((m) => m.costeLinea),
      );

      summary.esSubReceta = esSubRecetaFn(summary.subfamilia, summary.articulo);
      summary.filasReparadas = summary.movements.filter(
        (m) => m.calidad === "REPARADA",
      ).length;

      // 🧩 USO DE LÓGICA CENTRALIZADA — la tolerancia se evalúa SOBRE EL CICLO
      // (variación y base teórica del último conteo), no sobre el acumulado.
      const evaluado = evaluarItem({
        ...summary,
        totalDiferencia: variacionCiclo,
        stockEsperado: cicloCobro?.stockFecha ?? summary.stockEsperado,
      });

      summary.margenError = evaluado.margenError;

      summary.dentroDeTolerancia = evaluado.dentroDeTolerancia;

      summary.confiabilidad = evaluado.confiabilidad;

      // Se cobra si: el último CONTEO FÍSICO tiene faltante fuera de margen.
      // Los ajustes de sistema (serie "a /") explican, no imputan: sin conteo
      // físico no se genera cobro automático. Las sub-recetas / producto en
      // proceso se analizan pero no se cobran (su variación es operativa).
      const hayConteoFisico = conteosFisicos.length > 0;

      if (summary.esSubReceta) {
        summary.debeCobrar = false;
        summary.ajusteCobro = 0;
        summary.motivoNoCobro = "Sub-receta / producto en proceso";
      } else if (!hayConteoFisico) {
        summary.debeCobrar = false;
        summary.ajusteCobro = 0;
        summary.motivoNoCobro = "Sin conteo físico (solo ajustes de sistema)";
      } else if (variacionCiclo < -0.0001 && !summary.dentroDeTolerancia) {
        summary.debeCobrar = true;
        summary.ajusteCobro = variacionCiclo;
        summary.motivoNoCobro = undefined;
      } else {
        summary.debeCobrar = false;
        summary.ajusteCobro = 0;
        summary.motivoNoCobro = undefined;
      }

      summary.reglaAplicada = summary.subarticulo
        .toUpperCase()
        .includes("GRAMO")
        ? "±2.5% de margen"
        : summary.subarticulo.toUpperCase().includes("ONZA")
          ? "±1 onza"
          : "Sin margen";

      // 💰 Cálculos económicos usando lógica central, valorados con el costo
      // mediano (robusto) y sobre la variación del ciclo de cobro.
      const valorUnitario =
        summary.costeMediano || summary.ultimoCoste || summary.costePromedio;

      summary.dineroRecuperable = calcularPerdidaEconomica({
        ...summary,
        totalDiferencia: variacionCiclo,
        ultimoCoste: valorUnitario,
      });

      summary.perdidaPorMargen =
        summary.dentroDeTolerancia && Math.abs(variacionCiclo) > 0
          ? Math.abs(variacionCiclo) * valorUnitario
          : 0;

      summary.totalCobro = summary.debeCobrar
        ? Math.abs(variacionCiclo) * valorUnitario
        : 0;

      // 🔥 CONFIABILIDAD TÉCNICA (3 niveles) basada en el ratio de error

      const baseBench = Math.max(
        Math.abs(cicloCobro?.stockFecha ?? summary.stockEsperado),
        1,
      );

      const ratioError = Math.abs(variacionCiclo) / baseBench;

      if (ratioError > 0.1) {
        // Más del 10% de error respecto al stock esperado

        summary.confiabilidadTecnica = "BAJA";
      } else if (ratioError > 0.02) {
        // Entre 2% y 10%

        summary.confiabilidadTecnica = "MEDIA";
      } else {
        summary.confiabilidadTecnica = "ALTA";
      }

      // Consolidated charges

      const mFalt = summary.movements.filter((m) => m.variacion < 0);

      const mSobr = summary.movements.filter((m) => m.variacion > 0);

      summary.totalFaltantes = mFalt.reduce(
        (acc, m) => acc + Math.abs(m.variacion),
        0,
      );

      summary.totalSobrantes = mSobr.reduce((acc, m) => acc + m.variacion, 0);

      // Cantidad a cobrar: el faltante del ciclo de cobro (no el neteo histórico).
      summary.cantidadACobrar = summary.debeCobrar
        ? Math.abs(variacionCiclo)
        : 0;

      const vu = summary.ultimoCoste || summary.costePromedio;

      summary.valorPerdida = summary.totalFaltantes * vu;

      summary.valorSobrante = summary.totalSobrantes * vu;

      const absDiff = Math.abs(variacionCiclo);

      const stockRef = baseBench;

      if (absDiff > 10 || absDiff / stockRef > 0.5) {
        summary.severidad = "CRITICO";
      } else if (absDiff > 2) {
        summary.severidad = "MEDIO";
      } else {
        summary.severidad = "NORMAL";
      }

      return summary;
    },
  );

  return { articles, errors, debug: debugInfo };
}

export function getDashboardStats(articles: ArticleSummary[]): DashboardStats {
  const sedesMap = new Map<string, ArticleSummary[]>();

  articles.forEach((a) => {
    if (!sedesMap.has(a.sede)) sedesMap.set(a.sede, []);

    sedesMap.get(a.sede)!.push(a);
  });

  const sedes: SedeSummary[] = Array.from(sedesMap.entries()).map(
    ([sede, arts]) => {
      const totalCobroSede = arts.reduce((acc, a) => acc + a.totalCobro, 0);

      return {
        sede,

        articulos: arts,

        totalCobroSede,

        totalArticulos: arts.length,

        totalFaltantes: arts.filter((a) => a.tipo === "FALTANTE").length,

        totalCobrables: arts.filter((a) => a.debeCobrar).length,
      };
    },
  );

  return {
    totalArticulos: articles.length,

    totalFaltantes: articles.filter((a) => a.tipo === "FALTANTE").length,

    totalCobrables: articles.filter((a) => a.debeCobrar).length,

    valorTotalCobro: articles.reduce((acc, a) => acc + a.totalCobro, 0),

    sedes,
  };
}

export function getReliabilitySummary(
  articles: ArticleSummary[],
  groupBy: "sede" | "cc" = "sede",
): ReliabilitySummary {
  const entityMap = new Map<string, ArticleSummary[]>();

  articles.forEach((a) => {
    const key = groupBy === "sede" ? a.sede : a.cc || "SIN CC";

    if (!entityMap.has(key)) entityMap.set(key, []);

    entityMap.get(key)!.push(a);
  });

  const sedesStats: ReliabilityStats[] = Array.from(entityMap.entries())
    .map(([entityName, arts]) => {
      const stats = calcularEstadisticasConfiabilidad(arts);

      const articulosEvaluados = stats.total;

      const articulosSinDiferencia = stats.dentro;

      const articulosConDiferencia = stats.fuera;

      const confiabilidad = stats.confiabilidad;

      const nivel = obtenerEstado(confiabilidad);

      const variacionTotal = arts.reduce(
        (acc, a) => acc + a.totalDiferencia,
        0,
      );

      const impactoEconomico = arts.reduce(
        (acc, a) =>
          acc +
          Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio),
        0,
      );

      const sortedByImpact = [...arts].sort((a, b) => {
        const impactA =
          Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio);

        const impactB =
          Math.abs(b.totalDiferencia) * (b.ultimoCoste || b.costePromedio);

        return impactB - impactA;
      });

      const topArticulosCriticos = sortedByImpact.slice(0, 10).map((a) => ({
        articulo: a.articulo,

        variacion: a.totalDiferencia,

        impacto:
          Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio),

        unidad: a.subarticulo,
      }));

      const sortedByReliability = [...arts].sort(
        (a, b) => Math.abs(a.totalDiferencia) - Math.abs(b.totalDiferencia),
      );

      const topArticulosConfiables = sortedByReliability
        .slice(0, 10)
        .map((a) => ({
          articulo: a.articulo,

          variacion: a.totalDiferencia,

          impacto:
            Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio),

          unidad: a.subarticulo,
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

        topArticulosConfiables,
      };
    })
    .sort((a, b) => b.confiabilidad - a.confiabilidad);

  const totalSedes = sedesStats.length;

  const sedeMasConfiable = sedesStats.length > 0 ? sedesStats[0].sede : "N/A";

  const sedeMenosConfiable =
    sedesStats.length > 0 ? sedesStats[sedesStats.length - 1].sede : "N/A";

  const promedioConfiabilidad =
    totalSedes > 0
      ? sedesStats.reduce((acc, s) => acc + s.confiabilidad, 0) / totalSedes
      : 0;

  const totalDiferencias = sedesStats.reduce(
    (acc, s) => acc + s.articulosConDiferencia,
    0,
  );

  const impactoEconomicoTotal = sedesStats.reduce(
    (acc, s) => acc + s.impactoEconomico,
    0,
  );

  return {
    totalSedes,

    sedeMasConfiable,

    sedeMenosConfiable,

    promedioConfiabilidad,

    totalDiferencias,

    impactoEconomicoTotal,

    sedesStats,
  };
}

export function getHistoricalTraceability(
  articles: ArticleSummary[],

  groupBy: "month" | "week" | "day" = "month",

  filters: {
    sede?: string;
    cc?: string;
    subfamilia?: string;
    articulo?: string;
    start?: Date;
    end?: Date;
  },
): HistoricalTraceabilityData {
  const periodMap = new Map<string, ArticleSummary[]>();

  const sedePeriodMap: Record<string, Map<string, ArticleSummary[]>> = {};

  const ccPeriodMap: Record<string, Map<string, ArticleSummary[]>> = {};

  const getPeriodKey = (date: Date) => {
    if (groupBy === "month")
      return format(startOfMonth(date), "MMMM yyyy", { locale: es });

    if (groupBy === "week")
      return `Semana ${format(startOfWeek(date), "dd/MM/yyyy", { locale: es })}`;

    return format(startOfDay(date), "dd/MM/yyyy", { locale: es });
  };

  const getPeriodDate = (date: Date) => {
    if (groupBy === "month") return startOfMonth(date);

    if (groupBy === "week") return startOfWeek(date);

    return startOfDay(date);
  };

  articles.forEach((art) => {
    if (filters.sede && art.sede !== filters.sede) return;

    if (filters.cc && art.cc !== filters.cc) return;

    if (filters.subfamilia && art.subfamilia !== filters.subfamilia) return;

    if (
      filters.articulo &&
      !art.articulo.toLowerCase().includes(filters.articulo.toLowerCase())
    )
      return;

    const movementsByPeriod = new Map<string, InventoryMovement[]>();

    art.movements.forEach((m) => {
      if (filters.start && m.fecha < filters.start) return;

      if (filters.end && m.fecha > filters.end) return;

      const key = getPeriodKey(m.fecha);

      if (!movementsByPeriod.has(key)) movementsByPeriod.set(key, []);

      movementsByPeriod.get(key)!.push(m);
    });

    movementsByPeriod.forEach((movements, periodKey) => {
      const totalDiferencia = movements.reduce(
        (acc, m) => acc + m.variacion,
        0,
      );

      const totalCoste = movements.reduce((acc, m) => acc + m.costeLinea, 0);

      const costePromedio =
        movements.length > 0 ? totalCoste / movements.length : 0;

      const ultimoCoste =
        movements.length > 0 ? movements[movements.length - 1].costeLinea : 0;

      const absDiff = Math.abs(totalDiferencia);

      let tipo: ArticleSummary["tipo"] = "SIN_VARIACION";

      if (totalDiferencia < -0.0001) tipo = "FALTANTE";
      else if (totalDiferencia > 0.0001) tipo = "SOBRANTE";

      // 🧩 USO DE LÓGICA CENTRAL PARA TRAZABILIDAD

      const baseArt: any = {
        ...art,
        totalDiferencia,
        stockEsperado:
          movements.reduce((acc, m) => acc + m.stockFecha, 0) /
          movements.length,
      };

      const evaluado = evaluarItem(baseArt as ArticleSummary);

      const virtualArt: ArticleSummary = {
        ...art,

        movements,

        totalDiferencia,

        costePromedio,

        ultimoCoste,

        debeCobrar: totalDiferencia < -0.0001 && !evaluado.dentroDeTolerancia,

        dentroDeTolerancia: evaluado.dentroDeTolerancia,

        margenError: evaluado.margenError,

        totalCobro:
          totalDiferencia < -0.0001 && !evaluado.dentroDeTolerancia
            ? absDiff * (ultimoCoste || costePromedio)
            : 0,

        tipo,
      };

      if (!periodMap.has(periodKey)) periodMap.set(periodKey, []);

      periodMap.get(periodKey)!.push(virtualArt);

      if (!sedePeriodMap[art.sede]) sedePeriodMap[art.sede] = new Map();

      if (!sedePeriodMap[art.sede].has(periodKey))
        sedePeriodMap[art.sede].set(periodKey, []);

      sedePeriodMap[art.sede].get(periodKey)!.push(virtualArt);

      const ccKey = art.cc || "SIN CC";

      if (!ccPeriodMap[ccKey]) ccPeriodMap[ccKey] = new Map();

      if (!ccPeriodMap[ccKey].has(periodKey))
        ccPeriodMap[ccKey].set(periodKey, []);

      ccPeriodMap[ccKey].get(periodKey)!.push(virtualArt);
    });
  });

  const calculateStats = (
    arts: ArticleSummary[],
    periodKey: string,
  ): HistoricalPeriodStats => {
    const evaluados = arts.length;

    const sinDiferencia = arts.filter((a) => a.dentroDeTolerancia).length;

    const conDiferencia = evaluados - sinDiferencia;

    const confiabilidad = evaluados > 0 ? (sinDiferencia / evaluados) * 100 : 0;

    const impactoEconomico = arts.reduce(
      (acc, a) =>
        acc + Math.abs(a.totalDiferencia) * (a.ultimoCoste || a.costePromedio),
      0,
    );

    const faltantes = arts.filter((a) => a.tipo === "FALTANTE").length;

    const sobrantes = arts.filter((a) => a.tipo === "SOBRANTE").length;

    const cobrables = arts.filter((a) => a.debeCobrar).length;

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

      estado: "Estable",
    };
  };

  const processPeriodStats = (
    map: Map<string, ArticleSummary[]>,
  ): HistoricalPeriodStats[] => {
    const stats = Array.from(map.entries()).map(([key, arts]) =>
      calculateStats(arts, key),
    );

    stats.sort((a, b) => a.date.getTime() - b.date.getTime());

    for (let i = 1; i < stats.length; i++) {
      const current = stats[i];

      const previous = stats[i - 1];

      current.variacionVsAnterior =
        current.confiabilidad - previous.confiabilidad;

      if (current.variacionVsAnterior > 0.0001) current.estado = "Mejoró";
      else if (current.variacionVsAnterior < -0.0001)
        current.estado = "Empeoró";
      else current.estado = "Estable";
    }

    return stats;
  };

  const periods = processPeriodStats(periodMap);

  const bySede: Record<string, HistoricalPeriodStats[]> = {};

  Object.keys(sedePeriodMap).forEach((sede) => {
    bySede[sede] = processPeriodStats(sedePeriodMap[sede]);
  });

  const byCC: Record<string, HistoricalPeriodStats[]> = {};

  Object.keys(ccPeriodMap).forEach((cc) => {
    byCC[cc] = processPeriodStats(ccPeriodMap[cc]);
  });

  return { periods, bySede, byCC };
}

export function getProductStabilityAnalysis(
  articles: ArticleSummary[],
): ProductStability[] {
  const productMap = new Map<string, ArticleSummary[]>();

  articles.forEach((a) => {
    if (!productMap.has(a.articulo)) productMap.set(a.articulo, []);

    productMap.get(a.articulo)!.push(a);
  });

  return Array.from(productMap.entries())
    .map(([producto, instances]) => {
      const totalInstancias = instances.length;

      const evaluados = instances.map(evaluarItem);

      const instanciasFueraMargen = evaluados.filter(
        (i) => !i.dentroDeTolerancia,
      ).length;

      const porcentajeFueraMargen =
        totalInstancias > 0
          ? (instanciasFueraMargen / totalInstancias) * 100
          : 0;

      // Confiabilidad: basada en % instancias fuera margen
      const confiabilidad = 100 - porcentajeFueraMargen;

      const impactoTotal = instances.reduce(
        (acc, i) =>
          acc +
          Math.abs(i.totalDiferencia) * (i.ultimoCoste || i.costePromedio),
        0,
      );

      let estado: "Estable" | "Inestable" | "Crítico" = "Estable";

      if (confiabilidad < 60) estado = "Crítico";
      else if (confiabilidad < 85) estado = "Inestable";

      return {
        producto,

        totalInstancias,

        instanciasFueraMargen,

        porcentajeFueraMargen,

        confiabilidad,

        impactoTotal,

        estado,
      };
    })
    .sort((a, b) => b.porcentajeFueraMargen - a.porcentajeFueraMargen);
}

export function getResponsableStabilityAnalysis(
  articles: ArticleSummary[],
): ResponsableStability[] {
  const respMap = new Map<string, ArticleSummary[]>();

  articles.forEach((a) => {
    const r = a.responsable || "Sin asignar";

    if (!respMap.has(r)) respMap.set(r, []);

    respMap.get(r)!.push(a);
  });

  return Array.from(respMap.entries())
    .map(([responsable, instances]) => {
      const totalEvaluaciones = instances.length;

      const evaluados = instances.map(evaluarItem);

      const instanciasFueraMargen = evaluados.filter(
        (i) => !i.dentroDeTolerancia,
      ).length;

      const porcentajeFallo =
        totalEvaluaciones > 0
          ? (instanciasFueraMargen / totalEvaluaciones) * 100
          : 0;

      // Confiabilidad promedio

      const confiabilidad =
        totalEvaluaciones > 0
          ? evaluados.reduce((acc, i) => acc + (i.confiabilidad || 0), 0) /
            totalEvaluaciones
          : 0;

      return {
        responsable,

        totalEvaluaciones,

        instanciasFueraMargen,

        porcentajeFallo,

        confiabilidad,
      };
    })
    .sort((a, b) => b.confiabilidad - a.confiabilidad);
}

export function getExecutiveSummary(
  articles: ArticleSummary[],
): ExecutiveSummary {
  const perdidas = articles.filter((a) => a.totalFaltantes > 0);

  const sobrantes = articles.filter((a) => a.totalSobrantes > 0);

  return {
    totalProductosRevisados: articles.length,

    totalProductosConNovedades: articles.filter(
      (a) => a.tipo !== "SIN_VARIACION",
    ).length,

    totalProductosSinNovedades: articles.filter(
      (a) => a.tipo === "SIN_VARIACION",
    ).length,

    valorTotalPerdidas: articles.reduce(
      (acc, a) => acc + (a.valorPerdida || 0),
      0,
    ),

    valorTotalSobrantes: articles.reduce(
      (acc, a) => acc + (a.valorSobrante || 0),
      0,
    ),

    balanceFinal: articles.reduce(
      (acc, a) => acc + ((a.valorSobrante || 0) - (a.valorPerdida || 0)),
      0,
    ),

    cantidadTotalACobrar: articles.reduce(
      (acc, a) => acc + (a.cantidadACobrar || 0),
      0,
    ),

    top10Diferencias: [...articles]
      .sort((a, b) => Math.abs(b.totalDiferencia) - Math.abs(a.totalDiferencia))
      .slice(0, 10),

    top10Recurrentes: [...articles]
      .sort((a, b) => b.movements.length - a.movements.length)
      .slice(0, 10),

    perdidas,

    sobrantes,
  };
}
