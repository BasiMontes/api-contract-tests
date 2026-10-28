# api-contract-tests

Pruebas de contrato sobre una API de práctica de reservas de pistas deportivas (Node.js + Express + JWT). La especificación en `openapi.yaml` es la fuente de verdad: las pruebas comprueban que el servidor cumple lo que promete.

Estado: especificación 1.3.0, servidor de práctica y 51 pruebas de contrato, todas en verde.

## Reglas de negocio

OpenAPI no expresa bien estas reglas, así que se documentan aquí y se prueban de forma explícita.

**Horario**
- Horario igual para todas las pistas: 9:00-14:00 y 16:00-22:00, hora de Madrid.
- Una reserva no puede cruzar el tramo de cierre (14:00-16:00). Fuera de horario: 400 `OUTSIDE_OPENING_HOURS`.
- Inicio en :00 o :30. Duración de 60 a 120 minutos. `fin` posterior a `inicio`.
- Fechas en UTC, formato ISO 8601.
- Un intervalo que ya ha empezado no se puede reservar: 400 `PAST_RESERVATION`.

**Solapes**
- Solape en la misma pista con una reserva `activa`: 409 `SLOT_OCCUPIED`. Las canceladas no bloquean.
- Un usuario no puede tener dos reservas activas solapadas, aunque sean en pistas distintas: 409 `USER_OVERLAP`.

**Límites por usuario** (solo cuentan reservas `activa`)
- Diario: máximo 3 cuyo `inicio` cae en ese día, en hora de Madrid. 409 `DAILY_LIMIT_EXCEEDED`.
- Cadena: no puede haber tres reservas pegadas, en cualquier pista. "Pegada" significa que el `fin` de una coincide exactamente con el `inicio` de otra. 409 `CHAIN_LIMIT_EXCEEDED`.
- Semanal: máximo 10 por semana ISO, en hora de Madrid. 409 `WEEKLY_LIMIT_EXCEEDED`.

**Cancelación y acceso**
- Cancelar solo si la reserva está `activa` y no ha empezado. Cancelar libera hueco y cupo.
- Ya cancelada: 409 `RESERVATION_NOT_ACTIVE`. Ya empezada: 409 `RESERVATION_STARTED`.
- Reserva inexistente o ajena: 404 con el mismo cuerpo. No se usa 403 para no revelar que el recurso existe.

**Usuarios**
- Email único sin distinguir mayúsculas. Duplicado: 409 `EMAIL_TAKEN`.
- Pistas y su consulta son públicas. Reservas siempre requieren token JWT (caduca a los 60 minutos).

## Seed (15 pistas, fijas)

| Deporte | Cantidad |
|---|---|
| padel | 6 |
| tenis | 4 |
| futbol7 | 3 |
| futbol11 | 1 |
| baloncesto | 1 |

## Versiones

- 1.3.0: los esquemas de respuesta no admiten campos no documentados (`additionalProperties: false`). Así una contraseña filtrada o un campo nuevo hace fallar la prueba de contrato.
- 1.2.0: un código de error por cada límite (`DAILY_LIMIT_EXCEEDED`, `WEEKLY_LIMIT_EXCEEDED`, `CHAIN_LIMIT_EXCEEDED`) en lugar de `LIMIT_EXCEEDED` con `details`. Se añade `USER_OVERLAP`.
- 1.1.0: primera versión con reglas de negocio cerradas.

## Pruebas

```bash
npm test                           # arranca el servidor local y ejecuta las pruebas
API_URL=http://otro-host npm test  # prueba contra un servidor ya levantado
```

- `tests/auth.spec.ts` y `tests/pistas.spec.ts`: contrato de cada operación contra `openapi.yaml`.
- `tests/reservas.spec.ts`: horario, formato, pasado, solapes, límites por usuario, cancelación, propiedad y autenticación.
- Modo práctica: con `MODO_PRACTICA=1` el servidor acepta la cabecera `X-Practica-Ahora` (fecha ISO 8601) como hora de referencia para las reglas de pasado y de cancelación. Fuera de ese modo la cabecera se ignora. Las pruebas la usan para probar `RESERVATION_STARTED` sin esperar. No debe activarse en ningún entorno real.
- `tests/contrato-validador.spec.ts`: comprueba que el validador rechaza lo que debe rechazar.

## Cómo ejecutar

```bash
npm install
npm run typecheck     # compila el servidor
npm run server        # arranca la API en http://localhost:3000 (PORT y JWT_SECRET son opcionales)
```

## Decisiones de implementación

- Los IDs que no son UUID en la ruta devuelven 404 `NOT_FOUND`, igual que un UUID inexistente.
- Las reservas se validan en este orden: formato y duración (400 `VALIDATION_ERROR`), pasado (400 `PAST_RESERVATION`), horario (400 `OUTSIDE_OPENING_HOURS`), solape en la pista (409 `SLOT_OCCUPIED`), solape del usuario (409 `USER_OVERLAP`), límite diario, semanal y de cadena.
- El email se guarda en minúsculas, y la respuesta de registro lo devuelve así.
- Un error inesperado devuelve 500 con `INTERNAL_ERROR`. Este código no está en `openapi.yaml`: queda pendiente decidir si se documenta o se cambia.
