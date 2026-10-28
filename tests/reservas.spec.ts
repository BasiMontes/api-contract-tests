import { test, expect } from '@playwright/test';
import { erroresDeEsquema, declarado } from './support/contrato';
import {
  crearUsuario,
  diaAleatorio,
  esperarError,
  esperarReservaCreada,
  lunesDeSemana,
  madridISO,
  pistaId,
  reservar,
  sumarDias,
} from './support/reservas';

test.describe('Horario de apertura (9:00-14:00 y 16:00-22:00, hora de Madrid)', () => {
  test('una reserva dentro de un tramo devuelve 201', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const fecha = diaAleatorio();
    const res = await reservar(request, token, pistaId(1), fecha, '10:00', '11:00');
    await esperarReservaCreada(res, madridISO(fecha, '10:00'), madridISO(fecha, '11:00'));
  });

  test('los límites de apertura son válidos: 9:00 y 13:00-14:00 (cierre exacto)', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const fecha = diaAleatorio();
    await esperarReservaCreada(
      await reservar(request, token, pistaId(1), fecha, '09:00', '10:00'),
      madridISO(fecha, '09:00'),
      madridISO(fecha, '10:00'),
    );
    await esperarReservaCreada(
      await reservar(request, token, pistaId(1), fecha, '13:00', '14:00'),
      madridISO(fecha, '13:00'),
      madridISO(fecha, '14:00'),
    );
    await esperarReservaCreada(
      await reservar(request, token, pistaId(1), fecha, '21:00', '22:00'),
      madridISO(fecha, '21:00'),
      madridISO(fecha, '22:00'),
    );
  });

  test('una reserva que cruza el cierre (13:30-14:30) devuelve 400 OUTSIDE_OPENING_HOURS', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '13:30', '14:30');
    await esperarError(res, 'post', '/reservas', 400, 'OUTSIDE_OPENING_HOURS');
  });

  test('una reserva que empieza durante el cierre (14:00-15:00) devuelve 400 OUTSIDE_OPENING_HOURS', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '14:00', '15:00');
    await esperarError(res, 'post', '/reservas', 400, 'OUTSIDE_OPENING_HOURS');
  });

  test('una reserva que termina después de las 22:00 devuelve 400 OUTSIDE_OPENING_HOURS', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '21:30', '22:30');
    await esperarError(res, 'post', '/reservas', 400, 'OUTSIDE_OPENING_HOURS');
  });

  test('una reserva que empieza 30 minutos antes de la reapertura (15:30-16:30) devuelve 400 OUTSIDE_OPENING_HOURS', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '15:30', '16:30');
    await esperarError(res, 'post', '/reservas', 400, 'OUTSIDE_OPENING_HOURS');
  });

  test('la reapertura a las 16:00 es válida (16:00-17:00 devuelve 201)', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const fecha = diaAleatorio();
    await esperarReservaCreada(
      await reservar(request, token, pistaId(1), fecha, '16:00', '17:00'),
      madridISO(fecha, '16:00'),
      madridISO(fecha, '17:00'),
    );
  });

  test('una reserva antes de las 9:00 devuelve 400 OUTSIDE_OPENING_HOURS', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '08:30', '09:30');
    await esperarError(res, 'post', '/reservas', 400, 'OUTSIDE_OPENING_HOURS');
  });
});

test.describe('Formato y duración', () => {
  test('un inicio que no es en punto ni y media devuelve 400 VALIDATION_ERROR', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '10:15', '11:15');
    await esperarError(res, 'post', '/reservas', 400, 'VALIDATION_ERROR');
  });

  test('una duración de 45 minutos devuelve 400 VALIDATION_ERROR', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '10:00', '10:45');
    await esperarError(res, 'post', '/reservas', 400, 'VALIDATION_ERROR');
  });

  test('una duración de 3 horas devuelve 400 VALIDATION_ERROR', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '09:00', '12:00');
    await esperarError(res, 'post', '/reservas', 400, 'VALIDATION_ERROR');
  });

  test('un fin anterior al inicio devuelve 400 VALIDATION_ERROR', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), diaAleatorio(), '11:00', '10:00');
    await esperarError(res, 'post', '/reservas', 400, 'VALIDATION_ERROR');
  });

  test('una fecha que no es ISO 8601 devuelve 400 VALIDATION_ERROR', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await request.post('/reservas', {
      headers: { Authorization: `Bearer ${token}` },
      data: { pistaId: pistaId(1), inicio: '05/01/2040 10:00', fin: '05/01/2040 11:00' },
    });
    await esperarError(res, 'post', '/reservas', 400, 'VALIDATION_ERROR');
  });

  test('un campo no documentado devuelve 400 VALIDATION_ERROR', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const fecha = diaAleatorio();
    const res = await request.post('/reservas', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        pistaId: pistaId(1),
        inicio: madridISO(fecha, '10:00'),
        fin: madridISO(fecha, '11:00'),
        precioPagado: 0,
      },
    });
    await esperarError(res, 'post', '/reservas', 400, 'VALIDATION_ERROR');
  });

  test('una pista que no existe devuelve 404 NOT_FOUND', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, '00000000-0000-4000-8000-0000000000ff', diaAleatorio(), '10:00', '11:00');
    await esperarError(res, 'post', '/reservas', 404, 'NOT_FOUND');
  });
});

