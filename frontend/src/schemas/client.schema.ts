import { z } from 'zod';
import { email, nombre, telefono } from './common';

export const clientSchema = z.object({
  nombre: nombre('Nombre'),
  telefono,
  email: z.union([z.literal(''), email]),
  notas: z.string().trim().max(300, 'Máximo 300 caracteres'),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const emptyClient: ClientInput = { nombre: '', telefono: '', email: '', notas: '' };
