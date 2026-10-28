export type Deporte = 'padel' | 'tenis' | 'futbol7' | 'futbol11' | 'baloncesto';

export interface Pista {
  id: string;
  nombre: string;
  deporte: Deporte;
}

export interface Usuario {
  id: string;
  email: string; // guardado en minúsculas: el email es único sin distinguir mayúsculas
  nombre: string;
  passwordHash: string;
}

export interface Reserva {
  id: string;
  pistaId: string;
  usuarioId: string;
  inicio: Date;
  fin: Date;
  estado: 'activa' | 'cancelada';
}

export interface Store {
  pistas: Pista[];
  usuarios: Usuario[];
  reservas: Reserva[];
}

// UUIDs fijos para que el seed sea determinista en las pruebas.
export function idFijo(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

const ETIQUETAS: Record<Deporte, string> = {
  padel: 'Pádel',
  tenis: 'Tenis',
  futbol7: 'Fútbol 7',
  futbol11: 'Fútbol 11',
  baloncesto: 'Baloncesto',
};

// Reparto acordado: 6 pádel, 4 tenis, 3 fútbol 7, 1 fútbol 11, 1 baloncesto.
const CUPOS: [Deporte, number][] = [
  ['padel', 6],
  ['tenis', 4],
  ['futbol7', 3],
  ['futbol11', 1],
  ['baloncesto', 1],
];

export function createStore(): Store {
  const pistas: Pista[] = [];
  let n = 0;
  for (const [deporte, cupo] of CUPOS) {
    for (let i = 1; i <= cupo; i++) {
      n++;
      pistas.push({
        id: idFijo(n),
        nombre: cupo === 1 ? ETIQUETAS[deporte] : `${ETIQUETAS[deporte]} ${i}`,
        deporte,
      });
    }
  }
  return { pistas, usuarios: [], reservas: [] };
}
