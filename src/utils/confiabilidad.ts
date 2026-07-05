/**
 * Reglas de tolerancia, confiabilidad y pérdida económica por ítem.
 *
 * Define el margen de error permitido según la unidad de medida (unidades y
 * copas sin margen, onzas ±1, gramos ±2.5% del consumo teórico), evalúa si un
 * ítem está dentro de tolerancia, calcula su confiabilidad gradual y genera
 * alertas y proyecciones de pérdida. Es la fuente de verdad económica usada
 * por inventory.ts.
 */
import { ArticleSummary, InventoryMovement } from '../types';

/**
 * Calcula el margen de error permitido según la unidad de medida y el contexto.
 */
/**
 * Base mínima (en gramos) para calcular el margen del 2.5%.
 * Evita que teóricos en cero o negativos (herencia de ajustes del ERP)
 * colapsen el margen a ~0 y disparen falsos "fuera de tolerancia".
 */
export const BASE_MINIMA_GRAMOS = 100;

// ─────────────────── CONFIGURACIÓN DE MÁRGENES (editable) ───────────────────

/** Cómo se calcula el margen de una unidad de medida. */
export type ModoMargen = 'FIJO' | 'PORCENTAJE';

export interface ReglaMargen {
  /** FIJO = ±valor en la unidad · PORCENTAJE = valor% del teórico del horizonte. */
  modo: ModoMargen;
  valor: number;
}

export type UnidadMargen = 'UNIDADES' | 'COPAS' | 'ONZAS' | 'GRAMOS';

export type ConfigMargenes = Record<UnidadMargen, ReglaMargen>;

/**
 * Márgenes PREDETERMINADOS al abrir la aplicación (editables en la tarjeta
 * Configuración de Cobro; la app puede recalcular todo con otra config):
 *   UNIDADES y COPAS: sin margen (lo contable se cuenta exacto)
 *   ONZAS: ±3 (decisión de negocio 04/07/2026; antes ±1)
 *   GRAMOS: 2.5% del teórico del horizonte, con piso BASE_MINIMA_GRAMOS
 */
export const CONFIG_MARGENES_DEFAULT: ConfigMargenes = {
  UNIDADES: { modo: 'FIJO', valor: 0 },
  COPAS: { modo: 'FIJO', valor: 0 },
  ONZAS: { modo: 'FIJO', valor: 3 },
  GRAMOS: { modo: 'PORCENTAJE', valor: 2.5 },
};

/** Resuelve a qué unidad configurable pertenece un subartículo. */
export const unidadDeMargen = (subarticulo?: string): UnidadMargen => {
  const u = (subarticulo || '').toUpperCase();
  if (u.includes('ONZA')) return 'ONZAS';
  if (u.includes('COPA')) return 'COPAS';
  if (u.includes('GRAMO')) return 'GRAMOS';
  return 'UNIDADES';
};

/** Texto legible de la regla (para la columna "Regla aplicada" y reportes). */
export const reglaTexto = (regla: ReglaMargen, unidad: UnidadMargen): string => {
  if (regla.modo === 'PORCENTAJE') return `±${regla.valor}% del teórico`;
  if (!regla.valor) return 'Sin margen';
  const sufijo =
    unidad === 'ONZAS'
      ? 'onza(s)'
      : unidad === 'GRAMOS'
        ? 'g'
        : unidad === 'COPAS'
          ? 'copa(s)'
          : 'unidad(es)';
  return `±${regla.valor} ${sufijo}`;
};

export const calcularMargenError = (
  item: Partial<ArticleSummary>,
  config: ConfigMargenes = CONFIG_MARGENES_DEFAULT
) => {
  // Se toma |teórico| con un piso mínimo en modo %: los teóricos ≤ 0 no anulan el margen.
  const baseConsumo = Math.abs(item.stockEsperado || 0);
  const regla = config[unidadDeMargen(item.subarticulo)];
  if (!regla) return 0;
  if (regla.modo === 'PORCENTAJE') {
    return (Math.max(baseConsumo, BASE_MINIMA_GRAMOS) * regla.valor) / 100;
  }
  return Math.max(0, regla.valor);
};

export interface AlertaInsumo {
  tipo: 'CRÍTICA' | 'ALERTA' | 'SOBRESTOCK' | 'QUIEBRE';
  mensaje: string;
}

