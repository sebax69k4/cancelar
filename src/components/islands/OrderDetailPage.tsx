import { useState, type ReactNode } from 'react';
import {
  AlarmClock, ArrowLeft, ArrowRightLeft, ArrowUpCircle, BadgeCheck, CalendarClock, CircleCheckBig,
  ClipboardList, FileSearch, History, Laptop, Lock, LockOpen, Mail, Phone, RotateCcw, UserRound, Wrench,
} from 'lucide-react';
import { AlertFlags } from '@/components/domain/AlertFlags';
import { PriorityBadge } from '@/components/domain/PriorityBadge';
import { StatusBadge } from '@/components/domain/StatusBadge';
import { TIPO_EQUIPO_ICON } from '@/components/domain/equipment/meta';
import { AssignmentCard } from '@/components/domain/order/AssignmentCard';
import { CloseChecklist } from '@/components/domain/order/CloseChecklist';
import { EditableText } from '@/components/domain/order/EditableText';
import { EvidenceUploader } from '@/components/domain/order/EvidenceUploader';
import { Timeline } from '@/components/domain/order/Timeline';
import { ChangeStatusModal } from '@/components/domain/order/modals/ChangeStatusModal';
import { CloseOrderModal } from '@/components/domain/order/modals/CloseOrderModal';
import { ReasonModal } from '@/components/domain/order/modals/ReasonModal';
import { ReopenModal } from '@/components/domain/order/modals/ReopenModal';
import { AppShell } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { Tabs } from '@/components/ui/Tabs';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOrder, useOrderActions } from '@/hooks/useOrder';
import { apiClient } from '@/lib/api/apiClient';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { can } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';
import { ESTADO_LABEL, TIPO_EQUIPO_LABEL } from '@/lib/domain/labels';
import { formatDate, formatDateTime, formatHours, formatMoney } from '@/lib/format';
import { notifyError } from '@/lib/notify';
import { toast } from '@/lib/toast';
import {
  MIN_COMENTARIO, MIN_MOTIVO, canActOnOrder, canValidate, closeChecklist, isAssignedTo,
} from '@/lib/workflow/transitions';
import type { OrdenResumen } from '@/types/domain';

type TabId = 'detalle' | 'historial' | 'solucion';
type ModalId = 'estado' | 'bloquear' | 'desbloquear' | 'escalar' | 'reabrir' | 'cerrar' | 'validar' | null;

function initialTab(): TabId {
  const h = window.location.hash.replace('#', '');
  return h === 'historial' || h === 'solucion' ? h : 'detalle';
}

function Banner({ tone, icon, title, children, action }: {
  tone: 'rose' | 'orange' | 'red' | 'amber'; icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode;
}) {
  const tones = {
    rose: 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-100',
    orange: 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-100',
    red: 'border-red-300 bg-red-50 text-red-900 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100',
    amber: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100',
  } as const;
  return (
    <div role="status" className={cn('flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3', tones[tone])}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-5" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 opacity-90">{children}</div>}
      </div>
      {action}
    </div>
  );
}

function SummaryRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-subtle [&_svg]:size-4" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="mt-0.5 text-sm">{children}</dd>
      </div>
    </div>
  );
}

function lastEntry(order: OrdenResumen, tipo: 'BLOQUEO' | 'ESCALADO') {
  return [...order.historial].reverse().find((h) => h.tipo === tipo);
}

