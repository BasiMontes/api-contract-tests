import { test, expect, APIRequestContext } from '@playwright/test';
import { erroresDeEsquema, declarado } from './support/contrato';

const PASSWORD = 'clave-segura-123';

function emailUnico(): string {
  return `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.es`;
}

async function registrar(request: APIRequestContext, email: string) {
  return request.post('/auth/registro', { data: { email, password: PASSWORD, nombre: 'Ana' } });
}

test.describe('POST /auth/registro', () => {
  test('devuelve 201 y un cuerpo que cumple el esquema Usuario', async ({ request }) => {
    const email = emailUnico();
    const res = await registrar(request, email);

    expect(res.status()).toBe(201);
    expect(await declarado('post', '/auth/registro', 201)).toBe(true);

    const cuerpo = await res.json();
    expect(await erroresDeEsquema('Usuario', cuerpo)).toEqual([]);
    expect(cuerpo.email).toBe(email);
  });

  test('la contraseña nunca aparece en la respuesta', async ({ request }) => {
    const res = await registrar(request, emailUnico());
    const cuerpo = await res.json();

    expect(cuerpo).not.toHaveProperty('password');
    expect(cuerpo).not.toHaveProperty('passwordHash');
    expect(await res.text()).not.toContain(PASSWORD);
  });

  test('un email repetido en otras mayúsculas devuelve 409 EMAIL_TAKEN', async ({ request }) => {
    const email = emailUnico();
    expect((await registrar(request, email)).status()).toBe(201);

    const res = await registrar(request, email.toUpperCase());
    expect(res.status()).toBe(409);
    expect(await declarado('post', '/auth/registro', 409)).toBe(true);

    const cuerpo = await res.json();
    expect(await erroresDeEsquema('Error', cuerpo)).toEqual([]);
    expect(cuerpo.code).toBe('EMAIL_TAKEN');
  });

  test('un campo no documentado en la petición devuelve 400 VALIDATION_ERROR', async ({ request }) => {
    const res = await request.post('/auth/registro', {
      data: { email: emailUnico(), password: PASSWORD, nombre: 'Ana', rol: 'admin' },
    });

    expect(res.status()).toBe(400);
    const cuerpo = await res.json();
    expect(await erroresDeEsquema('Error', cuerpo)).toEqual([]);
    expect(cuerpo.code).toBe('VALIDATION_ERROR');
  });

  test('una contraseña de menos de 8 caracteres devuelve 400 VALIDATION_ERROR', async ({ request }) => {
    const res = await request.post('/auth/registro', {
      data: { email: emailUnico(), password: 'corta', nombre: 'Ana' },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_ERROR');
  });
});

test.describe('POST /auth/login', () => {
  test('devuelve 200 con token y expiresIn de 3600 segundos', async ({ request }) => {
    const email = emailUnico();
    await registrar(request, email);

    const res = await request.post('/auth/login', { data: { email, password: PASSWORD } });
    expect(res.status()).toBe(200);
    expect(await declarado('post', '/auth/login', 200)).toBe(true);

    const cuerpo = await res.json();
    expect(await erroresDeEsquema('LoginResponse', cuerpo)).toEqual([]);
    expect(cuerpo.expiresIn).toBe(3600);
    expect(cuerpo.token.split('.')).toHaveLength(3); // formato JWT: cabecera.carga.firma
  });

  test('una contraseña incorrecta devuelve 401 INVALID_CREDENTIALS', async ({ request }) => {
    const email = emailUnico();
    await registrar(request, email);

    const res = await request.post('/auth/login', { data: { email, password: 'otra-clave-999' } });
    expect(res.status()).toBe(401);

    const cuerpo = await res.json();
    expect(await erroresDeEsquema('Error', cuerpo)).toEqual([]);
    expect(cuerpo.code).toBe('INVALID_CREDENTIALS');
  });

  test('un usuario inexistente devuelve el mismo 401 que una contraseña incorrecta', async ({ request }) => {
    const email = emailUnico();
    await registrar(request, email);

    const conClaveMala = await request.post('/auth/login', { data: { email, password: 'otra-clave-999' } });
    const sinUsuario = await request.post('/auth/login', { data: { email: emailUnico(), password: PASSWORD } });

    expect(sinUsuario.status()).toBe(conClaveMala.status());
    expect(await sinUsuario.json()).toEqual(await conClaveMala.json());
  });
});
