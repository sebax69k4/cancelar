import { z } from 'zod';

export const clientSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresá el nombre (mínimo 2 caracteres)').max(80, 'Máximo 80 caracteres'),
  telefono: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]+$/, 'Usá solo números, espacios, +, - o paréntesis')
    .refine((v) => v.replace(/\D/g, '').length >= 6, 'El teléfono debe tener al menos 6 dígitos'),
  email: z.union([z.literal(''), z.email('Email inválido')]),
  notas: z.string().trim().max(300, 'Máximo 300 caracteres'),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const emptyClient: ClientInput = { nombre: '', telefono: '', email: '', notas: '' };
