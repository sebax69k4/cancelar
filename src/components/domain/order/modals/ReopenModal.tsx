import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ESTADO_LABEL } from '@/lib/domain/labels';
import { MIN_MOTIVO, REOPEN_TARGETS } from '@/lib/workflow/transitions';
import { ESTADOS, type EstadoOrden } from '@/types/domain';

const schema = z.object({
  to: z.enum(ESTADOS),
  motivo: z.string().trim().min(MIN_MOTIVO, `El motivo es obligatorio (mínimo ${MIN_MOTIVO} caracteres)`).max(500),
});
type ReopenInput = z.infer<typeof schema>;

export interface ReopenModalProps {
  open: boolean;
  numero: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (v: { to: EstadoOrden; motivo: string }) => void;
}

export function ReopenModal({ open, numero, busy, onClose, onConfirm }: ReopenModalProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReopenInput>({
    resolver: zodResolver(schema),
    defaultValues: { to: 'EN_DIAGNOSTICO', motivo: '' },
  });

  useEffect(() => {
    if (open) reset({ to: 'EN_DIAGNOSTICO', motivo: '' });
  }, [open, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={`Reabrir ${numero}`}
      description="La orden vuelve al flujo de trabajo. Se pierde la validación y hay que volver a validar antes de cerrar."
      icon={<RotateCcw className="text-warning" aria-hidden="true" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="reopen-form" loading={busy}>
            Reabrir orden
          </Button>
        </>
      }
    >
      <form id="reopen-form" noValidate onSubmit={handleSubmit(onConfirm)} className="flex flex-col gap-4">
        <Select
          id="reopen-to"
          label="Volver a"
          required
          options={REOPEN_TARGETS.map((s) => ({ value: s, label: ESTADO_LABEL[s] }))}
          error={errors.to?.message}
          {...register('to')}
        />
        <Textarea
          id="reopen-motivo"
          label="Motivo de la reapertura"
          required
          rows={3}
          data-autofocus
          placeholder="Ej.: El cliente volvió porque la falla reapareció a los 2 días."
          error={errors.motivo?.message}
          {...register('motivo')}
        />
      </form>
    </Modal>
  );
}
