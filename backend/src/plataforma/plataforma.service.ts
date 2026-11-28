import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { corteDeSesiones } from '../auth/sessions';
import { eventoSeguridad, ocultarEmail } from '../common/security-log';
import type { Env } from '../config/env';
import { MIN_PASSWORD } from '../domain/setup';
import { limpiarNombre, problemaEmail, problemaNombre, problemaPassword } from '../domain/validation';
import { Prisma } from '../generated/prisma/client';
import type { RolPlataforma } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  DURACION_PLATAFORMA_S, DURACION_SEGUNDO_FACTOR_S, type CuentaActual, type FaseSesion, type SesionPlataforma,
} from './plataforma.guard';
import { cifrarSecreto, descifrarSecreto, nuevoSecretoTotp, uriTotp, verificarTotp } from './totp';

/** Contraseña mínima de las cuentas de plataforma: tienen más poder que cualquier cuenta de taller. */
export const MIN_PASSWORD_PLATAFORMA = 12;

interface Registro {
  tallerId?: number;
  usuarioId?: string;
  detalle?: string;
  ip?: string;
}

type Resultado =
  | { estado: 'codigo' }
  | { estado: 'configurar'; secreto: string; uri: string; token: string }
  | { estado: 'listo'; token: string; cuenta: ReturnType<typeof toCuenta> };

const toCuenta = (c: { id: string; nombre: string; email: string; rol: RolPlataforma }) => ({ id: c.id, nombre: c.nombre, email: c.email, rol: c.rol });

