import { IsBoolean, IsOptional, Matches } from 'class-validator';
import { Email, Nombre, PasswordIngreso, PasswordNueva, TextoLibre } from '../common/validators';

const codigoMsg = 'El código tiene 6 dígitos';

export class LoginPlataformaDto {
  @Email()
  email: string;

  @PasswordIngreso()
  password: string;

  /** Código de la app autenticadora (cuando el segundo factor ya está activado). */
  @IsOptional() @Matches(/^\d{6}$/, { message: codigoMsg })
  codigo?: string;
}

export class CodigoDto {
  @Matches(/^\d{6}$/, { message: codigoMsg })
  codigo: string;
}

export class MotivoDto {
  @TextoLibre('Motivo', 300, { min: 10, siEsCorto: 'Contá el motivo (mínimo 10 caracteres): queda en la bitácora' })
  motivo: string;
}

export class ActivoDto {
  @IsBoolean({ message: 'Indicá si queda activo o no' })
  activo: boolean;
}

export class NuevaClaveDto {
  @PasswordNueva()
  password: string;
}

export class NuevoModeradorDto {
  @Nombre('Nombre')
  nombre: string;

  @Email()
  email: string;

  /** Además de la regla común, en la plataforma se piden al menos 12 caracteres (lo controla el servicio). */
  @PasswordNueva()
  password: string;
}
