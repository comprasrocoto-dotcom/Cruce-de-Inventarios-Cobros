/**
 * Diccionario central de ayudas del proyecto.
 *
 * Cada entrada tiene un título y un contenido que se construye CON LOS DATOS
 * REALES del corte (los artículos ya filtrados), siguiendo el patrón del
 * dashboard de cocina: lenguaje llano + ejemplo verdadero, no inventado.
 *
 * Para agregar o corregir una explicación, se edita SOLO este archivo.
 */
import React from 'react';
import { ArticleSummary } from './types';
import {
  getReliabilitySummary,
  UMBRAL_COBRO_REVISION,
  aplicarPoliticaCobro,
} from './utils/inventory';

export interface HelpCtx {
  articles: ArticleSummary[];
}

// ─────────────────────────── Bloques visuales ───────────────────────────

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[13px] leading-relaxed">{children}</p>
);

/** Caja de EJEMPLO con datos reales del corte. */
const Ej: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-[#0a1a2d] border border-blue-900/50 rounded-lg px-3 py-2.5 text-[12.5px]">
    <span className="text-[#38BDF8] font-black text-[10px] uppercase tracking-widest block mb-1">
      Ejemplo con tus datos
    </span>
    {children}
  </div>
);

/** Caja de consejo práctico. */
const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-[#2d230f]/60 border border-amber-800/50 rounded-lg px-3 py-2.5 text-[12.5px] text-amber-200/90">
    💡 {children}
  </div>
);

const SinDatos = () => (
  <div className="bg-[#0d1b2a] border border-brand-border rounded-lg px-3 py-2.5 text-[12px] italic text-text-secondary">
    Carga un inventario para ver este ejemplo con tu propia información.
  </div>
);

// ─────────────────────────── Helpers de datos ───────────────────────────

const fmt$ = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const fmtN = (n?: number) =>
  n === undefined
    ? '—'
    : (n > 0 ? '+' : '') + n.toLocaleString('es-CO', { maximumFractionDigits: 1 });

const sedeMayorCobro = (arts: ArticleSummary[]) => {
  const porSede = new Map<string, number>();
  arts.forEach((a) => porSede.set(a.sede, (porSede.get(a.sede) || 0) + a.totalCobro));
  let mejor: [string, number] | null = null;
  porSede.forEach((v, k) => {
    if (!mejor || v > mejor[1]) mejor = [k, v];
  });
  return mejor as [string, number] | null;
};

const articuloMayorCobro = (arts: ArticleSummary[]) =>
  arts.filter((a) => a.debeCobrar).sort((a, b) => b.totalCobro - a.totalCobro)[0];

const ejemploToleranciaOnza = (arts: ArticleSummary[]) =>
  arts.find(
    (a) =>
      a.subarticulo.includes('ONZA') &&
      a.dentroDeTolerancia &&
      Math.abs(a.variacionUltimoCiclo ?? 0) === 1
  );

const primeroEnRevision = (arts: ArticleSummary[]) =>
  arts.filter((a) => a.requiereRevision).sort((a, b) => b.totalCobro - a.totalCobro)[0];

const totales = (arts: ArticleSummary[]) => ({
  n: arts.length,
  faltantes: arts.filter((a) => (a.variacionUltimoCiclo ?? a.totalDiferencia) < -0.0001).length,
  cobrables: arts.filter((a) => a.debeCobrar).length,
  cobro: arts.reduce((s, a) => s + a.totalCobro, 0),
  enRevision: arts.filter((a) => a.requiereRevision).length,
  subRecetas: arts.filter((a) => a.esSubReceta).length,
});

const fechasDelCorte = (arts: ArticleSummary[]) => {
  const fechas = new Set<string>();
  arts.forEach((a) => a.movements.forEach((m) => fechas.add(m.fecha.toISOString().slice(0, 10))));
  return [...fechas].sort();
};

// ─────────────────────────── Diccionario ───────────────────────────

export const AYUDAS: Record<
  string,
  { titulo: string; contenido: (ctx: HelpCtx) => React.ReactNode }
