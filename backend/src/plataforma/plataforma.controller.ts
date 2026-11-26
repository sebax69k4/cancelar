import { Body, Controller, Get, HttpCode, Ip, Param, ParseIntPipe, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { Public } from '../auth/auth.decorators';
import { IdRegistro } from '../common/validators';
import type { Env } from '../config/env';
import { ActivoDto, CodigoDto, LoginPlataformaDto, MotivoDto, NuevaClaveDto, NuevoModeradorDto } from './plataforma.dto';
import {
  COOKIE_PLATAFORMA, Cuenta, DURACION_PLATAFORMA_S, DURACION_SEGUNDO_FACTOR_S, EnSegundoFactor, PlataformaGuard, SoloRol,
  type CuentaActual,
} from './plataforma.guard';
import { PlataformaService } from './plataforma.service';

class IdParam {
  @IdRegistro('Id inválido')
  id: string;
}

/**
 * Administración de la plataforma (por encima de los talleres). Usa su propia sesión: el guard
 * global de los talleres no aplica (@Public) y lo reemplaza PlataformaGuard.
 */
@ApiTags('plataforma')
@Public()
@Controller('plataforma')
export class PlataformaController {
  constructor(
    private readonly servicio: PlataformaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private cookie(res: Response, token: string, segundos: number): void {
    res.cookie(COOKIE_PLATAFORMA, token, this.opciones(segundos));
  }

  private opciones(segundos?: number): CookieOptions {
    return {
      httpOnly: true,
      // Más estricta que la de los talleres: ningún otro sitio puede mandarla, ni siquiera con un enlace
      sameSite: 'strict',
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      path: '/',
      ...(segundos ? { maxAge: segundos * 1000 } : {}),
    };
  }

  // ------------------------------------------------------------------ ingreso

  @Throttle({ default: { limit: 5, ttl: 60_000 }, hora: { limit: 30, ttl: 3_600_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginPlataformaDto, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    const r = await this.servicio.login(dto.email, dto.password, dto.codigo, ip);
    if (r.estado === 'codigo') return r;
    if (r.estado === 'configurar') {
      this.cookie(res, r.token, DURACION_SEGUNDO_FACTOR_S);
      return { estado: r.estado, secreto: r.secreto, uri: r.uri };
    }
    this.cookie(res, r.token, DURACION_PLATAFORMA_S);
    return { estado: r.estado, cuenta: r.cuenta };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(PlataformaGuard)
  @EnSegundoFactor()
  @Post('segundo-factor')
  @HttpCode(200)
  async segundoFactor(@Cuenta() cuenta: CuentaActual, @Body() dto: CodigoDto, @Ip() ip: string, @Res({ passthrough: true }) res: Response) {
    const r = await this.servicio.activarSegundoFactor(cuenta, dto.codigo, ip);
    this.cookie(res, r.token, DURACION_PLATAFORMA_S);
    return { estado: 'listo', cuenta: r.cuenta };
  }

  @UseGuards(PlataformaGuard)
  @Get('me')
  me(@Cuenta() c: CuentaActual) {
    return { id: c.id, nombre: c.nombre, email: c.email, rol: c.rol, expira: new Date(c.expira * 1000).toISOString() };
  }

  @UseGuards(PlataformaGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(@Cuenta() c: CuentaActual, @Ip() ip: string, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.servicio.logout(c, ip);
    res.clearCookie(COOKIE_PLATAFORMA, this.opciones());
  }

  // ------------------------------------------------------------------ talleres (Moderador y Administrador)

  @UseGuards(PlataformaGuard)
  @Get('talleres')
  talleres() {
    return this.servicio.talleres();
  }

  @UseGuards(PlataformaGuard)
  @Get('talleres/:id/personas')
  personas(@Cuenta() c: CuentaActual, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.personas(c, id);
  }

  @UseGuards(PlataformaGuard)
  @Post('talleres/:id/suspender')
  @HttpCode(204)
  suspender(@Cuenta() c: CuentaActual, @Param('id', ParseIntPipe) id: number, @Body() dto: MotivoDto, @Ip() ip: string) {
    return this.servicio.suspenderTaller(c, id, dto.motivo, ip);
  }

  @UseGuards(PlataformaGuard)
  @Post('talleres/:id/reactivar')
  @HttpCode(204)
  reactivar(@Cuenta() c: CuentaActual, @Param('id', ParseIntPipe) id: number, @Ip() ip: string) {
    return this.servicio.reactivarTaller(c, id, ip);
  }

  @UseGuards(PlataformaGuard)
  @Patch('personas/:id')
  @HttpCode(204)
  persona(@Cuenta() c: CuentaActual, @Param() p: IdParam, @Body() dto: ActivoDto, @Ip() ip: string) {
    return this.servicio.cambiarActivoPersona(c, p.id, dto.activo, ip);
  }

  // ------------------------------------------------------------------ solo Administrador

  @UseGuards(PlataformaGuard)
  @SoloRol('ADMINISTRADOR')
  @Post('personas/:id/clave')
  @HttpCode(204)
  clave(@Cuenta() c: CuentaActual, @Param() p: IdParam, @Body() dto: NuevaClaveDto, @Ip() ip: string) {
    return this.servicio.nuevaClavePersona(c, p.id, dto.password, ip);
  }

  @UseGuards(PlataformaGuard)
  @SoloRol('ADMINISTRADOR')
  @Get('cuentas')
  cuentas() {
    return this.servicio.cuentas();
  }

  @UseGuards(PlataformaGuard)
  @SoloRol('ADMINISTRADOR')
  @Post('cuentas')
  crearModerador(@Cuenta() c: CuentaActual, @Body() dto: NuevoModeradorDto, @Ip() ip: string) {
    return this.servicio.crearModerador(c, dto.nombre, dto.email, dto.password, ip);
  }

  @UseGuards(PlataformaGuard)
  @SoloRol('ADMINISTRADOR')
  @Patch('cuentas/:id')
  @HttpCode(204)
  cuenta(@Cuenta() c: CuentaActual, @Param() p: IdParam, @Body() dto: ActivoDto, @Ip() ip: string) {
    return this.servicio.cambiarActivoCuenta(c, p.id, dto.activo, ip);
  }

  @UseGuards(PlataformaGuard)
  @SoloRol('ADMINISTRADOR')
  @Get('bitacora')
  bitacora() {
    return this.servicio.bitacora();
  }
}
