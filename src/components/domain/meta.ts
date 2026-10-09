import {
  ChevronDown, ChevronUp, CircleCheckBig, Equal, FlaskConical, Flame, Inbox,
  PackageCheck, Stethoscope, Wrench, type LucideIcon,
} from 'lucide-react';
import type { BadgeTone } from '@/components/ui/Badge';
import type { EstadoOrden, Prioridad } from '@/types/domain';

export const ESTADO_META: Record<EstadoOrden, { icon: LucideIcon; tone: BadgeTone; dot: string }> = {
  RECIBIDO: { icon: Inbox, tone: 'slate', dot: 'bg-slate-500' },
  EN_DIAGNOSTICO: { icon: Stethoscope, tone: 'violet', dot: 'bg-violet-600' },
  EN_REPARACION: { icon: Wrench, tone: 'blue', dot: 'bg-blue-700' },
  PRUEBAS: { icon: FlaskConical, tone: 'cyan', dot: 'bg-cyan-700' },
  LISTO_PARA_RETIRAR: { icon: PackageCheck, tone: 'green', dot: 'bg-green-700' },
  CERRADO: { icon: CircleCheckBig, tone: 'gray', dot: 'bg-gray-500' },
};

export const PRIORIDAD_META: Record<Prioridad, { icon: LucideIcon; tone: BadgeTone; border: string }> = {
  BAJA: { icon: ChevronDown, tone: 'teal', border: 'border-l-teal-600' },
  MEDIA: { icon: Equal, tone: 'blue', border: 'border-l-blue-600' },
  ALTA: { icon: ChevronUp, tone: 'amber', border: 'border-l-amber-500' },
  CRITICA: { icon: Flame, tone: 'red', border: 'border-l-red-600' },
};