test.describe('Reservas pasadas', () => {
  test('una reserva en el pasado devuelve 400 PAST_RESERVATION', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const res = await reservar(request, token, pistaId(1), '2020-01-06', '10:00', '11:00');
    await esperarError(res, 'post', '/reservas', 400, 'PAST_RESERVATION');
  });
});

test.describe('Solapes', () => {
  test('dos reservas solapadas en la misma pista devuelven 409 SLOT_OCCUPIED', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const bea = await crearUsuario(request);

    expect((await reservar(request, ana.token, pistaId(2), fecha, '10:00', '11:00')).status()).toBe(201);
    const res = await reservar(request, bea.token, pistaId(2), fecha, '10:30', '11:30');
    await esperarError(res, 'post', '/reservas', 409, 'SLOT_OCCUPIED');
  });

  test('una reserva pegada (sin solape) en la misma pista devuelve 201', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const bea = await crearUsuario(request);

    expect((await reservar(request, ana.token, pistaId(2), fecha, '10:00', '11:00')).status()).toBe(201);
    await esperarReservaCreada(
      await reservar(request, bea.token, pistaId(2), fecha, '11:00', '12:00'),
      madridISO(fecha, '11:00'),
      madridISO(fecha, '12:00'),
    );
  });

  test('una reserva cancelada no bloquea el hueco', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const bea = await crearUsuario(request);

    const creada = await (await reservar(request, ana.token, pistaId(3), fecha, '10:00', '11:00')).json();
    const cancelar = await request.delete(`/reservas/${creada.id}`, {
      headers: { Authorization: `Bearer ${ana.token}` },
    });
    expect(cancelar.status()).toBe(204);

    await esperarReservaCreada(
      await reservar(request, bea.token, pistaId(3), fecha, '10:00', '11:00'),
      madridISO(fecha, '10:00'),
      madridISO(fecha, '11:00'),
    );
  });

  test('un usuario no puede tener dos reservas solapadas en pistas distintas (409 USER_OVERLAP)', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);

    expect((await reservar(request, ana.token, pistaId(4), fecha, '10:00', '11:00')).status()).toBe(201);
    const res = await reservar(request, ana.token, pistaId(5), fecha, '10:30', '11:30');
    await esperarError(res, 'post', '/reservas', 409, 'USER_OVERLAP');
  });
});

