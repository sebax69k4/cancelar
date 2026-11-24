import {
  BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { AuthUser } from '../auth/auth.decorators';
import { WorkflowException, enforce } from '../common/errors';
import { ORDER_INCLUDE, toOrdenResumen, type OrdenFull, type OrdenResumenDto } from '../common/mappers';
import { digits, normalize, escapeLike } from '../common/text';
import {
  RESOLUCIONES_SIN_REPARACION, autoEscalation, canAbandon, canEscalate, canRaiseEscalation, canResolveEscalation,
  canTakeEscalation, escalationTarget, openEscalation, sinReparacionMissing,
} from '../domain/escalation';
import { ESTADO_LABEL, RESOLUCION_LABEL } from '../domain/labels';
import { can } from '../domain/permissions';
import { calculatePriority } from '../domain/priority';
import { MAX_DIAS_ESTIMADA, MAX_EVIDENCIAS, limiteFechaEstimada } from '../domain/validation';
import { nombreSeguro, problemaEvidencia } from './evidence.signature';
import {
  canActOnOrder, canBlock, canReopen, canTransition, canUnblock, canValidate, isAssignedTo,
} from '../domain/transitions';
import { Prisma } from '../generated/prisma/client';
import type { EstadoOrden, Prioridad, TipoAccion } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceStorage } from './evidence.storage';
import { eventoSeguridad } from '../common/security-log';
import type {
  CreateOrderDto, EscalateDto, OrdersQuery, ReopenDto, ResolveEscalationDto, TransitionDto, UpdateOrderDto,
} from './orders.dto';

type Tx = Prisma.TransactionClient;

/** Resultado de una acción del workflow: qué cambiar y qué registrar en el historial. */
interface Mutation {
  data: Prisma.OrdenUpdateInput;
  tipo: TipoAccion;
  comentario: string;
  estadoAnterior?: EstadoOrden;
  estadoNuevo?: EstadoOrden;
}

const PRIO_RANK: Record<Prioridad, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

/**
 * Tipos de evidencia aceptados. Lista cerrada a propósito: SVG o HTML pueden traer scripts
 * que se ejecutarían al abrir el archivo desde el origen de la API (XSS almacenado).
 */
export const EVIDENCE_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf',
]);

export interface UploadedEvidence {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('Escalamientos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: EvidenceStorage,
  ) {}

  // ------------------------------------------------------------------ lectura

  /** El Técnico solo ve las órdenes donde es técnico o responsable. */
  visibilityWhere(user: AuthUser): Prisma.OrdenWhereInput {
    const own = can(user.roles, 'order.view.all') ? {} : { OR: [{ tecnicoId: user.id }, { responsableId: user.id }] };
    return { tallerId: user.tallerId, ...own };
  }

  async findVisible(user: AuthUser, where: Prisma.OrdenWhereInput = {}): Promise<OrdenFull[]> {
    return this.prisma.orden.findMany({
      where: { AND: [this.visibilityWhere(user), where] },
      include: ORDER_INCLUDE,
    });
  }

  async list(user: AuthUser, query: OrdersQuery): Promise<OrdenResumenDto[]> {
    const and: Prisma.OrdenWhereInput[] = [];
    if (query.status) and.push({ estado: query.status });
    if (query.priority) and.push({ prioridad: query.priority });
    if (query.ownerId) and.push({ OR: [{ responsableId: query.ownerId }, { tecnicoId: query.ownerId }] });
    const term = normalize(query.q ?? '');
    const like = escapeLike(term); // comodines de LIKE como texto
    if (term) {
      const or: Prisma.OrdenWhereInput[] = [
        { numero: { contains: like.toUpperCase() } },
        { cliente: { nombreNormalizado: { contains: like } } },
        { equipo: { busqueda: { contains: like } } },
      ];
      const qd = digits(term);
      if (qd.length >= 3) or.push({ cliente: { telefonoNormalizado: { contains: qd } } });
      and.push({ OR: or });
    }
    const now = Date.now();
    const list = (await this.findVisible(user, { AND: and })).map((o) => toOrdenResumen(o, now));
    // Críticas vencidas primero; después por prioridad y antigüedad
    return list.sort(
      (a, b) =>
        Number(b.criticaVencida) - Number(a.criticaVencida) ||
        PRIO_RANK[a.prioridad] - PRIO_RANK[b.prioridad] ||
        a.fechaIngreso.localeCompare(b.fechaIngreso),
    );
  }

