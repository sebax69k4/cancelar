import { HardDrive, Laptop, Monitor, PcCase, type LucideIcon } from 'lucide-react';
import type { TipoEquipo } from '@/types/domain';

export const TIPO_EQUIPO_ICON: Record<TipoEquipo, LucideIcon> = {
  NOTEBOOK: Laptop,
  PC_ESCRITORIO: PcCase,
  ALL_IN_ONE: Monitor,
  OTRO: HardDrive,
};
