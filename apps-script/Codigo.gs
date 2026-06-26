/**
 * Web App de Google Apps Script que sirve la hoja "BASE DE DATOS" como JSON
 * para la app Cruce-de-Inventarios-Cobros.
 *
 * Contrato de respuesta (consumido por src/components/FileUpload.tsx):
 *   - Éxito: un array de objetos { <encabezado>: <valor> }, una entrada por fila.
 *            Las fechas se entregan como texto 'yyyy-MM-dd'.
 *   - Error: un objeto { error: <mensaje> }.
 *
 * Despliegue:
 *   Implementar > Nueva implementación > Aplicación web
 *     - Ejecutar como: Yo
 *     - Quién tiene acceso: Cualquier usuario
 *   La URL /exec resultante va en src/config.ts (SHEET_API_URL).
 */

/** Nombre de la pestaña de origen. Cámbialo si tu hoja se llama distinto. */
const SHEET_NAME = 'BASE DE DATOS';

/** Zona horaria por defecto si la hoja no define una. */
const DEFAULT_TZ = 'America/Bogota';

/** Formato en el que se entregan las fechas al frontend. */
const DATE_FORMAT = 'yyyy-MM-dd';

/**
 * Punto de entrada HTTP GET del Web App.
 * @param {GoogleAppsScript.Events.DoGet} e Evento de la petición (no usado).
 * @return {GoogleAppsScript.Content.TextOutput} Respuesta JSON.
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    if (!sheet) return _json({ error: 'No se encontró ninguna hoja' });

    // getValues() devuelve los valores crudos (números y fechas reales).
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return _json({ error: 'La hoja no tiene datos suficientes' });

    const tz = ss.getSpreadsheetTimeZone() || DEFAULT_TZ;
    const headers = values[0].map((h) => String(h).trim());

    const rows = [];
    for (let r = 1; r < values.length; r++) {
      const fila = values[r];

      // Salta filas completamente vacías.
      if (fila.every((c) => c === '' || c === null)) continue;

      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c];
        if (!key) continue; // ignora columnas sin encabezado

        let val = fila[c];
        if (val instanceof Date) {
          val = Utilities.formatDate(val, tz, DATE_FORMAT);
        }
        obj[key] = val;
      }
      rows.push(obj);
    }

    return _json(rows);
  } catch (err) {
    return _json({ error: String(err) });
  }
}

/**
 * Serializa un valor como respuesta JSON.
 * @param {Object|Array} data Datos a serializar.
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function _json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}
