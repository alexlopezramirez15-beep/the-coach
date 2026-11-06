# THE COACH — Manager Academy

Simulador educativo de gestión y competición táctica para el CFGM de Técnico Deportivo en Fútbol (nivel 2).

## Ejecutar
Abre `index.html` desde un servidor estático (p. ej. `python3 -m http.server`) — el fichero no lleva `<html>/<head>` porque se publica como Artifact; para uso local, envuélvelo o sírvelo tal cual (los navegadores lo renderizan).

## Arquitectura
- `js/engine.js` — motor puro (sin DOM, ejecutable en Node): RNG con semilla, catálogos, generación de plantillas equilibradas, calendario, evaluación metodológica de tareas/sesiones/microciclos/planes, aprendizaje de indicadores y simulador de partidos por secuencias.
- `js/store.js` — capa de servicio: usuarios, permisos, competiciones, borradores, entregas versionadas y bloqueadas, jornadas, clasificación, evaluación, scouting. Hoy persiste en `localStorage`; su API está pensada para migrar a un servidor (Postgres/Supabase) sin tocar las pantallas.
- `js/demo.js` — liga demo (8 equipos × 20 jugadores, 7 jornadas).
- `js/ui-*.js` — pantallas (núcleo, entrenador, partido, profesor).
- `test/validate.js` — escenario de validación del apartado 27 + temporada demo completa + reproducibilidad: `node test/validate.js`.

## Estado
Ver la pantalla «Estado del desarrollo» dentro de la app. Fase 1 completa; partes básicas de fases 2–4; pendiente el servidor multiusuario.
