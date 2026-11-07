import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Building2, CheckCircle2, CircleCheckBig, Pencil, Plus, Tags, UsersRound } from 'lucide-react';
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
import { MIN_PASSWORD } from '@/lib/workflow/setup';
import { ROLES, type Rol } from '@/types/domain';

const ROL_HINT: Record<Rol, string> = {
  ADMIN: 'Configura el sistema y atiende escalamientos de nivel 3.',
  SUPERVISOR: 'Valida, cierra, desbloquea y atiende escalamientos de nivel 2.',
  RECEPCION: 'Registra clientes, equipos y órdenes, y entrega los equipos.',
  TECNICO: 'Diagnostica y repara las órdenes asignadas.',
};

function TallerCard({ progress }: { progress: SetupProgress }) {
  const actions = useSetupActions();
  const [nombre, setNombre] = useState(progress.taller.nombre);
  const [telefono, setTelefono] = useState(progress.taller.telefono ?? '');
  const [direccion, setDireccion] = useState(progress.taller.direccion ?? '');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    actions.updateTaller.mutateAsync({ nombre, telefono, direccion }).then(() => toast.success('Datos del taller guardados'), notifyError);
  }

  return (
    <Card>
      <CardHeader icon={<Building2 aria-hidden="true" />} title="1. Datos del taller" />
      <CardBody>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
          <Input id="taller-nombre" label="Nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input id="taller-telefono" label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <Input id="taller-direccion" label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
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
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roles, setRoles] = useState<Rol[]>([]);
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    if (!open) return;
    setNombre(user?.nombre ?? '');
    setEmail(user?.email ?? '');
    setPassword('');
    setRoles(user?.roles ?? []);
    setActivo(user?.activo ?? true);
  }, [open, user]);

  const busy = actions.createUser.isPending || actions.updateUser.isPending;
  const passwordOk = user ? password === '' || password.length >= MIN_PASSWORD : password.length >= MIN_PASSWORD;
  const valid = nombre.trim().length >= 2 && email.includes('@') && roles.length > 0 && passwordOk;

  function save() {
    const done = user
      ? actions.updateUser.mutateAsync({ id: user.id, input: { nombre, roles, activo, password: password || undefined } })
      : actions.createUser.mutateAsync({ nombre, email, password, roles });
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
          <Button loading={busy} disabled={!valid} onClick={save}>Guardar</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input id="usuario-nombre" label="Nombre" required data-autofocus value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input id="usuario-email" label="Email" type="email" required disabled={user !== null} value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          id="usuario-password"
          label={user ? 'Contraseña nueva' : 'Contraseña temporal'}
          type="password"
          autoComplete="new-password"
          required={!user}
          hint={user ? `Dejala vacía para no cambiarla. Mínimo ${MIN_PASSWORD} caracteres.` : `Mínimo ${MIN_PASSWORD} caracteres. Pasásela a la persona: después la cambia en «Mi cuenta».`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Roles</legend>
          {ROLES.map((r) => (
            <Checkbox
              key={r}
              id={`usuario-rol-${r}`}
              label={ROL_LABEL[r]}
              description={ROL_HINT[r]}
              checked={roles.includes(r)}
              onChange={(e) => setRoles((prev) => (e.target.checked ? [...prev, r] : prev.filter((x) => x !== r)))}
            />
          ))}
        </fieldset>
        {user && user.id !== me?.id && (
          <Checkbox id="usuario-activo" label="Activo" description="Si lo desactivás, deja de poder ingresar." checked={activo} onChange={(e) => setActivo(e.target.checked)} />
        )}
      </div>
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

function ServicesCard() {
  const services = useAllServices();
  const actions = useSetupActions();
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [prices, setPrices] = useState<Record<string, string>>({});

  function add(e: FormEvent) {
    e.preventDefault();
    actions.createService.mutateAsync({ nombre, precioBase: Number(precio) }).then(() => {
      setNombre('');
      setPrecio('');
      toast.success('Servicio agregado');
    }, notifyError);
  }

  function savePrice(id: string) {
    const value = prices[id];
    if (value === undefined) return;
    actions.updateService.mutateAsync({ id, input: { precioBase: Number(value) } }).then(() => toast.success('Precio actualizado'), notifyError);
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
              <Input
                id={`precio-${s.id}`}
                label={`Precio de ${s.nombre}`}
                hideLabel
                type="number"
                min={0}
                wrapperClassName="w-32"
                value={prices[s.id] ?? String(s.precioBase)}
                onChange={(e) => setPrices((p) => ({ ...p, [s.id]: e.target.value }))}
                onBlur={() => {
                  if (prices[s.id] !== undefined && prices[s.id] !== String(s.precioBase)) savePrice(s.id);
                }}
              />
              <span className="w-24 text-right text-xs text-muted tabular-nums">{formatMoney(s.precioBase)}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <Input id="servicio-nuevo" label="Servicio nuevo" wrapperClassName="min-w-48 flex-1" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input id="servicio-precio" label="Precio" type="number" min={0} wrapperClassName="w-32" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          <Button type="submit" variant="outline" disabled={nombre.trim().length < 2 || precio === ''} loading={actions.createService.isPending} leftIcon={<Plus aria-hidden="true" />}>
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
      <TallerCard progress={p} />
      <PeopleCard progress={p} />
      <ServicesCard />
      {!p.configurado && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {ready ? 'Todo listo: ya se puede empezar a cargar órdenes.' : 'Hasta terminar estos pasos no se pueden crear órdenes.'}
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