> = {
  // ══════════════ FILTROS ══════════════
  filtros: {
    titulo: 'Los filtros de arriba',
    contenido: ({ articles }) => {
      const t = totales(articles);
      return (
        <>
          <P>
            Los filtros son como un <b>embudo</b>: todo lo que ves abajo (tarjetas, tablas, cobros,
            confiabilidad) se calcula <b>solo con lo que pasa por el embudo</b>. Si algo "no
            aparece", casi siempre es porque un filtro lo está dejando por fuera.
          </P>
          <P>
            <b>Sede (Almacén):</b> muestra solo el inventario de esa sede. ·{' '}
            <b>Centro de Costos:</b> separa Bar, Cocina, etc. · <b>Subfamilia:</b> agrupa por tipo
            de producto (LICORES, PESCADOS…). · <b>Estado:</b> deja ver solo faltantes, sobrantes o
            cobrables. · <b>Buscador:</b> encuentra un artículo por nombre o código.
          </P>
          <P>
            Los filtros se <b>combinan entre sí</b>: si eliges sede MALANGA y estado "Faltantes",
            verás únicamente los faltantes de Malanga.
          </P>
          {articles.length > 0 ? (
            <Ej>
              Con los filtros actuales están pasando <b>{t.n} artículos</b> por el embudo, de los
              cuales <b>{t.cobrables}</b> generan cobro por {fmt$(t.cobro)}. Si cambias un filtro,
              estos números se recalculan al instante.
            </Ej>
          ) : (
            <SinDatos />
          )}
          <Tip>
            Si un total te parece raro, primero revisa qué filtros están activos y usa "Limpiar
            filtros" para volver a ver todo.
          </Tip>
        </>
      );
    },
  },

  fechas: {
    titulo: 'El rango de fechas',
    contenido: ({ articles }) => {
      const fechas = fechasDelCorte(articles);
      return (
        <>
          <P>
            Cada vez que una sede sube un inventario, el sistema le toma una <b>foto a esa fecha</b>
            . El rango de fechas decide <b>qué fotos entran al análisis</b>.
          </P>
          <P>
            Punto clave del negocio: el ERP ajusta el stock con cada carga, así que la variación de
            cada fecha es la pérdida o sobrante <b>de ese periodo</b> (entre un inventario y el
            anterior). Por eso, cuando el rango incluye varios inventarios, el cobro usa la{' '}
            <b>suma neta</b> de esos periodos: un sobrante de una semana compensa un faltante de
            otra, porque el responsable es el mismo.
          </P>
          <P>
            <b>¿Para qué sirve en la práctica?</b> Para auditar un solo inventario: pon "desde" y
            "hasta" en la misma fecha del conteo, y los cobros serán solo los de ese periodo — así
            no se cobra dos veces lo que ya se liquidó en una auditoría anterior.
          </P>
          {fechas.length > 0 ? (
            <Ej>
              En el corte actual hay inventarios de estas fechas: <b>{fechas.join(' · ')}</b>. Si
              filtras solo la última, auditas únicamente ese conteo.
            </Ej>
          ) : (
            <SinDatos />
          )}
        </>
      );
    },
  },

  cargar: {
    titulo: 'De dónde salen los datos',
    contenido: () => (
      <>
        <P>
          Al abrir la aplicación, los datos se cargan <b>automáticamente desde Google Sheets</b> (la
          hoja "BASE DE DATOS" que se alimenta con el export de HioPOS). Es la fuente principal y
          siempre está al día con lo último que se pegó allí.
        </P>
        <P>
          El botón <b>"Cargar Excel"</b> es la vía alterna: abre un panel para subir directamente un
          archivo <b>.xlsx</b> exportado del ERP (mismas 13 columnas). Útil para revisar un corte
          viejo o probar datos sin tocar la hoja compartida.
        </P>
        <P>
          <b>Regla de oro de los números:</b> el proyecto trabaja siempre con{' '}
          <b>punto como decimal y coma como miles</b> (ej: <code>16,251.20</code> son dieciséis mil
          pesos con veinte). Al descargar el plano del ERP, elige ese formato.
        </P>
        <Tip>
          Si cargas un Excel y luego quieres volver a la hoja, usa el botón de recarga de Google
          Sheets del mismo panel: los datos del Excel solo viven mientras dura la sesión.
        </Tip>
      </>
    ),
  },

  // ══════════════ RESUMEN ══════════════
  kpis: {
    titulo: 'Las tarjetas de arriba',
    contenido: ({ articles }) => {
      const t = totales(articles);
      const top = articuloMayorCobro(articles);
      return (
        <>
          <P>
            Son el <b>tablero del carro</b>: cuatro números que resumen todo el corte con los
            filtros activos.
          </P>
          <P>
            <b>Artículos revisados:</b> cuántos artículos entraron al cruce. ·{' '}
            <b>Artículos faltantes:</b> cuántos quedaron con diferencia negativa (contaron menos de
            lo que debía haber). · <b>Artículos cobrables:</b> de esos faltantes, cuántos superaron
            el margen de tolerancia y por eso generan cobro. · <b>Valor total a cobrar:</b> la plata
            que suman todos esos cobros. · <b>Artículos sobrantes:</b> los que contaron MÁS de lo
            que debía haber.
          </P>
          <P>
            <b>¿Y por qué vigilar los sobrantes si no se cobran?</b> Porque sobrar no es buena
            noticia: es el mismo síntoma de proceso roto que faltar. Las causas típicas (sobre todo
            en abarrotes): recetas preparadas sin registrar, compras recibidas sin cargar, errores
            de unidad al contar (la bolsa de 500 g anotada como kilo) o el mismo producto contado
            bajo otro código. El sobrante de hoy es el faltante de mañana — y además no se cobra el
            sobrante para evitar que alguien "fabrique" sobrantes de lo barato para tapar faltantes
            de lo caro.
          </P>
          <P>
            Fíjate que <b>faltante no es lo mismo que cobrable</b>: un faltante pequeño (dentro del
            margen permitido para su unidad) no se cobra. Por eso el tercer número siempre es menor
            o igual que el segundo.
          </P>
          {articles.length > 0 ? (
            <Ej>
              Ahora mismo: {t.n} revisados → {t.faltantes} con faltante → <b>{t.cobrables}</b>{' '}
              cobrables por <b>{fmt$(t.cobro)}</b>.
              {top && (
                <>
                  {' '}
                  El que más pesa es <b>{top.articulo}</b> ({top.sede}) con {fmt$(top.totalCobro)}.
                </>
              )}
              {t.enRevision > 0 && (
                <>
                  {' '}
                  Ojo: <b>{t.enRevision}</b> cobros tienen la marca ⚠ Revisar (ver ayuda de la tabla
                  de Cobros).
                </>
              )}
            </Ej>
          ) : (
            <SinDatos />
          )}
        </>
      );
    },
  },

  resumenSede: {
    titulo: 'Resumen por Sede',
    contenido: ({ articles }) => {
      const top = sedeMayorCobro(articles);
      return (
        <>
          <P>
            Cada tarjeta es <b>una sede vista de lejos</b>: cuántos artículos se revisaron, cuántos
            quedaron con faltante, cuántos generan cobro y el total de plata de esa sede.
          </P>
          <P>
            Sirve para responder rápido "<b>¿dónde está el problema?</b>" antes de entrar al
            detalle. La fila de <b>Sobrantes</b> (con su valor a costo) también cuenta: una sede con
            sobrantes altos casi siempre tiene recetas sin registrar o errores de unidad — no se
            cobra, pero es tarea de proceso. Una sede con muchos faltantes pero poco cobro tiene
            descuadres pequeños y repartidos; una con pocos faltantes pero cobro alto tiene el
            problema concentrado en productos caros.
          </P>
          <P>
            Los botones <b>Excel Jerárquico</b> y <b>PDF Cobros</b> exportan exactamente lo que está
            pasando por los filtros — lo que ves es lo que sale.
          </P>
          {top && top[1] > 0 ? (
            <Ej>
              La sede con más cobro en este corte es <b>{top[0]}</b> con <b>{fmt$(top[1])}</b>. Buen
              punto de partida para la auditoría.
            </Ej>
          ) : (
            <SinDatos />
          )}
        </>
      );
    },
  },

  // ══════════════ COBROS ══════════════
  cobros: {
    titulo: 'La tabla de cobros, pieza por pieza',
    contenido: ({ articles }) => {
      const ejOnza = ejemploToleranciaOnza(articles);
      const flag = primeroEnRevision(articles);
      const top = articuloMayorCobro(articles);
      return (
        <>
          <P>
            Aquí está el detalle artículo por artículo, agrupado por sede. Al expandir un artículo
            ves sus <b>movimientos por fecha</b>: cada tarjetica es un inventario y su variación de
            ese periodo.
          </P>
          <P>
            <b>Diferencia neta:</b> la suma de las variaciones de todos los inventarios del rango.
            Negativa (roja) = faltó producto; positiva (verde) = sobró. Como el ERP ajusta el stock
            en cada carga, sumar periodos es correcto: son pérdidas que no se pisan entre sí.
          </P>
          <P>
            <b>¿Cuándo cobra?</b> Solo si el neto es faltante <b>y</b> se pasa del margen de
            tolerancia de su unidad: <b>UNIDADES y COPAS</b> no tienen margen (lo contable se cuenta
            exacto); <b>ONZAS</b> perdonan ±1 (el "trago de la casa" del error de medición);{' '}
            <b>GRAMOS</b> perdonan el 2.5% del volumen teórico manejado (mermas normales de pesaje).
            Las <b>SUB.</b> (sub-recetas) nunca cobran: su variación es producción, no pérdida de
            alguien.
          </P>
          <P>
            <b>Total cobro</b> = faltante neto × costo unitario. El costo usa la <b>mediana</b> del
            artículo (resistente a costos dañados del ERP), y de respaldo el último costo.
          </P>
          <P>
            <b>La marca ⚠ Revisar</b> (ámbar) señala cobros que hay que{' '}
            <b>validar contra el ERP antes de descontar</b>: o el costo unitario es raro comparado
            con el mismo artículo en otras sedes (típico: costo del kilo cargado en una línea de
            gramos), o el monto supera el umbral de plausibilidad ({fmt$(UMBRAL_COBRO_REVISION)} por
            artículo). Pasa el mouse por la marca y verás el motivo exacto.
          </P>
          {articles.length > 0 ? (
            <Ej>
              {ejOnza && (
                <>
                  <b>{ejOnza.articulo}</b> ({ejOnza.sede}) quedó en{' '}
                  {fmtN(ejOnza.variacionUltimoCiclo)} onza: está dentro del ±1 permitido, por eso
                  dice "No cobra".
                  <br />
                </>
              )}
              {top && (
                <>
                  En cambio <b>{top.articulo}</b> ({top.sede}) se pasó del margen y cobra{' '}
                  {fmt$(top.totalCobro)}.
                </>
              )}
              {flag && (
                <>
                  <br />Y <b>{flag.articulo}</b> ({flag.sede}) trae ⚠ Revisar: {flag.motivoRevision}
                </>
              )}
            </Ej>
          ) : (
            <SinDatos />
          )}
          <P>
            <b>La pista "¿Confusión de códigos?"</b> (azul) aparece cuando un faltante cobrable
            tiene, en la misma sede y subfamilia, un sobrante fuerte en otro artículo. Es el patrón
            típico del mismo producto bajo dos referencias (ej. "QUESO X KILO" vs "QUESO BLOQUE"):
            se contó todo, pero en el código equivocado. El cobro podría ser injusto — pasa el mouse
            por la pista para ver el candidato y valida contra el ERP antes de descontar.
          </P>
          <Tip>
            El orden sano de la auditoría: primero resolver los ⚠ Revisar y las pistas de confusión
            contra HioPOS (suelen ser datos, no pérdidas) y después descontar el resto.
          </Tip>
        </>
      );
    },
  },

  recetas: {
    titulo: 'Recetas e Ingredientes (sobrantes fantasma)',
    contenido: ({ articles }) => {
      const t = totales(articles);
      return (
        <>
          <P>
            Esta sección junta dos mundos: el <b>inventario de HioPOS</b> y el{' '}
            <b>registro de recetas</b> de producción. Cada grupo es una receta (los artículos{' '}
            <b>SUB.</b>) con sus ingredientes debajo, tal como está registrada.
          </P>
          <P>
            <b>¿Para qué?</b> Para cazar el clásico "sobrante fantasma": cuando sobra mucha proteína
            en el conteo, casi nunca es que sobre de verdad — es que{' '}
            <b>alguien preparó la receta y no la registró</b>, así que el sistema cree que el
            ingrediente sigue crudo en la nevera.
          </P>
          <P>
            <b>Cómo leerla:</b> cada ingrediente muestra sus variaciones{' '}
            <b>por fecha de inventario</b> (chips: rojo faltó, verde sobró), y el encabezado de la
            receta muestra las <b>fechas en que se registró fabricación</b>. La sección{' '}
            <b>solo agrupa y muestra</b> — a propósito no intenta cuadrar cantidades entre receta e
            inventario (los rendimientos varían y varias recetas comparten ingrediente); el
            diagnóstico fino lo hace quien conoce la cocina, mirando las fechas lado a lado.
          </P>
          <P>
            <b>La alerta ⚠ SIN REGISTRO</b> se enciende sola cuando se cumplen las dos: hay
            ingredientes con sobrante fuera de tolerancia <b>y</b> la receta no tiene ninguna
            fabricación registrada en el rango. Traducción: antes de pensar en sobrante real,
            pregunta en cocina si se preparó y no se registró.
          </P>
          <P>
            La franja de arriba ("Recetas cruzadas X/Y") es el <b>control de calidad del cruce</b>:
            si algún código no empareja entre sistemas, lo ves ahí en vez de perder datos en
            silencio.
          </P>
          {t.subRecetas > 0 ? (
            <Ej>
              En este corte hay <b>{t.subRecetas} artículos SUB.</b> (recetas) en el inventario.
              Ninguno genera cobro directo — su papel aquí es explicar los sobrantes de sus
              ingredientes.
            </Ej>
          ) : (
            <SinDatos />
          )}
          <Tip>
            Activa "Solo alertas SIN REGISTRO" y tendrás la lista de tareas para cocina: recetas por
            registrar antes de la próxima auditoría.
          </Tip>
        </>
      );
    },
  },

  // ══════════════ ANÁLISIS ══════════════
  analisis: {
    titulo: 'Análisis de Variaciones',
    contenido: () => (
      <>
        <P>
          Es la misma información de Cobros pero con <b>lupa de exploración</b>: arriba la tabla
          completa para navegar movimientos, y abajo el bloque de análisis con <b>tres secciones</b>{' '}
          — cada una responde una pregunta distinta:
        </P>
        <P>
          <b>Variaciones:</b> ¿qué pasó, artículo por artículo? · <b>Consolidado:</b> ¿qué productos
          fallan sin importar la sede? · <b>Cobros:</b> ¿en qué se traduce en plata? Toca el{' '}
          <b>?</b> junto a esas pestañas para la explicación de cada una con tus datos.
        </P>
        <Tip>
          Combínala con el buscador: escribe un producto (ej. "salmón") y mira su comportamiento en
          todas las sedes a la vez.
        </Tip>
      </>
    ),
  },

  analisisAvanzado: {
    titulo: 'Resumen Ejecutivo por Sede',
    contenido: () => (
      <>
        <P>
          Estos bloques condensan el corte en <b>rankings y comparativos</b>: los productos con
          mayor impacto en plata, la distribución de faltantes/sobrantes y el pulso de cada sede en
          una sola vista.
        </P>
        <P>
          Regla de lectura importante: ordena siempre por <b>impacto en pesos</b>, no por
          porcentaje. Un descuadre del 40% en un condimento vale casi nada; uno del 4% en tu
          proteína principal puede ser millones al año.
        </P>
      </>
    ),
  },

  // ══════════════ CONFIABILIDAD ══════════════
  confiabilidad: {
    titulo: 'Confiabilidad: las DOS notas de cada sede',
    contenido: ({ articles }) => {
      let ejemplo: React.ReactNode = <SinDatos />;
      try {
        const rel = getReliabilitySummary(articles, 'sede');
        const peor = [...rel.sedesStats].sort((a, b) => a.confiabilidad - b.confiabilidad)[0];
        if (peor) {
          const problema =
            (peor.exactitudArticulos ?? 0) < (peor.exactitudValor ?? 0)
              ? 'su problema es de CONTEO (muchos artículos descuadrados)'
              : 'su problema es de PLATA (pocos artículos, pero caros, concentran la pérdida)';
          ejemplo = (
            <Ej>
              La sede más débil del corte es <b>{peor.sede}</b>: artículos{' '}
              <b>{peor.exactitudArticulos}%</b> · valor <b>{peor.exactitudValor}%</b> → nota final{' '}
              <b>{peor.confiabilidad}%</b> ({peor.nivel}). Como la nota más baja es la de{' '}
              {(peor.exactitudArticulos ?? 0) < (peor.exactitudValor ?? 0) ? 'artículos' : 'valor'},{' '}
              {problema}.
            </Ej>
          );
        }
      } catch {
        /* sin datos */
      }
      return (
        <>
          <P>
            A cada sede se le toman <b>dos notas distintas</b>, porque contar bien y cuidar la plata
            son habilidades diferentes:
          </P>
          <P>
            <b>Exactitud por Artículos:</b> de cada 100 artículos contados, cuántos quedaron dentro
            de su margen de tolerancia. Mide la <b>disciplina de conteo</b>.
          </P>
          <P>
            <b>Exactitud por Valor:</b> de cada $100 de inventario teórico, cuántos NO se desviaron
            en el conteo (los faltantes no se tapan con sobrantes: se suman los dos). Mide el{' '}
            <b>cuidado de la plata</b>.
          </P>
          <P>
            <b>La nota final es la MENOR de las dos.</b> ¿Por qué? Porque una sede puede contar
            perfecto 400 artículos baratos y aun así fugar millones en 5 productos caros — con una
            sola nota promedio eso quedaría escondido. Con dos notas, se ve de inmediato si el
            problema es de conteo o de plata, y el plan de acción es distinto en cada caso.
          </P>
          <P>
            Además, las <b>sub-recetas no entran</b> a estas notas: su variación es producción
            normal, no un error de conteo de la sede.
          </P>
          {ejemplo}
          <Tip>
            Los cobros con ⚠ Revisar también bajan la nota de valor. Corrige primero esos datos en
            HioPOS: la exactitud real de la sede puede ser mejor de lo que parece.
          </Tip>
        </>
      );
    },
  },

  niveles: {
    titulo: 'El semáforo: Confiable, Aceptable, Riesgo, Crítico',
    contenido: () => (
      <>
        <P>
          Los niveles siguen los <b>estándares de la industria de restaurantes</b> para la
          desviación entre inventario real y teórico:
        </P>
        <P>
          🟢 <b>Confiable (≥98%):</b> desviación menor al 2% — operación bien gestionada. · 🟡{' '}
          <b>Aceptable (95–98%):</b> desviación de 2 a 5% — normal, pero con espacio de mejora. · 🟠{' '}
          <b>Riesgo (90–95%):</b> desviación de 5 a 10% — hay que investigar ya. · 🔴{' '}
          <b>Crítico (&lt;90%):</b> más del 10% desviado — problema sistémico (registro, porciones,
          recetas sin registrar o pérdidas reales).
        </P>
        <P>
          Son umbrales exigentes a propósito: en un restaurante los márgenes son delgados y cada
          punto de desviación es plata que salió de la cocina sin una venta que la respalde.
        </P>
        <Tip>
          Que todas las sedes salgan en un nivel bajo no es motivo de pánico sino el punto de
          partida: el sistema te está mostrando por primera vez la foto completa. Lo importante es
          la tendencia corte a corte.
        </Tip>
      </>
    ),
  },

  confTecnico: {
    titulo: 'Informe Técnico de Márgenes',
    contenido: () => (
      <>
        <P>
          Es la vista de <b>referencia por artículo</b>: inventario inicial (teórico), variación,
          inventario final (contado), y el <b>margen de tolerancia exacto</b> que se le aplicó a
          cada uno con su regla ("±1 onza", "±2.5%", "Sin margen").
        </P>
        <P>
          Sirve para responder la pregunta que siempre llega en la auditoría: "
          <b>¿por qué a este sí le cobraron y a este no?</b>" — aquí está el número exacto del
          margen y de cuánto se pasó (o no).
        </P>
      </>
    ),
  },

  estabilidad: {
    titulo: 'Estabilidad de Productos',
    contenido: () => (
      <>
        <P>
          Mientras Cobros mira <b>un corte</b>, esta vista mira la <b>repetición</b>: qué productos
          se salen del margen una y otra vez, sin importar en qué sede.
        </P>
        <P>
          Un producto que falla siempre no es mala suerte: o su unidad de medida se presta a error,
          o su receta está mal parametrizada, o es goloso (se pierde caminando). El ranking por
          responsables complementa la lectura: si el patrón sigue a la persona y no al producto, el
          problema es de proceso o capacitación.
        </P>
        <Tip>
          Ataca primero los productos inestables que además son caros: arreglar uno solo puede mover
          más plata que diez baratos.
        </Tip>
      </>
    ),
  },

  confGerencial: {
    titulo: 'Dashboard Gerencial (predicciones)',
    contenido: () => (
      <>
        <P>
          Proyecta el comportamiento actual a <b>30 días</b>: si nada cambia, cuánta plata se
          perdería en el mes, qué insumos encabezan ese riesgo y cuántas alertas críticas hay
          abiertas.
        </P>
        <P>
          Es una <b>proyección, no una profecía</b>: asume que el ritmo de pérdida del corte se
          mantiene. Su valor es priorizar — el "Top Riesgo Financiero" es tu lista de batalla
          ordenada por plata.
        </P>
      </>
    ),
  },

  // ══════════════ OTRAS PESTAÑAS ══════════════
  gerencial: {
    titulo: 'Vista Gerencial',
    contenido: () => (
      <>
        <P>
          Es el <b>resumen para dirección</b>: los indicadores agregados del corte, la confiabilidad
          por sede o centro de costos, y los focos de pérdida — sin el detalle artículo por
          artículo.
        </P>
        <P>
          Alterna entre <b>Por Sede</b> y <b>Por CC</b> para cambiar el ángulo: la misma plata puede
          verse concentrada en una sede, o repartida entre sus centros (Bar vs Cocina), y esa
          diferencia cambia a quién le corresponde el plan de acción.
        </P>
      </>
    ),
  },

  trazabilidad: {
    titulo: 'Trazabilidad Histórica',
    contenido: ({ articles }) => {
      const fechas = fechasDelCorte(articles);
      return (
        <>
          <P>
            Muestra la <b>película en el tiempo</b>: cómo evolucionan las variaciones periodo a
            periodo, para distinguir un mal día de una tendencia.
          </P>
          <P>
            Recuerda que cada punto es un <b>periodo entre inventarios</b> (el ERP ajusta el stock
            en cada carga): una barra grande en una fecha significa "en ese periodo se perdió esto",
            no "desde el inicio de los tiempos".
          </P>
          {fechas.length > 1 ? (
            <Ej>
              Tu corte actual tiene <b>{fechas.length} fechas de inventario</b> ({fechas[0]} a{' '}
              {fechas[fechas.length - 1]}): suficiente para ver tendencia, no solo foto.
            </Ej>
          ) : (
            <SinDatos />
          )}
        </>
      );
    },
  },

  ejecutivo: {
    titulo: 'Dashboard Ejecutivo',
    contenido: () => (
      <>
        <P>
          La <b>página de portada</b> del corte: los grandes números y gráficas comparativas entre
          sedes, pensada para abrir una reunión o acompañar el informe.
        </P>
        <P>
          Todo respeta los filtros activos: si quieres el ejecutivo de una sola sede o de un solo
          inventario, filtra primero y esta vista se convierte en su portada.
        </P>
      </>
    ),
  },
  // ══════════════ CONFIGURACIÓN DE COBRO ══════════════
  configuracion: {
    titulo: 'Configuración de Cobro: reglas y política',
    contenido: ({ articles }) => {
      let vivo: React.ReactNode = <SinDatos />;
      try {
        if (articles.length > 0) {
          const tot = (pol: 'COMPLETO' | 'EXCEDENTE' | 'SIN_MARGEN') =>
            aplicarPoliticaCobro(articles, pol).reduce((s2, a) => s2 + a.totalCobro, 0);
          vivo = (
            <Ej>
              Con el corte actual, el total a cobrar bajo cada política sería:{' '}
              <b>cobro completo {fmt$(tot('COMPLETO'))}</b> · solo excedente{' '}
              <b>{fmt$(tot('EXCEDENTE'))}</b> · sin margen <b>{fmt$(tot('SIN_MARGEN'))}</b>. Cambia
              el selector y verás toda la app recalcularse con estos números.
            </Ej>
          );
        }
      } catch {
        /* sin datos */
      }
      return (
        <>
          <P>
            Esta tarjeta es <b>el contrato de la auditoría</b>: las reglas con las que se decide qué
            se cobra, visibles para que cualquier cobro sea defendible. Tiene dos partes:
          </P>
          <P>
            <b>1. Los márgenes de tolerancia — ahora EDITABLES.</b> Cada unidad tiene su regla, con
            dos modos: <b>± fijo</b> (un número de perdón en esa unidad, ej. ±3 onzas) o{' '}
            <b>% del teórico</b> (proporcional a cuánto se manejó en el horizonte; con piso de 100 g
            para que teóricos diminutos no colapsen el margen). Los predeterminados al abrir:{' '}
            <b>UNIDADES ±0</b> y <b>COPAS ±0</b> (lo contable se cuenta con los dedos),{' '}
            <b>ONZAS ±3</b> (el error del jigger) y <b>GRAMOS 2.5%</b> (mermas de pesaje). Puedes
            jugar: unidades con ±1, gramos fijo en 500 g, onzas al 2% — lo que tu operación decida.
          </P>
          <P>
            <b>Importante:</b> los cambios NO actúan hasta pulsar <b>"Aplicar configuración"</b>—
            verás la app recalcularse completa (cobros, banderas, alertas de recetas y también la{' '}
            <b>confiabilidad</b>, porque el margen ES el estándar técnico de exactitud). El botón{' '}
            <b>Predeterminados</b> devuelve el borrador a los valores de fábrica. La configuración
            activa queda impresa en el PDF y el Excel: un cobro sin su regla es indefendible.
          </P>
          <P>
            <b>2. La política de cobro</b> — qué hacer cuando el faltante supera el margen. Un
            ejemplo con números para ver la diferencia: teórico de <b>10.000 g</b> → margen ={' '}
            <b>250 g</b> → faltan <b>400 g</b> a $100 el gramo:
          </P>
          <P>
            · <b>Cobro completo:</b> superaste el margen, respondes por TODO → se cobran 400 g =
            $40.000. El margen es umbral del perdón, no mesada. · <b>Solo excedente:</b> los
            primeros 250 g siempre son merma del negocio → se cobran 150 g = $15.000. ·{' '}
            <b>Sin margen:</b> tolerancia cero → 400 g = $40.000, y además otro artículo con
            faltante de apenas 200 g (que antes se perdonaba) también entraría a cobrar.
          </P>
          {vivo}
          <Tip>
            La POLÍTICA no toca la confiabilidad (mide qué tan bien se cuenta, no cuánto se
            descuenta). Los MÁRGENES sí la tocan: son el estándar contra el que se mide el conteo.
            Si relajas márgenes, la nota sube — no porque cuenten mejor, sino porque bajaste la
            vara. Tenlo presente al comparar cortes.
          </Tip>
        </>
      );
    },
  },

  // ══════════════ ANÁLISIS: SECCIONES INTERNAS ══════════════
  avVariaciones: {
    titulo: 'Sección Variaciones',
    contenido: ({ articles }) => {
      const top = articles
        .filter((a) => !a.esSubReceta)
        .sort(
          (a, b) =>
            Math.abs(b.variacionUltimoCiclo ?? b.totalDiferencia) *
              (b.costeMediano || b.ultimoCoste || b.costePromedio || 0) -
            Math.abs(a.variacionUltimoCiclo ?? a.totalDiferencia) *
              (a.costeMediano || a.ultimoCoste || a.costePromedio || 0)
        )[0];
      return (
        <>
          <P>
            Responde "<b>¿qué pasó, artículo por artículo?</b>": el detalle de cada producto con su
            variación en el horizonte, para explorar con el buscador y los filtros.
          </P>
          <P>
            Léela en pesos, no en porcentajes: un descuadre del 40% en un condimento vale poco; uno
            del 4% en tu proteína estrella puede ser millones. Aquí es donde se encuentra el "hilo"
            del que tirar antes de ir a la sección de Cobros.
          </P>
          {top ? (
            <Ej>
              El artículo con mayor desviación en plata del corte es <b>{top.articulo}</b> (
              {top.sede}): {fmtN(top.variacionUltimoCiclo ?? top.totalDiferencia)} {top.subarticulo}
              .
            </Ej>
          ) : (
            <SinDatos />
          )}
        </>
      );
    },
  },

  avConsolidado: {
    titulo: 'Sección Consolidado',
    contenido: () => (
      <>
        <P>
          Responde "<b>¿qué productos fallan sin importar la sede?</b>": suma el mismo producto a
          través de todas las sedes del corte.
        </P>
        <P>
          Es la vista que separa dos problemas muy distintos: si un producto descuadra{' '}
          <b>en una sola sede</b>, el problema es de esa operación (conteo, robo, proceso local); si
          descuadra <b>en todas</b>, el problema es del producto — receta mal parametrizada en el
          POS, unidad de compra confusa (caja vs unidad), o porcionado sin estandarizar. La solución
          de lo primero es gestión de sede; la de lo segundo es corregir el maestro en el ERP una
          sola vez.
        </P>
        <Tip>
          Los productos que aparecen aquí arriba son los mejores candidatos para revisar su ficha en
          HioPOS antes de cobrarle a nadie.
        </Tip>
      </>
    ),
  },

  avCobros: {
    titulo: 'Sección Cobros (del Análisis)',
    contenido: ({ articles }) => {
      const t = totales(articles);
      return (
        <>
          <P>
            Responde "<b>¿en qué se traduce en plata?</b>": solo los artículos que generan cobro,
            con su cantidad faltante, costo unitario y valor, más el <b>total por sede</b> al final
            — la cifra que va a la liquidación.
          </P>
          <P>
            Se calcula con la <b>política de cobro activa</b> (mira la insignia amarilla en la
            pestaña Cobros o la tarjeta Configuración del Resumen): si cambias la política, estos
            valores cambian al instante.
          </P>
          {articles.length > 0 ? (
            <Ej>
              En el corte actual: <b>{t.cobrables}</b> artículos cobrables por{' '}
              <b>{fmt$(t.cobro)}</b>
              {t.enRevision > 0 ? (
                <>
                  {' '}
                  — de los cuales <b>{t.enRevision}</b> traen ⚠ Revisar: resuélvelos contra el ERP
                  antes de liquidar.
                </>
              ) : (
                '.'
              )}
            </Ej>
          ) : (
            <SinDatos />
          )}
        </>
      );
    },
  },
};
