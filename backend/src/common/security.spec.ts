import { deflateSync } from 'node:zlib';
import { coincideFirma, MENSAJES_EVIDENCIA, nombreSeguro, problemaEvidencia } from '../orders/evidence.signature';
import { corteDeSesiones, nuevaSesion, sesionVigente } from '../auth/sessions';
import { validateEnv } from '../config/env';
import {
  MAX_EVIDENCIA_MB, SERIE_RE, limpiarNombre, limpiarTexto, problemaEmail, problemaNombre, problemaPassword, problemaTelefono, problemaTexto,
} from '../domain/validation';
import { problemaCuerpo, problemaUrl } from './safe-text';
import { escapeLike } from './text';
import { Logger } from '@nestjs/common';
import { eventoSeguridad, ocultarEmail } from './security-log';

describe('escapeLike', () => {
  it('escapa los comodines de LIKE y la barra invertida', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('c:\\temp')).toBe('c:\\\\temp');
    expect(escapeLike("' OR 1=1 --")).toBe("' OR 1=1 --");
  });
});

describe('firma de archivos', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  it('acepta el contenido que corresponde al tipo', () => {
    expect(coincideFirma('image/png', png)).toBe(true);
    expect(coincideFirma('image/jpeg', jpg)).toBe(true);
    expect(coincideFirma('image/gif', Buffer.from('GIF89a....'))).toBe(true);
    expect(coincideFirma('image/webp', Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe(true);
    expect(coincideFirma('image/heic', Buffer.from('\0\0\0\x18ftypheic\0\0\0\0', 'latin1'))).toBe(true);
    expect(coincideFirma('application/pdf', Buffer.from('%PDF-1.7\n'))).toBe(true);
  });
  it('rechaza tipos cambiados, vacíos o no admitidos', () => {
    expect(coincideFirma('image/jpeg', png)).toBe(false);
    expect(coincideFirma('image/png', Buffer.from('<html>'))).toBe(false);
    expect(coincideFirma('image/png', Buffer.alloc(0))).toBe(false);
    expect(coincideFirma('image/svg+xml', Buffer.from('<svg/>'))).toBe(false);
    expect(coincideFirma('text/html', Buffer.from('<html>'))).toBe(false);
  });
});

describe('contenido malicioso en evidencias', () => {
  const IEND = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const png = (medio = Buffer.alloc(16, 1)) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), medio, IEND]);
  const jpg = (medio: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(medio, 'latin1'), Buffer.from([0xff, 0xd9])]);
  const pdf = (cuerpo: string) => Buffer.from(`%PDF-1.7\n${cuerpo}\n%%EOF\n`, 'latin1');
  const gif = (medio = '\0'.repeat(8)) => Buffer.from(`GIF89a${medio};`, 'latin1');
  const webp = (largoDeclarado?: number) => {
    const b = Buffer.alloc(32, 0);
    b.write('RIFF', 0, 'latin1');
    b.writeUInt32LE(largoDeclarado ?? b.length - 8, 4);
    b.write('WEBPVP8 ', 8, 'latin1');
    return b;
  };

  it('acepta archivos limpios y completos', () => {
    expect(problemaEvidencia('image/png', png())).toBeNull();
    expect(problemaEvidencia('image/jpeg', jpg('foto normal'))).toBeNull();
    expect(problemaEvidencia('image/gif', gif())).toBeNull();
    expect(problemaEvidencia('image/webp', webp())).toBeNull();
    expect(problemaEvidencia('application/pdf', pdf('1 0 obj << /Type /Catalog /OpenAction 2 0 R >> endobj'))).toBeNull();
    // Datos de cámara en JPEG (EXIF/XMP) no son código
    expect(problemaEvidencia('image/jpeg', jpg('Exif\0\0<?xpacket begin="" id="W5M0"?><x:xmpmeta>'))).toBeNull();
  });

  it('rechaza archivos con datos pegados al final (políglotas)', () => {
    expect(problemaEvidencia('image/png', Buffer.concat([png(), Buffer.from('PK\x03\x04zip escondido', 'latin1')]))).toBe(MENSAJES_EVIDENCIA.estructura);
    expect(problemaEvidencia('image/gif', Buffer.from('GIF89a\0\0\0\0\0\0\0\0;extra', 'latin1'))).toBe(MENSAJES_EVIDENCIA.estructura);
    expect(problemaEvidencia('image/webp', webp(10))).toBe(MENSAJES_EVIDENCIA.estructura);
    expect(problemaEvidencia('application/pdf', Buffer.from('%PDF-1.7\nsin cierre'))).toBe(MENSAJES_EVIDENCIA.estructura);
  });

  it('rechaza HTML, scripts, PHP y programas escondidos dentro de una foto', () => {
    for (const codigo of ['<script>alert(1)</script>', '<SCRIPT src=//x>', '<html><body>', '<?php system($_GET["c"]); ?>',
      '<svg onload=alert(1)>', '<iframe src=x>', 'javascript:alert(1)', 'MZ\x90\0This program cannot be run in DOS mode.']) {
      expect([codigo, problemaEvidencia('image/jpeg', jpg(codigo))]).toEqual([codigo, MENSAJES_EVIDENCIA.codigo]);
    }
    expect(problemaEvidencia('image/png', png(Buffer.from('<?php echo 1; ?>')))).toBe(MENSAJES_EVIDENCIA.codigo);
  });

  it('rechaza PDF con JavaScript, adjuntos o acciones que abren programas', () => {
    for (const cuerpo of ['<< /S /JavaScript /JS (app.alert(1)) >>', '<< /JS 5 0 R >>', '<< /S /Launch /F (cmd.exe) >>',
      '<< /Names << /EmbeddedFiles 3 0 R >> >>', '<< /RichMedia 1 0 R >>', '<< /XFA 2 0 R >>', '<< /S /SubmitForm >>',
      '<< /S /J#61vaScript >>', '<< /#4A#53 (x) >>']) {
      expect([cuerpo, problemaEvidencia('application/pdf', pdf(cuerpo))]).toEqual([cuerpo, MENSAJES_EVIDENCIA.pdf]);
    }
    // «/JSON» o «/Type» no son JavaScript
    expect(problemaEvidencia('application/pdf', pdf('<< /JSON 1 /Type /Page >>'))).toBeNull();
  });

  it('encuentra JavaScript escondido en objetos comprimidos del PDF', () => {
    const oculto = deflateSync(Buffer.from('<< /S /JavaScript /JS (app.alert(1)) >>'));
    const cuerpo = `5 0 obj << /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${oculto.length} >>\nstream\n${oculto.toString('latin1')}\nendstream\nendobj`;
    expect(problemaEvidencia('application/pdf', pdf(cuerpo))).toBe(MENSAJES_EVIDENCIA.pdf);
  });

  it('los datos de una imagen dentro del PDF no dan falsos positivos', () => {
    // Bytes de imagen que, leídos como texto, parecen claves peligrosas: no son diccionarios
    const imagen = Buffer.from('\x01/JS\x02<script\x03/Launch\x04', 'latin1');
    const cuerpo = `4 0 obj << /Type /XObject /Subtype /Image /Length ${imagen.length} >>\nstream\n${imagen.toString('latin1')}\nendstream\nendobj`;
    expect(problemaEvidencia('application/pdf', pdf(cuerpo))).toBeNull();
  });

  it('rechaza un PDF que se infla sin fin al descomprimirlo (bomba zip)', () => {
    const bomba = deflateSync(Buffer.alloc(60 * 1024 * 1024, 0x20));
    const cuerpo = `5 0 obj << /Type /ObjStm /Filter /FlateDecode >>\nstream\n${bomba.toString('latin1')}\nendstream\nendobj`;
    expect(problemaEvidencia('application/pdf', pdf(cuerpo))).toBe(MENSAJES_EVIDENCIA.estructura);
  });

  it('el nombre visible no trae carpetas, saltos de línea ni caracteres invisibles', () => {
    expect(nombreSeguro('../../windows/system32/evil.png')).toBe('evil.png');
    expect(nombreSeguro('C:\\Users\\x\\foto.jpg')).toBe('foto.jpg');
    expect(nombreSeguro('a\r\nSet-Cookie: x=1.png')).toBe('aSet-Cookie x=1.png');
    expect(nombreSeguro('factura\u202Egpj.exe')).toBe('facturagpj.exe'); // inversión de texto que disfraza la extensión
    expect(nombreSeguro('..')).toBe('archivo');
    expect(nombreSeguro('')).toBe('archivo');
    expect(nombreSeguro('x'.repeat(300))).toHaveLength(200);
  });
});

