import { AlertTriangle, CircleCheckBig } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { MIN_COMENTARIO, canTransition } from '@/lib/workflow/transitions';
import type { OrdenResumen } from '@/types/domain';
import { CloseChecklist } from '../CloseChecklist';
import { ReasonModal } from './ReasonModal';

export interface CloseOrderModalProps {
  order: OrdenResumen;
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (comentario: string) => void;
}

/** Cierre: repite el checklist y bloquea confirmar si falta algo. */
export function CloseOrderModal({ order, open, busy, onClose, onConfirm }: CloseOrderModalProps) {
  const user = useCurrentUser();
  const rule = user ? canTransition(order, 'CERRADO', user) : { ok: false, missing: [] };
  // Los faltantes de checklist ya se ven en el checklist; mostramos el resto (permisos, bloqueo…)
  const otherMissing = rule.missing.filter((m) => !/^Falta /.test(m));

  return (
    <ReasonModal
      open={open}
      onClose={onClose}
      busy={busy}
      title={`Cerrar ${order.numero}`}
      description="Confirmá que el equipo se entregó al cliente. El cierre queda registrado con tu comentario."
      icon={<CircleCheckBig className="text-success" aria-hidden="true" />}
      label="Comentario de cierre"
      placeholder="Ej.: Equipo entregado a Juan Pérez, funcionando correctamente."
      minLength={MIN_COMENTARIO}
      confirmLabel="Cerrar orden"
      confirmDisabled={!rule.ok}
      onConfirm={onConfirm}
    >
      <CloseChecklist order={order} />
      {otherMissing.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <ul className="list-disc pl-4">
            {otherMissing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </ReasonModal>
  );
}
