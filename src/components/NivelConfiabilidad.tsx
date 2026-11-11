/**
 * Nivel de confiabilidad por inventario: una fila por cada inventario subido
 * (almacén + fecha + serie), con su fórmula y sus novedades.
 *
 *   Nivel = (Cantidad de referencias − Total ref con diferencia) / Cantidad de referencias × 100
 *
 * Las tolerancias se leen de `cruce_configuracion` (compartidas por todos);
 * solo el administrador puede cambiarlas. Administrador y editor pueden borrar
 * un inventario (por ejemplo, uno subido por error).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { LineaInventario } from '../lib/inventariosSupabase';
import { evaluarInventarios, Tolerancias, TOLERANCIAS_DEFAULT } from '../lib/nivelConfiabilidad';
import { borrarInventario } from '../lib/subirInventario';

const pesos = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const cant = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n);
const fechaCorta = (f: string) => {
  const [a, m, d] = f.split('-');
  return `${d}/${m}/${a}`;
};
const colorNivel = (n: number) =>
  n >= 95 ? 'bg-emerald-100 text-emerald-800' : n >= 80 ? 'bg-yellow-100 text-yellow-800' : n >= 60 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800';

export const NivelConfiabilidad: React.FC<{
  lineas: LineaInventario[];
  /** Centro de costo elegido (Cocina o Bar); null = Todos. */
  cc?: string | null;
  onCambio?: () => void;
}> = ({ lineas, cc = null, onCambio }) => {
  const [tol, setTol] = useState<Tolerancias>(TOLERANCIAS_DEFAULT);
  const [borrador, setBorrador] = useState({ pct: '2.5', unidades: '2' });
  const [esAdmin, setEsAdmin] = useState(false);
  const [puedeBorrar, setPuedeBorrar] = useState(false);
  const [porBorrar, setPorBorrar] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [almacen, setAlmacen] = useState('TODOS');
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('cruce_configuracion')
      .select('tolerancia_pct, tolerancia_unidades')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const t = { pct: Number(data.tolerancia_pct), unidades: Number(data.tolerancia_unidades) };
        setTol(t);
        setBorrador({ pct: String(t.pct * 100), unidades: String(t.unidades) });
      });
    supabase.rpc('cruce_mi_rol').then(({ data }) => {
      setEsAdmin(data === 'admin');
      setPuedeBorrar(data === 'admin' || data === 'editor');
    });
  }, []);

  const guardar = async () => {
    const pct = Number(borrador.pct.replace(',', '.')) / 100;
    const unidades = Number(borrador.unidades.replace(',', '.'));
    if (!(pct >= 0) || !(unidades >= 0)) return setMsg('Valores inválidos.');
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('cruce_configuracion')
      .update({ tolerancia_pct: pct, tolerancia_unidades: unidades, actualizado_por: u.user?.email, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (error) return setMsg(`No se guardó: ${error.message}`);
    setTol({ pct, unidades });
    setMsg('Tolerancias guardadas para todos los usuarios.');
  };

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
  const inventarios = useMemo(() => evaluarInventarios(lineasCC, tol), [lineasCC, tol]);
  const nivelPorCC = useMemo(() => {
    const m: Record<string, Map<string, number>> = {};
    for (const c of ['Cocina', 'Bar']) {
      m[c] = new Map(evaluarInventarios(lineas.filter((l) => l.centro_costos === c), tol).map((i) => [i.clave, i.nivel]));
    }
    return m;
  }, [lineas, tol]);
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
            (Cantidad de referencias − Ref. con diferencia) ÷ Cantidad de referencias × 100. Diferencia = fuera de ±
            {cant(tol.pct * 100)}% en gramos/onzas o fuera de ±{cant(tol.unidades)} en unidades/copas.
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
          {esAdmin && (
            <>
              <label className="text-text-secondary">
                % gramos/onzas
                <input value={borrador.pct} onChange={(e) => setBorrador({ ...borrador, pct: e.target.value })} className="block mt-1 w-20 border border-brand-border rounded-lg px-2 py-1" />
              </label>
              <label className="text-text-secondary">
                ± unidades/copas
                <input value={borrador.unidades} onChange={(e) => setBorrador({ ...borrador, unidades: e.target.value })} className="block mt-1 w-20 border border-brand-border rounded-lg px-2 py-1" />
              </label>
              <button onClick={guardar} className="flex items-center gap-1 rounded-sm bg-marca px-3 py-1.5 font-medium text-white hover:bg-marca-hover" title="Guardar tolerancias para todos">
                <Save className="w-3.5 h-3.5" /> Guardar
              </button>
            </>
          )}
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
                        Novedades: {i.conDiferencia} referencias fuera de tolerancia (ordenadas por impacto en costo)
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
                            <th className="text-right">Tolerancia</th>
                            <th className="text-right">Costo diferencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {i.lineas
                            .filter((l) => l.conDiferencia)
                            .sort((a, b) => Math.abs(b.valorDiferencia) - Math.abs(a.valorDiferencia))
                            .map((l, k) => (
                              <tr key={k} className="border-t border-brand-border">
                                <td className="py-1">{l.articulo}</td>
                                <td>{l.subfamilia}</td>
                                <td>{l.centro_costos}</td>
                                <td>{l.subarticulo}</td>
                                <td className="text-right">{cant(l.stock_fecha)}</td>
                                <td className="text-right">{cant(l.stock_inventario)}</td>
                                <td className={`text-right font-bold ${l.diferencia < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{cant(l.diferencia)}</td>
                                <td className="text-right">±{cant(l.tolerancia)}</td>
                                <td className={`text-right ${l.valorDiferencia < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{pesos(l.valorDiferencia)}</td>
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
