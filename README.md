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

## Servidor compartido (Supabase)

- Proyecto Supabase `thecoach` (región eu-west-3). Esquema en `supabase/001_schema.sql` y funciones en `supabase/002_functions.sql`.
- Los datos se guardan como documentos JSON (`tc_docs`) por colección. Las tablas no se pueden leer ni escribir directamente: todo pasa por funciones RPC (`tc_login`, `tc_pull`, `tc_push`…) que comprueban la sesión y los permisos.
- Cada alumno sólo descarga lo suyo y lo público de su liga. Sólo puede modificar su modelo, pizarra, tareas, borradores, reflexión y entregas (estas se crean una vez y con la jornada abierta). Los códigos y la contraseña se guardan con bcrypt.
- Sólo el email configurado en `tc_config.admin_email` puede crear el superadministrador.
- `js/config.js` contiene la URL y la clave pública. Si se deja vacía, la app vuelve al modo local (este navegador).
- La demo siempre es local y no toca el servidor.
- Publicar: `./build.sh` genera `dist/` (HTML completo) para un hosting estático.
