import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarDays, CheckCircle2, Circle, ClipboardPlus, Laptop, Plus, Save, UserRound, Wrench,
} from 'lucide-react';
import { ClientForm } from '@/components/domain/client/ClientForm';
import { ClientPicker } from '@/components/domain/client/ClientPicker';
import { EquipmentForm } from '@/components/domain/equipment/EquipmentForm';
import { TIPO_EQUIPO_ICON } from '@/components/domain/equipment/meta';
import { PriorityBadge } from '@/components/domain/PriorityBadge';
import { PriorityMatrix } from '@/components/domain/PriorityMatrix';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/States';
import { Textarea } from '@/components/ui/Textarea';
import { useServices, useUsers } from '@/hooks/useCatalog';
import { useClients } from '@/hooks/useClients';
import { useEquipment } from '@/hooks/useEquipment';
import { useCreateOrder } from '@/hooks/useOrders';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { now } from '@/lib/clock';
import { cn } from '@/lib/cn';
import { IMPACTO_LABEL, ROL_LABEL, TIPO_EQUIPO_LABEL, URGENCIA_LABEL } from '@/lib/domain/labels';
import { formatMoney } from '@/lib/format';
import { navigate } from '@/lib/router';
import { toast } from '@/lib/toast';
import { calculatePriority } from '@/lib/workflow/priority';
import { MIN_MOTIVO } from '@/lib/workflow/transitions';
import { localDate, orderSchema, type OrderInput } from '@/schemas/order.schema';
import { NIVELES_IMPACTO, NIVELES_URGENCIA, type Cliente } from '@/types/domain';

function Step({ n, title, icon, done, children, disabled }: {
  n: number; title: string; icon: ReactNode; done: boolean; children: ReactNode; disabled?: boolean;
}) {
  const headingId = useId();
  return (
    <Card aria-labelledby={headingId} role="group" className={cn('min-w-0', disabled && 'opacity-60')}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            done ? 'bg-green-700 text-white dark:bg-green-500 dark:text-green-950' : 'bg-surface-3 text-muted',
          )}
          aria-hidden="true"
        >
          {done ? <CheckCircle2 className="size-4" /> : n}
        </span>
        <span className="text-muted [&_svg]:size-4" aria-hidden="true">{icon}</span>
        <h2 id={headingId} className="text-base font-semibold">
          {n}. {title}
          {done && <span className="sr-only"> (completo)</span>}
        </h2>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

function plusDays(days: number): string {
  return localDate(now() + days * 86_400_000);
}

