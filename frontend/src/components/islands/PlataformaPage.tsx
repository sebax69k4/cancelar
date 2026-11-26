import { useCallback, useEffect, useState } from 'react';
import {
  Ban, Building2, Copy, KeyRound, LogOut, Play, ScrollText, ShieldCheck, Smartphone, UserCog, UserPlus, Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Toaster } from '@/components/ui/Toast';
import { errorMessage, isApiError } from '@/lib/api/errors';
import {
  plataforma, type Accion, type CuentaListada, type CuentaPlataforma, type PersonaDeTaller, type RolPlataforma, type TallerResumen,
} from '@/lib/api/plataforma';
import { rolesLabel } from '@/lib/domain/labels';
import { formatDate, formatDateTime, formatRelative } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import { toast } from '@/lib/toast';

const ROL: Record<RolPlataforma, string> = { MODERADOR: 'Moderador', ADMINISTRADOR: 'Administrador' };

/** Página de administración de la plataforma: ingreso con segundo factor y panel. */
export default function PlataformaPage() {
  const [cuenta, setCuenta] = useState<CuentaPlataforma | null | undefined>(undefined);

  useEffect(() => {
    plataforma.me().then(setCuenta, () => setCuenta(null));
  }, []);

  /** La sesión venció o la cuenta fue suspendida: vuelve al ingreso. */
  const sesionPerdida = useCallback((e: unknown) => {
    if (isApiError(e) && e.status === 401) {
      toast.warning('La sesión de plataforma terminó', { description: 'Volvé a ingresar.' });
      setCuenta(null);
      return true;
    }
    return false;
  }, []);

  return (
    <div className="min-h-dvh bg-bg">
      {cuenta === undefined ? (
        <LoadingState className="min-h-dvh" />
      ) : cuenta === null ? (
        <Ingreso onListo={setCuenta} />
      ) : (
        <Panel cuenta={cuenta} onSalir={() => setCuenta(null)} sesionPerdida={sesionPerdida} />
      )}
      <Toaster />
    </div>
  );
}

// ------------------------------------------------------------------ ingreso

function Ingreso({ onListo }: { onListo: (c: CuentaPlataforma) => void }) {
  const [paso, setPaso] = useState<'clave' | 'codigo' | 'configurar'>('clave');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [config, setConfig] = useState<{ secreto: string; uri: string } | null>(null);
  const [error, setError] = useState<string>();
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(undefined);
    setEnviando(true);
    try {
      if (paso === 'configurar') {
        onListo((await plataforma.activarSegundoFactor(codigo)).cuenta);
        toast.success('Segundo factor activado');
        return;
      }
      const r = await plataforma.ingresar(email.trim(), password, paso === 'codigo' ? codigo : undefined);
      if (r.estado === 'listo') onListo(r.cuenta);
      else if (r.estado === 'codigo') setPaso('codigo');
      else {
        setConfig({ secreto: r.secreto, uri: r.uri });
        setPaso('configurar');
      }
      setCodigo('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setEnviando(false);
    }
  }

  const campoCodigo = (
    <Input
      id="pf-codigo"
      label="Código de 6 dígitos"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      autoFocus
      required
      leftIcon={<Smartphone aria-hidden="true" />}
      value={codigo}
      onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
      hint="El que muestra ahora la app autenticadora. Cambia cada 30 segundos."
    />
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-fg">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          Plataforma
        </span>
        <ThemeToggle />
      </div>
      <Card>
        <CardHeader
          title={paso === 'configurar' ? 'Configurá el segundo factor' : 'Administración de la plataforma'}
          description={paso === 'configurar' ? 'Es obligatorio para las cuentas de plataforma.' : 'Solo para moderadores y administradores del sistema.'}
        />
        <CardBody>
          <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">
                {error}
              </p>
            )}
            {paso === 'clave' && (
              <>
                <Input id="pf-email" label="Email" type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input id="pf-clave" label="Contraseña" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </>
            )}
            {paso === 'codigo' && campoCodigo}
            {paso === 'configurar' && config && (
              <>
                <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
                  <li>Instalá en el celular una app autenticadora: Google Authenticator, Microsoft Authenticator o Authy.</li>
                  <li>
                    Agregá una cuenta con esta clave:
                    <code className="mt-1.5 block rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-all select-all">
                      {config.secreto.match(/.{1,4}/g)?.join(' ')}
                    </code>
                    <span className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Copy aria-hidden="true" />}
                        onClick={() => void navigator.clipboard.writeText(config.secreto).then(() => toast.info('Clave copiada'))}
                      >
                        Copiar clave
                      </Button>
                      <a href={config.uri} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        <Smartphone className="size-4" aria-hidden="true" /> Abrir en la app (desde el celular)
                      </a>
                    </span>
                  </li>
                  <li>Escribí el código que te muestra la app.</li>
                </ol>
                {campoCodigo}
              </>
            )}
            <Button type="submit" size="lg" loading={enviando}>
              {paso === 'clave' ? 'Continuar' : paso === 'codigo' ? 'Ingresar' : 'Activar e ingresar'}
            </Button>
            {paso !== 'clave' && (
              <Button type="button" variant="ghost" onClick={() => { setPaso('clave'); setCodigo(''); setError(undefined); }}>
                Volver
              </Button>
            )}
          </form>
        </CardBody>
      </Card>
    </main>
  );
}

