import { z } from 'zod';
import { ROLES } from '@/types/domain';

/** Demo: email + contraseña visuales y rol de prueba. */
export const loginSchema = z.object({
  email: z.email('Ingresá un email válido'),
  password: z.string().min(4, 'La contraseña debe tener al menos 4 caracteres'),
  rol: z.enum(ROLES, 'Elegí un rol de prueba'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Backend real: email + contraseña. */
export const realLoginSchema = z.object({
  email: z.email('Ingresá un email válido'),
  password: z.string().min(1, 'Ingresá la contraseña'),
});

export type RealLoginInput = z.infer<typeof realLoginSchema>;
