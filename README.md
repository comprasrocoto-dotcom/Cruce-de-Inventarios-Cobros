# Cruce de Inventarios y Cobros — Restaurantes Rocoto

Aplicación web de **auditoría de inventarios y liquidación de cobros por faltantes** para las
sedes de Restaurantes Rocoto. Cruza los inventarios físicos cargados en el ERP **HioPOS**
contra el stock teórico, aplica márgenes de tolerancia y políticas de cobro configurables,
califica la **confiabilidad** de cada sede con estándares de industria (IRA), y cruza los
sobrantes contra el **registro de recetas** para detectar producción sin registrar.

**Producción:** https://cruce-de-inventarios-cobros.vercel.app/

---

## Stack y arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind, Recharts, framer-motion |
| Reportes | SheetJS (xlsx) · jsPDF + jspdf-autotable v5 |
| Datos | **Supabase**: base propia `cruce_*` (inventarios subidos, tolerancias, accesos) + inicio de sesión. Recetas siguen en Google Sheets vía Apps Script |
| Hosting | Vercel (deploy automático desde GitHub) |

### Confiabilidad real — nov 2026

- Una sola fórmula en toda la app (tabla por inventario, tarjetas por sede, mapa de calor,
  Ejecutivo y PDF): **Nivel = (1 − Ref. con diferencia ÷ Cantidad de referencias) × 100**.
- Cada artículo en cada inventario es una referencia; con varios inventarios en el filtro se
  suman referencias y diferencias (no se promedian porcentajes).
- "Con diferencia" = se sale del margen de su unidad, el MISMO que decide el cobro: unidades y
  copas sin margen, onzas ±2, gramos 2,5% del teórico. Se guarda en
  `cruce_configuracion.margenes` y aplica para todos.
- Novedades con "Fuera del margen" (cantidad que excede el margen) y su costo, y marcas para
  revisar teórico negativo y físico en 0.
- El cálculo anterior (la menor entre exactitud por artículos y por valor, sin sub-recetas)
  quedó como `calcularEstadisticasConfiabilidadHorizonte`, sin uso.

### Panel de usuarios — nov 2026

- Botón **Usuarios** en la barra superior (solo rol admin): crear usuarios, cambiar rol
  (Administrador / Editor / Lector), quitar acceso y generar enlaces de contraseña.
- La gestión pasa por la función de Supabase `cruce-usuarios` (código en
  `supabase/functions/cruce-usuarios`), que verifica que quien llama sea admin del Cruce.
- Las cuentas son las mismas del Informe de Rentabilidad. Como la base solo crea cuentas para
  correos de su lista `accesos`, un correo nuevo se agrega allá con rol `marca` y sin marcas
  (no ve nada en Rentabilidad hasta que se le asignen).
- Nadie escribe ni ve contraseñas ajenas: el panel genera un enlace de un solo uso
  (`?token_hash=…&type=invite|recovery`) que el administrador envía por WhatsApp o correo, y la
  persona crea su propia contraseña al abrirlo. Quitar el acceso solo borra la fila de
  `cruce_accesos`; la cuenta y Rentabilidad no se tocan.

### Diseño y Cocina/Bar — nov 2026

- La app usa el **mismo diseño del Informe de Rentabilidad** (paleta del ERP): riel de íconos negro a
  la izquierda, barra superior carbón con la pestaña activa en azul, fondo claro, tablas con cabecera
  azul claro y tarjetas de indicadores con borde superior de color. Tokens en `src/index.css`.
- **Centro de costo Todos / Cocina / Bar** arriba de los filtros: filtra todas las vistas. Si el
  inventario no trae la columna Centro de Costos, sale de la subfamilia (tabla
  `cruce_subfamilia_cc`: LICORES, VINOS, CERVEZAS, INSUMOS BAR, SUB-RECETAS BAR, GASEOSAS Y SODAS y
  AGUA Y TE = Bar; lo demás = Cocina). El nivel de confiabilidad por inventario muestra además el
  nivel de Cocina y de Bar por separado.

