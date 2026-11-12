/**
 * Nivel de confiabilidad por inventario: una fila por cada inventario subido
 * (almacén + fecha + serie), con su fórmula y sus novedades.
 *
 *   Nivel = (1 − Total ref. con diferencia ÷ Cantidad de referencias) × 100
 *
 * Los márgenes de error son los mismos del cobro (Configuración de Cobro en el
 * Resumen, guardada en `cruce_configuracion.margenes`). Administrador y editor
 * pueden borrar un inventario (por ejemplo, uno subido por error).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LineaInventario } from '../lib/inventariosSupabase';
import { evaluarInventarios, type AlertaLinea } from '../lib/nivelConfiabilidad';
import { reglaTexto, type ConfigMargenes, type UnidadMargen } from '../utils/confiabilidad';
import { borrarInventario } from '../lib/subirInventario';

const pesos = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const cant = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);
const fechaCorta = (f: string) => {
  const [a, m, d] = f.split('-');
  return `${d}/${m}/${a}`;
};
const ETIQUETA_ALERTA: Record<Exclude<AlertaLinea, null>, { texto: string; ayuda: string }> = {
  TEORICO_NEGATIVO: { texto: 'Teórico negativo', ayuda: 'El sistema tenía menos de cero: revisar recetas, compras o traslados.' },
  FISICO_CERO: { texto: 'Físico en 0', ayuda: 'Se acabó o no se contó: confirmar con la sede.' },
};
const colorNivel = (n: number) =>
  n >= 95 ? 'bg-emerald-100 text-emerald-800' : n >= 80 ? 'bg-yellow-100 text-yellow-800' : n >= 60 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800';

export const NivelConfiabilidad: React.FC<{
  lineas: LineaInventario[];
  /** Márgenes de error vigentes (los mismos del cobro). */
  margenes: ConfigMargenes;
  /** Centro de costo elegido (Cocina o Bar); null = Todos. */
  cc?: string | null;
  onCambio?: () => void;
}> = ({ lineas, margenes, cc = null, onCambio }) => {
  const [puedeBorrar, setPuedeBorrar] = useState(false);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [almacen, setAlmacen] = useState('TODOS');
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('cruce_mi_rol').then(({ data }) => setPuedeBorrar(data === 'admin' || data === 'editor'));
  }, []);

  const borrar = async (almacen: string, fecha: string, serie: string) => {
    try {
      const n = await borrarInventario(almacen, fecha, serie);
      setMsg(`Se borró el inventario ${serie} de ${almacen} (${n} líneas).`);
      setPorBorrar(null);
      onCambio?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo borrar.');
    }
  };

  // Con un centro de costo elegido se evalúan solo sus líneas; con "Todos" se
  // muestra además el nivel de Cocina y de Bar por separado en cada inventario.
  const lineasCC = useMemo(() => (cc ? lineas.filter((l) => l.centro_costos === cc) : lineas), [lineas, cc]);
  const inventarios = useMemo(() => evaluarInventarios(lineasCC, margenes), [lineasCC, margenes]);
  const nivelPorCC = useMemo(() => {
    const m: Record<string, Map<string, number>> = {};
    for (const c of ['Cocina', 'Bar']) {
      m[c] = new Map(evaluarInventarios(lineas.filter((l) => l.centro_costos === c), margenes).map((i) => [i.clave, i.nivel]));
    }
    return m;
  }, [lineas, margenes]);
  const reglas = (['UNIDADES', 'COPAS', 'ONZAS', 'GRAMOS'] as UnidadMargen[])
    .map((u) => `${u.toLowerCase()} ${reglaTexto(margenes[u], u).toLowerCase()}`)
    .join(' · ');
  const columnas = 9 + (cc ? 0 : 2) + (puedeBorrar ? 1 : 0);
  const almacenes = useMemo(() => [...new Set(inventarios.map((i) => i.almacen))].sort(), [inventarios]);
  const visibles = inventarios.filter((i) => almacen === 'TODOS' || i.almacen === almacen);

  if (!lineas.length) return null;


  return (
    <div className="mb-6 rounded border border-linea bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-[17px] font-medium text-tinta">
            Nivel de confiabilidad por inventario{cc ? ` · ${cc}` : ''}
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            (1 − Ref. con diferencia ÷ Cantidad de referencias) × 100. Una referencia tiene diferencia cuando se sale del
            margen de error: {reglas}. Son los mismos márgenes del cobro (se cambian en Configuración de Cobro).
          </p>
        </div>
        <div className="flex items-end gap-2 text-xs">
          <label className="text-text-secondary">
            Almacén
            <select value={almacen} onChange={(e) => setAlmacen(e.target.value)} className="block mt-1 border border-brand-border rounded-lg px-2 py-1">
              <option value="TODOS">Todos</option>
              {almacenes.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {msg && <p className="text-xs text-blue-700 mb-2">{msg}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-secondary border-b border-brand-border">
              <th className="px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left">Almacén</th>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Documento</th>
              <th className="px-3 py-2 text-right">Total ref. con diferencia</th>
              <th className="px-3 py-2 text-right">Cantidad de referencias</th>
              <th className="px-3 py-2 text-center">Nivel de confiabilidad</th>
              {!cc && <th className="px-3 py-2 text-center">Cocina</th>}
              {!cc && <th className="px-3 py-2 text-center">Bar</th>}
              <th className="px-3 py-2 text-right">Faltantes (costo)</th>
              <th className="px-3 py-2 text-right">Sobrantes (costo)</th>
              {puedeBorrar && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((i) => (
              <React.Fragment key={i.clave}>
                <tr className="border-b border-brand-border hover:bg-slate-50 cursor-pointer" onClick={() => setAbierto(abierto === i.clave ? null : i.clave)}>
                  <td className="px-3 py-2">{abierto === i.clave ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                  <td className="px-3 py-2 font-bold">{i.almacen}</td>
                  <td className="px-3 py-2">{fechaCorta(i.fecha)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{i.serie}</td>
                  <td className="px-3 py-2 text-right">{i.conDiferencia}</td>
                  <td className="px-3 py-2 text-right">{i.referencias}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block min-w-[3rem] rounded-full px-2 py-0.5 font-black ${colorNivel(i.nivel)}`}>{Math.round(i.nivel)}</span>
                  </td>
                  {!cc &&
                    ['Cocina', 'Bar'].map((c) => {
                      const n = nivelPorCC[c].get(i.clave);
                      return (
                        <td key={c} className="px-3 py-2 text-center">
                          {n === undefined ? (
                            <span className="text-text-muted">—</span>
                          ) : (
                            <span className={`inline-block min-w-[2.5rem] rounded-full px-2 py-0.5 text-xs font-bold ${colorNivel(n)}`}>{Math.round(n)}</span>
                          )}
                        </td>
                      );
                    })}
                  <td className="px-3 py-2 text-right text-red-700">{pesos(i.faltanteValor)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{pesos(i.sobranteValor)}</td>
                  {puedeBorrar && (
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {porBorrar === i.clave ? (
                        <span className="text-xs">
                          ¿Borrar este inventario?{' '}
                          <button onClick={() => borrar(i.almacen, i.fecha, i.serie)} className="font-bold text-red-700 underline">
                            Sí
                          </button>{' '}
                          <button onClick={() => setPorBorrar(null)} className="underline">
                            No
                          </button>
                        </span>
                      ) : (
                        <button onClick={() => setPorBorrar(i.clave)} title="Borrar este inventario de la base" className="text-slate-400 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                {abierto === i.clave && (
                  <tr>
                    <td colSpan={columnas} className="bg-marca-suave/40 px-3 py-3">
                      <p className="text-xs font-bold text-text-main mb-2">
                        Novedades: {i.conDiferencia} referencias fuera del margen (ordenadas por el costo de lo que se sale
                        del margen)
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-text-secondary">
                            <th className="text-left py-1">Artículo</th>
                            <th className="text-left">Subfamilia</th>
                            <th className="text-left">Centro de costo</th>
                            <th className="text-left">Unidad</th>
                            <th className="text-right">Teórico</th>
                            <th className="text-right">Físico</th>
                            <th className="text-right">Diferencia</th>
                            <th className="text-right">Margen</th>
                            <th className="text-right">Fuera del margen</th>
                            <th className="text-right">Costo fuera del margen</th>
                            <th className="text-left pl-3">Revisar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {i.lineas
                            .filter((l) => l.conDiferencia)
                            .sort((a, b) => Math.abs(b.valorFueraMargen) - Math.abs(a.valorFueraMargen) || Math.abs(b.fueraMargen) - Math.abs(a.fueraMargen))
                            .map((l, k) => (
                              <tr key={k} className="border-t border-brand-border">
                                <td className="py-1">{l.articulo}</td>
                                <td>{l.subfamilia}</td>
                                <td>{l.centro_costos}</td>
                                <td>{l.subarticulo}</td>
                                <td className="text-right">{cant(l.stock_fecha)}</td>
                                <td className="text-right">{cant(l.stock_inventario)}</td>
                                <td className={`text-right font-bold ${l.diferencia < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{cant(l.diferencia)}</td>
                                <td className="text-right whitespace-nowrap">{l.tolerancia ? `±${cant(l.tolerancia)}` : 'Sin margen'}</td>
                                <td className={`text-right font-bold ${l.fueraMargen < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{cant(l.fueraMargen)}</td>
                                <td className={`text-right ${l.valorFueraMargen < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{pesos(l.valorFueraMargen)}</td>
                                <td className="pl-3">
                                  {l.alerta && (
                                    <span title={ETIQUETA_ALERTA[l.alerta].ayuda} className="whitespace-nowrap rounded-full bg-[#fff3e0] px-2 py-0.5 text-[10px] font-medium text-[#a84300]">
                                      {ETIQUETA_ALERTA[l.alerta].texto}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