function Detail({ id }: { id: string }) {
  const user = useCurrentUser();
  const query = useOrder(id);
  const actions = useOrderActions(id);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [modal, setModal] = useState<ModalId>(null);

  if (query.isPending) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-24" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const status = isApiError(query.error) ? query.error.status : 0;
    return (
      <Card>
        <ErrorState
          title={status === 404 ? 'Orden no encontrada' : status === 403 ? 'No tenés acceso a esta orden' : 'No se pudo cargar la orden'}
          message={status === 404 ? 'Puede que la demo se haya reiniciado o el enlace sea incorrecto.' : errorMessage(query.error)}
          onRetry={status >= 500 || status === 0 ? () => void query.refetch() : undefined}
        />
        <div className="flex justify-center pb-8">
          <LinkButton href="/ordenes" variant="outline" leftIcon={<ArrowLeft aria-hidden="true" />}>Volver al tablero</LinkButton>
        </div>
      </Card>
    );
  }

  const order = query.data;
  if (!user) return null;

  const closed = order.estado === 'CERRADO';
  const canEdit = !closed && canActOnOrder(user, order, 'edit');
  const canMove =
    !closed &&
    (can(user.rol, 'order.transition') ||
      (can(user.rol, 'order.transition.own') && isAssignedTo(order, user)) ||
      (can(user.rol, 'order.transition.reception') && order.estado === 'RECIBIDO'));
  const showBlock = !closed && !order.bloqueada && canActOnOrder(user, order, 'block');
  const showUnblock = order.bloqueada && can(user.rol, 'order.unblock');
  const showEscalate = !closed && !order.escalada && canActOnOrder(user, order, 'escalate');
  const showReopen = closed && can(user.rol, 'order.reopen');
  const showClose = order.estado === 'LISTO_PARA_RETIRAR' && can(user.rol, 'order.close');
  const validateRule = canValidate(order, user);
  const pendingClose = closeChecklist(order).filter((i) => !i.done).length;
  const blockEntry = lastEntry(order, 'BLOQUEO');
  const escEntry = lastEntry(order, 'ESCALADO');
  const EquipoIcon = TIPO_EQUIPO_ICON[order.equipo.tipo];

  /** Ejecuta una mutación con toast de éxito/error y cierra el modal. */
  function run<T>(promise: Promise<T>, success: string) {
    return promise.then(
      (r) => {
        toast.success(success);
        setModal(null);
        return r;
      },
      (e: unknown) => {
        notifyError(e);
        throw e;
      },
    );
  }

  return (
    <>
      <a href="/ordenes" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden="true" /> Tablero de órdenes
      </a>

      {/* Encabezado */}
      <header
        className={cn(
          'ui-panel ui-accent mb-4 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-l-4 bg-surface p-4 shadow-card',
          order.criticaVencida ? 'border-red-300 border-l-red-600 dark:border-red-500/40' : 'border-border',
          !order.criticaVencida && order.prioridad === 'CRITICA' && 'border-l-red-600',
          order.prioridad === 'ALTA' && 'border-l-amber-500',
          order.prioridad === 'MEDIA' && 'border-l-blue-600',
          order.prioridad === 'BAJA' && 'border-l-teal-600',
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-bold tracking-tight">{order.numero}</h1>
            <StatusBadge estado={order.estado} />
            <PriorityBadge prioridad={order.prioridad} />
            {order.validada && (
              <Badge tone="green" icon={<BadgeCheck aria-hidden="true" />}>Validada</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {order.cliente.nombre} · {order.equipo.marca} {order.equipo.modelo} ·{' '}
            {closed ? `cerrada en ${formatHours(order.horasAbierta)}` : `abierta hace ${formatHours(order.horasAbierta)}`}
          </p>
          <AlertFlags
            className="mt-2"
            size="md"
            criticaVencida={order.criticaVencida}
            horasAbierta={order.horasAbierta}
            bloqueada={order.bloqueada}
            escalada={order.escalada}
            atrasada={order.atrasada}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canMove && (
            <Button leftIcon={<ArrowRightLeft aria-hidden="true" />} onClick={() => setModal('estado')}>
              Cambiar estado
            </Button>
          )}
          {showClose && (
            <Button variant={pendingClose ? 'outline' : 'primary'} leftIcon={<CircleCheckBig aria-hidden="true" />} onClick={() => setModal('cerrar')}>
              Cerrar orden
            </Button>
          )}
          {showReopen && (
            <Button leftIcon={<RotateCcw aria-hidden="true" />} onClick={() => setModal('reabrir')}>
              Reabrir
            </Button>
          )}
          {showBlock && (
            <Button variant="outline" leftIcon={<Lock aria-hidden="true" />} onClick={() => setModal('bloquear')}>
              Bloquear
            </Button>
          )}
          {showUnblock && (
            <Button variant="outline" leftIcon={<LockOpen aria-hidden="true" />} onClick={() => setModal('desbloquear')}>
              Desbloquear
            </Button>
          )}
          {showEscalate && (
            <Button variant="outline" leftIcon={<ArrowUpCircle aria-hidden="true" />} onClick={() => setModal('escalar')}>
              Escalar
            </Button>
          )}
        </div>
      </header>

      {/* Avisos */}
      <div className="mb-6 flex flex-col gap-3 empty:hidden">
        {order.criticaVencida && (
          <Banner tone="red" icon={<AlarmClock />} title={`Orden crítica abierta hace ${formatHours(order.horasAbierta)}`}>
            Supera las 24 h. Priorizala o escalala si no puede resolverse.
          </Banner>
        )}
        {order.bloqueada && (
          <Banner
            tone="rose"
            icon={<Lock />}
            title={blockEntry ? `Bloqueada por ${blockEntry.usuario.nombre} · ${formatDateTime(blockEntry.fecha)}` : 'Orden bloqueada'}
            action={
              showUnblock && (
                <Button size="sm" variant="outline" leftIcon={<LockOpen aria-hidden="true" />} onClick={() => setModal('desbloquear')}>
                  Desbloquear
                </Button>
              )
            }
          >
            Motivo: «{order.motivoBloqueo}». No puede cambiar de estado hasta que se desbloquee.
          </Banner>
        )}
        {order.escalada && (
          <Banner
            tone="orange"
            icon={<ArrowUpCircle />}
            title={escEntry ? `Escalada por ${escEntry.usuario.nombre} · ${formatDateTime(escEntry.fecha)}` : 'Orden escalada'}
          >
            Motivo: «{order.motivoEscalado}»
          </Banner>
        )}
        {order.atrasada && (
          <Banner tone="amber" icon={<CalendarClock />} title="Orden atrasada">
            La entrega estimada era el {formatDate(order.fechaEstimada)}.
          </Banner>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Pestañas */}
        <Card className="min-w-0 p-4">
          <Tabs
            label="Secciones de la orden"
            value={tab}
            onChange={(t) => {
              setTab(t);
              window.history.replaceState(null, '', `#${t}`);
            }}
            tabs={[
              { id: 'detalle', label: 'Detalle', icon: <ClipboardList aria-hidden="true" /> },
              {
                id: 'historial',
                label: 'Historial',
                icon: <History aria-hidden="true" />,
                badge: <span className="rounded-full bg-surface-3 px-1.5 text-[11px] text-muted tabular-nums">{order.historial.length}</span>,
              },
              {
                id: 'solucion',
                label: 'Solución y evidencia',
                icon: <Wrench aria-hidden="true" />,
                badge:
                  !closed && pendingClose > 0 ? (
                    <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
                      {pendingClose}
                      <span className="sr-only"> requisitos pendientes</span>
                    </span>
                  ) : undefined,
              },
            ]}
          >
            {tab === 'detalle' && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-semibold">Falla reportada</h3>
                  <p className="rounded-md bg-surface-2 px-3 py-2 text-sm whitespace-pre-line">{order.fallaReportada}</p>
                </div>
                <EditableText
                  id="det-diag"
                  label="Diagnóstico"
                  value={order.diagnostico}
                  emptyText="Sin diagnóstico. Es obligatorio para pasar a «En reparación»."
                  placeholder="Ej.: Chip de video BGA dañado. Se requiere reballing o reemplazo de placa."
                  canEdit={canEdit}
                  busy={actions.update.isPending}
                  onSave={(v) => run(actions.update.mutateAsync({ input: { diagnostico: v } }), 'Diagnóstico guardado')}
                />
                <div className="rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium">Servicio:</span> {order.servicio.nombre}{' '}
                  <span className="text-muted">· precio base {formatMoney(order.servicio.precioBase)}</span>
                </div>
              </div>
            )}

            {tab === 'historial' && <Timeline items={order.historial} />}

            {tab === 'solucion' && (
              <div className="flex flex-col gap-6">
                <EditableText
                  id="det-sol"
                  label="Solución"
                  value={order.solucion}
                  emptyText="Sin solución documentada. Es obligatoria para «Listo para retirar» y para cerrar."
                  placeholder="Qué se hizo, qué repuestos se usaron y cómo se probó."
                  hint={order.validada ? 'Si cambiás la solución, se pierde la validación del supervisor.' : undefined}
                  canEdit={canEdit}
                  minLength={MIN_MOTIVO}
                  busy={actions.update.isPending}
                  onSave={(v) => run(actions.update.mutateAsync({ input: { solucion: v } }), 'Solución guardada')}
                />
                <section aria-labelledby="ev-title" className="flex flex-col gap-2">
                  <h3 id="ev-title" className="text-sm font-semibold">Evidencia</h3>
                  <EvidenceUploader
                    evidencias={order.evidencias}
                    canEdit={canEdit}
                    busy={actions.addEvidence.isPending}
                    onAdd={(f) => actions.addEvidence.mutateAsync(f)}
                    onRemove={(evId) => actions.removeEvidence.mutateAsync(evId)}
                    fileUrl={(evId) => apiClient.evidenceFileUrl(order.id, evId)}
                  />
                </section>
                <section aria-labelledby="cl-title" className="flex flex-col gap-2">
                  <h3 id="cl-title" className="text-sm font-semibold">Checklist de cierre</h3>
                  <CloseChecklist
                    order={order}
                    actions={{
                      validada: can(user.rol, 'order.validate') ? (
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<BadgeCheck aria-hidden="true" />}
                          disabled={!validateRule.ok}
                          title={validateRule.ok ? undefined : validateRule.missing.join('. ')}
                          onClick={() => setModal('validar')}
                        >
                          Validar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">La valida un supervisor</span>
                      ),
                    }}
                  />
                  {!validateRule.ok && can(user.rol, 'order.validate') && !order.validada && !closed && (
                    <p className="text-xs text-muted">Para validar: {validateRule.missing.join('. ').toLowerCase()}.</p>
                  )}
                  {showClose && (
                    <div>
                      <Button leftIcon={<CircleCheckBig aria-hidden="true" />} onClick={() => setModal('cerrar')}>
                        Cerrar orden
                      </Button>
                    </div>
                  )}
                  {!closed && order.estado !== 'LISTO_PARA_RETIRAR' && (
                    <p className="text-xs text-muted">
                      El cierre se habilita cuando la orden está en «{ESTADO_LABEL.LISTO_PARA_RETIRAR}».
                    </p>
                  )}
                </section>
              </div>
            )}
          </Tabs>
        </Card>

        {/* Lateral */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader as="h3" icon={<FileSearch aria-hidden="true" />} title="Resumen" />
            <dl className="flex flex-col gap-3 p-4">
              <SummaryRow icon={<UserRound />} label="Cliente">
                <p className="font-semibold">{order.cliente.nombre}</p>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Phone className="size-3" aria-hidden="true" />
                  <a href={`tel:${order.cliente.telefono.replace(/[^\d+]/g, '')}`} className="hover:underline">{order.cliente.telefono}</a>
                </p>
                {order.cliente.email && (
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <Mail className="size-3" aria-hidden="true" />
                    {order.cliente.email}
                  </p>
                )}
              </SummaryRow>
              <SummaryRow icon={<EquipoIcon />} label="Equipo">
                <p className="font-semibold">{order.equipo.marca} {order.equipo.modelo}</p>
                <p className="text-xs text-muted">
                  {TIPO_EQUIPO_LABEL[order.equipo.tipo]} · <span className="font-mono">SN {order.equipo.numeroSerie}</span>
                </p>
                {order.equipo.notas && <p className="mt-0.5 text-xs text-muted">{order.equipo.notas}</p>}
              </SummaryRow>
              <SummaryRow icon={<CalendarClock />} label="Fechas">
                <p>Ingreso: {formatDateTime(order.fechaIngreso)}</p>
                <p className={cn(order.atrasada && 'font-semibold text-warning')}>Estimada: {formatDate(order.fechaEstimada)}</p>
                {order.fechaCierre && <p>Cierre: {formatDateTime(order.fechaCierre)}</p>}
              </SummaryRow>
              <SummaryRow icon={<Laptop />} label="Historial del equipo">
                <a href={`/equipos?cliente=${order.clienteId}`} className="text-primary hover:underline">Ver equipos del cliente</a>
              </SummaryRow>
            </dl>
          </Card>
          <AssignmentCard
            key={`${order.responsableId}-${order.tecnicoId}-${order.prioridad}`}
            order={order}
            canAssign={can(user.rol, 'order.assign')}
            canReprioritize={can(user.rol, 'order.edit')}
            busy={actions.update.isPending}
            onSave={(input) => run(actions.update.mutateAsync({ input }), 'Asignación actualizada')}
          />
        </div>
      </div>

      {/* Modales */}
      <ChangeStatusModal order={modal === 'estado' ? order : null} onClose={() => setModal(null)} />
      <ReasonModal
        open={modal === 'bloquear'}
        onClose={() => setModal(null)}
        busy={actions.block.isPending}
        title={`Bloquear ${order.numero}`}
        description="La orden no podrá cambiar de estado hasta que un supervisor la desbloquee."
        icon={<Lock className="text-danger" aria-hidden="true" />}
        label="Motivo del bloqueo"
        placeholder="Ej.: Esperando repuesto: pantalla 15.6″ 30 pines."
        minLength={MIN_MOTIVO}
        confirmLabel="Bloquear"
        confirmVariant="danger"
        onConfirm={(t) => void run(actions.block.mutateAsync(t), `${order.numero} bloqueada`).catch(() => undefined)}
      />
      <ReasonModal
        open={modal === 'desbloquear'}
        onClose={() => setModal(null)}
        busy={actions.unblock.isPending}
        title={`Desbloquear ${order.numero}`}
        description={`Motivo del bloqueo: «${order.motivoBloqueo ?? ''}»`}
        icon={<LockOpen className="text-success" aria-hidden="true" />}
        label="Comentario"
        placeholder="Ej.: Llegó el repuesto."
        minLength={MIN_COMENTARIO}
        confirmLabel="Desbloquear"
        onConfirm={(t) => void run(actions.unblock.mutateAsync(t), `${order.numero} desbloqueada`).catch(() => undefined)}
      />
      <ReasonModal
        open={modal === 'escalar'}
        onClose={() => setModal(null)}
        busy={actions.escalate.isPending}
        title={`Escalar ${order.numero}`}
        description="Marca la orden para que la revise un nivel superior. Aparece en Alertas."
        icon={<ArrowUpCircle className="text-warning" aria-hidden="true" />}
        label="Motivo del escalado"
        placeholder="Ej.: Falla intermitente de placa, requiere técnico nivel 2."
        minLength={MIN_MOTIVO}
        confirmLabel="Escalar"
        onConfirm={(t) => void run(actions.escalate.mutateAsync(t), `${order.numero} escalada`).catch(() => undefined)}
      />
      <ReasonModal
        open={modal === 'validar'}
        onClose={() => setModal(null)}
        busy={actions.validate.isPending}
        title={`Validar ${order.numero}`}
        description="Confirmás que revisaste visualmente el equipo reparado y la solución documentada."
        icon={<BadgeCheck className="text-success" aria-hidden="true" />}
        label="Comentario de validación"
        placeholder="Ej.: Revisado: enciende, da video y pasó prueba de estrés 30 min."
        minLength={MIN_COMENTARIO}
        confirmLabel="Validar"
        onConfirm={(t) => void run(actions.validate.mutateAsync(t), `${order.numero} validada`).catch(() => undefined)}
      >
        {order.solucion && (
          <div className="rounded-md bg-surface-2 px-3 py-2 text-sm">
            <p className="text-xs font-semibold text-muted">Solución documentada</p>
            <p className="whitespace-pre-line">{order.solucion}</p>
          </div>
        )}
      </ReasonModal>
      <ReopenModal
        open={modal === 'reabrir'}
        numero={order.numero}
        busy={actions.reopen.isPending}
        onClose={() => setModal(null)}
        onConfirm={(v) => void run(actions.reopen.mutateAsync(v), `${order.numero} reabierta`).catch(() => undefined)}
      />
      <CloseOrderModal
        order={order}
        open={modal === 'cerrar'}
        busy={actions.close.isPending}
        onClose={() => setModal(null)}
        onConfirm={(t) => void run(actions.close.mutateAsync(t), `${order.numero} cerrada`).catch(() => undefined)}
      />
    </>
  );
}

export default function OrderDetailPage({ id }: { id: string }) {
  return (
    <AppShell currentPath="/ordenes" permission="nav.ordenes" title="Orden de servicio" customHeader>
      <Detail id={id} />
    </AppShell>
  );
}
