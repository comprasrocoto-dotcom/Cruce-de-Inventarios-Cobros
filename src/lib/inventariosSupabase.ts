/**
 * Lectura de inventarios desde Supabase (tabla `cruce_inventarios`).
 *
 * La base del Cruce es propia (tablas `cruce_*`), independiente del Informe de
 * Rentabilidad. Cada inventario que se sube queda guardado; al abrir la app se
 * leen todos y se entregan con los MISMOS encabezados del export de HioPOS, para
 * que `normalizeData` (motor de cobros) los procese igual que un Excel.
 */
import { supabase } from './supabase';

/** Una línea de inventario tal como se guarda en la base. */
export interface LineaInventario {
  fecha: string; // yyyy-MM-dd
  serie: string;
  almacen: string;
  familia: string | null;
  subfamilia: string | null;
  centro_costos: string | null;
  proveedor: string | null;
  articulo: string;
  codigo: string | null;
  subarticulo: string | null;
  costo_unitario: number;
  stock_fecha: number;
  variacion: number;
  stock_inventario: number;
}

const COLUMNAS =
  'id, fecha, serie, almacen, familia, subfamilia, centro_costos, proveedor, articulo, codigo, subarticulo, costo_unitario, stock_fecha, variacion, stock_inventario';
const PAGINA = 1000;

const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v));

/**
 * Centro de costo normalizado: "Cocina" o "Bar". Si la línea no lo trae (el CSV
 * de HioPOS a veces no incluye la columna), se toma de la tabla
 * `cruce_subfamilia_cc`; una subfamilia que no esté allí cuenta como Cocina.
 */
export const normalizarCC = (cc: string | null | undefined, subfamilia: string | null, mapa: Map<string, string>) => {
  const c = (cc || '').trim().toUpperCase();
  if (c.startsWith('BAR')) return 'Bar';
  if (c.startsWith('COC')) return 'Cocina';
  return mapa.get((subfamilia || '').trim().toUpperCase()) ?? 'Cocina';
};

/** Lee el mapa subfamilia → centro de costo. */
async function leerMapaCC(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('cruce_subfamilia_cc').select('subfamilia, centro_costos');
  if (error) throw new Error(`Error al leer el centro de costo por subfamilia: ${error.message}`);
  return new Map((data ?? []).map((r) => [String(r.subfamilia).trim().toUpperCase(), String(r.centro_costos)]));
}

/** Lee todas las líneas en páginas de 1000 (límite de la API de Supabase). */
export async function leerLineas(): Promise<LineaInventario[]> {
  const mapa = await leerMapaCC();
  const filas: LineaInventario[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from('cruce_inventarios')
      .select(COLUMNAS)
      .order('id', { ascending: true })
      .range(desde, desde + PAGINA - 1);
    if (error) throw new Error(`Error al leer inventarios en Supabase: ${error.message}`);
    const lote = (data ?? []) as Record<string, unknown>[];
    for (const r of lote) {
      filas.push({
        fecha: String(r.fecha),
        serie: String(r.serie ?? ''),
        almacen: String(r.almacen ?? ''),
        familia: (r.familia as string) ?? null,
        subfamilia: (r.subfamilia as string) ?? null,
        centro_costos: normalizarCC(r.centro_costos as string, (r.subfamilia as string) ?? null, mapa),
        proveedor: (r.proveedor as string) ?? null,
        articulo: String(r.articulo ?? ''),
        codigo: (r.codigo as string) ?? null,
        subarticulo: (r.subarticulo as string) ?? null,
        costo_unitario: num(r.costo_unitario),
        stock_fecha: num(r.stock_fecha),
        variacion: num(r.variacion),
        stock_inventario: num(r.stock_inventario),
      });
    }
    if (lote.length < PAGINA) break;
  }
  return filas;
}

/**
 * Convierte una línea al formato de encabezados de HioPOS, en el MISMO orden de
 * las 13 columnas del contrato (el mapeo por posición de normalizeData depende de él).
 */
export const aFormatoHioPOS = (r: LineaInventario) => ({
  'Fecha Doc': r.fecha,
  'Serie / Número': r.serie,
  'Almacén': r.almacen,
  Familia: r.familia ?? '',
  Subfamilia: r.subfamilia ?? '',
  'Centro de Costos': r.centro_costos ?? '',
  'Artículo': r.articulo,
  'Cód. Barras': r.codigo ?? '',
  'Subartículo': r.subarticulo ?? '',
  'Coste Línea': r.costo_unitario,
  'Stock a Fecha': r.stock_fecha,
  'Variación Stock': r.variacion,
  'Stock Inventario': r.stock_inventario,
});
