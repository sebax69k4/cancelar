import { Bell, LayoutDashboard, Laptop, SquareKanban, Users, type LucideIcon } from 'lucide-react';
import type { Permission } from '@/lib/auth/permissions';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'nav.dashboard' },
  { href: '/ordenes', label: 'Órdenes', icon: SquareKanban, permission: 'nav.ordenes' },
  { href: '/clientes', label: 'Clientes', icon: Users, permission: 'nav.clientes' },
  { href: '/equipos', label: 'Equipos', icon: Laptop, permission: 'nav.equipos' },
  { href: '/alertas', label: 'Alertas', icon: Bell, permission: 'nav.alertas' },
];

export function isActive(currentPath: string, href: string): boolean {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