  async listByEquipment(user: AuthUser, equipoId: string): Promise<OrdenResumenDto[]> {
    const now = Date.now();
    const list = await this.findVisible(user, { equipoId });
    return list.map((o) => toOrdenResumen(o, now)).sort((a, b) => b.fechaIngreso.localeCompare(a.fechaIngreso));
  }

  async get(user: AuthUser, id: string): Promise<OrdenResumenDto> {
    return toOrdenResumen(await this.loadVisible(this.prisma, user, id));
  }

  private async loadVisible(tx: Tx, user: AuthUser, id: string): Promise<OrdenFull> {
    // Una orden de otro taller responde igual que una inexistente
    const o = await tx.orden.findFirst({ where: { id, tallerId: user.tallerId }, include: ORDER_INCLUDE });
    if (!o) throw new NotFoundException('La orden no existe');
    if (!can(user.roles, 'order.view.all') && !isAssignedTo(o, user)) throw new ForbiddenException('Esta orden no está asignada a vos');
    return o;
  }

  // ------------------------------------------------------------------ alta

  async create(user: AuthUser, dto: CreateOrderDto): Promise<OrdenResumenDto> {
    const t = user.tallerId;
    const taller = await this.prisma.taller.findUnique({ where: { id: t } });
    if (!taller?.configurado) {
      throw new WorkflowException('El taller todavía no está configurado', [
        'Antes de usar el sistema, un Admin tiene que asignar todos los roles (Supervisor, Recepción y Técnico) y terminar la configuración',
      ]);
    }
    const [cliente, equipo, servicio, responsable, tecnico] = await Promise.all([
      this.prisma.cliente.findFirst({ where: { id: dto.clienteId, tallerId: t } }),
      this.prisma.equipo.findFirst({ where: { id: dto.equipoId, tallerId: t } }),
      this.prisma.servicio.findFirst({ where: { id: dto.servicioId, tallerId: t } }),
      this.prisma.usuario.findFirst({ where: { id: dto.responsableId, tallerId: t } }),
      dto.tecnicoId ? this.prisma.usuario.findFirst({ where: { id: dto.tecnicoId, tallerId: t } }) : Promise.resolve(null),
    ]);
    const missing: string[] = [];
    if (!cliente) missing.push('Falta el cliente');
    if (!equipo) missing.push('Falta el equipo');
    else if (equipo.clienteId !== dto.clienteId) missing.push('El equipo no pertenece al cliente');
    if (!servicio?.activo) missing.push('Falta el servicio');
    if (!responsable?.activo) missing.push('Falta el responsable');
    if (dto.tecnicoId && (!tecnico?.roles.includes('TECNICO') || !tecnico.activo)) missing.push('El técnico asignado no es válido');
    const estimada = new Date(dto.fechaEstimada);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (estimada < startOfToday) missing.push('La fecha estimada no puede ser anterior a hoy');
    else if (estimada.getTime() >= limiteFechaEstimada(startOfToday.getTime())) {
      missing.push(`La fecha estimada no puede ser más de ${MAX_DIAS_ESTIMADA} días después de hoy`);
    }
    if (missing.length) throw new BadRequestException({ message: 'No se puede crear la orden', details: missing });

    const year = new Date().getFullYear();
    const created = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.contador.upsert({
        where: { clave: `orden-${t}-${year}` },
        create: { clave: `orden-${t}-${year}`, valor: 1 },
        update: { valor: { increment: 1 } },
      });
      return tx.orden.create({
        data: {
          numero: `OS-${year}-${String(counter.valor).padStart(4, '0')}`,
          tallerId: t,
          clienteId: dto.clienteId,
          equipoId: dto.equipoId,
          servicioId: dto.servicioId,
          responsableId: dto.responsableId,
          tecnicoId: dto.tecnicoId || null,
          fallaReportada: dto.fallaReportada,
          impacto: dto.impacto,
          urgencia: dto.urgencia,
          prioridad: calculatePriority(dto.impacto, dto.urgencia), // nunca se confía en la del cliente
          fechaEstimada: estimada,
          historial: {
            create: { usuarioId: user.id, tipo: 'CREACION', comentario: 'Orden creada en recepción', estadoNuevo: 'RECIBIDO' },
          },
        },
        include: ORDER_INCLUDE,
      });
    });
    return toOrdenResumen(created);
  }

  // ------------------------------------------------------------------ acciones del workflow

  /** Carga, aplica reglas, actualiza y registra historial en una sola transacción. */
  private mutate(user: AuthUser, id: string, fn: (o: OrdenFull, tx: Tx) => Promise<Mutation> | Mutation): Promise<OrdenResumenDto> {
    return this.prisma.$transaction(async (tx) => {
      const o = await this.loadVisible(tx, user, id);
      const m = await fn(o, tx);
      await tx.orden.update({ where: { id }, data: m.data });
      await tx.historial.create({
        data: {
          ordenId: id,
          usuarioId: user.id,
          tipo: m.tipo,
          comentario: m.comentario,
          estadoAnterior: m.estadoAnterior ?? null,
          estadoNuevo: m.estadoNuevo ?? null,
        },
      });
      return toOrdenResumen(await tx.orden.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE }));
    });
  }

  update(user: AuthUser, id: string, dto: UpdateOrderDto): Promise<OrdenResumenDto> {
    return this.mutate(user, id, async (o, tx) => {
      if (o.estado === 'CERRADO') throw new WorkflowException('La orden está cerrada: reabrila para editarla');
      const editingContent = dto.diagnostico !== undefined || dto.solucion !== undefined;
      if (editingContent && !canActOnOrder(user, o, 'edit')) {
        throw new ForbiddenException('No podés editar el diagnóstico ni la solución de esta orden');
      }
      const reassigning = dto.tecnicoId !== undefined || dto.responsableId !== undefined;
      if (reassigning && !can(user.roles, 'order.assign')) throw new ForbiddenException('Tu rol no puede reasignar órdenes');
      const reprioritizing = dto.impacto !== undefined || dto.urgencia !== undefined;
      if (reprioritizing && !can(user.roles, 'order.edit')) {
        throw new ForbiddenException('Solo un Supervisor o Admin puede cambiar impacto y urgencia');
      }

      const data: Prisma.OrdenUpdateInput = {};
      const cambios: string[] = [];
      if (dto.diagnostico !== undefined) {
        data.diagnostico = dto.diagnostico || null;
        cambios.push('diagnóstico');
      }
      if (dto.solucion !== undefined) {
        data.solucion = dto.solucion || null;
        data.validada = false; // la validación aplica a la solución vigente
        data.validadaPor = { disconnect: true };
        cambios.push('solución');
      }
      if (dto.tecnicoId !== undefined) {
        if (dto.tecnicoId) {
          const t = await tx.usuario.findFirst({ where: { id: dto.tecnicoId, tallerId: user.tallerId } });
          if (!t?.roles.includes('TECNICO') || !t.activo) throw new BadRequestException('Técnico inválido');
          data.tecnico = { connect: { id: dto.tecnicoId } };
        } else {
          // Una orden en curso sin técnico quedaría huérfana (ningún técnico la vería)
          if (o.estado !== 'RECIBIDO') {
            throw new WorkflowException('No se puede quitar el técnico', [
              'La orden ya está en curso: asigná otro técnico en lugar de dejarla sin asignar',
            ]);
          }
          data.tecnico = { disconnect: true };
        }
        cambios.push('técnico');
      }
      if (dto.responsableId !== undefined) {
        const r = await tx.usuario.findFirst({ where: { id: dto.responsableId, tallerId: user.tallerId } });
        if (!r?.activo) throw new BadRequestException('Responsable inválido');
        data.responsable = { connect: { id: dto.responsableId } };
        cambios.push('responsable');
      }
      if (reprioritizing) {
        const impacto = dto.impacto ?? o.impacto;
        const urgencia = dto.urgencia ?? o.urgencia;
        Object.assign(data, { impacto, urgencia, prioridad: calculatePriority(impacto, urgencia) });
        cambios.push('prioridad');
      }
      if (cambios.length === 0) throw new BadRequestException('No hay cambios para guardar');
      return { data, tipo: 'ACTUALIZACION', comentario: dto.comentario || `Actualizado: ${cambios.join(', ')}` };
    });
  }

  transition(user: AuthUser, id: string, dto: TransitionDto): Promise<OrdenResumenDto> {
    return this.mutate(user, id, (o) => {
      enforce(canTransition(o, dto.to, user), `No se puede mover a «${ESTADO_LABEL[dto.to]}»`);
      const data: Prisma.OrdenUpdateInput = { estado: dto.to };
      if (dto.to === 'CERRADO') Object.assign(data, { fechaCierre: new Date(), resultado: o.resultado ?? 'REPARADO' });
      return {
        data,
        tipo: dto.to === 'CERRADO' ? 'CIERRE' : 'TRANSICION',
        comentario: dto.comentario,
        estadoAnterior: o.estado,
        estadoNuevo: dto.to,
      };
    });
  }

  block(user: AuthUser, id: string, motivo: string): Promise<OrdenResumenDto> {
    return this.mutate(user, id, (o) => {
      enforce(canBlock(o, user), 'No se puede bloquear la orden');
      return { data: { bloqueada: true, motivoBloqueo: motivo }, tipo: 'BLOQUEO', comentario: motivo };
    });
  }

  unblock(user: AuthUser, id: string, comentario: string): Promise<OrdenResumenDto> {
    return this.mutate(user, id, (o) => {
      enforce(canUnblock(o, user), 'No se puede desbloquear la orden');
      return { data: { bloqueada: false, motivoBloqueo: null }, tipo: 'DESBLOQUEO', comentario };
    });
  }

  escalate(user: AuthUser, id: string, dto: EscalateDto): Promise<OrdenResumenDto> {
    return this.mutate(user, id, async (o, tx) => {
      enforce(canEscalate(o, user, dto.causa), 'No se puede escalar la orden');
      const nivel = escalationTarget(o, user) ?? 2;
      await tx.escalamiento.create({ data: { ordenId: id, nivel, causa: dto.causa, motivo: dto.motivo, creadoPorId: user.id } });
      return { data: { escalada: true, motivoEscalado: dto.motivo }, tipo: 'ESCALADO', comentario: `Nivel ${nivel}: ${dto.motivo}` };
    });
  }

  takeEscalation(user: AuthUser, id: string): Promise<OrdenResumenDto> {
    return this.mutate(user, id, async (o, tx) => {
      enforce(canTakeEscalation(o, user), 'No se puede tomar el escalamiento');
      const esc = openEscalation(o)!;
      await tx.escalamiento.update({ where: { id: esc.id }, data: { estado: 'TOMADO', tomadoPorId: user.id, tomadoEn: new Date() } });
      return { data: {}, tipo: 'ESCALADO_TOMADO', comentario: `Tomado por ${user.nombre}` };
    });
  }

  raiseEscalation(user: AuthUser, id: string, motivo: string): Promise<OrdenResumenDto> {
    return this.mutate(user, id, async (o, tx) => {
      enforce(canRaiseEscalation(o, user), 'No se puede subir de nivel');
      const esc = openEscalation(o)!;
      await tx.escalamiento.update({
        where: { id: esc.id },
        data: { nivel: esc.nivel + 1, estado: 'ABIERTO', tomadoPorId: null, tomadoEn: null },
      });
      return { data: {}, tipo: 'ESCALADO_NIVEL', comentario: `Sube a nivel ${esc.nivel + 1}: ${motivo}` };
    });
  }

  resolveEscalation(user: AuthUser, id: string, dto: ResolveEscalationDto): Promise<OrdenResumenDto> {
    return this.mutate(user, id, async (o, tx) => {
      enforce(canResolveEscalation(o, user), 'No se puede resolver el escalamiento');
      const esc = openEscalation(o)!;
      const data: Prisma.OrdenUpdateInput = { escalada: false, motivoEscalado: null };
      let estadoNuevo: EstadoOrden | undefined;

      if (RESOLUCIONES_SIN_REPARACION.includes(dto.resolucion)) {
        const missing = sinReparacionMissing(o, dto.texto, dto.avisoCliente);
        if (missing.length) throw new WorkflowException('No se puede cerrar sin reparación', missing);
        estadoNuevo = 'LISTO_PARA_RETIRAR';
        // Quien decide que no se repara ya valida la orden: no hace falta la validación aparte
        Object.assign(data, {
          estado: estadoNuevo,
          resultado: dto.resolucion,
          informeNoReparacion: dto.texto,
          avisoCliente: dto.avisoCliente,
          bloqueada: false,
          motivoBloqueo: null,
          validada: true,
          validadaPor: { connect: { id: user.id } },
        });
      } else if (dto.resolucion === 'EN_ESPERA') {
        Object.assign(data, { bloqueada: true, motivoBloqueo: dto.texto });
        // Marca desde cuándo está en espera, para volver a escalar si pasa el plazo
        if (!o.bloqueada) {
          await tx.historial.create({ data: { ordenId: id, usuarioId: user.id, tipo: 'BLOQUEO', comentario: dto.texto } });
        }
      } else if (dto.tecnicoId) {
        const t = await tx.usuario.findFirst({ where: { id: dto.tecnicoId, tallerId: user.tallerId } });
        if (!t?.roles.includes('TECNICO') || !t.activo) throw new BadRequestException('Técnico inválido');
        data.tecnico = { connect: { id: dto.tecnicoId } };
      }

      await tx.escalamiento.update({
        where: { id: esc.id },
        data: {
          estado: 'RESUELTO',
          resolucion: dto.resolucion,
          textoResolucion: dto.texto,
          resueltoPorId: user.id,
          resueltoEn: new Date(),
        },
      });
      return {
        data,
        tipo: 'ESCALADO_RESUELTO',
        comentario: `${RESOLUCION_LABEL[dto.resolucion]}: ${dto.texto}`,
        estadoAnterior: estadoNuevo ? o.estado : undefined,
        estadoNuevo,
      };
    });
  }

  abandon(user: AuthUser, id: string, motivo: string): Promise<OrdenResumenDto> {
    return this.mutate(user, id, (o) => {
      const listo = o.historial.findLast((h) => h.estadoNuevo === 'LISTO_PARA_RETIRAR');
      enforce(canAbandon(o, user, listo?.fecha.getTime() ?? null, Date.now()), 'No se puede marcar como abandonado');
      return {
        data: { estado: 'CERRADO', fechaCierre: new Date(), resultado: 'ABANDONADO' },
        tipo: 'CIERRE',
        comentario: `Equipo abandonado: ${motivo}`,
        estadoAnterior: o.estado,
        estadoNuevo: 'CERRADO',
      };
    });
  }

  /**
   * Escalamiento automático: críticas, atrasadas y bloqueadas que superan su plazo, y escalamientos
   * que nadie toma. Las acciones quedan en el historial sin usuario (las hizo el sistema).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncEscalations(nowMs: number = Date.now()): Promise<number> {
    const orders = await this.prisma.orden.findMany({
      where: { estado: { notIn: ['CERRADO', 'LISTO_PARA_RETIRAR'] } },
      include: { escalamientos: true, historial: { where: { tipo: 'BLOQUEO' }, orderBy: { fecha: 'desc' }, take: 1 } },
    });
    let count = 0;
    for (const o of orders) {
      const action = autoEscalation(
        {
          estado: o.estado,
          prioridad: o.prioridad,
          fechaIngresoMs: o.fechaIngreso.getTime(),
          fechaEstimadaMs: o.fechaEstimada.getTime(),
          bloqueadaDesdeMs: o.bloqueada ? (o.historial[0]?.fecha.getTime() ?? null) : null,
          escalamientos: o.escalamientos.map((e) => ({
            estado: e.estado,
            nivel: e.nivel,
            causa: e.causa,
            creadoEnMs: e.creadoEn.getTime(),
            resueltoEnMs: e.resueltoEn?.getTime() ?? null,
          })),
        },
        nowMs,
      );
      if (!action) continue;
      try {
        await this.prisma.$transaction(async (tx) => {
          if (action.accion === 'crear') {
            await tx.escalamiento.create({
              data: { ordenId: o.id, nivel: action.nivel, causa: action.causa, motivo: action.motivo, automatico: true },
            });
            await tx.orden.update({ where: { id: o.id }, data: { escalada: true, motivoEscalado: action.motivo } });
            await tx.historial.create({
              data: { ordenId: o.id, tipo: 'ESCALADO', comentario: `Nivel ${action.nivel}: ${action.motivo}` },
            });
          } else {
            const esc = openEscalation(o)!;
            await tx.escalamiento.update({
              where: { id: esc.id },
              data: { nivel: esc.nivel + 1, estado: 'ABIERTO', tomadoPorId: null, tomadoEn: null },
            });
            await tx.historial.create({
              data: { ordenId: o.id, tipo: 'ESCALADO_NIVEL', comentario: `Sube a nivel ${esc.nivel + 1}: ${action.motivo}` },
            });
          }
        });
        count++;
      } catch (e) {
        // Alguien escaló la orden a mano en este momento: ya tiene su escalamiento
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    if (count) this.logger.log(`${count} escalamiento(s) automático(s)`);
    return count;
  }

  reopen(user: AuthUser, id: string, dto: ReopenDto): Promise<OrdenResumenDto> {
    return this.mutate(user, id, (o) => {
      enforce(canReopen(o, user), 'No se puede reabrir la orden');
      return {
        data: {
          estado: dto.to,
          fechaCierre: null,
          validada: false,
          validadaPor: { disconnect: true },
          resultado: null,
          informeNoReparacion: null,
          avisoCliente: null,
        },
        tipo: 'REAPERTURA',
        comentario: dto.motivo,
        estadoAnterior: o.estado,
        estadoNuevo: dto.to,
      };
    });
  }

  validate(user: AuthUser, id: string, comentario: string): Promise<OrdenResumenDto> {
    return this.mutate(user, id, (o) => {
      enforce(canValidate(o, user), 'No se puede validar la orden');
      return { data: { validada: true, validadaPor: { connect: { id: user.id } } }, tipo: 'VALIDACION', comentario };
    });
  }

  // ------------------------------------------------------------------ evidencia

  /** Permiso, cupo de la orden y lugar en el disco: se controla antes de recibir el archivo. */
  async assertPuedeSubir(user: AuthUser, id: string): Promise<void> {
    const o = await this.loadVisible(this.prisma, user, id);
    this.assertCanEditEvidence(user, o);
    this.assertCupoEvidencias(o);
    if (!(await this.storage.hayLugar())) {
      eventoSeguridad('evidencia.disco_lleno', { usuario: user.id });
      throw new ServiceUnavailableException('No hay espacio para guardar archivos. Avisale al administrador del sistema.');
    }
  }

  async addEvidence(user: AuthUser, id: string, file: UploadedEvidence | undefined): Promise<OrdenResumenDto> {
    if (!file) throw new BadRequestException('Falta el archivo de evidencia (campo «file»)');
    if (!EVIDENCE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('La evidencia debe ser una foto (JPG, PNG, WebP, GIF, HEIC) o un PDF');
    }
    const problema = problemaEvidencia(file.mimetype, file.buffer);
    if (problema) {
      eventoSeguridad('evidencia.rechazada', { usuario: user.id, orden: id, tipo: file.mimetype, motivo: problema });
      throw new BadRequestException(problema);
    }
    // multer entrega el nombre en latin1: se recupera el UTF-8 original (tildes, ñ)
    const nombre = nombreSeguro(Buffer.from(file.originalname, 'latin1').toString('utf8'));

    // Validar permisos antes de escribir en disco
    const o = await this.loadVisible(this.prisma, user, id);
    this.assertCanEditEvidence(user, o);

    const ruta = await this.storage.save(id, file.buffer, file.mimetype);
    try {
      return await this.mutate(user, id, async (fresh, tx) => {
        this.assertCanEditEvidence(user, fresh);
        this.assertCupoEvidencias(fresh);
        await tx.evidencia.create({
          data: {
            ordenId: id,
            nombreArchivo: nombre,
            tipoMime: file.mimetype,
            tamanoKb: Math.max(1, Math.round(file.size / 1024)),
            ruta,
            subidaPorId: user.id,
          },
        });
        return { data: {}, tipo: 'ACTUALIZACION', comentario: `Evidencia adjunta: ${nombre}` };
      });
    } catch (e) {
      await this.storage.remove(ruta); // no dejar archivos huérfanos
      throw e;
    }
  }

  async removeEvidence(user: AuthUser, id: string, evidenciaId: string): Promise<OrdenResumenDto> {
    let ruta = '';
    const res = await this.mutate(user, id, async (o, tx) => {
      this.assertCanEditEvidence(user, o);
      const ev = o.evidencias.find((e) => e.id === evidenciaId);
      if (!ev) throw new NotFoundException('La evidencia no existe');
      ruta = ev.ruta;
      await tx.evidencia.delete({ where: { id: ev.id } });
      return {
        data: { validada: false, validadaPor: { disconnect: true } },
        tipo: 'ACTUALIZACION',
        comentario: `Evidencia quitada: ${ev.nombreArchivo}`,
      };
    });
    await this.storage.remove(ruta);
    return res;
  }

  async evidenceFile(user: AuthUser, id: string, evidenciaId: string) {
    const o = await this.loadVisible(this.prisma, user, id);
    const ev = o.evidencias.find((e) => e.id === evidenciaId);
    if (!ev) throw new NotFoundException('La evidencia no existe');
    const path = this.storage.absolute(ev.ruta);
    if (!(await this.storage.exists(ev.ruta))) throw new NotFoundException('El archivo de la evidencia no está disponible');
    return { path, mime: ev.tipoMime, nombre: ev.nombreArchivo };
  }

  private assertCupoEvidencias(o: OrdenFull): void {
    if (o.evidencias.length >= MAX_EVIDENCIAS) {
      throw new WorkflowException('La orden ya tiene muchas evidencias', [`Como máximo ${MAX_EVIDENCIAS} archivos por orden: quitá alguno para subir otro`]);
    }
  }

  private assertCanEditEvidence(user: AuthUser, o: OrdenFull): void {
    if (o.estado === 'CERRADO') throw new WorkflowException('La orden está cerrada');
    if (!canActOnOrder(user, o, 'edit')) throw new ForbiddenException('No podés modificar la evidencia de esta orden');
  }
}
