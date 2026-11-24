import { HttpException, HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../auth/auth.decorators';
import { eventoSeguridad } from '../common/security-log';
import { OrdersService } from './orders.service';

/** Subidas a la vez: cada archivo pasa por la memoria del servidor (hasta 10 MB cada uno). */
export const SUBIDAS_POR_PERSONA = 3;
export const SUBIDAS_A_LA_VEZ = 6;
/** Archivos por persona: alcanza para cargar una tanda de fotos, no para llenar el disco con un script. */
export const SUBIDAS_POR_MINUTO = 30;
export const SUBIDAS_POR_HORA = 150;

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/**
 * Controla una subida ANTES de leer el archivo: cantidad de subidas de la persona y permiso
 * sobre la orden. Cuenta por persona y no por IP: en un taller varias PCs comparten la IP.
 */
@Injectable()
export class UploadGuard implements CanActivate {
  private readonly enCurso = new Map<string, number>();
  private total = 0;
  private readonly recientes = new Map<string, number[]>();

  constructor(private readonly orders: OrdersService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request & { user: AuthUser }>();
    const res = http.getResponse<Response>();
    const { id: persona } = req.user;

    this.contar(persona, Date.now());
    if ((this.enCurso.get(persona) ?? 0) >= SUBIDAS_POR_PERSONA) {
      throw new HttpException('Ya tenés otros archivos subiéndose: esperá a que terminen', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (this.total >= SUBIDAS_A_LA_VEZ) {
      throw new HttpException('El servidor está recibiendo muchos archivos. Probá de nuevo en unos segundos.', HttpStatus.SERVICE_UNAVAILABLE);
    }
    this.reservar(persona, res);
    await this.orders.assertPuedeSubir(req.user, String(req.params.id));
    return true;
  }

  /** Suma el intento y frena si la persona pasó su cupo. */
  private contar(persona: string, ahora: number): void {
    const vigentes = (this.recientes.get(persona) ?? []).filter((t) => ahora - t < HORA);
    const enElMinuto = vigentes.filter((t) => ahora - t < MINUTO).length;
    if (enElMinuto >= SUBIDAS_POR_MINUTO || vigentes.length >= SUBIDAS_POR_HORA) {
      this.recientes.set(persona, vigentes);
      eventoSeguridad('evidencia.cupo_superado', { usuario: persona, minuto: enElMinuto, hora: vigentes.length });
      throw new HttpException('Subiste muchos archivos en poco tiempo. Esperá un rato y volvé a probar.', HttpStatus.TOO_MANY_REQUESTS);
    }
    vigentes.push(ahora);
    this.recientes.set(persona, vigentes);
    if (this.recientes.size > 1000) {
      for (const [p, marcas] of this.recientes) if (ahora - (marcas.at(-1) ?? 0) >= HORA) this.recientes.delete(p);
    }
  }

  /** Ocupa un lugar hasta que la respuesta termina o la conexión se corta. */
  private reservar(persona: string, res: Response): void {
    // Si el cliente ya se fue, «close» no vuelve a dispararse y el lugar quedaría ocupado para siempre
    if (res.destroyed || res.closed) throw new HttpException('La conexión se cortó', HttpStatus.BAD_REQUEST);
    this.enCurso.set(persona, (this.enCurso.get(persona) ?? 0) + 1);
    this.total++;
    res.once('close', () => {
      const quedan = (this.enCurso.get(persona) ?? 1) - 1;
      if (quedan > 0) this.enCurso.set(persona, quedan);
      else this.enCurso.delete(persona);
      this.total--;
    });
  }
}
