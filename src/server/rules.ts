import type { Reserva, Store } from './store';

export interface Fallo {
  status: number;
  code: string;
  message: string;
}

const TZ = 'Europe/Madrid';
// Tramos de apertura en minutos desde medianoche, hora de Madrid: 9:00-14:00 y 16:00-22:00.
const TRAMOS: [number, number][] = [
  [9 * 60, 14 * 60],
  [16 * 60, 22 * 60],
];
const MAX_DIA = 3;
const MAX_SEMANA = 10;
const MAX_CADENA = 2; // no pueden ser tres reservas pegadas

const formatoMadrid = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function madrid(d: Date) {
  const p: Record<string, string> = {};
  for (const x of formatoMadrid.formatToParts(d)) p[x.type] = x.value;
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute) };
}

/** Día de calendario en hora de Madrid, p. ej. "2026-10-28". */
export function diaMadrid(d: Date): string {
  const m = madrid(d);
  return `${m.y}-${m.mo}-${m.d}`;
}

/** Semana ISO en hora de Madrid, p. ej. "2026-W44". */
export function semanaIsoMadrid(d: Date): string {
  const m = madrid(d);
  const t = Date.UTC(m.y, m.mo - 1, m.d);
  const diaSemana = (new Date(t).getUTCDay() + 6) % 7; // lunes = 0
  const jueves = t + (3 - diaSemana) * 86400000;
  const anioIso = new Date(jueves).getUTCFullYear();
  const inicioAnio = Date.UTC(anioIso, 0, 1);
  const semana = Math.floor((jueves - inicioAnio) / 86400000 / 7) + 1;
  return `${anioIso}-W${semana}`;
}

export function checkBody(body: unknown, allowed: string[], required: string[]): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return 'El cuerpo debe ser un objeto JSON';
  }
  const b = body as Record<string, unknown>;
  for (const k of Object.keys(b)) {
    if (!allowed.includes(k)) return `Campo no permitido: ${k}`;
  }
  for (const k of required) {
    if (!(k in b)) return `Falta el campo ${k}`;
  }
  return null;
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function isEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function parseIso(v: unknown): Date | null {
  if (typeof v !== 'string' || !ISO_8601.test(v)) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function aJson(r: Reserva) {
  return {
    id: r.id,
    pistaId: r.pistaId,
    usuarioId: r.usuarioId,
    inicio: r.inicio.toISOString(),
    fin: r.fin.toISOString(),
    estado: r.estado,
  };
}

function enPuntoOMedia(d: Date): boolean {
  return d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0 && [0, 30].includes(madrid(d).mi);
}

function dentroDeTramo(inicio: Date, fin: Date): boolean {
  if (diaMadrid(inicio) !== diaMadrid(fin)) return false;
  const a = madrid(inicio);
  const b = madrid(fin);
  const s = a.h * 60 + a.mi;
  const e = b.h * 60 + b.mi;
  return TRAMOS.some(([t0, t1]) => s >= t0 && e <= t1);
}

function solapan(r: Reserva, ini: number, end: number): boolean {
  return r.inicio.getTime() < end && ini < r.fin.getTime();
}

/** Longitud de la cadena de reservas pegadas (fin = inicio) que contiene la nueva. */
function longitudCadena(inicio: Date, fin: Date, activas: Reserva[]): number {
  let longitud = 1;
  let cursor = inicio.getTime();
  for (;;) {
    const previa = activas.find((r) => r.fin.getTime() === cursor);
    if (!previa) break;
    longitud++;
    cursor = previa.inicio.getTime();
  }
  cursor = fin.getTime();
  for (;;) {
    const siguiente = activas.find((r) => r.inicio.getTime() === cursor);
    if (!siguiente) break;
    longitud++;
    cursor = siguiente.fin.getTime();
  }
  return longitud;
}

/**
 * Aplica en orden las reglas de una reserva nueva. Devuelve el primer fallo o null si es válida.
 */
export function evaluarReserva(
  store: Store,
  usuarioId: string,
  pistaId: string,
  inicio: Date,
  fin: Date,
  ahora: Date,
): Fallo | null {
  const ini = inicio.getTime();
  const end = fin.getTime();

  if (!enPuntoOMedia(inicio) || !enPuntoOMedia(fin)) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Inicio y fin deben ser en punto o y media' };
  }

  const duracion = (end - ini) / 60000;
  if (duracion < 60 || duracion > 120) {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'La duración debe estar entre 60 y 120 minutos' };
  }

  if (ini <= ahora.getTime()) {
    return { status: 400, code: 'PAST_RESERVATION', message: 'No se pueden reservar intervalos que ya han empezado' };
  }

  if (!dentroDeTramo(inicio, fin)) {
    return { status: 400, code: 'OUTSIDE_OPENING_HOURS', message: 'El intervalo está fuera del horario de apertura' };
  }

  const activas = store.reservas.filter((r) => r.estado === 'activa');

  if (activas.some((r) => r.pistaId === pistaId && solapan(r, ini, end))) {
    return { status: 409, code: 'SLOT_OCCUPIED', message: 'La pista ya está reservada en ese intervalo' };
  }

  const delUsuario = activas.filter((r) => r.usuarioId === usuarioId);

  if (delUsuario.some((r) => solapan(r, ini, end))) {
    return { status: 409, code: 'USER_OVERLAP', message: 'Ya tienes una reserva activa en ese intervalo' };
  }

  const dia = diaMadrid(inicio);
  if (delUsuario.filter((r) => diaMadrid(r.inicio) === dia).length >= MAX_DIA) {
    return { status: 409, code: 'DAILY_LIMIT_EXCEEDED', message: `Máximo ${MAX_DIA} reservas activas por día` };
  }

  const semana = semanaIsoMadrid(inicio);
  if (delUsuario.filter((r) => semanaIsoMadrid(r.inicio) === semana).length >= MAX_SEMANA) {
    return { status: 409, code: 'WEEKLY_LIMIT_EXCEEDED', message: `Máximo ${MAX_SEMANA} reservas activas por semana` };
  }

  if (longitudCadena(inicio, fin, delUsuario) > MAX_CADENA) {
    return { status: 409, code: 'CHAIN_LIMIT_EXCEEDED', message: 'No puede haber tres reservas activas pegadas' };
  }

  return null;
}
