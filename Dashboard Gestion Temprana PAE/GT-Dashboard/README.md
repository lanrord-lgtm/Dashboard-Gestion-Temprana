# Dashboard — PAE · Reliability & Maintenance · Gestión Temprana

Dashboard ejecutivo HTML 100% portable. Funciona haciendo doble clic en `index.html` en cualquier PC Windows, sin instalar nada.

## Cómo abrir

1. **Doble clic en `index.html`**.
2. La primera vez verás la pantalla de bienvenida. Arrastrá los dos archivos Excel:
   - `Gestión Temprana (exportar).xlsx` — Resumen de proyectos
   - `Gestión Temprana (export).xlsx` — Tareas detalladas
3. Los datos se guardan en **IndexedDB** (con espejo en localStorage). Al reabrir, ya están cargados.

## Cambios v4.0 (Reliability & Maintenance)

- **Branding PAE**: logo Pan American Energy en sidebar y bienvenida. Título principal "RELIABILITY & MAINTENANCE" con subtítulo "Gestión Temprana de Proyectos".
- **4 KPIs principales**: Cumplidos · Pendientes no vencidos · Backlog · % GT Entregada (gauge).
- **3 gráficos arriba**: Distribución por UG (donut) · Monto GR por UG (Total vs ZI) · **Planes Mtto SAP por UG** (nuevo).
- **Curva S "Todos Proyectos GT"** abajo, ancho completo, con gradientes y animación suave (Plan vs Real).
- **Sin gráficos**: Curva críticos, Proyectos por responsable y Semáforo de bloqueos eliminados.
- **Tabla compacta**: UG · GenPro · Nombre · Estado · Criticidad · Avance · Fecha LE · Limitación · Requiere GR · Monto GR (editable inline).
- **Modal simplificado**: sin línea de tiempo. Tareas principales como tarjetas con barra de avance.
- **Switch de tema**: claro ☀ / medio ◐ / oscuro ☾ persistente.
- **Persistencia robusta**: IndexedDB + localStorage como espejo. No se pierden los datos al cerrar/abrir.
- **Sidebar de alta ingeniería**: gradiente azul profundo + glow teal, indicador activo con halo, mini-cards SAP/GR con borde lateral animado.
- **Layout responsive**: ajustado a notebooks 1366×768 sin necesidad de zoom.

## Funcionalidades clave

- Filtros: UG, Criticidad, Estado, Año + chips Backlog/Pendientes/Cumplidos.
- Vistas: Proyectos Generales (80) / Wellpads (8).
- Tabla: búsqueda, sort y paginación (20 filas/pág).
- Edición inline persistente del Monto GR (más Equipos / Planes / Períodos GR desde el modal).
- Exportar/Importar overrides como JSON.

## Estructura

```
GT-Dashboard/
├── index.html
├── assets/
│   ├── pae-logo.svg
│   ├── css/styles.css
│   ├── js/  (data, transforms, overrides, filters, kpis, charts, table, modal, theme, app)
│   └── libs/  (apexcharts, xlsx)
└── README.md
```

## localStorage / IndexedDB — claves

- `gtd_proyectos` — Archivo A
- `gtd_tasks` — Archivo B
- `gtd_overrides` — ediciones manuales por GenPro
- `gtd_last_update` — timestamp
- `gtd_theme` — tema seleccionado
