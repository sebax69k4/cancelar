import { z } from 'zod';
import { TIPOS_EQUIPO } from '@/types/domain';
import { MAX_NOTAS, SERIE_RE } from '@/lib/workflow/validation';
import { textoCorto, textoLibre } from './common';

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
    .regex(SERIE_RE, 'Usá solo letras, números y - _ / . (empezando con letra o número)'),
  notas: textoLibre('Notas', MAX_NOTAS),
});

export type EquipmentInput = z.infer<typeof equipmentSchema>;
