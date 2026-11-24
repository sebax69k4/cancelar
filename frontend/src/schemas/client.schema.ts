import { z } from 'zod';
import { MAX_NOTAS } from '@/lib/workflow/validation';
import { email, nombre, telefono, textoLibre } from './common';

export const clientSchema = z.object({
  nombre: nombre('Nombre'),
  telefono,
  email: z.union([z.literal(''), email]),
  notas: textoLibre('Notas', MAX_NOTAS),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const emptyClient: ClientInput = { nombre: '', telefono: '', email: '', notas: '' };
