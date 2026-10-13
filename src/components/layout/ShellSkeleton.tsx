/**
 * Esqueleto con la misma estructura que AppShell (barra de título, menú, barra superior,
 * contenido y barra de estado). Lo usan el HTML inicial (ShellFallback.astro) y la espera
 * de sesión, así la pantalla no «salta» entre dos cargas distintas.
 */
const NAV_ROWS = 5;

export function ShellSkeleton({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col classic:h-dvh classic:overflow-hidden">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true" className="contents">
        <div className="ui-titlebar hidden h-7 shrink-0 classic:flex" />
        <div className="flex min-h-0 flex-1">
          <div className="ui-sidebar hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-surface px-3 py-4 lg:flex classic:gap-1 classic:px-2 classic:py-2">
            <div className="mb-5 h-10 rounded-md classic:hidden" />
            <div className="mb-1.5 hidden h-4 classic:block" />
            {Array.from({ length: NAV_ROWS }, (_, i) => (
              <div key={i} className="ui-navitem h-10 rounded-md bg-surface-2/60" />
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="ui-toolbar h-16 shrink-0 border-b border-border bg-surface/90 classic:h-12" />
            <div className="space-y-4 px-4 py-6 md:px-6 classic:py-4">
              <div className="h-7 w-48 animate-pulse rounded-md bg-surface-3" />
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="h-24 animate-pulse rounded-lg bg-surface-3" />
                <div className="h-24 animate-pulse rounded-lg bg-surface-3" />
                <div className="h-24 animate-pulse rounded-lg bg-surface-3" />
              </div>
            </div>
          </div>
        </div>
        <div className="hidden h-6 shrink-0 border-t border-border bg-surface classic:block" />
      </div>
    </div>
  );
}
