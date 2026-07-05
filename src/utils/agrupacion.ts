/**
 * Agrupación de artículos COBRABLES para los reportes de la sección
 * "Detalle de Cobros" (Excel plano ordenado por grupos y PDF con separadores).
 *
 * Regla de negocio (definida por el usuario, 04/07/2026):
 *   1. PRIMERO se agrupan los artículos que pertenecen a RECETAS, usando el
 *      catálogo del RecetasAPI: el artículo SUB. (la receta) y sus
 *      ingredientes van juntos bajo la etiqueta de la receta.
 *   2. Con los RESTANTES se agrupa por SEMEJANZA DE NOMBRE ("contiene"):
 *      la palabra significativa que comparten varios artículos (HATSU,
 *      COCA, MANANTIAL...) forma el grupo.
 *   3. Lo que no comparte palabra con nadie queda como grupo de un solo
 *      artículo (lista plana: SIN subgrupos anidados).
 *
 * El Excel usa esta agrupación SOLO como ORDEN (lista plana con los mismos
 * encabezados de siempre); el PDF sí muestra los separadores de grupo.
 */
import { ArticleSummary } from '../types';
import { RecetasPayload } from './recetas';

export interface GrupoReporte {
  /** Etiqueta del grupo (código+nombre de receta, palabra compartida, o el artículo solo). */
  etiqueta: string;
  /** 'RECETA' | 'SEMEJANZA' | 'SOLO' — útil para estilos en el PDF. */
  tipo: 'RECETA' | 'SEMEJANZA' | 'SOLO';
  articulos: ArticleSummary[];
  totalCobro: number;
}

/** Palabras de empaque/medida que no cuentan como semejanza de producto. */
const PALABRAS_GENERICAS_REPORTE = new Set([
  'KILO',
  'KILOS',
  'GRAMOS',
  'GRAMO',
  'LITRO',
  'LITROS',
  'BOTELLA',
  'BOTELLAS',
  'UNIDAD',
  'UNIDADES',
  'CAJA',
  'BOLSA',
  'PACK',
  'GALON',
  'GRANEL',
  'PAQUETE',
  'FRASCO',
  'LATA',
  'SOBRE',
  'BIDON',
  'CUÑETE',
  'DOCENA',
  'SIXPACK',
  'RETORNABLE',
  'DESECHABLE',
]);

const tokensDe = (nombre: string): string[] =>
  nombre
    .toUpperCase()
    .split(/[^A-ZÁÉÍÓÚÑ]+/)
    .filter((t) => t.length >= 4 && !PALABRAS_GENERICAS_REPORTE.has(t));

const norm = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toUpperCase();

/**
 * Agrupa los artículos cobrables de un conjunto (típicamente una sede).
 * Devuelve los grupos en el orden del reporte: recetas primero (por cobro
 * desc), luego grupos por semejanza (por cobro desc), luego artículos solos.
 */
export function agruparCobrablesParaReporte(
  articulos: ArticleSummary[],
  payload?: RecetasPayload | null
): GrupoReporte[] {
  const cobrables = articulos.filter((a) => a.debeCobrar);
  if (cobrables.length === 0) return [];

  // ── Fase 1: recetas (SUB. + sus ingredientes) ──
  const nombreReceta = new Map<string, string>();
  const ingredienteAReceta = new Map<string, string>();
  if (payload) {
    payload.recetas.forEach((r) => {
      const cod = norm(r.codigo);
      if (cod && !nombreReceta.has(cod)) {
        nombreReceta.set(cod, r.nombre ? String(r.nombre).split('|').pop()!.trim() : cod);
      }
    });
    // Un ingrediente puede estar en varias recetas: se asigna a la PRIMERA
    // por código (determinístico y estable entre generaciones del reporte).
    [...payload.composicion]
      .sort((a, b) => norm(a.receta).localeCompare(norm(b.receta)))
      .forEach((c) => {
        const ing = norm(c.ingrediente);
        if (ing && !ingredienteAReceta.has(ing)) ingredienteAReceta.set(ing, norm(c.receta));
      });
  }

  const grupos = new Map<string, GrupoReporte>();
  const restantes: ArticleSummary[] = [];

  const meterEnGrupo = (
    clave: string,
    etiqueta: string,
    tipo: GrupoReporte['tipo'],
    a: ArticleSummary
  ) => {
    if (!grupos.has(clave)) grupos.set(clave, { etiqueta, tipo, articulos: [], totalCobro: 0 });
    const g = grupos.get(clave)!;
    g.articulos.push(a);
    g.totalCobro += a.totalCobro;
  };

  cobrables.forEach((a) => {
    const cod = norm(a.codBarras);
    let receta: string | undefined;
    if (nombreReceta.has(cod)) receta = cod;
    else if (ingredienteAReceta.has(cod)) receta = ingredienteAReceta.get(cod);
    if (receta) {
      meterEnGrupo(
        `R|${receta}`,
        `RECETA ${receta} · ${nombreReceta.get(receta) || ''}`.trim(),
        'RECETA',
        a
      );
    } else {
      restantes.push(a);
    }
  });

  // ── Fase 2: semejanza de nombre entre los restantes ──
  // Frecuencia de cada palabra significativa entre los restantes; cada
  // artículo se agrupa bajo su palabra MÁS compartida (empate: la que
  // aparece primero en su nombre, típicamente la marca).
  const frecuencia = new Map<string, number>();
  const tokensPorArticulo = new Map<ArticleSummary, string[]>();
  restantes.forEach((a) => {
    const toks = tokensDe(a.articulo);
    tokensPorArticulo.set(a, toks);
    new Set(toks).forEach((t) => frecuencia.set(t, (frecuencia.get(t) || 0) + 1));
  });

  restantes.forEach((a) => {
    const toks = tokensPorArticulo.get(a) || [];
    let mejor: string | null = null;
    let mejorFreq = 1; // exige que la palabra sea compartida (freq >= 2)
    toks.forEach((t) => {
      const f = frecuencia.get(t) || 0;
      if (f > mejorFreq) {
        mejor = t;
        mejorFreq = f;
      }
    });
    if (mejor) meterEnGrupo(`T|${mejor}`, mejor, 'SEMEJANZA', a);
    else meterEnGrupo(`S|${a.sede}|${a.articulo}`, a.articulo, 'SOLO', a);
  });

  // ── Orden del reporte ──
  const orden = { RECETA: 0, SEMEJANZA: 1, SOLO: 2 } as const;
  const lista = [...grupos.values()];
  lista.forEach((g) => g.articulos.sort((x, y) => x.articulo.localeCompare(y.articulo)));
  lista.sort((a, b) => {
    if (orden[a.tipo] !== orden[b.tipo]) return orden[a.tipo] - orden[b.tipo];
    return b.totalCobro - a.totalCobro;
  });
  return lista;
}