function NewOrderForm() {
  const users = useUsers();
  const services = useServices();
  const allClients = useClients('');
  const create = useCreateOrder();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [newClientName, setNewClientName] = useState<string | null>(null);
  const [creatingEquipment, setCreatingEquipment] = useState(false);

  const {
    register, control, handleSubmit, setValue, watch, formState: { errors, isSubmitted },
  } = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      clienteId: '', equipoId: '', servicioId: '', responsableId: '', tecnicoId: '',
      fallaReportada: '', fechaEstimada: plusDays(3),
    },
  });

  const equipment = useEquipment({ clienteId: cliente?.id }, { enabled: cliente !== null });
  const v = watch();

  // ?cliente=<id> preselecciona el cliente (desde la tabla de clientes)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('cliente');
    if (!id || cliente || !allClients.data) return;
    const c = allClients.data.find((x) => x.id === id);
    if (c) pickClient(c);
  }, [allClients.data]);

  // ?equipo=<id> preselecciona además el equipo (desde la tabla de equipos), una sola vez
  const equipoFromUrl = useRef(new URLSearchParams(window.location.search).get('equipo'));
  useEffect(() => {
    const id = equipoFromUrl.current;
    if (!id || !cliente || equipment.isPlaceholderData || !equipment.data) return;
    if (equipment.data.some((e) => e.id === id && e.clienteId === cliente.id)) {
      setValue('equipoId', id, { shouldValidate: isSubmitted });
    }
    equipoFromUrl.current = null;
  }, [cliente, equipment.data, equipment.isPlaceholderData]);

  function pickClient(c: Cliente | null) {
    setCliente(c);
    setNewClientName(null);
    setValue('clienteId', c?.id ?? '', { shouldValidate: isSubmitted });
    setValue('equipoId', '', { shouldValidate: isSubmitted });
    setCreatingEquipment(false);
  }

  const servicio = services.data?.find((s) => s.id === v.servicioId);
  const prioridad = v.impacto && v.urgencia ? calculatePriority(v.impacto, v.urgencia) : null;

  const checklist: { label: string; done: boolean }[] = [
    { label: 'Cliente', done: Boolean(v.clienteId) },
    { label: 'Equipo', done: Boolean(v.equipoId) },
    { label: 'Falla descripta', done: v.fallaReportada.trim().length >= MIN_MOTIVO },
    { label: 'Servicio', done: Boolean(v.servicioId) },
    { label: 'Responsable', done: Boolean(v.responsableId) },
    { label: 'Impacto', done: Boolean(v.impacto) },
    { label: 'Urgencia', done: Boolean(v.urgencia) },
  ];
  const missing = checklist.filter((c) => !c.done).map((c) => c.label);

  function onSubmit(data: OrderInput) {
    create.mutate(
      {
        clienteId: data.clienteId,
        equipoId: data.equipoId,
        servicioId: data.servicioId,
        responsableId: data.responsableId,
        tecnicoId: data.tecnicoId || null,
        fallaReportada: data.fallaReportada,
        impacto: data.impacto,
        urgencia: data.urgencia,
        // Fin del día elegido: una orden con entrega «hoy» no figura atrasada hasta que termine el día
        fechaEstimada: new Date(`${data.fechaEstimada}T23:59:59`).toISOString(),
      },
      {
        onSuccess: (o) => {
          toast.success(`Orden ${o.numero} creada`, { description: 'Quedó en «Recibido».' });
          navigate(`/ordenes/${o.id}`);
        },
        onError: (e) => toast.error(errorMessage(e), { details: isApiError(e) ? e.details : undefined }),
      },
    );
  }

  const tecnicos = (users.data ?? []).filter((u) => u.rol === 'TECNICO');
  // Al cambiar de cliente, la consulta muestra un instante los equipos del anterior (placeholder):
  // filtrar por dueño evita elegir un equipo de otro cliente
  const clientEquipment = (equipment.data ?? []).filter((e) => e.clienteId === cliente?.id);
  const loadingEquipment = equipment.isPending || equipment.isPlaceholderData;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        {/* 1. Cliente */}
        <Step n={1} title="Cliente" icon={<UserRound />} done={Boolean(cliente)}>
          {newClientName !== null ? (
            <div className="rounded-md border border-dashed border-border-strong p-4">
              <p className="mb-3 text-sm font-semibold">Nuevo cliente</p>
              <ClientForm
                idPrefix="no-cli"
                compact
                initialName={newClientName}
                onCancel={() => setNewClientName(null)}
                onCreated={(c) => {
                  pickClient(c);
                  setCreatingEquipment(true); // un cliente nuevo no tiene equipos
                }}
              />
            </div>
          ) : (
            <ClientPicker value={cliente} onChange={pickClient} onCreateNew={(q) => setNewClientName(q)} error={errors.clienteId?.message} />
          )}
        </Step>

        {/* 2. Equipo */}
        <Step n={2} title="Equipo" icon={<Laptop />} done={Boolean(v.equipoId)} disabled={!cliente}>
          {!cliente ? (
            <p className="text-sm text-muted">Primero elegí o creá el cliente.</p>
          ) : creatingEquipment ? (
            <div className="rounded-md border border-dashed border-border-strong p-4">
              <p className="mb-3 text-sm font-semibold">Nuevo equipo de {cliente.nombre}</p>
              <EquipmentForm
                key={cliente.id}
                idPrefix="no-eq"
                clienteId={cliente.id}
                compact
                onCancel={clientEquipment.length > 0 ? () => setCreatingEquipment(false) : undefined}
                onCreated={(e) => {
                  setValue('equipoId', e.id, { shouldValidate: isSubmitted });
                  setCreatingEquipment(false);
                }}
              />
            </div>
          ) : (
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Equipo del cliente</legend>
              {loadingEquipment ? (
                <Skeleton className="h-16" />
              ) : clientEquipment.length === 0 ? (
                <p className="text-sm text-muted">Este cliente no tiene equipos registrados.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {clientEquipment.map((e) => {
                    const Icon = TIPO_EQUIPO_ICON[e.tipo];
                    const checked = v.equipoId === e.id;
                    return (
                      <label
                        key={e.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus',
                          checked ? 'border-primary bg-primary-soft/50 ring-1 ring-primary' : 'border-border hover:border-border-strong',
                        )}
                      >
                        <input type="radio" value={e.id} className="sr-only" {...register('equipoId')} />
                        <Icon className={cn('size-5 shrink-0', checked ? 'text-primary' : 'text-muted')} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{e.marca} {e.modelo}</span>
                          <span className="block truncate font-mono text-xs text-muted">
                            {TIPO_EQUIPO_LABEL[e.tipo]} · SN {e.numeroSerie}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {errors.equipoId?.message && <p role="alert" className="text-xs font-medium text-danger">{errors.equipoId.message}</p>}
              <div>
                <Button variant="outline" size="sm" leftIcon={<Plus aria-hidden="true" />} onClick={() => setCreatingEquipment(true)}>
                  Nuevo equipo
                </Button>
              </div>
            </fieldset>
          )}
        </Step>

        {/* 3. Falla y servicio */}
        <Step n={3} title="Falla y servicio" icon={<Wrench />} done={v.fallaReportada.trim().length >= MIN_MOTIVO && Boolean(v.servicioId)}>
          <div className="flex flex-col gap-4">
            <Textarea
              id="no-falla"
              label="Falla reportada por el cliente"
              required
              rows={3}
              placeholder="Ej.: La notebook enciende pero no da imagen. Se cayó la semana pasada."
              hint={`Mínimo ${MIN_MOTIVO} caracteres. Usá las palabras del cliente.`}
              error={errors.fallaReportada?.message}
              {...register('fallaReportada')}
            />
            <Select
              id="no-servicio"
              label="Servicio"
              required
              placeholder="Elegí un servicio"
              options={(services.data ?? []).map((s) => ({ value: s.id, label: `${s.nombre} · desde ${formatMoney(s.precioBase)}` }))}
              hint={servicio?.descripcion}
              error={errors.servicioId?.message}
              {...register('servicioId')}
            />
          </div>
        </Step>

        {/* 4. Asignación y prioridad */}
        <Step n={4} title="Asignación y prioridad" icon={<ClipboardPlus />} done={Boolean(v.responsableId && v.impacto && v.urgencia)}>
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                id="no-resp"
                label="Responsable"
                required
                placeholder="Elegí responsable"
                options={(users.data ?? []).map((u) => ({ value: u.id, label: `${u.nombre} (${ROL_LABEL[u.rol]})` }))}
                error={errors.responsableId?.message}
                {...register('responsableId')}
              />
              <Select
                id="no-tec"
                label="Técnico"
                placeholder="Asignar después"
                options={tecnicos.map((u) => ({ value: u.id, label: u.nombre }))}
                hint="Necesario para pasar a diagnóstico."
                {...register('tecnicoId')}
              />
              <Input
                id="no-fecha"
                label="Entrega estimada"
                required
                type="date"
                min={plusDays(0)}
                leftIcon={<CalendarDays aria-hidden="true" />}
                error={errors.fechaEstimada?.message}
                {...register('fechaEstimada')}
              />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-4">
                <Controller
                  control={control}
                  name="impacto"
                  render={({ field }) => (
                    <SegmentedControl
                      label="Impacto"
                      name="impacto"
                      required
                      hint="¿Cuánto afecta al cliente? (ej. equipo de trabajo = alto)"
                      options={NIVELES_IMPACTO.map((n) => ({ value: n, label: IMPACTO_LABEL[n] }))}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.impacto?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="urgencia"
                  render={({ field }) => (
                    <SegmentedControl
                      label="Urgencia"
                      name="urgencia"
                      required
                      hint="¿Para cuándo lo necesita?"
                      options={NIVELES_URGENCIA.map((n) => ({ value: n, label: URGENCIA_LABEL[n] }))}
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.urgencia?.message}
                    />
                  )}
                />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Matriz de prioridad</p>
                <PriorityMatrix impacto={v.impacto} urgencia={v.urgencia} />
              </div>
            </div>
          </div>
        </Step>
      </div>

      {/* Resumen */}
      <aside aria-label="Resumen de la orden" className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Resumen</h2>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex items-center justify-between gap-2" aria-live="polite">
              <span className="text-sm text-muted">Prioridad calculada</span>
              {prioridad ? <PriorityBadge prioridad={prioridad} /> : <span className="text-sm text-subtle">Elegí impacto y urgencia</span>}
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.done ? (
                    <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                  ) : (
                    <Circle className="size-4 text-subtle" aria-hidden="true" />
                  )}
                  <span className={c.done ? 'text-fg' : 'text-muted'}>{c.label}</span>
                  <span className="sr-only">{c.done ? ': completo' : ': falta'}</span>
                </li>
              ))}
            </ul>
            {servicio && (
              <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
                Precio base del servicio: <strong className="text-fg">{formatMoney(servicio.precioBase)}</strong>
              </p>
            )}
            <Button
              size="lg"
              loading={create.isPending}
              disabled={missing.length > 0}
              aria-describedby="no-missing"
              leftIcon={<Save aria-hidden="true" />}
              onClick={handleSubmit(onSubmit)}
            >
              Crear orden
            </Button>
            <p id="no-missing" className="text-center text-xs text-muted" aria-live="polite">
              {missing.length > 0 ? `Para guardar falta: ${missing.join(', ').toLowerCase()}.` : 'Todo listo para crear la orden.'}
            </p>
          </div>
        </Card>
      </aside>
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <AppShell
      currentPath="/ordenes"
      permission="order.create"
      title="Nueva orden de servicio"
      description="Registrá el ingreso del equipo. La prioridad se calcula sola a partir del impacto y la urgencia."
    >
      <NewOrderForm />
    </AppShell>
  );
}