describe('PDF preparados para frenar el servidor', () => {
  const pdf = (cuerpo: Buffer | string) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from(cuerpo as Buffer), Buffer.from('\n%%EOF\n')]);

  it('suma lo descomprimido de todos los objetos (bomba zip repartida)', () => {
    const inflable = deflateSync(Buffer.alloc(8 * 1024 * 1024, 32));
    const objeto = Buffer.concat([Buffer.from('1 0 obj << /Type /ObjStm /Filter /FlateDecode >>\nstream\n'), inflable, Buffer.from('\nendstream endobj\n')]);
    expect(problemaEvidencia('application/pdf', pdf(Buffer.concat([objeto, objeto])))).toBeNull(); // 16 MB: entra
    expect(problemaEvidencia('application/pdf', pdf(Buffer.concat(Array<Buffer>(12).fill(objeto))))).toBe(MENSAJES_EVIDENCIA.estructura);
  });

  it('cientos de miles de streams no lo hacen lento', () => {
    const t = Date.now();
    problemaEvidencia('application/pdf', pdf('stream\nendstream\n'.repeat(300_000)));
    expect(Date.now() - t).toBeLessThan(3000); // antes: minutos
  });

  it('un JavaScript en un object stream se sigue detectando después de otros streams', () => {
    const js = deflateSync(Buffer.from('<< /S /JavaScript /JS (app.alert(1)) >>'));
    const cuerpo = Buffer.concat([
      Buffer.from('1 0 obj << /Length 3 >>\nstream\nabc\nendstream endobj\n2 0 obj << /Type /ObjStm /Filter /FlateDecode >>\nstream\n'), js, Buffer.from('\nendstream endobj'),
    ]);
    expect(problemaEvidencia('application/pdf', pdf(cuerpo))).toBe(MENSAJES_EVIDENCIA.pdf);
  });
});

