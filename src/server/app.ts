import { randomUUID } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createStore, Store } from './store';
import * as rules from './rules';
import { ahoraDe } from './reloj';

const JWT_SECRET = process.env.JWT_SECRET ?? 'solo-para-practica-local';
const TOKEN_TTL_SECONDS = 3600;

type AuthRequest = Request & { userId: string };

function fail(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ code, message });
}

export function createApp(store: Store = createStore()) {
  const app = express();
  app.use(express.json());

  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      fail(res, 401, 'UNAUTHORIZED', 'Token ausente o mal formado');
      return;
    }
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (typeof payload.sub !== 'string') throw new Error('token sin sujeto');
      (req as AuthRequest).userId = payload.sub;
      next();
    } catch {
      fail(res, 401, 'UNAUTHORIZED', 'Token inválido o caducado');
    }
  }

  // Auth

  app.post('/auth/registro', async (req, res) => {
    const b = req.body;
    const errorCuerpo = rules.checkBody(b, ['email', 'password', 'nombre'], ['email', 'password', 'nombre']);
    if (errorCuerpo) return fail(res, 400, 'VALIDATION_ERROR', errorCuerpo);
    if (!rules.isEmail(b.email)) return fail(res, 400, 'VALIDATION_ERROR', 'Email no válido');
    if (typeof b.password !== 'string' || b.password.length < 8) {
      return fail(res, 400, 'VALIDATION_ERROR', 'La contraseña debe tener al menos 8 caracteres');
    }
    if (typeof b.nombre !== 'string' || b.nombre.trim() === '') {
      return fail(res, 400, 'VALIDATION_ERROR', 'El nombre es obligatorio');
    }

    const email = b.email.toLowerCase();
    if (store.usuarios.some((u) => u.email === email)) {
      return fail(res, 409, 'EMAIL_TAKEN', 'El email ya está registrado');
    }

    const usuario = {
      id: randomUUID(),
      email,
      nombre: b.nombre.trim(),
      passwordHash: await bcrypt.hash(b.password, 10),
    };
    store.usuarios.push(usuario);
    res.status(201).json({ id: usuario.id, email: usuario.email, nombre: usuario.nombre });
  });

  app.post('/auth/login', async (req, res) => {
    const b = req.body;
    const errorCuerpo = rules.checkBody(b, ['email', 'password'], ['email', 'password']);
    if (errorCuerpo) return fail(res, 400, 'VALIDATION_ERROR', errorCuerpo);
    if (!rules.isEmail(b.email) || typeof b.password !== 'string') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Datos de acceso no válidos');
    }

    const usuario = store.usuarios.find((u) => u.email === b.email.toLowerCase());
    if (!usuario || !(await bcrypt.compare(b.password, usuario.passwordHash))) {
      return fail(res, 401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
    }

    const token = jwt.sign({}, JWT_SECRET, {
      subject: usuario.id,
      expiresIn: TOKEN_TTL_SECONDS,
      algorithm: 'HS256',
    });
    res.status(200).json({ token, expiresIn: TOKEN_TTL_SECONDS });
  });

  // Pistas (públicas)

  app.get('/pistas', (_req, res) => {
    res.json(store.pistas);
  });

  app.get('/pistas/:id', (req, res) => {
    const pista = rules.isUuid(req.params.id) ? store.pistas.find((p) => p.id === req.params.id) : undefined;
    if (!pista) return fail(res, 404, 'NOT_FOUND', 'Pista no encontrada');
    res.json(pista);
  });

  // Reservas (requieren token)

  app.get('/reservas', requireAuth, (req, res) => {
    const { userId } = req as AuthRequest;
    res.json(store.reservas.filter((r) => r.usuarioId === userId).map(rules.aJson));
  });

  app.get('/reservas/:id', requireAuth, (req, res) => {
    const { userId } = req as AuthRequest;
    const id = req.params.id;
    const reserva = rules.isUuid(id)
      ? store.reservas.find((r) => r.id === id && r.usuarioId === userId)
      : undefined;
    if (!reserva) return fail(res, 404, 'NOT_FOUND', 'Reserva no encontrada');
    res.json(rules.aJson(reserva));
  });

  app.post('/reservas', requireAuth, (req, res) => {
    const { userId } = req as AuthRequest;
    const b = req.body;
    const errorCuerpo = rules.checkBody(b, ['pistaId', 'inicio', 'fin'], ['pistaId', 'inicio', 'fin']);
    if (errorCuerpo) return fail(res, 400, 'VALIDATION_ERROR', errorCuerpo);
    if (!rules.isUuid(b.pistaId)) return fail(res, 400, 'VALIDATION_ERROR', 'pistaId no válido');

    const inicio = rules.parseIso(b.inicio);
    const fin = rules.parseIso(b.fin);
    if (!inicio || !fin) {
      return fail(res, 400, 'VALIDATION_ERROR', 'inicio y fin deben ser fechas ISO 8601');
    }

    const pista = store.pistas.find((p) => p.id === b.pistaId);
    if (!pista) return fail(res, 404, 'NOT_FOUND', 'Pista no encontrada');

    const fallo = rules.evaluarReserva(store, userId, pista.id, inicio, fin, ahoraDe(req));
    if (fallo) return fail(res, fallo.status, fallo.code, fallo.message);

    const reserva = { id: randomUUID(), pistaId: pista.id, usuarioId: userId, inicio, fin, estado: 'activa' as const };
    store.reservas.push(reserva);
    res.status(201).json(rules.aJson(reserva));
  });

  app.delete('/reservas/:id', requireAuth, (req, res) => {
    const { userId } = req as AuthRequest;
    const id = req.params.id;
    const reserva = rules.isUuid(id)
      ? store.reservas.find((r) => r.id === id && r.usuarioId === userId)
      : undefined;
    if (!reserva) return fail(res, 404, 'NOT_FOUND', 'Reserva no encontrada');
    if (reserva.estado === 'cancelada') {
      return fail(res, 409, 'RESERVATION_NOT_ACTIVE', 'La reserva ya está cancelada');
    }
    if (reserva.inicio.getTime() <= ahoraDe(req).getTime()) {
      return fail(res, 409, 'RESERVATION_STARTED', 'La reserva ya ha empezado');
    }
    reserva.estado = 'cancelada';
    res.status(204).end();
  });

  // Errores

  app.use((_req: Request, res: Response) => {
    fail(res, 404, 'NOT_FOUND', 'Ruta no encontrada');
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed') {
      return fail(res, 400, 'VALIDATION_ERROR', 'JSON mal formado');
    }
    console.error(err);
    fail(res, 500, 'INTERNAL_ERROR', 'Error interno del servidor');
  });

  return app;
}
