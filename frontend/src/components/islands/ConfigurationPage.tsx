import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle, AlertTriangle, Building2, CheckCircle2, CircleCheckBig, CircleDashed, Pencil, Plus, ShieldAlert, Tags, UsersRound,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAllServices, useAllUsers, useSetupActions, useSetupProgress } from '@/hooks/useSetup';
import type { SetupProgress, UsuarioAdmin } from '@/lib/api/apiClient';
import { errorMessage } from '@/lib/api/errors';
import { ROL_LABEL, rolesLabel } from '@/lib/domain/labels';
import { formatMoney } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import { navigate } from '@/lib/router';
import { toast } from '@/lib/toast';
import { MAX_TEXTO, PRECIO_MAX } from '@/lib/workflow/validation';
import { PASSWORD_HINT, precio } from '@/schemas/common';
import {
  editUserSchema, newUserSchema, serviceSchema, tallerSchema, type ServiceInput, type TallerInput, type UserInput,
} from '@/schemas/setup.schema';
import { ROLES, type Rol } from '@/types/domain';

const ROL_HINT: Record<Rol, string> = {
  ADMIN: 'Configura el sistema y atiende escalamientos de nivel 3.',
  SUPERVISOR: 'Valida, cierra, desbloquea y atiende escalamientos de nivel 2.',
  RECEPCION: 'Registra clientes, equipos y órdenes, y entrega los equipos.',
  TECNICO: 'Diagnostica y repara las órdenes asignadas.',
};