### Base de datos propia en Supabase — desde nov 2026

Cada inventario que se hace en HioPOS se **sube a la web** y queda guardado; la app lee siempre
todo lo guardado y muestra sus novedades y su nivel de confiabilidad.

- **Dónde:** tablas `cruce_*` dentro del proyecto Supabase `informe-rentabilidad-centralizado`
  (el plan gratis solo permite 2 proyectos). Son tablas propias: no se leen ni se tocan las
  tablas ni el código del Informe de Rentabilidad.
  - `cruce_inventarios`: líneas del export de HioPOS (un documento = fecha + serie + almacén).
  - `cruce_cargas`: cada archivo subido (quién, cuándo, cuántas filas y documentos).
  - `cruce_configuracion`: márgenes de error por unidad (`margenes`), los mismos para cobro y
    confiabilidad. Los guarda un administrador desde Configuración de Cobro.
  - `cruce_accesos`: quién entra y con qué rol (admin · editor = sube inventarios · lector).
- **Subir un inventario:** botón "Subir inventario" (CSV o Excel de HioPOS). El CSV puede venir
  con números colombianos (`4.491` = cuatro mil, `3.728,55`); el formato se detecta y se valida
  con Stock a Fecha + Variación = Stock Inventario. La fila de totales se ignora. Cada subida
  **suma** a la base (función `cruce_subir_inventario`, todo o nada): agrega las líneas nuevas y
  actualiza las repetidas (llave: almacén + fecha + serie + código + artículo). Nada se borra.
- **Borrar:** papelera en cada fila del nivel de confiabilidad (admin/editor, borra ese
  inventario) y "Borrar toda la base" en el panel de subida (solo admin, hay que escribir BORRAR).
- **Inicio de sesión:** Supabase Auth del mismo proyecto (correo + contraseña). Además del
  login, el correo debe estar en `cruce_accesos`; si no, la app lo dice y no muestra datos.
  Las cuentas se crean en el Informe de Rentabilidad (su registro solo admite correos de su
  lista de accesos).
- **Nivel de confiabilidad por inventario** (pestaña CONFIABILIDAD, arriba):
  `(Cantidad de referencias − Total ref con diferencia) / Cantidad de referencias × 100`.
  Diferencia = fuera del margen de su unidad: unidades y copas sin margen, onzas ±2, gramos
  2,5% del teórico (piso de 100 g). Líneas con teórico y físico en cero no cuentan.
  Cada fila se abre para ver sus novedades ordenadas por costo. El admin edita las tolerancias.
  Los márgenes de **cobro** siguen siendo los de "Configuración de Cobro" (no cambiaron).
- Series de inventario reconocidas por el motor de cobro: `a /`, `CONTEO*` y `INV*` (INVAR, INVRC…).
- URL y clave publicable en `src/config.ts` (o `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`).
- El Web App de BASE DE DATOS (Apps Script) queda como respaldo y ya no se consulta.

### Fuentes de datos anteriores (Apps Script)

1. **`apps-script/Codigo.gs` — BASE DE DATOS** (`SHEET_API_URL` en `src/config.ts`)
   Sirve la hoja `BASE DE DATOS` como JSON (un objeto por fila, claves = encabezados).
   Sanea en origen: fechas a `yyyy-MM-dd` y celdas numéricas pegadas como texto
   (`parseNumeroRegional_`). **Importante:** la detección de columnas numéricas excluye
   explícitamente "Centro de Costos" (contiene la palabra "costo" pero es TEXTO — bug real
   corregido: convertía "COCINA" en `0`).

2. **`apps-script/RecetasAPI.gs` — RECETAS** (`RECETAS_API_URL`)
   Expone el proyecto de registro de recetas: `{ recetas, composicion, fabricaciones }`.
   Los códigos de recetas e ingredientes son los **Cód. Barras de HioPOS** (mismo ERP; un bot
   carga las recetas). Normaliza fechas de fabricación aunque estén guardadas como texto.

