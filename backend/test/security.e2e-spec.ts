/**
 * Pruebas de seguridad y de validación de datos: sesión, permisos, inyección, archivos,
 * cabeceras y límites de cada campo. Esquema propio de PostgreSQL (e2e_security), que se
 * borra al terminar junto con la carpeta de evidencias de prueba.
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect, type AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { dropTestSchema, fakeJpeg, fakePdf, fakePng, testDatabaseUrl } from './test-db';

process.env.DATABASE_URL = testDatabaseUrl('e2e_security');
process.env.UPLOAD_DIR = 'uploads-test-security';
process.env.JWT_SECRET = 'test-secret-de-al-menos-treinta-y-dos-caracteres';
process.env.UPLOAD_MAX_MB = '1';

import { AppModule } from '../src/app.module';
import { LOGIN_POR_IP } from '../src/auth/auth.controller';
import { MENSAJES_EVIDENCIA } from '../src/orders/evidence.signature';
import { SUBIDAS_POR_MINUTO } from '../src/orders/upload.guard';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';

type Agent = ReturnType<typeof request.agent>;
interface Id { id: string }
interface ErrBody { statusCode: number; message: string | string[]; details?: string[] }

const root = resolve(__dirname, '..');
const run = (cmd: string) => execSync(cmd, { cwd: root, env: { ...process.env }, stdio: 'pipe' });
const en3dias = () => new Date(Date.now() + 3 * 864e5).toISOString();
const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('Seguridad y validaciones (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Agent, sup: Agent, recep: Agent, tec: Agent;
  let adminId: string, tecId: string, recepId: string, servicioId: string;
  let cliente: Id, equipo: Id, orden: Id;
  let telefonos = 0;
  /** Teléfono distinto en cada alta (el teléfono no se repite dentro del taller). */
  const telefono = () => `11 6000-${String(++telefonos).padStart(4, '0')}`;

  const anon = () => request(app.getHttpServer());

  async function login(email: string, password = 'demo1234'): Promise<Agent> {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    return agent;
  }

  beforeAll(async () => {
    await dropTestSchema(process.env.DATABASE_URL!);
    rmSync(resolve(root, process.env.UPLOAD_DIR!), { recursive: true, force: true });
    run('npx prisma migrate deploy');
    run('npx tsx test/seed-pruebas.ts');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    admin = await login('admin@serviciotecnico.local');
    sup = await login('supervisor@serviciotecnico.local');
    recep = await login('recepcion@serviciotecnico.local');
    tec = await login('carlos@serviciotecnico.local');
    const users = (await sup.get('/api/users').expect(200)).body as (Id & { email: string })[];
    const id = (email: string) => users.find((u) => u.email === email)!.id;
    adminId = id('admin@serviciotecnico.local');
    tecId = id('carlos@serviciotecnico.local');
    recepId = id('recepcion@serviciotecnico.local');
    servicioId = ((await sup.get('/api/services').expect(200)).body as Id[])[0]!.id;

    cliente = (await recep.post('/api/clients').send({ nombre: 'Cliente Base', telefono: telefono() }).expect(201)).body as Id;
    equipo = (await recep.post('/api/equipment').send({ clienteId: cliente.id, tipo: 'NOTEBOOK', marca: 'Lenovo', modelo: 'T14', numeroSerie: 'SEC-0001' }).expect(201)).body as Id;
    orden = (await recep.post('/api/orders').send({
      clienteId: cliente.id, equipoId: equipo.id, servicioId, responsableId: adminId, tecnicoId: tecId,
      fallaReportada: 'No enciende al presionar el botón', impacto: 'MEDIO', urgencia: 'MEDIA', fechaEstimada: en3dias(),
    }).expect(201)).body as Id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    rmSync(resolve(root, process.env.UPLOAD_DIR!), { recursive: true, force: true });
    await dropTestSchema(process.env.DATABASE_URL!); // no dejar datos de prueba
  });

  // ---------------------------------------------------------------- autenticación

  describe('autenticación', () => {
    it('ninguna ruta privada responde sin sesión', async () => {
      const rutas: [method: 'get' | 'post' | 'patch' | 'delete', path: string][] = [
        ['get', '/api/auth/me'], ['post', '/api/auth/password'],
        ['get', '/api/orders'], ['post', '/api/orders'], ['get', `/api/orders/${orden.id}`], ['patch', `/api/orders/${orden.id}`],
        ['post', `/api/orders/${orden.id}/transitions`], ['post', `/api/orders/${orden.id}/escalate`], ['post', `/api/orders/${orden.id}/evidence`],
        ['get', `/api/orders/${orden.id}/evidence/x/file`], ['delete', `/api/orders/${orden.id}/evidence/x`], ['post', `/api/orders/${orden.id}/abandon`],
        ['get', '/api/clients'], ['post', '/api/clients'], ['get', '/api/equipment'], ['post', '/api/equipment'],
        ['get', '/api/users'], ['get', '/api/services'], ['get', '/api/dashboard'], ['get', '/api/alerts'],
        ['get', '/api/setup/mine'], ['get', '/api/setup/progress'], ['patch', '/api/setup/taller'], ['post', '/api/setup/complete'],
        ['get', '/api/setup/users'], ['post', '/api/setup/users'], ['patch', `/api/setup/users/${adminId}`],
        ['get', '/api/setup/services'], ['post', '/api/setup/services'], ['patch', `/api/setup/services/${servicioId}`],
      ];
      for (const [method, path] of rutas) {
        const res = await anon()[method](path).send({});
        expect({ ruta: `${method.toUpperCase()} ${path}`, status: res.status }).toEqual({ ruta: `${method.toUpperCase()} ${path}`, status: 401 });
      }
    });

    it('rechaza tokens falsificados: sin firma, con otra clave, vencidos o de un usuario que no existe', async () => {
      const ahora = Math.floor(Date.now() / 1000);
      const sinFirma = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: adminId, iat: ahora })}.`;
      const otraClave = await new JwtService({ secret: 'otra-clave-cualquiera-de-treinta-y-dos-caracteres' }).signAsync({ sub: adminId });
      const real = new JwtService({ secret: process.env.JWT_SECRET });
      const vencido = await real.signAsync({ sub: adminId, iat: ahora - 7200, exp: ahora - 3600 });
      const fantasma = await real.signAsync({ sub: 'usuario-que-no-existe' });
      // Firmado con la clave real pero con otro algoritmo: solo se acepta HS256
      const otroAlgoritmo = await real.signAsync({ sub: adminId }, { algorithm: 'HS512' });
      for (const token of [sinFirma, otraClave, vencido, fantasma, otroAlgoritmo, 'basura', '']) {
        await anon().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
        await anon().get('/api/auth/me').set('Cookie', `st_session=${token}`).expect(401);
      }
    });

    it('cerrar sesión invalida el token aunque alguien lo haya copiado', async () => {
      const agente = request.agent(app.getHttpServer());
      const res = await agente.post('/api/auth/login').send({ email: 'supervisor@serviciotecnico.local', password: 'demo1234' }).expect(200);
      const copia = /st_session=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!;
      await anon().get('/api/auth/me').set('Cookie', `st_session=${copia}`).expect(200);
      await agente.post('/api/auth/logout').expect(204);
      await anon().get('/api/auth/me').set('Cookie', `st_session=${copia}`).expect(401);
      await anon().get('/api/auth/me').set('Authorization', `Bearer ${copia}`).expect(401);
      // Las demás sesiones de esa persona siguen abiertas
      await sup.get('/api/auth/me').expect(200);
      expect(await prisma.sesionCerrada.count()).toBeGreaterThan(0);
    });

    it('ninguna respuesta incluye contraseñas ni hashes', async () => {
      const respuestas = await Promise.all([
        admin.get('/api/auth/me'), admin.get('/api/users'), admin.get('/api/setup/users'), admin.get(`/api/orders/${orden.id}`), admin.get('/api/dashboard'),
      ]);
      for (const r of respuestas) {
        expect(r.status).toBe(200);
        expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|\$argon2/);
      }
    });

    it('el mismo mensaje para email inexistente y contraseña incorrecta', async () => {
      const a = await anon().post('/api/auth/login').send({ email: 'nadie@serviciotecnico.local', password: 'demo1234' }).expect(401);
      const b = await anon().post('/api/auth/login').send({ email: 'julieta@serviciotecnico.local', password: 'incorrecta1' }).expect(401);
      expect((a.body as ErrBody).message).toBe((b.body as ErrBody).message);
    });
  });

  // ---------------------------------------------------------------- permisos

  describe('permisos', () => {
    it('cada rol queda dentro de lo suyo', async () => {
      // Técnico: no configura, no da altas ni marca abandonos
      await tec.get('/api/setup/users').expect(403);
      await tec.post('/api/setup/services').send({ nombre: 'Gratis', precioBase: 0 }).expect(403);
      await tec.post('/api/orders').send({}).expect(403);
      await tec.post(`/api/orders/${orden.id}/abandon`).send({ motivo: 'Lo abandono yo mismo' }).expect(403);
      // Recepción y Supervisor: no tocan personas ni roles (tampoco los propios)
      await recep.patch(`/api/setup/users/${recepId}`).send({ roles: ['ADMIN'] }).expect(403);
      await recep.post('/api/setup/complete').expect(403);
      await sup.post('/api/setup/users').send({ nombre: 'Intruso', email: 'intruso@x.com', password: 'clave-larga-1', roles: ['ADMIN'] }).expect(403);
    });

    it('ignora campos que el cliente no debe controlar (taller, número, estado, prioridad)', async () => {
      const c = (await recep.post('/api/clients').send({ nombre: 'Cliente Pirata', telefono: telefono(), tallerId: 999, id: 'id-elegido' }).expect(201)).body as Id;
      expect(c.id).not.toBe('id-elegido');
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.id } })).tallerId).toBe(1);

      const o = (await recep.post('/api/orders').send({
        clienteId: cliente.id, equipoId: equipo.id, servicioId, responsableId: adminId,
        fallaReportada: 'Pantalla con líneas verticales', impacto: 'BAJO', urgencia: 'BAJA', fechaEstimada: en3dias(),
        numero: 'OS-HACK', estado: 'CERRADO', prioridad: 'CRITICA', validada: true, tallerId: 999,
      }).expect(201)).body as Id & { numero: string; estado: string; prioridad: string; validada: boolean };
      expect(o).toMatchObject({ estado: 'RECIBIDO', validada: false });
      expect(o.numero).not.toBe('OS-HACK');
      expect(o.prioridad).not.toBe('CRITICA');

      await admin.patch(`/api/setup/users/${tecId}`).send({ email: 'robado@x.com', tallerId: 999, nombre: 'Carlos Ibáñez' }).expect(200);
      const t = await prisma.usuario.findUniqueOrThrow({ where: { id: tecId } });
      expect(t).toMatchObject({ email: 'carlos@serviciotecnico.local', tallerId: 1 });
    });
  });

  // ---------------------------------------------------------------- inyección

  describe('inyección', () => {
    it('las búsquedas tratan SQL y comodines como texto', async () => {
      // Sin dígitos: la búsqueda por teléfono usa los dígitos del texto y encontraría clientes reales
      const encontrados: Record<string, number[]> = {};
      const esperado: Record<string, number[]> = {};
      for (const q of ["' OR 'a'='a", '%', '_', '%%', "'; DROP TABLE \"Orden\"; --", '\\', '"', '\\%']) {
        encontrados[q] = await Promise.all(
          ['/api/clients', '/api/orders', '/api/equipment'].map(async (ruta) => ((await recep.get(ruta).query({ q }).expect(200)).body as Id[]).length),
        );
        esperado[q] = [0, 0, 0];
      }
      expect(encontrados).toEqual(esperado);
      expect(await prisma.orden.count()).toBeGreaterThan(0);
    });

    it('SQL en el login, en la URL y en los datos no se ejecuta', async () => {
      const antes = { ordenes: await prisma.orden.count(), usuarios: await prisma.usuario.count() };
      // Login: el clásico «' OR 1=1 --» no entra (es un email inválido o simplemente no coincide)
      for (const email of ["' OR 1=1 --", "admin@serviciotecnico.local' --", 'x@x.com\' OR \'1\'=\'1']) {
        expect([400, 401]).toContain((await anon().post('/api/auth/login').send({ email, password: "' OR '1'='1" })).status);
      }
      // Ids en la URL: SQL en lugar de un id da 404, nunca 500 ni datos
      for (const id of ["1' OR '1'='1", '1; DROP TABLE "Orden"; --', "' UNION SELECT * FROM \"Usuario\" --"]) {
        const res = await recep.get(`/api/orders/${encodeURIComponent(id)}`);
        expect([id, res.status]).toEqual([id, 404]);
      }
      // Datos: un nombre con esos caracteres se rechaza; en un texto libre se guarda tal cual, como texto
      const sql = "Robert'); DROP TABLE \"Cliente\";--";
      await recep.post('/api/clients').send({ nombre: sql, telefono: telefono() }).expect(400);
      const c = (await recep.post('/api/clients').send({ nombre: 'Robert', telefono: telefono(), notas: sql }).expect(201)).body as Id & { notas: string };
      expect(c.notas).toBe(sql);
      expect((await prisma.cliente.findUniqueOrThrow({ where: { id: c.id } })).notas).toBe(sql);
      expect(await prisma.orden.count()).toBe(antes.ordenes);
      expect(await prisma.usuario.count()).toBe(antes.usuarios);
    });

    it('rechaza objetos y listas donde va texto', async () => {
      await anon().post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } }).expect(400);
      await anon().post('/api/auth/login').send({ email: ['admin@serviciotecnico.local'], password: 'demo1234' }).expect(400);
      // Parámetro repetido: llega como lista y se rechaza (no 500)
      await recep.get('/api/clients?q=a&q=b').expect(400);
      await recep.get('/api/orders?status=RECIBIDO&status=CERRADO').expect(400);
      // Express 5 no arma objetos desde la URL: «status[$ne]» es una clave más y se ignora
      const todas = (await recep.get('/api/orders').expect(200)).body as Id[];
      expect(((await recep.get('/api/orders?status[$ne]=CERRADO').expect(200)).body as Id[]).length).toBe(todas.length);
    });

    it('__proto__ y constructor en el cuerpo no contaminan objetos', async () => {
      const cuerpo = `{"nombre":"Ana Prototipo","telefono":"${telefono()}","__proto__":{"esAdmin":true},"constructor":{"prototype":{"contaminado":true}}}`;
      const res = await recep.post('/api/clients').set('Content-Type', 'application/json').send(cuerpo);
      expect([201, 400]).toContain(res.status);
      expect(({} as Record<string, unknown>).esAdmin).toBeUndefined();
      expect(({} as Record<string, unknown>).contaminado).toBeUndefined();
    });

    it('rechaza HTML en los nombres y en los textos libres lo guarda como texto, sin interpretarlo', async () => {
      const html = '<img src=x onerror=alert(1)> Ana';
      await recep.post('/api/clients').send({ nombre: html, telefono: telefono() }).expect(400);
      const res = await recep.post('/api/clients').send({ nombre: 'Ana', telefono: telefono(), notas: html }).expect(201);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect((res.body as { notas: string }).notas).toBe(html);
    });
  });

  // ---------------------------------------------------------------- archivos

  describe('archivos de evidencia', () => {
    const subir = (agent: Agent, contenido: Buffer, filename: string, contentType: string) =>
      agent.post(`/api/orders/${orden.id}/evidence`).attach('file', contenido, { filename, contentType });

    it('mira el contenido real, no el tipo que declara el navegador', async () => {
      const msg = 'El contenido del archivo no corresponde a una foto o un PDF';
      expect(((await subir(tec, Buffer.from('hola, no soy una foto'), 'foto.png', 'image/png').expect(400)).body as ErrBody).message).toBe(msg);
      expect(((await subir(tec, Buffer.from('<html><script>alert(1)</script></html>'), 'foto.jpg', 'image/jpeg').expect(400)).body as ErrBody).message).toBe(msg);
      expect(((await subir(tec, fakePng(), 'foto.jpg', 'image/jpeg').expect(400)).body as ErrBody).message).toBe(msg); // PNG declarado como JPG
      await subir(tec, Buffer.from('MZ ejecutable'), 'programa.exe', 'application/octet-stream').expect(400);
      await subir(tec, fakePdf(), 'presupuesto.pdf', 'application/pdf').expect(201);
    });

    it('rechaza fotos y PDF con código o programas escondidos', async () => {
      const motivo = async (contenido: Buffer, filename: string, tipo: string) =>
        ((await subir(tec, contenido, filename, tipo).expect(400)).body as ErrBody).message;
      // Foto válida con un ZIP pegado al final (políglota)
      expect(await motivo(Buffer.concat([fakePng(), Buffer.from('PK\x03\x04programa', 'latin1')]), 'foto.png', 'image/png'))
        .toBe(MENSAJES_EVIDENCIA.estructura);
      // JPEG con una página web o un script PHP adentro
      const conCodigo = (codigo: string) => { const b = fakeJpeg(200); b.write(codigo, 20, 'latin1'); return b; };
      expect(await motivo(conCodigo('<script>fetch("/api/users")</script>'), 'foto.jpg', 'image/jpeg')).toBe(MENSAJES_EVIDENCIA.codigo);
      expect(await motivo(conCodigo('<?php system($_GET["c"]); ?>'), 'shell.php.jpg', 'image/jpeg')).toBe(MENSAJES_EVIDENCIA.codigo);
      expect(await motivo(conCodigo('MZ This program cannot be run in DOS mode'), 'foto.jpg', 'image/jpeg')).toBe(MENSAJES_EVIDENCIA.codigo);
      // PDF que ejecuta JavaScript o abre un programa
      expect(await motivo(fakePdf('<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>'), 'factura.pdf', 'application/pdf')).toBe(MENSAJES_EVIDENCIA.pdf);
      expect(await motivo(fakePdf('<< /S /Launch /F (cmd.exe) >>'), 'factura.pdf', 'application/pdf')).toBe(MENSAJES_EVIDENCIA.pdf);
      // Ninguno quedó guardado
      expect(await prisma.evidencia.count({ where: { ordenId: orden.id, nombreArchivo: { in: ['foto.jpg', 'shell.php.jpg', 'factura.pdf'] } } })).toBe(0);
    });

    it('guarda con la extensión del tipo real y sirve el archivo aislado', async () => {
      const res = await subir(tec, fakeJpeg(), 'shell.php\r\nX-Inyectada: 1', 'image/jpeg').expect(201);
      const ev = (res.body as { evidencias: (Id & { nombreArchivo: string })[] }).evidencias.find((e) => e.nombreArchivo.startsWith('shell.php'))!;
      expect(ev.nombreArchivo).toBe('shell.phpX-Inyectada 1'); // sin saltos de línea
      const guardada = await prisma.evidencia.findUniqueOrThrow({ where: { id: ev.id } });
      expect(guardada.ruta).toMatch(/\.jpg$/); // nunca .php

      const foto = await tec.get(`/api/orders/${orden.id}/evidence/${ev.id}/file`).expect(200);
      expect(foto.headers['content-security-policy']).toMatch(/sandbox/);
      expect(foto.headers['content-security-policy']).toMatch(/default-src 'none'/);
      expect(foto.headers['content-disposition']).toMatch(/^inline;/);
      expect(foto.headers['x-inyectada']).toBeUndefined();

      const pdfRes = await subir(tec, fakePdf(), 'presupuesto-final.pdf', 'application/pdf').expect(201);
      const pdfEv = (pdfRes.body as { evidencias: (Id & { nombreArchivo: string })[] }).evidencias.find((e) => e.nombreArchivo === 'presupuesto-final.pdf')!;
      const pdf = await tec.get(`/api/orders/${orden.id}/evidence/${pdfEv.id}/file`).expect(200);
      expect(pdf.headers['content-disposition']).toMatch(/^attachment;/); // se abre fuera del sitio
    });

    it('un nombre con ../ no sale de la carpeta de evidencias', async () => {
      const res = await subir(tec, fakePng(), '../../../../windows/system32/evil.png', 'image/png').expect(201);
      const ev = (res.body as { evidencias: (Id & { nombreArchivo: string })[] }).evidencias.find((e) => e.nombreArchivo.includes('evil'))!;
      const guardada = await prisma.evidencia.findUniqueOrThrow({ where: { id: ev.id } });
      expect(guardada.ruta).toMatch(new RegExp(`^${orden.id}/[0-9a-f-]{36}\\.png$`));

      const descarga = await tec.get(`/api/orders/${orden.id}/evidence/${ev.id}/file`).expect(200);
      expect(descarga.headers['content-type']).toBe('image/png');
      expect(descarga.headers['x-content-type-options']).toBe('nosniff');
      expect(descarga.headers['content-disposition']).not.toMatch(/\.\.\//);
    });

    it('respeta el tamaño máximo', async () => {
      await subir(tec, fakeJpeg(1.2 * 1024 * 1024), 'grande.jpg', 'image/jpeg').expect(413);
      // Pasa por poco: el archivo supera 1 MB aunque el pedido todavía entra en el margen
      await subir(tec, fakeJpeg(1024 * 1024 + 10), 'justo.jpg', 'image/jpeg').expect(413);
    });

    // Lo que haría un script (Python, curl): el límite del navegador no lo frena
    describe('subidas pesadas por fuera del navegador', () => {
      const MB = 1024 * 1024;
      let galleta: string;
      let puerto: number;

      beforeAll(async () => {
        if (!app.getHttpServer().listening) await app.listen(0, '127.0.0.1');
        puerto = (app.getHttpServer().address() as AddressInfo).port;
        const r = await anon().post('/api/auth/login').send({ email: 'julieta@serviciotecnico.local', password: 'demo1234' }).expect(200);
        galleta = (r.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      });

      /** Manda hasta `mb` MB y cuenta cuántos llegó a recibir el servidor antes de cortar. */
      const inundar = (ruta: string, { mb = 80, declarar = false, campos = false, cookie = galleta } = {}) =>
        new Promise<{ status: number | null; mandados: number }>((listo) => {
          let status: number | null = null;
          let mandados = 0;
          let cerrado = false;
          const fin = () => { cerrado = true; listo({ status, mandados }); };
          const sock = connect(puerto, '127.0.0.1', () => {
            const largo = declarar ? `Content-Length: ${mb * MB}` : 'Transfer-Encoding: chunked';
            sock.write(`POST ${ruta} HTTP/1.1\r\nHost: 127.0.0.1:${puerto}\r\nCookie: ${cookie}\r\nContent-Type: multipart/form-data; boundary=XX\r\n${largo}\r\n\r\n`);
            const parte = (i: number) => {
              const cab = campos ? `--XX\r\nContent-Disposition: form-data; name="c${i}"\r\n\r\n`
                : i === 0 ? '--XX\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n' : '';
              return Buffer.concat([Buffer.from(cab), Buffer.alloc(MB, 97), Buffer.from(campos ? '\r\n' : '')]);
            };
            const seguir = (i: number) => {
              if (cerrado || i >= mb) return;
              const b = parte(i);
              const datos = declarar ? b : Buffer.concat([Buffer.from(`${b.length.toString(16)}\r\n`), b, Buffer.from('\r\n')]);
              sock.write(datos, () => { mandados += b.length / MB; setImmediate(seguir, i + 1); });
            };
            seguir(0);
          });
          sock.on('data', (d) => { status ??= Number(/^HTTP\/1\.1 (\d+)/.exec(d.toString('latin1'))?.[1] ?? 0) || null; });
          sock.on('error', () => undefined);
          sock.on('close', fin);
          sock.setTimeout(20_000, () => { status = -1; sock.destroy(); });
        });

      it('corta sin recibir todo, con o sin tamaño declarado y con o sin sesión', async () => {
        const ruta = `/api/orders/${orden.id}/evidence`;
        const casos: [string, Parameters<typeof inundar>[1]][] = [
          [ruta, { declarar: true }], [ruta, {}], [ruta, { campos: true }], [ruta, { cookie: 'x=1' }],
          ['/api/orders/no-existe/evidence', {}], ['/api/auth/login', {}], ['/api/auth/login', { declarar: true }], ['/api/no-existe', {}],
        ];
        for (const [r, op] of casos) {
          const { status, mandados } = await inundar(r, op);
          expect({ r, op, status: status === -1, recibioTodo: mandados >= 79 }).toEqual({ r, op, status: false, recibioTodo: false });
        }
        await anon().get('/api/health').expect(200);
        expect(await prisma.evidencia.count({ where: { tamanoKb: { gt: 1024 } } })).toBe(0);
      }, 120_000);

      it('rechaza más de un archivo o campos de texto en la misma subida', async () => {
        const url = `/api/orders/${orden.id}/evidence`;
        const antes = await prisma.evidencia.count();
        expect((await tec.post(url).field('extra', 'x').attach('file', fakePng(), 'a.png')).status).toBe(400);
        expect((await tec.post(url).attach('file', fakePng(), 'a.png').attach('file', fakePng(), 'b.png')).status).toBe(400);
        expect(await prisma.evidencia.count()).toBe(antes);
      });

      it('sin permiso sobre la orden no llega a leer el archivo', async () => {
        const julieta = request.agent(app.getHttpServer()).set('Cookie', galleta);
        await subir(julieta, fakePng(), 'a.png', 'image/png').expect(403);
        await julieta.post('/api/orders/no-existe/evidence').attach('file', fakePng(), 'a.png').expect(404);
      });

      it('limita las subidas seguidas de una misma persona', async () => {
        const estados: number[] = [];
        for (let i = 0; i < SUBIDAS_POR_MINUTO + 5; i++) estados.push((await subir(admin, fakePng(), 'a.png', 'image/png')).status);
        expect(estados[0]).toBe(201);
        expect(estados.at(-1)).toBe(429);
        // Otra persona no queda frenada
        expect((await subir(sup, fakePng(), 'a.png', 'image/png')).status).not.toBe(429);
      }, 60_000);
    });
  });

  // ---------------------------------------------------------------- cabeceras y configuración

  describe('cabeceras y configuración', () => {
    it('envía las cabeceras de seguridad y no revela la tecnología', async () => {
      const res = await anon().get('/api/health').expect(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['content-security-policy']).toMatch(/default-src 'self'/);
    });

    it('los errores no muestran detalles internos', async () => {
      const res = await recep.post('/api/clients').set('Content-Type', 'application/json').send('{"nombre":').expect(400);
      expect(Object.keys(res.body as object).sort()).toEqual(['message', 'statusCode']);
      expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules|\.ts:\d+/);
    });

    it('rechaza cuerpos JSON enormes', async () => {
      await recep.post('/api/clients').send({ nombre: 'Ana', telefono: telefono(), notas: 'x'.repeat(200_000) }).expect(413);
    });

    it('no hay rutas para vaciar la base', async () => {
      await anon().post('/api/dev/reset').send({ confirmacion: 'BORRAR' }).expect(404);
      expect((await anon().get('/api/setup/status').expect(200)).body).not.toHaveProperty('resetHabilitado');
      expect(await prisma.usuario.count()).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------- límites de cada campo

  describe('límites de validación', () => {
    const alta = (body: Record<string, unknown>) => recep.post('/api/clients').send({ telefono: telefono(), ...body });

    it('nombre de cliente', async () => {
      for (const nombre of ['A', '  ', '12345', '!!!', 'x'.repeat(41), 'Ana <b>', 'Ana\u202e', '=Ana', 123, null, ['Ana'], { n: 'Ana' }]) {
        expect({ nombre, status: (await alta({ nombre })).status }).toEqual({ nombre, status: 400 });
      }
      for (const nombre of ['Al', 'Ñandú Pérez', "D'Angelo", 'x'.repeat(40), '  Ana con espacios  ', 'Pérez & Cía. (Suc. 2)']) {
        expect({ nombre, status: (await alta({ nombre })).status }).toEqual({ nombre, status: 201 });
      }
    });

    it('ningún campo responde 500 con caracteres imposibles, fechas raras o null', async () => {
      const nulo = 'Texto con nulo \0 adentro';
      const base = { clienteId: cliente.id, equipoId: equipo.id, servicioId, responsableId: adminId, fallaReportada: 'No enciende para nada', impacto: 'BAJO', urgencia: 'BAJA', fechaEstimada: en3dias() };
      for (const campo of ['clienteId', 'fallaReportada', 'tecnicoId']) {
        expect([campo, (await recep.post('/api/orders').send({ ...base, [campo]: nulo })).status]).toEqual([campo, 400]);
      }
      for (const fechaEstimada of ['2026-W50', '2026-350', '20270101', '2027-02-30', '2027-13-01', 'mañana', '', 5]) {
        expect([fechaEstimada, (await recep.post('/api/orders').send({ ...base, fechaEstimada })).status]).toEqual([fechaEstimada, 400]);
      }
      for (const url of ['/api/orders/%00', '/api/orders?q=%00', '/api/clients?q=a%00b', '/api/equipment?clientId=%00', '/api/orders?ownerId=%00', '/api/orders/%E0%A4%A']) {
        expect([url, (await recep.get(url)).status]).toEqual([url, 400]);
      }
      for (const campo of ['nombre', 'roles', 'activo', 'password']) {
        expect([campo, (await admin.patch(`/api/setup/users/${tecId}`).send({ [campo]: null })).status]).toEqual([campo, 400]);
      }
      for (const campo of ['nombre', 'precioBase', 'activo']) {
        expect([campo, (await admin.patch(`/api/setup/services/${servicioId}`).send({ [campo]: null })).status]).toEqual([campo, 400]);
      }
      await sup.patch(`/api/orders/${orden.id}`).send({ responsableId: null }).expect(400);
      const profundo = await recep.post('/api/clients').set('Content-Type', 'application/json').send('['.repeat(20_000) + ']'.repeat(20_000));
      expect(profundo.status).toBe(400);
      const roto = await recep.post('/api/clients').set('Content-Type', 'application/json').send('{"nombre": ');
      expect((roto.body as ErrBody).message).toBe('El cuerpo de la solicitud no es un JSON válido');
    });

    it('los textos libres se guardan limpios y tienen que tener palabras', async () => {
      const c = (await recep.post('/api/clients').send({ nombre: 'Ana', telefono: telefono(), notas: '  Pantalla\u200b 15.6" \u202e<60Hz\u0007  ' }).expect(201)).body as { notas: string };
      expect(c.notas).toBe('Pantalla 15.6" <60Hz');
      const r = await recep.post('/api/clients').send({ nombre: 'Ana', telefono: telefono(), notas: '!!!!' }).expect(400);
      expect((r.body as ErrBody).message).toEqual(['Notas: escribí palabras o números, no solo signos']);
      await sup.post(`/api/orders/${orden.id}/block`).send({ motivo: '!!!!!!!!!!!!' }).expect(400);
      await sup.post(`/api/orders/${orden.id}/block`).send({ motivo: '\u200b'.repeat(20) }).expect(400);
      expect(((await recep.post('/api/clients').send({ nombre: 'Ana', telefono: ['x'] }).expect(400)).body as ErrBody).message).toEqual(['Ingresá el teléfono']);
    });

    it('teléfono de cliente', async () => {
      const con = (telefono: unknown) => recep.post('/api/clients').send({ nombre: 'Cliente Tel', telefono });
      for (const t of ['12345', '1234567890123456', 'once-cuatro', '11 4000 0000 ext 2', '', 1140000000]) {
        expect({ t, status: (await con(t)).status }).toEqual({ t, status: 400 });
      }
      for (const t of ['123456', '+54 9 11 4000-0000', '(011) 4000-0001', '123456789012345']) {
        expect({ t, status: (await con(t)).status }).toEqual({ t, status: 201 });
      }
    });

    it('email de cliente', async () => {
      for (const email of ['no-es-email', 'a@', '@b.com', 'a b@c.com', `${'a'.repeat(250)}@x.com`]) {
        expect({ email, status: (await alta({ nombre: 'Cliente Mail', email })).status }).toEqual({ email, status: 400 });
      }
      const ok = (await alta({ nombre: 'Cliente Mail', email: '  Mayus@Mail.COM ' }).expect(201)).body as { email: string };
      expect(ok.email).toBe('mayus@mail.com');
    });

    it('equipo', async () => {
      const con = (extra: Record<string, unknown>) =>
        recep.post('/api/equipment').send({ clienteId: cliente.id, tipo: 'NOTEBOOK', marca: 'HP', modelo: 'X', numeroSerie: `SEC-${++telefonos}`, ...extra });
      for (const extra of [{ numeroSerie: 'ab' }, { numeroSerie: 'AB 12' }, { numeroSerie: 'x'.repeat(41) }, { tipo: 'TOSTADORA' }, { marca: '' }, { clienteId: 'no-existe' }]) {
        expect({ extra, status: (await con(extra)).status }).toEqual({ extra, status: 400 });
      }
      const ok = (await con({ numeroSerie: 'ab-12/x.9' }).expect(201)).body as { numeroSerie: string };
      expect(ok.numeroSerie).toBe('AB-12/X.9');
    });

    it('orden', async () => {
      const con = (extra: Record<string, unknown>) => recep.post('/api/orders').send({
        clienteId: cliente.id, equipoId: equipo.id, servicioId, responsableId: adminId,
        fallaReportada: 'Se apaga sola a los diez minutos', impacto: 'MEDIO', urgencia: 'MEDIA', fechaEstimada: en3dias(), ...extra,
      });
      const ayer = new Date(Date.now() - 864e5).toISOString();
      const enDosAnios = new Date(Date.now() + 730 * 864e5).toISOString();
      for (const extra of [
        { fallaReportada: 'corta' }, { fallaReportada: 'x'.repeat(1001) }, { impacto: 'ALTISIMO' }, { urgencia: null },
        { fechaEstimada: 'mañana' }, { fechaEstimada: ayer }, { fechaEstimada: enDosAnios }, { servicioId: 'no-existe' },
      ]) {
        expect({ extra, status: (await con(extra)).status }).toEqual({ extra, status: 400 });
      }
      await con({}).expect(201);
    });

    it('servicios y precios', async () => {
      const con = (precioBase: unknown, nombre = `Servicio ${++telefonos}`) => admin.post('/api/setup/services').send({ nombre, precioBase });
      for (const p of [-1, 1.5, '100', null, 100_000_001, Number.MAX_SAFE_INTEGER]) {
        expect({ p, status: (await con(p)).status }).toEqual({ p, status: 400 });
      }
      await con(0).expect(201);
      await con(100_000_000).expect(201);
      await con(500, '123').expect(400);
    });

    it('contraseñas de personas nuevas', async () => {
      const con = (password: unknown) =>
        admin.post('/api/setup/users').send({ nombre: 'Persona Nueva', email: `nueva${++telefonos}@taller.com`, password, roles: ['TECNICO'] });
      for (const p of ['abc1234', 'solo-letras-largas', '1234567890', 'x'.repeat(199) + '1x', 12345678, '']) {
        expect({ p, status: (await con(p)).status }).toEqual({ p, status: 400 });
      }
      await con('abcdefg1').expect(201);
      await admin.post('/api/setup/users').send({ nombre: 'Sin Roles', email: 'sinroles@taller.com', password: 'abcdefg1', roles: [] }).expect(400);
      await admin.post('/api/setup/users').send({ nombre: 'Rol Falso', email: 'rolfalso@taller.com', password: 'abcdefg1', roles: ['DIOS'] }).expect(400);
    });
  });

  // ---------------------------------------------------------------- sesiones y fuerza bruta (al final: usan logins)

  describe('CSRF', () => {
    it('lo que modifica datos solo se acepta desde el frontend', async () => {
      const datos = () => ({ nombre: 'Cliente CSRF', telefono: telefono() });
      // Otra página del mismo navegador (otro puerto, otro dominio o un iframe aislado): bloqueado
      for (const origen of ['http://localhost:9999', 'https://sitio-malicioso.com', 'null']) {
        const r = await recep.post('/api/clients').set('Origin', origen).send(datos());
        expect([origen, r.status]).toEqual([origen, 403]);
      }
      await recep.post('/api/clients').set('Sec-Fetch-Site', 'cross-site').send(datos()).expect(403);
      await recep.post('/api/auth/logout').set('Origin', 'https://sitio-malicioso.com').expect(403);
      // Desde el frontend, o sin navegador de por medio: funciona
      await recep.post('/api/clients').set('Origin', 'http://localhost:4321').send(datos()).expect(201);
      await recep.post('/api/clients').set('Sec-Fetch-Site', 'same-site').send(datos()).expect(201);
      // Leer no modifica nada: no se bloquea (CORS ya impide que otra página lea la respuesta)
      await recep.get('/api/clients').set('Origin', 'https://sitio-malicioso.com').expect(200);
      expect(await prisma.cliente.count({ where: { nombre: 'Cliente CSRF' } })).toBe(2);
    });
  });

  describe('sesiones y fuerza bruta', () => {
    it('cambiar la contraseña cierra las demás sesiones, y el reseteo del Admin cierra todas', async () => {
      const otraPc = await login('carlos@serviciotecnico.local');
      await tec.post('/api/auth/password').send({ actual: 'demo1234', nueva: 'clave-nueva-1' }).expect(204);
      await tec.get('/api/auth/me').expect(200); // esta sesión recibió un token nuevo
      await otraPc.get('/api/auth/me').expect(401);
      await admin.patch(`/api/setup/users/${tecId}`).send({ password: 'clave-admin-2' }).expect(200);
      await tec.get('/api/auth/me').expect(401);
    });

    it('desactivar a alguien cierra sus sesiones aunque después se lo reactive', async () => {
      const r = await anon().post('/api/auth/login').send({ email: 'julieta@serviciotecnico.local', password: 'demo1234' }).expect(200);
      const token = /st_session=([^;]+)/.exec(String(r.headers['set-cookie']))![1]!;
      const julietaId = ((await admin.get('/api/setup/users').expect(200)).body as (Id & { email: string })[]).find((u) => u.email === 'julieta@serviciotecnico.local')!.id;
      await admin.patch(`/api/setup/users/${julietaId}`).send({ activo: false }).expect(200);
      await admin.patch(`/api/setup/users/${julietaId}`).send({ activo: true }).expect(200);
      await anon().get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });

    it(`frena a quien prueba muchas cuentas desde la misma IP (${LOGIN_POR_IP} por minuto)`, async () => {
      let bloqueadoEn = 0;
      for (let i = 1; i <= LOGIN_POR_IP + 2 && !bloqueadoEn; i++) {
        const r = await anon().post('/api/auth/login').send({ email: `victima${i}@serviciotecnico.local`, password: 'Password1' });
        if (r.status === 429) bloqueadoEn = i;
        else expect(r.status).toBe(401);
      }
      expect(bloqueadoEn).toBeGreaterThan(0);
      expect(bloqueadoEn).toBeLessThanOrEqual(LOGIN_POR_IP);
      // Bloqueada la IP, ni siquiera la contraseña correcta entra
      await anon().post('/api/auth/login').send({ email: 'supervisor@serviciotecnico.local', password: 'demo1234' }).expect(429);
    });
  });
});
