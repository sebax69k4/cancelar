import { AlarmClock, Check, CheckCircle2, Flame, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
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

  // Sin críticas vencidas: una línea discreta en vez de un bloque vacío que ocupa el mejor lugar
  if (informes.length === 0) {
    return (
      <p
        role="status"
        className="ui-panel flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-900 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-200"
      >
        <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Sin críticas vencidas.</strong> Ninguna orden crítica lleva más de 24 h abierta.
        </span>
      </p>
    );
  }

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
      {(
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
