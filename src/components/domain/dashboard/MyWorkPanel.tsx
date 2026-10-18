import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, ClipboardCheck, Lock, PackageCheck, Phone, UserX, Wrench, CalendarClock, type LucideIcon } from 'lucide-react';
import { AlertFlags } from '@/components/domain/AlertFlags';
import { PriorityBadge } from '@/components/domain/PriorityBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/States';
import { useOrders } from '@/hooks/useOrders';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { NEXT_STATE, stepRequirements } from '@/lib/workflow/transitions';
import type { OrdenResumen, Prioridad, Usuario } from '@/types/domain';

const PRIO_RANK: Record<Prioridad, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
const urgentFirst = (a: OrdenResumen, b: OrdenResumen) =>
  Number(b.criticaVencida) - Number(a.criticaVencida) ||
  PRIO_RANK[a.prioridad] - PRIO_RANK[b.prioridad] ||
  a.fechaIngreso.localeCompare(b.fechaIngreso);

/** «Falta: diagnóstico cargado» para la siguiente etapa, o null si no falta nada. */
function nextHint(o: OrdenResumen): string | null {
  const next = NEXT_STATE[o.estado];
  if (!next) return null;
  const pending = stepRequirements(o, next).filter((r) => !r.done).map((r) => r.label.toLowerCase());
  return pending.length ? `Falta: ${pending.join(', ')}` : 'Lista para avanzar';
}

interface Queue {
  id: string;
  title: string;
  icon: LucideIcon;
  orders: OrdenResumen[];
  /** Qué mostrar debajo de cada orden */
  detail: (o: OrdenResumen) => ReactNode;
  empty: string;
  href?: string;
}

