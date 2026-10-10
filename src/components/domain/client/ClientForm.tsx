import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Mail, Phone, Save, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useCreateClient } from '@/hooks/useClients';
import { errorMessage } from '@/lib/api/errors';
import { toast } from '@/lib/toast';
import { clientSchema, emptyClient, type ClientInput } from '@/schemas/client.schema';
import type { Cliente } from '@/types/domain';

export interface ClientFormProps {
  /** Prefijo de ids (permite varias instancias en la página). */
  idPrefix?: string;
  initialName?: string;
  onCreated: (cliente: Cliente) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function ClientForm({ idPrefix = 'cf', initialName = '', onCreated, onCancel, compact }: ClientFormProps) {
  const create = useCreateClient();
  const {
    register, handleSubmit, setError, formState: { errors },
  } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema),
    defaultValues: { ...emptyClient, nombre: initialName },
  });

  function onSubmit(data: ClientInput) {
    create.mutate(
      { nombre: data.nombre, telefono: data.telefono, email: data.email || null, notas: data.notas || null },
      {
        onSuccess: (c) => {
          toast.success(`Cliente ${c.nombre} registrado`);
          onCreated(c);
        },
        onError: (e) => {
          const msg = errorMessage(e);
          if (msg.toLowerCase().includes('teléfono')) setError('telefono', { message: msg });
          else setError('root', { message: msg });
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {errors.root?.message && (
        <p role="alert" className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {errors.root.message}
        </p>
      )}
      <div className={compact ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
        <Input
          id={`${idPrefix}-nombre`}
          label="Nombre y apellido"
          required
          autoComplete="off"
          data-autofocus
          leftIcon={<User aria-hidden="true" />}
          error={errors.nombre?.message}
          {...register('nombre')}
        />
        <Input
          id={`${idPrefix}-telefono`}
          label="Teléfono"
          required
          type="tel"
          inputMode="tel"
          placeholder="11 5555-1234"
          leftIcon={<Phone aria-hidden="true" />}
          error={errors.telefono?.message}
          {...register('telefono')}
        />
        <Input
          id={`${idPrefix}-email`}
          label="Email"
          type="email"
          placeholder="opcional"
          leftIcon={<Mail aria-hidden="true" />}
          error={errors.email?.message}
          {...register('email')}
        />
        {!compact && (
          <Textarea id={`${idPrefix}-notas`} label="Notas" rows={2} placeholder="opcional" error={errors.notas?.message} {...register('notas')} />
        )}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={create.isPending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={create.isPending} leftIcon={<Save aria-hidden="true" />}>
          Guardar cliente
        </Button>
      </div>
    </form>
  );
}
