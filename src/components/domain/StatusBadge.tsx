import { Badge } from '@/components/ui/Badge';
import { ESTADO_LABEL } from '@/lib/domain/labels';
import type { EstadoOrden } from '@/types/domain';
import { ESTADO_META } from './meta';

export function StatusBadge({ estado, size }: { estado: EstadoOrden; size?: 'sm' | 'md' }) {
  const { icon: Icon, tone } = ESTADO_META[estado];
  return (
    <Badge tone={tone} size={size} icon={<Icon aria-hidden="true" />}>
      <span className="sr-only">Estado: </span>
      {ESTADO_LABEL[estado]}
    </Badge>
  );
}
