import type { Usuario } from '@/types/domain';

export const MOCK_USERS: readonly Usuario[] = [
  { id: 'u-admin', nombre: 'Laura Méndez', email: 'admin@serviciotecnico.local', rol: 'ADMIN' },
  { id: 'u-super', nombre: 'Ana Ríos', email: 'supervisor@serviciotecnico.local', rol: 'SUPERVISOR' },
  { id: 'u-recep', nombre: 'Martín Sosa', email: 'recepcion@serviciotecnico.local', rol: 'RECEPCION' },
  { id: 'u-tec1', nombre: 'Carlos Ibáñez', email: 'carlos@serviciotecnico.local', rol: 'TECNICO' },
  { id: 'u-tec2', nombre: 'Julieta Paz', email: 'julieta@serviciotecnico.local', rol: 'TECNICO' },
];
