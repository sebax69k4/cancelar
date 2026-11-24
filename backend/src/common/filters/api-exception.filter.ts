import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, PayloadTooLargeException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { eventoSeguridad } from '../security-log';
import { Prisma } from '../../generated/prisma/client';

/** Cuerpo de error que espera el frontend: { statusCode, message, details? } */
interface ErrorBody {
  statusCode: number;
  message: string | string[];
  details?: string[];
}

/** Mensajes que arma el framework en inglés: se muestran en castellano (y sin repetir lo que mandó el cliente). */
function enCastellano(status: number, mensaje: string): string {
  if (status === 429 && mensaje.startsWith('ThrottlerException')) return 'Demasiados pedidos seguidos. Esperá un minuto y volvé a probar.';
  if (status === 404 && mensaje.startsWith('Cannot ')) return 'La dirección no existe';
  if (status === 400 && /JSON|^Unexpected /.test(mensaje)) return 'El cuerpo de la solicitud no es un JSON válido';
  if (status === 400 && mensaje.startsWith('Failed to decode')) return 'La dirección está mal escrita';
  if (status === 400 && /^(Unexpected field|Too many|Field |Multipart|Malformed|File name|Boundary)/i.test(mensaje)) return 'Mandá un solo archivo, sin otros datos';
  return mensaje;
}

function fromHttpException(e: HttpException): ErrorBody {
  const status = e.getStatus();
  const res = e.getResponse();
  if (typeof res === 'string') return { statusCode: status, message: enCastellano(status, res) };
  const r = res as { message?: unknown; details?: unknown };
  const message = Array.isArray(r.message)
    ? r.message.filter((m): m is string => typeof m === 'string')
    : enCastellano(status, typeof r.message === 'string' ? r.message : e.message);
  const details = Array.isArray(r.details) ? r.details.filter((d): d is string => typeof d === 'string') : undefined;
  return { statusCode: status, message, ...(details?.length ? { details } : {}) };
}

/**
 * Errores del parser del cuerpo (body-parser / http-errors): no son HttpException, pero traen
 * su código 4xx. Sin esto, un JSON demasiado grande respondía 500.
 */
function fromBodyParser(e: unknown): ErrorBody | null {
  const err = e as { status?: unknown; type?: unknown; expose?: unknown };
  if (typeof err?.status !== 'number' || err.status < 400 || err.status >= 500 || err.expose !== true) return null;
  const mensajes: Record<string, string> = {
    'entity.too.large': 'La solicitud es demasiado grande',
    'entity.parse.failed': 'El cuerpo de la solicitud no es un JSON válido',
    'encoding.unsupported': 'Codificación no admitida',
    'charset.unsupported': 'Juego de caracteres no admitido',
  };
  return { statusCode: err.status, message: (typeof err.type === 'string' && mensajes[err.type]) || 'Solicitud inválida' };
}

function fromPrisma(e: Prisma.PrismaClientKnownRequestError): ErrorBody | null {
  if (e.code === 'P2002') return { statusCode: HttpStatus.CONFLICT, message: 'Ya existe un registro con esos datos' };
  if (e.code === 'P2025') return { statusCode: HttpStatus.NOT_FOUND, message: 'El registro no existe' };
  if (e.code === 'P2003') return { statusCode: HttpStatus.BAD_REQUEST, message: 'Referencia a un registro inexistente' };
  // La base tardó demasiado (o no hay conexión libre): no se guardó nada, se puede reintentar
  if (e.code === 'P2028' || e.code === 'P2024') {
    return { statusCode: HttpStatus.SERVICE_UNAVAILABLE, message: 'La base de datos está tardando demasiado y no se guardó. Probá de nuevo en unos segundos.' };
  }
  return null;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('API');

  /** @param uploadMaxMb tamaño máximo de evidencia, para el mensaje del 413 */
  constructor(private readonly uploadMaxMb: number) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    // Ya se respondió (ej. un pedido gigante que se cortó): no hay nada más que mandar
    if (res.headersSent) return;
    let body: ErrorBody | null = null;

    if (exception instanceof PayloadTooLargeException) {
      // multer responde "File too large" en inglés y sin el límite
      body = { statusCode: HttpStatus.PAYLOAD_TOO_LARGE, message: `El archivo supera el tamaño máximo de ${this.uploadMaxMb} MB` };
    } else if (exception instanceof HttpException) body = fromHttpException(exception);
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) body = fromPrisma(exception);
    else body = fromBodyParser(exception);

    if (body?.statusCode === HttpStatus.SERVICE_UNAVAILABLE) this.logger.error(exception instanceof Error ? exception.message : String(exception));
    if (!body) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      body = { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Error interno del servidor' };
    }
    // Accesos denegados y exceso de intentos: quedan registrados para poder investigarlos
    if (body.statusCode === HttpStatus.FORBIDDEN || body.statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      const req = host.switchToHttp().getRequest<Request & { user?: { id: string } }>();
      eventoSeguridad(body.statusCode === HttpStatus.FORBIDDEN ? 'acceso.denegado' : 'limite.superado', {
        ip: req.ip, usuario: req.user?.id, metodo: req.method, ruta: req.path,
      });
    }
    res.status(body.statusCode).json(body);
  }
}
