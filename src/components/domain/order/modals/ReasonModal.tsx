import { useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { textSchema, type TextInput } from '@/schemas/transition.schema';

export interface ReasonModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  label: string;
  placeholder?: string;
  hint?: string;
  minLength: number;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  busy?: boolean;
  /** Contenido extra sobre el campo (ej. checklist). */
  children?: ReactNode;
  /** Deshabilita confirmar (ej. faltan requisitos). */
  confirmDisabled?: boolean;
  onConfirm: (texto: string) => void;
}

/** Modal genérico para acciones que exigen motivo o comentario (bloquear, escalar, validar…). */
export function ReasonModal({
  open, onClose, title, description, icon, label, placeholder, hint, minLength,
  confirmLabel, confirmVariant = 'primary', busy, children, confirmDisabled, onConfirm,
}: ReasonModalProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<TextInput>({
    resolver: zodResolver(textSchema(minLength, label)),
    defaultValues: { texto: '' },
  });

  useEffect(() => {
    if (open) reset({ texto: '' });
  }, [open, reset]);

  const formId = `reason-${title.replace(/\W+/g, '-')}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={title}
      description={description}
      icon={icon}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant={confirmVariant} loading={busy} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit((d) => onConfirm(d.texto))} className="flex flex-col gap-4">
        {children}
        <Textarea
          id={`${formId}-texto`}
          label={label}
          required
          rows={3}
          data-autofocus
          placeholder={placeholder}
          hint={hint ?? `Obligatorio, mínimo ${minLength} caracteres. Queda en el historial.`}
          error={errors.texto?.message}
          {...register('texto')}
        />
      </form>
    </Modal>
  );
}
