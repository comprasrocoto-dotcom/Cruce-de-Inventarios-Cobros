/**
 * Nivel de confiabilidad por inventario (documento = almacén + fecha + serie).
 *
 *   Nivel = (Cantidad de referencias − Referencias con diferencia) / Cantidad de referencias × 100
 *
 * Una referencia tiene diferencia cuando |físico − teórico| supera la tolerancia:
 *   - Gramos, onzas, ml y kilos: tolerancia_pct (2,5%) de la cantidad mayor entre teórico y físico.
 *   - Unidades, copas y presentaciones: ± tolerancia_unidades (2).
 * Las líneas con teórico y físico en cero no cuentan (no se contó nada).
 * Las tolerancias viven en la tabla `cruce_configuracion` (las edita el administrador).
 */
import type { LineaInventario } from './inventariosSupabase';

export interface Tolerancias {
  pct: number; // 0.025 = 2,5%
  unidades: number; // 2
}

export const TOLERANCIAS_DEFAULT: Tolerancias = { pct: 0.025, unidades: 2 };

export const esPesoVolumen = (subarticulo?: string | null) =>
  /GRAM|ONZ|KILO|\bML\b|X ML|LITRO/i.test(subarticulo || '');

export interface LineaEvaluada extends LineaInventario {
  diferencia: number;
  tolerancia: number;
  conDiferencia: boolean;
  valorDiferencia: number;
}

export const evaluarLinea = (l: LineaInventario, t: Tolerancias): LineaEvaluada => {
  const diferencia = l.stock_inventario - l.stock_fecha;
  const tolerancia = esPesoVolumen(l.subarticulo)
    ? Math.max(Math.abs(l.stock_fecha), Math.abs(l.stock_inventario)) * t.pct
    : t.unidades;
  return {
    ...l,
    diferencia,
    tolerancia,
    conDiferencia: Math.abs(diferencia) > tolerancia + 1e-9,
    valorDiferencia: diferencia * (l.costo_unitario || 0),
  };
};

export interface InventarioEvaluado {
  clave: string;
  almacen: string;
  fecha: string;
  serie: string;
  referencias: number;
  conDiferencia: number;
  nivel: number; // 0–100
  faltanteValor: number; // suma de diferencias negativas valorizadas (≤ 0)
  sobranteValor: number; // suma de diferencias positivas valorizadas (≥ 0)
  lineas: LineaEvaluada[]; // solo las contadas
}

export function evaluarInventarios(lineas: LineaInventario[], t: Tolerancias): InventarioEvaluado[] {
  const docs = new Map<string, InventarioEvaluado>();
  for (const l of lineas) {
    if (l.stock_fecha === 0 && l.stock_inventario === 0) continue;
    const clave = `${l.almacen}|${l.fecha}|${l.serie}`;
    let d = docs.get(clave);
    if (!d) {
      d = { clave, almacen: l.almacen, fecha: l.fecha, serie: l.serie, referencias: 0, conDiferencia: 0, nivel: 0, faltanteValor: 0, sobranteValor: 0, lineas: [] };
      docs.set(clave, d);
    }
    const e = evaluarLinea(l, t);
    d.lineas.push(e);
    d.referencias++;
    if (e.conDiferencia) {
      d.conDiferencia++;
      if (e.valorDiferencia < 0) d.faltanteValor += e.valorDiferencia;
      else d.sobranteValor += e.valorDiferencia;
    }
  }
  const lista = [...docs.values()];
  for (const d of lista) d.nivel = d.referencias ? ((d.referencias - d.conDiferencia) / d.referencias) * 100 : 0;
  return lista.sort((a, b) => (a.fecha === b.fecha ? a.almacen.localeCompare(b.almacen) : b.fecha.localeCompare(a.fecha)));
}
