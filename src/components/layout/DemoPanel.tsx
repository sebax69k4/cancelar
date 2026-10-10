import { useState } from 'react';
import { Clock, FastForward, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useClockOffset } from '@/hooks/useClock';
import { usePermission } from '@/hooks/useCurrentUser';
import { useResetDemo } from '@/hooks/useDashboard';
import { isMockApi } from '@/lib/api/apiClient';
import { errorMessage } from '@/lib/api/errors';
import { setClockOffsetHours } from '@/lib/clock';
import { formatHours } from '@/lib/format';
import { toast } from '@/lib/toast';

/** Controles exclusivos de la versión demo: reloj simulado y reinicio de datos. */
export function DemoPanel() {
  const offset = useClockOffset();
  const canReset = usePermission('demo.reset');
  const reset = useResetDemo();
  const [confirm, setConfirm] = useState(false);

  // Con backend real no hay reloj simulado ni reinicio.
  if (!isMockApi) return null;

  return (
    <section
      aria-label="Controles de la demo"
      className="flex flex-col gap-2 rounded-md border border-dashed border-border-strong px-3 py-2.5 text-[11px] leading-snug text-muted"
    >
      <p>
        <strong className="font-semibold text-fg">Versión demo.</strong> Los datos se guardan solo en este navegador.
      </p>
      <div className="flex items-center gap-1.5" aria-live="polite">
        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Reloj: {offset > 0 ? <strong className="font-semibold text-warning">+{formatHours(offset)} simuladas</strong> : 'tiempo real'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px]"
          leftIcon={<FastForward aria-hidden="true" />}
          onClick={() => {
            setClockOffsetHours(offset + 24);
            toast.info('Reloj adelantado 24 h', { description: 'Las alertas se recalculan con el tiempo simulado.' });
          }}
        >
          +24 h
        </Button>
        {offset > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            leftIcon={<RotateCcw aria-hidden="true" />}
            onClick={() => setClockOffsetHours(0)}
          >
            Tiempo real
          </Button>
        )}
      </div>
      {canReset && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 justify-start px-2 text-[11px] text-danger hover:text-danger"
          leftIcon={<Trash2 aria-hidden="true" />}
          onClick={() => setConfirm(true)}
        >
          Reiniciar demo
        </Button>
      )}

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        busy={reset.isPending}
        size="sm"
        title="¿Reiniciar la demo?"
        description="Se borran todos los clientes, equipos y órdenes guardados en este navegador. No se puede deshacer."
        icon={<Trash2 className="text-danger" aria-hidden="true" />}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={reset.isPending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={reset.isPending}
              onClick={() =>
                reset.mutate(undefined, {
                  onSuccess: () => {
                    setClockOffsetHours(0);
                    setConfirm(false);
                    toast.success('Demo reiniciada', { description: 'El sistema quedó vacío.' });
                  },
                  onError: (e) => toast.error('No se pudo reiniciar', { description: errorMessage(e) }),
                })
              }
            >
              Borrar todo
            </Button>
          </>
        }
      />
    </section>
  );
}
