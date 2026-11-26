/**
 * Roles de plataforma (Moderador y Administrador): ingreso con segundo factor, sesión aparte de la
 * de los talleres, suspensión de talleres y personas, recuperación de cuentas y bitácora inmutable.
 * Esquema propio (e2e_plataforma), que se borra al terminar.
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { dropTestSchema, testDatabaseUrl } from './test-db';

process.env.DATABASE_URL = testDatabaseUrl('e2e_plataforma');
process.env.JWT_SECRET = 'test-secret-de-al-menos-treinta-y-dos-caracteres';
process.env.PLATAFORMA_ADMIN_EMAIL = 'raiz@plataforma.local';
process.env.PLATAFORMA_ADMIN_NOMBRE = 'Raíz Plataforma';
process.env.PLATAFORMA_ADMIN_CLAVE = 'clave-de-plataforma-1';

import { AppModule } from '../src/app.module';
import { codigoTotp, pasoActual } from '../src/plataforma/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';

type Agent = ReturnType<typeof request.agent>;
interface ErrBody { statusCode: number; message: string | string[] }
interface Taller { id: number; nombre: string; personas: number; ordenes: number; suspendido: boolean }
interface Persona { id: string; nombre: string; email?: string; activo: boolean }

const root = resolve(__dirname, '..');
const run = (cmd: string) => execSync(cmd, { cwd: root, env: { ...process.env }, stdio: 'pipe' });
const ADMIN = { email: 'raiz@plataforma.local', password: 'clave-de-plataforma-1' };
const MODERADOR = { nombre: 'Mora Moderadora', email: 'mora@plataforma.local', password: 'clave-de-moderacion-1' };

describe('Plataforma (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agent, mod: Agent, recep: Agent;
  let secretoAdmin: string, secretoMod: string;
  const anon = () => request(app.getHttpServer());
  const msg = (r: { body: unknown }) => (r.body as ErrBody).message;

  async function loginTaller(email: string, password = 'demo1234'): Promise<Agent> {
    const a = request.agent(app.getHttpServer());
    await a.post('/api/auth/login').send({ email, password }).expect(200);
    return a;
  }

  /** Ingreso por primera vez: configura el segundo factor con el código actual. */
  async function primerIngreso(datos: { email: string; password: string }): Promise<{ agent: Agent; secreto: string }> {
    const agent = request.agent(app.getHttpServer());
    const r = await agent.post('/api/plataforma/login').send(datos).expect(200);
    const { estado, secreto, uri } = r.body as { estado: string; secreto: string; uri: string };
    expect(estado).toBe('configurar');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    // Con la sesión intermedia todavía no se puede hacer nada
    await agent.get('/api/plataforma/talleres').expect(401);
    await agent.post('/api/plataforma/segundo-factor').send({ codigo: '000000' === codigoTotp(secreto, pasoActual()) ? '111111' : '000000' }).expect(401);
    await agent.post('/api/plataforma/segundo-factor').send({ codigo: codigoTotp(secreto, pasoActual()) }).expect(200);
    return { agent, secreto };
  }

  beforeAll(async () => {
    await dropTestSchema(process.env.DATABASE_URL!);
    run('npx prisma migrate deploy');
    run('npx tsx test/seed-pruebas.ts');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    recep = await loginTaller('recepcion@serviciotecnico.local');
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await dropTestSchema(process.env.DATABASE_URL!);
  });

  it('el primer Administrador sale del entorno del servidor y tiene que configurar el segundo factor', async () => {
    expect(await prisma.cuentaPlataforma.count()).toBe(1);
    await anon().post('/api/plataforma/login').send({ ...ADMIN, password: 'incorrecta-1234' }).expect(401);
    ({ agent: admin, secreto: secretoAdmin } = await primerIngreso(ADMIN));
    const me = (await admin.get('/api/plataforma/me').expect(200)).body as { rol: string; nombre: string };
    expect(me).toMatchObject({ rol: 'ADMINISTRADOR', nombre: 'Raíz Plataforma' });
  });

  it('después pide el código, que no se puede usar dos veces', async () => {
    const a = request.agent(app.getHttpServer());
    expect((await a.post('/api/plataforma/login').send(ADMIN).expect(200)).body).toEqual({ estado: 'codigo' });
    await a.get('/api/plataforma/me').expect(401);
    const usado = codigoTotp(secretoAdmin, pasoActual());
    expect(msg(await a.post('/api/plataforma/login').send({ ...ADMIN, codigo: usado }).expect(401))).toMatch(/ya se usó/);
    await a.post('/api/plataforma/login').send({ ...ADMIN, codigo: codigoTotp(secretoAdmin, pasoActual() + 1) }).expect(200);
    await a.get('/api/plataforma/me').expect(200);
  });

  it('las sesiones de taller y de plataforma no se mezclan', async () => {
    await recep.get('/api/plataforma/talleres').expect(401);
    await admin.get('/api/orders').expect(401);
    // Ni pasando el token de plataforma como Bearer a la API de los talleres
    const token = tokenDe(admin);
    expect(token).toBeTruthy();
    await anon().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
  });

  /** El valor de la cookie de plataforma que guardó un agente. */
  function tokenDe(agent: Agent): string | undefined {
    const jar = (agent as unknown as { jar: { getCookie(n: string, o: unknown): { value: string } | undefined } }).jar;
    return jar.getCookie('st_plataforma', { domain: '127.0.0.1', path: '/', secure: false, script: false })?.value;
  }

  it('el Administrador ve los talleres y el email de las personas; crea moderadores', async () => {
    const talleres = (await admin.get('/api/plataforma/talleres').expect(200)).body as Taller[];
    expect(talleres[0]).toMatchObject({ id: 1, personas: 5, suspendido: false });
    const personas = (await admin.get('/api/plataforma/talleres/1/personas').expect(200)).body as Persona[];
    expect(personas.every((p) => p.email?.endsWith('@serviciotecnico.local'))).toBe(true);
    // Ni los datos de las órdenes ni los de los clientes aparecen en la plataforma
    expect(JSON.stringify(talleres) + JSON.stringify(personas)).not.toMatch(/passwordHash|telefono|fallaReportada/);

    expect(msg(await admin.post('/api/plataforma/cuentas').send({ ...MODERADOR, password: 'corta-123' }).expect(400))).toEqual(['La contraseña debe tener al menos 12 caracteres']);
    await admin.post('/api/plataforma/cuentas').send(MODERADOR).expect(201);
    await admin.post('/api/plataforma/cuentas').send(MODERADOR).expect(409);
    ({ agent: mod, secreto: secretoMod } = await primerIngreso(MODERADOR));
    expect(secretoMod).not.toBe(secretoAdmin);
  });

  it('el Moderador no ve emails ni puede recuperar cuentas, crear cuentas ni leer la bitácora', async () => {
    const personas = (await mod.get('/api/plataforma/talleres/1/personas').expect(200)).body as Persona[];
    expect(personas.some((p) => 'email' in p)).toBe(false);
    await mod.get('/api/plataforma/cuentas').expect(403);
    await mod.post('/api/plataforma/cuentas').send({ ...MODERADOR, email: 'otro@plataforma.local' }).expect(403);
    await mod.get('/api/plataforma/bitacora').expect(403);
    await mod.post(`/api/plataforma/personas/${personas[0]!.id}/clave`).send({ password: 'clave-nueva-1' }).expect(403);
  });

  it('suspender un taller corta en el momento a su gente; reactivarlo la deja volver', async () => {
    expect(msg(await mod.post('/api/plataforma/talleres/1/suspender').send({ motivo: 'spam' }).expect(400))).toEqual([
      'Contá el motivo (mínimo 10 caracteres): queda en la bitácora',
    ]);
    await mod.post('/api/plataforma/talleres/1/suspender').send({ motivo: 'Cargaba datos falsos de forma masiva' }).expect(204);
    await mod.post('/api/plataforma/talleres/1/suspender').send({ motivo: 'Cargaba datos falsos de forma masiva' }).expect(409);
    expect(msg(await recep.get('/api/orders').expect(403))).toMatch(/taller está suspendido/);
    expect(msg(await anon().post('/api/auth/login').send({ email: 'supervisor@serviciotecnico.local', password: 'demo1234' }).expect(403))).toMatch(/suspendido/);
    // Con la contraseña equivocada no se revela que el taller está suspendido
    await anon().post('/api/auth/login').send({ email: 'supervisor@serviciotecnico.local', password: 'otra-clave-1' }).expect(401);
    await mod.post('/api/plataforma/talleres/1/reactivar').expect(204);
    await recep.get('/api/orders').expect(200);
    await mod.post('/api/plataforma/talleres/999/suspender').send({ motivo: 'Este taller no existe' }).expect(404);
  });

  it('suspender a una persona cierra sus sesiones; el Administrador le puede dar una contraseña nueva', async () => {
    const personas = (await admin.get('/api/plataforma/talleres/1/personas').expect(200)).body as Persona[];
    const julieta = personas.find((p) => p.email === 'julieta@serviciotecnico.local')!;
    const sesion = await loginTaller('julieta@serviciotecnico.local');
    await mod.patch(`/api/plataforma/personas/${julieta.id}`).send({ activo: false }).expect(204);
    await sesion.get('/api/orders').expect(401);
    await mod.patch(`/api/plataforma/personas/${julieta.id}`).send({ activo: true }).expect(204);

    expect(msg(await admin.post(`/api/plataforma/personas/${julieta.id}/clave`).send({ password: 'corta' }).expect(400))).toContain('La contraseña debe tener al menos 8 caracteres');
    await admin.post(`/api/plataforma/personas/${julieta.id}/clave`).send({ password: 'recuperada-2026' }).expect(204);
    await anon().post('/api/auth/login').send({ email: julieta.email, password: 'demo1234' }).expect(401);
    await loginTaller(julieta.email!, 'recuperada-2026');
  });

  it('el Administrador suspende moderadores, pero no a sí mismo', async () => {
    const cuentas = (await admin.get('/api/plataforma/cuentas').expect(200)).body as { id: string; rol: string; segundoFactor: boolean }[];
    expect(cuentas.every((c) => c.segundoFactor)).toBe(true);
    const yo = cuentas.find((c) => c.rol === 'ADMINISTRADOR')!;
    const mora = cuentas.find((c) => c.rol === 'MODERADOR')!;
    await admin.patch(`/api/plataforma/cuentas/${yo.id}`).send({ activo: false }).expect(403);
    await admin.patch(`/api/plataforma/cuentas/${mora.id}`).send({ activo: false }).expect(204);
    await mod.get('/api/plataforma/talleres').expect(401);
    await admin.patch(`/api/plataforma/cuentas/${mora.id}`).send({ activo: true }).expect(204);
    // Reactivada, vuelve a ingresar (la suspensión cerró sus sesiones)
    await mod.get('/api/plataforma/talleres').expect(401);
    mod = request.agent(app.getHttpServer());
    await mod.post('/api/plataforma/login').send({ email: MODERADOR.email, password: MODERADOR.password, codigo: codigoTotp(secretoMod, pasoActual() + 1) }).expect(200);
    await mod.get('/api/plataforma/talleres').expect(200);
  });

  it('todo queda en una bitácora que ni la propia base deja modificar o borrar', async () => {
    const b = (await admin.get('/api/plataforma/bitacora').expect(200)).body as { accion: string; detalle: string | null }[];
    const acciones = b.map((a) => a.accion);
    for (const a of ['cuenta.creada_al_arrancar', 'segundo_factor.activado', 'ingreso.fallido', 'ingreso', 'cuenta.moderador_creado',
      'taller.suspendido', 'taller.reactivado', 'persona.suspendida', 'persona.clave_reseteada', 'cuenta.moderador_suspendido']) {
      expect([a, acciones.includes(a)]).toEqual([a, true]);
    }
    expect(JSON.stringify(b)).not.toMatch(/recuperada-2026|clave-de/); // nunca guarda contraseñas
    await expect(prisma.accionPlataforma.deleteMany({})).rejects.toThrow();
    await expect(prisma.accionPlataforma.updateMany({ data: { accion: 'otra' } })).rejects.toThrow();
    expect((await admin.get('/api/plataforma/bitacora').expect(200)).body).toHaveLength(b.length);
  });

  it('cerrar sesión invalida el token aunque alguien lo haya copiado', async () => {
    const copia = tokenDe(mod);
    expect(copia).toBeTruthy();
    await mod.post('/api/plataforma/logout').expect(204);
    await anon().get('/api/plataforma/me').set('Cookie', `st_plataforma=${copia}`).expect(401);
  });
});
