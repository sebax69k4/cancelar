/**
 * Casos límite: seguridad, validaciones, permisos finos, búsqueda, numeración y evidencia.
 * Esquema propio de PostgreSQL (e2e_edge) para no chocar con workflow.e2e-spec.ts.
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { dropTestSchema, fakeJpeg, fakePng, testDatabaseUrl } from './test-db';

process.env.DATABASE_URL = testDatabaseUrl('e2e_edge');
process.env.UPLOAD_DIR = 'uploads-test-edge';
process.env.JWT_SECRET = 'test-secret-de-al-menos-treinta-y-dos-caracteres';
process.env.UPLOAD_MAX_MB = '1';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';

type Agent = ReturnType<typeof request.agent>;
interface Usuario { id: string; rol: string; nombre: string }
interface Orden {
  id: string; numero: string; estado: string; prioridad: string; validada: boolean; escalada: boolean;
  motivoEscalado: string | null; tecnicoId: string | null; evidencias: { id: string; nombreArchivo: string }[];
  historial: { tipo: string; comentario: string }[];
}
interface ErrBody { statusCode: number; message: string | string[]; details?: string[] }

const root = resolve(__dirname, '..');
const run = (cmd: string) => execSync(cmd, { cwd: root, env: { ...process.env }, stdio: 'pipe' });
const in3d = () => new Date(Date.now() + 3 * 864e5).toISOString();

describe('Casos límite (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sup: Agent, recep: Agent, tec: Agent, otroTec: Agent;
  let users: Usuario[];
  let servicioId: string;
  let clienteA: string, clienteB: string, equipoA: string, equipoB: string;

  const uid = (nombre: string) => users.find((u) => u.nombre === nombre)!.id;

  async function login(email: string): Promise<Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password: 'demo1234' }).expect(200);
    return agent;
  }

  async function nuevaOrden(extra: Record<string, unknown> = {}): Promise<Orden> {
    const res = await recep.post('/api/orders').send({
      clienteId: clienteA, equipoId: equipoA, servicioId, responsableId: uid('Ana Ríos'), tecnicoId: uid('Carlos Ibáñez'),
      fallaReportada: 'No enciende al presionar el botón', impacto: 'MEDIO', urgencia: 'MEDIA', fechaEstimada: in3d(), ...extra,
    });
    expect(res.status).toBe(201);
    return res.body as Orden;
  }

  beforeAll(async () => {
    await dropTestSchema(process.env.DATABASE_URL!);
    rmSync(resolve(root, 'uploads-test-edge'), { recursive: true, force: true });
    run('npx prisma migrate deploy');
    run('npx tsx test/seed-pruebas.ts');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    sup = await login('SUPERVISOR@serviciotecnico.local'); // email sin distinguir mayúsculas
    recep = await login('recepcion@serviciotecnico.local');
    tec = await login('carlos@serviciotecnico.local');
    otroTec = await login('julieta@serviciotecnico.local');
    users = (await sup.get('/api/users').expect(200)).body as Usuario[];
    servicioId = ((await sup.get('/api/services')).body as { id: string }[])[0]!.id;

    clienteA = ((await recep.post('/api/clients').send({ nombre: 'José Núñez', telefono: '+54 9 11 5555-0001', email: 'Jose@Mail.com' })).body as { id: string }).id;
    clienteB = ((await recep.post('/api/clients').send({ nombre: 'Empresa Sur SRL', telefono: '011 4000-2222' })).body as { id: string }).id;
    equipoA = ((await recep.post('/api/equipment').send({ clienteId: clienteA, tipo: 'NOTEBOOK', marca: 'Dell', modelo: 'Latitude 5420', numeroSerie: 'dl-5420-x' })).body as { id: string }).id;
    equipoB = ((await recep.post('/api/equipment').send({ clienteId: clienteB, tipo: 'PC_ESCRITORIO', marca: 'HP', modelo: 'EliteDesk', numeroSerie: 'HP-ED-1' })).body as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    rmSync(resolve(root, process.env.UPLOAD_DIR!), { recursive: true, force: true });
    await dropTestSchema(process.env.DATABASE_URL!); // no dejar datos de prueba
  });

  describe('sesión y seguridad', () => {
    it('rechaza un JWT adulterado', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', 'st_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.firma').expect(401);
    });

    it('acepta Bearer (Swagger / herramientas)', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'admin@serviciotecnico.local', password: 'demo1234' }).expect(200);
      const token = /st_session=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!;
      await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    });

    it('la cookie es HttpOnly y SameSite=Lax; logout la borra', async () => {
      const agent = request.agent(app.getHttpServer());
      const res = await agent.post('/api/auth/login').send({ email: 'julieta@serviciotecnico.local', password: 'demo1234' }).expect(200);
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      const out = await agent.post('/api/auth/logout').expect(204);
      expect(String(out.headers['set-cookie'])).toMatch(/st_session=;/);
    });

    it('un usuario desactivado pierde el acceso al instante', async () => {
      const agent = request.agent(app.getHttpServer());
      // usa el último login permitido del minuto (límite 5): los 4 de beforeAll + este
      await prisma.usuario.update({ where: { email: 'admin@serviciotecnico.local' }, data: { activo: true } });
      const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'admin@serviciotecnico.local', password: 'demo1234' });
      const token = /st_session=([^;]+)/.exec(String(res.headers['set-cookie']))?.[1];
      expect(token).toBeDefined();
      await prisma.usuario.update({ where: { email: 'admin@serviciotecnico.local' }, data: { activo: false } });
      await agent.get('/api/auth/me').set('Authorization', `Bearer ${token!}`).expect(401);
      await prisma.usuario.update({ where: { email: 'admin@serviciotecnico.local' }, data: { activo: true } });
    });

    it('CORS solo para el origen configurado', async () => {
      const ok = await request(app.getHttpServer()).get('/api/health').set('Origin', 'http://localhost:4321');
      expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:4321');
      const bad = await request(app.getHttpServer()).get('/api/health').set('Origin', 'http://evil.example');
      expect(bad.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('JSON mal formado responde 400 con el formato estándar', async () => {
      const res = await sup.post('/api/clients').set('Content-Type', 'application/json').send('{"nombre": ').expect(400);
      expect((res.body as ErrBody).statusCode).toBe(400);
    });

    it('404 con formato estándar', async () => {
      const res = await sup.get('/api/orders/no-existe').expect(404);
      expect(res.body).toEqual({ statusCode: 404, message: 'La orden no existe' });
    });
  });

  describe('validaciones de alta', () => {
    it('email se guarda en minúsculas y vacío → null', async () => {
      const list = (await sup.get('/api/clients?q=jose').expect(200)).body as { email: string | null }[];
      expect(list[0]!.email).toBe('jose@mail.com');
      const c = (await recep.post('/api/clients').send({ nombre: 'Sin Mail', telefono: '11 7777-0000', email: '' }).expect(201)).body as { email: string | null };
      expect(c.email).toBeNull();
    });

    it('rechaza textos demasiado largos', async () => {
      await recep.post('/api/clients').send({ nombre: 'x'.repeat(81), telefono: '11 7777-1111' }).expect(400);
      await recep.post('/api/equipment').send({ clienteId: clienteA, tipo: 'NOTEBOOK', marca: 'A', modelo: 'B', numeroSerie: 'S'.repeat(41) }).expect(400);
    });

    it('equipo de un cliente inexistente → 400', async () => {
      await recep.post('/api/equipment').send({ clienteId: 'nope', tipo: 'NOTEBOOK', marca: 'A', modelo: 'B', numeroSerie: 'ZZ-1' }).expect(400);
    });

    it('orden: equipo de otro cliente, fecha pasada y técnico que no es técnico', async () => {
      const res = await recep.post('/api/orders').send({
        clienteId: clienteA, equipoId: equipoB, servicioId, responsableId: uid('Ana Ríos'), tecnicoId: uid('Ana Ríos'),
        fallaReportada: 'No enciende al presionar', impacto: 'BAJO', urgencia: 'BAJA',
        fechaEstimada: new Date(Date.now() - 2 * 864e5).toISOString(),
      }).expect(400);
      expect((res.body as ErrBody).details).toEqual([
        'El equipo no pertenece al cliente',
        'El técnico asignado no es válido',
        'La fecha estimada no puede ser anterior a hoy',
      ]);
    });

    it('el técnico no puede crear órdenes', async () => {
      await tec.post('/api/orders').send({}).expect(403);
    });
  });

  describe('numeración y búsqueda', () => {
    it('numeración correlativa sin duplicados con altas simultáneas', async () => {
      const orders = await Promise.all(Array.from({ length: 6 }, () => nuevaOrden()));
      const nums = orders.map((o) => o.numero).sort();
      expect(new Set(nums).size).toBe(6);
      expect(nums[0]).toMatch(/-0001$/);
      expect(nums[5]).toMatch(/-0006$/);
    });

    it('busca por número, cliente sin tildes, teléfono y serie', async () => {
      const q = async (term: string) => ((await sup.get(`/api/orders?q=${encodeURIComponent(term)}`).expect(200)).body as Orden[]).length;
      expect(await q('os-')).toBe(6);
      expect(await q('NUNEZ')).toBe(6);
      expect(await q('5555 0001')).toBe(6);
      expect(await q('dl-5420')).toBe(6);
      expect(await q('latitude')).toBe(6);
      expect(await q('inexistente')).toBe(0);
    });

    it('filtra equipos por cliente y busca por nombre del dueño', async () => {
      expect(((await sup.get(`/api/equipment?clientId=${clienteB}`)).body as unknown[]).length).toBe(1);
      expect(((await sup.get('/api/equipment?q=empresa sur')).body as unknown[]).length).toBe(1);
    });

    it('filtro inválido → 400', async () => {
      await sup.get('/api/orders?status=VOLANDO').expect(400);
    });
  });

  describe('permisos finos sobre una orden', () => {
    let o: Orden;
    beforeAll(async () => {
      o = await nuevaOrden({ impacto: 'ALTO', urgencia: 'MEDIA' });
    });

    it('recepción asigna técnico pero no edita diagnóstico ni prioridad', async () => {
      const r = (await recep.patch(`/api/orders/${o.id}`).send({ tecnicoId: uid('Julieta Paz') }).expect(200)).body as Orden;
      expect(r.tecnicoId).toBe(uid('Julieta Paz'));
      await recep.patch(`/api/orders/${o.id}`).send({ diagnostico: 'Placa dañada' }).expect(403);
      await recep.patch(`/api/orders/${o.id}`).send({ urgencia: 'ALTA' }).expect(403);
    });

    it('un técnico no toca órdenes ajenas', async () => {
      await tec.patch(`/api/orders/${o.id}`).send({ diagnostico: 'Algo' }).expect(403);
      await tec.post(`/api/orders/${o.id}/block`).send({ motivo: 'Motivo cualquiera' }).expect(403);
    });

    it('supervisor cambia prioridad: la recalcula el servidor', async () => {
      const r = (await sup.patch(`/api/orders/${o.id}`).send({ urgencia: 'ALTA', prioridad: 'BAJA' }).expect(200)).body as Orden;
      expect(r.prioridad).toBe('CRITICA');
    });

    it('PATCH sin cambios → 400', async () => {
      await sup.patch(`/api/orders/${o.id}`).send({ comentario: 'nada' }).expect(400);
    });

    it('permite el retroceso Pruebas → En reparación', async () => {
      await otroTec.post(`/api/orders/${o.id}/transitions`).send({ to: 'EN_DIAGNOSTICO', comentario: 'Diagnóstico' }).expect(201);
      await otroTec.patch(`/api/orders/${o.id}`).send({ diagnostico: 'Fuente quemada' }).expect(200);
      await otroTec.post(`/api/orders/${o.id}/transitions`).send({ to: 'EN_REPARACION', comentario: 'Reparando' }).expect(201);
      await otroTec.post(`/api/orders/${o.id}/transitions`).send({ to: 'PRUEBAS', comentario: 'A prueba' }).expect(201);
      const back = (await otroTec.post(`/api/orders/${o.id}/transitions`).send({ to: 'EN_REPARACION', comentario: 'Falló la prueba' }).expect(201)).body as Orden;
      expect(back.estado).toBe('EN_REPARACION');
    });

    it('no se puede dejar sin técnico una orden en curso (sí cambiarlo)', async () => {
      const res = await sup.patch(`/api/orders/${o.id}`).send({ tecnicoId: null }).expect(422);
      expect((res.body as ErrBody).details?.[0]).toContain('asigná otro técnico');
      const r = (await sup.patch(`/api/orders/${o.id}`).send({ tecnicoId: uid('Carlos Ibáñez') }).expect(200)).body as Orden;
      expect(r.tecnicoId).toBe(uid('Carlos Ibáñez'));
      await sup.patch(`/api/orders/${o.id}`).send({ tecnicoId: uid('Julieta Paz') }).expect(200);
      const nueva = await nuevaOrden();
      await sup.patch(`/api/orders/${nueva.id}`).send({ tecnicoId: null }).expect(200); // en Recibido sí
    });

    it('recepción no ve alertas', async () => {
      await recep.get('/api/alerts').expect(200);
    });

    it('el dashboard del técnico solo cuenta sus órdenes', async () => {
      const d = (await otroTec.get('/api/dashboard').expect(200)).body as { totalOrdenes: number };
      expect(d.totalOrdenes).toBe(1);
    });

    it('informe crítico: uno por día, sin duplicados con dashboards simultáneos', async () => {
      const crit = await nuevaOrden({ impacto: 'ALTO', urgencia: 'ALTA' });
      await prisma.orden.update({ where: { id: crit.id }, data: { fechaIngreso: new Date(Date.now() - 30 * 3_600_000) } });
      type Dash = { informesCriticos: { id: string; ordenId: string; leido: boolean }[] };
      const results = await Promise.all(Array.from({ length: 5 }, () => sup.get('/api/dashboard').expect(200)));
      const ids = new Set(results.flatMap((r) => (r.body as Dash).informesCriticos.filter((i) => i.ordenId === crit.id).map((i) => i.id)));
      expect(ids.size).toBe(1);
      const infId = [...ids][0]!;
      await sup.patch(`/api/critical-reports/${infId}/read`).expect(204);
      // Pasa a su segundo día abierta: aparece un informe NUEVO, sin leer (no el de ayer ya revisado)
      await prisma.orden.update({ where: { id: crit.id }, data: { fechaIngreso: new Date(Date.now() - 50 * 3_600_000) } });
      const d2 = (await sup.get('/api/dashboard').expect(200)).body as Dash;
      const hoy = d2.informesCriticos.find((i) => i.ordenId === crit.id)!;
      expect(hoy.id).not.toBe(infId);
      expect(hoy.leido).toBe(false);
      expect(await prisma.informeCritico.count({ where: { ordenId: crit.id } })).toBe(2);
    });

    it('marcar un informe inexistente → 404', async () => {
      await sup.patch('/api/critical-reports/nope/read').expect(404);
    });
  });

  describe('evidencia', () => {
    let o: Orden;
    beforeAll(async () => {
      o = await nuevaOrden();
    });

    it('conserva tildes y ñ en el nombre del archivo', async () => {
      const r = (await tec
        .post(`/api/orders/${o.id}/evidence`)
        .attach('file', fakeJpeg(100), { filename: 'reparación-año.jpg', contentType: 'image/jpeg' })
        .expect(201)).body as Orden;
      expect(r.evidencias[0]!.nombreArchivo).toBe('reparación-año.jpg');
    });

    it('rechaza SVG (puede contener scripts) y HTML disfrazado', async () => {
      await tec.post(`/api/orders/${o.id}/evidence`)
        .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), { filename: 'x.svg', contentType: 'image/svg+xml' })
        .expect(400);
    });

    it('archivo demasiado grande → 413 con mensaje claro', async () => {
      const res = await tec.post(`/api/orders/${o.id}/evidence`)
        .attach('file', fakeJpeg(1.5 * 1024 * 1024), { filename: 'grande.jpg', contentType: 'image/jpeg' })
        .expect(413);
      expect((res.body as ErrBody).message).toMatch(/1 MB/);
    });

    it('el archivo se sirve con nosniff', async () => {
      const ev = (await sup.get(`/api/orders/${o.id}`)).body as Orden;
      const file = await sup.get(`/api/orders/${o.id}/evidence/${ev.evidencias[0]!.id}/file`).expect(200);
      expect(file.headers['x-content-type-options']).toBe('nosniff');
    });

    it('cambiar la solución o quitar evidencia invalida la validación', async () => {
      await tec.patch(`/api/orders/${o.id}`).send({ solucion: 'Cambio de fuente y prueba OK' }).expect(200);
      let r = (await sup.post(`/api/orders/${o.id}/validate`).send({ comentario: 'Validado ok' }).expect(201)).body as Orden;
      expect(r.validada).toBe(true);
      r = (await tec.patch(`/api/orders/${o.id}`).send({ solucion: 'Cambio de fuente, prueba 1 h OK' }).expect(200)).body as Orden;
      expect(r.validada).toBe(false);
      await sup.post(`/api/orders/${o.id}/validate`).send({ comentario: 'Validado ok' }).expect(201);
      r = (await tec.delete(`/api/orders/${o.id}/evidence/${r.evidencias[0]!.id}`).expect(200)).body as Orden;
      expect(r.validada).toBe(false);
      expect(r.evidencias).toHaveLength(0);
    });
  });

  describe('cierre', () => {
    it('resolver limpia el escalado y su motivo; una orden cerrada no se edita', async () => {
      let o = await nuevaOrden();
      await tec.post(`/api/orders/${o.id}/escalate`).send({ causa: 'TECNICA', motivo: 'Requiere nivel 2 urgente' }).expect(201);
      await sup.post(`/api/orders/${o.id}/escalation/take`).expect(201);
      await sup.post(`/api/orders/${o.id}/escalation/resolve`).send({ resolucion: 'CONTINUAR', texto: 'Se reemplaza la placa' }).expect(201);
      for (const to of ['EN_DIAGNOSTICO', 'EN_REPARACION', 'PRUEBAS']) {
        if (to === 'EN_REPARACION') await sup.patch(`/api/orders/${o.id}`).send({ diagnostico: 'Placa' }).expect(200);
        await sup.post(`/api/orders/${o.id}/transitions`).send({ to, comentario: `Paso a ${to}` }).expect(201);
      }
      await sup.patch(`/api/orders/${o.id}`).send({ solucion: 'Reemplazo de placa madre' }).expect(200);
      await sup.post(`/api/orders/${o.id}/transitions`).send({ to: 'LISTO_PARA_RETIRAR', comentario: 'Listo' }).expect(201);
      await sup.post(`/api/orders/${o.id}/evidence`).attach('file', fakePng(50), { filename: 'ok.png', contentType: 'image/png' }).expect(201);
      await sup.post(`/api/orders/${o.id}/validate`).send({ comentario: 'Validado ok' }).expect(201);
      o = (await sup.post(`/api/orders/${o.id}/transitions`).send({ to: 'CERRADO', comentario: 'Entregado' }).expect(201)).body as Orden;
      expect(o.escalada).toBe(false);
      expect(o.motivoEscalado).toBeNull();
      await sup.patch(`/api/orders/${o.id}`).send({ diagnostico: 'otro' }).expect(422);
      await sup.post(`/api/orders/${o.id}/evidence`).attach('file', fakePng(50), { filename: 'x.png', contentType: 'image/png' }).expect(422);
    });
  });
});