describe('textos al crear y al ingresar', () => {
  it('nombres: hasta 40, sin caracteres raros y sin espacios de más', () => {
    expect(limpiarNombre('  Ana \t  Pérez\n ')).toBe('Ana Pérez');
    expect(limpiarNombre('n\u0303andu')).toBe('ñandu'); // tilde suelta: queda unificada
    for (const ok of ['Ñandú Pérez', "D'Angelo", 'O’Higgins', 'Taller 24 hs.', 'Pérez & Cía. (Suc. 2)', 'Upgrade RAM / SSD', 'x'.repeat(40)]) {
      expect([ok, problemaNombre('N', ok)]).toEqual([ok, null]);
    }
    for (const mal of ['x'.repeat(41), '<b>', 'a;b', 'a"b', 'a`b', 'a{b}', 'a[b]', 'a\\b', 'a|b', 'a=b', 'a*b', 'a%b', 'a$b', 'a@b', 'a!b', 'a?b', '+ab', '-ab', 'a\u0000b', 'a\u200bb', 'a\u202eb', '12', '']) {
      expect([mal, problemaNombre('N', mal) !== null]).toEqual([mal, true]);
    }
  });

  it('emails: hasta 40 y sin caracteres raros', () => {
    for (const ok of ['a@x.co', 'ana.perez+taller@sub.mi-taller.com.ar', `${'a'.repeat(33)}@x.com`]) expect([ok, problemaEmail(ok)]).toEqual([ok, null]);
    for (const mal of ['', '@', 'a@', '@x.com', 'a@x', 'a@x.c', 'a b@x.com', 'a@x .com', ' a@x.com', 'a@x.com ', 'a@x..com', 'a@x.com.', 'a<b@x.com', `${'a'.repeat(36)}@x.co`, `${'a-'.repeat(50_000)}@x.com`]) {
      expect([mal.slice(0, 50), problemaEmail(mal) !== null]).toEqual([mal.slice(0, 50), true]);
    }
  });

  it('contraseñas: hasta 40, con símbolos pero sin espacios en las puntas ni invisibles', () => {
    expect(problemaPassword('¡Cl@ve "rara" <1>;', 8)).toBeNull();
    expect(problemaPassword('a1'.repeat(20), 8)).toBeNull();
    for (const mal of ['a1'.repeat(20) + 'x', ' clave-larga-1', 'clave-larga-1 ', 'clave\tlarga-1', 'clave\u200blarga-1', '\u00a0clave-larga-1']) {
      expect([mal, problemaPassword(mal, 8) !== null]).toEqual([mal, true]);
    }
  });
});

