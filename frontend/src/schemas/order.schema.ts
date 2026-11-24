import { z } from 'zod';
import { MIN_MOTIVO } from '@/lib/workflow/transitions';
import { MAX_DIAS_ESTIMADA, MAX_FALLA } from '@/lib/workflow/validation';
import { NIVELES_IMPACTO, NIVELES_URGENCIA } from '@/types/domain';
import { textoLibre } from './common';

/** AAAA-MM-DD en hora local (lo que devuelve <input type="date">). */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Último día aceptado como fecha estimada (AAAA-MM-DD). */
export function maxFechaEstimada(): string {
  const d = new Date(Date.now());
  d.setDate(d.getDate() + MAX_DIAS_ESTIMADA);
  return localDate(d.getTime());
}

export const orderSchema = z.object({
  clienteId: z.string().min(1, 'Elegí o creá un cliente'),
  equipoId: z.string().min(1, 'Elegí o creá un equipo'),
  servicioId: z.string().min(1, 'Elegí un servicio'),
  responsableId: z.string().min(1, 'Asigná un responsable'),
  tecnicoId: z.string(),
  fallaReportada: textoLibre('Falla reportada', MAX_FALLA, MIN_MOTIVO, `Describí la falla (mínimo ${MIN_MOTIVO} caracteres)`),
  impacto: z.enum(NIVELES_IMPACTO, 'Elegí el impacto'),
  urgencia: z.enum(NIVELES_URGENCIA, 'Elegí la urgencia'),
  fechaEstimada: z
    .string()
    .min(1, 'Elegí la fecha estimada de entrega')
    .refine((v) => v >= localDate(Date.now()), 'La fecha estimada no puede ser anterior a hoy')
    .refine((v) => v <= maxFechaEstimada(), `Como máximo ${MAX_DIAS_ESTIMADA} días después de hoy`),
});

export type OrderInput = z.infer<typeof orderSchema>;
