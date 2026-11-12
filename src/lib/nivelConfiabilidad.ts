/**
 * Nivel de confiabilidad por inventario (documento = almacén + fecha + serie).
 *
 *   Nivel = (1 − Referencias con diferencia ÷ Cantidad de referencias) × 100
 *
 * Una referencia tiene diferencia cuando |físico − teórico| supera el margen de
 * error de su unidad — el MISMO del cobro (cruce_configuracion.margenes):
 *   - Unidades y copas: sin margen.
 *   - Onzas: ±2.
 *   - Gramos: 2.5% del teórico (piso de 100 g para teóricos en cero o negativos).
 * Las líneas con teórico y físico en cero no cuentan (no se contó nada).
 */
import type { LineaInventario } from './inventariosSupabase';
import { margenLinea, type ConfigMargenes } from '../utils/confiabilidad';

/** Casos que bajan el nivel pero suelen venir del sistema, no del conteo. */
export type AlertaLinea = 'TEORICO_NEGATIVO' | 'FISICO_CERO' | null;

export interface LineaEvaluada extends LineaInventario {
  diferencia: number;
  tolerancia: number;
  conDiferencia: boolean;
  valorDiferencia: number;
  /** Cantidad que se sale del margen (con signo): −40 g con margen 25 g → −15 g. */
  fueraMargen: number;
  valorFueraMargen: number;
  alerta: AlertaLinea;
}

export const evaluarLinea = (l: LineaInventario, margenes: ConfigMargenes): LineaEvaluada => {
  const diferencia = l.stock_inventario - l.stock_fecha;
  const tolerancia = margenLinea(l.subarticulo, l.stock_fecha, margenes);
  const exceso = Math.max(0, Math.abs(diferencia) - tolerancia);
  const fueraMargen = exceso > 1e-9 ? Math.sign(diferencia) * exceso : 0;
  const costo = l.costo_unitario || 0;
  return {
    ...l,
    diferencia,
    tolerancia,
    conDiferencia: exceso > 1e-9,
    valorDiferencia: diferencia * costo,
    fueraMargen,
    valorFueraMargen: fueraMargen * costo,
    alerta: l.stock_fecha < 0 ? 'TEORICO_NEGATIVO' : l.stock_fecha > 0 && l.stock_inventario === 0 ? 'FISICO_CERO' : null,
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
  faltanteValor: number; // suma de diferencias negativas valorizadas (≤ 0), solo referencias con diferencia
  sobranteValor: number; // suma de diferencias positivas valorizadas (≥ 0), solo referencias con diferencia
  lineas: LineaEvaluada[]; // solo las contadas
}

export function evaluarInventarios(lineas: LineaInventario[], margenes: ConfigMargenes): InventarioEvaluado[] {
  const docs = new Map<string, InventarioEvaluado>();
  for (const l of lineas) {
    if (l.stock_fecha === 0 && l.stock_inventario === 0) continue;
    const clave = `${l.almacen}|${l.fecha}|${l.serie}`;
    let d = docs.get(clave);
    if (!d) {
      d = { clave, almacen: l.almacen, fecha: l.fecha, serie: l.serie, referencias: 0, conDiferencia: 0, nivel: 0, faltanteValor: 0, sobranteValor: 0, lineas: [] };
      docs.set(clave, d);
    }
    const e = evaluarLinea(l, margenes);
    d.lineas.push(e);
    d.referencias++;
    if (e.conDiferencia) {
      d.conDiferencia++;
      if (e.valorDiferencia < 0) d.faltanteValor += e.valorDiferencia;
      else d.sobranteValor += e.valorDiferencia;
    }
  }
  const lista = [...docs.values()];
  for (const d of lista) d.nivel = d.referencias ? (1 - d.conDiferencia / d.referencias) * 100 : 0;
  return lista.sort((a, b) => (a.fecha === b.fecha ? a.almacen.localeCompare(b.almacen) : b.fecha.localeCompare(a.fecha)));
}