function queuesFor(user: Usuario, all: OrdenResumen[]): Queue[] {
  const open = all.filter((o) => o.estado !== 'CERRADO');
  const sinTecnico: Queue = {
    id: 'sin-tecnico',
    title: 'Sin técnico asignado',
    icon: UserX,
    orders: open.filter((o) => !o.tecnicoId).sort(urgentFirst),
    detail: (o) => `Ingresó el ${formatDate(o.fechaIngreso)} · asignale un técnico para empezar`,
    empty: 'Todas las órdenes tienen técnico',
  };
  const trabadas: Queue = {
    id: 'trabadas',
    title: 'Bloqueadas o escaladas',
    icon: Lock,
    orders: open.filter((o) => o.bloqueada || o.escalada).sort(urgentFirst),
    detail: (o) => (o.bloqueada ? `Bloqueada: ${o.motivoBloqueo ?? ''}` : `Escalada: ${o.motivoEscalado ?? ''}`),
    empty: 'Nada trabado',
    href: '/alertas',
  };

  switch (user.rol) {
    case 'TECNICO': {
      const mias = open.filter((o) => o.tecnicoId === user.id || o.responsableId === user.id);
      return [
        {
          id: 'mias',
          title: 'Mis órdenes para trabajar',
          icon: Wrench,
          orders: mias.filter((o) => !o.bloqueada && o.estado !== 'LISTO_PARA_RETIRAR').sort(urgentFirst),
          detail: nextHint,
          empty: 'No tenés órdenes pendientes',
          href: '/ordenes',
        },
        { ...trabadas, orders: mias.filter((o) => o.bloqueada || o.escalada).sort(urgentFirst) },
      ];
    }
    case 'RECEPCION':
      return [
        {
          id: 'retirar',
          title: 'Avisar al cliente: listas para retirar',
          icon: PackageCheck,
          orders: open.filter((o) => o.estado === 'LISTO_PARA_RETIRAR').sort(urgentFirst),
          detail: (o) => (
            <a href={`tel:${o.cliente.telefono.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              <Phone className="size-3" aria-hidden="true" />
              {o.cliente.nombre} · {o.cliente.telefono}
            </a>
          ),
          empty: 'No hay equipos para retirar',
          href: '/ordenes?estado=LISTO_PARA_RETIRAR',
        },
        sinTecnico,
        {
          id: 'atrasadas',
          title: 'Atrasadas: informar al cliente',
          icon: CalendarClock,
          orders: open.filter((o) => o.atrasada).sort(urgentFirst),
          detail: (o) => `Entrega estimada: ${formatDate(o.fechaEstimada)} · ${o.cliente.telefono}`,
          empty: 'Ninguna atrasada',
        },
      ];
    default:
      return [
        {
          id: 'validar',
          title: 'Esperan tu validación',
          icon: ClipboardCheck,
          orders: open
            .filter((o) => !o.validada && Boolean(o.solucion?.trim()) && o.evidencias.length > 0)
            .sort(urgentFirst),
          detail: (o) => `Solución: ${o.solucion ?? ''}`,
          empty: 'Nada para validar',
        },
        {
          id: 'cerrar',
          title: 'Listas para cerrar',
          icon: PackageCheck,
          orders: open.filter((o) => o.estado === 'LISTO_PARA_RETIRAR' && o.validada).sort(urgentFirst),
          detail: (o) => `Validada · ${o.cliente.nombre} · ${o.cliente.telefono}`,
          empty: 'Nada para cerrar',
          href: '/ordenes?estado=LISTO_PARA_RETIRAR',
        },
        trabadas,
        sinTecnico,
      ];
  }
}

const MAX_ROWS = 4;

function QueueCard({ q }: { q: Queue }) {
  const Icon = q.icon;
  const headingId = `cola-${q.id}`;
  return (
    <section aria-labelledby={headingId} className="ui-inset flex min-w-0 flex-col rounded-md border border-border bg-surface-2/50">
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <h3 id={headingId} className="min-w-0 flex-1 truncate text-sm font-semibold">
          {q.title}
        </h3>
        <span
          className={cn(
            'rounded-full px-2 text-xs font-bold tabular-nums',
            q.orders.length ? 'bg-primary text-primary-fg' : 'bg-surface-3 text-muted',
          )}
        >
          {q.orders.length}
          <span className="sr-only"> órdenes</span>
        </span>
      </header>
      {q.orders.length === 0 ? (
        <p className="flex items-center gap-1.5 px-3 pb-3 text-xs text-muted">
          <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" /> {q.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 px-2 pb-2">
          {q.orders.slice(0, MAX_ROWS).map((o) => (
            <li key={o.id} className="ui-panel rounded-md border border-border bg-surface px-2.5 py-2 shadow-card">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <a href={`/ordenes/${o.id}`} className="font-mono text-sm font-semibold whitespace-nowrap hover:text-primary hover:underline">
                  {o.numero}
                </a>
                <PriorityBadge prioridad={o.prioridad} size="sm" />
              </div>
              <p className="mt-0.5 truncate text-xs">
                {o.cliente.nombre} · <span className="text-muted">{o.equipo.marca} {o.equipo.modelo}</span>
              </p>
              <div className="mt-1">
                <StatusBadge estado={o.estado} size="sm" />
              </div>
              <div className="mt-0.5 line-clamp-1 text-xs text-muted">{q.detail(o)}</div>
              <AlertFlags className="mt-1" criticaVencida={o.criticaVencida} horasAbierta={o.horasAbierta} atrasada={o.atrasada} />
            </li>
          ))}
          {(q.orders.length > MAX_ROWS || q.href) && (
            <li>
              {q.href ? (
                <a href={q.href} className="flex items-center justify-end gap-1 px-1 text-xs font-semibold text-primary hover:underline">
                  {q.orders.length > MAX_ROWS ? `Ver las ${q.orders.length}` : 'Ver todas'}
                  <ArrowRight className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <p className="px-1 text-right text-xs text-muted">y {q.orders.length - MAX_ROWS} más</p>
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/** Colas de trabajo según el rol: qué tengo que hacer ahora (estilo «Mis vistas» de Zendesk / ServiceNow). */
export function MyWorkPanel({ user }: { user: Usuario }) {
  const orders = useOrders();
  const queues = orders.data ? queuesFor(user, orders.data) : null;
  const total = queues?.reduce((n, q) => n + q.orders.length, 0) ?? 0;

  return (
    <Card>
      <CardHeader
        title="Mi trabajo"
        description={queues ? (total ? 'Lo que necesita tu atención, lo más urgente primero.' : 'Estás al día.') : undefined}
      />
      <div className={cn('grid gap-3 p-3', queues && queues.length >= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : queues && queues.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {queues
          ? queues.map((q) => <QueueCard key={q.id} q={q} />)
          : Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32" />)}
      </div>
    </Card>
  );
}
