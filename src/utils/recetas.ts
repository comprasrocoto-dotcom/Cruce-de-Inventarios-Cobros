/**
 * Cruce Recetas ↔ Inventario HioPOS.
 *
 * Une la información del proyecto de registro de recetas (composición y
 * fabricaciones reales) con el inventario ya procesado, usando el código
 * como llave: `Receta.codigo` y `Articulo.codigo` del registro son el mismo
 * `Cód. Barras` de HioPOS, porque todo nace del mismo ERP (las recetas se
 * registran en la app y un bot las carga al ERP).
 *
 * El diagnóstico central que habilita este cruce:
 *   INGREDIENTE CON SOBRANTE fuera de tolerancia
 *   + SU RECETA SIN FABRICACIONES registradas en el horizonte
 *   = "sobrante fantasma": lo más probable es que la receta no se registró,
 *     no que sobre producto de verdad.
 */
import { ArticleSummary } from "../types";
import { RECETAS_API_URL } from "../config";

// ─────────────────────────── Tipos del payload ───────────────────────────

export interface RecetaCatalogo {
  codigo: string;
  nombre: string;
  unidad: string;
  rendimiento: number;
}

export interface ComposicionItem {
  receta: string;
  ingrediente: string;
  nombreIngrediente: string;
  categoria: string;
  unidad: string;
  cantNeta: number;
}

export interface FabricacionItem {
  receta: string;
  sede: string;
  fecha: string; // yyyy-MM-dd
  cantidad: number;
}

export interface RecetasPayload {
  recetas: RecetaCatalogo[];
  composicion: ComposicionItem[];
  fabricaciones: FabricacionItem[];
  error?: string;
}

// ─────────────────────────── Tipos del cruce ───────────────────────────

/** Ingrediente de una receta cruzado con su estado de inventario en la sede. */
export interface IngredienteCruzado {
  codigo: string;
  nombre: string;
  categoria: string;
  unidadReceta: string;
  cantNeta: number;
  /** Artículo del inventario de la sede (si el código cruzó). */
  inv?: ArticleSummary;
}

/** Grupo receta + ingredientes para una sede. */
export interface GrupoReceta {
  sede: string;
  receta: RecetaCatalogo;
  /** El artículo SUB. de la receta en el inventario de la sede (si existe). */
  articuloReceta?: ArticleSummary;
  ingredientes: IngredienteCruzado[];
  /** Fabricaciones registradas de esta receta en esta sede dentro del horizonte. */
  fabricacionesEnRango: number;
  ultimaFabricacion?: string;
  /** Ingredientes con sobrante fuera de tolerancia (base de la alerta). */
  ingredientesConSobrante: number;
  /** true = sobrante fantasma: hay sobrantes y la receta no se registró en el rango. */
  alertaSinRegistro: boolean;
}

/** Reporte de emparejamiento: el cruce nunca debe fallar en silencio. */
export interface ReporteCruce {
  recetasTotal: number;
  recetasCruzadas: number;
  recetasSinCruce: string[];
  ingredientesTotal: number;
  ingredientesCruzados: number;
  ingredientesSinCruce: string[];
}

export interface ResultadoCruce {
  grupos: GrupoReceta[];
  reporte: ReporteCruce;
  rango: { desde: string; hasta: string } | null;
}

// ─────────────────────────── Carga ───────────────────────────

/**
 * Descarga el payload del endpoint RecetasAPI (Apps Script).
 * Lanza error si la URL no está configurada o el backend reporta fallo.
 */
export async function fetchRecetas(): Promise<RecetasPayload> {
  if (!RECETAS_API_URL) {
    throw new Error("RECETAS_API_URL no está configurada en src/config.ts");
  }
  const res = await fetch(RECETAS_API_URL);
  if (!res.ok)
    throw new Error(`Error al consultar la API de recetas: ${res.status}`);
  const data: RecetasPayload = await res.json();
  if (data && data.error) throw new Error(data.error);
  if (!data || !Array.isArray(data.recetas)) {
    throw new Error("La API de recetas no devolvió el formato esperado");
  }
  return data;
}

// ─────────────────────────── Cruce ───────────────────────────

const norm = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toUpperCase();

/**
 * Cruza el catálogo de recetas con los artículos de inventario ya filtrados.
 *
 * @param articles Artículos del inventario (respetan los filtros activos de la
 *                 app: sede, fechas, etc. — el cruce hereda ese horizonte).
 * @param payload  Datos del proyecto de registro (recetas, composición, fabricaciones).
 */