test.describe('Límites por usuario', () => {
  test('máximo 3 reservas al día: la cuarta devuelve 409 DAILY_LIMIT_EXCEEDED', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);

    expect((await reservar(request, ana.token, pistaId(1), fecha, '09:00', '10:00')).status()).toBe(201);
    expect((await reservar(request, ana.token, pistaId(1), fecha, '11:00', '12:00')).status()).toBe(201);
    expect((await reservar(request, ana.token, pistaId(1), fecha, '16:00', '17:00')).status()).toBe(201);

    const res = await reservar(request, ana.token, pistaId(1), fecha, '18:00', '19:00');
    await esperarError(res, 'post', '/reservas', 409, 'DAILY_LIMIT_EXCEEDED');
  });

  test('cancelar una reserva libera cupo diario', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);

    await reservar(request, ana.token, pistaId(1), fecha, '09:00', '10:00');
    await reservar(request, ana.token, pistaId(1), fecha, '11:00', '12:00');
    const tercera = await (await reservar(request, ana.token, pistaId(1), fecha, '16:00', '17:00')).json();
    await esperarError(
      await reservar(request, ana.token, pistaId(1), fecha, '18:00', '19:00'),
      'post',
      '/reservas',
      409,
      'DAILY_LIMIT_EXCEEDED',
    );

    const cancelar = await request.delete(`/reservas/${tercera.id}`, {
      headers: { Authorization: `Bearer ${ana.token}` },
    });
    expect(cancelar.status()).toBe(204);

    await esperarReservaCreada(
      await reservar(request, ana.token, pistaId(1), fecha, '18:00', '19:00'),
      madridISO(fecha, '18:00'),
      madridISO(fecha, '19:00'),
    );
  });

  test('tres reservas pegadas en pistas distintas devuelven 409 CHAIN_LIMIT_EXCEEDED', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);

    expect((await reservar(request, ana.token, pistaId(1), fecha, '09:00', '10:00')).status()).toBe(201);
    expect((await reservar(request, ana.token, pistaId(2), fecha, '10:00', '11:00')).status()).toBe(201);

    const res = await reservar(request, ana.token, pistaId(3), fecha, '11:00', '12:00');
    await esperarError(res, 'post', '/reservas', 409, 'CHAIN_LIMIT_EXCEEDED');
  });

  test('dos reservas pegadas más una separada no forman cadena (201)', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);

    expect((await reservar(request, ana.token, pistaId(1), fecha, '09:00', '10:00')).status()).toBe(201);
    expect((await reservar(request, ana.token, pistaId(2), fecha, '10:00', '11:00')).status()).toBe(201);
    await esperarReservaCreada(
      await reservar(request, ana.token, pistaId(3), fecha, '13:00', '14:00'),
      madridISO(fecha, '13:00'),
      madridISO(fecha, '14:00'),
    );
  });

  test('máximo 10 reservas por semana ISO: la undécima devuelve 409 WEEKLY_LIMIT_EXCEEDED', async ({ request }) => {
    const lunes = lunesDeSemana(diaAleatorio());
    const ana = await crearUsuario(request);

    // Lunes a viernes, dos reservas por día separadas (sin cadena ni más de 3 al día).
    for (let dia = 0; dia < 5; dia++) {
      const fecha = sumarDias(lunes, dia);
      expect((await reservar(request, ana.token, pistaId(1), fecha, '09:00', '10:00')).status()).toBe(201);
      expect((await reservar(request, ana.token, pistaId(1), fecha, '16:00', '17:00')).status()).toBe(201);
    }

    const sabado = sumarDias(lunes, 5);
    const res = await reservar(request, ana.token, pistaId(1), sabado, '09:00', '10:00');
    await esperarError(res, 'post', '/reservas', 409, 'WEEKLY_LIMIT_EXCEEDED');
  });
});

