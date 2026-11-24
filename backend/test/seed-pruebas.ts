/**
 * Datos de las pruebas e2e: un taller ya configurado (id 1) con una persona por rol y los
 * servicios iniciales. Solo corre sobre esquemas de prueba (e2e_…): nunca toca una base real.
 * La versión final no trae usuarios de ejemplo: cada taller se crea desde la portada.
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import type { Rol } from '../src/generated/prisma/enums';
import { SERVICIOS_INICIALES } from '../src/domain/servicios';
import { createPgAdapter } from '../src/prisma/adapter';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');
const esquema = new URL(url).searchParams.get('schema') ?? 'public';
if (!/^e2e_[a-z0-9_]{1,50}$/.test(esquema)) {
  throw new Error(`Los datos de prueba solo se cargan en esquemas e2e_… (DATABASE_URL apunta a «${esquema}»)`);
}
const prisma = new PrismaClient({ adapter: createPgAdapter(url) });

/** Contraseña de todas las personas de prueba (solo existen dentro de los esquemas e2e_…). */
const CLAVE_PRUEBAS = 'demo1234';

const USERS: { nombre: string; email: string; roles: Rol[] }[] = [
  { nombre: 'Laura Méndez', email: 'admin@serviciotecnico.local', roles: ['ADMIN'] },
  { nombre: 'Ana Ríos', email: 'supervisor@serviciotecnico.local', roles: ['SUPERVISOR'] },
  { nombre: 'Martín Sosa', email: 'recepcion@serviciotecnico.local', roles: ['RECEPCION'] },
  { nombre: 'Carlos Ibáñez', email: 'carlos@serviciotecnico.local', roles: ['TECNICO'] },
  { nombre: 'Julieta Paz', email: 'julieta@serviciotecnico.local', roles: ['TECNICO'] },
];

async function main() {
  // Sin personas: para probar el primer uso (el taller se crea desde la portada)
  if (process.env.SEED_USERS === 'false') return;
  const passwordHash = await argon2.hash(CLAVE_PRUEBAS);
  const taller = await prisma.taller.create({ data: { id: 1, nombre: 'Taller de pruebas', configurado: true } });
  // Con id explícito la secuencia no avanza: que el próximo taller no choque con este.
  // Todo va como parámetro: el nombre de la tabla es un dato para pg_get_serial_sequence, no SQL
  const tabla = `"${esquema}"."Taller"`;
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence(${tabla}::text, 'id'), ${1}::bigint)`;
  await prisma.usuario.createMany({ data: USERS.map((u) => ({ ...u, passwordHash, tallerId: taller.id })) });
  await prisma.servicio.createMany({ data: SERVICIOS_INICIALES.map((s) => ({ ...s, tallerId: taller.id })) });
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
