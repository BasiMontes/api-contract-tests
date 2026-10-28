import { test, expect } from '@playwright/test';
import { erroresDeEsquema, declarado } from './support/contrato';

const SEED_ESPERADO: Record<string, number> = {
  padel: 6,
  tenis: 4,
  futbol7: 3,
  futbol11: 1,
  baloncesto: 1,
};

test.describe('GET /pistas (público)', () => {
  test('sin token devuelve 200 con una lista que cumple el esquema Pista', async ({ request }) => {
    const res = await request.get('/pistas');

    expect(res.status()).toBe(200);
    expect(await declarado('get', '/pistas', 200)).toBe(true);

    const pistas = await res.json();
    expect(Array.isArray(pistas)).toBe(true);
    for (const pista of pistas) {
      expect(await erroresDeEsquema('Pista', pista)).toEqual([]);
    }
  });

  test('el seed tiene 15 pistas con el reparto acordado', async ({ request }) => {
    const pistas: { deporte: string }[] = await (await request.get('/pistas')).json();

    expect(pistas).toHaveLength(15);
    const conteo: Record<string, number> = {};
    for (const p of pistas) conteo[p.deporte] = (conteo[p.deporte] ?? 0) + 1;
    expect(conteo).toEqual(SEED_ESPERADO);
  });

  test('una pista concreta devuelve 200 y cumple el esquema Pista', async ({ request }) => {
    const id = '00000000-0000-4000-8000-000000000001';
    const res = await request.get(`/pistas/${id}`);

    expect(res.status()).toBe(200);
    const pista = await res.json();
    expect(await erroresDeEsquema('Pista', pista)).toEqual([]);
    expect(pista.id).toBe(id);
  });

  test('una pista inexistente devuelve 404 NOT_FOUND', async ({ request }) => {
    const res = await request.get('/pistas/00000000-0000-4000-8000-0000000000ff');

    expect(res.status()).toBe(404);
    expect(await declarado('get', '/pistas/{id}', 404)).toBe(true);
    const cuerpo = await res.json();
    expect(await erroresDeEsquema('Error', cuerpo)).toEqual([]);
    expect(cuerpo.code).toBe('NOT_FOUND');
  });
});
