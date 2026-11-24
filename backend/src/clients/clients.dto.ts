import { IsOptional, IsString, MaxLength } from 'class-validator';
import { EmailOpcional, Nombre, Telefono, TextoLibre } from '../common/validators';
import { MAX_BUSQUEDA, MAX_NOTAS } from '../domain/validation';

export class CreateClientDto {
  @Nombre('Nombre')
  nombre: string;

  @Telefono()
  telefono: string;

  @EmailOpcional()
  email?: string | null;

  @TextoLibre('Notas', MAX_NOTAS, { opcional: true })
  notas?: string | null;
}

export class ClientsQuery {
  @IsOptional()
  @IsString({ message: 'Búsqueda inválida' })
  @MaxLength(MAX_BUSQUEDA, { message: `La búsqueda no puede tener más de ${MAX_BUSQUEDA} caracteres` })
  q?: string;
}
