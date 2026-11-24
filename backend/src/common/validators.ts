import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsOptional, IsString, Validate, ValidatorConstraint, type ValidationArguments, type ValidatorConstraintInterface,
} from 'class-validator';
import { MIN_PASSWORD } from '../domain/setup';
import {
  limpiarNombre, problemaEmail, problemaNombre, problemaPassword, problemaPasswordEscrita, problemaTelefono,
} from '../domain/validation';
import { trimString } from './text';

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

const vacioANull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : trimString({ value }));
const minusculas = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const nombreLimpio = ({ value }: { value: unknown }) => (typeof value === 'string' ? limpiarNombre(value) : value);

/** Nombre propio (persona, cliente, taller, servicio): sin espacios de más, con largo y caracteres acotados. */
export function Nombre(campo: string, opcional = false) {
  return applyDecorators(Transform(nombreLimpio), ...(opcional ? [IsOptional()] : []), Validate(NombreValido, [campo, 2, true]));
}

/** Texto corto que puede ser solo números (marca, modelo). */
export function TextoCorto(campo: string) {
  return applyDecorators(Transform(nombreLimpio), Validate(NombreValido, [campo, 1, false]));
}

/** Teléfono obligatorio. */
export function Telefono() {
  return applyDecorators(Transform(trimString), IsString({ message: 'Ingresá el teléfono' }), Validate(TelefonoValido));
}

/** Teléfono opcional: vacío se guarda como null. */
export function TelefonoOpcional() {
  return applyDecorators(Transform(vacioANull), IsOptional(), IsString(), Validate(TelefonoValido));
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
  return applyDecorators(...(opcional ? [IsOptional()] : []), Validate(PasswordValida));
}
