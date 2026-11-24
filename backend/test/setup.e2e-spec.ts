/**
 * Primer uso: crear la cuenta, definir los roles esenciales y recién ahí operar.
 * Esquema propio de PostgreSQL (e2e_setup), sin los usuarios de desarrollo.
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { dropTestSchema, testDatabaseUrl } from './test-db';

process.env.DATABASE_URL = testDatabaseUrl('e2e_setup');
process.env.UPLOAD_DIR = 'uploads-test-esc';
process.env.JWT_SECRET = 'test-secret-de-al-menos-treinta-y-dos-caracteres';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

type Agent = ReturnType<typeof request.agent>;
interface ErrBody { details?: string[]; message: string | string[] }
interface Persona { id: string; roles: string[]; activo: boolean }

const root = resolve(__dirname, '..');
const run = (cmd: string) => execSync(cmd, { cwd: root, env: { ...process.env, SEED_USERS: 'false' }, stdio: 'pipe' });
const clave = 'una-clave-larga-1';

describe('Configuración inicial (e2e)', () => {
  let app: INestApplication;
  let admin: Agent;
  let adminId: string;
  let mixto: Persona;
  let servicioId: string;
  /** Última sesión de Marta: el login tiene límite de intentos por minuto. */
  let martaSesion: Agent;

  const anon = () => request(app.getHttpServer());
  async function login(email: string, password = clave): Promise<Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    return agent;
  }

  beforeAll(async () => {
    await dropTestSchema(process.env.DATABASE_URL!);
    run('npx prisma migrate deploy');
    run('npx tsx test/seed-pruebas.ts');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    rmSync(resolve(root, process.env.UPLOAD_DIR!), { recursive: true, force: true });
    await dropTestSchema(process.env.DATABASE_URL!); // no dejar datos de prueba
  });

  it('una instalación nueva no tiene talleres', async () => {
    const s = (await anon().get('/api/setup/status').expect(200)).body as { hayTalleres: boolean; registroAbierto: boolean };
    expect(s).toEqual({ hayTalleres: false, registroAbierto: true });
    await anon().get('/api/setup/users').expect(401);
  });

  it('valida los datos y crea el Admin con la sesión iniciada', async () => {
    await anon().post('/api/auth/register').send({ tallerNombre: 'Taller', nombre: 'Sofía', email: 'mal', password: 'corta' }).expect(400);
    const datos = { tallerNombre: 'Taller Centro', nombre: 'Sofía Paz', email: 'sofia@taller.com', password: clave };
    const mal = async (cambio: Record<string, string>) => ((await anon().post('/api/auth/register').send({ ...datos, ...cambio }).expect(400)).body as ErrBody).message;
    expect(await mal({ password: 'solo-letras-largas' })).toContain('La contraseña tiene que combinar letras y números');
    expect(await mal({ password: '1234567890' })).toContain('La contraseña tiene que combinar letras y números');
    expect(await mal({ nombre: '1234' })).toContain('Tu nombre: tiene que tener letras');
    // Máximo 40 caracteres en todos los campos (juntos: el registro admite 10 pedidos por minuto)
    expect(await mal({ tallerNombre: 'x'.repeat(41), nombre: 'x'.repeat(41), email: `${'a'.repeat(36)}@x.co`, password: 'a1'.repeat(20) + 'x' })).toEqual([
      'Nombre del taller: máximo 40 caracteres', 'Tu nombre: máximo 40 caracteres',
      'El email no puede tener más de 40 caracteres', 'La contraseña no puede tener más de 40 caracteres',
    ]);
    // Caracteres especiales, invisibles y espacios (el detalle está en security.spec.ts)
    expect(await mal({ tallerNombre: '<b>Taller</b>', nombre: '     ', email: 'a"b@x.com', password: ' clave-larga-1' })).toEqual([
      "Nombre del taller: usá solo letras, números, espacios y . , ' & ( ) / + # _ -", 'Tu nombre: mínimo 2 caracteres',
      'Ingresá un email válido', 'La contraseña no puede empezar ni terminar con espacios',
    ]);
    expect(await mal({ tallerNombre: '-Taller', password: 'clave\u200b-larga-1' })).toEqual([
      'Nombre del taller: tiene que empezar con una letra o un número', 'La contraseña tiene caracteres invisibles que no se admiten',
    ]);
    // Lo mismo al ingresar: se rechaza antes de buscar la cuenta
    const ingreso = async (email: string, password: string) =>
      ((await anon().post('/api/auth/login').send({ email, password }).expect(400)).body as ErrBody).message;
    expect(await ingreso(`${'a'.repeat(36)}@x.co`, clave)).toContain('El email no puede tener más de 40 caracteres');
    expect(await ingreso('a@x.com', 'x'.repeat(41))).toContain('La contraseña no puede tener más de 40 caracteres');
    expect(await ingreso('a<b>@x.com', clave)).toContain('Ingresá un email válido');
    expect(await ingreso('a@x.com', ' clave')).toContain('La contraseña no puede empezar ni terminar con espacios');
    admin = request.agent(app.getHttpServer());
    const res = await admin.post('/api/auth/register')
      .send({ tallerNombre: '  Taller   Centro  ', nombre: ' Sofía  Paz ', email: '  Sofia@Taller.com ', password: clave }).expect(201);
    const u = res.body as { id: string; email: string; nombre: string; roles: string[] };
    adminId = u.id;
    // Los espacios de adelante, de atrás y dobles se quitan al guardar
    expect(u).toMatchObject({ email: 'sofia@taller.com', nombre: 'Sofía Paz', roles: ['ADMIN'] });
    expect((await admin.get('/api/setup/mine').expect(200)).body).toMatchObject({ tallerNombre: 'Taller Centro' });
    await login('  SOFIA@taller.com  ');
    expect((await admin.get('/api/auth/me').expect(200)).body).toMatchObject({ roles: ['ADMIN'] });
  });

  it('un email ya usado no puede registrar otro taller', async () => {
    await anon().post('/api/auth/register').send({ tallerNombre: 'Otro', nombre: 'Otra', email: 'sofia@taller.com', password: clave }).expect(409);
  });

  it('sin los roles esenciales no se termina ni se crean órdenes', async () => {
    const p = (await admin.get('/api/setup/progress').expect(200)).body as { rolesFaltantes: string[]; serviciosActivos: number };
    expect(p.rolesFaltantes).toEqual(['SUPERVISOR', 'RECEPCION', 'TECNICO']);
    expect(p.serviciosActivos).toBe(7);
    const r = await admin.post('/api/setup/complete').expect(422);
    expect((r.body as ErrBody).details).toHaveLength(3);
    const o = await admin.post('/api/orders').send({
      clienteId: 'x', equipoId: 'x', servicioId: 'x', responsableId: adminId, fallaReportada: 'No enciende nunca', impacto: 'BAJO', urgencia: 'BAJA',
      fechaEstimada: new Date(Date.now() + 864e5).toISOString(),
    }).expect(422);
    expect((o.body as ErrBody).message).toBe('El taller todavía no está configurado');
    expect((o.body as ErrBody).details?.[0]).toMatch(/asignar todos los roles/);
  });

  it('una persona puede cubrir varios roles', async () => {
    const crear = (nombre: string, email: string, roles: string[]) => admin.post('/api/setup/users').send({ nombre, email, password: clave, roles });
    await crear('Sin rol', 'sin@taller.com', []).expect(400);
    mixto = (await crear('Marta Gil', 'marta@taller.com', ['RECEPCION', 'TECNICO']).expect(201)).body as Persona;
    await crear('Repetida', 'MARTA@taller.com', ['TECNICO']).expect(409);
    await admin.post('/api/setup/complete').expect(422); // falta Supervisor
    await admin.patch(`/api/setup/users/${adminId}`).send({ roles: ['ADMIN', 'SUPERVISOR'] }).expect(200);
    const fin = (await admin.post('/api/setup/complete').expect(200)).body as { configurado: boolean };
    expect(fin.configurado).toBe(true);
    expect(((await admin.get('/api/setup/mine').expect(200)).body as { configurado: boolean }).configurado).toBe(true);
  });

  it('con varios roles suma los permisos de cada uno', async () => {
    const marta = await login('marta@taller.com');
    await marta.get('/api/setup/users').expect(403);
    const c = (await marta.post('/api/clients').send({ nombre: 'Cliente Uno', telefono: '11 3000-0001' }).expect(201)).body as { id: string };
    const e = (await marta.post('/api/equipment').send({ clienteId: c.id, tipo: 'NOTEBOOK', marca: 'HP', modelo: 'G5', numeroSerie: 'S-1' }).expect(201)).body as { id: string };
    servicioId = ((await marta.get('/api/services').expect(200)).body as { id: string }[])[0]!.id;
    const o = (await marta.post('/api/orders').send({
      clienteId: c.id, equipoId: e.id, servicioId, responsableId: adminId, tecnicoId: mixto.id,
      fallaReportada: 'No carga la batería', impacto: 'MEDIO', urgencia: 'MEDIA', fechaEstimada: new Date(Date.now() + 864e5).toISOString(),
    }).expect(201)).body as { id: string };
    // Técnico: trabaja la orden. Recepción: ve todas, no solo las suyas
    await marta.post(`/api/orders/${o.id}/transitions`).send({ to: 'EN_DIAGNOSTICO', comentario: 'Empiezo' }).expect(201);
    await marta.patch(`/api/orders/${o.id}`).send({ diagnostico: 'Conector dañado' }).expect(200);
    await marta.post(`/api/orders/${o.id}/transitions`).send({ to: 'EN_REPARACION', comentario: 'Reparando' }).expect(201);
    const otra = (await admin.post('/api/orders').send({
      clienteId: c.id, equipoId: e.id, servicioId, responsableId: adminId, fallaReportada: 'Pantalla rota de fábrica', impacto: 'BAJO', urgencia: 'BAJA',
      fechaEstimada: new Date(Date.now() + 864e5).toISOString(),
    }).expect(201)).body as { id: string };
    await marta.get(`/api/orders/${otra.id}`).expect(200);
  });

  it('siempre queda un Admin activo y nadie se desactiva a sí mismo', async () => {
    await admin.patch(`/api/setup/users/${adminId}`).send({ activo: false }).expect(400);
    await admin.patch(`/api/setup/users/${adminId}`).send({ roles: ['SUPERVISOR'] }).expect(422);
  });

  it('el dashboard avisa si un rol esencial queda sin nadie', async () => {
    await admin.patch(`/api/setup/users/${mixto.id}`).send({ activo: false }).expect(200);
    const d = (await admin.get('/api/dashboard').expect(200)).body as { rolesFaltantes: string[] };
    expect(d.rolesFaltantes).toEqual(['RECEPCION', 'TECNICO']);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'marta@taller.com', password: clave }).expect(401);
    await admin.patch(`/api/setup/users/${mixto.id}`).send({ activo: true }).expect(200);
  });

  it('cambiar la contraseña exige la actual; el Admin puede resetearla', async () => {
    const marta = await login('marta@taller.com');
    await marta.post('/api/auth/password').send({ actual: 'incorrecta', nueva: 'otra-clave-larga-2' }).expect(401);
    await marta.post('/api/auth/password').send({ actual: clave, nueva: 'otra-clave-larga-2' }).expect(204);
    await login('marta@taller.com', 'otra-clave-larga-2');
    await admin.patch(`/api/setup/users/${mixto.id}`).send({ password: clave }).expect(200);
    martaSesion = await login('marta@taller.com');
  });

  it('el Admin ajusta los servicios', async () => {
    await admin.patch(`/api/setup/services/${servicioId}`).send({ precioBase: 18000 }).expect(200);
    const nuevo = (await admin.post('/api/setup/services').send({ nombre: 'Limpieza de teclado', precioBase: 5000 }).expect(201)).body as { id: string };
    await admin.patch(`/api/setup/services/${nuevo.id}`).send({ activo: false }).expect(200);
    const activos = (await admin.get('/api/services').expect(200)).body as { id: string; precioBase: number }[];
    expect(activos.some((s) => s.id === nuevo.id)).toBe(false);
    expect(activos.find((s) => s.id === servicioId)?.precioBase).toBe(18000);
  });

  it('rechaza datos mal cargados en clientes, órdenes, servicios y el taller', async () => {
    const marta = martaSesion;
    const msg = (r: { body: unknown }) => (r.body as ErrBody).message;
    // Teléfono: caracteres, mínimo y máximo de dígitos
    expect(msg(await marta.post('/api/clients').send({ nombre: 'Ana', telefono: '11-abc-123' }).expect(400))).toContain('Teléfono: usá solo números, espacios, +, - o paréntesis');
    expect(msg(await marta.post('/api/clients').send({ nombre: 'Ana', telefono: '123' }).expect(400))).toContain('El teléfono debe tener al menos 6 dígitos');
    expect(msg(await marta.post('/api/clients').send({ nombre: 'Ana', telefono: '1234567890123456' }).expect(400))).toContain('El teléfono no puede tener más de 15 dígitos');
    expect(msg(await marta.post('/api/clients').send({ nombre: '12345', telefono: '11 5000-0001' }).expect(400))).toContain('Nombre: tiene que tener letras');
    await marta.get(`/api/clients?q=${'x'.repeat(101)}`).expect(400);
    // Fecha estimada: de hoy a un año
    const c = (await marta.post('/api/clients').send({ nombre: 'Cliente Dos', telefono: '11 5000-0002', email: 'Dos@Mail.com' }).expect(201)).body as { id: string; email: string };
    expect(c.email).toBe('dos@mail.com');
    const e = (await marta.post('/api/equipment').send({ clienteId: c.id, tipo: 'NOTEBOOK', marca: 'HP', modelo: 'G6', numeroSerie: 'S-2' }).expect(201)).body as { id: string };
    const orden = (dias: number) => marta.post('/api/orders').send({
      clienteId: c.id, equipoId: e.id, servicioId, responsableId: adminId, fallaReportada: 'No enciende para nada', impacto: 'BAJO', urgencia: 'BAJA',
      fechaEstimada: new Date(Date.now() + dias * 864e5).toISOString(),
    });
    expect((((await orden(400).expect(400)).body as ErrBody).details)).toEqual(['La fecha estimada no puede ser más de 365 días después de hoy']);
    await orden(300).expect(201);
    // Servicios: nombre repetido (sin importar mayúsculas) y precio fuera de rango
    const existente = ((await admin.get('/api/setup/services').expect(200)).body as { nombre: string }[])[0]!.nombre;
    expect(msg(await admin.post('/api/setup/services').send({ nombre: existente.toUpperCase(), precioBase: 100 }).expect(409))).toBe(`Ya existe el servicio «${existente}»`);
    await admin.post('/api/setup/services').send({ nombre: 'Muy caro', precioBase: 100_000_001 }).expect(400);
    await admin.post('/api/setup/services').send({ nombre: 'Barato', precioBase: -1 }).expect(400);
    // Taller: teléfono opcional pero válido
    await admin.patch('/api/setup/taller').send({ nombre: 'Taller Centro', telefono: 'sin teléfono' }).expect(400);
    await admin.patch('/api/setup/taller').send({ nombre: 'Taller Centro', telefono: '' }).expect(200);
    // Personas: contraseña con letras y números
    expect(msg(await admin.post('/api/setup/users').send({ nombre: 'Leo', email: 'leo@taller.com', password: 'abcdefghij', roles: ['TECNICO'] }).expect(400))).toContain('La contraseña tiene que combinar letras y números');
  });

  it('la contraseña nueva tiene que ser distinta de la actual', async () => {
    const marta = martaSesion;
    expect(((await marta.post('/api/auth/password').send({ actual: clave, nueva: clave }).expect(400)).body as ErrBody).message).toBe('La contraseña nueva tiene que ser distinta de la actual');
  });
});
