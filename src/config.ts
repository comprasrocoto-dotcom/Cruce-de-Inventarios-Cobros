/**
 * Configuración centralizada del origen de datos.
 *
 * `SHEET_API_URL` apunta al Web App de Google Apps Script que sirve la hoja
 * "BASE DE DATOS" como JSON. Centralizar la URL aquí evita que quede dispersa
 * en varios componentes y facilita cambiarla en un solo lugar.
 *
 * Para regenerar/cambiar el endpoint: en Apps Script, Implementar > Nueva
 * implementación > Aplicación web (Ejecutar como: Yo · Acceso: Cualquiera).
 */
export const SHEET_API_URL =
  'https://script.google.com/macros/s/AKfycbw2ZgwjldaN23gCgUXEX4TqKrZc6E2fwiks6UHALc9p3HTifRlcmaAlUDWbjFKJbm4P/exec';

/** Nombre lógico de la pestaña de origen (solo para etiquetas en la UI). */
export const SHEET_NAME = 'BASE DE DATOS';
