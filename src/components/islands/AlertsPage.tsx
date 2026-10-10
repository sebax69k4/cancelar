import type { ReactNode } from 'react';
import { ArrowUpCircle, CheckCircle2, Clock, Flame, Lock } from 'lucide-react';
import { AlertFlags } from '@/components/domain/AlertFlags';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { UserChip } from '@/components/domain/UserChip';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useAlerts } from '@/hooks/useDashboard';
import { errorMessage } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { formatHours } from '@/lib/format';
import type { OrdenResumen } from '@/types/domain';

interface SectionProps {
  id: string;
  title: string;
  icon: ReactNode;
  orders: OrdenResumen[];
  emptyText: string;
  reason?: (o: OrdenResumen) => string | null;
  highlight?: boolean;
}

function AlertSection({ id, title, icon, orders, emptyText, reason, highlight }: SectionProps) {
  return (
    <Card id={id} className={cn('scroll-mt-20', highlight && orders.length > 0 && 'border-red-300 dark:border-red-500/40')}>
      <CardHeader icon={icon} title={`${title} (${orders.length})`} />
      {orders.length === 0 ? (
        <EmptyState compact icon={<CheckCircle2 className="text-success" aria-hidden="true" />} title={emptyText} />
      ) : (
        <ul className="divide-y divide-border">
          {orders.map((o) => {
            const why = reason?.(o);
            return (
              <li key={o.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`/ordenes/${o.id}`} className="font-mono font-semibold whitespace-nowrap hover:text-primary hover:underline">
                      {o.numero}
                    </a>
                    <StatusBadge estado={o.estado} size="sm" />
                    <AlertFlags
                      criticaVencida={o.criticaVencida}
                      horasAbierta={o.horasAbierta}
                      bloqueada={o.bloqueada}
                      escalada={o.escalada}
                      atrasada={o.atrasada}
                    />
                  </div>
                  <p className="mt-1 text-sm">
                    {o.cliente.nombre} · <span className="text-muted">{o.equipo.marca} {o.equipo.modelo}</span>
                  </p>
                  {why && <p className="mt-1 text-xs text-muted">Motivo: «{why}»</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <span className={cn('flex items-center gap-1 font-semibold tabular-nums', o.criticaVencida ? 'text-danger' : 'text-muted')}>
                    <Clock className="size-3.5" aria-hidden="true" />
                    {formatHours(o.horasAbierta)} abierta
                  </span>
                  <UserChip user={o.responsable} label="Responsable" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Content() {
  const alerts = useAlerts();
  if (alerts.isPending) {
    return (
      <div className="space-y-6" aria-hidden="true">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (alerts.isError) {
    return (
      <Card>
        <ErrorState message={errorMessage(alerts.error)} onRetry={() => void alerts.refetch()} />
      </Card>
    );
  }
  const { criticas, bloqueadas, escaladas } = alerts.data;
  return (
    <div className="flex flex-col gap-6">
      <AlertSection
        id="criticas"
        title="Críticas abiertas"
        icon={<Flame className="text-danger" aria-hidden="true" />}
        orders={criticas}
        emptyText="No hay órdenes críticas abiertas"
        highlight
      />
      <AlertSection
        id="bloqueadas"
        title="Bloqueadas"
        icon={<Lock className="text-rose-700 dark:text-rose-300" aria-hidden="true" />}
        orders={bloqueadas}
        emptyText="No hay órdenes bloqueadas"
        reason={(o) => o.motivoBloqueo}
      />
      <AlertSection
        id="escaladas"
        title="Escaladas"
        icon={<ArrowUpCircle className="text-orange-700 dark:text-orange-300" aria-hidden="true" />}
        orders={escaladas}
        emptyText="No hay órdenes escaladas"
        reason={(o) => o.motivoEscalado}
      />
    </div>
  );
}

export default function AlertsPage() {
  return (
    <AppShell
      currentPath="/alertas"
      permission="nav.alertas"
      title="Alertas"
      description="Órdenes críticas, bloqueadas y escaladas que necesitan atención. Las críticas con más de 24 h van primero."
    >
      <Content />
    </AppShell>
  );
}
