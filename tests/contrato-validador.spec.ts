import { test, expect } from '@playwright/test';
import { erroresDeEsquema } from './support/contrato';

// Comprobación del propio validador: si estas pruebas fallan, las de contrato no sirven de nada.

test('rechaza un campo no documentado en la respuesta (la contraseña filtrada)', async () => {
  const filtrado = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'ana@test.es',
    nombre: 'Ana',
    password: 'clave-segura-123',
  };
  expect(await erroresDeEsquema('Usuario', filtrado)).not.toEqual([]);
});

test('rechaza un UUID mal formado', async () => {
  const pista = { id: 'no-es-un-uuid', nombre: 'Pista 1', deporte: 'padel' };
  expect(await erroresDeEsquema('Pista', pista)).not.toEqual([]);
});

test('rechaza un deporte fuera del enum', async () => {
  const pista = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Golf 1', deporte: 'golf' };
  expect(await erroresDeEsquema('Pista', pista)).not.toEqual([]);
});

test('acepta una pista válida', async () => {
  const pista = { id: '00000000-0000-4000-8000-000000000001', nombre: 'Pádel 1', deporte: 'padel' };
  expect(await erroresDeEsquema('Pista', pista)).toEqual([]);
});
