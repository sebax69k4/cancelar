import { Bell, LayoutDashboard, Laptop, SquareKanban, Users, type LucideIcon } from 'lucide-react';
import type { Permission } from '@/lib/auth/permissions';

export type NavGroup = 'operacion' | 'registros';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  group: NavGroup;
}

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  operacion: 'Operación',
  registros: 'Registros',
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'nav.dashboard', group: 'operacion' },
  { href: '/ordenes', label: 'Órdenes', icon: SquareKanban, permission: 'nav.ordenes', group: 'operacion' },
  { href: '/alertas', label: 'Alertas', icon: Bell, permission: 'nav.alertas', group: 'operacion' },
  { href: '/clientes', label: 'Clientes', icon: Users, permission: 'nav.clientes', group: 'registros' },
  { href: '/equipos', label: 'Equipos', icon: Laptop, permission: 'nav.equipos', group: 'registros' },
];

export function isActive(currentPath: string, href: string): boolean {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