**Redeploy sin cambiar URL:** Apps Script → Implementar → *Administrar implementaciones* →
lápiz → Versión: **Nueva versión** → Implementar. (Nunca "Nueva implementación": cambia la URL.)

### Contrato de datos (export de HioPOS, 13 columnas)

```
Fecha Doc | Serie/N° | Almacén | Familia | Subfamilia | Centro de Costos |
Artículo | Cód. Barras | Subartículo | Coste Línea | Stock a Fecha |
Variación Stock | Stock Inventario
```

- **Convención numérica FIJA del proyecto:** punto `.` = decimal, coma `,` = miles.
- **Mapeo de columnas en 3 fases con asignación única** (exactos → parciales entre libres →
  posición del layout): si un encabezado no se reconoce, su campo cae a la columna del
  contrato (ej. Centro de Costos = **columna F**). Cada campo tiene a lo sumo una columna y
  viceversa — inmune al "robo" por alias parciales.
- CC vacío o `0` = "sin CC" (no se ofrece basura en filtros; sin fallback a Familia).
- Serie `a /` y `CONTEO*` = documentos de inventario válidos.

---

## Lógica de negocio

### El horizonte y el neto

El ERP **ajusta el stock en cada carga de inventario**, así que cada variación es la pérdida
de su periodo. El cobro se calcula sobre el **NETO del horizonte filtrado** (suma de las
variaciones del rango): sobrantes de una semana compensan faltantes de otra **del mismo
artículo** (mismo responsable). Nunca entre artículos distintos.

### Márgenes de tolerancia (editables en Configuración de Cobro)

Predeterminados al abrir:

| Unidad | Regla | Racional |
|---|---|---|
| UNIDADES | Sin margen | Lo contable se cuenta con los dedos |
| COPAS | Sin margen | Ídem |
| ONZAS | **±2** | Error del jigger (decisión de negocio 11/11/2026; antes ±3) |
| GRAMOS | **2.5% del teórico** del horizonte, piso 100 g | Mermas de pesaje y porcionado |

Cada unidad admite dos modos: **± fijo** o **% del teórico**. Los cambios se editan como
borrador y solo actúan al pulsar **"Aplicar configuración"** (recalcula toda la app con
indicador visible). Persisten en `localStorage` del navegador. **Editar márgenes SÍ mueve la
confiabilidad** (cambia la vara técnica); comparar cortes solo con la misma configuración.

### Políticas de cobro (selector en Configuración)

1. **Con margen · cobro completo** (default): superar el margen cobra TODO el faltante — el
   margen es umbral del perdón, no mesada.
2. **Con margen · solo excedente**: se cobra solo lo que sobrepasa el margen.
3. **Sin margen · tolerancia cero**: todo faltante neto cobra.

La política **no** afecta la confiabilidad. Política y márgenes activos quedan **impresos en
PDF y Excel** (un reporte de descuentos sin su regla es indefendible).

### Confiabilidad (estándar IRA, nota dual)

- **① Exactitud por Artículos** = % de artículos dentro de su margen (disciplina de conteo).
- **② Exactitud por Valor** = 1 − Σ|variación|·costo ÷ Σteórico·costo, con variación
  **ABSOLUTA** (faltantes no se netean con sobrantes: sobrar es tan poco confiable como faltar).
- **Nota final = MIN(①, ②)** — criterio conservador: el promedio esconde la dimensión enferma.
- Niveles: 🟢 ≥98 · 🟡 ≥95 · 🟠 ≥90 · 🔴 <90.
- Las **sub-recetas (SUB.)** se excluyen: su variación es producción, no error de conteo.
- Costo robusto: **mediana** del artículo entre sedes > último coste > promedio.

### Sobrantes: no cobran, pero vigilan

No se descuentan (evita fabricar sobrantes de lo barato para tapar faltantes de lo caro),
pero son síntoma de proceso: visibles en KPIs y tarjetas por sede (conteo + valor a costo),
castigan la exactitud por valor, y alimentan dos detectores:

- **⚠ Revisar**: coste unitario atípico (>5× la mediana entre sedes) o cobro > $5.000.000.
- **¿Confusión de códigos?** (pista azul): faltante cobrable con sobrante fuerte en la misma
  sede+subfamilia, **misma unidad** y **parentesco de nombre** (comparten palabra
  significativa, ignorando empaques) — el patrón "QUESO X KILO falta / QUESO BLOQUE sobra".
  Validar contra el ERP antes de descontar.

### Cruce con recetas (pestaña RECETAS E INGREDIENTES)

Cruza el inventario con el RecetasAPI por Cód. Barras. **Alerta de sobrante fantasma**:
ingrediente con sobrante fuera de tolerancia + **cero fabricaciones registradas** de sus
recetas en el horizonte = preparación sin registrar. Solo agrupa (no cruza cantidades, por
decisión de negocio). Reporte de emparejamiento siempre visible (recetas/ingredientes sin
cruce nunca fallan en silencio).

---

## Vistas

| Pestaña | Qué responde |
|---|---|
| **RESUMEN** | KPIs (5 tarjetas, sobrantes incluidos), Resumen por Sede, **Configuración de Cobro**, carga Excel/Sheets |
| **ANÁLISIS** | Tabla exploratoria + 5 secciones: Variaciones · Consolidado (¿sede o producto?) · Cobros · **Resumen Ejecutivo** (% artículos EXACTOS — vara sin maquillaje) · Clasificación (pérdidas/sobrantes frente a frente) |
| **COBROS** | Detalle de cobros con insignias (⚠ Revisar, ¿Confusión?), insignia de política activa, reportes agrupados |
| **CONFIABILIDAD** | Nota dual por sede, informe técnico de márgenes, estabilidad de productos/responsables, predicciones 30 días |
| **GERENCIAL** | Ranking de control por Sede o por CC (el interruptor cambia el responsable del plan), gráficas por inventario |
| **TRAZABILIDAD** | Evolución por PERIODOS entre inventarios (no acumulados), tendencia, impacto |
| **EJECUTIVO** | Portada del corte para comités + exportes ejecutivos |
| **RECETAS** | Cruce con registro de recetas, alertas de sobrante fantasma, filtro propio |

### Filtros

- **Filtros Avanzados (globales)**: sede, CC, subfamilia, estado, rango de fechas, búsqueda —
  alimentan TODAS las vistas, ayudas y reportes. Chips con × para cada filtro activo.
  El rango de fechas reconstruye el corte y **re-aplica política y márgenes activos**.
- **Filtros locales**: en los listados de Cobros/Análisis (sede o artículo) y en Recetas —
  filtran solo esa tabla.

### Sistema de ayudas "?"

23 entradas contextuales en panel lateral que **desplaza el contenido** (no lo tapa). Las
explicaciones usan **datos vivos del corte filtrado** como ejemplos, con nivel de manual del
analista: fórmulas en palabras, cómo leer cada vista, trampas comunes y planes de acción.
La de Configuración calcula en vivo el total bajo las tres políticas.

---

## Reportes

| Botón | Ubicación | Contenido |
|---|---|---|
| **Excel Jerárquico** | RESUMEN / EJECUTIVO | TODOS los artículos del corte (recetas SUB. incluidas), pivote por fechas/meses, una hoja por sede, banner con política y márgenes |
| **Excel Cobros Agrupado** | COBROS | Mismos encabezados, TODOS los artículos, **orden agrupado**: cada receta encabeza y debajo sus ingredientes; luego semejanza de nombre (COCA, MANANTIAL...); luego solos. Lista plana |
| **PDF Cobros** | RESUMEN / EJECUTIVO | Solo cobrables (liquidación), política impresa |
| **PDF Cobros Agrupado** | COBROS | Cobrables con **separadores de grupo** dorados |

Los montos de los reportes salen del **motor** (mediana + política activa): pantalla y papel
siempre coinciden.

---

## Persistencia (qué sobrevive a un refresco)

