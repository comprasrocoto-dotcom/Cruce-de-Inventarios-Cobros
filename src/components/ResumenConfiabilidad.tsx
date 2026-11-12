/**
 * Confiabilidad en el Resumen: por centro de costo, por sede, artículos más y
 * menos confiables, y la evolución de cada inventario en barras.
 *
 * Misma fórmula y márgenes de toda la app:
 *   Nivel = (1 − Ref. con diferencia ÷ Cantidad de referencias) × 100
 * Una referencia = un artículo en un inventario. Tiene diferencia cuando se sale
 * del margen de su unidad (el mismo del cobro). Respeta todos los filtros.
 */
import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { ArticleSummary } from '../types';
import { margenLinea } from '../utils/confiabilidad';

interface Acum {
  refs: number;
  dif: number;
}
const nivel = (a: Acum) => (a.refs ? (1 - a.dif / a.refs) * 100 : 0);
const colorNivel = (n: number) => (n >= 95 ? '#2e7d32' : n >= 80 ? '#f9a825' : n >= 60 ? '#ef6c00' : '#d32f2f');
const fondoNivel = (n: number) =>
  n >= 95 ? 'bg-emerald-100 text-emerald-800' : n >= 80 ? 'bg-yellow-100 text-yellow-800' : n >= 60 ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800';
const fechaCorta = (d: Date) => d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
// Azules del más antiguo (claro) al más reciente (oscuro).
const AZULES = ['#90caf9', '#42a5f5', '#1e88e5', '#1565c0', '#0d47a1', '#002f6c'];

interface Articulo extends Acum {
  articulo: string;
  sedes: Set<string>;
  valorFuera: number;
}

function calcular(data: ArticleSummary[]) {
  const porCC = new Map<string, Acum>();
  const porSede = new Map<string, Acum>();
  const porArticulo = new Map<string, Articulo>();
  const porInventario = new Map<string, Acum & { sede: string; fecha: Date; serie: string }>();

  for (const a of data) {
    const costo = a.costeMediano || a.ultimoCoste || a.costePromedio || 0;
    for (const m of a.movements ?? []) {
      if (m.tipoDocumento === 'AJUSTE') continue;
      if (!m.stockFecha && !m.stockInventario) continue;
      const diferencia = m.stockInventario - m.stockFecha;
      const exceso = Math.max(0, Math.abs(diferencia) - margenLinea(a.subarticulo, m.stockFecha));
      const conDif = exceso > 1e-9 ? 1 : 0;

      const sumar = <T extends Acum>(mapa: Map<string, T>, clave: string, nuevo: () => T) => {
        const v = mapa.get(clave) ?? nuevo();
        v.refs++;
        v.dif += conDif;
        mapa.set(clave, v);
        return v;
      };
      sumar(porCC, a.cc || 'Sin centro de costo', () => ({ refs: 0, dif: 0 }));
      sumar(porSede, a.sede, () => ({ refs: 0, dif: 0 }));
      const art = sumar(porArticulo, a.articulo, () => ({ refs: 0, dif: 0, articulo: a.articulo, sedes: new Set<string>(), valorFuera: 0 }));
      art.sedes.add(a.sede);
      art.valorFuera += exceso * costo;
      const fecha = new Date(m.fecha);
      const dia = fecha.toISOString().slice(0, 10);
      sumar(porInventario, `${a.sede}|${dia}|${m.serie ?? ''}`, () => ({ refs: 0, dif: 0, sede: a.sede, fecha, serie: m.serie ?? '' }));
    }
  }

  const cc = [...porCC].map(([nombre, v]) => ({ nombre, ...v, nivel: nivel(v) })).sort((x, y) => x.nombre.localeCompare(y.nombre));
  const sedes = [...porSede].map(([nombre, v]) => ({ nombre, ...v, nivel: nivel(v) })).sort((x, y) => y.nivel - x.nivel);

  // Ranking de artículos: solo los contados al menos 2 veces (si no hay, todos).
  const arts = [...porArticulo.values()].map((v) => ({ ...v, nivel: nivel(v) }));
  const base = arts.some((x) => x.refs >= 2) ? arts.filter((x) => x.refs >= 2) : arts;
  const masConfiables = [...base].sort((x, y) => y.nivel - x.nivel || y.refs - x.refs).slice(0, 5);
  const menosConfiables = [...base]
    .sort((x, y) => x.nivel - y.nivel || y.refs - x.refs || y.valorFuera - x.valorFuera)
    .slice(0, 5);

  // Evolución: por sede, sus inventarios en orden de fecha (1º, 2º, …).
  const invPorSede = new Map<string, (Acum & { fecha: Date; serie: string })[]>();
  for (const inv of porInventario.values()) {
    const l = invPorSede.get(inv.sede) ?? [];
    l.push(inv);
    invPorSede.set(inv.sede, l);
  }
  let maxInv = 0;
  const evolucion = [...invPorSede]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sede, invs]) => {
      invs.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
      maxInv = Math.max(maxInv, invs.length);
      const fila: Record<string, string | number> = { sede };
      invs.forEach((inv, i) => {
        fila[`inv${i}`] = Math.round(nivel(inv) * 10) / 10;
        fila[`fecha${i}`] = `${fechaCorta(inv.fecha)}${inv.serie ? ` · ${inv.serie}` : ''}`;
        fila[`refs${i}`] = `${inv.dif} de ${inv.refs} con diferencia`;
      });
      return fila;
    });

  return { cc, sedes, masConfiables, menosConfiables, evolucion, maxInv, minRefs: base === arts ? 1 : 2 };
}

