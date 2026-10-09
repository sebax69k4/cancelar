import { AlarmClock, ArrowUpCircle, CalendarClock, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { formatHours } from '@/lib/format';

export interface AlertFlagsProps {
  bloqueada?: boolean;
  escalada?: boolean;
  atrasada?: boolean;
  criticaVencida?: boolean;
  horasAbierta?: number;
  size?: 'sm' | 'md';
  className?: string;
}

/** Indicadores de alerta: siempre icono + texto, nunca solo color. */
export function AlertFlags({
  bloqueada, escalada, atrasada, criticaVencida, horasAbierta, size = 'sm', className,
}: AlertFlagsProps) {
  if (!bloqueada && !escalada && !atrasada && !criticaVencida) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {criticaVencida && (
        <Badge tone="red" size={size} icon={<AlarmClock aria-hidden="true" />}>
          <span className="relative mr-0.5 flex size-1.5" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-pulse-dot rounded-full bg-current" />
          </span>
          Crítica {horasAbierta !== undefined ? `· ${formatHours(horasAbierta)}` : '> 24 h'}
        </Badge>
      )}
      {bloqueada && (
        <Badge tone="rose" size={size} icon={<Lock aria-hidden="true" />}>
          Bloqueada
        </Badge>
      )}
      {escalada && (
        <Badge tone="orange" size={size} icon={<ArrowUpCircle aria-hidden="true" />}>
          Escalada
        </Badge>
      )}
      {atrasada && (
        <Badge tone="amber" size={size} icon={<CalendarClock aria-hidden="true" />}>
          Atrasada
        </Badge>
      )}
    </div>
  );
}
