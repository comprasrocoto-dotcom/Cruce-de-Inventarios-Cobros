import { ArticleSummary } from '../types';

/**
 * Calcula el margen de error permitido según la unidad de medida y el contexto.
 */
export const calcularMargenError = (item: Partial<ArticleSummary>) => {
  const unidad = item.subarticulo?.toUpperCase() || '';
  const diferencia = item.totalDiferencia || 0;
  // Usamos stockEsperado como base de consumo teórico si no existe consumo explícito
  const baseConsumo = Math.abs(item.stockEsperado || 0);

  // ❌ SIN margen para unidades exactas o copas
  if (unidad.includes("UNIDAD") || unidad.includes("COPA")) return 0;

  // ✅ ONZAS → ±1 permitido
  if (unidad.includes("ONZA")) return 1;

  // ✅ GRAMOS → 2.5% de margen sobre el consumo teórico (stock esperado)
  if (unidad.includes("GRAMO")) {
    return baseConsumo * 0.025;
  }

  return 0;
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
      tipo: "CRÍTICA",
      mensaje: `${item.articulo} – pérdida crítica en la evaluación actual`
    });
  }

  // 🟡 SOBRECONSUMO (Muy fuera de margen)
  if (diferencia < 0 && Math.abs(diferencia) > item.margenError * 3) {
    alertas.push({
      tipo: "ALERTA",
      mensaje: `${item.articulo} – consumo fuera de control histórico`
    });
  }

  // ⚫ QUIEBRE
  if (item.stockFisico <= 0) {
    alertas.push({
      tipo: "QUIEBRE",
      mensaje: `${item.articulo} – sin inventario físico registrado`
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

  let estado: 'ESTABLE' | 'INESTABLE' | 'CRÍTICO' = "ESTABLE";
  if (ratio > 0.3) estado = "CRÍTICO";
  else if (ratio > 0.15) estado = "INESTABLE";

  return {
    ratioVariacion: ratio,
    estabilidad: estado
  };
};

/**
 * Predice la pérdida financiera mensual basado en la pérdida del día/evaluación.
 */
export const predecirPerdidasMensuales = (item: ArticleSummary) => {
  const costoUnitario = item.ultimoCoste || item.costePromedio || 0;
  const perdidaActual = !item.dentroDeTolerancia && item.totalDiferencia < 0 
    ? Math.abs(item.totalDiferencia) * costoUnitario 
    : 0;

  // Proyección a 30 días
  const perdidaProyectada = perdidaActual * 30;

  return {
    perdidaHoy: perdidaActual,
    perdidaProyectada
  };
};

/**
 * Genera el ranking de artículos con mayor riesgo financiero proyectado.
 */
export const obtenerRankingRiesgo = (data: ArticleSummary[], limit = 10) => {
  return data
    .map(item => ({
      ...item,
      ...predecirPerdidasMensuales(item)
    }))
    .filter(item => item.perdidaProyectada > 0)
    .sort((a, b) => b.perdidaProyectada - a.perdidaProyectada)
    .slice(0, limit);
};

/**
 * Evalúa un item individual determinando si está dentro o fuera de los márgenes permitidos
 * y calculando su porcentaje de confiabilidad gradual.
 */
export const evaluarItem = (item: ArticleSummary): ArticleSummary => {
  const esperado = Math.abs(item.stockEsperado || 0);
  const real = Math.abs(item.stockFisico || 0);
  const diferencia = item.totalDiferencia || 0;
  
  const margenError = calcularMargenError(item);

  // Diferencia que excede el margen permitido
  const diferenciaAjustada = Math.max(0, Math.abs(diferencia) - margenError);

  // Cálculo de variación porcentual sobre el esperado
  const variacion = esperado > 0 ? diferenciaAjustada / esperado : 0;

  // Confiabilidad gradual (100% - variación)
  let confiabilidad = (1 - variacion) * 100;

  // Límites lógicos
  if (confiabilidad < 0) confiabilidad = 0;
  if (confiabilidad > 100) confiabilidad = 100;

  // Un item se considera "dentro de tolerancia" si su diferencia no excede el margen
  const fueraMargen = Math.abs(diferencia) > (margenError + 0.0001);

  return {
    ...item,
    margenError,
    dentroDeTolerancia: !fueraMargen,
    confiabilidad: Number(confiabilidad.toFixed(2))
  };
};

/**
 * Realiza el cálculo global de indicadores de confiabilidad para un conjunto de datos.
 * Ahora calcula el promedio ponderado de confiabilidad de los items.
 */
export const calcularEstadisticasConfiabilidad = (data: ArticleSummary[] = []) => {
  const total = data.length;
  if (total === 0) {
    return { total: 0, dentro: 0, fuera: 0, confiabilidad: 0, porcentajeFuera: 0 };
  }

  const evaluados = data.map(evaluarItem);
  const dentro = evaluados.filter(i => i.dentroDeTolerancia).length;
  const fuera = total - dentro;

  // La confiabilidad global ahora es el promedio de las confiabilidades individuales
  const sumaConfiabilidad = evaluados.reduce((acc, i) => acc + (i.confiabilidad || 0), 0);
  const confiabilidadPromedio = sumaConfiabilidad / total;

  const porcentajeFuera = (fuera / total) * 100;

  return {
    total,
    dentro,
    fuera,
    confiabilidad: Number(confiabilidadPromedio.toFixed(2)),
    porcentajeFuera
  };
};

/**
 * Determina el estado categórico basado en el porcentaje de confiabilidad (Gradual).
 */
export const obtenerEstado = (confiabilidad: number): "Confiable" | "Aceptable" | "Riesgo" | "Crítico" => {
  if (confiabilidad >= 95) return "Confiable";
  if (confiabilidad >= 80) return "Aceptable";
  if (confiabilidad >= 60) return "Riesgo";
  return "Crítico";
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
