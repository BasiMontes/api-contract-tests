import type { Request } from 'express';

/**
 * Hora de referencia para las reglas de pasado y de cancelación.
 *
 * Solo en modo práctica (MODO_PRACTICA=1) se admite la cabecera X-Practica-Ahora, con una fecha ISO 8601.
 * Así las pruebas pueden fijar el "ahora" de cada petición sin estado compartido entre pruebas.
 * Fuera de modo práctica la cabecera se ignora y siempre se usa el reloj real.
 */
export function ahoraDe(req: Request): Date {
  const cabecera = req.headers['x-practica-ahora'];
  if (process.env.MODO_PRACTICA === '1' && typeof cabecera === 'string') {
    const fecha = new Date(cabecera);
    if (!Number.isNaN(fecha.getTime())) return fecha;
  }
  return new Date();
}
