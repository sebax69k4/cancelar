import { z } from 'zod';
import { MIN_PASSWORD } from '@/lib/workflow/setup';
import {
  MAX_PASSWORD, PRECIO_MAX, limpiarNombre, limpiarTexto, problemaEmail, problemaNombre, problemaPassword, problemaPasswordEscrita,
  problemaTelefono, problemaTexto,
} from '@/lib/workflow/validation';

/** Pasa la regla compartida con el backend (devuelve el problema o null) a un esquema de zod. */
function conRegla(limpiar: (v: string) => string, regla: (v: string) => string | null) {
  return z
    .string()
    .overwrite(limpiar)
    .superRefine((v, ctx) => {
      const p = regla(v);
      if (p) ctx.addIssue({ code: 'custom', message: p });
    });
}

/** Nombre propio (persona, cliente, taller, servicio): sin espacios de más, hasta MAX_TEXTO y con letras. */
export function nombre(campo: string) {
  return conRegla(limpiarNombre, (v) => problemaNombre(campo, v));
}

/** Texto corto que puede ser solo números (marca, modelo). */
export function textoCorto(campo: string) {
  return conRegla(limpiarNombre, (v) => problemaNombre(campo, v, 1, false));
}

/** Texto libre (falla, comentarios, notas…). Con min 0 se puede dejar vacío. */
export function textoLibre(campo: string, max: number, min = 0, siEsCorto?: string) {
  return conRegla(limpiarTexto, (v) => problemaTexto(campo, v, min, max, siEsCorto));
}

/** Teléfono obligatorio. */
export const telefono = conRegla(limpiarNombre, (v) => (v === '' ? 'Ingresá el teléfono' : problemaTelefono(v)));

/** Teléfono que se puede dejar vacío. */
export const telefonoOpcional = conRegla(limpiarNombre, (v) => (v === '' ? null : problemaTelefono(v)));

export const email = conRegla((v) => v.trim().toLowerCase(), problemaEmail);

/** Contraseña al ingresar: el largo y los caracteres, sin pedir la fuerza de una nueva. */
export const passwordIngreso = conRegla((v) => v, (v) => (v === '' ? 'Ingresá la contraseña' : problemaPasswordEscrita(v)));

/** Contraseña nueva: largo mínimo, letras y números. */
export const passwordNueva = z.string().superRefine((v, ctx) => {
  const p = problemaPassword(v, MIN_PASSWORD);
  if (p) ctx.addIssue({ code: 'custom', message: p });
});

export const PASSWORD_HINT = `De ${MIN_PASSWORD} a ${MAX_PASSWORD} caracteres, con letras y números. Sin espacios al principio ni al final.`;

/** Precio escrito en un <input type="number">: entero de 0 a PRECIO_MAX. */
export const precio = z
  .string()
  .trim()
  .min(1, 'Ingresá el precio')
  .refine((v) => /^\d+$/.test(v), 'El precio es un número entero, sin puntos ni comas')
  .refine((v) => Number(v) <= PRECIO_MAX, `El precio no puede superar ${PRECIO_MAX.toLocaleString('es-AR')}`);