test.describe('Cancelación', () => {
  test('cancelar una reserva propia devuelve 204 y pasa a cancelada', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const creada = await (await reservar(request, ana.token, pistaId(6), fecha, '10:00', '11:00')).json();

    const cancelar = await request.delete(`/reservas/${creada.id}`, {
      headers: { Authorization: `Bearer ${ana.token}` },
    });
    expect(cancelar.status()).toBe(204);
    expect(await declarado('delete', '/reservas/{id}', 204)).toBe(true);

    const consulta = await request.get(`/reservas/${creada.id}`, {
      headers: { Authorization: `Bearer ${ana.token}` },
    });
    const reserva = await consulta.json();
    expect(await erroresDeEsquema('Reserva', reserva)).toEqual([]);
    expect(reserva.estado).toBe('cancelada');
  });

  test('cancelar una reserva ya cancelada devuelve 409 RESERVATION_NOT_ACTIVE', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const creada = await (await reservar(request, ana.token, pistaId(6), fecha, '10:00', '11:00')).json();
    const cabecera = { Authorization: `Bearer ${ana.token}` };

    expect((await request.delete(`/reservas/${creada.id}`, { headers: cabecera })).status()).toBe(204);
    const segunda = await request.delete(`/reservas/${creada.id}`, { headers: cabecera });
    await esperarError(segunda, 'delete', '/reservas/{id}', 409, 'RESERVATION_NOT_ACTIVE');
  });

  test('cancelar una reserva ya empezada devuelve 409 RESERVATION_STARTED', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const cabecera = { Authorization: `Bearer ${ana.token}` };
    const creada = await (await reservar(request, ana.token, pistaId(6), fecha, '10:00', '11:00')).json();

    // Justo en el instante de inicio ya cuenta como empezada (inicio <= ahora).
    const enElInicio = madridISO(fecha, '10:00');
    const res = await request.delete(`/reservas/${creada.id}`, {
      headers: { ...cabecera, 'X-Practica-Ahora': enElInicio },
    });
    await esperarError(res, 'delete', '/reservas/{id}', 409, 'RESERVATION_STARTED');

    // El intento fallido no debe cambiar la reserva.
    const consulta = await (await request.get(`/reservas/${creada.id}`, { headers: cabecera })).json();
    expect(consulta.estado).toBe('activa');
  });

  test('cancelar una reserva un minuto antes de su inicio sigue permitido (204)', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const cabecera = { Authorization: `Bearer ${ana.token}` };
    const creada = await (await reservar(request, ana.token, pistaId(6), fecha, '10:00', '11:00')).json();

    const unMinutoAntes = new Date(new Date(madridISO(fecha, '10:00')).getTime() - 60000).toISOString();
    const res = await request.delete(`/reservas/${creada.id}`, {
      headers: { ...cabecera, 'X-Practica-Ahora': unMinutoAntes },
    });
    expect(res.status()).toBe(204);
  });

  test('cancelar la reserva de otro usuario devuelve 404 igual que una inexistente', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const bea = await crearUsuario(request);
    const creada = await (await reservar(request, ana.token, pistaId(7), fecha, '10:00', '11:00')).json();
    const cabeceraBea = { Authorization: `Bearer ${bea.token}` };

    const ajena = await request.delete(`/reservas/${creada.id}`, { headers: cabeceraBea });
    const inexistente = await request.delete('/reservas/00000000-0000-4000-8000-0000000000ff', {
      headers: cabeceraBea,
    });

    await esperarError(ajena, 'delete', '/reservas/{id}', 404, 'NOT_FOUND');
    expect(inexistente.status()).toBe(404);
    expect(await ajena.json()).toEqual(await inexistente.json());
  });

  test('la reserva ajena no se puede consultar y responde igual que una inexistente', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const bea = await crearUsuario(request);
    const creada = await (await reservar(request, ana.token, pistaId(7), fecha, '10:00', '11:00')).json();
    const cabeceraBea = { Authorization: `Bearer ${bea.token}` };

    const ajena = await request.get(`/reservas/${creada.id}`, { headers: cabeceraBea });
    const inexistente = await request.get('/reservas/00000000-0000-4000-8000-0000000000ff', { headers: cabeceraBea });

    await esperarError(ajena, 'get', '/reservas/{id}', 404, 'NOT_FOUND');
    expect(await ajena.json()).toEqual(await inexistente.json());
  });
});

test.describe('Listado y autenticación', () => {
  test('GET /reservas solo devuelve las reservas del usuario autenticado', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);
    const bea = await crearUsuario(request);
    const deAna = await (await reservar(request, ana.token, pistaId(8), fecha, '10:00', '11:00')).json();
    await reservar(request, bea.token, pistaId(9), fecha, '10:00', '11:00');

    const res = await request.get('/reservas', { headers: { Authorization: `Bearer ${ana.token}` } });
    expect(res.status()).toBe(200);
    const lista = await res.json();
    for (const r of lista) {
      expect(await erroresDeEsquema('Reserva', r)).toEqual([]);
      expect(r.usuarioId).toBe(deAna.usuarioId);
    }
    expect(lista.map((r: { id: string }) => r.id)).toContain(deAna.id);
  });

  test('crear una reserva sin token devuelve 401 UNAUTHORIZED', async ({ request }) => {
    const fecha = diaAleatorio();
    const res = await request.post('/reservas', {
      data: { pistaId: pistaId(1), inicio: madridISO(fecha, '10:00'), fin: madridISO(fecha, '11:00') },
    });
    await esperarError(res, 'post', '/reservas', 401, 'UNAUTHORIZED');
  });

  test('un token inventado devuelve 401 UNAUTHORIZED', async ({ request }) => {
    const res = await request.get('/reservas', { headers: { Authorization: 'Bearer abc.def.ghi' } });
    await esperarError(res, 'get', '/reservas', 401, 'UNAUTHORIZED');
  });

  test('cancelar sin token devuelve 401 UNAUTHORIZED', async ({ request }) => {
    const res = await request.delete('/reservas/00000000-0000-4000-8000-000000000001');
    await esperarError(res, 'delete', '/reservas/{id}', 401, 'UNAUTHORIZED');
  });
});

// ---------- Casos añadidos: bordes de duración, cadena, límites y cambio de horario ----------

function ultimoDomingoDeMarzo(anio: number): string {
  for (let d = 31; d >= 25; d--) {
    const f = new Date(Date.UTC(anio, 2, d));
    if (f.getUTCDay() === 0) return f.toISOString().slice(0, 10);
  }
  throw new Error('no hay domingo en la última semana de marzo');
}