// ------------------------------------------------------------------ panel

type Pestana = 'talleres' | 'cuentas' | 'bitacora';
interface PanelProps { cuenta: CuentaPlataforma; onSalir: () => void; sesionPerdida: (e: unknown) => boolean }

function Panel({ cuenta, onSalir, sesionPerdida }: PanelProps) {
  const [pestana, setPestana] = useState<Pestana>('talleres');
  const esAdmin = cuenta.rol === 'ADMINISTRADOR';
  /** Cualquier error: si la sesión terminó vuelve al ingreso; si no, se muestra. */
  const fallo = useCallback((e: unknown) => { if (!sesionPerdida(e)) notifyError(e); }, [sesionPerdida]);

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex items-center gap-2 font-bold">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" /> Plataforma
          </span>
          <span className="ml-auto flex items-center gap-2 text-sm">
            <span className="max-sm:hidden">{cuenta.nombre}</span>
            <Badge tone={esAdmin ? 'violet' : 'blue'}>{ROL[cuenta.rol]}</Badge>
          </span>
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<LogOut aria-hidden="true" />}
            onClick={() => void plataforma.salir().catch(() => undefined).then(onSalir)}
          >
            Salir
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Tabs
          label="Secciones de la plataforma"
          value={pestana}
          onChange={setPestana}
          tabs={[
            { id: 'talleres', label: 'Talleres', icon: <Building2 aria-hidden="true" /> },
            ...(esAdmin
              ? [
                  { id: 'cuentas' as const, label: 'Cuentas de plataforma', icon: <UserCog aria-hidden="true" /> },
                  { id: 'bitacora' as const, label: 'Bitácora', icon: <ScrollText aria-hidden="true" /> },
                ]
              : []),
          ]}
        >
          <div className="pt-4">
            {pestana === 'talleres' && <TalleresTab esAdmin={esAdmin} fallo={fallo} />}
            {pestana === 'cuentas' && esAdmin && <CuentasTab yo={cuenta.id} fallo={fallo} />}
            {pestana === 'bitacora' && esAdmin && <BitacoraTab fallo={fallo} />}
          </div>
        </Tabs>
      </main>
    </>
  );
}

/** Carga con reintento. `fallo` decide si la sesión terminó. */
function useCarga<T>(cargar: () => Promise<T>, fallo: (e: unknown) => void) {
  const [datos, setDatos] = useState<T>();
  const [error, setError] = useState<string>();
  const recargar = useCallback(() => {
    setError(undefined);
    cargar().then(setDatos, (e: unknown) => {
      fallo(e);
      setError(errorMessage(e));
    });
  }, [cargar, fallo]);
  useEffect(recargar, [recargar]);
  return { datos, error, recargar };
}

// ------------------------------------------------------------------ talleres