/**
 * Genera alertas inteligentes basadas en el comportamiento del inventario.
 */
export const generarAlertasInsumo = (item: ArticleSummary): AlertaInsumo[] => {
  const alertas: AlertaInsumo[] = [];
  const diferencia = item.totalDiferencia || 0;
  const fueraMargen = !item.dentroDeTolerancia;

  // 🔴 PÉRDIDA CRÍTICA
  if (fueraMargen && diferencia < 0) {
    alertas.push({
      tipo: 'CRÍTICA',
      mensaje: `${item.articulo} – pérdida crítica en la evaluación actual`,
    });
  }

  // 🟡 SOBRECONSUMO (Muy fuera de margen)
  if (diferencia < 0 && Math.abs(diferencia) > item.margenError * 3) {
    alertas.push({
      tipo: 'ALERTA',
      mensaje: `${item.articulo} – consumo fuera de control histórico`,
    });
  }

  // ⚫ QUIEBRE
  if (item.stockFisico <= 0) {
    alertas.push({
      tipo: 'QUIEBRE',
      mensaje: `${item.articulo} – sin inventario físico registrado`,
    });
  }

  return alertas;
};

/**
 * Analiza la estabilidad de un producto basada en el ratio varianza vs stock esperado.
 */
export const analizarEstabilidadProducto = (item: ArticleSummary) => {
  const variacion = Math.abs(item.totalDiferencia || 0);
  const stockBase = Math.abs(item.stockEsperado) || 1;

  const ratio = variacion / stockBase;

  let estado: 'ESTABLE' | 'INESTABLE' | 'CRÍTICO' = 'ESTABLE';
  if (ratio > 0.3) estado = 'CRÍTICO';
  else if (ratio > 0.15) estado = 'INESTABLE';

  return {
    ratioVariacion: ratio,
    estabilidad: estado,
  };
};

/**
 * Predice la pérdida financiera mensual basado en la pérdida del día/evaluación.
 */
export const predecirPerdidasMensuales = (item: ArticleSummary) => {
  const costoUnitario = item.ultimoCoste || item.costePromedio || 0;
  const perdidaActual =
    !item.dentroDeTolerancia && item.totalDiferencia < 0
      ? Math.abs(item.totalDiferencia) * costoUnitario
      : 0;

  // Proyección a 30 días
  const perdidaProyectada = perdidaActual * 30;

  return {
    perdidaHoy: perdidaActual,
    perdidaProyectada,
  };
};

/**
 * Genera el ranking de artículos con mayor riesgo financiero proyectado.
 */
export const obtenerRankingRiesgo = (data: ArticleSummary[], limit = 10) => {
  return data
    .map((item) => ({
      ...item,
      ...predecirPerdidasMensuales(item),
    }))
    .filter((item) => item.perdidaProyectada > 0)
    .sort((a, b) => b.perdidaProyectada - a.perdidaProyectada)
    .slice(0, limit);
};

/**
 * Evalúa un item individual determinando si está dentro o fuera de los márgenes permitidos
 * y calculando su porcentaje de confiabilidad gradual.
 */
export const evaluarItem = (
  item: ArticleSummary,
  config: ConfigMargenes = CONFIG_MARGENES_DEFAULT
): ArticleSummary => {
  const esperado = Math.abs(item.stockEsperado || 0);
  const real = Math.abs(item.stockFisico || 0);
  const diferencia = item.totalDiferencia || 0;

  const margenError = calcularMargenError(item, config);

  // Diferencia que excede el margen permitido
  const diferenciaAjustada = Math.max(0, Math.abs(diferencia) - margenError);

  // Cálculo de variación porcentual sobre el esperado (piso 1 para evitar
  // divisiones por bases nulas que producían confiabilidades sin sentido)
  const variacion = diferenciaAjustada / Math.max(esperado, 1);

  // Confiabilidad gradual (100% - variación)
  let confiabilidad = (1 - variacion) * 100;

  // Límites lógicos
  if (confiabilidad < 0) confiabilidad = 0;
  if (confiabilidad > 100) confiabilidad = 100;

  // Un item se considera "dentro de tolerancia" si su diferencia no excede el margen
  const fueraMargen = Math.abs(diferencia) > margenError + 0.0001;

  return {
    ...item,
    margenError,
    dentroDeTolerancia: !fueraMargen,
    confiabilidad: Number(confiabilidad.toFixed(2)),
  };
};

