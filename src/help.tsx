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
          Al abrir la aplicación, los datos se cargan <b>automáticamente desde Supabase</b>: la base
          propia del Cruce, donde queda guardado cada inventario que se sube.
        </P>
        <P>
          El botón <b>"Subir inventario"</b> recibe el archivo <b>.csv</b> o <b>.xlsx</b> exportado de
          HioPOS y lo guarda en la base para todos. Si se sube otra vez el mismo inventario (misma
          fecha, serie y almacén), se reemplaza en vez de duplicarse.
        </P>
        <P>
          <b>Regla de oro de los números:</b> el proyecto trabaja siempre con{' '}
          <b>punto como decimal y coma como miles</b> (ej: <code>16,251.20</code> son dieciséis mil
          pesos con veinte). Al descargar el plano del ERP, elige ese formato.
        </P>
        <Tip>
          Usa "Recargar desde Supabase" para traer los inventarios que otros usuarios hayan subido
          mientras tenías la página abierta.
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

  // ══════════════ CONFIABILIDAD (manual del analista) ══════════════
  confiabilidad: {
    titulo: 'Confiabilidad: el manual completo',
    contenido: ({ articles }) => {
      let ejemplo: React.ReactNode = <SinDatos />;
      try {
        const rel = getReliabilitySummary(articles, 'sede');
        const orden = [...rel.sedesStats].sort((a, b) => a.confiabilidad - b.confiabilidad);
        const peor = orden[0];
        const mejor = orden[orden.length - 1];
        if (peor) {
          ejemplo = (
            <Ej>
              En tu corte: la sede más débil es <b>{peor.sede}</b> (artículos{' '}
              <b>{peor.exactitudArticulos}%</b> · valor <b>{peor.exactitudValor}%</b> → nota{' '}
              <b>{peor.confiabilidad}%</b>, {peor.nivel}). Su lado flojo es{' '}
              {(peor.exactitudArticulos ?? 0) < (peor.exactitudValor ?? 0)
                ? 'el CONTEO: muchos artículos quedan fuera de su margen, aunque la plata desviada no sea tanta. Plan: disciplina de conteo (dobles conteos, básculas calibradas, cierre de cocina antes de contar).'
                : 'la PLATA: cuenta bien la mayoría de artículos, pero los pocos que fallan son caros. Plan: conteo dedicado a los 20 productos de mayor valor (proteínas, licores premium).'}
              {mejor && mejor.sede !== peor.sede && (
                <>
                  {' '}
                  La mejor es <b>{mejor.sede}</b> ({mejor.confiabilidad}%): vale la pena preguntarle
                  qué hace distinto.
                </>
              )}
            </Ej>
          );
        }
      } catch {
        /* sin datos */
      }
      return (
        <>
          <P>
            <b>¿Qué pregunta responde esta pestaña?</b> "¿Puedo confiar en los inventarios de cada
            sede para tomar decisiones (compras, cobros, costos de venta)?" Un inventario poco
            confiable contamina TODO lo que se calcula con él — por eso esta vista existe antes que
            cualquier cobro.
          </P>
          <P>
            <b>Cómo se construye la nota (paso a paso):</b> a cada artículo se le compara su conteo
            físico contra el teórico del ERP, con su margen de tolerancia (ver Configuración de
            Cobro). Con eso se calculan DOS exactitudes por sede:
          </P>
          <P>
            <b>① Exactitud por Artículos</b> = de cada 100 artículos contados, cuántos quedaron
            dentro de su margen. Mide la <b>disciplina de conteo</b> del equipo: si está baja, el
            problema es humano/proceso (conteos apurados, unidades confundidas, cocina operando
            mientras se cuenta).
          </P>
          <P>
            <b>② Exactitud por Valor</b> = de cada $100 de inventario teórico, cuántos NO se
            desviaron. Aquí los faltantes NO se tapan con sobrantes: se suman ambos en valor
            absoluto (estándar IRA de la industria — un inventario que "sobra" es tan poco confiable
            como uno que falta). Mide el <b>cuidado de la plata</b>.
          </P>
          <P>
            <b>③ La nota final es la MENOR de las dos.</b> ¿Por qué la menor y no el promedio?
            Porque el promedio esconde: una sede puede contar perfecto 400 artículos baratos (①=95%)
            y fugar millones en 5 caros (②=60%) — promediando saldría "aceptable" y el hueco
            seguiría abierto. Tomando la menor, la dimensión enferma siempre queda a la vista, y el
            plan de acción es distinto según cuál sea (ver ejemplo abajo).
          </P>
          <P>
            <b>Qué NO entra a la nota:</b> las sub-recetas (SUB.) — su variación es producción
            normal, no error de conteo. Y qué SÍ la afecta sin ser culpa de la sede: los cobros con
            ⚠ Revisar (costos dañados del ERP) inflan la desviación en valor — resuélvelos primero y
            la nota real puede ser mejor.
          </P>
          <P>
            <b>El resto de la pantalla:</b> las tarjetas de arriba (mejor/peor sede, mayor impacto),
            el selector de sub-reporte (Reporte General · Top Pérdidas · Top Ganancias · Riesgo
            Operativo), las barras de confiabilidad por sede, la clasificación por nivel de riesgo y
            las conclusiones automáticas del sistema. Todo obedece a los filtros activos: filtra una
            sede o una subfamilia y la nota se recalcula solo con ese corte.
          </P>
          {ejemplo}
          <Tip>
            Regla de oro del analista: la nota NO se compara entre cortes con configuraciones de
            margen distintas (relajar márgenes sube la nota sin que nadie cuente mejor). Compara
            siempre con la misma vara.
          </Tip>
        </>
      );
    },
  },

  niveles: {
    titulo: 'El semáforo: qué significa cada nivel y qué hacer',
    contenido: () => (
      <>
        <P>
          Los niveles siguen los{' '}
          <b>estándares de exactitud de inventario (IRA) de la industria de restaurantes</b>. La
          lectura correcta no es "qué color me tocó" sino "qué acción dispara cada color":
        </P>
        <P>
          🟢 <b>Confiable (≥98%)</b> — desviación menor al 2%. El inventario sirve para decidir:
          compras automáticas, costos de venta, cobros sin discusión. Acción: mantener y reconocer
          al equipo.
        </P>
        <P>
          🟡 <b>Aceptable (95–98%)</b> — desviación de 2 a 5%. Normal en operaciones reales, pero
          con fuga lenta. Acción: identificar los 5-10 artículos que concentran la desviación (casi
          siempre el 80% está en el 20% de los productos) y atacarlos puntual.
        </P>
        <P>
          🟠 <b>Riesgo (90–95%)</b> — desviación de 5 a 10%. Las decisiones tomadas con este
          inventario ya tienen error material: los pedidos se inflan o se quiebran, los costos de
          receta mienten. Acción: investigar YA — conteo de verificación en caliente sobre los
          artículos top y revisión del proceso de conteo (¿quién cuenta?, ¿con qué báscula?, ¿la
          cocina sigue operando mientras se cuenta?).
        </P>
        <P>
          🔴 <b>Crítico (&lt;90%)</b> — más del 10% desviado. El inventario ya no describe la
          realidad: es un problema SISTÉMICO, no de un mal día. Causas típicas en restaurantes:
          recetas sin registrar en producción (revisa la sección Recetas y sus alertas ⚠ SIN
          REGISTRO), ventas que no descargan la receta en el POS, unidades de compra confusas, o
          pérdidas reales. Acción: intervención con plan y fecha, no regaño.
        </P>
        <P>
          <b>¿Por qué la vara es tan exigente?</b> Porque en un restaurante el margen neto suele ser
          un dígito: cada punto porcentual de inventario desviado es plata que salió de la cocina
          sin una venta que la respalde. Con 5% de desviación sostenida, la utilidad del mes puede
          irse completa por el sifón.
        </P>
        <Tip>
          Si TODAS las sedes salen bajas en el primer corte, no es motivo de pánico: es la línea
          base. El indicador que importa desde hoy es la <b>tendencia</b> — corte a corte, con la
          misma configuración de márgenes (pestaña Trazabilidad).
        </Tip>
      </>
    ),
  },

  confTecnico: {
    titulo: 'Informe Técnico de Márgenes — el soporte de cada cobro',
    contenido: () => (
      <>
        <P>
          Es la <b>vista de defensa de la auditoría</b>: artículo por artículo, muestra el
          inventario inicial (teórico), la variación, el inventario final (contado), el{' '}
          <b>margen de tolerancia EXACTO en números</b> que se le aplicó, y la regla que lo generó
          ("±3 onza(s)", "±2.5% del teórico", "Sin margen").
        </P>
        <P>
          <b>¿Cuándo la usa un analista?</b> Cada vez que llega LA pregunta: "¿por qué a este
          artículo sí le cobraron y a este otro no, si a ambos les faltó?". La respuesta está aquí
          en números: uno se pasó de su margen y el otro no. Sin esta vista, la respuesta es "porque
          el sistema lo dice" — con ella, es matemática verificable delante del responsable.
        </P>
        <P>
          <b>Detalle importante del margen porcentual (GRAMOS):</b> la base es el teórico del
          HORIZONTE filtrado (la suma de |Stock a Fecha| de los inventarios del rango), con piso de
          100 g. Por eso el mismo producto puede tener margen distinto en dos sedes: manejan
          volúmenes distintos — al que mueve 40 kg se le perdona más gramaje que al que mueve 2 kg,
          proporcionalmente lo mismo.
        </P>
        <Tip>
          Antes de una reunión de descargos, exporta o captura esta vista filtrada al artículo en
          disputa: la conversación cambia cuando el margen y el exceso están en números y no en
          opiniones.
        </Tip>
      </>
    ),
  },

  estabilidad: {
    titulo: 'Estabilidad de Productos — el reincidente y el patrón',
    contenido: () => (
      <>
        <P>
          Mientras Cobros mira <b>una foto</b>, esta vista mira <b>la película</b>: qué productos se
          salen del margen UNA Y OTRA VEZ a lo largo de los conteos, y qué responsables repiten
          patrón. Un descuadre aislado es ruido; un descuadre que se repite es una causa esperando
          ser encontrada.
        </P>
        <P>
          <b>Cómo leer el ranking de productos:</b> el que falla siempre no es mala suerte. Las
          causas, en orden de frecuencia real en restaurantes: (1) su unidad se presta a error — se
          compra por caja, se cuenta por unidad, se consume por gramo; (2) su receta está mal
          parametrizada en el POS y descarga de más o de menos en cada venta; (3) es "goloso" —
          producto que se pierde caminando (licores premium, proteínas porcionadas); (4) merma
          natural no reconocida (deshidratación, goteo). Cada causa tiene arreglo distinto, y las
          tres primeras NO se arreglan cobrando.
        </P>
        <P>
          <b>Cómo leer el ranking de responsables:</b> con cuidado y en pareja con el de productos.
          Si el patrón sigue al PRODUCTO (falla con cualquier responsable), el problema es del
          producto. Si sigue a la PERSONA (varios productos fallan solo en sus conteos), el problema
          es de capacitación o proceso — y la conversación es de entrenamiento antes que de
          descuento.
        </P>
        <Tip>
          Prioriza por plata: arreglar UN producto inestable y caro (un salmón, un whisky) mueve más
          pesos que arreglar diez condimentos. El orden de batalla sale de cruzar frecuencia ×
          costo.
        </Tip>
      </>
    ),
  },

  confGerencial: {
    titulo: 'Dashboard Gerencial (predicciones a 30 días)',
    contenido: () => (
      <>
        <P>
          Toma el ritmo de pérdida del corte actual y lo <b>proyecta a 30 días</b>: si nada cambia,
          cuánta plata se perdería en el mes, qué insumos encabezan ese riesgo y cuántas alertas
          críticas están abiertas.
        </P>
        <P>
          <b>De dónde sale el número:</b> la pérdida del horizonte filtrado se lleva a ritmo mensual
          (regla de tres sobre los días del corte). Por eso los tres bloques se leen juntos: la{' '}
          <b>proyección total</b> da la magnitud del incendio, el <b>Top de insumos en riesgo</b>{' '}
          dice dónde están las llamas (ordenado por plata mensualizada, no por porcentaje), y las{' '}
          <b>alertas críticas</b> cuentan cuántos frentes están abiertos a la vez — si son muchos,
          el problema es de proceso general, no de productos sueltos.
        </P>
        <P>
          <b>Cómo leerla sin engañarse:</b> es una proyección lineal, no una profecía — asume que el
          comportamiento del corte se mantiene. Su valor NO es adivinar el futuro sino{' '}
          <b>priorizar el presente</b>: el "Top Riesgo Financiero" es la lista de batalla ordenada
          por plata mensualizada, que es el idioma en que gerencia decide. "Este producto pierde
          $80.000 por corte" suena menor; "este producto va a perder $2.4 millones este mes si nadie
          lo toca" consigue presupuesto.
        </P>
        <P>
          <b>Trampa a evitar:</b> si el corte filtrado es muy corto (un solo inventario) o atípico
          (semana de fiesta, cierre por remodelación), la proyección hereda esa distorsión. Proyecta
          sobre horizontes representativos — dos o más ciclos normales.
        </P>
        <Tip>
          Úsala para abrir la reunión mensual: tres números (proyección total, top insumo, alertas
          críticas) y de ahí a los planes. El detalle fino vive en las otras pestañas.
        </Tip>
      </>
    ),
  },

  // ══════════════ OTRAS PESTAÑAS (manual del analista) ══════════════
  gerencial: {
    titulo: 'Vista Gerencial — el ranking de control',
    contenido: ({ articles }) => {
      let ejemplo: React.ReactNode = <SinDatos />;
      try {
        const rel = getReliabilitySummary(articles, 'sede');
        const criticas = rel.sedesStats.filter((s) => s.nivel === 'Crítico').length;
        if (rel.sedesStats.length > 0) {
          ejemplo = (
            <Ej>
              En tu corte: {rel.sedesStats.length} sedes evaluadas, <b>{criticas}</b> en nivel
              Crítico. El Top de impacto económico te dice a cuál entrarle primero.
            </Ej>
          );
        }
      } catch {
        /* sin datos */
      }
      return (
        <>
          <P>
            Es el <b>tablero de dirección</b>: cuántas sedes (o centros de costos) están Confiables,
            en Alerta o Críticas; el ranking de control y auditoría; y el Top 5 de mayor impacto
            económico. Sin detalle artículo por artículo — esa es tarea de las otras vistas; aquí se
            decide DÓNDE poner la atención esta semana.
          </P>
          <P>
            <b>El interruptor Por Sede / Por CC es más importante de lo que parece:</b> la misma
            plata perdida puede verse concentrada en "la sede X" (→ el plan es con su administrador)
            o repartida entre "Bar" y "Cocina" de varias sedes (→ el plan es con el proceso de esa
            área en toda la cadena). Cambiar el ángulo cambia el responsable del plan — míralo de
            las dos formas antes de asignar tareas.
          </P>
          <P>
            <b>Umbrales del ranking:</b> Excelente ≥98 · Aceptable ≥90 · Riesgo ≥80 · debajo,
            Crítico. Nota para el analista: estos cortes son los de gestión gerencial; la pestaña
            CONFIABILIDAD usa la escala fina de industria (98/95/90) con la nota dual. No te alarmes
            si un mismo dato "cambia de color" entre vistas — están midiendo con lentes de distinta
            graduación a propósito.
          </P>
          {ejemplo}
          <Tip>
            Para el comité: entra con esta vista (dónde), sigue con Confiabilidad (por qué: ¿conteo
            o plata?) y cierra con Cobros (cuánto y a quién). Tres pestañas, una historia.
          </Tip>
        </>
      );
    },
  },

  trazabilidad: {
    titulo: 'Trazabilidad Histórica — la película, no la foto',
    contenido: ({ articles }) => {
      const fechas = fechasDelCorte(articles);
      return (
        <>
          <P>
            Ordena los conteos en el tiempo y muestra, <b>periodo a periodo</b>: artículos
            evaluados, con y sin diferencia, % de confiabilidad, impacto en $ y la variación contra
            el periodo anterior — más las curvas de Evolución General y por Sede, y la etiqueta de
            tendencia (Mejorando / Empeorando).
          </P>
          <P>
            <b>El concepto que hay que tener claro para leerla:</b> cada punto es un{' '}
            <b>PERIODO ENTRE INVENTARIOS</b>, no un acumulado. Como el ERP ajusta el stock en cada
            carga, la barra del 24 de junio significa "esto pasó ENTRE el conteo anterior y el 24",
            no "esto se ha perdido desde siempre". Por eso los periodos se pueden comparar entre sí
            limpiamente.
          </P>
          <P>
            <b>Para qué la usa un analista:</b> (1) separar el mal día de la tendencia — un pico
            aislado se investiga como evento (¿hubo fiesta?, ¿cambió el que cuenta?); una pendiente
            sostenida se ataca como proceso; (2) <b>medir si las intervenciones funcionan</b> —
            capacitaste al equipo el día 15: la curva después del 15 es tu evidencia; (3) detectar
            estacionalidad (los fines de quincena pierden más).
          </P>
          <P>
            <b>Trampa clásica:</b> comparar periodos de longitudes muy distintas (3 días vs 15 días)
            en valores absolutos — el largo siempre "pierde más". Compara en % de confiabilidad o
            normaliza mentalmente por días.
          </P>
          {fechas.length > 1 ? (
            <Ej>
              Tu corte tiene <b>{fechas.length} fechas de inventario</b> ({fechas[0]} →{' '}
              {fechas[fechas.length - 1]}): suficiente para hablar de tendencia y no solo de foto.
            </Ej>
          ) : (
            <SinDatos />
          )}
        </>
      );
    },
  },

  ejecutivo: {
    titulo: 'Dashboard Ejecutivo — la portada del corte',
    contenido: ({ articles }) => {
      const t = totales(articles);
      const top = sedeMayorCobro(articles);
      return (
        <>
          <P>
            La <b>página de portada</b>: los grandes números del corte, las comparativas entre
            sedes, la clasificación por severidad y los productos de mayor impacto — pensada para
            abrir una reunión o encabezar el informe que se envía. Desde aquí también se exportan el
            Excel y el PDF ejecutivos.
          </P>
          <P>
            <b>Cómo presentarla en 90 segundos:</b> (1) el total del corte y cuántos artículos lo
            generan — la magnitud; (2) la comparativa entre sedes — dónde se concentra; (3) la
            clasificación por severidad — cuántos focos son críticos vs manejables; (4) cierre con
            la acción: "los tres focos de esta semana son…". Los porqués viven en Confiabilidad y el
            detalle en Cobros — no los presentes desde aquí o la reunión se hunde en filas.
          </P>
          <P>
            <b>Truco del filtro:</b> todo obedece a los Filtros Avanzados. ¿Necesitas el ejecutivo
            de UNA sede para su administrador, o de un solo inventario para el comité? Filtra
            primero y esta vista se convierte en esa portada exacta — y sus exportes salen igual de
            filtrados.
          </P>
          {articles.length > 0 && top ? (
            <Ej>
              Portada de tu corte actual: <b>{t.n}</b> artículos revisados, <b>{t.cobrables}</b>{' '}
              cobrables por <b>{fmt$(t.cobro)}</b>; la sede que concentra más es <b>{top[0]}</b> con{' '}
              {fmt$(top[1])}
              {t.enRevision > 0 ? (
                <>
                  {' '}
                  — y ojo: <b>{t.enRevision}</b> cobros traen ⚠ Revisar; menciónalo antes de que te
                  lo pregunten.
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

  // ══════════════ ANÁLISIS: SECCIONES INTERNAS (5) ══════════════
  avVariaciones: {
    titulo: 'Sección Variaciones — ¿qué pasó, artículo por artículo?',
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
            Es la <b>mesa de trabajo del auditor</b>: cada producto con su faltante total del corte,
            su última fecha de conteo y su valor. Aquí no se decide nada todavía — se <b>explora</b>{' '}
            para encontrar el hilo del que tirar.
          </P>
          <P>
            <b>Cómo se usa bien:</b> ordena mentalmente por plata, no por cantidad ni porcentaje.
            Perder 40% de un condimento de $2.000 el kilo es anécdota; perder 4% del salmón es
            hemorragia. Y usa el campo de filtro del listado para aterrizar en un producto o sede
            sin mover los Filtros Avanzados globales.
          </P>
          {top ? (
            <Ej>
              El mayor desvío en plata del corte actual es <b>{top.articulo}</b> ({top.sede}):{' '}
              {fmtN(top.variacionUltimoCiclo ?? top.totalDiferencia)} {top.subarticulo}. Por ahí
              empezaría la auditoría.
            </Ej>
          ) : (
            <SinDatos />
          )}
        </>
      );
    },
  },

  avConsolidado: {
    titulo: 'Sección Consolidado — ¿el problema es la sede o el producto?',
    contenido: () => (
      <>
        <P>
          Suma el <b>mismo producto a través de todas las sedes</b> del corte. Es la sección que
          responde la pregunta más importante del diagnóstico: ¿este descuadre sigue a la sede o
          sigue al producto?
        </P>
        <P>
          <b>Si descuadra en UNA sede:</b> el problema es de esa operación — conteo flojo, porciones
          sin estandarizar, pérdida local. El plan de acción es con el administrador de esa sede. ·{' '}
          <b>Si descuadra en TODAS:</b> el problema vive en el producto — receta mal parametrizada
          en el POS, unidad de compra confusa (caja vs unidad vs kilo), o merma natural no
          reconocida. El plan de acción es corregir el maestro en HioPOS <b>una sola vez</b>, y
          todas las sedes mejoran juntas.
        </P>
        <Tip>
          Antes de cobrarle a alguien un producto que falla en todas las sedes, revisa su ficha en
          el ERP: castigar a seis administradores por una receta mal montada sale carísimo en
          confianza.
        </Tip>
      </>
    ),
  },

  avCobros: {
    titulo: 'Sección Cobros — ¿en qué se traduce en plata?',
    contenido: ({ articles }) => {
      const t = totales(articles);
      return (
        <>
          <P>
            El final del embudo: <b>solo los artículos que generan cobro</b>, con cantidad faltante,
            costo unitario y valor, más el <b>total por sede</b> — la cifra que va a la liquidación
            de cada responsable.
          </P>
          <P>
            Se calcula con la <b>política y márgenes activos</b> (la insignia amarilla de la pestaña
            Cobros dice cuáles): si cambias la Configuración de Cobro en el Resumen, estos valores
            se regeneran al instante.
          </P>
          {articles.length > 0 ? (
            <Ej>
              Corte actual: <b>{t.cobrables}</b> cobrables por <b>{fmt$(t.cobro)}</b>
              {t.enRevision > 0 ? (
                <>
                  {' '}
                  — <b>{t.enRevision}</b> con ⚠ Revisar que debes resolver contra el ERP ANTES de
                  liquidar.
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

  avEjecutivo: {
    titulo: 'Resumen Ejecutivo por Sede — la boleta de calificaciones',
    contenido: ({ articles }) => {
      // Réplica del cálculo de la vista: % de artículos SIN NINGUNA variación.
      let ejemplo: React.ReactNode = <SinDatos />;
      try {
        const sedes = [...new Set(articles.map((a) => a.sede))];
        if (sedes.length > 0) {
          const stats = sedes
            .map((sede) => {
              const its = articles.filter((a) => a.sede === sede);
              const sinDif = its.filter((a) => a.tipo === 'SIN_VARIACION').length;
              return { sede, pct: its.length ? (sinDif / its.length) * 100 : 100, n: its.length };
            })
            .sort((a, b) => a.pct - b.pct);
          const peor = stats[0];
          const mejor = stats[stats.length - 1];
          ejemplo = (
            <Ej>
              En tu corte: la sede más exigida es <b>{peor.sede}</b> — solo el{' '}
              <b>{peor.pct.toFixed(1)}%</b> de sus {peor.n} artículos quedó EXACTO (cero variación).{' '}
              {mejor.sede !== peor.sede && (
                <>
                  La mejor es <b>{mejor.sede}</b> con <b>{mejor.pct.toFixed(1)}%</b> exacto.
                </>
              )}
            </Ej>
          );
        }
      } catch {
        /* sin datos */
      }
      return (
        <>
          <P>
            Es la <b>boleta de calificaciones de cada sede</b>, agrupada en cinco niveles: 🟢{' '}
            <b>Excelente</b> (≥98% de artículos exactos) · 🔵 <b>Buena</b> (≥95) · 🟡{' '}
            <b>Aceptable</b> (≥90) · 🟠 <b>Riesgo</b> (≥80) · 🔴 <b>Crítica</b> (&lt;80). Cada
            tarjeta trae los números de la sede: cuántos artículos, cuántos con diferencia y su
            porcentaje.
          </P>
          <P>
            <b>OJO — este puntaje es DISTINTO al de la pestaña Confiabilidad</b>, y la diferencia
            importa: aquí se mide el porcentaje de artículos que quedaron{' '}
            <b>EXACTOS, con cero variación</b> — la vara más dura posible, sin márgenes de perdón.
            En Confiabilidad, en cambio, un artículo "cuenta bien" si quedó{' '}
            <b>dentro de su margen de tolerancia</b>. Por eso aquí los porcentajes salen más bajos:
            es la foto sin maquillaje.
          </P>
          <P>
            <b>¿Para qué sirve cada lente?</b> Este ejecutivo responde "¿qué tan afinada está la
            máquina de contar de cada sede?" — ideal para comparar sedes entre sí y para la
            conversación gerencial ("Amsterdam cuenta exacto el 60%, Malanga el 85%: ¿qué hace
            Malanga distinto?"). Confiabilidad responde "¿puedo confiar en este inventario para
            decidir compras y cobros?" — que es una pregunta con perdón técnico incluido. Las dos
            juntas cuentan la historia completa.
          </P>
          {ejemplo}
          <Tip>
            Si una sede está Crítica aquí pero decente en Confiabilidad, su problema son muchos
            micro-descuadres dentro del margen: molestos pero baratos. Si está mal en AMBAS, el
            problema es de plata y de proceso — esa es la sede que se interviene primero.
          </Tip>
        </>
      );
    },
  },

  avClasificacion: {
    titulo: 'Sección Clasificación — pérdidas y sobrantes frente a frente',
    contenido: () => (
      <>
        <P>
          Dos columnas espejo: a la izquierda los productos con <b>pérdidas</b> (faltantes) y a la
          derecha los de <b>sobrantes</b>, cada uno con su ranking. Es la vista rápida para barrer
          el corte de una mirada.
        </P>
        <P>
          El truco de lectura profesional: <b>búscalos en parejas</b>. Un faltante fuerte en una
          columna con un sobrante parecido en la otra (mismo tipo de producto, misma sede) casi
          siempre es el mismo artículo contado bajo dos códigos — la app ya te ayuda con la pista
          azul "¿Confusión de códigos?" en la tabla de Cobros, pero aquí puedes verlo de frente.
        </P>
      </>
    ),
  },
};
