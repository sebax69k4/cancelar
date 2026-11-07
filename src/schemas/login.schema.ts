import { z } from 'zod';
import { MIN_PASSWORD } from '@/lib/workflow/setup';
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

const password = z.string().min(MIN_PASSWORD, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);

export const registerSchema = z.object({
  tallerNombre: z.string().trim().min(2, 'Ingresá el nombre del taller'),
  nombre: z.string().trim().min(2, 'Ingresá tu nombre'),
  email: z.email('Ingresá un email válido'),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  actual: z.string().min(1, 'Ingresá tu contraseña actual'),
  nueva: password,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