describe('textos libres', () => {
  it('limpia invisibles, códigos de control y texto invertido, y conserva lo que se ve', () => {
    expect(limpiarTexto('  a\u200bb \u202ec\u0007d\u001b[31m\ufeff  ')).toBe('ab cd[31m');
    expect(limpiarTexto('uno\r\ndos\u2028tres\n\n\n\n\ncuatro\tcinco')).toBe('uno\ndos\ntres\n\ncuatro\tcinco');
    for (const igual of ['Pantalla 15.6" <60Hz, 5V/2A & 100°C', 'C:\\win {x} [y] | 50%', 'Quedó 👍🏽', 'Familia 👨‍👩‍👧', 'El señor Muñoz: ¿cuánto? ¡Ya!']) {
      expect(limpiarTexto(igual)).toBe(igual);
      expect(problemaTexto('T', igual, 1, 500)).toBeNull();
    }
    expect(limpiarTexto('a\u200db')).toBe('ab'); // la unión de emojis entre letras no hace falta
  });

  it('exige palabras o números y respeta los largos', () => {
    for (const mal of ['!'.repeat(30), '.'.repeat(30), '😀'.repeat(15), 'x'.repeat(501), 'corto', `Texto${'\u0301'.repeat(60)} zalgo`]) {
      expect([mal.slice(0, 20), problemaTexto('T', limpiarTexto(mal), 10, 500) !== null]).toEqual([mal.slice(0, 20), true]);
    }
    expect(problemaTexto('Notas', '', 0, 300)).toBeNull();
    expect(problemaTexto('Motivo', '', 10, 500, 'El motivo es obligatorio')).toBe('El motivo es obligatorio');
  });

  it('textos gigantes o armados para ser lentos se resuelven enseguida', () => {
    const t = Date.now();
    for (const x of [' '.repeat(1e5) + 'a', '\n'.repeat(1e5) + 'a', '\u200d'.repeat(1e5), 'a\u0301'.repeat(5e4), '('.repeat(1e5), '1'.repeat(1e5), '(1'.repeat(5e4)]) {
      problemaTexto('T', limpiarTexto(x), 1, 500);
      problemaTelefono(limpiarNombre(x));
      problemaNombre('N', limpiarNombre(x));
      problemaEmail(x);
      problemaPassword(x, 8);
    }
    expect(Date.now() - t).toBeLessThan(2000);
  });

  it('teléfonos y números de serie armados como corresponde', () => {
    for (const ok of ['+54 9 11 4000-0000', '(011) 4000-0001', '(+54) 11 4000-0002', '123456']) expect([ok, problemaTelefono(ok)]).toEqual([ok, null]);
    for (const mal of ['11\n4444-5555', '11\t4444-5555', '11+4444+5555', '((((11 4444-5555', ')11( 4444-5555', '()1144445555', '١١٤٤٤٤٥٥٥٥']) {
      expect([mal, problemaTelefono(mal) !== null]).toEqual([mal, true]);
    }
    expect(['S-1/2.3_A', '---', '...', '-A1'].map((s) => SERIE_RE.test(s))).toEqual([true, false, false, false]);
  });

  it('el carácter nulo, los medios emojis y lo muy anidado se frenan antes de llegar a la base', () => {
    for (const mal of [{ a: 'x\0' }, { a: ['ok', { b: '\ud800' }] }, { 'k\0': 1 }, '\0']) expect(problemaCuerpo(mal)).not.toBeNull();
    let anidado: unknown = 1;
    for (let i = 0; i < 50_000; i++) anidado = [anidado];
    expect(problemaCuerpo(anidado)).toBe('La solicitud tiene un formato inválido');
    for (const ok of [undefined, null, 5, {}, { a: ['😀', { b: null }] }]) expect(problemaCuerpo(ok)).toBeNull();
    for (const mal of ['/api/orders/%00', '/api/orders?q=a%00b', '/api/x%E0%A4%A']) expect([mal, problemaUrl(mal) !== null]).toEqual([mal, true]);
    expect(problemaUrl('/api/orders?q=ñand%C3%BA+50%25')).toBeNull();
  });

  it('el nombre de un archivo se corta sin romper emojis y sin caracteres raros', () => {
    const n = nombreSeguro(`a${'😀'.repeat(150)}.png`);
    expect(() => encodeURIComponent(n)).not.toThrow();
    expect(nombreSeguro('<img src=x>:"|?*.png')).toBe('img src=x.png');
  });
});

describe('corte de sesiones', () => {
  it('sin corte, toda sesión vale', () => {
    expect(sesionVigente({ sub: 'u' }, null)).toBe(true);
  });
  it('vale la sesión emitida después del corte, aunque sea en el mismo segundo', () => {
    const corte = corteDeSesiones();
    expect(sesionVigente(nuevaSesion('u'), corte)).toBe(true);
    expect(sesionVigente({ sub: 'u', t: corte.getTime() - 1 }, corte)).toBe(false);
  });
  it('los tokens sin «t» se comparan por iat (segundos)', () => {
    const corte = new Date(10_000_500);
    expect(sesionVigente({ sub: 'u', iat: 10_000 }, corte)).toBe(false);
    expect(sesionVigente({ sub: 'u', iat: 10_001 }, corte)).toBe(true);
    expect(sesionVigente({ sub: 'u' }, corte)).toBe(false);
  });
});

