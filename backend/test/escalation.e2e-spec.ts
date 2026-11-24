/**
 * Escalamientos: niveles, ciclo abierto → tomado → resuelto, «sin reparación», entrega por
 * Recepción, abandono y escalamiento automático. Esquema propio de PostgreSQL (e2e_escalation).
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { dropTestSchema, fakePng, testDatabaseUrl } from './test-db';

process.env.DATABASE_URL = testDatabaseUrl('e2e_escalation');
process.env.UPLOAD_DIR = 'uploads-test-esc';
process.env.JWT_SECRET = 'test-secret-de-al-menos-treinta-y-dos-caracteres';

import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';

type Agent = ReturnType<typeof request.agent>;
interface Esc { nivel: number; causa: string; estado: string; automatico: boolean; resolucion: string | null; tomadoPor: { nombre: string } | null }
interface Orden {
  id: string; estado: string; escalada: boolean; bloqueada: boolean; validada: boolean; resultado: string | null;
  tecnicoId: string | null; informeNoReparacion: string | null; escalamientos: Esc[];
  historial: { tipo: string; comentario: string; usuario: { nombre: string } }[];
}
interface ErrBody { details?: string[] }

const root = resolve(__dirname, '..');
const run = (cmd: string) => execSync(cmd, { cwd: root, env: { ...process.env }, stdio: 'pipe' });
const H = 3_600_000;
const in3d = () => new Date(Date.now() + 3 * 864e5).toISOString();

describe('Escalamientos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let admin: Agent, sup: Agent, recep: Agent, tec: Agent;
  let users: { id: string; nombre: string }[];
  let servicioId: string, clienteId: string, equipoId: string;

  const uid = (nombre: string) => users.find((u) => u.nombre === nombre)!.id;

  async function login(email: string): Promise<Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password: 'demo1234' }).expect(200);
    return agent;
  }

  async function nuevaOrden(extra: Record<string, unknown> = {}): Promise<Orden> {
    const res = await recep.post('/api/orders').send({
      clienteId, equipoId, servicioId, responsableId: uid('Ana Ríos'), tecnicoId: uid('Carlos Ibáñez'),
      fallaReportada: 'No enciende al presionar el botón', impacto: 'MEDIO', urgencia: 'MEDIA', fechaEstimada: in3d(), ...extra,
    });
    expect(res.status).toBe(201);
    return res.body as Orden;
  }

  const ver = async (id: string) => (await sup.get(`/api/orders/${id}`).expect(200)).body as Orden;
  const escalar = (a: Agent, id: string, causa = 'TECNICA') =>
    a.post(`/api/orders/${id}/escalate`).send({ causa, motivo: 'No se encuentra la causa de la falla' });
  const evidencia = (id: string) =>
    tec.post(`/api/orders/${id}/evidence`).attach('file', fakePng(50), { filename: 'daño.png', contentType: 'image/png' }).expect(201);

  async function hastaListo(id: string): Promise<void> {
    await tec.post(`/api/orders/${id}/transitions`).send({ to: 'EN_DIAGNOSTICO', comentario: 'Empiezo' }).expect(201);
    await tec.patch(`/api/orders/${id}`).send({ diagnostico: 'Fuente quemada' }).expect(200);
    await tec.post(`/api/orders/${id}/transitions`).send({ to: 'EN_REPARACION', comentario: 'Reparando' }).expect(201);
    await tec.post(`/api/orders/${id}/transitions`).send({ to: 'PRUEBAS', comentario: 'A pruebas' }).expect(201);
    await tec.patch(`/api/orders/${id}`).send({ solucion: 'Reemplazo de la fuente' }).expect(200);
    await tec.post(`/api/orders/${id}/transitions`).send({ to: 'LISTO_PARA_RETIRAR', comentario: 'Listo' }).expect(201);
  }

  beforeAll(async () => {
    await dropTestSchema(process.env.DATABASE_URL!);
    rmSync(resolve(root, 'uploads-test-esc'), { recursive: true, force: true });
    run('npx prisma migrate deploy');
    run('npx tsx test/seed-pruebas.ts');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);

    admin = await login('admin@serviciotecnico.local');
    sup = await login('supervisor@serviciotecnico.local');
    recep = await login('recepcion@serviciotecnico.local');
    tec = await login('carlos@serviciotecnico.local');
    users = (await sup.get('/api/users').expect(200)).body as typeof users;
    servicioId = ((await sup.get('/api/services')).body as { id: string }[])[0]!.id;
    clienteId = ((await recep.post('/api/clients').send({ nombre: 'Rosa Díaz', telefono: '11 7777-0001' }).expect(201)).body as { id: string }).id;
    equipoId = ((await recep.post('/api/equipment').send({
      clienteId, tipo: 'NOTEBOOK', marca: 'Dell', modelo: 'Inspiron', numeroSerie: 'ESC-001',
    }).expect(201)).body as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    rmSync(resolve(root, process.env.UPLOAD_DIR!), { recursive: true, force: true });
    await dropTestSchema(process.env.DATABASE_URL!); // no dejar datos de prueba
  });

  describe('quién escala y a qué nivel', () => {
    it('el técnico escala sus órdenes a nivel 2; el supervisor, a nivel 3; Admin no tiene a quién', async () => {
      const a = await nuevaOrden();
      expect(((await escalar(tec, a.id).expect(201)).body as Orden).escalamientos[0]).toMatchObject({ nivel: 2, estado: 'ABIERTO' });
      await escalar(sup, a.id).expect(422); // ya tiene uno abierto

      const b = await nuevaOrden();
      expect(((await escalar(sup, b.id).expect(201)).body as Orden).escalamientos[0]?.nivel).toBe(3);

      const c = await nuevaOrden();
      const r = await escalar(admin, c.id).expect(422);
      expect((r.body as ErrBody).details).toContain('Admin es el último nivel: no hay a quién escalar');
    });

    it('Recepción solo escala reclamos del cliente o plazos, y ve Alertas', async () => {
      const o = await nuevaOrden();
      await escalar(recep, o.id, 'TECNICA').expect(422);
      await escalar(recep, o.id, 'RECLAMO_CLIENTE').expect(201);
      await recep.get('/api/alerts').expect(200);
    });

    it('no acepta causas automáticas a mano', async () => {
      const o = await nuevaOrden();
      await escalar(tec, o.id, 'CRITICA_24H').expect(400);
    });
  });

  describe('ciclo', () => {
    it('hay que tomarlo antes de resolverlo, y lo atiende su nivel', async () => {
      const o = await nuevaOrden();
      await escalar(tec, o.id).expect(201);
      await tec.post(`/api/orders/${o.id}/escalation/take`).expect(422);
      await sup.post(`/api/orders/${o.id}/escalation/resolve`).send({ resolucion: 'CONTINUAR', texto: 'Probar con otra fuente' }).expect(422);
      const tomado = (await sup.post(`/api/orders/${o.id}/escalation/take`).expect(201)).body as Orden;
      expect(tomado.escalamientos[0]).toMatchObject({ estado: 'TOMADO', tomadoPor: { nombre: 'Ana Ríos' } });
      await admin.post(`/api/orders/${o.id}/escalation/take`).expect(422); // ya está tomado

      const otro = uid('Julieta Paz');
      const r = (await sup.post(`/api/orders/${o.id}/escalation/resolve`)
        .send({ resolucion: 'CONTINUAR', texto: 'Lo sigue Julieta, tiene experiencia en placas', tecnicoId: otro }).expect(201)).body as Orden;
      expect(r.escalada).toBe(false);
      expect(r.tecnicoId).toBe(otro);
      expect(r.escalamientos[0]).toMatchObject({ estado: 'RESUELTO', resolucion: 'CONTINUAR' });
      expect(r.historial.map((h) => h.tipo)).toEqual(expect.arrayContaining(['ESCALADO', 'ESCALADO_TOMADO', 'ESCALADO_RESUELTO']));
    });

    it('subir de nivel lo deja sin tomar y el nivel anterior ya no lo atiende', async () => {
      const o = await nuevaOrden();
      await escalar(tec, o.id).expect(201);
      await sup.post(`/api/orders/${o.id}/escalation/take`).expect(201);
      const r = (await sup.post(`/api/orders/${o.id}/escalation/raise`).send({ motivo: 'Supera lo que puedo autorizar' }).expect(201)).body as Orden;
      expect(r.escalamientos[0]).toMatchObject({ nivel: 3, estado: 'ABIERTO', tomadoPor: null });
      await sup.post(`/api/orders/${o.id}/escalation/take`).expect(422);
      await admin.post(`/api/orders/${o.id}/escalation/take`).expect(201);
      await admin.post(`/api/orders/${o.id}/escalation/raise`).send({ motivo: 'No hay más niveles que este' }).expect(422);
    });

    it('en espera bloquea la orden', async () => {
      const o = await nuevaOrden();
      await escalar(tec, o.id, 'REPUESTO').expect(201);
      await sup.post(`/api/orders/${o.id}/escalation/take`).expect(201);
      const r = (await sup.post(`/api/orders/${o.id}/escalation/resolve`).send({ resolucion: 'EN_ESPERA', texto: 'Esperando la pantalla del proveedor' }).expect(201)).body as Orden;
      expect(r.bloqueada).toBe(true);
      expect(r.historial.at(-2)?.tipo).toBe('BLOQUEO');
    });

    it('no se puede cerrar con un escalamiento abierto', async () => {
      const o = await nuevaOrden();
      await hastaListo(o.id);
      await evidencia(o.id);
      await sup.post(`/api/orders/${o.id}/validate`).send({ comentario: 'Revisado' }).expect(201);
      await escalar(tec, o.id).expect(201);
      const r = await sup.post(`/api/orders/${o.id}/transitions`).send({ to: 'CERRADO', comentario: 'Entregado' }).expect(422);
      expect((r.body as ErrBody).details).toContain('Hay un escalamiento abierto: primero hay que resolverlo');
    });
  });

  describe('sin reparación', () => {
    const informe = 'La placa tiene corrosión extendida y no hay repuesto; se ofreció recuperar los datos.';

    it('exige diagnóstico, evidencia, informe y aviso; después Recepción entrega', async () => {
      const o = await nuevaOrden();
      await tec.post(`/api/orders/${o.id}/transitions`).send({ to: 'EN_DIAGNOSTICO', comentario: 'Empiezo' }).expect(201);
      await escalar(tec, o.id).expect(201);
      await sup.post(`/api/orders/${o.id}/escalation/take`).expect(201);

      const faltan = await sup.post(`/api/orders/${o.id}/escalation/resolve`).send({ resolucion: 'NO_REPARABLE', texto: 'No tiene arreglo' }).expect(422);
      expect((faltan.body as ErrBody).details).toEqual([
        'Falta cargar el diagnóstico',
        'Falta adjuntar al menos una evidencia',
        'Falta el informe de no reparación (mínimo 20 caracteres)',
        'Falta la constancia de aviso al cliente',
      ]);

      await tec.patch(`/api/orders/${o.id}`).send({ diagnostico: 'Corrosión en placa' }).expect(200);
      await evidencia(o.id);
      const r = (await sup.post(`/api/orders/${o.id}/escalation/resolve`)
        .send({ resolucion: 'NO_REPARABLE', texto: informe, avisoCliente: 'Llamó Martín, atendió Rosa' }).expect(201)).body as Orden;
      expect(r).toMatchObject({ estado: 'LISTO_PARA_RETIRAR', resultado: 'NO_REPARABLE', validada: true, escalada: false, informeNoReparacion: informe });

      // Sin reparar no vuelve al taller salvo reabriendo
      await sup.post(`/api/orders/${o.id}/transitions`).send({ to: 'PRUEBAS', comentario: 'Volver' }).expect(422);

      const c = (await recep.post(`/api/orders/${o.id}/transitions`).send({ to: 'CERRADO', comentario: 'Entregado sin reparar a Rosa' }).expect(201)).body as Orden;
      expect(c).toMatchObject({ estado: 'CERRADO', resultado: 'NO_REPARABLE' });

      const re = (await sup.post(`/api/orders/${o.id}/reopen`).send({ to: 'EN_REPARACION', motivo: 'Apareció un repuesto compatible' }).expect(201)).body as Orden;
      expect(re).toMatchObject({ resultado: null, informeNoReparacion: null, validada: false });
    });

    it('rechazado por el cliente desbloquea la orden y sale del escalamiento', async () => {
      const o = await nuevaOrden();
      await tec.post(`/api/orders/${o.id}/transitions`).send({ to: 'EN_DIAGNOSTICO', comentario: 'Empiezo' }).expect(201);
      await tec.patch(`/api/orders/${o.id}`).send({ diagnostico: 'Requiere placa nueva' }).expect(200);
      await evidencia(o.id);
      await tec.post(`/api/orders/${o.id}/block`).send({ motivo: 'Esperando aprobación del presupuesto' }).expect(201);
      await escalar(tec, o.id, 'PRESUPUESTO').expect(201);
      await sup.post(`/api/orders/${o.id}/escalation/take`).expect(201);
      const r = (await sup.post(`/api/orders/${o.id}/escalation/resolve`)
        .send({ resolucion: 'RECHAZADO_CLIENTE', texto: 'El cliente no aprueba el presupuesto de la placa', avisoCliente: 'Rosa respondió por WhatsApp' }).expect(201)).body as Orden;
      expect(r).toMatchObject({ resultado: 'RECHAZADO_CLIENTE', bloqueada: false, estado: 'LISTO_PARA_RETIRAR' });
    });
  });

  describe('entrega y abandono', () => {
    it('Recepción entrega una orden reparada solo si está validada', async () => {
      const o = await nuevaOrden();
      await hastaListo(o.id);
      await evidencia(o.id);
      const r = await recep.post(`/api/orders/${o.id}/transitions`).send({ to: 'CERRADO', comentario: 'Entregado a Rosa' }).expect(422);
      expect((r.body as ErrBody).details).toEqual(['Falta la validación visual de un supervisor']);
      await sup.post(`/api/orders/${o.id}/validate`).send({ comentario: 'Revisado' }).expect(201);
      const c = (await recep.post(`/api/orders/${o.id}/transitions`).send({ to: 'CERRADO', comentario: 'Entregado a Rosa' }).expect(201)).body as Orden;
      expect(c).toMatchObject({ estado: 'CERRADO', resultado: 'REPARADO' });
    });

    it('solo Admin marca abandonado, y después de 60 días', async () => {
      const o = await nuevaOrden();
      await hastaListo(o.id);
      const motivo = { motivo: 'Se llamó tres veces sin respuesta' };
      await sup.post(`/api/orders/${o.id}/abandon`).send(motivo).expect(403); // permiso solo del Admin
      await admin.post(`/api/orders/${o.id}/abandon`).send(motivo).expect(422);
      await prisma.historial.updateMany({ where: { ordenId: o.id, estadoNuevo: 'LISTO_PARA_RETIRAR' }, data: { fecha: new Date(Date.now() - 61 * 24 * H) } });
      const c = (await admin.post(`/api/orders/${o.id}/abandon`).send(motivo).expect(201)).body as Orden;
      expect(c).toMatchObject({ estado: 'CERRADO', resultado: 'ABANDONADO' });
    });
  });

  describe('automático', () => {
    // Las órdenes de los otros tests también cuentan: se limpian para medir solo estas
    beforeEach(async () => {
      await prisma.orden.deleteMany();
    });

    it('crítica: nivel 2 a las 24 h, nivel 3 a las 48 h, sin duplicar', async () => {
      const o = await nuevaOrden({ impacto: 'ALTO', urgencia: 'ALTA' });
      await orders.syncEscalations();
      expect((await ver(o.id)).escalamientos).toHaveLength(0);

      await prisma.orden.update({ where: { id: o.id }, data: { fechaIngreso: new Date(Date.now() - 30 * H) } });
      expect(await orders.syncEscalations()).toBe(1);
      expect(await orders.syncEscalations()).toBe(0);
      let v = await ver(o.id);
      expect(v.escalada).toBe(true);
      expect(v.escalamientos).toHaveLength(1);
      expect(v.escalamientos[0]).toMatchObject({ nivel: 2, causa: 'CRITICA_24H', automatico: true });
      expect(v.historial.at(-1)?.usuario.nombre).toBe('Sistema');

      await prisma.orden.update({ where: { id: o.id }, data: { fechaIngreso: new Date(Date.now() - 50 * H) } });
      await orders.syncEscalations();
      v = await ver(o.id);
      expect(v.escalamientos[0]?.nivel).toBe(3);
      expect(v.historial.at(-1)?.tipo).toBe('ESCALADO_NIVEL');
    });

    it('atrasada y bloqueada; una vez resuelta no se repite enseguida', async () => {
      const a = await nuevaOrden();
      await prisma.orden.update({ where: { id: a.id }, data: { fechaEstimada: new Date(Date.now() - 30 * H) } });
      const b = await nuevaOrden();
      await tec.post(`/api/orders/${b.id}/block`).send({ motivo: 'Esperando repuesto del proveedor' }).expect(201);
      await prisma.historial.updateMany({ where: { ordenId: b.id, tipo: 'BLOQUEO' }, data: { fecha: new Date(Date.now() - 50 * H) } });

      expect(await orders.syncEscalations()).toBe(2);
      expect((await ver(a.id)).escalamientos[0]?.causa).toBe('PLAZO');
      expect((await ver(b.id)).escalamientos[0]?.causa).toBe('BLOQUEO_PROLONGADO');

      await sup.post(`/api/orders/${a.id}/escalation/take`).expect(201);
      await sup.post(`/api/orders/${a.id}/escalation/resolve`).send({ resolucion: 'CONTINUAR', texto: 'Se avisó al cliente, nueva fecha' }).expect(201);
      await orders.syncEscalations();
      expect((await ver(a.id)).escalada).toBe(false);
      // Pasado el plazo vuelve a escalar
      await orders.syncEscalations(Date.now() + 25 * H);
      expect((await ver(a.id)).escalamientos).toHaveLength(2);
    });

    it('sin tomar en 24 h sube de nivel; tomado no', async () => {
      const a = await nuevaOrden();
      await escalar(tec, a.id).expect(201);
      const b = await nuevaOrden();
      await escalar(tec, b.id).expect(201);
      await sup.post(`/api/orders/${b.id}/escalation/take`).expect(201);
      await orders.syncEscalations(Date.now() + 25 * H);
      expect((await ver(a.id)).escalamientos[0]?.nivel).toBe(3);
      expect((await ver(b.id)).escalamientos[0]?.nivel).toBe(2);
    });

    it('una orden lista para retirar no escala', async () => {
      const o = await nuevaOrden({ impacto: 'ALTO', urgencia: 'ALTA' });
      await hastaListo(o.id);
      await prisma.orden.update({ where: { id: o.id }, data: { fechaIngreso: new Date(Date.now() - 30 * H) } });
      expect(await orders.syncEscalations()).toBe(0);
    });
  });
});
