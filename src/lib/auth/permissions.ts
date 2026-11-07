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
  | 'order.escalate.reception'
  | 'escalation.level2'
  | 'escalation.level3'
  | 'order.validate'
  | 'order.close'
  | 'order.deliver'
  | 'order.abandon'
  | 'order.reopen'
  | 'order.view.all'
  | 'users.manage'
  | 'order.edit.own'
  | 'order.edit'
  | 'demo.reset';

const ALL: readonly Permission[] = [
  'nav.dashboard', 'nav.ordenes', 'nav.clientes', 'nav.equipos', 'nav.alertas',
  'client.create', 'equipment.create', 'order.create', 'order.assign',
  'order.transition', 'order.block', 'order.unblock', 'order.escalate',
  'order.validate', 'order.close', 'order.reopen', 'order.edit', 'order.abandon', 'order.view.all',
  'escalation.level2', 'escalation.level3', 'users.manage', 'demo.reset',
];

const ONLY_ADMIN: readonly Permission[] = ['demo.reset', 'order.abandon', 'escalation.level3', 'users.manage'];

export const ROLE_PERMISSIONS: Readonly<Record<Rol, readonly Permission[]>> = {
  ADMIN: ALL,
  SUPERVISOR: ALL.filter((p) => !ONLY_ADMIN.includes(p)),
  RECEPCION: [
    'nav.dashboard', 'nav.ordenes', 'nav.clientes', 'nav.equipos', 'nav.alertas',
    'client.create', 'equipment.create', 'order.create', 'order.assign',
    'order.transition.reception', 'order.escalate.reception', 'order.deliver', 'order.view.all',
  ],
  TECNICO: [
    'nav.dashboard', 'nav.ordenes', 'nav.equipos', 'nav.alertas',
    'order.transition.own', 'order.block.own', 'order.escalate.own', 'order.edit.own',
  ],
};

/** Una persona puede tener varios roles: alcanza con que uno lo permita. */
export function can(roles: readonly Rol[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r].includes(permission));
}
