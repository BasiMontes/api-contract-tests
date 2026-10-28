import { test } from '@playwright/test';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { crearUsuario, esperarError } from './support/reservas';

// Mismo secreto que el servidor: el de la variable JWT_SECRET o el de práctica por defecto.
const SECRETO = process.env.JWT_SECRET ?? 'solo-para-practica-local';

async function protegido(request: Parameters<typeof crearUsuario>[0], cabecera: string) {
  return request.get('/reservas', { headers: { Authorization: cabecera } });
}

test.describe('Tokens rechazados en rutas protegidas', () => {
  test('una cabecera sin el prefijo Bearer devuelve 401 UNAUTHORIZED', async ({ request }) => {
    const { token } = await crearUsuario(request);
    await esperarError(await protegido(request, `Token ${token}`), 'get', '/reservas', 401, 'UNAUTHORIZED');
  });

  test('un token firmado con otra clave devuelve 401 UNAUTHORIZED', async ({ request }) => {
    const falso = jwt.sign({}, 'otra-clave-que-no-es-la-del-servidor', { subject: randomUUID(), expiresIn: 3600 });
    await esperarError(await protegido(request, `Bearer ${falso}`), 'get', '/reservas', 401, 'UNAUTHORIZED');
  });

  test('un token caducado devuelve 401 UNAUTHORIZED', async ({ request }) => {
    const caducado = jwt.sign({}, SECRETO, { subject: randomUUID(), expiresIn: -10 });
    await esperarError(await protegido(request, `Bearer ${caducado}`), 'get', '/reservas', 401, 'UNAUTHORIZED');
  });

  test('un token firmado correctamente pero sin sujeto devuelve 401 UNAUTHORIZED', async ({ request }) => {
    const sinSujeto = jwt.sign({}, SECRETO, { expiresIn: 3600 });
    await esperarError(await protegido(request, `Bearer ${sinSujeto}`), 'get', '/reservas', 401, 'UNAUTHORIZED');
  });
});