| Elemento | ¿Sobrevive? | Dónde vive |
|---|---|---|
| Inventarios subidos | ✅ para todos los usuarios | Supabase (`cruce_inventarios`) |
| Tolerancias de confiabilidad | ✅ para todos | Supabase (`cruce_configuracion`) |
| Sesión de usuario | ✅ hasta cerrar sesión | Supabase Auth (navegador) |
| Configuración de Cobro (política + márgenes) | ✅ por navegador | `localStorage` |
| Filtros Avanzados | ❌ se limpian por sesión | Estado |

Como la configuración es por navegador, cada reporte imprime su regla — el papel siempre
declara con qué se calculó.

---

## Estructura del código

```
src/
├── App.tsx                    # Estado global, filtros, política/márgenes, tabs
├── help.tsx                   # Las 23 ayudas "?" (con ejemplos vivos)
├── config.ts                  # URLs de los dos Apps Script
├── types.ts                   # Contratos (ArticleSummary, GlobalFilters, ...)
├── utils/
│   ├── inventory.ts           # normalizeData (mapeo 3 fases), aplicarPoliticaCobro,
│   │                          #   pases de auditoría, agregaciones de todas las vistas
│   ├── confiabilidad.ts       # ConfigMargenes, evaluarItem, nota dual IRA
│   ├── recetas.ts             # fetch + cruce con recetas, alertas sin registro
│   └── agrupacion.ts          # Agrupación recetas + semejanza para reportes
└── components/
    ├── ExportButtons.tsx      # construirLibroCobros / construirPDFCobros (puros, testeables)
    ├── HelpTip.tsx            # Panel lateral de ayudas
    ├── Filters.tsx            # Filtros globales + chips
    ├── InventoryTable.tsx     # Listado con filtro local e insignias
    ├── RecipesView.tsx        # Cruce de recetas
    └── ...                    # Reliability, Management, Historical, Executive, Advanced
```

**Principio de diseño ganado a pulso:** los generadores de reportes y el motor de cobro son
**funciones puras exportadas**, probadas contra los JSON vivos de producción antes de cada
entrega (los reportes fallaron dos veces en silencio antes de este refactor).

## Bitácora de la construcción (resumen de sesiones)

- **Motor**: mapeo de columnas en 3 fases inmune a robos de alias; parser numérico regional;
  horizonte neto por serie válida; costo mediano; exclusión de sub-recetas (incluye
  `SUB-RECETAS CP`).
- **Configuración**: márgenes editables por unidad (±fijo / %), 3 políticas de cobro,
  recálculo en caliente con botón Aplicar, persistencia, impresión en reportes. ONZAS pasó
  de ±1 a **±3** por decisión de negocio.
- **Coherencia total**: la nota dual, el filtro de fechas y la trazabilidad respetan la
  configuración activa (auditoría del 04/07/2026: 3 fixes verificados con data viva).
- **Sobrantes**: doctrina completa (no cobran / sí vigilan), 5ª tarjeta KPI, pista de
  confusión de códigos calibrada (misma unidad + parentesco de nombre → 119 pistas de
  calidad en el corte de referencia, no 533 de ruido).
- **Recetas**: graduación con datos vivos — 287/378 recetas y 278/293 ingredientes cruzados;
  546 alertas de sobrante fantasma (AMSTERDAM 117 ... MALANGA 9).
- **Bugs célebres corregidos**: regex `costo` capturando "Centro de Costos" en el Apps Script
  (4.589 filas con CC=0); corrimiento de merges del Excel por la fila de política; PDF muerto
  por `jspdf-autotable` v5; colapso de altura de Recharts en Gerencial; fechas de fabricación
  en formato largo JS.
- **Referencias del corte vivo** (Listado 11/jun–01/jul, config default): 2.518 artículos ·
  556 cobrables · **$85.023.441** · 14 banderas · 812 sobrantes ≈ $99.7M.

---

*Construido iterativamente con validación contra datos de producción en cada entrega:
`tsc` sin errores, `vite build` exitoso y regresión de totales al peso antes de cada commit.*
