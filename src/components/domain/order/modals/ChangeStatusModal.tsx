import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowRight, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTransitionOrder } from '@/hooks/useOrders';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { ESTADO_LABEL } from '@/lib/domain/labels';
import { toast } from '@/lib/toast';
import { ALLOWED_TRANSITIONS, NEXT_STATE, canTransition } from '@/lib/workflow/transitions';
import { transitionSchema, type TransitionInput } from '@/schemas/transition.schema';
import type { EstadoOrden, OrdenResumen } from '@/types/domain';

export interface ChangeStatusModalProps {
  order: OrdenResumen | null;
  /** Estado destino preseleccionado (ej. columna donde se soltó la tarjeta). */
  initialTo?: EstadoOrden;
  onClose: () => void;
  onDone?: (order: OrdenResumen) => void;
}

export function ChangeStatusModal({ order, initialTo, onClose, onDone }: ChangeStatusModalProps) {
  const user = useCurrentUser();
  const mutation = useTransitionOrder();

  const targets = useMemo(() => (order ? ALLOWED_TRANSITIONS[order.estado] : []), [order]);
  const defaultTo = initialTo ?? (order ? NEXT_STATE[order.estado] : undefined) ?? targets[0];

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<TransitionInput>({
    resolver: zodResolver(transitionSchema),
  });

  useEffect(() => {
    if (order && defaultTo) reset({ to: defaultTo, comentario: '' });
  }, [order, defaultTo, reset]);

  const to = watch('to');
  const rule = order && user && to ? canTransition(order, to, user) : null;

  function onSubmit(data: TransitionInput) {
    if (!order) return;
    mutation.mutate(
      { id: order.id, to: data.to, comentario: data.comentario },
      {
        onSuccess: (updated) => {
          toast.success(`${updated.numero} pasó a «${ESTADO_LABEL[updated.estado]}»`);
          onDone?.(updated);
          onClose();
        },
        onError: (e) =>
          toast.error(errorMessage(e), { details: isApiError(e) ? e.details : undefined }),
      },
    );
  }

  return (
    <Modal
      open={order !== null}
      onClose={onClose}
      busy={mutation.isPending}
      title={order ? `Cambiar estado · ${order.numero}` : 'Cambiar estado'}
      description="Todo cambio de estado queda en el historial con tu comentario."
      icon={<ArrowRightLeft className="text-primary" aria-hidden="true" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="change-status-form" loading={mutation.isPending} disabled={!rule?.ok}>
            Confirmar cambio
          </Button>
        </>
      }
    >
      {order && (
        <form id="change-status-form" onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Estado actual:</span>
            <StatusBadge estado={order.estado} />
            {to && (
              <>
                <ArrowRight className="size-4 text-subtle" aria-hidden="true" />
                <StatusBadge estado={to} />
              </>
            )}
          </div>

          <Select
            id="cs-to"
            label="Nuevo estado"
            required
            error={errors.to?.message}
            options={targets.map((t) => {
              const ok = user ? canTransition(order, t, user).ok : false;
              return { value: t, label: `${ESTADO_LABEL[t]}${ok ? '' : ' — faltan requisitos'}` };
            })}
            {...register('to')}
          />

          {rule && (
            <div
              role="status"
              className={
                rule.ok
                  ? 'flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-200'
                  : 'flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200'
              }
            >
              {rule.ok ? (
                <>
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>Se cumplen todos los requisitos para este cambio.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Todavía no se puede mover:</p>
                    <ul className="mt-1 list-disc pl-4">
                      {rule.missing.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          <Textarea
            id="cs-comment"
            label="Comentario"
            required
            rows={3}
            data-autofocus
            placeholder="Ej.: Se reemplazó el módulo de RAM, el equipo enciende correctamente."
            hint="Obligatorio. Explicá qué se hizo o por qué cambia de estado."
            error={errors.comentario?.message}
            {...register('comentario')}
          />
        </form>
      )}
    </Modal>
  );
}