export function cruzarRecetasConInventario(
  articles: ArticleSummary[],
  payload: RecetasPayload,
): ResultadoCruce {
  // Índices del inventario: por sede+código y global por código.
  const porSedeCodigo = new Map<string, ArticleSummary>();
  const codigosInventario = new Set<string>();
  const sedes = new Set<string>();
  let fechaMin: Date | null = null;
  let fechaMax: Date | null = null;

  for (const a of articles) {
    const cod = norm(a.codBarras);
    const sede = norm(a.sede);
    if (cod) {
      porSedeCodigo.set(`${sede}|${cod}`, a);
      codigosInventario.add(cod);
    }
    sedes.add(sede);
    for (const m of a.movements) {
      if (!fechaMin || m.fecha < fechaMin) fechaMin = m.fecha;
      if (!fechaMax || m.fecha > fechaMax) fechaMax = m.fecha;
    }
  }

  const rango =
    fechaMin && fechaMax
      ? {
          desde: fechaMin.toISOString().slice(0, 10),
          hasta: fechaMax.toISOString().slice(0, 10),
        }
      : null;

  // Composición agrupada por receta.
  const compPorReceta = new Map<string, ComposicionItem[]>();
  const codigosIngredientes = new Set<string>();
  for (const c of payload.composicion) {
    const codR = norm(c.receta);
    if (!compPorReceta.has(codR)) compPorReceta.set(codR, []);
    compPorReceta.get(codR)!.push(c);
    codigosIngredientes.add(norm(c.ingrediente));
  }

  // Fabricaciones dentro del rango, indexadas por sede|receta.
  const fabPorSedeReceta = new Map<string, { n: number; ultima: string }>();
  for (const f of payload.fabricaciones) {
    if (rango && (f.fecha < rango.desde || f.fecha > rango.hasta)) continue;
    const key = `${norm(f.sede)}|${norm(f.receta)}`;
    const prev = fabPorSedeReceta.get(key) || { n: 0, ultima: "" };
    prev.n += 1;
    if (f.fecha > prev.ultima) prev.ultima = f.fecha;
    fabPorSedeReceta.set(key, prev);
  }

  // Grupos por sede × receta: se incluye el grupo si la receta (SUB.) o
  // alguno de sus ingredientes existe en el inventario de esa sede.
  const grupos: GrupoReceta[] = [];
  const recetasCruzadasSet = new Set<string>();

  for (const receta of payload.recetas) {
    const codR = norm(receta.codigo);
    const comp = compPorReceta.get(codR) || [];
    if (codigosInventario.has(codR)) recetasCruzadasSet.add(codR);

    for (const sede of sedes) {
      const articuloReceta = porSedeCodigo.get(`${sede}|${codR}`);

      const ingredientes: IngredienteCruzado[] = comp.map((c) => ({
        codigo: norm(c.ingrediente),
        nombre: c.nombreIngrediente,
        categoria: c.categoria,
        unidadReceta: c.unidad,
        cantNeta: c.cantNeta,
        inv: porSedeCodigo.get(`${sede}|${norm(c.ingrediente)}`),
      }));

      const hayAlgoEnSede = !!articuloReceta || ingredientes.some((i) => i.inv);
      if (!hayAlgoEnSede) continue;

      const fab = fabPorSedeReceta.get(`${sede}|${codR}`) || {
        n: 0,
        ultima: "",
      };

      // Sobrante fuera de tolerancia = síntoma; sin fabricación = causa probable.
      const ingredientesConSobrante = ingredientes.filter(
        (i) =>
          i.inv &&
          (i.inv.variacionUltimoCiclo ?? 0) > 0.0001 &&
          !i.inv.dentroDeTolerancia,
      ).length;

      grupos.push({
        sede,
        receta,
        articuloReceta,
        ingredientes,
        fabricacionesEnRango: fab.n,
        ultimaFabricacion: fab.ultima || undefined,
        ingredientesConSobrante,
        alertaSinRegistro: ingredientesConSobrante > 0 && fab.n === 0,
      });
    }
  }

  // Orden: primero las alertas, luego por sobrantes, luego alfabético.
  grupos.sort((a, b) => {
    if (a.alertaSinRegistro !== b.alertaSinRegistro)
      return a.alertaSinRegistro ? -1 : 1;
    if (a.ingredientesConSobrante !== b.ingredientesConSobrante)
      return b.ingredientesConSobrante - a.ingredientesConSobrante;
    return `${a.sede}|${a.receta.nombre}`.localeCompare(
      `${b.sede}|${b.receta.nombre}`,
    );
  });

  const ingredientesSinCruce = [...codigosIngredientes].filter(
    (c) => !codigosInventario.has(c),
  );
  const recetasSinCruce = payload.recetas
    .map((r) => norm(r.codigo))
    .filter((c) => !recetasCruzadasSet.has(c));

  return {
    grupos,
    rango,
    reporte: {
      recetasTotal: payload.recetas.length,
      recetasCruzadas: recetasCruzadasSet.size,
      recetasSinCruce,
      ingredientesTotal: codigosIngredientes.size,
      ingredientesCruzados:
        codigosIngredientes.size - ingredientesSinCruce.length,
      ingredientesSinCruce,
    },
  };
}
