import { Badge } from '@/components/ui/Badge';
import { PRIORIDAD_LABEL } from '@/lib/domain/labels';
import type { Prioridad } from '@/types/domain';
import { PRIORIDAD_META } from './meta';

export function PriorityBadge({ prioridad, size }: { prioridad: Prioridad; size?: 'sm' | 'md' }) {
  const { icon: Icon, tone } = PRIORIDAD_META[prioridad];
  return (
    <Badge tone={tone} size={size} emphasis={prioridad === 'CRITICA'} icon={<Icon aria-hidden="true" />}>
      <span className="sr-only">Prioridad: </span>
      {PRIORIDAD_LABEL[prioridad]}
    </Badge>
  );
}
