import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../common/text';
import { EmailOpcional, Nombre, Telefono } from '../common/validators';
import { MAX_BUSQUEDA } from '../domain/validation';

export class CreateClientDto {
  @Nombre('Nombre')
  nombre: string;

  @Telefono()
  telefono: string;

  @EmailOpcional()
  email?: string | null;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Notas: máximo 300 caracteres' })
  notas?: string | null;
}

export class ClientsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BUSQUEDA, { message: `La búsqueda no puede tener más de ${MAX_BUSQUEDA} caracteres` })
  q?: string;
}
