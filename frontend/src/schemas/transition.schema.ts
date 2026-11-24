import { z } from 'zod';
import { MIN_COMENTARIO } from '@/lib/workflow/transitions';
import { MAX_COMENTARIO } from '@/lib/workflow/validation';
import { ESTADOS } from '@/types/domain';
import { textoLibre } from './common';

export const transitionSchema = z.object({
  to: z.enum(ESTADOS, 'Elegí el nuevo estado'),
  comentario: textoLibre('Comentario', MAX_COMENTARIO, MIN_COMENTARIO, `El comentario es obligatorio (mínimo ${MIN_COMENTARIO} caracteres)`),
});

export type TransitionInput = z.infer<typeof transitionSchema>;

/** Texto obligatorio (motivo o comentario) con largo mínimo configurable. */
export function textSchema(min: number, label: string) {
  return z.object({
    texto: textoLibre(label, MAX_COMENTARIO, min, `${label} es obligatorio (mínimo ${min} caracteres)`),
  });
}

export type TextInput = { texto: string };
