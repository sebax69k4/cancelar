import { z } from 'zod';
import { TIPOS_EQUIPO } from '@/types/domain';
import { textoCorto } from './common';

export const equipmentSchema = z.object({
  clienteId: z.string().min(1, 'Elegí el cliente dueño del equipo'),
  tipo: z.enum(TIPOS_EQUIPO, 'Elegí el tipo de equipo'),
  marca: textoCorto('Marca'),
  modelo: textoCorto('Modelo'),
  numeroSerie: z
    .string()
    .trim()
    .min(3, 'Ingresá el número de serie (mínimo 3 caracteres)')
    .max(40, 'Máximo 40 caracteres')
    .regex(/^[A-Za-z0-9\-_/.]+$/, 'Usá solo letras, números y - _ / .'),
  notas: z.string().trim().max(300, 'Máximo 300 caracteres'),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;
