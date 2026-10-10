import { ChevronRight, Plus, Search, UserPlus, type LucideIcon } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { can, type Permission } from '@/lib/auth/permissions';

interface Action {
  label: string;
  desc: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  permission?: Permission;
}

const itemClass =
  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-2';

export function QuickActions() {
  const user = useCurrentUser();
  const actions: Action[] = [
    { label: 'Nueva orden', desc: 'Registrar ingreso de equipo', icon: Plus, href: '/ordenes/nueva', permission: 'order.create' },
    {
      label: 'Buscar orden',
      desc: 'Por número, cliente, teléfono o serie',
      icon: Search,
      onClick: () => document.getElementById('global-search')?.focus(),
    },
    { label: 'Registrar cliente', desc: 'Alta rápida de cliente', icon: UserPlus, href: '/clientes?nuevo=1', permission: 'client.create' },
  ];
  const visible = actions.filter((a) => !a.permission || (user && can(user.rol, a.permission)));

  return (
    <Card>
      <CardHeader title="Acciones rápidas" />
      <ul className="p-2">
        {visible.map(({ label, desc, icon: Icon, href, onClick }) => {
          const content = (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs text-muted">{desc}</span>
              </span>
              <ChevronRight className="size-4 text-subtle" aria-hidden="true" />
            </>
          );
          return (
            <li key={label}>
              {href ? (
                <a href={href} className={itemClass}>
                  {content}
                </a>
              ) : (
                <button type="button" onClick={onClick} className={itemClass}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
