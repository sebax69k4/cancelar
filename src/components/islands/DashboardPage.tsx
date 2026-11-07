import { AlertTriangle, ArrowUpCircle, Flame, Lock, PackageCheck, Plus, Rocket, Wrench } from 'lucide-react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { CriticalList } from '@/components/domain/dashboard/CriticalList';
import { MyWorkPanel } from '@/components/domain/dashboard/MyWorkPanel';
import { MetricCard } from '@/components/domain/dashboard/MetricCard';
import { QuickActions } from '@/components/domain/dashboard/QuickActions';
import { RecentOrders } from '@/components/domain/dashboard/RecentOrders';
import { AppShell } from '@/components/layout/AppShell';
import { LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDashboard } from '@/hooks/useDashboard';
import { can } from '@/lib/auth/permissions';
import { ROL_LABEL } from '@/lib/domain/labels';
import { errorMessage } from '@/lib/api/errors';
import { now } from '@/lib/clock';

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-64" />
    </div>
  );
}

function Content() {
  const user = useCurrentUser();
  const dashboard = useDashboard();

  if (dashboard.isPending) return <DashboardSkeleton />;
  if (dashboard.isError) {
    return (
      <Card>
        <ErrorState message={errorMessage(dashboard.error)} onRetry={() => void dashboard.refetch()} />
      </Card>
    );
  }

  const { metrics, informesCriticos, recientes, totalOrdenes, rolesFaltantes } = dashboard.data;

  if (totalOrdenes === 0) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <EmptyState
            icon={<Rocket aria-hidden="true" />}
            title="El sistema está vacío"
            description={
              user && !can(user.roles, 'order.view.all')
                ? 'Todavía no tenés órdenes asignadas. Cuando recepción te asigne una, va a aparecer acá.'
                : 'Empezá registrando un cliente y su equipo, y creá la primera orden de servicio.'
            }
            action={
              <PermissionGuard permission="order.create">
                <LinkButton href="/ordenes/nueva" leftIcon={<Plus aria-hidden="true" />}>
                  Crear primera orden
                </LinkButton>
              </PermissionGuard>
            }
          />
        </Card>
        <QuickActions />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Métricas" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Activas" value={metrics.activas} icon={Wrench} href="/ordenes" hint={metrics.atrasadas ? `${metrics.atrasadas} atrasadas` : 'En curso'} />
        <MetricCard
          label="Críticas"
          value={metrics.criticas}
          icon={Flame}
          tone="red"
          href="/ordenes?prioridad=CRITICA"
          alert={metrics.criticasVencidas > 0}
          hint={metrics.criticasVencidas ? `${metrics.criticasVencidas} con más de 24 h` : 'Ninguna vencida'}
        />
        <MetricCard label="Bloqueadas" value={metrics.bloqueadas} icon={Lock} tone="rose" href="/alertas#bloqueadas" hint="Esperando desbloqueo" />
        <MetricCard label="Escaladas" value={metrics.escaladas} icon={ArrowUpCircle} tone="orange" href="/alertas#escaladas" hint="Esperan atención" />
        <MetricCard label="Listas para retirar" value={metrics.listas} icon={PackageCheck} tone="green" href="/ordenes?estado=LISTO_PARA_RETIRAR" hint="Avisar al cliente" />
      </section>

      {rolesFaltantes.length > 0 && user && can(user.roles, 'users.manage') && (
        <p role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          Nadie cubre: {rolesFaltantes.map((r) => ROL_LABEL[r]).join(', ')}. Algunas órdenes no van a poder avanzar.
          <a href="/configuracion" className="font-semibold underline">Asignar</a>
        </p>
      )}

      <CriticalList informes={informesCriticos} />

      {user && <MyWorkPanel user={user} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <RecentOrders orders={recientes} nowMs={now()} />
        <QuickActions />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = useCurrentUser();
  return (
    <AppShell
      currentPath="/dashboard"
      permission="nav.dashboard"
      title="Dashboard"
      description={user ? `Hola, ${user.nombre.split(' ')[0]}. Este es el estado del taller.` : undefined}
      actions={
        <PermissionGuard permission="order.create">
          {/* En escritorio ya está fijo en el menú lateral */}
          <LinkButton href="/ordenes/nueva" className="lg:hidden" leftIcon={<Plus aria-hidden="true" />}>
            Nueva orden
          </LinkButton>
        </PermissionGuard>
      }
    >
      <Content />
    </AppShell>
  );
}
