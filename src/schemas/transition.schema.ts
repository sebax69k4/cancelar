import { z } from 'zod';
import { MIN_COMENTARIO } from '@/lib/workflow/transitions';
import { ESTADOS } from '@/types/domain';

export const transitionSchema = z.object({
  to: z.enum(ESTADOS, 'Elegí el nuevo estado'),
  comentario: z
    .string()
    .trim()
    .min(MIN_COMENTARIO, `El comentario es obligatorio (mínimo ${MIN_COMENTARIO} caracteres)`)
    .max(500, 'Máximo 500 caracteres'),
});

export type TransitionInput = z.infer<typeof transitionSchema>;

/** Texto obligatorio (motivo o comentario) con largo mínimo configurable. */
export function textSchema(min: number, label: string) {
  return z.object({
    texto: z
      .string()
      .trim()
      .min(min, `${label} es obligatorio (mínimo ${min} caracteres)`)
      .max(500, 'Máximo 500 caracteres'),
  });
}

export type TextInput = { texto: string };
