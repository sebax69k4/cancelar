import { ArrowRight, CheckCircle2, CircleCheckBig, CircleDashed, Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { can } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';
import { ESTADO_LABEL } from '@/lib/domain/labels';
import { formatDateTime } from '@/lib/format';
import { NEXT_STATE, canTransition, stepRequirements, type StepRequirementId } from '@/lib/workflow/transitions';
import type { OrdenResumen, Usuario } from '@/types/domain';

export interface NextStepCardProps {
  order: OrdenResumen;
  user: Usuario;
  /** Avanza al siguiente estado (abre el modal de comentario o el de cierre). */
  onAdvance: () => void;
  /** Abre el modal para elegir otro estado (ej. un retroceso). */
  onOtherState: () => void;
  onReopen: () => void;
  /** Lleva al usuario a completar un requisito (pestaña, edición, modal). */
  onResolve: (req: StepRequirementId) => void;
}

const RESOLVE_LABEL: Record<StepRequirementId, string> = {
  tecnico: 'Asignar',
  diagnostico: 'Cargar',
  solucion: 'Documentar',
  evidencia: 'Adjuntar',
  validada: 'Validar',
  desbloqueo: 'Ver bloqueo',
};

/**
 * «Siguiente paso»: qué etapa sigue, qué falta para llegar y el botón para avanzar.
 * Evita el ensayo y error de abrir «Cambiar estado» para descubrir qué falta.
 */
export function NextStepCard({ order, user, onAdvance, onOtherState, onReopen, onResolve }: NextStepCardProps) {
  if (order.estado === 'CERRADO') {
    return (
      <section aria-label="Estado de la orden" className="ui-panel flex flex-wrap items-center gap-3 rounded-lg border border-green-300 bg-green-50 px-4 py-3 dark:border-green-400/30 dark:bg-green-400/10">
        <CircleCheckBig className="size-6 shrink-0 text-success" aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Orden cerrada</p>
          <p className="text-muted">{order.fechaCierre ? `Entregada el ${formatDateTime(order.fechaCierre)}.` : 'Entregada al cliente.'}</p>
        </div>
        {can(user.rol, 'order.reopen') && (
          <Button variant="outline" leftIcon={<RotateCcw aria-hidden="true" />} onClick={onReopen}>
            Reabrir
          </Button>
        )}
      </section>
    );
  }

  const next = NEXT_STATE[order.estado];
  if (!next) return null;
  const reqs = stepRequirements(order, next);
  const rule = canTransition(order, next, user);
  const pending = reqs.filter((r) => !r.done).length;
  // Faltantes que no son de datos (permisos): se explican en texto
  const permissionNotes = rule.missing.filter((m) => !/^(Falta|La orden está bloqueada)/.test(m));
  const isClose = next === 'CERRADO';

  return (
    <section aria-labelledby="next-step-title" className="ui-panel rounded-lg border border-border bg-surface shadow-card">
      <div className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Siguiente paso</p>
          <h2 id="next-step-title" className="mt-0.5 flex items-center gap-2 text-lg font-semibold">
            {ESTADO_LABEL[order.estado]}
            <ArrowRight className="size-4 text-subtle" aria-hidden="true" />
            <span className="text-primary">{isClose ? 'Cerrar y entregar' : ESTADO_LABEL[next]}</span>
          </h2>

          {reqs.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5" aria-label="Requisitos para avanzar">
              {reqs.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  {r.done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <CircleDashed className="size-4 shrink-0 text-warning" aria-hidden="true" />
                  )}
                  <span className={cn(r.done ? 'text-muted line-through decoration-1' : 'font-medium')}>{r.label}</span>
                  <span className="sr-only">{r.done ? ': listo' : ': pendiente'}</span>
                  {!r.done && (
                    <button
                      type="button"
                      onClick={() => onResolve(r.id)}
                      className="rounded-sm px-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {RESOLVE_LABEL[r.id]}
                      <span className="sr-only"> {r.label.toLowerCase()}</span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No hay requisitos previos: solo dejá un comentario al avanzar.</p>
          )}

          {permissionNotes.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {permissionNotes.join('. ')}.
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-52">
          <Button
            size="lg"
            disabled={!rule.ok}
            onClick={onAdvance}
            rightIcon={<ArrowRight aria-hidden="true" />}
            aria-describedby={!rule.ok ? 'next-step-why' : undefined}
          >
            {isClose ? 'Cerrar orden' : `Pasar a ${ESTADO_LABEL[next]}`}
          </Button>
          {!rule.ok && (
            <p id="next-step-why" className="text-center text-xs text-muted">
              {pending > 0 ? `Falta${pending > 1 ? 'n' : ''} ${pending} requisito${pending > 1 ? 's' : ''}` : 'No disponible para tu rol'}
            </p>
          )}
          <button
            type="button"
            onClick={onOtherState}
            className="text-center text-xs font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
          >
            Mover a otro estado…
          </button>
        </div>
      </div>
    </section>
  );
}
