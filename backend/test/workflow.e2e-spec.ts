/**
 * Prueba e2e del ciclo completo de una orden contra un esquema propio de PostgreSQL (e2e_workflow).
 * Ejecutar: npm run test:e2e
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { dropTestSchema, fakeJpeg, testDatabaseUrl } from './test-db';

process.env.DATABASE_URL = testDatabaseUrl('e2e_workflow');
process.env.UPLOAD_DIR = 'uploads-test';
process.env.JWT_SECRET = 'test-secret-de-al-menos-treinta-y-dos-caracteres';

// Importar después de setear el entorno
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';

type Agent = ReturnType<typeof request.agent>;

interface Usuario { id: string; rol: string; nombre: string }
interface Orden {
  id: string; numero: string; estado: string; prioridad: string; validada: boolean; escalada: boolean;
  bloqueada: boolean; criticaVencida: boolean; evidencias: { id: string }[]; historial: { tipo: string }[];
}

const root = resolve(__dirname, '..');
const run = (cmd: string) => execSync(cmd, { cwd: root, env: { ...process.env }, stdio: 'pipe' });

describe('Workflow de órdenes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sup: Agent, recep: Agent, tec: Agent, otroTec: Agent;
  let users: Usuario[];
  let servicioId: string;
  let orden: Orden;

  async function login(email: string): Promise<Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password: 'demo1234' }).expect(200);
    return agent;
  }

  beforeAll(async () => {
    await dropTestSchema(process.env.DATABASE_URL!);
    rmSync(resolve(root, 'uploads-test'), { recursive: true, force: true });
    run('npx prisma migrate deploy');
    run('npx tsx test/seed-pruebas.ts');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    sup = await login('supervisor@serviciotecnico.local');
    recep = await login('recepcion@serviciotecnico.local');
    tec = await login('carlos@serviciotecnico.local');
    otroTec = await login('julieta@serviciotecnico.local');
    users = (await sup.get('/api/users').expect(200)).body as Usuario[];
    servicioId = ((await sup.get('/api/services').expect(200)).body as { id: string }[])[0]!.id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    rmSync(resolve(root, process.env.UPLOAD_DIR!), { recursive: true, force: true });
    await dropTestSchema(process.env.DATABASE_URL!); // no dejar datos de prueba
  });

  const userId = (nombre: string) => users.find((u) => u.nombre === nombre)!.id;

  it('rechaza requests sin sesión', async () => {
    await request(app.getHttpServer()).get('/api/orders').expect(401);
  });

  it('recepción registra cliente, equipo y orden; la prioridad la calcula el servidor', async () => {
    const cliente = (await recep.post('/api/clients').send({ nombre: 'Juan Pérez', telefono: '11 5555-1234' }).expect(201)).body as { id: string };
    await recep.post('/api/clients').send({ nombre: 'Otro', telefono: '(11) 5555 1234' }).expect(409);
    const equipo = (await recep
      .post('/api/equipment')
      .send({ clienteId: cliente.id, tipo: 'NOTEBOOK', marca: 'Lenovo', modelo: 'T14', numeroSerie: 'PF2XK9L1' })
      .expect(201)).body as { id: string };
    const res = await recep.post('/api/orders').send({
      clienteId: cliente.id,
      equipoId: equipo.id,
      servicioId,
      responsableId: userId('Ana Ríos'),
      tecnicoId: userId('Carlos Ibáñez'),
      fallaReportada: 'No da video, enciende y apaga',
      impacto: 'ALTO',
      urgencia: 'ALTA',
      prioridad: 'BAJA', // campo extra: el ValidationPipe lo descarta
      fechaEstimada: new Date(Date.now() + 3 * 864e5).toISOString(),
    }).expect(201);
    orden = res.body as Orden;
    expect(orden.numero).toMatch(/^OS-\d{4}-0001$/);
    expect(orden.prioridad).toBe('CRITICA');
    expect(orden.estado).toBe('RECIBIDO');
  });

  it('el técnico ve solo sus órdenes', async () => {
    expect(((await tec.get('/api/orders').expect(200)).body as Orden[]).map((o) => o.id)).toEqual([orden.id]);
    expect((await otroTec.get('/api/orders').expect(200)).body).toEqual([]);
    await otroTec.get(`/api/orders/${orden.id}`).expect(403);
  });

  it('aplica las reglas del workflow con 422 y lista de faltantes', async () => {
    const skip = await tec.post(`/api/orders/${orden.id}/transitions`).send({ to: 'PRUEBAS', comentario: 'salto de estado' }).expect(422);
    expect((skip.body as { details: string[] }).details[0]).toContain('El siguiente paso es «En diagnóstico»');

    await tec.post(`/api/orders/${orden.id}/transitions`).send({ to: 'EN_DIAGNOSTICO', comentario: 'Comienzo diagnóstico' }).expect(201);
    const sinDiag = await tec.post(`/api/orders/${orden.id}/transitions`).send({ to: 'EN_REPARACION', comentario: 'A reparar' }).expect(422);
    expect((sinDiag.body as { details: string[] }).details).toEqual(['Falta cargar el diagnóstico']);

    await tec.patch(`/api/orders/${orden.id}`).send({ diagnostico: 'Chip de video BGA dañado' }).expect(200);
    await tec.post(`/api/orders/${orden.id}/transitions`).send({ to: 'EN_REPARACION', comentario: 'Se procede a reballing' }).expect(201);
  });

  it('bloqueo: el técnico bloquea, solo el supervisor desbloquea', async () => {
    await tec.post(`/api/orders/${orden.id}/block`).send({ motivo: 'Esperando repuesto: chip de video' }).expect(201);
    const bloqueada = await tec.post(`/api/orders/${orden.id}/transitions`).send({ to: 'PRUEBAS', comentario: 'A pruebas' }).expect(422);
    expect((bloqueada.body as { details: string[] }).details).toContain('La orden está bloqueada: primero hay que desbloquearla');
    await tec.post(`/api/orders/${orden.id}/unblock`).send({ comentario: 'Llegó el repuesto' }).expect(422);
    await sup.post(`/api/orders/${orden.id}/unblock`).send({ comentario: 'Llegó el repuesto' }).expect(201);
    await tec.post(`/api/orders/${orden.id}/escalate`).send({ causa: 'TECNICA', motivo: 'Requiere técnico nivel 2' }).expect(201);
    await sup.post(`/api/orders/${orden.id}/escalation/take`).expect(201);
    await sup.post(`/api/orders/${orden.id}/escalation/resolve`).send({ resolucion: 'CONTINUAR', texto: 'Seguir con reballing del chip' }).expect(201);
  });

  it('cierre: exige solución, evidencia y validación', async () => {
    await tec.post(`/api/orders/${orden.id}/transitions`).send({ to: 'PRUEBAS', comentario: 'Reballing hecho' }).expect(201);
    await tec.patch(`/api/orders/${orden.id}`).send({ solucion: 'Reballing del chip de video y prueba de estrés 30 min OK' }).expect(200);
    await tec.post(`/api/orders/${orden.id}/transitions`).send({ to: 'LISTO_PARA_RETIRAR', comentario: 'Listo, avisar' }).expect(201);

    const sinNada = await sup.post(`/api/orders/${orden.id}/transitions`).send({ to: 'CERRADO', comentario: 'Entregado' }).expect(422);
    expect((sinNada.body as { details: string[] }).details).toEqual([
      'Falta adjuntar al menos una evidencia',
      'Falta la validación visual de un supervisor',
    ]);

    // Evidencia: un .txt se rechaza; una imagen se guarda y se puede descargar
    await tec.post(`/api/orders/${orden.id}/evidence`).attach('file', Buffer.from('hola'), { filename: 'notas.txt', contentType: 'text/plain' }).expect(400);
    const conEv = (await tec
      .post(`/api/orders/${orden.id}/evidence`)
      .attach('file', fakeJpeg(2048), { filename: 'placa-reparada.jpg', contentType: 'image/jpeg' })
      .expect(201)).body as Orden;
    expect(conEv.evidencias).toHaveLength(1);
    const file = await sup.get(`/api/orders/${orden.id}/evidence/${conEv.evidencias[0]!.id}/file`).expect(200);
    expect(file.headers['content-type']).toContain('image/jpeg');

    await tec.post(`/api/orders/${orden.id}/validate`).send({ comentario: 'Lo valido yo' }).expect(422);
    await sup.post(`/api/orders/${orden.id}/validate`).send({ comentario: 'Revisado: enciende y da video' }).expect(201);
    await tec.post(`/api/orders/${orden.id}/transitions`).send({ to: 'CERRADO', comentario: 'Entregado' }).expect(422);

    const cerrada = (await sup.post(`/api/orders/${orden.id}/transitions`).send({ to: 'CERRADO', comentario: 'Equipo entregado' }).expect(201)).body as Orden;
    expect(cerrada.estado).toBe('CERRADO');
    expect(cerrada.escalada).toBe(false);
  });

  it('reabrir invalida la validación y deja todo en el historial', async () => {
    const sinPermiso = await recep.post(`/api/orders/${orden.id}/reopen`).send({ to: 'EN_REPARACION', motivo: 'La falla reapareció' }).expect(422);
    expect((sinPermiso.body as { details: string[] }).details).toEqual(['Solo un Supervisor o Admin puede reabrir']);
    const re = (await sup.post(`/api/orders/${orden.id}/reopen`).send({ to: 'EN_REPARACION', motivo: 'La falla reapareció' }).expect(201)).body as Orden;
    expect(re.estado).toBe('EN_REPARACION');
    expect(re.validada).toBe(false);
    expect(re.historial.map((h) => h.tipo)).toEqual([
      'CREACION', 'TRANSICION', 'ACTUALIZACION', 'TRANSICION', 'BLOQUEO', 'DESBLOQUEO', 'ESCALADO', 'ESCALADO_TOMADO',
      'ESCALADO_RESUELTO', 'TRANSICION',
      'ACTUALIZACION', 'TRANSICION', 'ACTUALIZACION', 'VALIDACION', 'CIERRE', 'REAPERTURA',
    ]);
  });

  it('una crítica abierta > 24 h aparece en dashboard e informe crítico', async () => {
    await prisma.orden.update({ where: { id: orden.id }, data: { fechaIngreso: new Date(Date.now() - 30 * 3_600_000) } });
    const dash = (await sup.get('/api/dashboard').expect(200)).body as {
      metrics: { criticasVencidas: number };
      informesCriticos: { id: string; leido: boolean; orden: Orden }[];
    };
    expect(dash.metrics.criticasVencidas).toBe(1);
    expect(dash.informesCriticos[0]!.orden.criticaVencida).toBe(true);
    await sup.patch(`/api/critical-reports/${dash.informesCriticos[0]!.id}/read`).expect(204);
    const again = (await sup.get('/api/dashboard').expect(200)).body as { informesCriticos: { leido: boolean }[] };
    expect(again.informesCriticos[0]!.leido).toBe(true);
    const alerts = (await sup.get('/api/alerts').expect(200)).body as { criticas: Orden[] };
    expect(alerts.criticas).toHaveLength(1);
  });

  it('limita los intentos de login por email (5 por minuto)', async () => {
    const anon = request(app.getHttpServer());
    for (let i = 0; i < 5; i++) {
      await anon.post('/api/auth/login').send({ email: 'x@y.com', password: 'mal' }).expect(401);
    }
    await anon.post('/api/auth/login').send({ email: 'x@y.com', password: 'mal' }).expect(429);
    // otro empleado desde la misma IP no queda bloqueado
    await anon.post('/api/auth/login').send({ email: 'admin@serviciotecnico.local', password: 'demo1234' }).expect(200);
  });
});