const Tarjeta: React.FC<{ titulo: string; subtitulo?: string; children: React.ReactNode; className?: string }> = ({
  titulo,
  subtitulo,
  children,
  className = '',
}) => (
  <div className={`rounded border border-linea bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] ${className}`}>
    <h3 className="text-[16px] font-medium text-tinta">{titulo}</h3>
    {subtitulo && <p className="mt-0.5 mb-3 text-xs text-text-secondary">{subtitulo}</p>}
    {children}
  </div>
);

const BarraNivel: React.FC<{ nombre: string; nivel: number; refs: number; dif: number }> = ({ nombre, nivel, refs, dif }) => (
  <div>
    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
      <span className="truncate font-medium text-text-main">{nombre}</span>
      <span className="shrink-0 font-bold tabular-nums" style={{ color: colorNivel(nivel) }}>
        {nivel.toFixed(1)}%
      </span>
    </div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#eceff1]">
      <div className="h-full rounded-full" style={{ width: `${Math.max(nivel, 0.5)}%`, background: colorNivel(nivel) }} />
    </div>
    <p className="mt-0.5 text-[11px] text-text-secondary">
      {dif} de {refs} referencias con diferencia
    </p>
  </div>
);

export const ResumenConfiabilidad: React.FC<{ data: ArticleSummary[] }> = ({ data }) => {
  const r = useMemo(() => calcular(data), [data]);
  if (!r.sedes.length) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[17px] font-medium text-tinta">Nivel de confiabilidad</h2>
        <p className="text-xs text-text-secondary">
          (1 − Ref. con diferencia ÷ Cantidad de referencias) × 100 · una referencia es un artículo en un inventario y
          tiene diferencia cuando se sale de su margen de error · respeta los filtros de arriba.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 1. Centro de costo */}
        <Tarjeta titulo="Por centro de costo">
          <div className="space-y-4 pt-2">
            {r.cc.map((c) => (
              <BarraNivel key={c.nombre} nombre={c.nombre} nivel={c.nivel} refs={c.refs} dif={c.dif} />
            ))}
          </div>
        </Tarjeta>

        {/* 2. Sede */}
        <Tarjeta titulo="Por sede" className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 pt-2 md:grid-cols-2">
            {r.sedes.map((s) => (
              <BarraNivel key={s.nombre} nombre={s.nombre} nivel={s.nivel} refs={s.refs} dif={s.dif} />
            ))}
          </div>
        </Tarjeta>
      </div>

      {/* 3. Artículos más y menos confiables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[
          { titulo: 'Artículos más confiables', lista: r.masConfiables, Icono: ThumbsUp, color: '#2e7d32' },
          { titulo: 'Artículos menos confiables', lista: r.menosConfiables, Icono: ThumbsDown, color: '#d32f2f' },
        ].map(({ titulo, lista, Icono, color }) => (
          <Tarjeta
            key={titulo}
            titulo={titulo}
            subtitulo={`Contados al menos ${r.minRefs} ${r.minRefs === 1 ? 'vez' : 'veces'} en el filtro; en empate manda el que más se contó.`}
          >
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="text-left text-xs">
                  <th className="px-2 py-1.5">Artículo</th>
                  <th className="w-[64px] px-2 py-1.5 text-right">Conteos</th>
                  <th className="w-[64px] px-2 py-1.5 text-right">Con dif.</th>
                  <th className="w-[128px] px-2 py-1.5 text-right">Costo fuera</th>
                  <th className="w-[64px] px-2 py-1.5 text-center">Nivel</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((a) => (
                  <tr key={a.articulo} className="border-b border-linea">
                    <td className="px-2 py-1.5">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Icono className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                        <span className="min-w-0 truncate" title={`${a.articulo} · ${[...a.sedes].join(', ')}`}>
                          {a.articulo}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{a.refs}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{a.dif}</td>
                    <td className="truncate px-2 py-1.5 text-right tabular-nums text-text-secondary">
                      {a.valorFuera ? pesos(a.valorFuera) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`inline-block min-w-[3rem] rounded-full px-2 py-0.5 text-xs font-bold ${fondoNivel(a.nivel)}`}>
                        {Math.round(a.nivel)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        ))}
      </div>

      {/* 4. Evolución de cada inventario */}
      <Tarjeta
        titulo="Evolución de cada inventario"
        subtitulo="Nivel de confiabilidad de cada conteo por sede, del más antiguo (azul claro) al más reciente (azul oscuro). Pasa el mouse para ver la fecha."
      >
        <div style={{ height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={r.evolucion} margin={{ top: 24, right: 8, left: -8, bottom: 8 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke="#eceff1" />
              <XAxis dataKey="sede" tick={{ fontSize: 11 }} interval={0} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v, nombre, item) => {
                  const i = String(nombre).replace('inv', '');
                  const p = item.payload as Record<string, string>;
                  return [`${v}% · ${p[`refs${i}`]}`, p[`fecha${i}`]];
                }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend formatter={(v) => `${Number(String(v).replace('inv', '')) + 1}º inventario`} wrapperStyle={{ fontSize: 12 }} />
              {Array.from({ length: r.maxInv }, (_, i) => (
                <Bar key={i} dataKey={`inv${i}`} fill={AZULES[Math.min(i, AZULES.length - 1)]} radius={[3, 3, 0, 0]}>
                  <LabelList dataKey={`inv${i}`} position="top" formatter={(v) => (v == null ? '' : `${Math.round(Number(v))}`)} style={{ fontSize: 10, fill: '#424242' }} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>
    </div>
  );
};
