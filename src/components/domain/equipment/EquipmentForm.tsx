import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useCreateEquipment } from '@/hooks/useEquipment';
import { errorMessage } from '@/lib/api/errors';
import { TIPO_EQUIPO_LABEL } from '@/lib/domain/labels';
import { toast } from '@/lib/toast';
import { equipmentSchema, type EquipmentInput } from '@/schemas/equipment.schema';
import { TIPOS_EQUIPO, type Equipo } from '@/types/domain';

export interface EquipmentFormProps {
  idPrefix?: string;
  /** Si viene, el cliente queda fijo (alta desde la orden). */
  clienteId?: string;
  /** Cliente preseleccionado (editable). */
  defaultClienteId?: string;
  /** Opciones de cliente cuando no viene fijo. */
  clientOptions?: readonly SelectOption[];
  onCreated: (equipo: Equipo) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function EquipmentForm({ idPrefix = 'ef', clienteId, defaultClienteId, clientOptions = [], onCreated, onCancel, compact }: EquipmentFormProps) {
  const create = useCreateEquipment();
  const {
    register, handleSubmit, setError, formState: { errors },
  } = useForm<EquipmentInput>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { clienteId: clienteId ?? defaultClienteId ?? '', tipo: 'NOTEBOOK', marca: '', modelo: '', numeroSerie: '', notas: '' },
  });

  function onSubmit(data: EquipmentInput) {
    create.mutate(
      { ...data, notas: data.notas || null },
      {
        onSuccess: (e) => {
          toast.success(`Equipo ${e.marca} ${e.modelo} registrado`);
          onCreated(e);
        },
        onError: (e) => {
          const msg = errorMessage(e);
          if (msg.toLowerCase().includes('serie')) setError('numeroSerie', { message: msg });
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
      {clienteId ? (
        <input type="hidden" {...register('clienteId')} />
      ) : (
        <Select
          id={`${idPrefix}-cliente`}
          label="Cliente"
          required
          placeholder="Elegí el cliente"
          options={clientOptions}
          error={errors.clienteId?.message}
          hint={clientOptions.length === 0 ? 'Primero registrá un cliente en la sección Clientes.' : undefined}
          {...register('clienteId')}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          id={`${idPrefix}-tipo`}
          label="Tipo"
          required
          options={TIPOS_EQUIPO.map((t) => ({ value: t, label: TIPO_EQUIPO_LABEL[t] }))}
          error={errors.tipo?.message}
          {...register('tipo')}
        />
        <Input id={`${idPrefix}-marca`} label="Marca" required placeholder="Lenovo, HP, Dell…" error={errors.marca?.message} {...register('marca')} />
        <Input id={`${idPrefix}-modelo`} label="Modelo" required placeholder="ThinkPad T14" error={errors.modelo?.message} {...register('modelo')} />
        <Input
          id={`${idPrefix}-serie`}
          label="Número de serie"
          required
          autoComplete="off"
          className="font-mono uppercase"
          error={errors.numeroSerie?.message}
          {...register('numeroSerie')}
        />
      </div>
      {!compact && (
        <Textarea
          id={`${idPrefix}-notas`}
          label="Notas"
          rows={2}
          placeholder="Accesorios entregados, estado físico, contraseña de BIOS…"
          error={errors.notas?.message}
          {...register('notas')}
        />
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={create.isPending}>
            Cancelar
          </Button>
        )}
        <Button type="submit" loading={create.isPending} leftIcon={<Save aria-hidden="true" />}>
          Guardar equipo
        </Button>
      </div>
    </form>
  );
}