/**
 * Resumen del HORIZONTE auditado a partir de los movimientos presentes.
 *
 * El ERP ajusta el stock al cargar cada inventario: el teórico de cada conteo
 * parte del físico del anterior (verificado en la data: 3866→3615→0). Por eso
 * cada variación es la pérdida/sobrante DE SU PERIODO y NO se superponen:
 * la diferencia del horizonte es la SUMA NETA de las variaciones, y la base
 * de tolerancia es el volumen teórico auditado (Σ|teórico de cada conteo|).
 *
 * Con filtro de fechas (App recorta movements) el horizonte es el rango.
 */
export const resumenHorizonte = (
  movements: InventoryMovement[] = []
): { variacion: number; base: number } => {
  let variacion = 0;
  let base = 0;
  for (const m of movements) {
    variacion += m.variacion;
    base += Math.abs(m.stockFecha);
  }
  return { variacion, base };
};

/**
 * Deriva el ÚLTIMO CICLO de conteo a partir de los movimientos presentes.
 *
 * Cada documento HioPOS (fecha + serie) es la foto de un inventario. Esta
 * función toma el último documento del arreglo recibido, de modo que:
 *   - sin filtros: devuelve el último inventario cargado del artículo;
 *   - con filtro de fechas (App recorta movements): devuelve el último
 *     inventario DENTRO del rango, manteniendo coherente toda la cadena
 *     (tolerancia, confiabilidad, cobros) sin dobles conteos.
 */
export const cicloDesdeMovimientos = (
  movements: InventoryMovement[] = []
): { variacion: number; base: number; fecha: Date; serie: string } | null => {
  if (!movements.length) return null;
  const ultimo = movements[movements.length - 1];
  const claveFecha = ultimo.fecha.getTime();
  const claveSerie = ultimo.serie || '';
  let variacion = 0;
  let base = 0;
  for (const m of movements) {
    if (m.fecha.getTime() === claveFecha && (m.serie || '') === claveSerie) {
      variacion += m.variacion;
      base = m.stockFecha;
    }
  }
  return { variacion, base, fecha: ultimo.fecha, serie: claveSerie };
};

/**
 * Realiza el cálculo global de indicadores de confiabilidad para un conjunto de datos.
 * Ahora calcula el promedio ponderado de confiabilidad de los items.
 */