/** Error de un grupo de campos que no es un <Input> (roles, precio en la lista). */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-1 text-xs font-medium text-danger">
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/** Aviso obligatorio: sin todos los roles asignados el sistema no se puede usar. */
function RequiredRolesNotice({ progress }: { progress: SetupProgress }) {
  const faltan = progress.rolesFaltantes;
  return (
    <section
      aria-labelledby="roles-obligatorios"
      className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-50"
    >
      <h2 id="roles-obligatorios" className="flex items-center gap-2 text-base font-semibold">
        <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
        Paso obligatorio: asigná todos los roles
      </h2>
      <p className="mt-1 text-sm">
        El sistema no se puede usar hasta que cada rol tenga al menos una persona activa. Una misma persona puede cubrir varios roles.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => {
          const ok = !faltan.includes(r);
          return (
            <li
              key={r}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-surface px-3 py-2 text-fg dark:border-amber-400/20"
            >
              {ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{ROL_LABEL[r]}</p>
                <p className="text-xs text-muted">{ok ? 'Asignado' : 'Falta asignar'}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p role="status" className="mt-3 text-sm font-medium">
        {faltan.length === 0
          ? 'Todos los roles están asignados: ya podés terminar la configuración.'
          : `Falta asignar: ${faltan.map((r) => ROL_LABEL[r]).join(', ')}.`}
      </p>
    </section>
  );
}

function TallerCard({ progress }: { progress: SetupProgress }) {
  const actions = useSetupActions();
  const {
    register, handleSubmit, formState: { errors },
  } = useForm<TallerInput>({
    resolver: zodResolver(tallerSchema),
    defaultValues: { nombre: progress.taller.nombre, telefono: progress.taller.telefono ?? '', direccion: progress.taller.direccion ?? '' },
  });

  function onSubmit(data: TallerInput) {
    actions.updateTaller.mutateAsync(data).then(() => toast.success('Datos del taller guardados'), notifyError);
  }

  return (
    <Card>
      <CardHeader icon={<Building2 aria-hidden="true" />} title="1. Datos del taller" />
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-4 md:grid-cols-3">
          <Input id="taller-nombre" label="Nombre" required maxLength={MAX_TEXTO} error={errors.nombre?.message} {...register('nombre')} />
          <Input id="taller-telefono" label="Teléfono" type="tel" autoComplete="tel" error={errors.telefono?.message} {...register('telefono')} />
          <Input id="taller-direccion" label="Dirección" error={errors.direccion?.message} {...register('direccion')} />
          <div className="md:col-span-3">
            <Button type="submit" variant="outline" loading={actions.updateTaller.isPending}>Guardar datos</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function UserModal({ user, open, onClose }: { user: UsuarioAdmin | null; open: boolean; onClose: () => void }) {
  const actions = useSetupActions();
  const me = useCurrentUser();
  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitted },
  } = useForm<UserInput>({
    resolver: zodResolver(user ? editUserSchema : newUserSchema),
    defaultValues: { nombre: '', email: '', password: '', roles: [], activo: true },
  });

  useEffect(() => {
    if (!open) return;
    reset({ nombre: user?.nombre ?? '', email: user?.email ?? '', password: '', roles: user?.roles ?? [], activo: user?.activo ?? true });
  }, [open, user, reset]);

  const roles = watch('roles');
  const busy = actions.createUser.isPending || actions.updateUser.isPending;

  function save(data: UserInput) {
    const done = user
      ? actions.updateUser.mutateAsync({
          id: user.id,
          input: { nombre: data.nombre, roles: data.roles, activo: data.activo, password: data.password || undefined },
        })
      : actions.createUser.mutateAsync({ nombre: data.nombre, email: data.email, password: data.password, roles: data.roles });
    done.then(() => {
      toast.success(user ? 'Persona actualizada' : 'Persona agregada');
      onClose();
    }, notifyError);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={user ? `Editar a ${user.nombre}` : 'Agregar persona'}
      description="Una persona puede tener varios roles: en un taller chico, la misma recibe y repara."
      icon={<UsersRound aria-hidden="true" />}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button loading={busy} onClick={handleSubmit(save)}>Guardar</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(save)} noValidate className="flex flex-col gap-4">
        <Input id="usuario-nombre" label="Nombre" required maxLength={MAX_TEXTO} data-autofocus error={errors.nombre?.message} {...register('nombre')} />
        <Input id="usuario-email" label="Email" type="email" required disabled={user !== null} error={errors.email?.message} {...register('email')} />
        <Input
          id="usuario-password"
          label={user ? 'Contraseña nueva' : 'Contraseña temporal'}
          type="password"
          autoComplete="new-password"
          required={!user}
          hint={user ? `Dejala vacía para no cambiarla. ${PASSWORD_HINT}` : `${PASSWORD_HINT} Pasásela a la persona: después la cambia en «Mi cuenta».`}
          error={errors.password?.message}
          {...register('password')}
        />
        <fieldset className="flex flex-col gap-2" aria-describedby={errors.roles ? 'usuario-roles-error' : undefined}>
          <legend className="mb-1 text-sm font-medium">
            Roles <span className="text-danger" aria-hidden="true">*</span>
          </legend>
          {ROLES.map((r) => (
            <Checkbox
              key={r}
              id={`usuario-rol-${r}`}
              label={ROL_LABEL[r]}
              description={ROL_HINT[r]}
              checked={roles.includes(r)}
              onChange={(e) => setValue('roles', e.target.checked ? [...roles, r] : roles.filter((x) => x !== r), { shouldValidate: isSubmitted })}
            />
          ))}
          <FieldError id="usuario-roles-error" message={errors.roles?.message} />
        </fieldset>
        {user && user.id !== me?.id && (
          <Checkbox id="usuario-activo" label="Activo" description="Si lo desactivás, deja de poder ingresar." {...register('activo')} />
        )}
        {/* Enter en un campo envía el formulario aunque los botones estén en el pie del modal */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}

function PeopleCard({ progress }: { progress: SetupProgress }) {
  const users = useAllUsers();
  const [editing, setEditing] = useState<UsuarioAdmin | null>(null);
  const [open, setOpen] = useState(false);
  const show = (u: UsuarioAdmin | null) => {
    setEditing(u);
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader
        icon={<UsersRound aria-hidden="true" />}
        title="2. Personas y roles"
        description="Antes de empezar tiene que haber al menos una persona en cada rol esencial."
        actions={<Button size="sm" leftIcon={<Plus aria-hidden="true" />} onClick={() => show(null)}>Agregar persona</Button>}
      />
      <CardBody className="flex flex-col gap-3">
        {progress.rolesFaltantes.length > 0 ? (
          <p role="status" className="flex flex-wrap items-center gap-2 text-sm">
            <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
            Falta asignar:
            {progress.rolesFaltantes.map((r) => <Badge key={r} tone="amber">{ROL_LABEL[r]}</Badge>)}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Todos los roles esenciales están cubiertos.
          </p>
        )}
        {users.isError && <ErrorState message={errorMessage(users.error)} onRetry={() => void users.refetch()} />}
        <ul className="divide-y divide-border rounded-md border border-border">
          {(users.data ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.nombre}{!u.activo && <span className="ml-2 text-xs text-muted">(inactivo)</span>}</p>
                <p className="truncate text-xs text-muted">{u.email} · {rolesLabel(u.roles)}</p>
              </div>
              <Button size="sm" variant="outline" leftIcon={<Pencil aria-hidden="true" />} onClick={() => show(u)}>Editar</Button>
            </li>
          ))}
        </ul>
      </CardBody>
      <UserModal user={editing} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

/** Precio editable en la lista: se guarda al salir del campo, solo si es válido. */
function PriceInput({ id, nombre, precioBase }: { id: string; nombre: string; precioBase: number }) {
  const actions = useSetupActions();
  const [value, setValue] = useState(String(precioBase));
  const [error, setError] = useState<string>();

  useEffect(() => setValue(String(precioBase)), [precioBase]);

  function save() {
    if (value.trim() === String(precioBase)) {
      setError(undefined);
      return;
    }
    const r = precio.safeParse(value);
    if (!r.success) {
      setError(r.error.issues[0]?.message);
      return;
    }
    setError(undefined);
    actions.updateService.mutateAsync({ id, input: { precioBase: Number(r.data) } }).then(() => toast.success('Precio actualizado'), notifyError);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        <Input
          id={`precio-${id}`}
          label={`Precio de ${nombre}`}
          hideLabel
          type="number"
          min={0}
          max={PRECIO_MAX}
          step={1}
          inputMode="numeric"
          wrapperClassName="w-32"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `precio-${id}-error` : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
        />
        <span className="w-24 text-right text-xs text-muted tabular-nums">{formatMoney(precioBase)}</span>
      </div>
      <FieldError id={`precio-${id}-error`} message={error} />
    </div>
  );
}

function ServicesCard() {
  const services = useAllServices();
  const actions = useSetupActions();
  const {
    register, handleSubmit, reset, setError, formState: { errors },
  } = useForm<ServiceInput>({ resolver: zodResolver(serviceSchema), defaultValues: { nombre: '', precio: '' } });

  function add(data: ServiceInput) {
    const repetido = (services.data ?? []).find((s) => s.nombre.toLocaleLowerCase('es') === data.nombre.toLocaleLowerCase('es'));
    if (repetido) {
      setError('nombre', { message: `Ya existe el servicio «${repetido.nombre}»` });
      return;
    }
    actions.createService.mutateAsync({ nombre: data.nombre, precioBase: Number(data.precio) }).then(() => {
      reset();
      toast.success('Servicio agregado');
    }, notifyError);
  }

  return (
    <Card>
      <CardHeader icon={<Tags aria-hidden="true" />} title="3. Servicios y precios" description="Lo que ofrece el taller. Desactivá los que no uses." />
      <CardBody className="flex flex-col gap-3">
        <ul className="divide-y divide-border rounded-md border border-border">
          {(services.data ?? []).map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <Checkbox
                id={`servicio-${s.id}`}
                label={s.nombre}
                className="min-w-0 flex-1"
                checked={s.activo}
                onChange={(e) => actions.updateService.mutateAsync({ id: s.id, input: { activo: e.target.checked } }).catch(notifyError)}
              />
              <PriceInput id={s.id} nombre={s.nombre} precioBase={s.precioBase} />
            </li>
          ))}
        </ul>
        <form onSubmit={handleSubmit(add)} noValidate className="flex flex-wrap items-start gap-3">
          <Input id="servicio-nuevo" label="Servicio nuevo" maxLength={MAX_TEXTO} wrapperClassName="min-w-48 flex-1" error={errors.nombre?.message} {...register('nombre')} />
          <Input
            id="servicio-precio"
            label="Precio"
            type="number"
            min={0}
            max={PRECIO_MAX}
            step={1}
            inputMode="numeric"
            wrapperClassName="w-40"
            error={errors.precio?.message}
            {...register('precio')}
          />
          <Button type="submit" variant="outline" className="mt-6" loading={actions.createService.isPending} leftIcon={<Plus aria-hidden="true" />}>
            Agregar
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function Content() {
  const progress = useSetupProgress();
  const actions = useSetupActions();

  if (progress.isPending) return <Skeleton className="h-64" />;
  if (progress.isError) {
    return <Card><ErrorState message={errorMessage(progress.error)} onRetry={() => void progress.refetch()} /></Card>;
  }
  const p = progress.data;
  const ready = p.rolesFaltantes.length === 0 && p.serviciosActivos > 0;

  return (
    <div className="flex flex-col gap-6">
      {!p.configurado && <RequiredRolesNotice progress={p} />}
      <TallerCard progress={p} />
      <PeopleCard progress={p} />
      <ServicesCard />
      {!p.configurado && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {ready
                ? 'Todo listo: ya se puede empezar a cargar órdenes.'
                : p.rolesFaltantes.length > 0
                  ? `Para usar el sistema falta asignar: ${p.rolesFaltantes.map((r) => ROL_LABEL[r]).join(', ')}.`
                  : 'Activá al menos un servicio para terminar.'}
            </p>
            <Button
              size="lg"
              disabled={!ready}
              loading={actions.complete.isPending}
              leftIcon={<CircleCheckBig aria-hidden="true" />}
              onClick={() => {
                actions.complete.mutateAsync().then(() => {
                  toast.success('Configuración terminada');
                  navigate('/dashboard');
                }, notifyError);
              }}
            >
              Terminar configuración
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export default function ConfigurationPage() {
  return (
    <AppShell
      currentPath="/configuracion"
      permission="users.manage"
      title="Configuración"
      description="Datos del taller, quién cumple cada rol y qué servicios ofrece."
    >
      <Content />
    </AppShell>
  );
}
