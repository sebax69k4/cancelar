import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Guardia contra la inyección SQL: todas las consultas pasan por Prisma, que manda los valores
 * como parámetros aparte del SQL. Las únicas formas de armar SQL concatenando texto son las
 * variantes «Unsafe» y Prisma.raw: si alguien las agrega al código, esta prueba falla.
 */
const SRC = join(__dirname, '..');
const RAIZ = join(SRC, '..');
/** Código de la app, la semilla y las pruebas: en ninguno se arma SQL concatenando texto. */
const CARPETAS = [SRC, join(RAIZ, 'prisma'), join(RAIZ, 'test')];
const PROHIBIDO = /\$(?:queryRawUnsafe|executeRawUnsafe)\s*\(|Prisma\.raw\s*\(/;

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'generated' ? [] : archivos(ruta); // cliente generado por Prisma
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') ? [ruta] : [];
  });
}

describe('consultas SQL', () => {
  it('ningún archivo arma SQL concatenando texto', () => {
    const lista = CARPETAS.flatMap(archivos);
    expect(lista.length).toBeGreaterThan(20);
    expect(lista.some((f) => f.endsWith('seed-pruebas.ts'))).toBe(true);
    const culpables = lista.filter((f) => PROHIBIDO.test(readFileSync(f, 'utf8'))).map((f) => relative(RAIZ, f));
    expect(culpables).toEqual([]);
  });

  it('el SQL directo que queda usa plantillas con parámetros', () => {
    // $queryRaw`...` (con comillas invertidas) parametriza cada ${valor}; $queryRaw(...) con texto no
    const crudos = CARPETAS.flatMap(archivos).filter((f) => /\$(?:queryRaw|executeRaw)\s*\(/.test(readFileSync(f, 'utf8')));
    expect(crudos).toEqual([]);
  });
});
