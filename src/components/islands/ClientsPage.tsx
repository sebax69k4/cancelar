import { useEffect, useMemo, useState } from 'react';
import { ClipboardPlus, Laptop, Mail, Phone, Search, UserPlus, Users } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ClientForm } from '@/components/domain/client/ClientForm';
import { AppShell } from '@/components/layout/AppShell';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { TBody, THead, Table, Td, Th, Tr } from '@/components/ui/Table';
import { useClients } from '@/hooks/useClients';
import { usePermission } from '@/hooks/useCurrentUser';
import { useDebounced } from '@/hooks/useDebounced';
import { useEquipment } from '@/hooks/useEquipment';
import { useOrders } from '@/hooks/useOrders';
import { errorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/format';

function Content({ onNew }: { onNew: () => void }) {
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 250);
  const clients = useClients(debounced);
  const equipment = useEquipment();
  const orders = useOrders();
  const canCreateOrder = usePermission('order.create');

  const counts = useMemo(() => {
    const eq = new Map<string, number>();
    const open = new Map<string, number>();
    for (const e of equipment.data ?? []) eq.set(e.clienteId, (eq.get(e.clienteId) ?? 0) + 1);
    for (const o of orders.data ?? []) if (o.estado !== 'CERRADO') open.set(o.clienteId, (open.get(o.clienteId) ?? 0) + 1);
    return { eq, open };
  }, [equipment.data, orders.data]);

  if (clients.isPending) return <Skeleton className="h-64" />;
  if (clients.isError) {
    return (
      <Card>
        <ErrorState message={errorMessage(clients.error)} onRetry={() => void clients.refetch()} />
      </Card>
    );
  }

  const list = clients.data;
  const isEmpty = list.length === 0 && !debounced;

  if (isEmpty) {
    return (
      <Card>
        <EmptyState
          icon={<Users aria-hidden="true" />}
          title="Todavía no hay clientes"
          description="Registrá el primer cliente para poder cargar sus equipos y órdenes."
          action={
            <PermissionGuard permission="client.create">
              <Button leftIcon={<UserPlus aria-hidden="true" />} onClick={onNew}>Registrar cliente</Button>
            </PermissionGuard>
          }
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <Input
          id="cl-q"
          label="Buscar clientes"
          hideLabel
          type="search"
          wrapperClassName="w-full sm:max-w-sm"
          leftIcon={<Search aria-hidden="true" />}
          placeholder="Nombre, teléfono o email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <p className="text-xs text-muted" aria-live="polite">
          {list.length} {list.length === 1 ? 'cliente' : 'clientes'}
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyState compact title="Sin resultados" description={`Ningún cliente coincide con «${debounced}».`} />
      ) : (
        <>
          <div className="hidden md:block">
            <Table caption="Clientes">
              <THead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>Contacto</Th>
                  <Th className="text-right">Equipos</Th>
                  <Th className="text-right">Órdenes abiertas</Th>
                  <Th>Alta</Th>
                  <Th className="text-right">
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </THead>
              <TBody>
                {list.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <p className="font-semibold">{c.nombre}</p>
                      {c.notas && <p className="line-clamp-1 max-w-xs text-xs text-muted">{c.notas}</p>}
                    </Td>
                    <Td>
                      <p className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-subtle" aria-hidden="true" />
                        <a href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`} className="hover:underline">{c.telefono}</a>
                      </p>
                      {c.email && (
                        <p className="flex items-center gap-1.5 text-xs text-muted">
                          <Mail className="size-3.5" aria-hidden="true" />
                          {c.email}
                        </p>
                      )}
                    </Td>
                    <Td className="text-right tabular-nums">{counts.eq.get(c.id) ?? 0}</Td>
                    <Td className="text-right tabular-nums">{counts.open.get(c.id) ?? 0}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(c.creadoEn)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <LinkButton href={`/equipos?cliente=${c.id}`} variant="ghost" size="sm" leftIcon={<Laptop className="size-3.5" aria-hidden="true" />}>
                          Equipos<span className="sr-only"> de {c.nombre}</span>
                        </LinkButton>
                        {canCreateOrder && (
                          <LinkButton href={`/ordenes/nueva?cliente=${c.id}`} variant="outline" size="sm" leftIcon={<ClipboardPlus className="size-3.5" aria-hidden="true" />}>
                            Nueva orden<span className="sr-only"> para {c.nombre}</span>
                          </LinkButton>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
          <ul className="divide-y divide-border md:hidden">
            {list.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 px-4 py-3">
                <div>
                  <p className="font-semibold">{c.nombre}</p>
                  <p className="text-xs text-muted">
                    {c.telefono}
                    {c.email ? ` · ${c.email}` : ''}
                  </p>
                  <p className="text-xs text-muted">
                    {counts.eq.get(c.id) ?? 0} equipos · {counts.open.get(c.id) ?? 0} órdenes abiertas
                  </p>
                </div>
                <div className="flex gap-2">
                  <LinkButton href={`/equipos?cliente=${c.id}`} variant="outline" size="sm">Equipos</LinkButton>
                  {canCreateOrder && (
                    <LinkButton href={`/ordenes/nueva?cliente=${c.id}`} variant="outline" size="sm">Nueva orden</LinkButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export default function ClientsPage() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('nuevo') === '1') {
      setOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return (
    <AppShell
      currentPath="/clientes"
      permission="nav.clientes"
      title="Clientes"
      description="Personas o empresas que traen equipos al taller."
      actions={
        <PermissionGuard permission="client.create">
          <Button leftIcon={<UserPlus aria-hidden="true" />} onClick={() => setOpen(true)}>
            Nuevo cliente
          </Button>
        </PermissionGuard>
      }
    >
      <Content onNew={() => setOpen(true)} />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar cliente"
        description="Con nombre y teléfono alcanza. El teléfono no puede repetirse."
        icon={<UserPlus className="text-primary" aria-hidden="true" />}
      >
        <ClientForm idPrefix="cl-new" onCancel={() => setOpen(false)} onCreated={() => setOpen(false)} />
      </Modal>
    </AppShell>
  );
}
