# Cruces de Inventario — Auditoría y Cobros por Sede

Aplicación web para auditar cruces de inventario y calcular cobros por sede,
a partir de los datos de una hoja de Google Sheets ("BASE DE DATOS").

Construida con **React + TypeScript + Vite**, estilada con **Tailwind CSS v4**
y desplegada en **Vercel**.

## Origen de datos

La app consume un **Web App de Google Apps Script** que sirve la hoja como JSON.
La URL está centralizada en [`src/config.ts`](src/config.ts) (`SHEET_API_URL`).
También permite cargar un archivo **Excel local** (.xlsx/.xls) como alternativa.

El código del backend (Apps Script) se incluye como referencia en
[`apps-script/Codigo.gs`](apps-script/Codigo.gs).

## Funcionalidades

- **Resumen**: KPIs globales y distribución por sede.
- **Análisis**: tabla detallada y análisis avanzado de variaciones.
- **Cobros**: detalle jerárquico de faltantes/sobrantes y montos a cobrar.
- **Confiabilidad**: indicadores por sede y centro de costo.
- **Gerencial**: lectura ejecutiva por sede.
- **Trazabilidad**: evolución histórica entre periodos.
- **Ejecutivo**: KPIs, tendencias, top de productos y reporte PDF.

## Requisitos

- Node.js 18+ (recomendado 20+)

## Ejecutar en local

```bash
npm install
npm run dev
```

La app queda disponible en http://localhost:3000

## Scripts

| Script           | Descripción                                   |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Servidor de desarrollo (Vite)                 |
| `npm run build`  | Build de producción (genera `dist/`)          |
| `npm run preview`| Sirve el build de producción localmente       |
| `npm run lint`   | Chequeo de tipos (`tsc --noEmit`)             |
| `npm run format` | Formatea el código con Prettier               |

## Despliegue (Vercel)

El proyecto se construye con `npm run build` y se publica el directorio `dist/`.
No requiere variables de entorno.
