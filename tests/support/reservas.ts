import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { erroresDeEsquema, declarado } from './contrato';

const PASSWORD = 'clave-segura-123';

/** Id fijo de la pista n (1..15), igual que en el seed del servidor. */
export function pistaId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Día de calendario aleatorio entre 2040 y 2094, para no chocar con otras pruebas ni con el reloj real. */
export function diaAleatorio(): string {
  const base = Date.UTC(2040, 0, 1);
  const dias = Math.floor(Math.random() * 20000);
  return new Date(base + dias * 86400000).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Lunes de la semana ISO a la que pertenece `fecha`. */
export function lunesDeSemana(fecha: string): string {
  const diaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay(); // domingo = 0
  return sumarDias(fecha, -((diaSemana + 6) % 7));
}

/** Desplazamiento de Europe/Madrid en un instante, en milisegundos. */
function desplazamientoMadrid(instante: Date): number {
  const p: Record<string, string> = {};
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instante);
  for (const x of partes) p[x.type] = x.value;
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return local - instante.getTime();
}

/** Convierte una hora de Madrid ("2040-01-05", "10:00") a ISO 8601 en UTC. */
export function madridISO(fecha: string, hora: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const localComoUtc = Date.UTC(y, m - 1, d, h, mi);
  let utc = localComoUtc;
  for (let i = 0; i < 2; i++) {
    utc = localComoUtc - desplazamientoMadrid(new Date(utc));
  }
  return new Date(utc).toISOString();
}

export async function crearUsuario(request: APIRequestContext): Promise<{ token: string; email: string }> {
  const email = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@test.es`;
  const reg = await request.post('/auth/registro', { data: { email, password: PASSWORD, nombre: 'QA' } });
  expect(reg.status()).toBe(201);
  const login = await request.post('/auth/login', { data: { email, password: PASSWORD } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  return { token, email };
}

/** Reserva de una hora de Madrid a otra en el día indicado. */
export function reservar(
  request: APIRequestContext,
  token: string,
  pista: string,
  fecha: string,
  horaInicio: string,
  horaFin: string,
): Promise<APIResponse> {
  return request.post('/reservas', {
    headers: { Authorization: `Bearer ${token}` },
    data: { pistaId: pista, inicio: madridISO(fecha, horaInicio), fin: madridISO(fecha, horaFin) },
  });
}

/** Comprueba que la respuesta es un error declarado en la especificación, con el código esperado. */
export async function esperarError(
  res: APIResponse,
  metodo: string,
  ruta: string,
  status: number,
  code: string,
): Promise<Record<string, unknown>> {
  expect(res.status(), `estado de ${metodo} ${ruta}`).toBe(status);
  expect(await declarado(metodo, ruta, status), `${status} declarado en ${metodo} ${ruta}`).toBe(true);
  const cuerpo = await res.json();
  expect(await erroresDeEsquema('Error', cuerpo)).toEqual([]);
  expect(cuerpo.code).toBe(code);
  return cuerpo;
}

/** Comprueba que la reserva creada cumple el esquema Reserva y coincide con lo pedido. */
export async function esperarReservaCreada(res: APIResponse, inicioEsperado: string, finEsperado: string) {
  expect(res.status()).toBe(201);
  const cuerpo = await res.json();
  expect(await erroresDeEsquema('Reserva', cuerpo)).toEqual([]);
  expect(cuerpo.estado).toBe('activa');
  expect(cuerpo.inicio).toBe(inicioEsperado);
  expect(cuerpo.fin).toBe(finEsperado);
  return cuerpo;
}
