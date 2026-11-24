import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Sin exigirla acá: `prisma generate` (corre en cada `npm install`, también en servidores
    // de compilación como Vercel) no se conecta a la base. Las migraciones sí la necesitan y
    // Prisma avisa si falta; el backend no arranca sin ella (src/config/env.ts).
    url: process.env.DATABASE_URL,
  },
});