export const calcularEstadisticasConfiabilidad = (data: ArticleSummary[] = []) => {
  // Las sub-recetas / producto en proceso se excluyen del indicador: su
  // variación es operativa (producción/consumo entre inventarios) y no mide
  // la calidad del conteo de la sede.
  const evaluables = data.filter((i) => !i.esSubReceta);
  const total = evaluables.length;
  if (total === 0) {
    return {
      total: 0,
      dentro: 0,
      fuera: 0,
      confiabilidad: 0,
      porcentajeFuera: 0,
      excluidosSubReceta: data.length,
      exactitudArticulos: 0,
      exactitudValor: 0,
      valorTeorico: 0,
      valorDesviado: 0,
    };
  }

  // La tolerancia se evalúa sobre el NETO DEL HORIZONTE presente en los
  // movimientos (las variaciones de conteos sucesivos son pérdidas por
  // periodo que se suman): coherente con el negocio y con los filtros.
  const conCiclo = evaluables.map((i) => {
    const horizonte = resumenHorizonte(i.movements);
    const variacionCiclo = i.movements.length ? horizonte.variacion : (i.totalDiferencia ?? 0);
    const baseCiclo = i.movements.length ? horizonte.base : (i.stockEsperado ?? 0);
    return {
      item: i,
      variacionCiclo,
      baseCiclo,
      valorUnitario: i.costeMediano || i.ultimoCoste || i.costePromedio || 0,
      // Si el articulo YA trae su evaluacion de tolerancia (normalizeData o
      // aplicarPoliticaCobro la calculan sobre estos MISMOS insumos de ciclo,
      // respetando la Configuracion de Cobro activa), se respeta. Re-evaluar
      // aqui con margenes predeterminados ignoraba la config editada.
      evaluado:
        typeof i.dentroDeTolerancia === 'boolean'
          ? ({ ...i } as ArticleSummary)
          : evaluarItem({ ...i, totalDiferencia: variacionCiclo, stockEsperado: baseCiclo }),
    };
  });
  const evaluados = conCiclo.map((c) => c.evaluado);
  const dentro = evaluados.filter((i) => i.dentroDeTolerancia).length;
  const fuera = total - dentro;
  const porcentajeFuera = (fuera / total) * 100;

  // ── DOS DIMENSIONES ESTÁNDAR DE EXACTITUD (IRA) ──────────────────────────
  // La práctica experta (APICS/Strategos, NetSuite) mide la exactitud de
  // inventario en dos bases distintas que "pueden dar resultados muy
  // diferentes" y deben reportarse ambas:
  //
  //  1) EXACTITUD POR ARTÍCULOS (base conteo): % de artículos cuyo último
  //     conteo quedó dentro de tolerancia.
  //        exactitudArticulos = dentro / total × 100
  //
  //  2) EXACTITUD POR VALOR (base dinero): cuánto del valor del inventario
  //     teórico quedó desviado en el conteo, con VARIACIÓN ABSOLUTA (los
  //     faltantes no se netean con sobrantes — netear oculta pérdidas).
  //        exactitudValor = (1 − Σ|variación|×costo ÷ Σ teórico×costo) × 100
  //
  // Una sede puede tener 98% de artículos exactos y aún así fugar millones
  // en pocos ítems de alto valor: por eso la CALIFICACIÓN final usa la
  // dimensión MÁS DÉBIL (criterio conservador de auditoría).
  const exactitudArticulos = (dentro / total) * 100;

  const valorTeorico = conCiclo.reduce(
    (acc, c) => acc + Math.abs(c.baseCiclo) * c.valorUnitario,
    0
  );
  const valorDesviado = conCiclo.reduce(
    (acc, c) => acc + Math.abs(c.variacionCiclo) * c.valorUnitario,
    0
  );
  const exactitudValor =
    valorTeorico > 0 ? Math.max(0, (1 - valorDesviado / valorTeorico) * 100) : exactitudArticulos;

  const confiabilidadPromedio = Math.min(exactitudArticulos, exactitudValor);

  return {
    total,
    dentro,
    fuera,
    excluidosSubReceta: data.length - total,
    exactitudArticulos: Number(exactitudArticulos.toFixed(2)),
    exactitudValor: Number(exactitudValor.toFixed(2)),
    valorTeorico,
    valorDesviado,
    confiabilidad: Number(confiabilidadPromedio.toFixed(2)),
    porcentajeFuera,
  };
};

/**
 * Determina el estado categórico basado en el porcentaje de confiabilidad (Gradual).
 */
/**
 * Clasificación calibrada con los benchmarks de la industria de restaurantes
 * para la varianza real-vs-teórico (Restaurant365, Supy, meez):
 *   varianza <2%  = bien gestionado      → exactitud ≥98  → Confiable
 *   varianza 2–5% = requiere atención    → exactitud ≥95  → Aceptable
 *   varianza 5–10%= investigar ya        → exactitud ≥90  → Riesgo
 *   varianza >10% = problema sistémico   → exactitud <90  → Crítico
 */
export const obtenerEstado = (
  confiabilidad: number
): 'Confiable' | 'Aceptable' | 'Riesgo' | 'Crítico' => {
  if (confiabilidad >= 98) return 'Confiable';
  if (confiabilidad >= 95) return 'Aceptable';
  if (confiabilidad >= 90) return 'Riesgo';
  return 'Crítico';
};

/**
 * Calcula la pérdida económica asociada a un item si este supera los márgenes de tolerancia.
 */
export const calcularPerdidaEconomica = (item: ArticleSummary): number => {
  // Si está dentro de la tolerancia, la "pérdida" se considera ruido operativo (0)
  if (item.dentroDeTolerancia) return 0;

  const costoUnitario = item.ultimoCoste || item.costePromedio || 0;

  // Solo se considera pérdida real lo que supera el margen si es faltante
  if (item.totalDiferencia < 0) {
    return Math.abs(item.totalDiferencia) * costoUnitario;
  }

  return 0;
};
