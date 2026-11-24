import { z } from 'zod';
import { MIN_PASSWORD } from '@/lib/workflow/setup';
import { ROLES } from '@/types/domain';
import { email, nombre, passwordNueva, precio, telefonoOpcional } from './common';
import { problemaPassword } from '@/lib/workflow/validation';

export const tallerSchema = z.object({
  nombre: nombre('Nombre del taller'),
  telefono: telefonoOpcional,
  direccion: z.string().trim().max(200, 'Máximo 200 caracteres'),
});

export type TallerInput = z.infer<typeof tallerSchema>;

const roles = z.array(z.enum(ROLES)).min(1, 'Elegí al menos un rol');

/** Persona nueva: la contraseña es obligatoria. */
export const newUserSchema = z.object({
  nombre: nombre('Nombre'),
  email,
  password: passwordNueva,
  roles,
  activo: z.boolean(),
});

/** Persona existente: la contraseña vacía no se cambia. */
export const editUserSchema = newUserSchema.extend({
  email: z.string(),
  password: z.string().superRefine((v, ctx) => {
    const p = v === '' ? null : problemaPassword(v, MIN_PASSWORD);
    if (p) ctx.addIssue({ code: 'custom', message: p });
  }),
});

export type UserInput = z.infer<typeof newUserSchema>;

export const serviceSchema = z.object({
  nombre: nombre('Nombre del servicio'),
  precio,
});

export type ServiceInput = z.infer<typeof serviceSchema>;
