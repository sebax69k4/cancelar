import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsOptional, Matches, Validate, ValidateIf, ValidatorConstraint, type ValidationArguments, type ValidatorConstraintInterface,
} from 'class-validator';
import { MIN_PASSWORD } from '../domain/setup';
import {
  limpiarNombre, limpiarTexto, problemaEmail, problemaNombre, problemaPassword, problemaPasswordEscrita, problemaTelefono, problemaTexto,
} from '../domain/validation';

@ValidatorConstraint({ name: 'telefono' })
class TelefonoValido implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && problemaTelefono(value) === null;
  }
  defaultMessage(args: ValidationArguments): string {
    return typeof args.value === 'string' ? (problemaTelefono(args.value) ?? '') : 'Ingresá el teléfono';
  }
}

@ValidatorConstraint({ name: 'password' })
class PasswordValida implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && problemaPassword(value, MIN_PASSWORD) === null;
  }
  defaultMessage(args: ValidationArguments): string {
    return typeof args.value === 'string' ? (problemaPassword(args.value, MIN_PASSWORD) ?? '') : 'Ingresá la contraseña';
  }
}

@ValidatorConstraint({ name: 'nombre' })
class NombreValido implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    return this.problema(value, args) === null;
  }
  defaultMessage(args: ValidationArguments): string {
    return this.problema(args.value, args) ?? '';
  }
  private problema(value: unknown, args: ValidationArguments): string | null {
    const [campo, min, conLetras] = args.constraints as [string, number, boolean];
    return typeof value === 'string' ? problemaNombre(campo, value, min, conLetras) : `${campo}: tiene que ser un texto`;
  }
}

@ValidatorConstraint({ name: 'email' })
class EmailValido implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && problemaEmail(value) === null;
  }
  defaultMessage(args: ValidationArguments): string {
    return (typeof args.value === 'string' ? problemaEmail(args.value) : null) ?? 'Ingresá un email válido';
  }
}

@ValidatorConstraint({ name: 'passwordEscrita' })
class PasswordEscrita implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && value !== '' && problemaPasswordEscrita(value) === null;
  }
  defaultMessage(args: ValidationArguments): string {
    return (typeof args.value === 'string' ? problemaPasswordEscrita(args.value) : null) ?? 'Ingresá la contraseña';
  }
}

const nombreLimpio = ({ value }: { value: unknown }) => (typeof value === 'string' ? limpiarNombre(value) : value);

interface ReglaTexto { campo: string; min: number; max: number; siEsCorto?: string }

@ValidatorConstraint({ name: 'textoLibre' })
class TextoLibreValido implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    return this.problema(value, args) === null;
  }
  defaultMessage(args: ValidationArguments): string {
    return this.problema(args.value, args) ?? '';
  }
  private problema(value: unknown, args: ValidationArguments): string | null {
    const { campo, min, max, siEsCorto } = args.constraints[0] as ReglaTexto;
    if (typeof value !== 'string') return value == null && siEsCorto ? siEsCorto : `${campo}: tiene que ser un texto`;
    return problemaTexto(campo, value, min, max, siEsCorto);
  }
}

const FECHA_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

@ValidatorConstraint({ name: 'fecha' })
class FechaValida implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    const m = typeof value === 'string' && value.length <= 40 ? FECHA_RE.exec(value) : null;
    if (!m || Number.isNaN(new Date(value as string).getTime())) return false;
    // El 30 de febrero no existe: Date lo pasaría al 2 de marzo sin avisar
    const dia = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return dia.getUTCMonth() === Number(m[2]) - 1 && dia.getUTCDate() === Number(m[3]);
  }
}

/** Se puede no mandar, pero si viene tiene que ser válido (null no: llegaba hasta la base y daba error). */
export function SiViene() {
  return ValidateIf((_objeto, valor) => valor !== undefined);
}

/** Id de otro registro. Los ids son letras y números: no llega a la base nada que no pueda ser un id. */
export function IdRegistro(mensaje: string) {
  return Matches(/^[A-Za-z0-9_-]{1,50}$/, { message: mensaje });
}

/** Fecha AAAA-MM-DD, sola o con hora, que exista en el calendario. */
export function Fecha(mensaje: string) {
  return Validate(FechaValida, { message: mensaje });
}

/** Texto libre (falla, comentarios, notas…): se limpia y se controla con la misma regla que el frontend. */
export function TextoLibre(campo: string, max: number, { min = 0, siEsCorto, opcional = false, unRenglon = false }:
  { min?: number; siEsCorto?: string; opcional?: boolean; unRenglon?: boolean } = {}) {
  const limpiar = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? (unRenglon ? limpiarNombre(limpiarTexto(value)) : limpiarTexto(value)) : value;
  const regla: ReglaTexto = { campo, min, max, siEsCorto };
  return applyDecorators(Transform(limpiar), ...(opcional ? [IsOptional()] : []), Validate(TextoLibreValido, [regla]));
}

const vacioANull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : nombreLimpio({ value }));
const minusculas = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** Nombre propio (persona, cliente, taller, servicio): sin espacios de más, con largo y caracteres acotados. */
export function Nombre(campo: string, opcional = false) {
  return applyDecorators(Transform(nombreLimpio), ...(opcional ? [SiViene()] : []), Validate(NombreValido, [campo, 2, true]));
}

/** Texto corto que puede ser solo números (marca, modelo). */
export function TextoCorto(campo: string) {
  return applyDecorators(Transform(nombreLimpio), Validate(NombreValido, [campo, 1, false]));
}

/** Teléfono obligatorio. */
export function Telefono() {
  return applyDecorators(Transform(nombreLimpio), Validate(TelefonoValido));
}

/** Teléfono opcional: vacío se guarda como null. */
export function TelefonoOpcional() {
  return applyDecorators(Transform(vacioANull), IsOptional(), Validate(TelefonoValido));
}

/** Email obligatorio, en minúsculas. */
export function Email() {
  return applyDecorators(Transform(minusculas), Validate(EmailValido));
}

/** Email opcional: vacío se guarda como null. */
export function EmailOpcional() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : minusculas({ value }))),
    IsOptional(),
    Validate(EmailValido),
  );
}

/** Contraseña al ingresar: no se pide la fuerza de una nueva, pero sí el largo y los caracteres. */
export function PasswordIngreso() {
  return applyDecorators(Validate(PasswordEscrita));
}

/** Contraseña nueva: largo mínimo, letras y números. */
export function PasswordNueva(opcional = false) {
  return applyDecorators(...(opcional ? [SiViene()] : []), Validate(PasswordValida));
}
