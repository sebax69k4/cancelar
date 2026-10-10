import { AlarmClock, Check, CheckCircle2, Flame, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { useMarkReportRead } from '@/hooks/useDashboard';
import { formatHours } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { InformeCriticoView } from '@/lib/api/apiClient';

export interface CriticalListProps {
  informes: InformeCriticoView[];
}

/** Tareas críticas abiertas por más de 24 h (InformeCritico). */
export function CriticalList({ informes }: CriticalListProps) {
  const markRead = useMarkReportRead();
  const unread = informes.filter((i) => !i.leido).length;

  return (
    <Card className={cn(informes.length > 0 && 'border-red-300 dark:border-red-500/40')}>
      <CardHeader
        icon={<AlarmClock className={informes.length ? 'text-danger' : undefined} aria-hidden="true" />}
        title={`Críticas abiertas más de 24 h (${informes.length})`}
        description={unread > 0 ? `${unread} sin revisar` : undefined}
        actions={
          <a href="/alertas" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
            Ver alertas
          </a>
        }
      />
      {informes.length === 0 ? (
        <EmptyState
          compact
          icon={<CheckCircle2 className="text-success" aria-hidden="true" />}
          title="Sin críticas vencidas"
          description="No hay órdenes críticas abiertas hace más de 24 horas."
        />
      ) : (
        <ul className="divide-y divide-border">
          {informes.map((inf) => {
            const o = inf.orden;
            return (
              <li key={inf.id} className={cn('flex flex-wrap items-start gap-3 px-4 py-3', !inf.leido && 'bg-red-50/50 dark:bg-red-500/5')}>
                <Flame className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`/ordenes/${o.id}`} className="font-mono font-semibold whitespace-nowrap hover:text-primary hover:underline">
                      {o.numero}
                    </a>
                    <span className="text-muted">
                      {o.cliente.nombre} · {o.equipo.marca} {o.equipo.modelo}
                    </span>
                    {!inf.leido && (
                      <Badge tone="red" size="sm">
                        No revisado
                      </Badge>
                    )}
                  </div>
                  {inf.ultimoComentario && (
                    <p className="mt-1 flex items-start gap-1.5 text-xs text-muted">
                      <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span className="line-clamp-2">«{inf.ultimoComentario}»</span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right text-xs leading-tight">
                    <p className="font-bold text-danger tabular-nums">{formatHours(inf.horasAbierta)}</p>
                    <p className="text-muted">Resp.: {inf.responsable.nombre}</p>
                  </div>
                  {!inf.leido && (
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Check aria-hidden="true" />}
                      loading={markRead.isPending && markRead.variables === inf.id}
                      onClick={() => markRead.mutate(inf.id)}
                    >
                      Revisado
                      <span className="sr-only"> {o.numero}</span>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
