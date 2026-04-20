# maranello

Tablero financiero del restaurante Maranello.

## Estructura
- `index.html`: tablero principal
- `assets/css/styles.css`: estilos del tablero
- `assets/js/app.js`: lógica del tablero
- `data/periodos.json`: periodos disponibles
- `data/2025_11/`: CSV del periodo
- `docs/`: documentación del proyecto

## Flujo de actualización
1. Procesar localmente el archivo mensual.
2. Generar Excel, resumen, maestro mensual y `web_csv`.
3. Copiar los CSV web del periodo a `data/AAAA_MM/`.
4. Actualizar `data/periodos.json` si agregas un nuevo periodo.
5. Hacer commit y push al repositorio.
