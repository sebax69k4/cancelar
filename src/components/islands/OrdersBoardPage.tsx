import { useEffect, useMemo, useState } from 'react';
import { FilterX, Plus, Search, SquareKanban } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { KanbanBoard } from '@/components/domain/kanban/KanbanBoard';
import { ChangeStatusModal } from '@/components/domain/order/modals/ChangeStatusModal';
import { AppShell } from '@/components/layout/AppShell';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useUsers } from '@/hooks/useCatalog';
import { useDebounced } from '@/hooks/useDebounced';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useOrders } from '@/hooks/useOrders';
import { errorMessage } from '@/lib/api/errors';
import type { OrderFilters } from '@/lib/api/apiClient';
import { ESTADO_LABEL, PRIORIDAD_LABEL, ROL_LABEL } from '@/lib/domain/labels';
import { ESTADOS, PRIORIDADES, type EstadoOrden, type OrdenResumen, type Prioridad } from '@/types/domain';

function readFilters(): OrderFilters {
  const p = new URLSearchParams(window.location.search);
  const estado = p.get('estado');
  const prioridad = p.get('prioridad');
  return {
    q: p.get('q') ?? undefined,
    estado: estado && (ESTADOS as readonly string[]).includes(estado) ? (estado as EstadoOrden) : undefined,
    prioridad: prioridad && (PRIORIDADES as readonly string[]).includes(prioridad) ? (prioridad as Prioridad) : undefined,
    responsableId: p.get('responsable') ?? undefined,
  };
}

function writeFilters(f: OrderFilters): void {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.estado) p.set('estado', f.estado);
  if (f.prioridad) p.set('prioridad', f.prioridad);
  if (f.responsableId) p.set('responsable', f.responsableId);
  const qs = p.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden="true">
      {ESTADOS.map((e) => (
        <div key={e} className="w-[272px] shrink-0 space-y-2 rounded-lg bg-surface-2/70 p-3 2xl:flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ))}
    </div>
  );
}

function Board() {
  const user = useCurrentUser();
  const users = useUsers();
  const [filters, setFilters] = useState<OrderFilters>(() => readFilters());
  const [moving, setMoving] = useState<{ order: OrdenResumen; to?: EstadoOrden } | null>(null);
  const q = useDebounced(filters.q ?? '', 250);

  const apiFilters = useMemo<OrderFilters>(
    () => ({ ...filters, q: q || undefined, estado: undefined }),
    [filters, q],
  );
  const orders = useOrders(apiFilters);

  useEffect(() => writeFilters(filters), [filters]);

  const set = (patch: Partial<OrderFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const hasFilters = Boolean(filters.q || filters.estado || filters.prioridad || filters.responsableId);
  const columns = filters.estado ? [filters.estado] : ESTADOS;

  return (
    <>
      <Card className="mb-4 p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] md:items-end">
          <Input
            id="f-q"
            label="Buscar"
            type="search"
            leftIcon={<Search aria-hidden="true" />}
            placeholder="Nº de orden, cliente, teléfono o serie"
            value={filters.q ?? ''}
            onChange={(e) => set({ q: e.target.value || undefined })}
          />
          <Select
            id="f-estado"
            label="Estado"
            placeholder="Todos"
            value={filters.estado ?? ''}
            onChange={(e) => set({ estado: (e.target.value || undefined) as EstadoOrden | undefined })}
            options={ESTADOS.map((s) => ({ value: s, label: ESTADO_LABEL[s] }))}
          />
          <Select
            id="f-prioridad"
            label="Prioridad"
            placeholder="Todas"
            value={filters.prioridad ?? ''}
            onChange={(e) => set({ prioridad: (e.target.value || undefined) as Prioridad | undefined })}
            options={[...PRIORIDADES].reverse().map((p) => ({ value: p, label: PRIORIDAD_LABEL[p] }))}
          />
          <Select
            id="f-resp"
            label="Responsable / técnico"
            placeholder="Todos"
            value={filters.responsableId ?? ''}
            onChange={(e) => set({ responsableId: e.target.value || undefined })}
            options={(users.data ?? []).map((u) => ({ value: u.id, label: `${u.nombre} (${ROL_LABEL[u.rol]})` }))}
          />
          <Button
            variant="ghost"
            leftIcon={<FilterX aria-hidden="true" />}
            disabled={!hasFilters}
            onClick={() => setFilters({})}
          >
            Limpiar
          </Button>
        </div>
        {user?.rol === 'TECNICO' && (
          <p className="mt-2 text-xs text-muted">Como Técnico ves solo las órdenes asignadas a vos.</p>
        )}
      </Card>

      <p className="sr-only" aria-live="polite">
        {orders.data ? `${orders.data.length} órdenes encontradas` : ''}
      </p>

      {orders.isPending ? (
        <BoardSkeleton />
      ) : orders.isError ? (
        <Card>
          <ErrorState message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} />
        </Card>
      ) : orders.data.length === 0 && !hasFilters ? (
        <Card>
          <EmptyState
            icon={<SquareKanban aria-hidden="true" />}
            title="Todavía no hay órdenes"
            description={
              user?.rol === 'TECNICO'
                ? 'Cuando te asignen una orden va a aparecer en este tablero.'
                : 'Creá la primera orden de servicio para empezar a usar el tablero.'
            }
            action={
              <PermissionGuard permission="order.create">
                <LinkButton href="/ordenes/nueva" leftIcon={<Plus aria-hidden="true" />}>Nueva orden</LinkButton>
              </PermissionGuard>
            }
          />
        </Card>
      ) : (
        <>
          {orders.data.length === 0 && (
            <p className="mb-3 text-sm text-muted">Ninguna orden coincide con los filtros.</p>
          )}
          <KanbanBoard
            orders={orders.data}
            columns={columns}
            onRequestMove={(order, to) => setMoving({ order, to })}
          />
        </>
      )}

      <ChangeStatusModal
        order={moving?.order ?? null}
        initialTo={moving?.to}
        onClose={() => setMoving(null)}
      />
    </>
  );
}

export default function OrdersBoardPage() {
  return (
    <AppShell
      currentPath="/ordenes"
      permission="nav.ordenes"
      title="Órdenes"
      description="Arrastrá una tarjeta o usá «Mover» para cambiar su estado. Cada cambio pide un comentario."
      actions={
        <PermissionGuard permission="order.create">
          <LinkButton href="/ordenes/nueva" leftIcon={<Plus aria-hidden="true" />}>Nueva orden</LinkButton>
        </PermissionGuard>
      }
    >
      <Board />
    </AppShell>
  );
}
