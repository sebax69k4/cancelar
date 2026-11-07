import type { Usuario } from '@/types/domain';

export const MOCK_USERS: readonly Usuario[] = [
  { id: 'u-admin', nombre: 'Laura Méndez', email: 'admin@serviciotecnico.local', roles: ['ADMIN'] },
  { id: 'u-super', nombre: 'Ana Ríos', email: 'supervisor@serviciotecnico.local', roles: ['SUPERVISOR'] },
  { id: 'u-recep', nombre: 'Martín Sosa', email: 'recepcion@serviciotecnico.local', roles: ['RECEPCION'] },
  { id: 'u-tec1', nombre: 'Carlos Ibáñez', email: 'carlos@serviciotecnico.local', roles: ['TECNICO'] },
  { id: 'u-tec2', nombre: 'Julieta Paz', email: 'julieta@serviciotecnico.local', roles: ['TECNICO'] },
];