function TalleresTab({ esAdmin, fallo }: { esAdmin: boolean; fallo: (e: unknown) => void }) {
  const { datos, error, recargar } = useCarga(plataforma.talleres, fallo);
  const [filtro, setFiltro] = useState('');
  const [personasDe, setPersonasDe] = useState<TallerResumen | null>(null);
  const [suspender, setSuspender] = useState<TallerResumen | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (error && !datos) return <ErrorState message={error} onRetry={recargar} />;
  if (!datos) return <LoadingState />;
  const lista = datos.filter((t) => t.nombre.toLowerCase().includes(filtro.trim().toLowerCase()));

  async function confirmarSuspension() {
    if (!suspender) return;
    setOcupado(true);
    try {
      await plataforma.suspenderTaller(suspender.id, motivo);
      toast.success(`«${suspender.nombre}» suspendido`, { description: 'Su gente ya no puede usar el sistema.' });
      setSuspender(null);
      recargar();
    } catch (e) {
      fallo(e);
    } finally {
      setOcupado(false);
    }
  }

  async function reactivar(t: TallerResumen) {
    try {
      await plataforma.reactivarTaller(t.id);
      toast.success(`«${t.nombre}» reactivado`);
      recargar();
    } catch (e) {
      fallo(e);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Talleres"
        description={`${datos.length} en total · ${datos.filter((t) => t.suspendido).length} suspendidos. No se muestran órdenes ni datos de clientes.`}
        icon={<Building2 aria-hidden="true" />}
      />
      <div className="border-b border-border p-3">
        <Input id="pf-filtro" label="Buscar taller" hideLabel type="search" placeholder="Buscar por nombre" maxLength={40} value={filtro} onChange={(e) => setFiltro(e.target.value)} wrapperClassName="sm:max-w-xs" />
      </div>
      {lista.length === 0 ? (
        <EmptyState compact title="No hay talleres que coincidan" />
      ) : (
        <Table caption="Talleres registrados">
          <THead>
            <Tr>
              <Th>Taller</Th>
              <Th>Alta</Th>
              <Th className="text-right">Personas</Th>
              <Th className="text-right">Órdenes</Th>
              <Th>Última actividad</Th>
              <Th>Estado</Th>
              <Th><span className="sr-only">Acciones</span></Th>
            </Tr>
          </THead>
          <TBody>
            {lista.map((t) => (
              <Tr key={t.id}>
                <Td>
                  <span className="font-medium">{t.nombre}</span>
                  <span className="block text-xs text-muted">#{t.id}{t.configurado ? '' : ' · sin configurar'}</span>
                </Td>
                <Td>{formatDate(t.creadoEn)}</Td>
                <Td className="text-right tabular-nums">{t.personas}</Td>
                <Td className="text-right tabular-nums">{t.ordenes}</Td>
                <Td>{formatRelative(t.ultimaActividad)}</Td>
                <Td>
                  {t.suspendido ? (
                    <Badge tone="red" title={t.motivoSuspension ?? undefined}>Suspendido</Badge>
                  ) : (
                    <Badge tone="green">Activo</Badge>
                  )}
                </Td>
                <Td>
                  <span className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" leftIcon={<Users aria-hidden="true" />} onClick={() => setPersonasDe(t)}>
                      Personas
                    </Button>
                    {t.suspendido ? (
                      <Button size="sm" variant="outline" leftIcon={<Play aria-hidden="true" />} onClick={() => void reactivar(t)}>
                        Reactivar
                      </Button>
                    ) : (
                      <Button size="sm" variant="danger" leftIcon={<Ban aria-hidden="true" />} onClick={() => { setMotivo(''); setSuspender(t); }}>
                        Suspender
                      </Button>
                    )}
                  </span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={suspender !== null}
        onClose={() => setSuspender(null)}
        busy={ocupado}
        title={`Suspender «${suspender?.nombre ?? ''}»`}
        description="Nadie del taller va a poder ingresar ni seguir trabajando hasta que lo reactiven. Los datos no se borran."
        icon={<Ban className="text-danger" aria-hidden="true" />}
        footer={
          <>
            <Button variant="outline" onClick={() => setSuspender(null)} disabled={ocupado}>Cancelar</Button>
            <Button variant="danger" loading={ocupado} onClick={() => void confirmarSuspension()}>Suspender</Button>
          </>
        }
      >
        <Textarea id="pf-motivo" label="Motivo" required rows={3} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} hint="Queda en la bitácora. Mínimo 10 caracteres." />
      </Modal>

      {personasDe && <PersonasModal taller={personasDe} esAdmin={esAdmin} fallo={fallo} onClose={() => setPersonasDe(null)} />}
    </Card>
  );
}

function PersonasModal({ taller, esAdmin, fallo, onClose }: { taller: TallerResumen; esAdmin: boolean; fallo: (e: unknown) => void; onClose: () => void }) {
  const cargar = useCallback(() => plataforma.personas(taller.id), [taller.id]);
  const { datos, error, recargar } = useCarga(cargar, fallo);
  const [claveDe, setClaveDe] = useState<PersonaDeTaller | null>(null);
  const [clave, setClave] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function cambiarActivo(p: PersonaDeTaller) {
    try {
      await plataforma.activoPersona(p.id, !p.activo);
      toast.success(p.activo ? `${p.nombre}: cuenta suspendida` : `${p.nombre}: cuenta reactivada`);
      recargar();
    } catch (e) {
      fallo(e);
    }
  }

  async function guardarClave(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!claveDe) return;
    setOcupado(true);
    try {
      await plataforma.claveNueva(claveDe.id, clave);
      toast.success(`Contraseña de ${claveDe.nombre} cambiada`, { description: 'Pasásela por un medio seguro. Sus sesiones abiertas se cerraron.' });
      setClaveDe(null);
      setClave('');
    } catch (err) {
      fallo(err);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={`Personas de «${taller.nombre}»`} icon={<Users aria-hidden="true" />}
      description={esAdmin ? 'Podés suspender cuentas o darles una contraseña nueva a quien la perdió.' : 'Podés suspender una cuenta que esté abusando del sistema.'}>
      {error && !datos ? (
        <ErrorState message={error} onRetry={recargar} />
      ) : !datos ? (
        <LoadingState />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {datos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.nombre}</p>
                <p className="truncate text-xs text-muted">{[p.email, rolesLabel(p.roles)].filter(Boolean).join(' · ')}</p>
              </div>
              {!p.activo && <Badge tone="red">Suspendida</Badge>}
              {esAdmin && (
                <Button size="sm" variant="ghost" leftIcon={<KeyRound aria-hidden="true" />} onClick={() => { setClave(''); setClaveDe(p); }}>
                  Contraseña nueva
                </Button>
              )}
              <Button size="sm" variant={p.activo ? 'outline' : 'secondary'} onClick={() => void cambiarActivo(p)}>
                {p.activo ? 'Suspender' : 'Reactivar'}
              </Button>
              {claveDe?.id === p.id && (
                <form onSubmit={guardarClave} className="flex w-full flex-wrap items-end gap-2 pt-1">
                  <Input id="pf-clave-nueva" label={`Contraseña nueva para ${p.nombre}`} type="password" autoComplete="new-password" autoFocus required
                    value={clave} onChange={(e) => setClave(e.target.value)} wrapperClassName="min-w-48 flex-1" hint="De 8 a 40 caracteres, con letras y números." />
                  <Button type="submit" loading={ocupado}>Guardar</Button>
                  <Button type="button" variant="ghost" onClick={() => setClaveDe(null)}>Cancelar</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ cuentas (solo Administrador)

function CuentasTab({ yo, fallo }: { yo: string; fallo: (e: unknown) => void }) {
  const { datos, error, recargar } = useCarga(plataforma.cuentas, fallo);
  const [nuevo, setNuevo] = useState({ nombre: '', email: '', password: '' });
  const [ocupado, setOcupado] = useState(false);

  async function crear(e: { preventDefault(): void }) {
    e.preventDefault();
    setOcupado(true);
    try {
      await plataforma.crearModerador({ ...nuevo, email: nuevo.email.trim() });
      toast.success(`${nuevo.nombre} ya es moderador`, { description: 'Al ingresar va a tener que configurar su segundo factor.' });
      setNuevo({ nombre: '', email: '', password: '' });
      recargar();
    } catch (err) {
      fallo(err);
    } finally {
      setOcupado(false);
    }
  }

  async function cambiarActivo(c: CuentaListada) {
    try {
      await plataforma.activoCuenta(c.id, !c.activo);
      toast.success(c.activo ? `${c.nombre}: suspendido` : `${c.nombre}: reactivado`);
      recargar();
    } catch (e) {
      fallo(e);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader title="Cuentas de plataforma" icon={<UserCog aria-hidden="true" />} description="Otro Administrador solo se puede definir desde el servidor." />
        {error && !datos ? (
          <ErrorState message={error} onRetry={recargar} />
        ) : !datos ? (
          <LoadingState />
        ) : (
          <ul className="divide-y divide-border">
            {datos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{c.nombre}{c.id === yo && <span className="text-muted"> (vos)</span>}</p>
                  <p className="truncate text-xs text-muted">{c.email} · desde {formatDate(c.creadoEn)}</p>
                </div>
                <Badge tone={c.rol === 'ADMINISTRADOR' ? 'violet' : 'blue'}>{ROL[c.rol]}</Badge>
                <Badge tone={c.segundoFactor ? 'green' : 'amber'}>{c.segundoFactor ? 'Segundo factor activo' : 'Falta segundo factor'}</Badge>
                {!c.activo && <Badge tone="red">Suspendido</Badge>}
                {c.rol === 'MODERADOR' && (
                  <Button size="sm" variant={c.activo ? 'outline' : 'secondary'} onClick={() => void cambiarActivo(c)}>
                    {c.activo ? 'Suspender' : 'Reactivar'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Nuevo moderador" icon={<UserPlus aria-hidden="true" />} />
        <CardBody>
          <form onSubmit={crear} className="flex flex-col gap-3">
            <Input id="pf-mod-nombre" label="Nombre" required maxLength={40} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            <Input id="pf-mod-email" label="Email" type="email" required value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
            <Input id="pf-mod-clave" label="Contraseña inicial" type="password" autoComplete="new-password" required value={nuevo.password}
              onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} hint="De 12 a 40 caracteres, con letras y números. Pasásela por un medio seguro." />
            <Button type="submit" loading={ocupado} leftIcon={<UserPlus aria-hidden="true" />}>Crear moderador</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ bitácora (solo Administrador)

const ACCION: Record<string, string> = {
  'cuenta.creada_al_arrancar': 'Administrador creado desde el servidor',
  ingreso: 'Ingresó',
  'ingreso.fallido': 'Ingreso fallido',
  salida: 'Salió',
  'segundo_factor.activado': 'Activó el segundo factor',
  'segundo_factor.fallido': 'Código incorrecto al activar el segundo factor',
  'taller.suspendido': 'Suspendió un taller',
  'taller.reactivado': 'Reactivó un taller',
  'persona.suspendida': 'Suspendió una cuenta de taller',
  'persona.reactivada': 'Reactivó una cuenta de taller',
  'persona.clave_reseteada': 'Le dio una contraseña nueva a una persona',
  'cuenta.moderador_creado': 'Creó un moderador',
  'cuenta.moderador_suspendido': 'Suspendió un moderador',
  'cuenta.moderador_reactivado': 'Reactivó un moderador',
};

function BitacoraTab({ fallo }: { fallo: (e: unknown) => void }) {
  const { datos, error, recargar } = useCarga(plataforma.bitacora, fallo);
  if (error && !datos) return <ErrorState message={error} onRetry={recargar} />;
  if (!datos) return <LoadingState />;
  return (
    <Card>
      <CardHeader title="Bitácora" icon={<ScrollText aria-hidden="true" />} description="Las últimas 300 acciones. Nadie puede modificarlas ni borrarlas." />
      {datos.length === 0 ? (
        <EmptyState compact title="Todavía no hay acciones" />
      ) : (
        <Table caption="Acciones de la plataforma">
          <THead>
            <Tr><Th>Fecha</Th><Th>Quién</Th><Th>Acción</Th><Th>Taller</Th><Th>Detalle</Th><Th>IP</Th></Tr>
          </THead>
          <TBody>
            {datos.map((a: Accion) => (
              <Tr key={a.id}>
                <Td className="whitespace-nowrap">{formatDateTime(a.fecha)}</Td>
                <Td>{a.cuenta ? `${a.cuenta.nombre} (${ROL[a.cuenta.rol]})` : 'Sistema'}</Td>
                <Td>{ACCION[a.accion] ?? a.accion}</Td>
                <Td>{a.tallerId ? `#${a.tallerId}` : '—'}</Td>
                <Td className="max-w-xs break-words">{a.detalle ?? '—'}</Td>
                <Td className="font-mono text-xs">{a.ip ?? '—'}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
