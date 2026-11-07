import { ArrowUpCircle, CheckCircle2, Hand } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CAUSA_LABEL, ESTADO_ESCALAMIENTO_LABEL, RESOLUCION_LABEL } from '@/lib/domain/labels';
import { formatDateTime } from '@/lib/format';
import {
  canRaiseEscalation, canResolveEscalation, canTakeEscalation, openEscalation,
} from '@/lib/workflow/escalation';
import type { Escalamiento, OrdenResumen, Usuario } from '@/types/domain';

export interface EscalationCardProps {
  order: OrdenResumen;
  user: Usuario;
  busy?: boolean;
  onTake: () => void;
  onRaise: () => void;
  onResolve: () => void;
}

const NIVEL_LABEL: Record<number, string> = { 2: 'Nivel 2 · Supervisor', 3: 'Nivel 3 · Admin' };

function origen(e: Escalamiento): string {
  const quien = e.automatico ? 'Automático' : (e.creadoPor?.nombre ?? 'Usuario');
  return `${quien} · ${formatDateTime(e.creadoEn)}`;
}

/** Escalamiento abierto de la orden, con sus acciones, y los ya resueltos. */
export function EscalationCard({ order, user, busy, onTake, onRaise, onResolve }: EscalationCardProps) {
  const open = openEscalation(order);
  const resueltos = order.escalamientos.filter((e) => e.estado === 'RESUELTO');
  if (!open && resueltos.length === 0) return null;

  return (
    <section aria-label="Escalamientos" className="flex flex-col gap-3">
      {open && (
        <div role="status" className="ui-panel rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-orange-900 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-100">
          <div className="flex flex-wrap items-start gap-3">
            <ArrowUpCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {NIVEL_LABEL[open.nivel] ?? `Nivel ${open.nivel}`}
                <Badge tone="orange">{ESTADO_ESCALAMIENTO_LABEL[open.estado]}</Badge>
              </p>
              <p className="mt-0.5 opacity-90">{CAUSA_LABEL[open.causa]}: «{open.motivo}»</p>
              <p className="mt-0.5 text-xs opacity-80">
                {origen(open)}
                {open.tomadoPor && ` · tomado por ${open.tomadoPor.nombre}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canTakeEscalation(order, user).ok && (
                <Button size="sm" leftIcon={<Hand aria-hidden="true" />} loading={busy} onClick={onTake}>
                  Tomar
                </Button>
              )}
              {canResolveEscalation(order, user).ok && (
                <Button size="sm" leftIcon={<CheckCircle2 aria-hidden="true" />} onClick={onResolve}>
                  Resolver
                </Button>
              )}
              {canRaiseEscalation(order, user).ok && (
                <Button size="sm" variant="outline" leftIcon={<ArrowUpCircle aria-hidden="true" />} onClick={onRaise}>
                  Subir de nivel
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
      {resueltos.length > 0 && (
        <details className="ui-panel rounded-lg border border-border bg-surface px-4 py-2 text-sm">
          <summary className="cursor-pointer font-medium">Escalamientos resueltos ({resueltos.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {resueltos.map((e) => (
              <li key={e.id} className="border-t border-border pt-2">
                <p className="font-medium">
                  {CAUSA_LABEL[e.causa]} · {e.resolucion ? RESOLUCION_LABEL[e.resolucion] : 'Resuelto'}
                </p>
                <p className="text-muted">{e.textoResolucion}</p>
                <p className="text-xs text-muted">
                  {e.resueltoPor?.nombre}
                  {e.resueltoEn && ` · ${formatDateTime(e.resueltoEn)}`}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
