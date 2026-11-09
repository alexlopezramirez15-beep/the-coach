/* THE COACH — Configuración del servidor compartido (Supabase).
 * La clave "publishable" es pública por diseño: la base de datos no se puede leer ni escribir
 * directamente; todo pasa por funciones del servidor que comprueban la sesión y los permisos.
 * Si se deja `url` vacío, la app funciona sólo en este navegador (modo local). */
window.TC_CONFIG = {
  url: 'https://hubmesfbxwwoafnupnvu.supabase.co',
  key: 'sb_publishable_--EiOzWmC-2GvaS5pYYUXA_cPY8i9WF',
  pollSeconds: 15,
};