test.describe('Duración en los límites exactos', () => {
  test('60 y 120 minutos se aceptan (201)', async ({ request }) => {
    const { token } = await crearUsuario(request);
    const fecha = diaAleatorio();
    await esperarReservaCreada(
      await reservar(request, token, pistaId(1), fecha, '09:00', '10:00'),
      madridISO(fecha, '09:00'),
      madridISO(fecha, '10:00'),
    );
    await esperarReservaCreada(
      await reservar(request, token, pistaId(2), fecha, '11:00', '13:00'),
      madridISO(fecha, '11:00'),
      madridISO(fecha, '13:00'),
    );
  });
});

test.describe('Cadena de reservas pegadas', () => {
  test('una reserva que une dos existentes forma cadena de tres y devuelve 409 CHAIN_LIMIT_EXCEEDED', async ({ request }) => {
    const fecha = diaAleatorio();
    const ana = await crearUsuario(request);

    // Dos reservas con hueco entre ellas (10:00-11:00 libre): no forman cadena.
    expect((await reservar(request, ana.token, pistaId(1), fecha, '09:00', '10:00')).status()).toBe(201);
    expect((await reservar(request, ana.token, pistaId(3), fecha, '11:00', '12:00')).status()).toBe(201);

    // La nueva rellena el hueco: queda 09-10, 10-11 y 11-12 pegadas.
    const res = await reservar(request, ana.token, pistaId(2), fecha, '10:00', '11:00');
    await esperarError(res, 'post', '/reservas', 409, 'CHAIN_LIMIT_EXCEEDED');
  });
});

test.describe('Límites y el paso de un día a otro', () => {
  test('tras llegar a 3 reservas en un día, el día siguiente admite reservas (201)', async ({ request }) => {
    const fecha = diaAleatorio();
    const siguiente = sumarDias(fecha, 1);
    const ana = await crearUsuario(request);

    expect((await reservar(request, ana.token, pistaId(1), fecha, '09:00', '10:00')).status()).toBe(201);
    expect((await reservar(request, ana.token, pistaId(1), fecha, '11:00', '12:00')).status()).toBe(201);
    expect((await reservar(request, ana.token, pistaId(1), fecha, '16:00', '17:00')).status()).toBe(201);

    await esperarReservaCreada(
      await reservar(request, ana.token, pistaId(1), siguiente, '09:00', '10:00'),
      madridISO(siguiente, '09:00'),
      madridISO(siguiente, '10:00'),
    );
  });

  test('el límite semanal se reinicia el lunes siguiente (201)', async ({ request }) => {
    const lunes = lunesDeSemana(diaAleatorio());
    const ana = await crearUsuario(request);

    // Diez reservas en la semana: lunes a viernes, dos por día, sin cadena.
    for (let dia = 0; dia < 5; dia++) {
      const fecha = sumarDias(lunes, dia);
      expect((await reservar(request, ana.token, pistaId(1), fecha, '09:00', '10:00')).status()).toBe(201);
      expect((await reservar(request, ana.token, pistaId(1), fecha, '16:00', '17:00')).status()).toBe(201);
    }

    // El último hueco de la semana (domingo) ya cuenta como undécima: 409.
    const domingo = sumarDias(lunes, 6);
    await esperarError(
      await reservar(request, ana.token, pistaId(1), domingo, '20:00', '21:00'),
      'post',
      '/reservas',
      409,
      'WEEKLY_LIMIT_EXCEEDED',
    );

    // El lunes siguiente empieza una semana nueva: 201.
    const lunesSiguiente = sumarDias(lunes, 7);
    await esperarReservaCreada(
      await reservar(request, ana.token, pistaId(1), lunesSiguiente, '09:00', '10:00'),
      madridISO(lunesSiguiente, '09:00'),
      madridISO(lunesSiguiente, '10:00'),
    );
  });
});

test.describe('Cambio de horario (Europe/Madrid)', () => {
  test('en el día del cambio a horario de verano, 10:00 de Madrid es 08:00 UTC', async ({ request }) => {
    const anio = 2040 + Math.floor(Math.random() * 50);
    const fecha = ultimoDomingoDeMarzo(anio);
    const { token } = await crearUsuario(request);

    // Valor esperado escrito a mano: después del cambio, Madrid va en UTC+2.
    await esperarReservaCreada(
      await reservar(request, token, pistaId(1), fecha, '10:00', '11:00'),
      `${fecha}T08:00:00.000Z`,
      `${fecha}T09:00:00.000Z`,
    );
  });
});