describe('tamaño máximo de evidencia', () => {
  const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(40) };
  it('por defecto es 10 MB', () => {
    expect(MAX_EVIDENCIA_MB).toBe(10);
    expect(validateEnv(base).UPLOAD_MAX_MB).toBe(10);
  });
  it('UPLOAD_MAX_MB puede bajarlo, pero no subirlo ni ser inválido', () => {
    expect(validateEnv({ ...base, UPLOAD_MAX_MB: '2' }).UPLOAD_MAX_MB).toBe(2);
    for (const v of ['11', '100', '0', '-1', 'diez']) {
      expect(() => validateEnv({ ...base, UPLOAD_MAX_MB: v })).toThrow(/UPLOAD_MAX_MB/);
    }
  });
});

describe('configuración de producción', () => {
  const prod = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'x'.repeat(40), NODE_ENV: 'production', COOKIE_SECURE: 'true', CORS_ORIGIN: 'https://taller.com' };
  it('arranca con HTTPS y cookie segura', () => {
    expect(validateEnv(prod).COOKIE_SECURE).toBe(true);
  });
  it('no arranca con cookie sin Secure, orígenes http o sesiones demasiado largas', () => {
    expect(() => validateEnv({ ...prod, COOKIE_SECURE: 'false' })).toThrow(/COOKIE_SECURE/);
    expect(() => validateEnv({ ...prod, CORS_ORIGIN: 'https://taller.com,http://taller.com' })).toThrow(/https/);
    expect(() => validateEnv({ ...prod, JWT_EXPIRES_IN: '30d' })).toThrow(/JWT_EXPIRES_IN/);
  });
  it('TRUST_PROXY: por defecto 0 (nadie puede falsear la IP); solo enteros chicos', () => {
    expect(validateEnv(prod).TRUST_PROXY).toBe(0);
    expect(validateEnv({ ...prod, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    for (const v of ['-1', '1.5', 'true', '99']) expect(() => validateEnv({ ...prod, TRUST_PROXY: v })).toThrow(/TRUST_PROXY/);
  });
  it('en desarrollo se permite http y cookie sin Secure', () => {
    expect(validateEnv({ ...prod, NODE_ENV: 'development', COOKIE_SECURE: 'false', CORS_ORIGIN: 'http://localhost:4321' }).COOKIE_SECURE).toBe(false);
  });
});

describe('registro de seguridad', () => {
  it('oculta el email', () => {
    expect(ocultarEmail('Ana.Perez@Taller.com')).toBe('a***@taller.com');
    expect(ocultarEmail('sin-arroba')).toBe('***');
    expect(ocultarEmail({ $ne: null })).toBe('***');
  });
  it('un valor con saltos de línea no puede inventar líneas falsas en el log', () => {
    const espia = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    eventoSeguridad('login.fallido', { email: 'x\n[Seguridad] {"evento":"login.ok"}' });
    const linea = String(espia.mock.calls[0]?.[0]);
    espia.mockRestore();
    expect(linea).not.toContain('\n');
    expect(JSON.parse(linea)).toEqual({ evento: 'login.fallido', email: 'x\n[Seguridad] {"evento":"login.ok"}' });
  });
});

describe('sesiones', () => {
  it('cada sesión tiene un id único para poder cerrarla', () => {
    const a = nuevaSesion('u');
    const b = nuevaSesion('u');
    expect(a.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.jti).not.toBe(b.jti);
  });
});

describe('reglas de validación', () => {
  it('teléfono', () => {
    expect(problemaTelefono('11 4000-0000')).toBeNull();
    expect(problemaTelefono('12345')).toMatch(/al menos 6/);
    expect(problemaTelefono('1234567890123456')).toMatch(/más de 15/);
    expect(problemaTelefono('11-abc')).toMatch(/solo números/);
  });
  it('contraseña', () => {
    expect(problemaPassword('abcdefg1', 8)).toBeNull();
    expect(problemaPassword('abc1', 8)).toMatch(/al menos 8/);
    expect(problemaPassword('abcdefgh', 8)).toMatch(/letras y números/);
    expect(problemaPassword('12345678', 8)).toMatch(/letras y números/);
  });
});
