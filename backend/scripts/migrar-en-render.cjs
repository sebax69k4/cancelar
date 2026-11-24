/**
 * Corre solo después de `npm run build` (postbuild) y solo en Render, que define RENDER=true.
 * Aplica las migraciones pendientes aunque el comando de arranque no lo haga: sin ellas, la
 * versión nueva arranca pero le faltan tablas. Si fallan, falla la compilación y Render deja
 * andando la versión anterior.
 */
const { spawnSync } = require('node:child_process');

if (process.env.RENDER !== 'true' || !process.env.DATABASE_URL) process.exit(0);

console.log('Render: aplicando migraciones pendientes…');
const r = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) console.error('Las migraciones fallaron: no se publica esta versión.');
process.exit(r.status ?? 1);
