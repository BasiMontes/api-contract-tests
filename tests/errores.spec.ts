import { test, expect } from '@playwright/test';
import { erroresDeEsquema, operaciones, tieneRespuestaPorDefecto } from './support/contrato';

test.describe('Respuestas no previstas', () => {
  test('una ruta inexistente devuelve 404 NOT_FOUND con un cuerpo que cumple el esquema Error', async ({ request }) => {
    const res = await request.get('/ruta-que-no-existe');

    expect(res.status()).toBe(404);
    const cuerpo = await res.json();
    expect(await erroresDeEsquema('Error', cuerpo)).toEqual([]);
    expect(cuerpo.code).toBe('NOT_FOUND');
    expect(cuerpo.message).toBe('Ruta no encontrada');
  });

  test('cada operación de la especificación declara una respuesta por defecto', async () => {
    const todas = await operaciones();
    expect(todas.length).toBeGreaterThan(0);
    for (const [metodo, ruta] of todas) {
      expect(await tieneRespuestaPorDefecto(metodo, ruta), `${metodo.toUpperCase()} ${ruta}`).toBe(true);
    }
  });

  test('INTERNAL_ERROR es un código válido del esquema Error', async () => {
    // El servidor devuelve 500 INTERNAL_ERROR ante un fallo no previsto. Desde fuera no hay forma
    // de provocarlo sin inyectar un fallo, así que la prueba comprueba el contrato, no el disparo.
    const cuerpo = { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' };
    expect(await erroresDeEsquema('Error', cuerpo)).toEqual([]);
  });
});
