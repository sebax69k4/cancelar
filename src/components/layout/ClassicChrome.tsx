import { useEffect, useState } from 'react';
import { Cpu } from 'lucide-react';
import { useClockOffset } from '@/hooks/useClock';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isMockApi } from '@/lib/api/apiClient';
import { now } from '@/lib/clock';
import { ROL_LABEL } from '@/lib/domain/labels';

/** Barra de título de la ventana principal (solo estilo clásico). */
export function WindowTitleBar({ title }: { title: string }) {
  return (
    <div className="ui-titlebar hidden h-7 shrink-0 items-center gap-2 px-2 text-xs font-bold select-none classic:flex" aria-hidden="true">
      <Cpu className="size-4" />
      <span className="truncate">ServicioTécnico — Sistema de gestión de reparaciones</span>
      <span className="truncate font-normal opacity-90">[{title}]</span>
    </div>
  );
}

const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

function LiveClock() {
  const offset = useClockOffset();
  const [t, setT] = useState(() => now());
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="ui-status-cell px-2 font-mono tabular-nums" title={offset ? 'Reloj simulado de la demo' : 'Hora actual'}>
      {timeFmt.format(t)}
      {offset > 0 && <span className="text-warning"> (+{offset} h)</span>}
    </span>
  );
}

/** Barra de estado inferior (solo estilo clásico). */
export function StatusBar() {
  const user = useCurrentUser();
  return (
    <footer className="hidden shrink-0 flex-wrap items-center justify-between gap-1 border-t border-border bg-surface p-0.5 text-[11px] select-none classic:flex">
      <div className="flex min-w-0 items-center gap-1">
        <span className="ui-status-cell px-2">Listo.</span>
        {user && (
          <span className="ui-status-cell hidden truncate px-2 sm:inline">
            Usuario: {user.nombre} ({ROL_LABEL[user.rol]})
          </span>
        )}
        <span className="ui-status-cell hidden px-2 md:inline">
          {isMockApi ? 'Datos: este navegador (demo)' : 'Datos: servidor'}
        </span>
      </div>
      <LiveClock />
    </footer>
  );
}
