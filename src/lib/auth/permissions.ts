import type { Rol } from '@/types/domain';

export type Permission =
  | 'nav.dashboard'
  | 'nav.ordenes'
  | 'nav.clientes'
  | 'nav.equipos'
  | 'nav.alertas'
  | 'client.create'
  | 'equipment.create'
  | 'order.create'
  | 'order.assign'
  | 'order.transition'
  | 'order.transition.own'
  | 'order.transition.reception'
  | 'order.block'
  | 'order.block.own'
  | 'order.unblock'
  | 'order.escalate'
  | 'order.escalate.own'
  | 'order.validate'
  | 'order.close'
  | 'order.reopen'
  | 'order.edit.own'
  | 'order.edit'
  | 'demo.reset';

const ALL: readonly Permission[] = [
  'nav.dashboard', 'nav.ordenes', 'nav.clientes', 'nav.equipos', 'nav.alertas',
  'client.create', 'equipment.create', 'order.create', 'order.assign',
  'order.transition', 'order.block', 'order.unblock', 'order.escalate',
  'order.validate', 'order.close', 'order.reopen', 'order.edit', 'demo.reset',
];

export const ROLE_PERMISSIONS: Readonly<Record<Rol, readonly Permission[]>> = {
  ADMIN: ALL,
  SUPERVISOR: ALL.filter((p) => p !== 'demo.reset'),
  RECEPCION: [
    'nav.dashboard', 'nav.ordenes', 'nav.clientes', 'nav.equipos',
    'client.create', 'equipment.create', 'order.create', 'order.assign',
    'order.transition.reception',
  ],
  TECNICO: [
    'nav.dashboard', 'nav.ordenes', 'nav.equipos', 'nav.alertas',
    'order.transition.own', 'order.block.own', 'order.escalate.own', 'order.edit.own',
  ],
};

export function can(rol: Rol, permission: Permission): boolean {
  return ROLE_PERMISSIONS[rol].includes(permission);
}
