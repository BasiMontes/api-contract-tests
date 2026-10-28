# api-contract-tests

[![CI](https://github.com/BasiMontes/api-contract-tests/actions/workflows/ci.yml/badge.svg)](https://github.com/BasiMontes/api-contract-tests/actions/workflows/ci.yml)

Pruebas de contrato sobre una API de práctica para reservar pistas deportivas (Node.js, Express y JWT). La especificación `openapi.yaml` es la fuente de verdad: las pruebas comprueban que el servidor cumple lo que promete, tanto en la forma de las respuestas como en las reglas de negocio.

La API es de práctica: guarda los datos en memoria y solo se ejecuta en local. Lo que se publica en internet es su documentación. El producto de este repositorio son las pruebas.

**Estado:** especificación 1.3.1, servidor de práctica y 54 pruebas de contrato, todas en verde en CI.

## Qué demuestra

- **Contrato como fuente de verdad:** las pruebas leen `openapi.yaml` directamente, no una copia. Cada respuesta se valida contra su esquema, con `additionalProperties: false`, así que un campo no documentado hace fallar la prueba.
- **Reglas de negocio que OpenAPI no expresa:** horario, solapes, límites por usuario y cancelación, documentados abajo y probados uno por uno.
- **Comprobación de las pruebas:** las pruebas se han validado rompiendo reglas a propósito en el servidor, y deben fallar cuando eso ocurre.
- **CI en cada push y pull request** con GitHub Actions.

## Documentación

La especificación se publica en GitHub Pages con Swagger UI: https://basimontes.github.io/api-contract-tests/

Se actualiza en cada push a `main` si las pruebas pasan. "Try it out" apunta a `localhost:3000`, así que solo funciona con el servidor levantado en tu equipo (ver [Probar la API](#probar-la-api)).

## Estructura

```
openapi.yaml                    especificación (fuente de verdad)
src/server/                     servidor de práctica (Express, JWT, almacenamiento en memoria)
tests/auth.spec.ts              registro y login contra el contrato
tests/pistas.spec.ts            pistas públicas y seed
tests/reservas.spec.ts          reglas de reservas, cancelación y autenticación
tests/contrato-validador.spec.ts  comprueba que el validador rechaza lo que debe rechazar
tests/support/                  validación contra openapi.yaml y utilidades de reservas
docs/index.html                 Swagger UI para GitHub Pages (openapi.yaml se copia al publicar)
.github/workflows/ci.yml        CI: typecheck y pruebas
```

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
- Pistas y su consulta son públicas. Reservas siempre requieren token JWT, que caduca a los 60 minutos.

## Seed (15 pistas, fijas)

| Deporte | Cantidad |
|---|---|
| padel | 6 |
| tenis | 4 |
| futbol7 | 3 |
| futbol11 | 1 |
| baloncesto | 1 |

Los IDs son fijos (`00000000-0000-4000-8000-000000000001` a `…000015`), así que las pruebas son deterministas.

## Ejecutar

Requiere Node 24 o superior (LTS activa). El archivo `.nvmrc` fija la versión: con `nvm use` o `fnm use` se selecciona sola.

```bash
npm install
npm run typecheck     # compila el servidor y las pruebas
npm test              # arranca el servidor en modo práctica y ejecuta las pruebas
npm run server        # arranca solo la API en http://localhost:3000
```

Variables opcionales: `PORT` (puerto del servidor), `JWT_SECRET` (clave para firmar los tokens) y `API_URL` (prueba contra un servidor ya levantado en otra dirección).

## Probar la API

Levanta el servidor con `npm run server` y deja la terminal abierta. Después puedes probar con `curl` o desde la documentación.

**Con curl**

```bash
# 1. Registro (la API no trae usuarios de ejemplo)
curl -X POST http://localhost:3000/auth/registro \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@test.es","password":"clave-segura-123","nombre":"Ana"}'

# 2. Login: devuelve { "token": "...", "expiresIn": 3600 }
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@test.es","password":"clave-segura-123"}'

# 3. Pistas (públicas, sin token)
curl http://localhost:3000/pistas

# 4. Reserva (requiere token). Las fechas van en UTC: las 10:00 de Madrid en noviembre son 09:00Z
TOKEN="pega-aqui-el-token"
curl -X POST http://localhost:3000/reservas \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"pistaId":"00000000-0000-4000-8000-000000000001","inicio":"2026-11-02T09:00:00Z","fin":"2026-11-02T10:00:00Z"}'
```

**Desde la documentación**

1. Abre la documentación en local o en https://basimontes.github.io/api-contract-tests/ con el servidor levantado.
2. Registra un usuario con `POST /auth/registro` y obtén el token con `POST /auth/login`.
3. Pulsa **Authorize** y pega el valor de `token`, sin comillas. Swagger añade el prefijo `Bearer`.

El token caduca a los 60 minutos: cuando deje de funcionar, vuelve a hacer login.

**CORS:** el servidor solo acepta peticiones desde `https://basimontes.github.io`, `http://localhost:3000` y `http://127.0.0.1:3000`. Desde otro origen, el navegador bloquea la respuesta, aunque el servidor funcione.

## Modo práctica

Con `MODO_PRACTICA=1`, el servidor acepta la cabecera `X-Practica-Ahora` (fecha ISO 8601) como hora de referencia para las reglas de pasado y de cancelación. Fuera de ese modo la cabecera se ignora y se usa el reloj real.

Las pruebas la usan para comprobar `RESERVATION_STARTED` sin esperar. **No debe activarse en ningún entorno real:** cualquier cliente podría fijar la hora de referencia. No hay protección técnica más allá de la variable de entorno.

Si pruebas contra otro servidor con `API_URL`, ese servidor tiene que tener `MODO_PRACTICA=1`, o la prueba de `RESERVATION_STARTED` fallará.

En local, Playwright reutiliza un servidor que ya esté en el puerto 3000. Si ese servidor se arrancó sin `MODO_PRACTICA=1`, la prueba de `RESERVATION_STARTED` fallará. En CI no pasa, porque el servidor siempre se arranca de nuevo.

## Decisiones de diseño

- **403 frente a 404:** las reservas ajenas devuelven 404 con el mismo cuerpo que una inexistente. Así no se puede comprobar qué IDs existen (protección frente a IDOR).
- **404 frente a 409 en cancelaciones:** una reserva cancelada sí existe para su dueño, así que cancelarla de nuevo devuelve 409 `RESERVATION_NOT_ACTIVE`.
- **Un código por límite:** `DAILY_LIMIT_EXCEEDED`, `WEEKLY_LIMIT_EXCEEDED` y `CHAIN_LIMIT_EXCEEDED`, en lugar de un único código con `details`. Así las pruebas comparan el `code` de primer nivel.
- **Orden de validación de una reserva:** formato y duración (400 `VALIDATION_ERROR`), pasado (400 `PAST_RESERVATION`), horario (400 `OUTSIDE_OPENING_HOURS`), solape en la pista (409 `SLOT_OCCUPIED`), solape del usuario (409 `USER_OVERLAP`), límite diario, semanal y de cadena.
- **Emails:** se guardan en minúsculas, y el registro devuelve el email en minúsculas.
- **IDs no válidos en la ruta:** devuelven 404 `NOT_FOUND`, igual que un ID inexistente.

## Limitaciones conocidas

- **Almacenamiento en memoria:** los datos se pierden al reiniciar el servidor.
- **Error 500:** un error inesperado devuelve `INTERNAL_ERROR`, un código que no está en `openapi.yaml`. Hay que documentarlo o cambiarlo; de momento no hay prueba que lo cubra.
- **Sin límite de peticiones ni protección contra fuerza bruta** en el login.
- **Modo práctica:** la cabecera de reloj es un atajo de pruebas, no un mecanismo que deba existir en una API real.

## Versiones

- **1.3.1:** el login incorrecto se documenta como 401 `INVALID_CREDENTIALS` (antes usaba la descripción genérica de tokens). El servidor permite CORS desde la documentación pública.
- **1.3.0:** los esquemas de respuesta no admiten campos no documentados (`additionalProperties: false`). Así una contraseña filtrada o un campo nuevo hace fallar la prueba de contrato.
- **1.2.0:** un código de error por cada límite (`DAILY_LIMIT_EXCEEDED`, `WEEKLY_LIMIT_EXCEEDED`, `CHAIN_LIMIT_EXCEEDED`) en lugar de `LIMIT_EXCEEDED` con `details`. Se añade `USER_OVERLAP`.
- **1.1.0:** primera versión con reglas de negocio cerradas.
