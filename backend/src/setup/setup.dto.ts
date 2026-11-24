import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Email, Nombre, PasswordNueva, SiViene, TelefonoOpcional, TextoLibre } from '../common/validators';
import { MAX_DIRECCION, MAX_NOTAS, PRECIO_MAX } from '../domain/validation';
import { Rol } from '../generated/prisma/enums';

const precioMsg = `El precio va de 0 a ${PRECIO_MAX.toLocaleString('es-AR')}`;

/** La contraseña actual puede ser anterior al límite de 40: se acepta más larga para poder cambiarla. */
const MAX_PASSWORD_ACTUAL = 200;

export class RegisterDto {
  @Nombre('Nombre del taller')
  tallerNombre: string;

  @Nombre('Tu nombre')
  nombre: string;

  @Email()
  email: string;

  @PasswordNueva()
  password: string;
}

export class ChangePasswordDto {
  @IsString({ message: 'Ingresá tu contraseña actual' }) @MinLength(1, { message: 'Ingresá tu contraseña actual' }) @MaxLength(MAX_PASSWORD_ACTUAL, { message: 'La contraseña actual no es correcta' })
  actual: string;

  @PasswordNueva()
  nueva: string;
}

export class UpdateTallerDto {
  @Nombre('Nombre del taller')
  nombre: string;

  @TelefonoOpcional()
  telefono?: string | null;

  @TextoLibre('Dirección', MAX_DIRECCION, { opcional: true, unRenglon: true })
  direccion?: string | null;
}

export class CreateUserDto {
  @Nombre('Nombre')
  nombre: string;

  @Email()
  email: string;

  @PasswordNueva()
  password: string;

  @IsArray({ message: 'Elegí al menos un rol' }) @ArrayMinSize(1, { message: 'Elegí al menos un rol' }) @ArrayUnique({ message: 'Hay roles repetidos' }) @IsEnum(Rol, { each: true, message: 'Rol inválido' })
  roles: Rol[];
}

export class UpdateUserDto {
  @Nombre('Nombre', true)
  nombre?: string;

  @SiViene() @IsArray({ message: 'Elegí al menos un rol' }) @ArrayMinSize(1, { message: 'Elegí al menos un rol' }) @ArrayUnique({ message: 'Hay roles repetidos' }) @IsEnum(Rol, { each: true, message: 'Rol inválido' })
  roles?: Rol[];

  @SiViene() @IsBoolean({ message: 'Indicá si está activo o no' })
  activo?: boolean;

  /** Contraseña nueva, para quien la olvidó. */
  @PasswordNueva(true)
  password?: string;
}

export class CreateServiceDto {
  @Nombre('Nombre del servicio')
  nombre: string;

  @TextoLibre('Descripción', MAX_NOTAS, { opcional: true })
  descripcion?: string;

  @IsInt({ message: 'El precio debe ser un número entero' }) @Min(0, { message: precioMsg }) @Max(PRECIO_MAX, { message: precioMsg })
  precioBase: number;
}

export class UpdateServiceDto {
  @Nombre('Nombre del servicio', true)
  nombre?: string;

  @SiViene() @IsInt({ message: 'El precio debe ser un número entero' }) @Min(0, { message: precioMsg }) @Max(PRECIO_MAX, { message: precioMsg })
  precioBase?: number;

  @SiViene() @IsBoolean({ message: 'Indicá si está activo o no' })
  activo?: boolean;
}