@Injectable()
export class PlataformaService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Plataforma');
  /** Hash descartable: si el email no existe se verifica igual, así el tiempo no delata qué cuentas existen. */
  private readonly hashFalso = argon2.hash(randomUUID());

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get secretoJwt(): string {
    return this.config.get('JWT_SECRET', { infer: true });
  }

  /**
   * El primer Administrador de plataforma no se crea desde la web: se define en el servidor con
   * PLATAFORMA_ADMIN_EMAIL, PLATAFORMA_ADMIN_NOMBRE y PLATAFORMA_ADMIN_CLAVE, y se crea al arrancar
   * solo si todavía no hay ninguna cuenta de plataforma. Después conviene borrar la clave del entorno.
   */
  async onApplicationBootstrap(): Promise<void> {
    const email = process.env.PLATAFORMA_ADMIN_EMAIL?.trim().toLowerCase();
    const clave = process.env.PLATAFORMA_ADMIN_CLAVE;
    if (!email || !clave) return;
    if ((await this.prisma.cuentaPlataforma.count()) > 0) {
      this.logger.warn('PLATAFORMA_ADMIN_CLAVE sigue definida y ya hay cuentas de plataforma: conviene quitarla del entorno');
      return;
    }
    const nombre = limpiarNombre(process.env.PLATAFORMA_ADMIN_NOMBRE ?? 'Administrador');
    const problema = problemaEmail(email) ?? problemaPassword(clave, MIN_PASSWORD_PLATAFORMA) ?? problemaNombre('Nombre', nombre);
    if (problema) {
      this.logger.error(`No se creó el Administrador de plataforma: ${problema}`);
      return;
    }
    const cuenta = await this.prisma.cuentaPlataforma.create({
      data: { nombre, email, passwordHash: await argon2.hash(clave), rol: 'ADMINISTRADOR' },
    });
    await this.registrar(null, 'cuenta.creada_al_arrancar', { detalle: `Administrador ${ocultarEmail(email)}` });
    this.logger.warn(`Administrador de plataforma creado (${ocultarEmail(cuenta.email)}). Quitá PLATAFORMA_ADMIN_CLAVE del entorno.`);
  }

  /** Bitácora: la base no deja modificar ni borrar estas filas. */
  async registrar(cuentaId: string | null, accion: string, r: Registro = {}): Promise<void> {
    await this.prisma.accionPlataforma.create({
      data: { cuentaId, accion, tallerId: r.tallerId, usuarioId: r.usuarioId, detalle: r.detalle?.slice(0, 500), ip: r.ip?.slice(0, 60) },
    });
  }

  private firmar(cuentaId: string, fase: FaseSesion): Promise<string> {
    const p: SesionPlataforma = { sub: cuentaId, t: Date.now(), jti: randomUUID(), k: 'plataforma', fase };
    return this.jwt.signAsync(p, { expiresIn: fase === 'completa' ? DURACION_PLATAFORMA_S : DURACION_SEGUNDO_FACTOR_S });
  }

  // ------------------------------------------------------------------ ingreso

  async login(email: string, password: string, codigo: string | undefined, ip: string): Promise<Resultado> {
    const c = await this.prisma.cuentaPlataforma.findUnique({ where: { email } });
    const ok = await argon2.verify(c?.passwordHash ?? (await this.hashFalso), password).catch(() => false);
    if (!c || !c.activo || !ok) {
      eventoSeguridad('plataforma.login_fallido', { ip, email: ocultarEmail(email), motivo: !c ? 'email' : !ok ? 'clave' : 'inactiva' });
      if (c) await this.registrar(c.id, 'ingreso.fallido', { ip, detalle: ok ? 'cuenta inactiva' : 'contraseña' });
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    // ---- Saltea el segundo factor si PLATAFORMA_SIN_2FA=true (ingresa con email y contraseña, sin
    // app autenticadora). Pensado para pruebas. OJO: si se activa en producción, estas cuentas de
    // alto privilegio quedan protegidas solo por la contraseña; volvé a quitar la variable al terminar.
    if (process.env.PLATAFORMA_SIN_2FA === 'true') {
      await this.registrar(c.id, 'ingreso', { ip, detalle: 'sin segundo factor (modo pruebas)' });
      return { estado: 'listo', token: await this.firmar(c.id, 'completa'), cuenta: toCuenta(c) };
    }

    // Primera vez: hay que configurar el segundo factor antes de poder hacer nada
    if (!c.totpActivo) {
      const secreto = c.totpSecreto ? descifrarSecreto(c.totpSecreto, this.secretoJwt) : nuevoSecretoTotp();
      if (!c.totpSecreto) await this.prisma.cuentaPlataforma.update({ where: { id: c.id }, data: { totpSecreto: cifrarSecreto(secreto, this.secretoJwt) } });
      return { estado: 'configurar', secreto, uri: uriTotp(secreto, c.email), token: await this.firmar(c.id, 'segundo_factor') };
    }
    if (!codigo) return { estado: 'codigo' };
    const paso = verificarTotp(descifrarSecreto(c.totpSecreto!, this.secretoJwt), codigo, c.totpUltimoPaso);
    if (paso === null) {
      eventoSeguridad('plataforma.codigo_incorrecto', { ip, cuenta: c.id });
      await this.registrar(c.id, 'ingreso.fallido', { ip, detalle: 'código del segundo factor' });
      throw new UnauthorizedException('El código no es correcto o ya se usó. Esperá el siguiente.');
    }
    await this.prisma.cuentaPlataforma.update({ where: { id: c.id }, data: { totpUltimoPaso: paso } });
    await this.registrar(c.id, 'ingreso', { ip });
    return { estado: 'listo', token: await this.firmar(c.id, 'completa'), cuenta: toCuenta(c) };
  }

  /** Confirma el segundo factor con el primer código de la app y abre la sesión completa. */
  async activarSegundoFactor(actual: CuentaActual, codigo: string, ip: string) {
    const c = await this.prisma.cuentaPlataforma.findUniqueOrThrow({ where: { id: actual.id } });
    if (c.totpActivo || !c.totpSecreto) throw new BadRequestException('El segundo factor ya está configurado');
    const paso = verificarTotp(descifrarSecreto(c.totpSecreto, this.secretoJwt), codigo, null);
    if (paso === null) {
      await this.registrar(c.id, 'segundo_factor.fallido', { ip });
      throw new UnauthorizedException('El código no es correcto. Revisá que la hora del celular esté bien y probá con el siguiente.');
    }
    await this.prisma.cuentaPlataforma.update({ where: { id: c.id }, data: { totpActivo: true, totpUltimoPaso: paso } });
    await this.registrar(c.id, 'segundo_factor.activado', { ip });
    return { token: await this.firmar(c.id, 'completa'), cuenta: toCuenta(c) };
  }

  async logout(actual: CuentaActual, ip: string): Promise<void> {
    await this.prisma.sesionCerrada.upsert({ where: { jti: actual.jti }, update: {}, create: { jti: actual.jti, expira: new Date(actual.expira * 1000) } });
    await this.registrar(actual.id, 'salida', { ip });
  }

  // ------------------------------------------------------------------ talleres

  async talleres() {
    const [talleres, actividad] = await Promise.all([
      this.prisma.taller.findMany({ orderBy: { creadoEn: 'desc' }, include: { _count: { select: { usuarios: true, ordenes: true } } } }),
      this.prisma.orden.groupBy({ by: ['tallerId'], _max: { actualizadoEn: true } }),
    ]);
    const ultima = new Map(actividad.map((a) => [a.tallerId, a._max.actualizadoEn]));
    return talleres.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      creadoEn: t.creadoEn.toISOString(),
      configurado: t.configurado,
      suspendido: t.suspendido,
      motivoSuspension: t.motivoSuspension,
      suspendidoEn: t.suspendidoEn?.toISOString() ?? null,
      personas: t._count.usuarios,
      ordenes: t._count.ordenes,
      ultimaActividad: (ultima.get(t.id) ?? t.creadoEn).toISOString(),
    }));
  }

  /** Personas del taller. El email solo lo ve el Administrador (lo necesita para recuperar cuentas). */
  async personas(actual: CuentaActual, tallerId: number) {
    const t = await this.prisma.taller.findUnique({ where: { id: tallerId }, include: { usuarios: { orderBy: { nombre: 'asc' } } } });
    if (!t) throw new NotFoundException('El taller no existe');
    return t.usuarios.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      roles: u.roles,
      activo: u.activo,
      ...(actual.rol === 'ADMINISTRADOR' ? { email: u.email } : {}),
    }));
  }

  async suspenderTaller(actual: CuentaActual, tallerId: number, motivo: string, ip: string) {
    const t = await this.prisma.taller.findUnique({ where: { id: tallerId } });
    if (!t) throw new NotFoundException('El taller no existe');
    if (t.suspendido) throw new ConflictException('El taller ya está suspendido');
    await this.prisma.taller.update({ where: { id: tallerId }, data: { suspendido: true, motivoSuspension: motivo, suspendidoEn: new Date() } });
    await this.registrar(actual.id, 'taller.suspendido', { tallerId, detalle: motivo, ip });
    eventoSeguridad('plataforma.taller_suspendido', { cuenta: actual.id, taller: tallerId }, 'log');
  }

  async reactivarTaller(actual: CuentaActual, tallerId: number, ip: string) {
    const t = await this.prisma.taller.findUnique({ where: { id: tallerId } });
    if (!t) throw new NotFoundException('El taller no existe');
    if (!t.suspendido) throw new ConflictException('El taller no está suspendido');
    await this.prisma.taller.update({ where: { id: tallerId }, data: { suspendido: false, motivoSuspension: null, suspendidoEn: null } });
    await this.registrar(actual.id, 'taller.reactivado', { tallerId, ip });
  }

  // ------------------------------------------------------------------ personas de los talleres

  async cambiarActivoPersona(actual: CuentaActual, usuarioId: string, activo: boolean, ip: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u) throw new NotFoundException('La persona no existe');
    if (u.activo === activo) throw new ConflictException(activo ? 'La cuenta ya está activa' : 'La cuenta ya está suspendida');
    // Al suspender, las sesiones abiertas dejan de valer en el momento
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { activo, ...(activo ? {} : { sesionesDesde: corteDeSesiones() }) } });
    await this.registrar(actual.id, activo ? 'persona.reactivada' : 'persona.suspendida', { tallerId: u.tallerId, usuarioId, ip });
  }

  /** Recuperación de cuenta: el Administrador fija una contraseña nueva y se la pasa a la persona por otro medio. */
  async nuevaClavePersona(actual: CuentaActual, usuarioId: string, password: string, ip: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u) throw new NotFoundException('La persona no existe');
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash: await argon2.hash(password), sesionesDesde: corteDeSesiones() },
    });
    await this.registrar(actual.id, 'persona.clave_reseteada', { tallerId: u.tallerId, usuarioId, ip });
    eventoSeguridad('plataforma.clave_reseteada', { cuenta: actual.id, usuario: usuarioId }, 'log');
  }

  // ------------------------------------------------------------------ cuentas de plataforma

  async cuentas() {
    const list = await this.prisma.cuentaPlataforma.findMany({ orderBy: [{ rol: 'desc' }, { nombre: 'asc' }] });
    return list.map((c) => ({ ...toCuenta(c), activo: c.activo, segundoFactor: c.totpActivo, creadoEn: c.creadoEn.toISOString() }));
  }

  /** El Administrador solo crea moderadores: otro Administrador se define en el servidor. */
  async crearModerador(actual: CuentaActual, nombre: string, email: string, password: string, ip: string) {
    const problema = problemaPassword(password, Math.max(MIN_PASSWORD, MIN_PASSWORD_PLATAFORMA));
    if (problema) throw new BadRequestException({ message: [problema] });
    try {
      const c = await this.prisma.cuentaPlataforma.create({ data: { nombre, email, passwordHash: await argon2.hash(password), rol: 'MODERADOR' } });
      await this.registrar(actual.id, 'cuenta.moderador_creado', { detalle: `${c.nombre} (${ocultarEmail(c.email)})`, ip });
      return toCuenta(c);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Ese email ya tiene una cuenta de plataforma');
      throw e;
    }
  }

  async cambiarActivoCuenta(actual: CuentaActual, cuentaId: string, activo: boolean, ip: string) {
    if (cuentaId === actual.id) throw new ForbiddenException('No podés suspender tu propia cuenta');
    const c = await this.prisma.cuentaPlataforma.findUnique({ where: { id: cuentaId } });
    if (!c) throw new NotFoundException('La cuenta no existe');
    if (c.rol !== 'MODERADOR') throw new ForbiddenException('Desde acá solo se suspenden moderadores');
    await this.prisma.cuentaPlataforma.update({ where: { id: cuentaId }, data: { activo, ...(activo ? {} : { sesionesDesde: corteDeSesiones() }) } });
    await this.registrar(actual.id, activo ? 'cuenta.moderador_reactivado' : 'cuenta.moderador_suspendido', { detalle: c.nombre, ip });
  }

  async bitacora() {
    const list = await this.prisma.accionPlataforma.findMany({ orderBy: { fecha: 'desc' }, take: 300, include: { cuenta: { select: { nombre: true, rol: true } } } });
    return list.map((a) => ({
      id: a.id,
      fecha: a.fecha.toISOString(),
      cuenta: a.cuenta ? { nombre: a.cuenta.nombre, rol: a.cuenta.rol } : null,
      accion: a.accion,
      tallerId: a.tallerId,
      usuarioId: a.usuarioId,
      detalle: a.detalle,
      ip: a.ip,
    }));
  }
}
